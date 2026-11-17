// Password reset test. Starts its own server and a fake email provider, so nothing real is sent.
//   DATABASE_URL=postgres://... PGSSL=false node test/reset.mjs
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import pg from 'pg';

const run = Math.random().toString(36).slice(2, 8);
const sent = [];
const googleTokens = {}; // fake Google: token -> claims
const mock = http.createServer((req, res) => {
  if (req.url.startsWith('/tokeninfo')) {
    const t = new URL(req.url, 'http://x').searchParams.get('id_token');
    const claims = googleTokens[t];
    res.writeHead(claims ? 200 : 400, { 'content-type': 'application/json' });
    return res.end(JSON.stringify(claims || { error: 'invalid_token' }));
  }
  let b = '';
  req.on('data', (c) => (b += c));
  req.on('end', () => { sent.push({ key: req.headers['api-key'], body: JSON.parse(b) }); res.writeHead(201); res.end('{}'); });
});
await new Promise((r) => mock.listen(0, r));
const port = 3100 + Math.floor(Math.random() * 800);
const BASE = `http://localhost:${port}`;

const here = path.dirname(fileURLToPath(import.meta.url));
const child = spawn('node', [path.join(here, '../src/index.js')], {
  env: { ...process.env, PORT: String(port), JWT_SECRET: 'test-secret', BREVO_API_KEY: 'test-key',
    BREVO_API_URL: `http://localhost:${mock.address().port}/send`, EMAIL_FROM: 'Parer <hello@parer.test>', APP_URL: 'https://parer.test',
    GOOGLE_CLIENT_ID: 'test-client', GOOGLE_TOKENINFO_URL: `http://localhost:${mock.address().port}/tokeninfo` },
  stdio: ['ignore', 'inherit', 'inherit'],
});
const stop = () => { child.kill(); mock.close(); };
process.on('exit', stop);

for (let i = 0; i < 50; i++) {
  try { if ((await fetch(BASE + '/api/health')).ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 200));
}

function client() {
  let cookie = '';
  return async (method, p, body) => {
    const res = await fetch(BASE + p, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, data: await res.json().catch(() => null) };
  };
}
const wait = async (n) => { for (let i = 0; i < 30 && sent.length < n; i++) await new Promise((r) => setTimeout(r, 100)); };
let passed = 0;
const ok = (n) => console.log(`  ok  ${n}`) || passed++;

const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === 'false' ? false : undefined });
const email = `reset-${run}@test.dev`;
const a = client(), b = client(), g = client();

try {
  let r = await a('POST', '/api/auth/register', { name: 'Reset Tester', email, password: 'oldpass123', role: 'customer' });
  assert.equal(r.status, 201);
  r = await a('GET', '/api/auth/me'); assert.equal(r.status, 200); ok('registered and logged in');

  r = await g('POST', '/api/auth/forgot', { email: `nobody-${run}@test.dev` });
  assert.equal(r.status, 200); assert.deepEqual(r.data, { ok: true });
  await new Promise((r) => setTimeout(r, 500));
  assert.equal(sent.length, 0); ok('unknown email: same answer, nothing sent');

  r = await g('POST', '/api/auth/forgot', { email: 'not-an-email' });
  assert.equal(r.status, 400); ok('invalid email rejected');

  r = await g('POST', '/api/auth/forgot', { email });
  assert.equal(r.status, 200);
  await wait(1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].key, 'test-key');
  assert.equal(sent[0].body.to[0].email, email);
  assert.equal(sent[0].body.sender.email, 'hello@parer.test');
  const m = /https:\/\/parer\.test\/reset-password\?token=([a-f0-9]{64})/.exec(sent[0].body.textContent);
  assert.ok(m); const token = m[1]; ok('known email: one email with a correct link');

  const stored = await db.query('SELECT token_hash FROM password_resets');
  assert.ok(!stored.rows.some((x) => x.token_hash === token)); ok('token is stored hashed only');

  await g('POST', '/api/auth/forgot', { email });
  await new Promise((r) => setTimeout(r, 500));
  assert.equal(sent.length, 1); ok('second request within a minute sends nothing');

  r = await g('POST', '/api/auth/reset', { token: 'x'.repeat(64), password: 'newpass123' });
  assert.equal(r.status, 400); ok('wrong token rejected');
  r = await g('POST', '/api/auth/reset', { token, password: 'short' });
  assert.equal(r.status, 400); ok('short password rejected');

  r = await g('POST', '/api/auth/reset', { token, password: 'newpass123' });
  assert.equal(r.status, 200); assert.equal(r.data.user.email, email);
  r = await g('GET', '/api/auth/me'); assert.equal(r.status, 200); ok('valid reset signs the user in');

  r = await a('GET', '/api/auth/me'); assert.equal(r.status, 401); ok('older session is signed out');

  r = await b('POST', '/api/auth/login', { email, password: 'oldpass123' }); assert.equal(r.status, 401); ok('old password fails');
  r = await b('POST', '/api/auth/login', { email, password: 'newpass123' }); assert.equal(r.status, 200); ok('new password works');

  r = await client()('POST', '/api/auth/reset', { token, password: 'another123' });
  assert.equal(r.status, 400); ok('token cannot be reused');

  // expired token
  const tok2 = run.padEnd(64, 'e');
  const uid = (await db.query('SELECT id FROM users WHERE email=$1', [email])).rows[0].id;
  const crypto = await import('node:crypto');
  await db.query(`INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1,$2, now() - interval '1 minute')`, [uid, crypto.createHash('sha256').update(tok2).digest('hex')]);
  r = await client()('POST', '/api/auth/reset', { token: tok2, password: 'another123' });
  assert.equal(r.status, 400); ok('expired token rejected');

  // ---- sign-in alert email and Google sign-in ----
  const before = sent.length;
  r = await client()('POST', '/api/auth/login', { email, password: 'newpass123' });
  assert.equal(r.status, 200); await wait(before + 1);
  assert.equal(sent.length, before + 1);
  assert.match(sent[before].body.subject, /sign-in/i);
  assert.match(sent[before].body.textContent, /Email and password/); ok('password login sends a sign-in email');

  r = await client()('POST', '/api/auth/login', { email, password: 'wrong-wrong' });
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(sent.length, before + 1); ok('failed login sends no email');

  const exp = String(Math.floor(Date.now() / 1000) + 3600);
  const claims = (e, extra = {}) => ({ iss: 'https://accounts.google.com', aud: 'test-client', email: e, email_verified: 'true', name: 'Gina Google', exp, ...extra });
  const gEmail = `g-${run}@test.dev`;
  googleTokens['t-new'.padEnd(24, 'x')] = claims(gEmail);
  const T = (k) => k.padEnd(24, 'x');

  r = await client()('POST', '/api/auth/google', { credential: T('t-new'), mode: 'login' });
  assert.equal(r.status, 404); ok('Google login without an account is told to sign up');
  r = await client()('POST', '/api/auth/google', { credential: T('t-new'), mode: 'register' });
  assert.equal(r.status, 400); ok('Google sign-up needs a role');
  r = await client()('POST', '/api/auth/google', { credential: T('t-new'), mode: 'register', role: 'pro' });
  assert.equal(r.status, 400); ok('Google pro sign-up needs a phone');
  const gc = client();
  r = await gc('POST', '/api/auth/google', { credential: T('t-new'), mode: 'register', role: 'customer' });
  assert.equal(r.status, 201); assert.equal(r.data.user.email, gEmail); assert.equal(r.data.created, true);
  r = await gc('GET', '/api/auth/me'); assert.equal(r.status, 200); ok('Google sign-up creates the account and signs in');

  const b2 = sent.length;
  r = await client()('POST', '/api/auth/google', { credential: T('t-new'), mode: 'login' });
  assert.equal(r.status, 200); assert.equal(r.data.created, false); await wait(b2 + 1);
  assert.match(sent[b2].body.textContent, /Google/); ok('Google login works and sends a sign-in email');

  googleTokens[T('t-other')] = claims(gEmail, { aud: 'someone-else' });
  googleTokens[T('t-unver')] = claims(gEmail, { email_verified: 'false' });
  googleTokens[T('t-old')] = claims(gEmail, { exp: String(Math.floor(Date.now() / 1000) - 10) });
  for (const k of ['t-other', 't-unver', 't-old', 't-missing']) {
    r = await client()('POST', '/api/auth/google', { credential: T(k), mode: 'login' });
    assert.equal(r.status, 401, k);
  }
  ok('wrong audience, unverified email, expired and unknown tokens are rejected');

  r = await client()('GET', '/api/config'); assert.equal(r.data.googleClientId, 'test-client'); ok('config exposes the Google client id');

  console.log(`\n${passed} checks passed`);
} catch (e) {
  console.error(e); process.exitCode = 1;
} finally {
  await db.end(); stop();
}
