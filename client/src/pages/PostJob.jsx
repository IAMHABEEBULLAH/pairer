import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { TRADES } from '../trades.js';
import { Field, Notice } from '../components/Bits.jsx';
import { PhotoPicker } from '../components/Photos.jsx';

export default function PostJob() {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [thinking, setThinking] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [form, setForm] = useState({ trade: 'Plumber', area: '', description: '' });
  const [showForm, setShowForm] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function ask() {
    setThinking(true); setError('');
    try {
      const s = await api.post('/assistant', { text });
      setSuggestion(s);
      setForm((f) => ({ ...f, trade: s.trade, description: text }));
      setShowForm(true);
    } catch (e) { setError(e.message); }
    setThinking(false);
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const { job } = await api.post('/jobs', form);
      let failed = 0;
      for (const p of photos) {
        try { await api.upload(`/photos?jobId=${job.id}`, p.blob); } catch { failed += 1; }
      }
      navigate(`/jobs/${job.id}`, { state: failed ? { photoError: failed } : undefined });
    } catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <div className="wrap page">
      <div className="page-head">
        <h1>Describe what you need</h1>
        <p>Say it in your own words. Parer suggests the right trade, then professionals nearby send you quotes.</p>
      </div>

      <div className="card-outline stack" style={{ maxWidth: 620, background: 'var(--paper-dim)' }}>
        <Field label="What's the problem?">
          <textarea className="input" rows={3} maxLength={600} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. My kitchen tap has been dripping for a week and the floor is getting wet" />
        </Field>
        <div className="row">
          <button type="button" className="btn btn-dark" onClick={ask} disabled={thinking || text.trim().length < 5}>{thinking ? 'Thinking…' : 'Ask the job assistant'}</button>
          {!showForm && <button type="button" className="link-btn" onClick={() => setShowForm(true)}>Skip and fill in manually</button>}
        </div>
        {suggestion && (
          <div className="bubble bot" style={{ maxWidth: '100%' }}>
            <b>Sounds like you need a {suggestion.trade.toLowerCase()}.</b><br />{suggestion.summary}
          </div>
        )}
      </div>

      {showForm && (
        <form className="form" onSubmit={submit} style={{ marginTop: 28 }}>
          <Field label="What kind of professional?">
            <select className="input" value={form.trade} onChange={(e) => set('trade', e.target.value)}>
              {TRADES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Your area">
            <input className="input" required value={form.area} onChange={(e) => set('area', e.target.value)} placeholder="e.g. Garki, Abuja" />
          </Field>
          <Field label="Describe the job" hint="At least 10 characters. Mention anything a pro should know before quoting.">
            <textarea className="input" required rows={4} minLength={10} maxLength={1000} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
          <Field label="Photos (optional)" hint="Up to 3. A photo helps pros quote accurately. Anyone who views the job can see them, so avoid faces and documents.">
            <PhotoPicker items={photos} setItems={setPhotos} max={3} />
          </Field>
          <Notice>{error}</Notice>
          <button className="btn btn-primary" disabled={busy} style={{ justifySelf: 'start' }}>{busy ? (photos.length ? 'Posting and uploading…' : 'Posting…') : 'Post job'}</button>
        </form>
      )}
      {!showForm && <div style={{ marginTop: 16 }}><Notice>{error}</Notice></div>}
    </div>
  );
}
