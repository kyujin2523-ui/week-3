import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './lib/firebase';
import AdminDashboard from './pages/AdminDashboard';
import OrderPage from './pages/OrderPage';
import SuccessPage from './pages/SuccessPage';
import HostPortal from './pages/HostPortal';
import LoginPage from './pages/LoginPage';

/**
 * 라우팅 규칙:
 *   /?host=xxx&status=success  → 결제 완료 페이지  (게스트)
 *   /?host=xxx                 → 고객 주문 페이지   (게스트)
 *   /host                      → 호스트 포털        (호스트 로그인)
 *   /                          → 관리자 대시보드    (KJ 로그인)
 */
export default function App() {
  const params    = new URLSearchParams(window.location.search);
  const hasHost   = params.has('host');
  const isSuccess = hasHost && params.get('status') === 'success';
  const isHostPortal = window.location.pathname === '/host';

  if (isSuccess)    return <SuccessPage />;
  if (hasHost)      return <OrderPage />;
  if (isHostPortal) return <HostPortal />;

  return <AdminRoute />;
}

function AdminRoute() {
  const [user, setUser]       = useState<any>(undefined); // undefined = loading
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    try {
      const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setChecked(true); });
      return () => unsub();
    } catch {
      // Firebase 미설정 환경 (플레이스홀더 키) — 로그인 화면 표시
      setChecked(true);
    }
  }, []);

  if (!checked) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Geist',system-ui,sans-serif", fontSize:13, color:'#b0b0a8' }}>
      Loading...
    </div>
  );

  return user ? <AdminDashboard /> : <LoginPage />;
}
