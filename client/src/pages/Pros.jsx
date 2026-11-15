import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { TRADES } from '../trades.js';
import { ProCard, Loading, Notice } from '../components/Bits.jsx';

export default function Pros() {
  const [params, setParams] = useSearchParams();
  const trade = params.get('trade') || '';
  const q = params.get('q') || '';
  const [text, setText] = useState(q);
  const [pros, setPros] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setText(q);
  }, [q]);

  // Wait until the person pauses typing before searching.
  useEffect(() => {
    const t = setTimeout(() => {
      if (text !== q) update({ q: text });
    }, 350);
    return () => clearTimeout(t);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    setPros(null);
    setError('');
    const qs = new URLSearchParams();
    if (trade) qs.set('trade', trade);
    if (q) qs.set('q', q);
    api.get(`/pros?${qs}`)
      .then((d) => !cancelled && setPros(d.pros))
      .catch((e) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, [trade, q]);

  function update(next) {
    const merged = { trade, q, ...next };
    const p = new URLSearchParams();
    Object.entries(merged).forEach(([k, v]) => v && p.set(k, v));
    setParams(p, { replace: true });
  }

  return (
    <div className="wrap page">
      <div className="page-head">
        <h1>Find a trusted pro nearby</h1>
        <p>Browse professionals by trade, or search by name, area or skill.</p>
      </div>

      <div className="row" style={{ marginBottom: 24 }}>
        <input className="input" style={{ flex: 1, minWidth: 220 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Search by name, area or skill" aria-label="Search" />
        <select className="input" style={{ width: 190 }} value={trade} onChange={(e) => update({ trade: e.target.value })} aria-label="Trade">
          <option value="">All trades</option>
          {TRADES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>

      <Notice>{error}</Notice>
      {!pros && !error && <Loading />}
      {pros && pros.length === 0 && (
        <div className="empty">
          <p>{trade || q ? 'No professionals match that search yet.' : 'No professionals have joined yet.'}</p>
          <p className="small" style={{ marginTop: 6 }}>Post your job and professionals can quote you when they join.</p>
        </div>
      )}
      {pros && pros.length > 0 && <div className="grid-cards">{pros.map((p) => <ProCard key={p.id} pro={p} />)}</div>}
    </div>
  );
}
