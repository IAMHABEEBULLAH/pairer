import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { Field, Notice } from './Bits.jsx';
import { AvatarPicker } from './Avatar.jsx';

const AuthModalContext = createContext(null);
export const useAuthModal = () => useContext(AuthModalContext);

export function AuthModalProvider({ children }) {
  const [state, setState] = useState(null); // null = closed, otherwise { mode, role }
  const openAuth = useCallback((mode = 'login', opts = {}) => setState({ mode, role: opts.role === 'pro' ? 'pro' : 'customer' }), []);
  const closeAuth = useCallback(() => setState(null), []);
  return (
    <AuthModalContext.Provider value={{ openAuth, closeAuth }}>
      {children}
      {state && <AuthModal initial={state} onClose={closeAuth} />}
    </AuthModalContext.Provider>
  );
}

let googleScript;
function loadGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve();
  googleScript ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = resolve;
    s.onerror = () => { googleScript = null; reject(new Error('Could not load Google.')); };
    document.head.appendChild(s);
  });
  return googleScript;
}

function GoogleButton({ clientId, mode, onCredential }) {
  const box = useRef(null);
  const cb = useRef(onCredential);
  cb.current = onCredential;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let dead = false;
    loadGoogle().then(() => {
      if (dead || !box.current) return;
      window.google.accounts.id.initialize({ client_id: clientId, callback: (r) => cb.current(r.credential), ux_mode: 'popup' });
      box.current.innerHTML = '';
      const width = Math.min(360, Math.max(200, Math.floor(box.current.getBoundingClientRect().width || 320)));
      window.google.accounts.id.renderButton(box.current, {
        theme: 'outline', size: 'large', shape: 'rectangular', width, logo_alignment: 'center',
        text: mode === 'login' ? 'signin_with' : 'signup_with',
      });
    }).catch(() => setFailed(true));
    return () => { dead = true; };
  }, [clientId, mode]);

  if (failed) return <p className="small muted">Google sign-in could not load. Use your email instead.</p>;
  return <div ref={box} className="google-box" />;
}

function AuthModal({ initial, onClose }) {
  const { user, login, register, refresh } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [mode, setMode] = useState(initial.mode);
  const [role, setRole] = useState(initial.role);
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '' });
  const [avatar, setAvatar] = useState('initials');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [googleId, setGoogleId] = useState(null);
  const dialog = useRef(null);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  // Close once signed in (covers every way of signing in).
  useEffect(() => { if (user) onClose(); }, [user, onClose]);

  useEffect(() => {
    api.get('/config').then((c) => setGoogleId(c.googleClientId)).catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus({ preventScroll: true }); // no auto-focus on a field: it would pop the phone keyboard and scroll the sheet
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  function afterSignIn(created, who) {
    if (created) navigate(who.role === 'pro' ? '/dashboard' : '/post-job', { replace: true });
    else if (pathname === '/') navigate('/dashboard', { replace: true });
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      if (mode === 'login') {
        const who = await login(f.email, f.password);
        afterSignIn(false, who);
      } else {
        const who = await register({ ...f, role, avatar });
        afterSignIn(true, who);
      }
    } catch (err) { setError(err.message); setBusy(false); }
  }

  async function onGoogle(credential) {
    if (mode === 'register' && role === 'pro' && !f.phone.trim()) {
      setError('Enter your phone number first, then use Google. Customers need it to reach you.');
      return;
    }
    setBusy(true); setError('');
    try {
      const { created, user: who } = await api.post('/auth/google', { credential, mode, role, phone: f.phone });
      await refresh();
      afterSignIn(created, who);
    } catch (err) { setError(err.message); setBusy(false); }
  }

  const isLogin = mode === 'login';
  const switchMode = (m) => { setMode(m); setError(''); };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="auth-title" ref={dialog} tabIndex={-1}>
        <button className="modal-close" type="button" aria-label="Close" onClick={onClose}>✕</button>
        <h2 id="auth-title">{isLogin ? 'Welcome back' : 'Join Parer'}</h2>
        <p className="muted small modal-sub">{isLogin ? 'Log in to manage your jobs and quotes.' : 'Free to join. Choose how you will use it.'}</p>

        <div className="tabs" role="tablist" aria-label="Log in or sign up">
          <button type="button" role="tab" aria-selected={isLogin} className={`btn btn-sm ${isLogin ? 'btn-dark' : 'btn-ghost'}`} onClick={() => switchMode('login')}>Log in</button>
          <button type="button" role="tab" aria-selected={!isLogin} className={`btn btn-sm ${!isLogin ? 'btn-dark' : 'btn-ghost'}`} onClick={() => switchMode('register')}>Sign up</button>
        </div>

        {!isLogin && (
          <div className="tabs" role="radiogroup" aria-label="Account type">
            <button type="button" role="radio" aria-checked={role === 'customer'} className={`btn btn-sm ${role === 'customer' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setRole('customer')}>I need a pro</button>
            <button type="button" role="radio" aria-checked={role === 'pro'} className={`btn btn-sm ${role === 'pro' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setRole('pro')}>I'm a pro</button>
          </div>
        )}

        {googleId && (
          <>
            {!isLogin && role === 'pro' && <Field label="Phone number (for Google sign-up)"><input className="input" type="tel" autoComplete="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="08012345678" /></Field>}
            <GoogleButton clientId={googleId} mode={mode} onCredential={onGoogle} />
            <div className="or"><span>or use email</span></div>
          </>
        )}

        <form className="form" onSubmit={submit}>
          {!isLogin && <Field label="Full name"><input className="input" autoComplete="name" required minLength={2} value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>}
          <Field label="Email"><input className="input" type="email" autoComplete="email" required value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
          {!isLogin && <AvatarPicker value={avatar} onChange={setAvatar} name={f.name} />}
          {!isLogin && (
            <Field label={role === 'pro' ? 'Phone number' : 'Phone number (optional)'} hint={role === 'pro' ? 'Customers use this to reach you.' : 'Only shared with the pro whose quote you accept.'}>
              <input className="input" type="tel" autoComplete="tel" required={role === 'pro'} value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="08012345678" />
            </Field>
          )}
          <Field label="Password" hint={isLogin ? undefined : 'At least 8 characters.'}>
            <input className="input" type="password" autoComplete={isLogin ? 'current-password' : 'new-password'} required minLength={isLogin ? undefined : 8} value={f.password} onChange={(e) => set('password', e.target.value)} />
          </Field>
          <Notice>{error}</Notice>
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Please wait…' : isLogin ? 'Log in' : 'Create account'}</button>
          {isLogin && <p className="small muted center"><Link to="/forgot-password" onClick={onClose}>Forgot your password?</Link></p>}
        </form>
      </div>
    </div>
  );
}
