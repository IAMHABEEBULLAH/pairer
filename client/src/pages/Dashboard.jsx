import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, naira, timeAgo } from '../api.js';
import { useAuth } from '../auth.jsx';
import { TRADES } from '../trades.js';
import { Field, Notice, Loading, StatusPill, Stars } from '../components/Bits.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  return user.role === 'pro' ? <ProDashboard /> : <CustomerDashboard />;
}

/* ---------------- customer ---------------- */
function CustomerDashboard() {
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => api.get('/jobs/mine').then((d) => setJobs(d.jobs)).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="wrap page">
      <div className="page-head row between">
        <div><h1>My jobs</h1><p>Compare quotes, pick a pro, and review the work.</p></div>
        <Link to="/post-job" className="btn btn-primary">Post a job</Link>
      </div>
      <Notice>{error}</Notice>
      {!jobs && !error && <Loading />}
      {jobs && jobs.length === 0 && <div className="empty"><p>You have not posted a job yet.</p><p style={{ marginTop: 12 }}><Link className="btn btn-dark" to="/post-job">Describe what you need</Link></p></div>}
      <div className="stack">{jobs?.map((j) => <CustomerJob key={j.id} job={j} reload={load} />)}</div>
    </div>
  );
}

function CustomerJob({ job, reload }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function act(fn) {
    setBusy(true); setError('');
    try { await fn(); await reload(); } catch (e) { setError(e.message); }
    setBusy(false);
  }

  const accepted = job.quotes.find((q) => q.accepted);

  return (
    <div className="card-outline">
      <div className="row between">
        <div className="row"><span className="pill amber">{job.trade}</span><StatusPill status={job.status} /></div>
        <span className="small muted">{job.area} · {timeAgo(job.createdAt)}</span>
      </div>
      <p style={{ marginTop: 10 }}><Link to={`/jobs/${job.id}`}>{job.description.length > 140 ? `${job.description.slice(0, 140)}…` : job.description}</Link></p>
      <Notice>{error}</Notice>

      {job.status === 'open' && job.quotes.length === 0 && <p className="small muted" style={{ marginTop: 12 }}>No quotes yet. Pros nearby can see your job and will send prices.</p>}

      {job.status === 'open' && job.quotes.map((q) => (
        <div key={q.id} className="quote">
          <div className="row between">
            <div>
              <Link to={`/pros/${q.proId}`}><b>{q.proName}</b></Link>{' '}
              {q.reviewCount > 0 ? <><Stars value={q.rating} /> <span className="small muted">({q.reviewCount})</span></> : <span className="small muted">New pro</span>}
            </div>
            <b style={{ fontSize: 18 }}>{naira(q.priceNgn)}</b>
          </div>
          {q.message && <p className="small" style={{ marginTop: 6 }}>{q.message}</p>}
          <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} disabled={busy}
            onClick={() => act(() => api.post(`/jobs/${job.id}/accept`, { quoteId: q.id }))}>Accept this quote</button>
        </div>
      ))}

      {accepted && (
        <div className="quote accepted">
          <p><b>{accepted.proName}</b> · {naira(accepted.priceNgn)}</p>
          {accepted.phone && <p style={{ marginTop: 6 }}>Call: <a href={`tel:${accepted.phone}`}><b>{accepted.phone}</b></a></p>}
          {job.status === 'in_progress' && (
            <button className="btn btn-dark btn-sm" style={{ marginTop: 10 }} disabled={busy}
              onClick={() => window.confirm('Mark this job as finished?') && act(() => api.post(`/jobs/${job.id}/complete`))}>Mark job complete</button>
          )}
        </div>
      )}

      {job.status === 'completed' && !job.reviewed && <ReviewForm jobId={job.id} reload={reload} />}
      {job.status === 'completed' && job.reviewed && <p className="small muted" style={{ marginTop: 12 }}>Thanks, your review is live.</p>}
    </div>
  );
}

function ReviewForm({ jobId, reload }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try { await api.post(`/jobs/${jobId}/review`, { rating, comment }); await reload(); }
    catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <form className="quote" onSubmit={submit}>
      <b>How did it go?</b>
      <div className="row" style={{ margin: '8px 0' }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" aria-label={`${n} star${n > 1 ? 's' : ''}`} aria-pressed={rating === n}
            className={`btn btn-sm ${rating === n ? 'btn-dark' : 'btn-ghost'}`} onClick={() => setRating(n)}>{n} ★</button>
        ))}
      </div>
      <textarea className="input" rows={2} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="On time? Clean work? Fair price?" />
      <Notice>{error}</Notice>
      <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} disabled={busy}>{busy ? 'Saving…' : 'Leave review'}</button>
    </form>
  );
}

/* ---------------- professional ---------------- */
function ProDashboard() {
  const { user, refresh } = useAuth();
  const [quotes, setQuotes] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get('/jobs/mine').then((d) => setQuotes(d.quotes)).catch((e) => setError(e.message)); }, []);

  return (
    <div className="wrap page">
      <div className="page-head">
        <h1>My work</h1>
        <p>{user.profile ? 'Keep your profile sharp and quote on jobs near you.' : 'Create your profile first, so customers can find you and trust your quotes.'}</p>
      </div>

      <ProfileForm user={user} onSaved={refresh} />

      <h2 style={{ fontSize: 26, margin: '40px 0 12px' }}>My quotes</h2>
      <Notice>{error}</Notice>
      {!quotes && !error && <Loading />}
      {quotes && quotes.length === 0 && (
        <div className="empty"><p>You have not sent any quotes yet.</p><p style={{ marginTop: 12 }}><Link className="btn btn-dark" to="/jobs">Browse open jobs</Link></p></div>
      )}
      <div className="stack">
        {quotes?.map((q) => (
          <div key={q.quoteId} className={`card-outline ${q.accepted ? 'quote accepted' : ''}`}>
            <div className="row between">
              <div className="row"><span className="pill amber">{q.job.trade}</span>{q.accepted ? <span className="pill lime">Accepted</span> : <StatusPill status={q.job.status} />}</div>
              <b>{naira(q.priceNgn)}</b>
            </div>
            <p style={{ marginTop: 8 }}><Link to={`/jobs/${q.job.id}`}>{q.job.description.length > 140 ? `${q.job.description.slice(0, 140)}…` : q.job.description}</Link></p>
            <p className="small muted" style={{ marginTop: 6 }}>{q.job.area} · job posted {timeAgo(q.job.createdAt)}</p>
            {q.accepted && (
              <p style={{ marginTop: 10 }}>
                Customer: <b>{q.customerName}</b>{q.customerPhone ? <> · <a href={`tel:${q.customerPhone}`}>{q.customerPhone}</a></> : <span className="muted"> (no phone shared, use the job page to follow up)</span>}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfileForm({ user, onSaved }) {
  const p = user.profile;
  const [f, setF] = useState({ trade: p?.trade || 'Plumber', area: p?.area || '', bio: p?.bio || '', rate: p?.rate || '', phone: user.phone || '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(''); setSaved(false);
    try { await api.put('/pros/me', f); await onSaved(); setSaved(true); }
    catch (err) { setError(err.message); }
    setBusy(false);
  }

  return (
    <form className="form" onSubmit={submit}>
      <h2 style={{ fontSize: 26 }}>{p ? 'Your profile' : 'Create your profile'}</h2>
      <Field label="Trade"><select className="input" value={f.trade} onChange={(e) => set('trade', e.target.value)}>{TRADES.map((t) => <option key={t}>{t}</option>)}</select></Field>
      <Field label="Area or neighbourhood"><input className="input" required value={f.area} onChange={(e) => set('area', e.target.value)} placeholder="e.g. Wuse 2, Abuja" /></Field>
      <Field label="About you" hint="What you do and how long you have done it."><textarea className="input" rows={3} maxLength={500} value={f.bio} onChange={(e) => set('bio', e.target.value)} /></Field>
      <Field label="Rate (optional)"><input className="input" value={f.rate} onChange={(e) => set('rate', e.target.value)} placeholder="e.g. From ₦5,000 per visit" /></Field>
      <Field label="Phone number"><input className="input" type="tel" required value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
      <Notice>{error}</Notice>
      <Notice type="ok">{saved && 'Profile saved. You now show up in searches.'}</Notice>
      <button className="btn btn-primary" disabled={busy} style={{ justifySelf: 'start' }}>{busy ? 'Saving…' : p ? 'Save changes' : 'Create profile'}</button>
    </form>
  );
}
