import { useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  collection, query, where, orderBy, limit,
  onSnapshot, doc, getDoc, Timestamp,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { Host, Order } from '../lib/schema';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:      '#ffffff',
  bg2:     '#f7f7f5',
  bg3:     '#f0f0ec',
  border:  '#e8e8e4',
  border2: '#d4d4ce',
  text:    '#1a1a1a',
  text2:   '#6b6b6b',
  text3:   '#b0b0a8',
  accent:  '#0066cc',
  danger:  '#cc3300',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function krw(n: number) { return '₩' + n.toLocaleString('ko-KR'); }
function pct(n: number) { return (n * 100).toFixed(0) + '%'; }

function timeAgo(date: Date) {
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60)    return '방금';
  if (diff < 3600)  return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

const STATUS_LABEL: Record<Order['status'], string> = {
  new:       '접수됨',
  processing:'처리중',
  shipped:   '배송중',
  done:      '배달완료',
  cancelled: '취소',
};
const STATUS_DOT: Record<Order['status'], string> = {
  new:       '#f59e0b',
  processing: T.accent,
  shipped:   T.text3,
  done:      T.border2,
  cancelled: T.danger,
};

// ─── QR 생성 (canvas 기반, 외부 라이브러리 없이) ──────────────────────────────
// 실제 QR 생성을 위해서는 'qrcode' npm 패키지 사용 권장
// npm install qrcode && import QRCode from 'qrcode'
// 여기서는 qrcode 패키지 사용 코드 준비
async function generateQRDataUrl(text: string): Promise<string> {
  // qrcode 패키지가 설치된 경우:
  // const QRCode = (await import('qrcode')).default;
  // return await QRCode.toDataURL(text, { width: 240, margin: 2, color: { dark: '#1a1a1a', light: '#ffffff' } });

  // 폴백: QR API 서비스 사용 (네트워크 필요)
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(text)}&color=1a1a1a&bgcolor=ffffff`;
}

// ─── QR 다운로드 ──────────────────────────────────────────────────────────────
async function downloadQR(hostId: string, hostName: string) {
  const url = `${window.location.origin}/?host=${hostId}`;
  const qrSrc = await generateQRDataUrl(url);

  // 이미지 다운로드
  const a = document.createElement('a');
  a.href = qrSrc;
  a.download = `KSHOP_QR_${hostName.replace(/\s/g, '_')}.png`;
  a.click();
}

// ─── 로그인 화면 ──────────────────────────────────────────────────────────────
function HostLoginPage({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail]     = useState('');
  const [pw, setPw]           = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pw);
      onLogin();
    } catch {
      setError('이메일 또는 비밀번호가 올바르지 않습니다');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:T.bg2, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Geist',system-ui,sans-serif" }}>
      <div style={{ width:320, background:T.bg, border:`1px solid ${T.border}`, borderRadius:10, padding:32 }}>
        <div style={{ fontSize:15, fontWeight:600, marginBottom:2 }}>K-SHOP 호스트</div>
        <div style={{ fontSize:12, color:T.text3, marginBottom:24 }}>주문 현황 및 리워드 확인</div>
        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <Field label="이메일">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputSt} />
          </Field>
          <Field label="비밀번호">
            <input type="password" value={pw} onChange={e => setPw(e.target.value)} required style={inputSt} />
          </Field>
          {error && <div style={{ fontSize:12, color:T.danger }}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{ marginTop:4, padding:'9px', borderRadius:7, background: loading ? T.bg3 : T.text, color: loading ? T.text3 : T.bg, border:'none', fontSize:13, fontWeight:600, fontFamily:'inherit', cursor: loading ? 'default' : 'pointer' }}>
            {loading ? '...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputSt: React.CSSProperties = {
  width:'100%', padding:'8px 10px', borderRadius:6,
  border:`1px solid ${T.border}`, background:T.bg,
  color:T.text, fontSize:13, fontFamily:'inherit', outline:'none',
};

function Field({ label, children }: { label:string; children:React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize:12, color:T.text2, marginBottom:5 }}>{label}</div>
      {children}
    </div>
  );
}

// ─── 통계 카드 ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent?: boolean;
}) {
  return (
    <div style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:8, padding:'16px 18px' }}>
      <div style={{ fontSize:11, color:T.text3, marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:600, color: accent ? T.accent : T.text, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:T.text3, marginTop:4 }}>{sub}</div>}
    </div>
  );
}

// ─── 주문 행 ──────────────────────────────────────────────────────────────────
function OrderRow({ order }: { order: Order }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          display:'grid', gridTemplateColumns:'88px 1fr 90px 80px 72px',
          padding:'11px 16px', borderBottom:`1px solid ${T.border}`,
          cursor:'pointer', alignItems:'center',
          background: open ? T.bg2 : T.bg,
        }}
      >
        <div style={{ fontSize:11, color:T.text3, fontFamily:'monospace' }}>{order.id}</div>
        <div>
          <div style={{ fontSize:12, fontWeight:500, color:T.text }}>{order.guestName}</div>
          <div style={{ fontSize:11, color:T.text3 }}>
            {order.items.map(i => i.nameKo).join(', ').slice(0, 30)}
          </div>
        </div>
        <div style={{ fontSize:12, color:T.text }}>{krw(order.totalKrw)}</div>
        <div>
          <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}>
            <span style={{ width:5, height:5, borderRadius:'50%', background: STATUS_DOT[order.status], display:'inline-block', flexShrink:0 }} />
            <span style={{ fontSize:12, color:T.text2 }}>{STATUS_LABEL[order.status]}</span>
          </span>
        </div>
        <div style={{ fontSize:11, color:T.text3 }}>{timeAgo(order.createdAt)}</div>
      </div>

      {/* 펼침 — 상품 목록 */}
      {open && (
        <div style={{ padding:'10px 16px 14px', background:T.bg2, borderBottom:`1px solid ${T.border}` }}>
          <div style={{ fontSize:10, color:T.text3, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:8 }}>주문 상품</div>
          {order.items.map((item, i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:T.text2, paddingBottom:4 }}>
              <span>{item.nameKo} × {item.quantity}</span>
              <span>{krw(item.unitPriceKrw * item.quantity)}</span>
            </div>
          ))}
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, fontWeight:500, color:T.text, paddingTop:8, borderTop:`1px solid ${T.border}`, marginTop:4 }}>
            <span>내 리워드</span>
            <span style={{ color:T.accent }}>{krw(order.rewardKrw)}</span>
          </div>
        </div>
      )}
    </>
  );
}

// ─── QR 섹션 ─────────────────────────────────────────────────────────────────
function QRSection({ host }: { host: Host }) {
  const qrUrl = `${window.location.origin}/?host=${host.id}`;
  const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}&color=1a1a1a&bgcolor=ffffff`;

  return (
    <div style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:8, padding:'20px 24px' }}>
      <div style={{ fontSize:13, fontWeight:500, marginBottom:2 }}>게스트 주문 QR</div>
      <div style={{ fontSize:12, color:T.text3, marginBottom:16 }}>숙소에 비치해주세요. 스캔 시 주소가 자동 등록됩니다.</div>

      <div style={{ display:'flex', gap:20, alignItems:'flex-start', flexWrap:'wrap' }}>
        {/* QR 이미지 */}
        <div style={{ border:`1px solid ${T.border}`, borderRadius:6, padding:10, background:T.bg2, flexShrink:0 }}>
          <img src={qrImg} alt="K-SHOP QR" width={120} height={120} style={{ display:'block' }} />
        </div>

        {/* 정보 + 버튼 */}
        <div style={{ flex:1, minWidth:160 }}>
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:10, color:T.text3, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:4 }}>주문 URL</div>
            <div style={{ fontSize:11, color:T.text2, background:T.bg3, borderRadius:5, padding:'6px 8px', wordBreak:'break-all', fontFamily:'monospace' }}>
              {qrUrl}
            </div>
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            <button
              onClick={() => downloadQR(host.id, host.name)}
              style={{ padding:'6px 12px', borderRadius:6, border:`1px solid ${T.border2}`, background:T.bg, color:T.text, fontSize:12, fontFamily:'inherit', fontWeight:500, cursor:'pointer' }}
            >
              QR 다운로드
            </button>
            <button
              onClick={() => { navigator.clipboard.writeText(qrUrl); alert('링크가 복사됐습니다'); }}
              style={{ padding:'6px 12px', borderRadius:6, border:`1px solid ${T.border}`, background:'transparent', color:T.text2, fontSize:12, fontFamily:'inherit', cursor:'pointer' }}
            >
              링크 복사
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 정산 섹션 ────────────────────────────────────────────────────────────────
function SettleSection({ host }: { host: Host }) {
  return (
    <div style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:8, padding:'20px 24px' }}>
      <div style={{ fontSize:13, fontWeight:500, marginBottom:16 }}>리워드 현황</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:1, background:T.border, border:`1px solid ${T.border}`, borderRadius:6, overflow:'hidden', marginBottom:16 }}>
        {[
          { label:'누적 리워드',  value: krw(host.totalRewardKrw),   },
          { label:'정산 예정',    value: krw(host.pendingRewardKrw),  accent: true },
          { label:'지급 완료',    value: krw(host.settledRewardKrw),  },
          { label:'총 주문 건수', value: `${host.totalOrders}건`,     },
        ].map(s => (
          <div key={s.label} style={{ background:T.bg, padding:'12px 14px' }}>
            <div style={{ fontSize:11, color:T.text3, marginBottom:4 }}>{s.label}</div>
            <div style={{ fontSize:16, fontWeight:600, color: s.accent ? T.accent : T.text }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize:12, color:T.text3, lineHeight:1.6 }}>
        • 매월 10일에 전월 주문 기준으로 리워드를 정산합니다.<br />
        • 리워드 = 주문금액 × {pct(host.rewardRate)}<br />
        • 정산 시 세금계산서 또는 현금영수증 발급이 필요합니다.
      </div>
    </div>
  );
}

// ─── Main Host Portal ─────────────────────────────────────────────────────────
export default function HostPortal() {
  const [user, setUser]       = useState<User | null | undefined>(undefined);
  const [host, setHost]       = useState<Host | null>(null);
  const [orders, setOrders]   = useState<Order[]>([]);
  const [tab, setTab]         = useState<'orders'|'qr'|'settle'>('orders');
  const [loading, setLoading] = useState(true);

  // Auth 감시
  useEffect(() => {
    return onAuthStateChanged(auth, u => setUser(u));
  }, []);

  // 호스트 데이터 로드 (로그인 후)
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => {
      // hosts 컬렉션에서 uid 일치하는 문서 조회
      // Firebase Auth UID == Firestore host 문서 ID 로 설계
      const snap = await getDoc(doc(db, 'hosts', user.uid));
      if (!snap.exists()) { setLoading(false); return; }
      setHost({ id: snap.id, ...snap.data() } as Host);
      setLoading(false);
    })();
  }, [user]);

  // 주문 실시간 구독 (해당 호스트 주문만)
  useEffect(() => {
    if (!host) return;
    const q = query(
      collection(db, 'orders'),
      where('hostId', '==', host.id),
      orderBy('createdAt', 'desc'),
      limit(50),
    );
    return onSnapshot(q, snap => {
      setOrders(snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: (d.data().createdAt as Timestamp)?.toDate() ?? new Date(),
        updatedAt: (d.data().updatedAt as Timestamp)?.toDate() ?? new Date(),
        paidAt:    (d.data().paidAt    as Timestamp)?.toDate() ?? new Date(),
      })) as Order[]);
    });
  }, [host]);

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (user === undefined || loading) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:T.bg2, fontFamily:"'Geist',system-ui,sans-serif", fontSize:13, color:T.text3 }}>
      Loading...
    </div>
  );

  // ── 로그인 안 됨 ─────────────────────────────────────────────────────────────
  if (!user) return <HostLoginPage onLogin={() => {}} />;

  // ── 호스트 없음 ──────────────────────────────────────────────────────────────
  if (!host) return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:T.bg2, fontFamily:"'Geist',system-ui,sans-serif", gap:10 }}>
      <div style={{ fontSize:13, color:T.text }}>호스트 계정을 찾을 수 없습니다</div>
      <div style={{ fontSize:12, color:T.text3 }}>K-SHOP 팀에 문의해주세요</div>
      <button onClick={() => signOut(auth)} style={{ marginTop:8, padding:'6px 14px', borderRadius:6, border:`1px solid ${T.border}`, background:T.bg, color:T.text2, fontSize:12, fontFamily:'inherit', cursor:'pointer' }}>
        로그아웃
      </button>
    </div>
  );

  // ─── 통계 계산 ───────────────────────────────────────────────────────────────
  const thisMonth = new Date().getMonth();
  const monthOrders  = orders.filter(o => new Date(o.createdAt).getMonth() === thisMonth);
  const monthRevenue = monthOrders.reduce((s, o) => s + o.totalKrw, 0);
  const monthReward  = monthOrders.reduce((s, o) => s + o.rewardKrw, 0);
  const pendingCount = orders.filter(o => o.status === 'new' || o.status === 'processing').length;

  // ─── 렌더 ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:T.bg2, fontFamily:"'Geist',system-ui,sans-serif", color:T.text }}>

      {/* 헤더 */}
      <div style={{ background:T.bg, borderBottom:`1px solid ${T.border}`, padding:'0 20px', height:48, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:13, fontWeight:600 }}>K-SHOP</span>
          <span style={{ fontSize:12, color:T.text3 }}>호스트 포털</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:12, color:T.text2 }}>{host.name}</span>
          <button
            onClick={() => signOut(auth)}
            style={{ padding:'5px 10px', borderRadius:5, border:`1px solid ${T.border}`, background:'transparent', color:T.text2, fontSize:12, fontFamily:'inherit', cursor:'pointer' }}
          >
            로그아웃
          </button>
        </div>
      </div>

      <div style={{ maxWidth:720, margin:'0 auto', padding:'20px 16px' }}>

        {/* 상단 통계 */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:10, marginBottom:20 }}>
          <StatCard label="이번 달 주문" value={`${monthOrders.length}건`} sub={`총 ${krw(monthRevenue)}`} />
          <StatCard label="이번 달 리워드" value={krw(monthReward)} accent />
          <StatCard label="처리 중" value={`${pendingCount}건`} sub="배달 완료 대기" />
          <StatCard label="총 누적 리워드" value={krw(host.totalRewardKrw)} />
        </div>

        {/* 탭 */}
        <div style={{ display:'flex', gap:2, marginBottom:16, borderBottom:`1px solid ${T.border}`, paddingBottom:0 }}>
          {([['orders','주문 내역'], ['qr','QR 코드'], ['settle','리워드·정산']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                padding:'8px 14px', background:'transparent', border:'none',
                borderBottom: tab===key ? `2px solid ${T.text}` : '2px solid transparent',
                color: tab===key ? T.text : T.text2,
                fontSize:13, fontWeight: tab===key ? 500 : 400,
                fontFamily:'inherit', cursor:'pointer', marginBottom:-1,
              }}
            >{label}</button>
          ))}
        </div>

        {/* 주문 내역 탭 */}
        {tab === 'orders' && (
          <div style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:8, overflow:'hidden' }}>
            {/* 테이블 헤더 */}
            <div style={{ display:'grid', gridTemplateColumns:'88px 1fr 90px 80px 72px', padding:'9px 16px', borderBottom:`1px solid ${T.border}`, background:T.bg2 }}>
              {['주문번호','고객·상품','금액','상태','시간'].map(h => (
                <div key={h} style={{ fontSize:11, color:T.text3, fontWeight:500, letterSpacing:'0.03em' }}>{h}</div>
              ))}
            </div>
            {orders.length === 0 ? (
              <div style={{ padding:'40px 20px', textAlign:'center', fontSize:13, color:T.text3 }}>
                아직 주문이 없습니다
              </div>
            ) : (
              orders.map(o => <OrderRow key={o.id} order={o} />)
            )}
          </div>
        )}

        {/* QR 탭 */}
        {tab === 'qr' && <QRSection host={host} />}

        {/* 정산 탭 */}
        {tab === 'settle' && <SettleSection host={host} />}
      </div>
    </div>
  );
}
