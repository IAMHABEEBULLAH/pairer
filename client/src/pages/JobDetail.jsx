import React, { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { api, timeAgo } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Field, Notice, Loading, StatusPill } from '../components/Bits.jsx';
import { Gallery } from '../components/Photos.jsx';
import { useAuthModal } from '../components/AuthModal.jsx';

export default function JobDetail() {
  const { openAuth } = useAuthModal();
  const { id } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const photoError = location.state?.photoError;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get(`/jobs/${id}`).then(setData).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => { setData(null); setError(''); load(); }, [load, user?.id]);

  if (error) return <div className="wrap page"><Notice>{error}</Notice><p style={{ marginTop: 16 }}><Link to="/jobs">Back to open jobs</Link></p></div>;
  if (!data) return <div className="wrap page"><Loading /></div>;

  const { job, quotes, myQuote, photos = [] } = data;
  return (
    <div className="wrap page" style={{ maxWidth: 820 }}>
      <Link to="/jobs" className="small">← Open jobs</Link>
      {photoError > 0 && <div style={{ marginTop: 12 }}><Notice>{photoError === 1 ? '1 photo could not be uploaded.' : `${photoError} photos could not be uploaded.`} Your job was posted without {photoError === 1 ? 'it' : 'them'}.</Notice></div>}
      <div className="card-outline" style={{ marginTop: 16 }}>
        <div className="row between">
          <div className="row"><span className="pill amber">{job.trade}</span><StatusPill status={job.status} /></div>
          <span className="small muted">{job.area} · {timeAgo(job.createdAt)}</span>
        </div>
        <p style={{ marginTop: 14, whiteSpace: 'pre-wrap' }}>{job.description}</p>
        {photos.length > 0 && <div style={{ marginTop: 14 }}><Gallery ids={photos} alt="Photo of the problem" /></div>}
        <p className="small muted" style={{ marginTop: 12 }}>Posted by {job.customerName} · {job.quoteCount} quote{job.quoteCount === 1 ? '' : 's'}</p>
      </div>

      {job.isOwner && (
        <p style={{ marginTop: 24 }}>
          This is your job. Review quotes and accept one from <Link to="/dashboard"><b>My jobs</b></Link>.
          {quotes?.length > 0 && <span className="muted"> ({quotes.length} waiting)</span>}
        </p>
      )}

      {!user && job.status === 'open' && (
        <p style={{ marginTop: 24 }}>
          Are you a {job.trade.toLowerCase()}? <button className="linklike" onClick={() => openAuth('register', { role: 'pro' })}>Create a pro account</button> or <button className="linklike" onClick={() => openAuth('login')}>log in</button> to send a quote.
        </p>
      )}

      {user?.role === 'pro' && <QuoteForm job={job} myQuote={myQuote} hasProfile={Boolean(user.profile)} onSaved={load} />}
      {user?.role === 'customer' && !job.isOwner && <p className="muted" style={{ marginTop: 24 }}>Only professionals can send quotes on this job.</p>}
    </div>
  );
}

function QuoteForm({ job, myQuote, hasProfile, onSaved }) {
  const [price, setPrice] = useState(myQuote?.priceNgn ?? '');
  const [message, setMessage] = useState(myQuote?.message ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  if (!hasProfile) {
    return <div className="notice error" style={{ marginTop: 24 }}>Create your professional profile on <Link to="/dashboard">My profile</Link> before you send quotes.</div>;
  }
  if (job.status !== 'open') {
    return (
      <div style={{ marginTop: 24 }}>
        {myQuote?.accepted && <Notice type="ok">Your quote was accepted. Find the customer's details on <Link to="/requests">Requests</Link>.</Notice>}
        {!myQuote?.accepted && <p className="muted">This job is no longer taking quotes.</p>}
      </div>
    );
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(''); setDone('');
    try {
      await api.post(`/jobs/${job.id}/quotes`, { priceNgn: price, message });
      setDone(myQuote ? 'Quote updated.' : 'Quote sent. The customer will see it on their dashboard.');
      onSaved();
    } catch (err) { setError(err.message); }
    setBusy(false);
  }

  return (
    <form className="form" onSubmit={submit} style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 26 }}>{myQuote ? 'Your quote' : 'Send a quote'}</h2>
      <Field label="Your price (₦)" hint="Total for the job, in naira.">
        <input className="input" type="number" min="0" step="1" inputMode="numeric" required value={price} onChange={(e) => setPrice(e.target.value)} />
      </Field>
      <Field label="Message (optional)">
        <textarea className="input" rows={3} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="When can you come? Anything the customer should know?" />
      </Field>
      <Notice>{error}</Notice>
      <Notice type="ok">{done}</Notice>
      <button className="btn btn-primary" disabled={busy} style={{ justifySelf: 'start' }}>{busy ? 'Sending…' : myQuote ? 'Update quote' : 'Send quote'}</button>
    </form>
  );
}

