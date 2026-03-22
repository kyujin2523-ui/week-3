import { useState, useEffect, useMemo } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import type { Product, Host, ProductCategory } from '../lib/schema';
import { getActiveProducts, getHost } from '../lib/firebase';
import { detectLang, t } from '../lib/i18n';
import type { Lang } from '../lib/i18n';

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

// ─── Types ────────────────────────────────────────────────────────────────────
interface CartItem { product: Product; quantity: number; }

// ─── Stripe ───────────────────────────────────────────────────────────────────
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatKrw(n: number) { return '₩' + n.toLocaleString('ko-KR'); }

function getProductName(p: Product, lang: Lang): string {
  return { en: p.nameEn, ja: p.nameJa, 'zh-cn': p.nameZh, 'zh-tw': p.nameZh }[lang] ?? p.nameEn;
}

const CATEGORIES: { key: ProductCategory | 'all'; i18n: string }[] = [
  { key:'all',    i18n:'cat_all'    },
  { key:'bundle', i18n:'cat_bundle' },
  { key:'snack',  i18n:'cat_snack'  },
  { key:'ramen',  i18n:'cat_ramen'  },
  { key:'beauty', i18n:'cat_beauty' },
  { key:'health', i18n:'cat_health' },
  { key:'daily',  i18n:'cat_daily'  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

/** 상단 숙소 정보 바 */
function AccomBar({ host, lang }: { host: Host; lang: Lang }) {
  return (
    <div style={{ background:T.bg2, borderBottom:`1px solid ${T.border}`, padding:'10px 16px', display:'flex', alignItems:'center', gap:10 }}>
      <div style={{ width:6, height:6, borderRadius:'50%', background:'#22c55e', flexShrink:0 }} />
      <div>
        <div style={{ fontSize:12, fontWeight:500, color:T.text }}>{host.name}</div>
        <div style={{ fontSize:11, color:T.text3 }}>{host.address} {host.addressDetail}</div>
      </div>
      <div style={{ marginLeft:'auto', fontSize:11, color:T.text3 }}>
        {t(lang, 'delivery_note')}
      </div>
    </div>
  );
}

/** 언어 선택 */
function LangSwitch({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  const langs: { key: Lang; label: string }[] = [
    { key:'en',    label:'EN'   },
    { key:'ja',    label:'日本語' },
    { key:'zh-cn', label:'简体'  },
    { key:'zh-tw', label:'繁體'  },
  ];
  return (
    <div style={{ display:'flex', gap:2 }}>
      {langs.map(l => (
        <button
          key={l.key}
          onClick={() => onChange(l.key)}
          style={{
            padding:'4px 8px', borderRadius:4, border:'none', background:'transparent',
            fontSize:11, fontFamily:'inherit', cursor:'pointer',
            color: lang===l.key ? T.text : T.text3,
            fontWeight: lang===l.key ? 500 : 400,
          }}
        >{l.label}</button>
      ))}
    </div>
  );
}

/** 상품 카드 */
function ProductCard({ product, lang, qty, onAdd, onRemove }: {
  product: Product; lang: Lang;
  qty: number; onAdd: () => void; onRemove: () => void;
}) {
  const isLow = product.track === 'A' && product.stock !== null && product.stock <= 5;
  const name = getProductName(product, lang);

  const tagLabel: Record<string, string> = {
    hot:         t(lang, 'tag_hot'),
    new:         t(lang, 'tag_new'),
    editor_pick: t(lang, 'tag_editor'),
    viral:       t(lang, 'tag_viral'),
  };

  return (
    <div style={{
      background:T.bg, border:`1px solid ${T.border}`, borderRadius:8,
      padding:'14px', display:'flex', flexDirection:'column', gap:8,
    }}>
      {/* 상품 이미지 placeholder */}
      <div style={{
        height:80, background:T.bg3, borderRadius:6,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:11, color:T.text3,
      }}>
        {product.category === 'beauty' ? '🧴' :
         product.category === 'ramen'  ? '🍜' :
         product.category === 'snack'  ? '🍿' :
         product.category === 'bundle' ? '🎁' :
         product.category === 'health' ? '💊' : '📦'}
      </div>

      <div>
        {/* 태그 */}
        {product.tags.length > 0 && (
          <div style={{ display:'flex', gap:4, marginBottom:4, flexWrap:'wrap' }}>
            {product.tags.slice(0,1).map(tag => (
              <span key={tag} style={{ fontSize:10, color:T.text2, background:T.bg3, border:`1px solid ${T.border}`, padding:'1px 6px', borderRadius:3 }}>
                {tagLabel[tag] ?? tag}
              </span>
            ))}
            {isLow && (
              <span style={{ fontSize:10, color:T.danger, background:'#fff0ee', border:`1px solid #ffd0c8`, padding:'1px 6px', borderRadius:3 }}>
                {t(lang, 'low_stock')}
              </span>
            )}
          </div>
        )}
        <div style={{ fontSize:13, fontWeight:500, color:T.text, lineHeight:1.3 }}>{name}</div>
      </div>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:'auto' }}>
        <div>
          <div style={{ fontSize:14, fontWeight:600, color:T.text }}>{formatKrw(product.priceKrw)}</div>
          <div style={{ fontSize:10, color:T.text3, marginTop:1 }}>
            {product.track === 'A' ? t(lang, 'track_a') : t(lang, 'track_b')}
          </div>
        </div>

        {qty === 0 ? (
          <button
            onClick={onAdd}
            style={{
              padding:'6px 14px', borderRadius:6, border:`1px solid ${T.border2}`,
              background:T.bg, color:T.text, fontSize:12, fontFamily:'inherit',
              fontWeight:500, cursor:'pointer',
            }}
          >{t(lang, 'add')}</button>
        ) : (
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <button onClick={onRemove} style={{ width:26, height:26, borderRadius:5, border:`1px solid ${T.border2}`, background:T.bg, color:T.text, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
            <span style={{ fontSize:13, fontWeight:500, color:T.text, minWidth:16, textAlign:'center' }}>{qty}</span>
            <button onClick={onAdd} style={{ width:26, height:26, borderRadius:5, border:`1px solid ${T.border2}`, background:T.text, color:T.bg, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
          </div>
        )}
      </div>
    </div>
  );
}

/** 장바구니 드로어 */
function CartDrawer({ items, lang, onClose, onQtyChange, onCheckout }: {
  items: CartItem[]; lang: Lang; onClose: () => void;
  onQtyChange: (id: string, delta: number) => void;
  onCheckout: (info: GuestInfo) => void;
}) {
  const [info, setInfo] = useState<GuestInfo>({ name:'', phone:'', note:'', checkin:'', checkout:'' });
  const [loading, setLoading] = useState(false);
  const [step, setStep]       = useState<'cart'|'info'>('cart');

  const subtotal = items.reduce((s, i) => s + i.product.priceKrw * i.quantity, 0);

  async function handlePay() {
    if (!info.name || !info.phone) return;
    setLoading(true);
    await onCheckout(info);
    setLoading(false);
  }

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:100, display:'flex', justifyContent:'flex-end',
    }}>
      {/* Overlay */}
      <div onClick={onClose} style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.18)' }} />

      {/* Panel */}
      <div style={{
        position:'relative', width:340, maxWidth:'100vw', height:'100%',
        background:T.bg, borderLeft:`1px solid ${T.border}`,
        display:'flex', flexDirection:'column', overflowY:'auto',
      }}>
        {/* Header */}
        <div style={{ padding:'16px 20px', borderBottom:`1px solid ${T.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <span style={{ fontSize:14, fontWeight:600 }}>{t(lang, 'cart_title')}</span>
          <button onClick={onClose} style={{ background:'none', border:'none', color:T.text3, fontSize:18, cursor:'pointer', padding:'2px 4px' }}>×</button>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:20 }}>
          {step === 'cart' ? (
            <>
              {items.length === 0 ? (
                <div style={{ textAlign:'center', color:T.text3, fontSize:13, padding:'40px 0' }}>{t(lang, 'cart_empty')}</div>
              ) : (
                <>
                  {items.map(({ product, quantity }) => (
                    <div key={product.id} style={{ display:'flex', alignItems:'center', gap:10, paddingBottom:12, marginBottom:12, borderBottom:`1px solid ${T.border}` }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:500, color:T.text }}>{getProductName(product, lang)}</div>
                        <div style={{ fontSize:12, color:T.text2, marginTop:2 }}>{formatKrw(product.priceKrw)}</div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <button onClick={() => onQtyChange(product.id, -1)} style={{ width:24, height:24, borderRadius:4, border:`1px solid ${T.border2}`, background:T.bg, cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
                        <span style={{ fontSize:13, fontWeight:500, minWidth:16, textAlign:'center' }}>{quantity}</span>
                        <button onClick={() => onQtyChange(product.id, +1)} style={{ width:24, height:24, borderRadius:4, border:`1px solid ${T.border2}`, background:T.bg, cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                      </div>
                      <div style={{ fontSize:13, color:T.text, fontWeight:500, minWidth:56, textAlign:'right' }}>
                        {formatKrw(product.priceKrw * quantity)}
                      </div>
                    </div>
                  ))}

                  <div style={{ display:'flex', justifyContent:'space-between', paddingTop:8, marginBottom:4 }}>
                    <span style={{ fontSize:13, color:T.text2 }}>{t(lang, 'subtotal')}</span>
                    <span style={{ fontSize:15, fontWeight:600, color:T.text }}>{formatKrw(subtotal)}</span>
                  </div>
                  <div style={{ fontSize:11, color:T.text3, marginBottom:16 }}>{t(lang, 'fee_note')}</div>
                </>
              )}
            </>
          ) : (
            /* 고객 정보 입력 */
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <Field label={t(lang,'name_label')} required>
                <input value={info.name} onChange={e=>setInfo(p=>({...p,name:e.target.value}))}
                  placeholder={t(lang,'name_ph')} style={inputStyle} />
              </Field>
              <Field label={t(lang,'phone_label')} required>
                <input value={info.phone} onChange={e=>setInfo(p=>({...p,phone:e.target.value}))}
                  placeholder={t(lang,'phone_ph')} style={inputStyle} />
              </Field>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <Field label={t(lang,'checkin_label')}>
                  <input type="date" value={info.checkin} onChange={e=>setInfo(p=>({...p,checkin:e.target.value}))} style={inputStyle} />
                </Field>
                <Field label={t(lang,'checkout_label')}>
                  <input type="date" value={info.checkout} onChange={e=>setInfo(p=>({...p,checkout:e.target.value}))} style={inputStyle} />
                </Field>
              </div>
              <Field label={t(lang,'note_label')}>
                <textarea value={info.note} onChange={e=>setInfo(p=>({...p,note:e.target.value}))}
                  placeholder={t(lang,'note_ph')} rows={3}
                  style={{...inputStyle, resize:'vertical', minHeight:72}} />
              </Field>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        {items.length > 0 && (
          <div style={{ padding:'16px 20px', borderTop:`1px solid ${T.border}`, flexShrink:0 }}>
            {step === 'cart' ? (
              <button
                onClick={() => setStep('info')}
                style={{ width:'100%', padding:'11px', background:T.text, color:T.bg, border:'none', borderRadius:7, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}
              >
                {t(lang, 'checkout')} — {formatKrw(subtotal)}
              </button>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <button
                  onClick={handlePay}
                  disabled={loading || !info.name || !info.phone}
                  style={{
                    width:'100%', padding:'11px', borderRadius:7, fontSize:13, fontWeight:600, fontFamily:'inherit', cursor:'pointer', border:'none',
                    background: (!info.name || !info.phone) ? T.bg3 : T.text,
                    color: (!info.name || !info.phone) ? T.text3 : T.bg,
                  }}
                >
                  {loading ? '...' : t(lang, 'checkout')}
                </button>
                <button onClick={() => setStep('cart')} style={{ width:'100%', padding:'8px', background:'transparent', border:`1px solid ${T.border}`, borderRadius:7, fontSize:12, color:T.text2, cursor:'pointer', fontFamily:'inherit' }}>
                  ← back
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface GuestInfo { name:string; phone:string; note:string; checkin:string; checkout:string; }

const inputStyle: React.CSSProperties = {
  width:'100%', padding:'8px 10px', borderRadius:6, border:`1px solid ${T.border}`,
  background:T.bg, color:T.text, fontSize:13, fontFamily:'inherit', outline:'none',
};

function Field({ label, required, children }: { label:string; required?:boolean; children:React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize:12, color:T.text2, marginBottom:5 }}>
        {label}{required && <span style={{ color:T.danger, marginLeft:2 }}>*</span>}
      </div>
      {children}
    </div>
  );
}

// ─── Main Order Page ──────────────────────────────────────────────────────────
export default function OrderPage() {
  // URL: /order?host={hostId}
  const params   = new URLSearchParams(window.location.search);
  const hostId   = params.get('host') ?? '';

  const [lang, setLang]         = useState<Lang>(detectLang);
  const [host, setHost]         = useState<Host | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart]         = useState<Map<string, number>>(new Map());
  const [category, setCategory] = useState<ProductCategory | 'all'>('all');
  const [cartOpen, setCartOpen] = useState(false);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  // 데이터 로드
  useEffect(() => {
    (async () => {
      try {
        const [h, p] = await Promise.all([getHost(hostId), getActiveProducts()]);
        if (!h) { setError('Invalid QR code. Please scan again.'); return; }
        setHost(h);
        setProducts(p);
      } catch {
        setError('Failed to load. Please check your connection.');
      } finally {
        setLoading(false);
      }
    })();
  }, [hostId]);

  // 필터
  const filtered = useMemo(() =>
    category === 'all' ? products : products.filter(p => p.category === category),
    [products, category]
  );

  // 장바구니
  const cartItems: CartItem[] = useMemo(() =>
    Array.from(cart.entries())
      .map(([id, qty]) => ({ product: products.find(p=>p.id===id)!, quantity: qty }))
      .filter(i => i.product),
    [cart, products]
  );
  const cartCount = Array.from(cart.values()).reduce((s,v) => s+v, 0);

  function addToCart(productId: string) {
    setCart(prev => new Map(prev).set(productId, (prev.get(productId) ?? 0) + 1));
  }
  function qtyChange(productId: string, delta: number) {
    setCart(prev => {
      const next = new Map(prev);
      const n = (next.get(productId) ?? 0) + delta;
      if (n <= 0) next.delete(productId); else next.set(productId, n);
      return next;
    });
  }

  // Stripe Checkout — Firebase Function 호출 → Stripe로 리다이렉트
  async function handleCheckout(info: GuestInfo) {
    if (!host) return;
    const stripe = await stripePromise;
    if (!stripe) return;

    const items = cartItems.map(({ product, quantity }) => ({
      productId:    product.id,
      nameEn:       product.nameEn,
      nameKo:       product.nameKo,
      quantity,
      unitPriceKrw: product.priceKrw,
      track:        product.track,
    }));

    // Firebase Function URL
    // 배포 후 실제 URL로 교체: https://asia-northeast1-{projectId}.cloudfunctions.net/createCheckout
    const FUNCTION_URL = import.meta.env.VITE_FUNCTION_URL ?? 'http://localhost:5001/kshop/asia-northeast1/createCheckout';

    const origin = window.location.origin;
    const body = {
      hostId:      host.id,
      hostName:    host.name,
      hostAddress: `${host.address} ${host.addressDetail}`,
      items,
      guest: {
        name:     info.name,
        phone:    info.phone,
        note:     info.note,
        checkin:  info.checkin,
        checkout: info.checkout,
        language: lang,
        country:  navigator.language.split('-')[0].toUpperCase(),
      },
      successUrl: `${origin}/order?host=${hostId}&status=success`,
      cancelUrl:  `${origin}/order?host=${hostId}`,
    };

    try {
      const res = await fetch(FUNCTION_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Checkout failed');
      }

      const { url } = await res.json();
      // Stripe Checkout 페이지로 리다이렉트
      window.location.href = url;
    } catch (e: any) {
      console.error('Checkout error:', e);
      alert('결제를 시작할 수 없습니다. 다시 시도해주세요.\n' + e.message);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:T.bg2, fontFamily:"'Geist',system-ui,sans-serif", color:T.text3, fontSize:13 }}>
      Loading...
    </div>
  );

  if (error || !host) return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:T.bg2, fontFamily:"'Geist',system-ui,sans-serif", gap:8 }}>
      <div style={{ fontSize:13, color:T.text }}>{error || 'Host not found'}</div>
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:T.bg2, fontFamily:"'Geist',system-ui,sans-serif", color:T.text }}>

      {/* Top nav */}
      <div style={{ background:T.bg, borderBottom:`1px solid ${T.border}`, position:'sticky', top:0, zIndex:10 }}>
        <div style={{ maxWidth:640, margin:'0 auto', padding:'0 16px', height:48, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:14, fontWeight:600, letterSpacing:'-0.01em' }}>K-SHOP</span>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <LangSwitch lang={lang} onChange={setLang} />
            <button
              onClick={() => setCartOpen(true)}
              style={{ padding:'6px 12px', borderRadius:6, border:`1px solid ${T.border2}`, background:T.bg, color:T.text, fontSize:12, fontFamily:'inherit', fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}
            >
              Cart
              {cartCount > 0 && (
                <span style={{ background:T.text, color:T.bg, borderRadius:99, fontSize:10, fontWeight:600, padding:'1px 5px', lineHeight:1.4 }}>{cartCount}</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Accommodation bar */}
      <AccomBar host={host} lang={lang} />

      {/* Content */}
      <div style={{ maxWidth:640, margin:'0 auto', padding:'20px 16px' }}>

        {/* Hero */}
        <div style={{ marginBottom:20 }}>
          <h1 style={{ fontSize:20, fontWeight:600, color:T.text, marginBottom:4 }}>{t(lang, 'tagline')}</h1>
          <p style={{ fontSize:13, color:T.text2 }}>{t(lang, 'tagline_sub')}</p>
        </div>

        {/* Category filter */}
        <div style={{ display:'flex', gap:4, overflowX:'auto', paddingBottom:4, marginBottom:16, WebkitOverflowScrolling:'touch' }}>
          {CATEGORIES.map(({ key, i18n }) => (
            <button
              key={key}
              onClick={() => setCategory(key)}
              style={{
                padding:'5px 12px', borderRadius:99, border:'1px solid', whiteSpace:'nowrap',
                fontSize:12, fontFamily:'inherit', cursor:'pointer', flexShrink:0,
                borderColor: category===key ? T.border2 : T.border,
                background:  category===key ? T.bg      : 'transparent',
                color:       category===key ? T.text    : T.text2,
                fontWeight:  category===key ? 500       : 400,
              }}
            >{t(lang, i18n)}</button>
          ))}
        </div>

        {/* Product grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))', gap:10 }}>
          {filtered.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              lang={lang}
              qty={cart.get(product.id) ?? 0}
              onAdd={() => addToCart(product.id)}
              onRemove={() => qtyChange(product.id, -1)}
            />
          ))}
        </div>

        {/* Footer */}
        <div style={{ marginTop:40, paddingTop:20, borderTop:`1px solid ${T.border}`, textAlign:'center', fontSize:11, color:T.text3 }}>
          {t(lang, 'powered')} · 서비스 수수료 포함가
        </div>
      </div>

      {/* Floating cart button (mobile) */}
      {cartCount > 0 && !cartOpen && (
        <div style={{ position:'fixed', bottom:20, left:0, right:0, display:'flex', justifyContent:'center', zIndex:20 }}>
          <button
            onClick={() => setCartOpen(true)}
            style={{
              padding:'12px 28px', borderRadius:99, background:T.text, color:T.bg,
              border:'none', fontSize:13, fontWeight:600, fontFamily:'inherit', cursor:'pointer',
              boxShadow:'0 4px 16px rgba(0,0,0,0.15)',
              display:'flex', alignItems:'center', gap:10,
            }}
          >
            {t(lang,'cart_title')} · {cartCount}
            <span style={{ fontWeight:700 }}>→</span>
          </button>
        </div>
      )}

      {/* Cart drawer */}
      {cartOpen && (
        <CartDrawer
          items={cartItems}
          lang={lang}
          onClose={() => setCartOpen(false)}
          onQtyChange={qtyChange}
          onCheckout={async (info) => { await handleCheckout(info); setCartOpen(false); }}
        />
      )}
    </div>
  );
}
