import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { TRADES } from '../trades.js';
import { useAuth } from '../auth.jsx';
import { JobCard, Loading, Notice } from '../components/Bits.jsx';
import { useAuthModal } from '../components/AuthModal.jsx';

export default function Jobs() {
  const { openAuth } = useAuthModal();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const trade = params.get('trade') || '';
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setJobs(null);
    setError('');
    api.get(`/jobs${trade ? `?trade=${encodeURIComponent(trade)}` : ''}`)
      .then((d) => setJobs(d.jobs))
      .catch((e) => setError(e.message));
  }, [trade]);

  return (
    <div className="wrap page">
      <div className="page-head">
        <h1>Open jobs</h1>
        <p>Real requests from people nearby.{!user && <> <button className="linklike" onClick={() => openAuth('register', { role: 'pro' })}>Join as a pro</button> to send quotes.</>}</p>
      </div>
      <div className="row" style={{ marginBottom: 24 }}>
        <select className="input" style={{ width: 220 }} value={trade} onChange={(e) => setParams(e.target.value ? { trade: e.target.value } : {})} aria-label="Trade">
          <option value="">All trades</option>
          {TRADES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <Notice>{error}</Notice>
      {!jobs && !error && <Loading />}
      {jobs && jobs.length === 0 && (
        <div className="empty">
          <p>No open jobs{trade ? ` for ${trade.toLowerCase()}s` : ''} right now.</p>
          <p className="small" style={{ marginTop: 6 }}>New requests appear here as soon as customers post them.</p>
        </div>
      )}
      {jobs && jobs.length > 0 && <div className="grid-cards">{jobs.map((j) => <JobCard key={j.id} job={j} />)}</div>}
    </div>
  );
}
