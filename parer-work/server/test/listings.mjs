// Explore listings API test. Run against a running server:  BASE_URL=http://localhost:3000 node test/listings.mjs
import assert from 'node:assert/strict';
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const run = Math.random().toString(36).slice(2, 8);
let passed = 0;
const ok = (n) => { console.log(`  ok  ${n}`); passed++; };

function client() {
  let cookie = '';
  const call = async (method, p, body, raw) => {
    const headers = { ...(cookie ? { cookie } : {}) };
    if (body && !raw) headers['content-type'] = 'application/json';
    if (raw) headers['content-type'] = 'image/jpeg';
    const res = await fetch(BASE + p, { method, headers, body: raw ? body : body ? JSON.stringify(body) : undefined });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const ct = res.headers.get('content-type') || '';
    return { status: res.status, data: ct.includes('json') ? await res.json() : null };
  };
  return call;
}
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40, 1)]);
const house = { category: 'house', deal: 'rent', title: `Flat in Barnawa ${run}`, price_ngn: 900000, area: 'Barnawa, Kaduna', description: 'Two bedroom flat, water and light.', phone: '08012345678', details: { property_type: 'flat', bedrooms: 2, bathrooms: 2 } };
const car = { category: 'car', deal: 'sale', title: `Toyota Camry ${run}`, price_ngn: 5500000, area: 'Wuse, Abuja', description: 'Clean tokunbo Camry, first body.', phone: '+234 801 234 5678', details: { make: 'Toyota', model: 'Camry', year: 2012, condition: 'used', transmission: 'automatic' } };
const land = { category: 'land', deal: 'sale', title: `Plot ${run}`, price_ngn: 3000000, area: 'Kaduna South', description: 'Fenced plot with C of O.', phone: '08099998888', details: { size_sqm: 600, documents: 'C of O' } };

const anon = client(), a = client(), b = client(), pro = client();
await a('POST', '/api/auth/register', { name: 'Lister A', email: `la-${run}@test.dev`, password: 'secret123', role: 'customer' });
await b('POST', '/api/auth/register', { name: 'Viewer B', email: `lb-${run}@test.dev`, password: 'secret123', role: 'customer' });

let r = await anon('POST', '/api/listings', house); assert.equal(r.status, 401); ok('posting needs login');
r = await a('POST', '/api/listings', { ...house, phone: 'abc' }); assert.equal(r.status, 400); ok('bad phone rejected');
r = await a('POST', '/api/listings', { ...car, details: { ...car.details, year: 1800 } }); assert.equal(r.status, 400); ok('bad car year rejected');
r = await a('POST', '/api/listings', { ...house, details: { property_type: 'flat' } }); assert.equal(r.status, 400); ok('missing house details rejected');
r = await a('POST', '/api/listings', { ...house, price_ngn: 0 }); assert.equal(r.status, 400); ok('zero price rejected');

r = await a('POST', '/api/listings', house); assert.equal(r.status, 201); const hid = r.data.id;
r = await a('POST', '/api/listings', car); assert.equal(r.status, 201); const cid = r.data.id;
r = await a('POST', '/api/listings', land); assert.equal(r.status, 201); const lid = r.data.id; ok('house, car and land created');

r = await a('POST', `/api/photos?listingId=${hid}`, jpeg, true); assert.equal(r.status, 201); const pid = r.data.id;
r = await b('POST', `/api/photos?listingId=${hid}`, jpeg, true); assert.equal(r.status, 404); ok('only the owner can add photos');
r = await anon('GET', `/api/photos/${pid}`); assert.equal(r.status, 200); ok('listing photo is public');

r = await anon('GET', `/api/listings/${hid}`);
assert.equal(r.status, 200); assert.equal(r.data.listing.phone, null); assert.deepEqual(r.data.listing.photos, [pid]); assert.equal(r.data.listing.price_ngn, 900000);
assert.ok(!('owner_id' in r.data.listing)); ok('anonymous visitors do not get the phone number');
r = await b('GET', `/api/listings/${hid}`); assert.equal(r.data.listing.phone, '08012345678'); assert.equal(r.data.listing.isOwner, false); ok('signed-in visitors get the phone number');
r = await a('GET', `/api/listings/${hid}`); assert.equal(r.data.listing.isOwner, true); ok('owner is recognised');

const ids = (x) => x.data.listings.map((l) => l.id);
r = await anon('GET', '/api/listings?category=car'); assert.ok(ids(r).includes(cid) && !ids(r).includes(hid)); ok('category filter');
r = await anon('GET', '/api/listings?deal=sale'); assert.ok(ids(r).includes(cid) && ids(r).includes(lid) && !ids(r).includes(hid)); ok('deal filter');
r = await anon('GET', `/api/listings?q=${run}&minPrice=1000000&maxPrice=4000000`); assert.deepEqual(ids(r), [lid]); ok('search and price range');
r = await anon('GET', '/api/listings?q=%25'); assert.equal(r.status, 200); ok('percent sign is searched literally');
r = await anon('GET', '/api/listings'); const h = r.data.listings.find((l) => l.id === hid); assert.equal(h.coverPhotoId, pid); ok('cards carry the cover photo');

r = await b('PATCH', `/api/listings/${hid}`, { status: 'closed' }); assert.equal(r.status, 404); ok('others cannot close a listing');
r = await b('DELETE', `/api/listings/${hid}`); assert.equal(r.status, 404); ok('others cannot delete a listing');
r = await a('PATCH', `/api/listings/${hid}`, { status: 'closed' }); assert.equal(r.status, 200);
r = await anon('GET', `/api/listings/${hid}`); assert.equal(r.status, 404);
r = await a('GET', `/api/listings/${hid}`); assert.equal(r.status, 200);
r = await anon('GET', '/api/listings'); assert.ok(!ids(r).includes(hid));
r = await a('GET', '/api/listings/mine'); assert.ok(ids(r).includes(hid)); ok('closed listings are hidden from everyone but the owner');

// listing photos must never show up in a pro's work gallery
r = await pro('POST', '/api/auth/register', { name: 'Gallery Pro', email: `gp-${run}@test.dev`, password: 'secret123', role: 'pro', phone: '08011112222' });
const proId = r.data.user.id;
r = await pro('PUT', '/api/pros/me', { trade: 'Plumber', area: 'Kaduna', bio: 'Pipes and taps for ten years.', rate: '', phone: '08011112222' }); assert.equal(r.status, 200);
r = await pro('POST', '/api/listings', { ...land, title: `Pro plot ${run}` }); const plid = r.data.id;
r = await pro('POST', `/api/photos?listingId=${plid}`, jpeg, true); assert.equal(r.status, 201);
r = await anon('GET', `/api/pros/${proId}`); assert.deepEqual(r.data.photos, []); ok('listing photos stay out of pro galleries');
r = await pro('POST', '/api/photos', jpeg, true); assert.equal(r.status, 201);
r = await anon('GET', `/api/pros/${proId}`); assert.equal(r.data.photos.length, 1); ok('real gallery photos still work');

r = await a('DELETE', `/api/listings/${cid}`); assert.equal(r.status, 200);
r = await anon('GET', `/api/listings/${cid}`); assert.equal(r.status, 404); ok('owner can delete');
console.log(`\n${passed} checks passed.`);
