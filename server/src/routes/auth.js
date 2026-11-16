import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query, pool } from '../db.js';
import { sendEmail, resetEmail, signInEmail, appUrl } from '../email.js';
import { startSession, endSession, requireAuth } from '../auth.js';
import { ah, phoneSchema, HttpError, AVATARS } from '../util.js';

const router = Router();

const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter your name.').max(80),
    email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(160),
    password: z.string().min(8, 'Password must be at least 8 characters.').max(100),
    role: z.enum(['customer', 'pro']),
    phone: z.string().trim().max(20).optional().default(''),
    avatar: z.enum(AVATARS).optional().default('initials'),
  })
  .superRefine((v, ctx) => {
    if (v.role === 'pro' && !v.phone) {
      ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Professionals need a phone number so customers can reach them.' });
    }
    if (v.phone) {
      const r = phoneSchema.safeParse(v.phone);
      if (!r.success) ctx.addIssue({ code: 'custom', path: ['phone'], message: r.error.issues[0].message });
    }
  });

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(100),
});

async function loadMe(userId) {
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.role, u.phone, u.avatar,
            p.trade, p.area, p.bio, p.rate
       FROM users u LEFT JOIN pro_profiles p ON p.user_id = u.id
      WHERE u.id = $1`,
    [userId]
  );
  if (!rows[0]) return null;
  const { trade, area, bio, rate, ...user } = rows[0];
  user.profile = trade ? { trade, area, bio, rate } : null;
  return user;
}

ro
  '/register',
  ah(async (req, res) => {
    const data = registerSchema.parse(req.body);
    const hash = await bcrypt.hash(data.password, 10);
    let row;
    try {
      const result = await query(
        `INSERT INTO users (name, email, password_hash, role, phone, avatar)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, role, pw_version`,
        [data.name, data.email, hash, data.role, data.phone, data.avatar]
      );
      row = result.rows[0];
    } catch (err) {
      if (err.code === '23505') throw new HttpError(409, 'That email is already registered. Try logging in.');
      throw err;
    }
    startSession(res, row);
    res.status(201).json({ user: await loadMe(row.id) });
  })
);

// Tells the person by email that someone signed in. Never blocks or fails the sign-in itself.
function notifySignIn(req, user, method) {
  const ua = String(req.get('user-agent') || 'Unknown device').slice(0, 120);
  const when = new Date().toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Lagos' }) + ' (Nigeria time)';
  sendEmail({ to: user.email, ...signInEmail({ name: user.name, method, when, ip: req.ip || 'unknown', device: ua }) }).catch((err) =>
    console.error('Sign-in email failed:', err.message)
  );
}

const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
const googleSchema = z.object({
  credential: z.string().min(20).max(4000),
  mode: z.enum(['login', 'register']).default('login'),
  role: z.enum(['customer', 'pro']).optional(),
  phone: z.string().trim().max(20).optional().default(''),
});

// Checks a Google ID token with Google itself, and that it was issued for our own app.
async function verifyGoogleToken(credential) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new HttpError(503, 'Google sign-in is not set up yet.');
  const base = process.env.GOOGLE_TOKENINFO_URL || 'https://oauth2.googleapis.com/tokeninfo';
  let info;
  try {
    const res = await fetch(`${base}?id_token=${encodeURIComponent(credential)}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('rejected');
    info = await res.json();
  } catch {
    throw new HttpError(401, 'Google sign-in could not be verified. Please try again.');
  }
  const verified = info.email_verified === true || info.email_verified === 'true';
  if (info.aud !== clientId || !GOOGLE_ISSUERS.includes(info.iss) || !verified || !info.email || Number(info.exp) * 1000 < Date.now()) {
    throw new HttpError(401, 'Google sign-in could not be verified. Please try again.');
  }
  return { email: String(info.email).toLowerCase(), name: String(info.name || '').trim() };
}

router.post(
  '/google',
  ah(async (req, res) => {
    const data = googleSchema.parse(req.body);
    const g = await verifyGoogleToken(data.credential);
    const found = await query('SELECT id, name, email, role, pw_version FROM users WHERE email = $1', [g.email]);

    if (found.rows[0]) {
      const user = found.rows[0];
      startSession(res, user);
      notifySignIn(req, user, 'Google');
      return res.json({ user: await loadMe(user.id), created: false });
    }

    if (data.mode === 'login') throw new HttpError(404, 'There is no Parer account for that Google email yet. Choose Sign up first.');
    if (!data.role) throw new HttpError(400, 'Choose whether you need a pro or you are a pro.');
    if (data.role === 'pro' && !data.phone) throw new HttpError(400, 'Professionals need a phone number so customers can reach them.');
    if (data.phone) {
      const r = phoneSchema.safeParse(data.phone);
      if (!r.success) throw new HttpError(400, r.error.issues[0].message);
    }
    const name = (g.name || g.email.split('@')[0]).slice(0, 80);
    // Google accounts get a random password nobody knows. They can set one later with "Forgot password".
    const hash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
    const ins = await query(
      `INSERT INTO users (name, email, password_hash, role, phone) VALUES ($1, $2, $3, $4, $5) RETURNING id, role, pw_version`,
      [name.length >= 2 ? name : 'Parer user', g.email, hash, data.role, data.phone]
    );
    startSession(res, ins.rows[0]);
    res.status(201).json({ user: await loadMe(ins.rows[0].id), created: true });
  })
);

router.post(
  '/login',
  ah(async (req, res) => {
    const data = loginSchema.parse(req.body);
    const { rows } = await query('SELECT id, name, email, role, pw_version, password_hash FROM users WHERE email = $1', [data.email]);
    const user = rows[0];
    const ok = user && (await bcrypt.compare(data.password, user.password_hash));
    if (!ok) throw new HttpError(401, 'Wrong email or password.');
    startSession(res, user);
    notifySignIn(req, user, 'Email and password');
    res.json({ user: await loadMe(user.id) });
  })
);

const RESET_MINUTES = 60;
const RESET_COOLDOWN_SECONDS = 60;
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(160) });
const resetSchema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(100),
});

async function sendResetEmail(email) {
  const { rows } = await query('SELECT id, name FROM users WHERE email = $1', [email]);
  const user = rows[0];
  if (!user) return;

  // One email a minute per account, so nobody can use this to flood an inbox.
  const recent = await query(
    `SELECT 1 FROM password_resets WHERE user_id = $1 AND created_at > now() - make_interval(secs => $2)`,
    [user.id, RESET_COOLDOWN_SECONDS]
  );
  if (recent.rowCount) return;

  const token = crypto.randomBytes(32).toString('hex');
  await query('DELETE FROM password_resets WHERE user_id = $1', [user.id]); // older links stop working
  await query(
    `INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, now() + make_interval(mins => $3))`,
    [user.id, sha256(token), RESET_MINUTES]
  );
  const link = `${appUrl()}/reset-password?token=${token}`;
  await sendEmail({ to: email, ...resetEmail({ name: user.name, link, minutes: RESET_MINUTES }) });
}

// Always answers the same way, so it cannot be used to find out who has an account.
router.post(
  '/forgot',
  ah(async (req, res) => {
    const { email } = forgotSchema.parse(req.body);
    res.json({ ok: true });
    try {
      await sendResetEmail(email);
    } catch (err) {
      console.error('Password reset email failed:', err.message);
    }
  })
);

router.post(
  '/reset',
  ah(async (req, res) => {
    const { token, password } = resetSchema.parse(req.body);
    const hash = await bcrypt.hash(password, 10);

    const client = await pool.connect();
    let account;
    try {
      await client.query('BEGIN');
      const found = await client.query(
        'SELECT user_id FROM password_resets WHERE token_hash = $1 AND expires_at > now() FOR UPDATE',
        [sha256(token)]
      );
      if (!found.rowCount) throw new HttpError(400, 'This reset link is invalid or has expired. Please request a new one.');
      const upd = await client.query(
        'UPDATE users SET password_hash = $1, pw_version = pw_version + 1 WHERE id = $2 RETURNING id, role, pw_version',
        [hash, found.rows[0].user_id]
      );
      await client.query('DELETE FROM password_resets WHERE user_id = $1', [found.rows[0].user_id]);
      await client.query('COMMIT');
      account = upd.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    startSession(res, account); // proving email ownership logs them in, and all older sessions are now invalid
    res.json({ user: await loadMe(account.id) });
  })
);

router.post('/logout', (_req, res) => {
  endSession(res);
  res.json({ ok: true });
});

router.get(
  '/me',
  requireAuth,
  ah(async (req, res) => {
    const user = await loadMe(req.user.id);
    if (!user) {
      endSession(res);
      throw new HttpError(401, 'Please log in to continue.');
    }
    res.json({ user });
  })
);

export default router;
