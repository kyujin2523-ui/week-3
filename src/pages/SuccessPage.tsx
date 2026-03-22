import { useEffect, useState } from 'react';
import type { Lang } from '../lib/i18n';
import { t, detectLang } from '../lib/i18n';

const T = {
  bg:'#ffffff', bg2:'#f7f7f5', border:'#e8e8e4',
  text:'#1a1a1a', text2:'#6b6b6b', text3:'#b0b0a8', accent:'#0066cc',
};

const SUCCESS_MSG: Record<string, string> = {
  en:      'Your order is confirmed! We\'ll deliver to your accommodation within 1–2 days.',
  ja:      'ご注文を確認しました！1〜2日以内に宿泊先にお届けします。',
  'zh-cn': '订单已确认！我们将在1-2天内送达您的住所。',
  'zh-tw': '訂單已確認！我們將在1-2天內送達您的住所。',
};

export default function SuccessPage() {
  const params  = new URLSearchParams(window.location.search);
  const hostId  = params.get('host') ?? '';
  const [lang]  = useState<Lang>(detectLang);

  // 5초 후 주문 페이지로 자동 리다이렉트 (재주문 유도)
  const [seconds, setSeconds] = useState(8);
  useEffect(() => {
    if (seconds <= 0) {
      window.location.href = `/order?host=${hostId}`;
      return;
    }
    const t = setTimeout(() => setSeconds(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds, hostId]);

  return (
    <div style={{ minHeight:'100vh', background:T.bg2, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily:"'Geist',system-ui,sans-serif", padding:20 }}>
      <div style={{ background:T.bg, border:`1px solid ${T.border}`, borderRadius:10, padding:40, maxWidth:400, width:'100%', textAlign:'center' }}>
        {/* 체크 아이콘 — 텍스트로 */}
        <div style={{ width:48, height:48, borderRadius:'50%', background:'#f0fdf4', border:`1px solid #bbf7d0`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, margin:'0 auto 20px' }}>
          ✓
        </div>

        <div style={{ fontSize:18, fontWeight:600, color:T.text, marginBottom:8 }}>
          {lang === 'ja' ? '注文完了' : lang.startsWith('zh') ? '订单已确认' : 'Order Confirmed'}
        </div>

        <div style={{ fontSize:13, color:T.text2, lineHeight:1.6, marginBottom:24 }}>
          {SUCCESS_MSG[lang] ?? SUCCESS_MSG['en']}
        </div>

        <div style={{ fontSize:11, color:T.text3 }}>
          {lang === 'ja' ? `${seconds}秒後にページを更新...` :
           lang.startsWith('zh') ? `${seconds}秒后返回...` :
           `Returning in ${seconds}s...`}
        </div>
      </div>
    </div>
  );
}
