// End-to-end smoke test of the API. Start the server first, then:
//   BASE_URL=http://localhost:3000 node test/smoke.mjs
// Creates throwaway accounts with random emails, so it is safe to re-run.
import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const run = Math.random().toString(36).slice(2, 8);

function client() {
  let cookie = '';
  return async (method, path, body) => {
    const res = await fetch(BASE + path, {
      method,
      headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  };
}

const guest = client();
const customer = client();
const pro = client();
const other = client();
let passed = 0;
const ok = (name) => console.log(`  ok  ${name}`) || passed++;

// --- auth ---
let r = await guest('GET', '/api/auth/me');
assert.equal(r.status, 401); ok('me requires login');

r = await pro('POST', '/api/auth/register', { name: 'Test Pro', email: `pro-${run}@test.dev`, password: 'secret123', role: 'pro' });
assert.equal(r.status, 400); ok('pro must give a phone number');

r = await pro('POST', '/api/auth/register', { name: 'Test Pro', email: `pro-${run}@test.dev`, password: 'secret123', role: 'pro', phone: '08011112222' });
assert.equal(r.status, 201); ok('pro registers');

r = await customer('POST', '/api/auth/register', { name: 'Test Customer', email: `cust-${run}@test.dev`, password: 'secret123', role: 'customer' });
assert.equal(r.status, 201); ok('customer registers');

r = await other('POST', '/api/auth/register', { name: 'Other Customer', email: `cust2-${run}@test.dev`, password: 'secret123', role: 'customer' });
assert.equal(r.status, 201); ok('second customer registers');

r = await guest('POST', '/api/auth/register', { name: 'Dup', email: `cust-${run}@test.dev`, password: 'secret123', role: 'customer' });
assert.equal(r.status, 409); ok('duplicate email rejected');

r = await guest('POST', '/api/auth/login', { email: `cust-${run}@test.dev`, password: 'wrongpass' });
assert.equal(r.status, 401); ok('wrong password rejected');

// --- pro profile ---
r = await pro('POST', '/api/jobs/1/quotes', { priceNgn: 1000 });
assert.equal(r.status, 400); ok('pro needs a profile before quoting');

r = await customer('PUT', '/api/pros/me', { trade: 'Plumber', area: 'Garki', phone: '08011112222' });
assert.equal(r.status, 403); ok('customer cannot create a pro profile');

r = await pro('PUT', '/api/pros/me', { trade: 'Plumber', area: 'Garki, Abuja', bio: 'Leaks and taps.', rate: '₦5,000', phone: '08011112222' });
assert.equal(r.status, 200); ok('pro saves profile');

r = await pro('GET', '/api/auth/me');
const proId = r.data.user.id;
assert.equal(r.data.user.profile.trade, 'Plumber'); ok('me returns profile');

r = await guest('GET', '/api/pros?trade=Plumber');
let found = r.data.pros.find((p) => p.id === proId);
assert.ok(found); assert.equal(found.phone, null); ok('pro listed; phone hidden from guests');

r = await customer('GET', '/api/pros?q=garki');
found = r.data.pros.find((p) => p.id === proId);
assert.ok(found); assert.equal(found.phone, '08011112222'); ok('search works; phone visible when logged in');

r = await guest('GET', '/api/pros?q=%25');
assert.equal(r.status, 200); ok('wildcard characters handled safely');

// --- jobs ---
r = await guest('POST', '/api/jobs', { trade: 'Plumber', area: 'Garki', description: 'Kitchen tap is leaking badly' });
assert.equal(r.status, 401); ok('guest cannot post a job');

r = await pro('POST', '/api/jobs', { trade: 'Plumber', area: 'Garki', description: 'Kitchen tap is leaking badly' });
assert.equal(r.status, 403); ok('pro cannot post a job');

r = await customer('POST', '/api/jobs', { trade: 'Plumber', area: 'Garki', description: 'short' });
assert.equal(r.status, 400); ok('short description rejected');

r = await customer('POST', '/api/jobs', { trade: 'Plumber', area: 'Garki, Abuja', description: 'Kitchen tap is leaking badly' });
assert.equal(r.status, 201);
const jobId = r.data.job.id; ok('customer posts job');

r = await guest('GET', '/api/jobs?trade=Plumber');
assert.ok(r.data.jobs.some((j) => j.id === jobId)); ok('job on public board');

// --- quotes ---
r = await pro('POST', `/api/jobs/${jobId}/quotes`, { priceNgn: 8000, message: 'Can come today.' });
assert.equal(r.status, 201); ok('pro quotes');

r = await pro('POST', `/api/jobs/${jobId}/quotes`, { priceNgn: 7500, message: 'Updated price.' });
assert.equal(r.status, 201); ok('pro updates quote');

r = await customer('GET', `/api/jobs/${jobId}`);
assert.equal(r.data.quotes.length, 1);
assert.equal(r.data.quotes[0].priceNgn, 7500);
assert.equal(r.data.quotes[0].phone, null);
const quoteId = r.data.quotes[0].id; ok('owner sees quote; phone hidden until accepted');

r = await other('GET', `/api/jobs/${jobId}`);
assert.equal(r.data.quotes, undefined); ok('other customers cannot see quotes');

r = await other('POST', `/api/jobs/${jobId}/accept`, { quoteId });
assert.equal(r.status, 409); ok('only the owner can accept');

r = await customer('POST', `/api/jobs/${jobId}/accept`, { quoteId });
assert.equal(r.status, 200); ok('owner accepts quote');

r = await customer('POST', `/api/jobs/${jobId}/accept`, { quoteId });
assert.equal(r.status, 409); ok('cannot accept twice');

r = await customer('GET', `/api/jobs/${jobId}`);
assert.equal(r.data.quotes[0].phone, '08011112222'); ok('pro phone revealed after accept');

r = await pro('GET', '/api/jobs/mine');
assert.equal(r.data.quotes[0].accepted, true);
assert.equal(r.data.quotes[0].customerName, 'Test Customer');
ok('pro sees accepted quote with customer name');

// --- complete + review ---
r = await customer('POST', `/api/jobs/${jobId}/review`, { rating: 5, comment: 'Great' });
assert.equal(r.status, 409); ok('cannot review before completion');

r = await customer('POST', `/api/jobs/${jobId}/complete`);
assert.equal(r.status, 200); ok('owner completes job');

r = await customer('POST', `/api/jobs/${jobId}/review`, { rating: 6 });
assert.equal(r.status, 400); ok('rating out of range rejected');

r = await customer('POST', `/api/jobs/${jobId}/review`, { rating: 5, comment: 'Fixed it fast.' });
assert.equal(r.status, 201); ok('customer reviews');

r = await customer('POST', `/api/jobs/${jobId}/review`, { rating: 4 });
assert.equal(r.status, 409); ok('only one review per job');

r = await guest('GET', `/api/pros/${proId}`);
assert.equal(r.data.pro.rating, 5);
assert.equal(r.data.pro.reviewCount, 1);
assert.equal(r.data.pro.jobsDone, 1);
assert.equal(r.data.reviews[0].customerName, 'Test'); ok('profile shows rating, jobs done, review (first name only)');

// --- assistant + misc ---
r = await guest('POST', '/api/assistant', { text: 'my kitchen tap keeps dripping' });
assert.equal(r.data.trade, 'Plumber'); ok('assistant suggests a trade');

r = await guest('GET', '/api/nope');
assert.equal(r.status, 404); ok('unknown api route is 404 json');

r = await guest('GET', '/api/jobs/abc');
assert.equal(r.status, 404); ok('bad id is 404');

r = await customer('POST', '/api/auth/logout');
r = await customer('GET', '/api/auth/me');
assert.equal(r.status, 401); ok('logout clears session');

console.log(`\n${passed} checks passed.`);
