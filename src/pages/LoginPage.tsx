import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';

const T = {
  bg: '#ffffff', bg2: '#f7f7f5', border: '#e8e8e4', border2: '#d4d4ce',
  text: '#1a1a1a', text2: '#6b6b6b', text3: '#b0b0a8', danger: '#cc3300',
};

export default function LoginPage() {
  const [email, setEmail]   = useState('');
  const [pw, setPw]         = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pw);
    } catch {
      setError('이메일 또는 비밀번호가 올바르지 않습니다');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:T.bg2, fontFamily:"'Geist',system-ui,sans-serif" }}>
      <div style={{ width:320, background:T.bg, border:`1px solid ${T.border}`, borderRadius:10, padding:32 }}>
        <div style={{ fontSize:16, fontWeight:600, marginBottom:4 }}>K-SHOP</div>
        <div style={{ fontSize:12, color:T.text3, marginBottom:24 }}>관리자 로그인</div>

        <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <div style={{ fontSize:12, color:T.text2, marginBottom:5 }}>이메일</div>
            <input
              type="email" value={email} onChange={e=>setEmail(e.target.value)} required
              style={{ width:'100%', padding:'8px 10px', borderRadius:6, border:`1px solid ${T.border}`, fontSize:13, fontFamily:'inherit', outline:'none', color:T.text, background:T.bg, boxSizing:'border-box' }}
            />
          </div>
          <div>
            <div style={{ fontSize:12, color:T.text2, marginBottom:5 }}>비밀번호</div>
            <input
              type="password" value={pw} onChange={e=>setPw(e.target.value)} required
              style={{ width:'100%', padding:'8px 10px', borderRadius:6, border:`1px solid ${T.border}`, fontSize:13, fontFamily:'inherit', outline:'none', color:T.text, background:T.bg, boxSizing:'border-box' }}
            />
          </div>

          {error && <div style={{ fontSize:12, color:T.danger }}>{error}</div>}

          <button
            type="submit" disabled={loading}
            style={{ marginTop:4, padding:'9px', borderRadius:7, background: loading ? T.bg2 : T.text, color: loading ? T.text3 : T.bg, border:'none', fontSize:13, fontWeight:600, fontFamily:'inherit', cursor: loading ? 'default' : 'pointer' }}
          >
            {loading ? '...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}
