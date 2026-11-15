import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Field, Notice } from '../components/Bits.jsx';

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  if (user) return <Navigate to="/dashboard" replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await register({ ...f, role });
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
