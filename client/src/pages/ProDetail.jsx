import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, timeAgo } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Stars, Loading, Notice } from '../components/Bits.jsx';

export default function ProDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    setError('');
    api.get(`/pros/${id}`).then(setData).catch((e) => setError(e.message));
  }, [id, user?.id]);

  if (error) return <div className="wrap page"><Notice>{error}</Notice><p style={{ marginTop: 16 }}><Link to="/pros">Back to all professionals</Link></p></div>;
  if (!data) return <div className="wrap page"><Loading /></div>;

  const { pro, reviews } = data;
  return (
    <div className="wrap page" style={{ maxWidth: 820 }}>
      <Link to="/pros" className="small">← All professionals</Link>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <h1 style={{ fontSize: 38 }}>{pro.name}</h1>
          <span className="pill">{pro.trade}</span>
        </div>
        <p className="muted" style={{ marginTop: 6 }}>{pro.area}</p>
        <div className="row" style={{ marginTop: 10 }}>
          {pro.reviewCount > 0 ? <><Stars value={pro.rating} /><span className="small">{pro.rating} from {pro.reviewCount} review{pro.reviewCount > 1 ? 's' : ''}</span></> : <span className="small muted">No reviews yet</span>}
          <span className="small muted">· {pro.jobsDone} job{pro.jobsDone === 1 ? '' : 's'} completed on Parer</span>
        </div>
        {pro.bio && <p style={{ marginTop: 14 }}>{pro.bio}</p>}
        {pro.rate && <p style={{ marginTop: 12, fontWeight: 700 }}>{pro.rate}</p>}
        <div style={{ marginTop: 18 }}>
          {pro.phone ? (
            <a className="btn btn-dark" href={`tel:${pro.phone}`}>Call {pro.phone}</a>
          ) : (
            <p className="small muted"><Link to="/login" state={{ from: `/pros/${pro.id}` }}>Log in</Link> to see contact details, or <Link to="/post-job">post a job</Link> and let them quote you.</p>
          )}
        </div>
      </div>

      <h2 style={{ fontSize: 26, margin: '32px 0 12px' }}>Reviews</h2>
      {reviews.length === 0 && <div className="empty">Reviews appear here after a customer completes a job with {pro.name.split(' ')[0]}.</div>}
      <div className="stack">
        {reviews.map((r) => (
          <div key={r.id} className="card-outline">
            <div className="row between"><Stars value={r.rating} /><span className="small muted">{timeAgo(r.createdAt)}</span></div>
            {r.comment && <p style={{ marginTop: 8 }}>{r.comment}</p>}
            <p className="small muted" style={{ marginTop: 8 }}>{r.customerName} · {r.job.length > 70 ? `${r.job.slice(0, 70)}…` : r.job}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
