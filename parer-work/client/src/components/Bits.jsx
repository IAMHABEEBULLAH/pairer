import React, { useId } from 'react';
import { Link } from 'react-router-dom';
import { naira, timeAgo } from '../api.js';
import Avatar from './Avatar.jsx';

export function Stars({ value = 0 }) {
  const full = Math.round(value);
  return (
    <span className="stars" aria-label={`${value} out of 5`}>
      {'★'.repeat(full)}<span className="off">{'★'.repeat(5 - full)}</span>
    </span>
  );
}

export function Field({ label, hint, children }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {React.cloneElement(children, { id, 'aria-describedby': hintId })}
      {hint && <div className="hint" id={hintId}>{hint}</div>}
    </div>
  );
}

export const Notice = ({ type = 'error', children }) =>
  children ? <div className={`notice ${type}`} role={type === 'error' ? 'alert' : 'status'}>{children}</div> : null;

export const Loading = () => (
  <div className="grid-cards" aria-busy="true">
    {[0, 1, 2].map((i) => <div key={i} className="skeleton" />)}
  </div>
);

export function ProCard({ pro }) {
  const isNew = Date.now() - new Date(pro.joinedAt).getTime() < 7 * 86400000;
  return (
    <Link to={`/pros/${pro.id}`} className="card-link">
      <div className="card lift">
        {pro.coverPhotoId && <img className="cover" src={`/api/photos/${pro.coverPhotoId}`} alt={`Work by ${pro.name}`} loading="lazy" />}
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <div className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
            <Avatar name={pro.name} avatar={pro.avatar} size={44} />
            <h3 className="row" style={{ gap: 8 }}>{pro.name}{isNew && <span className="pulse-dot" title="New this week" />}</h3>
          </div>
          <span className="pill">{pro.trade}</span>
        </div>
        <p className="small muted" style={{ marginTop: 4 }}>{pro.area}</p>
        <div className="row" style={{ marginTop: 8, gap: 8 }}>
          {pro.reviewCount > 0 ? (
            <><Stars value={pro.rating} /><span className="small muted">{pro.rating} ({pro.reviewCount})</span></>
          ) : (
            <span className="small muted">No reviews yet</span>
          )}
          {pro.jobsDone > 0 && <span className="small muted">· {pro.jobsDone} job{pro.jobsDone > 1 ? 's' : ''} done</span>}
        </div>
        {pro.bio && <p style={{ marginTop: 10, fontSize: 14 }}>{pro.bio.length > 120 ? `${pro.bio.slice(0, 120)}…` : pro.bio}</p>}
        {pro.rate && <p style={{ marginTop: 10, fontWeight: 700, fontSize: 14 }}>{pro.rate}</p>}
      </div>
    </Link>
  );
}

export function JobCard({ job }) {
  return (
    <Link to={`/jobs/${job.id}`} className="card-link">
      <div className="card-outline">
        <div className="row between">
          <span className="pill amber">{job.trade}</span>
          <span className="small muted">{job.area}</span>
        </div>
        <p style={{ marginTop: 10, fontSize: 14 }}>{job.description.length > 160 ? `${job.description.slice(0, 160)}…` : job.description}</p>
        <p className="small muted" style={{ marginTop: 8 }}>
          {timeAgo(job.createdAt)}{job.quoteCount !== undefined && ` · ${job.quoteCount} quote${job.quoteCount === 1 ? '' : 's'}`}
        </p>
      </div>
    </Link>
  );
}

export const StatusPill = ({ status }) => (
  <span className={`status ${status}`}>
    {status === 'open' ? 'Open' : status === 'in_progress' ? 'In progress' : 'Completed'}
  </span>
);

export { naira };
