import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { Field, Notice } from '../components/Bits.jsx';
import { AvatarPicker } from '../components/Avatar.jsx';

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (user) return <Navigate to={from} replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <div className="wrap page">
      <div className="page-head"><h1>Welcome back</h1><p>Log in to manage your jobs and quotes.</p></div>
      <form className="form" onSubmit={submit}>
        <Field label="Email"><input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password"><input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Notice>{error}</Notice>
        <button className="btn btn-primary" disabled={busy} style={{ justifySelf: 'start' }}>{busy ? 'Logging in…' : 'Log in'}</button>
        <p className="small muted"><Link to="/forgot-password">Forgot your password?</Link></p>
        <p className="small muted">New to Parer? <Link to="/register">Create an account</Link></p>
      </form>
    </div>
  );
}

export function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [role, setRole] = useState(params.get('role') === 'pro' ? 'pro' : 'customer');
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '' });
  const [avatar, setAvatar] = useState('initials');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  if (user) return <Navigate to="/dashboard" replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await register({ ...f, role, avatar });
      navigate(role === 'pro' ? '/dashboard' : '/post-job', { replace: true });
    } catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <div className="wrap page">
      <div className="page-head"><h1>Join Parer</h1><p>Free to join. Choose how you will use it.</p></div>
      <div className="tabs" role="tablist" aria-label="Account type">
        <button type="button" role="tab" aria-selected={role === 'customer'} className={`btn btn-sm ${role === 'customer' ? 'btn-dark' : 'btn-ghost'}`} onClick={() => setRole('customer')}>I need a pro</button>
        <button type="button" role="tab" aria-selected={role === 'pro'} className={`btn btn-sm ${role === 'pro' ? 'btn-dark' : 'btn-ghost'}`} onClick={() => setRole('pro')}>I'm a pro</button>
      </div>
      <form className="form" onSubmit={submit}>
        <Field label="Full name"><input className="input" autoComplete="name" required minLength={2} value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Email"><input className="input" type="email" autoComplete="email" required value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
        <AvatarPicker value={avatar} onChange={setAvatar} name={f.name} />
        <Field label={role === 'pro' ? 'Phone number' : 'Phone number (optional)'} hint={role === 'pro' ? 'Customers use this to reach you.' : 'Only shared with the pro whose quote you accept.'}>
          <input className="input" type="tel" autoComplete="tel" required={role === 'pro'} value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="08012345678" />
        </Field>
        <Field label="Password" hint="At least 8 characters."><input className="input" type="password" autoComplete="new-password" required minLength={8} value={f.password} onChange={(e) => set('password', e.target.value)} /></Field>
        <Notice>{error}</Notice>
        <button className="btn btn-primary" disabled={busy} style={{ justifySelf: 'start' }}>{busy ? 'Creating account…' : 'Create account'}</button>
        <p className="small muted">Already have an account? <Link to="/login">Log in</Link></p>
      </form>
    </div>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api.post('/auth/forgot', { email });
      setSent(true);
    } catch (err) { setError(err.message); }
    setBusy(false);
  }

  if (sent) {
    return (
      <div className="wrap page">
        <div className="page-head"><h1>Check your email</h1>
          <p>If an account exists for {email}, we have sent a link to choose a new password. It expires in an hour. Check your spam folder if you do not see it.</p>
        </div>
        <Link className="btn btn-ghost" to="/login">Back to log in</Link>
      </div>
    );
  }

  return (
    <div className="wrap page">
      <div className="page-head"><h1>Reset your password</h1><p>Enter your email and we will send you a link to choose a new one.</p></div>
      <form className="form" onSubmit={submit}>
        <Field label="Email"><input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Notice>{error}</Notice>
        <button className="btn btn-primary" disabled={busy} style={{ justifySelf: 'start' }}>{busy ? 'Sending…' : 'Send reset link'}</button>
        <p className="small muted"><Link to="/login">Back to log in</Link></p>
      </form>
    </div>
  );
}

export function ResetPassword() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!token) {
    return (
      <div className="wrap page">
        <div className="page-head"><h1>Link not valid</h1><p>This reset link is incomplete. Request a new one.</p></div>
        <Link className="btn btn-primary" to="/forgot-password">Request a new link</Link>
      </div>
    );
  }

  async function submit(e) {
    e.preventDefault();
    if (password !== confirm) { setError('The two passwords do not match.'); return; }
    setBusy(true); setError('');
    try {
      await api.post('/auth/reset', { token, password });
      await refresh();
      navigate('/dashboard', { replace: true });
    } catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <div className="wrap page">
      <div className="page-head"><h1>Choose a new password</h1><p>You will be signed in once it is saved. Other devices will be signed out.</p></div>
      <form className="form" onSubmit={submit}>
        <Field label="New password" hint="At least 8 characters."><input className="input" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Field label="Confirm new password"><input className="input" type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
        <Notice>{error}</Notice>
        <button className="btn btn-primary" disabled={busy} style={{ justifySelf: 'start' }}>{busy ? 'Saving…' : 'Save new password'}</button>
        {error.includes('expired') && <p className="small muted"><Link to="/forgot-password">Request a new link</Link></p>}
      </form>
    </div>
  );
}
