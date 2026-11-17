import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { Field, Notice } from '../components/Bits.jsx';

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
