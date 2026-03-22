import { useState, useEffect, useCallback } from 'react';
import type { Order } from '../lib/schema';
import { subscribeOrders, updateOrderStatus, updateInternalNote } from '../lib/firebase';

// ─── Design tokens (Design Rule 기반) ────────────────────────────────────────
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

// ─── Status 설정 ──────────────────────────────────────────────────────────────
const STATUS_CFG: Record<Order['status'], {
  label: string; dotColor: string; textColor: string;
  next: Order['status'] | null; nextLabel: string;
}> = {
  new:       { label:'신규',   dotColor:'#f59e0b', textColor:T.text,  next:'processing', nextLabel:'주문 확인' },
  processing:{ label:'처리중', dotColor:T.accent,  textColor:T.text2, next:'shipped',    nextLabel:'배송 시작' },
  shipped:   { label:'배송중', dotColor:T.text3,   textColor:T.text2, next:'done',       nextLabel:'배달 완료' },
  done:      { label:'완료',   dotColor:T.border2, textColor:T.text3, next:null,         nextLabel:'' },
  cancelled: { label:'취소됨', dotColor:T.danger,  textColor:T.text3, next:null,         nextLabel:'' },
};

// ─── Util ─────────────────────────────────────────────────────────────────────
function formatKrw(n: number) { return '₩' + n.toLocaleString('ko-KR'); }

function timeAgo(date: Date) {
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60)   return '방금';
  if (diff < 3600) return `${Math.floor(diff/60)}분 전`;
  if (diff < 86400)return `${Math.floor(diff/3600)}시간 전`;
  return `${Math.floor(diff/86400)}일 전`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusDot({ status }: { status: Order['status'] }) {
  const cfg = STATUS_CFG[status];
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}>
      <span style={{ width:5, height:5, borderRadius:'50%', background:cfg.dotColor, flexShrink:0, display:'inline-block' }} />
      <span style={{ fontSize:12, color:cfg.textColor }}>{cfg.label}</span>
    </span>
  );
}

function TrackLabel({ track }: { track:'A'|'B'|'mixed' }) {
  return (
    <span style={{ fontSize:11, fontWeight:500, color: track==='A' ? T.accent : T.text2 }}>
      TRK-{track}
    </span>
  );
}

// 버튼 3종
function Btn({ variant='secondary', onClick, children, style }: {
  variant?: 'primary'|'secondary'|'ghost'|'danger';
  onClick?: () => void; children: React.ReactNode; style?: React.CSSProperties;
}) {
  const base: React.CSSProperties = {
    padding:'6px 12px', borderRadius:6, fontSize:12, fontFamily:'inherit',
    fontWeight:500, cursor:'pointer', transition:'opacity .1s', whiteSpace:'nowrap',
    ...style,
  };
  const styles: Record<string, React.CSSProperties> = {
    primary:   { background:T.text,        color:T.bg,     border:'none' },
    secondary: { background:'transparent', color:T.text,   border:`1px solid ${T.border2}` },
    ghost:     { background:'transparent', color:T.text2,  border:'none' },
    danger:    { background:'transparent', color:T.danger, border:`1px solid #eac8c2` },
  };
  return <button style={{...base,...styles[variant]}} onClick={onClick}>{children}</button>;
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────
function DetailPanel({ order, onClose, onAdvance }: {
  order: Order; onClose: () => void; onAdvance: (o: Order) => void;
}) {
  const [note, setNote] = useState(order.internalNote ?? '');
  const cfg = STATUS_CFG[order.status];

  async function saveNote() {
    await updateInternalNote(order.id, note);
  }

  return (
    <div style={{ width:264, height:'100%', overflowY:'auto', padding:16, background:T.bg, borderLeft:`1px solid ${T.border}` }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, paddingBottom:12, borderBottom:`1px solid ${T.border}` }}>
        <span style={{ fontSize:13, fontWeight:600 }}>{order.id}</span>
        <button onClick={onClose} style={{ background:'none', border:'none', color:T.text3, fontSize:16, cursor:'pointer', padding:'2px 4px', borderRadius:4 }}>×</button>
      </div>

      {/* 고객 */}
      <Section title="고객">
        <KV k="이름"   v={order.guestName} />
        <KV k="연락처" v={order.guestPhone} mono />
        <KV k="체크인" v={`${order.checkinDate} ~ ${order.checkoutDate}`} />
      </Section>

      {/* 배송지 */}
      <Section title="배송지">
        <div style={{ fontSize:12, color:T.text, background:T.bg2, borderRadius:6, padding:'8px 10px', lineHeight:1.5 }}>
          {order.hostAddress}
        </div>
      </Section>

      {/* 주문 상품 */}
      <Section title="주문 상품">
        {order.items.map((item, i) => (
          <div key={i} style={{ padding:'8px 0', borderBottom:`1px solid ${T.border}` }}>
            <div style={{ fontSize:12, color:T.text }}>{item.nameKo}</div>
            <div style={{ fontSize:11, color:T.text3, marginTop:2, display:'flex', justifyContent:'space-between' }}>
              <span>수량 {item.quantity}개 · TRK-{item.track}</span>
              <span>{formatKrw(item.unitPriceKrw * item.quantity)}</span>
            </div>
          </div>
        ))}
        <div style={{ display:'flex', justifyContent:'space-between', paddingTop:10, marginTop:2, borderTop:`1px solid ${T.border}` }}>
          <span style={{ fontSize:12, color:T.text3 }}>합계</span>
          <span style={{ fontSize:13, fontWeight:600, color:T.text }}>{formatKrw(order.totalKrw)}</span>
        </div>
      </Section>

      {/* 고객 메모 */}
      {order.note && (
        <Section title="고객 메모">
          <div style={{ fontSize:12, color:T.text, background:'#fffbf0', borderRadius:6, padding:'8px 10px', borderLeft:'2px solid #f59e0b', lineHeight:1.5 }}>
            {order.note}
          </div>
        </Section>
      )}

      {/* 내부 메모 */}
      <Section title="내부 메모 (KJ 전용)">
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          onBlur={saveNote}
          placeholder="처리 중 특이사항 기록..."
          style={{ width:'100%', minHeight:64, padding:'8px 10px', fontSize:12, fontFamily:'inherit', color:T.text, background:T.bg2, border:`1px solid ${T.border}`, borderRadius:6, resize:'vertical', outline:'none' }}
        />
      </Section>

      {/* 액션 */}
      <Section title="액션">
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {cfg.next && (
            <Btn variant="primary" onClick={() => onAdvance(order)} style={{ width:'100%', textAlign:'center', padding:7 }}>
              {cfg.nextLabel}
            </Btn>
          )}
          {order.trackSummary !== 'A' && (
            <Btn variant="secondary" onClick={() => alert('쿠팡 / 올리브영 대행 주문을 시작합니다')} style={{ width:'100%', textAlign:'center', padding:7 }}>
              구매 대행 열기
            </Btn>
          )}
          <Btn variant="secondary" onClick={() => alert(`SMS → ${order.guestPhone}\n주문이 처리되고 있습니다. K-SHOP`)} style={{ width:'100%', textAlign:'center', padding:7 }}>
            고객 SMS 발송
          </Btn>
          <Btn variant="danger" onClick={() => { if(confirm('취소 및 환불할까요?')) alert('취소·환불 처리됩니다') }} style={{ width:'100%', textAlign:'center', padding:7 }}>
            취소 · 환불
          </Btn>
        </div>
      </Section>

    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ fontSize:10, color:T.text3, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:8 }}>{title}</div>
      {children}
    </div>
  );
}

function KV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:5, gap:8 }}>
      <span style={{ fontSize:12, color:T.text3, flexShrink:0 }}>{k}</span>
      <span style={{ fontSize:12, color:T.text, textAlign:'right', fontFamily: mono ? 'monospace' : 'inherit' }}>{v}</span>
    </div>
  );
}

// ─── Main Admin Dashboard ─────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [orders, setOrders]     = useState<Order[]>([]);
  const [selected, setSelected] = useState<Order | null>(null);
  const [fStatus, setFStatus]   = useState<string>('all');
  const [fTrack, setFTrack]     = useState<string>('all');
  const [fQuery, setFQuery]     = useState('');
  const [page, setPage]         = useState<'orders'|'products'|'hosts'|'qr'|'settle'>('orders');
  const [clock, setClock]       = useState('');

  // Firebase 실시간 구독
  useEffect(() => {
    const unsub = subscribeOrders(setOrders);
    return () => unsub();
  }, []);

  // 시계
  useEffect(() => {
    const t = setInterval(() => {
      const n = new Date();
      setClock(`${n.getFullYear()}.${String(n.getMonth()+1).padStart(2,'0')}.${String(n.getDate()).padStart(2,'0')}  ${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}:${String(n.getSeconds()).padStart(2,'0')}`);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // 필터링
  const filtered = orders.filter(o => {
    if (fStatus !== 'all' && o.status !== fStatus) return false;
    if (fTrack  !== 'all' && o.trackSummary !== fTrack)   return false;
    if (fQuery) {
      const q = fQuery.toLowerCase();
      if (!o.id.toLowerCase().includes(q) && !o.guestName.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // 통계
  const newCount  = orders.filter(o => o.status === 'new').length;
  const todayRev  = orders.filter(o => o.status !== 'new').reduce((s,o) => s + Math.round(o.totalKrw * .22), 0);
  const monthCnt  = orders.length + 27;

  // 상태 진행
  async function advance(order: Order) {
    const next = STATUS_CFG[order.status].next;
    if (!next) return;
    await updateOrderStatus(order.id, next);
    // 실시간 구독으로 자동 업데이트되므로 setOrders 불필요
    if (selected?.id === order.id) {
      setSelected({ ...order, status: next });
    }
  }

  const NAV_PAGES = [
    { key:'orders',   label:'주문 관리' },
    { key:'products', label:'상품' },
    { key:'hosts',    label:'호스트' },
    { key:'qr',       label:'QR 발급' },
    { key:'settle',   label:'정산' },
  ] as const;

  return (
    <div style={{ display:'flex', height:'100vh', fontFamily:"'Geist', system-ui, sans-serif", fontSize:13, color:T.text, background:T.bg2 }}>

      {/* ── Sidebar ── */}
      <aside style={{ width:192, flexShrink:0, background:T.bg, borderRight:`1px solid ${T.border}`, display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'20px 18px 16px', borderBottom:`1px solid ${T.border}` }}>
          <div style={{ fontSize:14, fontWeight:600, letterSpacing:'-0.01em' }}>K-SHOP</div>
          <div style={{ fontSize:11, color:T.text3, marginTop:1 }}>관리자</div>
        </div>

        <nav style={{ flex:1, padding:'8px 10px', display:'flex', flexDirection:'column', gap:1 }}>
          {NAV_PAGES.map(({ key, label }) => (
            <div
              key={key}
              onClick={() => setPage(key)}
              style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'7px 10px', borderRadius:6, cursor:'pointer',
                color: page===key ? T.text : T.text2,
                background: page===key ? T.bg2 : 'transparent',
                fontWeight: page===key ? 500 : 400,
              }}
            >
              <span>{label}</span>
              {key==='orders' && newCount > 0 && (
                <span style={{ fontSize:11, color:T.accent }}>{newCount}</span>
              )}
            </div>
          ))}
        </nav>

        <div style={{ padding:'12px 18px 16px', borderTop:`1px solid ${T.border}` }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'#22c55e', flexShrink:0, display:'inline-block' }} />
            <span style={{ fontSize:11, color:T.text3 }}>운영 중</span>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Topbar */}
        <div style={{ height:48, padding:'0 20px', borderBottom:`1px solid ${T.border}`, background:T.bg, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <span style={{ fontSize:13, fontWeight:500 }}>
            {{ orders:'주문 관리', products:'상품', hosts:'호스트', qr:'QR 발급', settle:'정산' }[page]}
          </span>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:11, color:T.text3, marginRight:8 }}>{clock}</span>
            <Btn variant="secondary">새로고침</Btn>
            <Btn variant="primary">테스트 주문</Btn>
          </div>
        </div>

        <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
          <main style={{ flex:1, overflowY:'auto', padding:20, display:'flex', flexDirection:'column', gap:16 }}>

            {page !== 'orders' ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:10, color:T.text3 }}>
                <div style={{ fontSize:13 }}>{{ products:'상품', hosts:'호스트', qr:'QR 발급', settle:'정산' }[page]} 화면</div>
                <div style={{ fontSize:12 }}>다음 단계에서 구현 예정</div>
                <Btn variant="secondary" onClick={() => setPage('orders')} style={{ marginTop:8 }}>← 주문 관리로</Btn>
              </div>
            ) : (
              <>
                {/* Stats */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:1, background:T.border, border:`1px solid ${T.border}`, borderRadius:8, overflow:'hidden' }}>
                  {[
                    { label:'오늘 주문',  val:String(orders.length), accent:false },
                    { label:'처리 대기',  val:String(newCount),      accent:true  },
                    { label:'오늘 수익',  val:formatKrw(todayRev),   accent:false },
                    { label:'이번 달',    val:String(monthCnt),      accent:false },
                  ].map(s => (
                    <div key={s.label} style={{ background:T.bg, padding:'16px 18px' }}>
                      <div style={{ fontSize:11, color:T.text3, marginBottom:6 }}>{s.label}</div>
                      <div style={{ fontSize:22, fontWeight:600, color: s.accent ? T.accent : T.text, lineHeight:1 }}>{s.val}</div>
                    </div>
                  ))}
                </div>

                {/* Filters */}
                <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'wrap' }}>
                  {(['all','new','processing','shipped','done'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setFStatus(s)}
                      style={{
                        padding:'4px 10px', borderRadius:5, fontFamily:'inherit', fontSize:12, cursor:'pointer',
                        border: fStatus===s ? `1px solid ${T.border2}` : '1px solid transparent',
                        background: fStatus===s ? T.bg : 'transparent',
                        color: fStatus===s ? T.text : T.text2,
                        fontWeight: fStatus===s ? 500 : 400,
                      }}
                    >
                      {s==='all'?'전체':STATUS_CFG[s]?.label ?? s}
                    </button>
                  ))}
                  <div style={{ width:1, height:14, background:T.border, margin:'0 4px' }} />
                  {(['A','B'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setFTrack(v => v===t ? 'all' : t)}
                      style={{
                        padding:'4px 10px', borderRadius:5, fontFamily:'inherit', fontSize:12, cursor:'pointer',
                        border: fTrack===t ? `1px solid ${T.border2}` : '1px solid transparent',
                        background: fTrack===t ? T.bg : 'transparent',
                        color: fTrack===t ? T.text : T.text2,
                        fontWeight: fTrack===t ? 500 : 400,
                      }}
                    >
                      Track {t}
                    </button>
                  ))}
                  <input
                    value={fQuery}
                    onChange={e => setFQuery(e.target.value)}
                    placeholder="이름 · 주문번호 검색"
                    style={{ marginLeft:'auto', padding:'5px 10px', borderRadius:6, border:`1px solid ${T.border}`, background:T.bg, fontSize:12, fontFamily:'inherit', color:T.text, outline:'none', width:150 }}
                  />
                </div>

                {/* Table */}
                <div style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:8, overflow:'hidden' }}>
                  {/* Head */}
                  <div style={{ display:'grid', gridTemplateColumns:'88px 1fr 90px 72px 80px 76px 96px', padding:'9px 16px', borderBottom:`1px solid ${T.border}`, background:T.bg2 }}>
                    {['주문번호','고객 · 숙소','금액','트랙','상태','시간',''].map((h,i) => (
                      <div key={i} style={{ fontSize:11, color:T.text3, fontWeight:500, letterSpacing:'0.03em' }}>{h}</div>
                    ))}
                  </div>

                  {/* Rows */}
                  {filtered.length === 0 ? (
                    <div style={{ padding:'40px 20px', textAlign:'center', color:T.text3, fontSize:13 }}>
                      조건에 맞는 주문이 없습니다
                    </div>
                  ) : filtered.map(o => {
                    const cfg = STATUS_CFG[o.status];
                    return (
                      <div
                        key={o.id}
                        onClick={() => setSelected(selected?.id===o.id ? null : o)}
                        style={{
                          display:'grid', gridTemplateColumns:'88px 1fr 90px 72px 80px 76px 96px',
                          padding:'11px 16px', borderBottom:`1px solid ${T.border}`,
                          cursor:'pointer', alignItems:'center',
                          background: selected?.id===o.id ? '#f0f6ff' : T.bg,
                        }}
                      >
                        <div style={{ fontSize:11, color:T.text3, fontFamily:'monospace' }}>{o.id}</div>
                        <div style={{ paddingRight:6 }}>
                          <div style={{ fontSize:12, color:T.text, fontWeight:500 }}>{o.guestName}</div>
                          <div style={{ fontSize:11, color:T.text3 }}>{o.hostName}</div>
                        </div>
                        <div style={{ fontSize:12, color:T.text }}>{formatKrw(o.totalKrw)}</div>
                        <div><TrackLabel track={o.trackSummary} /></div>
                        <div><StatusDot status={o.status} /></div>
                        <div style={{ fontSize:11, color:T.text3 }}>{timeAgo(o.createdAt)}</div>
                        <div>
                          {cfg.next ? (
                            <button
                              onClick={e => { e.stopPropagation(); advance(o); }}
                              style={{ padding:'4px 9px', borderRadius:5, border:`1px solid ${T.border}`, background:'transparent', color:T.text2, fontSize:11, fontFamily:'inherit', cursor:'pointer' }}
                            >
                              {cfg.nextLabel}
                            </button>
                          ) : (
                            <span style={{ fontSize:11, color:T.text3 }}>완료</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </main>

          {/* Detail Panel */}
          {selected && (
            <DetailPanel
              order={selected}
              onClose={() => setSelected(null)}
              onAdvance={advance}
            />
          )}
        </div>
      </div>
    </div>
  );
}
