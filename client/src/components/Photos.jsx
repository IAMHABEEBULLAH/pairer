import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { compressImage } from '../lib/image.js';
import { Notice } from './Bits.jsx';

export const photoUrl = (id) => `/api/photos/${id}`;

/* Read-only grid. Tap a photo to see it full size. */
export function Gallery({ ids, alt }) {
  const [open, setOpen] = useState(null);

  useEffect(() => {
    if (open === null) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(null);
      if (e.key === 'ArrowRight') setOpen((i) => (i + 1) % ids.length);
      if (e.key === 'ArrowLeft') setOpen((i) => (i - 1 + ids.length) % ids.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, ids.length]);

  return (
    <>
      <div className="photo-grid">
        {ids.map((id, i) => (
          <button key={id} type="button" className="thumb" onClick={() => setOpen(i)} aria-label={`View photo ${i + 1} of ${ids.length}`}>
            <img src={photoUrl(id)} alt={alt} loading="lazy" />
          </button>
        ))}
      </div>
      {open !== null && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Photo viewer" onClick={() => setOpen(null)}>
          <img src={photoUrl(ids[open])} alt={alt} onClick={(e) => e.stopPropagation()} />
          <button type="button" className="btn btn-primary btn-sm lightbox-close" onClick={() => setOpen(null)} autoFocus>Close</button>
          {ids.length > 1 && <p className="lightbox-count small">{open + 1} of {ids.length}</p>}
        </div>
      )}
    </>
  );
}

/* Chooses photos before a job exists. The parent uploads them after the job is saved. */
export function PhotoPicker({ id, items, setItems, max = 3 }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Free the preview URLs when the form goes away.
  useEffect(() => () => itemsRef.current.forEach((it) => URL.revokeObjectURL(it.url)), []);

  async function onPick(e) {
    const files = Array.from(e.target.files || []).slice(0, max - items.length);
    e.target.value = '';
    if (!files.length) return;
    setError('');
    setBusy(true);
    const added = [];
    for (const file of files) {
      try {
        const blob = await compressImage(file);
        added.push({ blob, url: URL.createObjectURL(blob) });
      } catch (err) {
        setError(err.message);
      }
    }
    setItems((cur) => [...cur, ...added].slice(0, max));
    setBusy(false);
  }

  function remove(i) {
    URL.revokeObjectURL(items[i].url);
    setItems((cur) => cur.filter((_, n) => n !== i));
  }

  return (
    <div>
      {items.length < max && (
        <input id={id} ref={inputRef} className="input" type="file" accept="image/*" multiple disabled={busy} onChange={onPick} />
      )}
      {busy && <p className="small muted" style={{ marginTop: 6 }}>Preparing photos…</p>}
      <Notice>{error}</Notice>
      {items.length > 0 && (
        <div className="photo-grid" style={{ marginTop: 10 }}>
          {items.map((it, i) => (
            <div key={it.url} className="thumb">
              <img src={it.url} alt={`Selected photo ${i + 1}`} />
              <button type="button" className="thumb-x" onClick={() => remove(i)} aria-label={`Remove photo ${i + 1}`}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* A professional's work gallery: uploads happen straight away. */
export function PhotoManager({ proId, max = 8 }) {
  const [ids, setIds] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get(`/pros/${proId}`).then((d) => setIds(d.photos)).catch((e) => setError(e.message));
  }, [proId]);
  useEffect(() => { load(); }, [load]);

  async function onPick(e) {
    const files = Array.from(e.target.files || []).slice(0, max - (ids?.length || 0));
    e.target.value = '';
    if (!files.length) return;
    setError('');
    setBusy(true);
    for (const file of files) {
      try {
        const blob = await compressImage(file);
        await api.upload('/photos', blob);
      } catch (err) {
        setError(err.message);
        break;
      }
    }
    await load();
    setBusy(false);
  }

  async function remove(id) {
    if (!window.confirm('Delete this photo?')) return;
    setError('');
    try {
      await api.del(`/photos/${id}`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const count = ids?.length ?? 0;
  return (
    <section style={{ marginTop: 40 }} aria-labelledby="gallery-title">
      <h2 id="gallery-title" style={{ fontSize: 26 }}>Your work photos</h2>
      <p className="muted" style={{ margin: '6px 0 14px', maxWidth: '56ch' }}>
        Show finished jobs. Profiles with photos get chosen more often. The first photo is the one shown in search results.
      </p>

      {count < max ? (
        <div style={{ maxWidth: 520 }}>
          <label htmlFor="gallery-input" className="small" style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>
            Add photos ({count} of {max})
          </label>
          <input id="gallery-input" className="input" type="file" accept="image/*" multiple disabled={busy} onChange={onPick} />
        </div>
      ) : (
        <p className="small muted">Your gallery is full ({max} photos). Delete one to add another.</p>
      )}
      {busy && <p className="small muted" style={{ marginTop: 6 }}>Uploading…</p>}
      <div style={{ marginTop: 10 }}><Notice>{error}</Notice></div>

      {ids && ids.length > 0 && (
        <div className="photo-grid" style={{ marginTop: 14 }}>
          {ids.map((id, i) => (
            <div key={id} className="thumb">
              <img src={photoUrl(id)} alt={`Your work photo ${i + 1}`} loading="lazy" />
              <button type="button" className="thumb-x" onClick={() => remove(id)} aria-label={`Delete photo ${i + 1}`}>✕</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
