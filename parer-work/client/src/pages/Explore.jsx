import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, naira, timeAgo } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Field, Notice, Loading } from '../components/Bits.jsx';
import { PhotoPicker, photoUrl } from '../components/Photos.jsx';
import { useAuthModal } from '../components/AuthModal.jsx';
import Avatar from '../components/Avatar.jsx';

const CATS = [
  { key: 'house', label: 'Houses' },
  { key: 'car', label: 'Cars' },
  { key: 'land', label: 'Land' },
];
const catLabel = (k) => CATS.find((c) => c.key === k)?.label.replace(/s$/, '') || k;

const DEAL = {
  house: { sale: 'For sale', rent: 'For rent', per: 'per year' },
  car: { sale: 'For sale', rent: 'For hire', per: 'per day' },
  land: { sale: 'For sale', rent: 'For lease', per: 'per year' },
};
const dealLabel = (cat, deal) => DEAL[cat][deal];
const priceText = (l) => naira(l.price_ngn) + (l.deal === 'rent' ? ` ${DEAL[l.category].per}` : '');

function summary(l) {
  const d = l.details || {};
  if (l.category === 'house') return `${d.bedrooms} bed · ${d.bathrooms} bath · ${d.property_type}`;
  if (l.category === 'car') return `${d.year} · ${d.condition} · ${d.transmission}`;
  return `${Number(d.size_sqm).toLocaleString('en-NG')} sqm${d.documents ? ` · ${d.documents}` : ''}`;
}

// Nigerian numbers: 0801… becomes 234801… for WhatsApp links.
function waNumber(phone) {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('0') ? `234${digits.slice(1)}` : digits;
}

function ListingCard({ l }) {
  return (
    <Link to={`/explore/${l.id}`} className="listing-card">
      <div className="listing-img">
        {l.coverPhotoId ? <img src={photoUrl(l.coverPhotoId)} alt="" loading="lazy" /> : <span>No photo</span>}
        <span className="pill lime listing-deal">{dealLabel(l.category, l.deal)}</span>
      </div>
      <div className="listing-body">
        <div className="listing-price">{priceText(l)}</div>
        <div className="listing-title">{l.title}</div>
        <div className="small muted">{summary(l)}</div>
        <div className="small muted">{l.area} · {timeAgo(l.created_at)}</div>
      </div>
    </Link>
  );
}

export function Explore() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const category = CATS.some((c) => c.key === params.get('category')) ? params.get('category') : '';
  const deal = params.get('deal') || '';
  const q = params.get('q') || '';
  const minPrice = params.get('minPrice') || '';
  const maxPrice = params.get('maxPrice') || '';
  const [search, setSearch] = useState(q);
  const [listings, setListings] = useState(null);
  const [error, setError] = useState('');

  const setParam = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
  };

  useEffect(() => {
    const qs = new URLSearchParams();
    if (category) qs.set('category', category);
    if (deal) qs.set('deal', deal);
    if (q) qs.set('q', q);
    if (minPrice) qs.set('minPrice', minPrice);
    if (maxPrice) qs.set('maxPrice', maxPrice);
    setListings(null);
    api.get(`/listings?${qs}`).then((d) => setListings(d.listings)).catch((e) => setError(e.message));
  }, [category, deal, q, minPrice, maxPrice]);

  return (
    <div className="wrap page">
      <div className="page-head">
        <h1>Explore</h1>
        <p>Houses, cars and land from people near you. Contact the owner directly.</p>
      </div>

      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <div className="tabs" style={{ marginBottom: 0 }} role="tablist" aria-label="Category">
          <button role="tab" aria-selected={!category} className={`btn btn-sm ${!category ? 'btn-dark' : 'btn-ghost'}`} onClick={() => setParam('category', '')}>All</button>
          {CATS.map((c) => (
            <button key={c.key} role="tab" aria-selected={category === c.key} className={`btn btn-sm ${category === c.key ? 'btn-dark' : 'btn-ghost'}`} onClick={() => setParam('category', c.key)}>{c.label}</button>
          ))}
        </div>
        <div className="row">
          {user && <Link to="/explore/mine" className="btn btn-ghost btn-sm">My listings</Link>}
          <Link to={`/explore/new${category ? `?category=${category}` : ''}`} className="btn btn-primary btn-sm">Post a listing</Link>
        </div>
      </div>

      <form className="filters" onSubmit={(e) => { e.preventDefault(); setParam('q', search.trim()); }}>
        <input className="input" aria-label="Search listings" placeholder="Search area or keyword" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" aria-label="Sale or rent" value={deal} onChange={(e) => setParam('deal', e.target.value)}>
          <option value="">Buy or rent</option>
          <option value="sale">For sale</option>
          <option value="rent">Rent, hire or lease</option>
        </select>
        <input className="input" aria-label="Minimum price" inputMode="numeric" placeholder="Min ₦" value={minPrice} onChange={(e) => setParam('minPrice', e.target.value.replace(/\D/g, ''))} />
        <input className="input" aria-label="Maximum price" inputMode="numeric" placeholder="Max ₦" value={maxPrice} onChange={(e) => setParam('maxPrice', e.target.value.replace(/\D/g, ''))} />
        <button className="btn btn-dark">Search</button>
      </form>

      <Notice>{error}</Notice>
      {!listings && !error && <Loading />}
      {listings && listings.length === 0 && (
        <div className="card-outline" style={{ textAlign: 'center', padding: 36 }}>
          <h3>Nothing here yet</h3>
          <p className="muted" style={{ margin: '6px 0 16px' }}>Be the first to post one, or try a different search.</p>
          <Link to="/explore/new" className="btn btn-primary">Post a listing</Link>
        </div>
      )}
      {listings && listings.length > 0 && <div className="grid-cards">{listings.map((l) => <ListingCard key={l.id} l={l} />)}</div>}
    </div>
  );
}

// One large photo with a strip of thumbnails underneath.
function ListingGallery({ ids, alt }) {
  const [i, setI] = useState(0);
  return (
    <div>
      <div className="listing-img big"><img src={photoUrl(ids[i])} alt={`${alt}, photo ${i + 1} of ${ids.length}`} /></div>
      {ids.length > 1 && (
        <div className="photo-grid" style={{ marginTop: 10 }}>
          {ids.map((id, n) => (
            <button key={id} type="button" className="thumb" style={n === i ? { outline: '3px solid var(--green)' } : undefined} onClick={() => setI(n)} aria-label={`Show photo ${n + 1}`}>
              <img src={photoUrl(id)} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ListingDetail() {
  const { id } = useParams();
  const { openAuth } = useAuthModal();
  const { user } = useAuth();
  const [l, setL] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get(`/listings/${id}`).then((d) => setL(d.listing)).catch((e) => setError(e.message));
  }, [id]);
  // Reload when the visitor signs in so the phone number appears.
  useEffect(() => { load(); }, [load, user?.id]);

  async function setStatus(status) {
    try { await api.patch(`/listings/${id}`, { status }); load(); } catch (e) { setError(e.message); }
  }

  if (error && !l) {
    return (
      <div className="wrap page">
        <div className="page-head"><h1>Listing not found</h1><p>{error}</p></div>
        <Link to="/explore" className="btn btn-primary">Back to Explore</Link>
      </div>
    );
  }
  if (!l) return <div className="wrap page"><Loading /></div>;

  return (
    <div className="wrap page">
      <p className="small"><Link to="/explore">← Explore</Link></p>
      <div className="listing-detail">
        <div>
          {l.photos.length > 0 ? <ListingGallery ids={l.photos} alt={l.title} /> : <div className="listing-img big"><span>No photos</span></div>}
          <h2 style={{ marginTop: 24 }}>About this {catLabel(l.category).toLowerCase()}</h2>
          <p style={{ whiteSpace: 'pre-wrap', marginTop: 8, maxWidth: '65ch' }}>{l.description}</p>
        </div>

        <aside className="stack">
          <div className="card-outline">
            <div className="row" style={{ gap: 8 }}>
              <span className="pill lime">{dealLabel(l.category, l.deal)}</span>
              <span className="pill line">{catLabel(l.category)}</span>
              {l.status === 'closed' && <span className="pill amber">Closed</span>}
            </div>
            <h1 style={{ fontSize: 30, margin: '10px 0 4px' }}>{l.title}</h1>
            <div className="listing-price" style={{ fontSize: 26 }}>{priceText(l)}</div>
            <p className="muted" style={{ marginTop: 6 }}>{l.area} · posted {timeAgo(l.created_at)}</p>
            <dl className="facts">
              {Object.entries(l.details).filter(([, v]) => v !== '' && v != null).map(([k, v]) => (
                <React.Fragment key={k}><dt>{k.replace(/_/g, ' ')}</dt><dd>{k === 'size_sqm' ? Number(v).toLocaleString('en-NG') : String(v)}</dd></React.Fragment>
              ))}
            </dl>
          </div>

          <div className="card-outline">
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <Avatar name={l.ownerName} avatar={l.ownerAvatar} size={40} />
              <div><b>{l.ownerName}</b><div className="small muted">Listed this</div></div>
            </div>
            {l.phone ? (
              <div className="row" style={{ marginTop: 14 }}>
                <a className="btn btn-primary" href={`tel:${l.phone.replace(/[^\d+]/g, '')}`}>Call {l.phone}</a>
                <a className="btn btn-ghost" href={`https://wa.me/${waNumber(l.phone)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
              </div>
            ) : (
              <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => openAuth('login')}>Log in to see contact</button>
            )}
          </div>

          <div className="notice ok" style={{ fontWeight: 500 }}>
            <b>Stay safe.</b> Meet in a public place and see the {catLabel(l.category).toLowerCase()} in person before you pay. Never send a deposit to someone you have not met. Check ownership documents.
          </div>

          {l.isOwner && (
            <div className="row">
              {l.status === 'active'
                ? <button className="btn btn-dark btn-sm" onClick={() => setStatus('closed')}>Mark as {l.deal === 'sale' ? 'sold' : 'taken'}</button>
                : <button className="btn btn-dark btn-sm" onClick={() => setStatus('active')}>Reopen listing</button>}
              <Link className="btn btn-ghost btn-sm" to="/explore/mine">My listings</Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

const PROPERTY_TYPES = ['flat', 'house', 'duplex', 'room', 'shop'];

export function NewListing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [category, setCategory] = useState(CATS.some((c) => c.key === params.get('category')) ? params.get('category') : 'house');
  const [f, setF] = useState({ deal: 'sale', title: '', price_ngn: '', area: '', description: '', phone: user?.phone || '' });
  const [d, setD] = useState({ property_type: 'flat', bedrooms: '2', bathrooms: '2', make: '', model: '', year: String(new Date().getFullYear()), condition: 'used', transmission: 'automatic', size_sqm: '', documents: '' });
  const [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const setDet = (k, v) => setD((s) => ({ ...s, [k]: v }));
  const lab = DEAL[category];

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    const details =
      category === 'house' ? { property_type: d.property_type, bedrooms: d.bedrooms, bathrooms: d.bathrooms }
      : category === 'car' ? { make: d.make, model: d.model, year: d.year, condition: d.condition, transmission: d.transmission }
      : { size_sqm: d.size_sqm, documents: d.documents };
    try {
      const { id } = await api.post('/listings', { ...f, category, details });
      let failed = 0;
      for (const p of photos) {
        try { await api.upload(`/photos?listingId=${id}`, p.blob); } catch { failed += 1; }
      }
      navigate(`/explore/${id}`, { state: failed ? { photoError: failed } : undefined });
    } catch (err) { setError(err.message); setBusy(false); }
  }

  const sel = (k, opts, label) => (
    <Field label={label}>
      <select className="input" value={d[k]} onChange={(e) => setDet(k, e.target.value)}>{opts.map((o) => <option key={o}>{o}</option>)}</select>
    </Field>
  );
  const num = (k, label, extra = {}) => (
    <Field label={label}><input className="input" inputMode="numeric" required value={d[k]} onChange={(e) => setDet(k, e.target.value.replace(/\D/g, ''))} {...extra} /></Field>
  );

  return (
    <div className="wrap page">
      <div className="page-head"><h1>Post a listing</h1><p>It is free. Add clear photos and an honest description.</p></div>
      <div className="tabs" role="radiogroup" aria-label="Category">
        {CATS.map((c) => (
          <button key={c.key} type="button" role="radio" aria-checked={category === c.key} className={`btn btn-sm ${category === c.key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setCategory(c.key)}>{c.label}</button>
        ))}
      </div>
      <form className="form" onSubmit={submit}>
        <Field label="Type of deal">
          <select className="input" value={f.deal} onChange={(e) => set('deal', e.target.value)}>
            <option value="sale">{lab.sale}</option>
            <option value="rent">{lab.rent}</option>
          </select>
        </Field>
        <Field label="Title"><input className="input" required minLength={5} maxLength={100} value={f.title} onChange={(e) => set('title', e.target.value)} placeholder={category === 'house' ? '3 bedroom flat in Barnawa' : category === 'car' ? 'Toyota Camry 2012, clean' : 'Plot of land with C of O'} /></Field>

        {category === 'house' && <>{sel('property_type', PROPERTY_TYPES, 'Property type')}{num('bedrooms', 'Bedrooms')}{num('bathrooms', 'Bathrooms')}</>}
        {category === 'car' && <>
          <Field label="Make"><input className="input" required value={d.make} onChange={(e) => setDet('make', e.target.value)} placeholder="Toyota" /></Field>
          <Field label="Model"><input className="input" required value={d.model} onChange={(e) => setDet('model', e.target.value)} placeholder="Camry" /></Field>
          {num('year', 'Year')}
          {sel('condition', ['used', 'new'], 'Condition')}
          {sel('transmission', ['automatic', 'manual'], 'Transmission')}
        </>}
        {category === 'land' && <>
          {num('size_sqm', 'Size in square metres', { placeholder: '600' })}
          <Field label="Documents (optional)" hint="For example C of O, Deed of Assignment, Survey plan."><input className="input" maxLength={80} value={d.documents} onChange={(e) => setDet('documents', e.target.value)} /></Field>
        </>}

        <Field label={`Price in naira${f.deal === 'rent' ? ` (${lab.per})` : ''}`}>
          <input className="input" inputMode="numeric" required value={f.price_ngn} onChange={(e) => set('price_ngn', e.target.value.replace(/\D/g, ''))} placeholder="e.g. 2500000" />
        </Field>
        <Field label="Area"><input className="input" required value={f.area} onChange={(e) => set('area', e.target.value)} placeholder="e.g. Barnawa, Kaduna" /></Field>
        <Field label="Description" hint="At least 10 characters."><textarea className="input" required rows={5} minLength={10} maxLength={2000} value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
        <Field label="Contact phone" hint="Shown to signed-in people who open your listing."><input className="input" type="tel" required value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="08012345678" /></Field>
        <Field label="Photos (optional, up to 8)" hint="Good photos get more calls. Anyone can see them, so avoid faces and documents.">
          <PhotoPicker items={photos} setItems={setPhotos} max={8} />
        </Field>
        <Notice>{error}</Notice>
        <button className="btn btn-primary" disabled={busy} style={{ justifySelf: 'start' }}>{busy ? (photos.length ? 'Posting and uploading…' : 'Posting…') : 'Post listing'}</button>
      </form>
    </div>
  );
}

export function MyListings() {
  const [listings, setListings] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => { api.get('/listings/mine').then((d) => setListings(d.listings)).catch((e) => setError(e.message)); }, []);
  useEffect(() => { load(); }, [load]);

  async function act(fn) { setError(''); try { await fn(); await load(); } catch (e) { setError(e.message); } }

  return (
    <div className="wrap page">
      <div className="page-head"><h1>My listings</h1><p>Close a listing once it is sold or taken.</p></div>
      <div className="row" style={{ marginBottom: 16 }}><Link to="/explore/new" className="btn btn-primary btn-sm">Post a listing</Link><Link to="/explore" className="btn btn-ghost btn-sm">Browse Explore</Link></div>
      <Notice>{error}</Notice>
      {!listings && !error && <Loading />}
      {listings && listings.length === 0 && <p className="muted">You have not posted anything yet.</p>}
      <div className="stack">
        {listings?.map((l) => (
          <div key={l.id} className="card-outline row" style={{ justifyContent: 'space-between' }}>
            <div>
              <Link to={`/explore/${l.id}`}><b>{l.title}</b></Link>
              <div className="small muted">{catLabel(l.category)} · {priceText(l)} · {l.area}</div>
              <span className={`pill ${l.status === 'active' ? 'lime' : 'amber'}`}>{l.status === 'active' ? 'Active' : 'Closed'}</span>
            </div>
            <div className="row">
              <button className="btn btn-dark btn-sm" onClick={() => act(() => api.patch(`/listings/${l.id}`, { status: l.status === 'active' ? 'closed' : 'active' }))}>{l.status === 'active' ? 'Close' : 'Reopen'}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => { if (window.confirm('Delete this listing and its photos?')) act(() => api.del(`/listings/${l.id}`)); }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
