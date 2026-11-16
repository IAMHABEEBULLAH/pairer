import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query, pool } from '../db.js';
import { sendEmail, resetEmail, appUrl } from '../email.js';
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

router.post(
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

router.post(
  '/login',
  ah(async (req, res) => {
    const data = loginSchema.parse(req.body);
    const { rows } = await query('SELECT id, role, pw_version, password_hash FROM users WHERE email = $1', [data.email]);
    const user = rows[0];
    const ok = user && (await bcrypt.compare(data.password, user.password_hash));
    if (!ok) throw new HttpError(401, 'Wrong email or password.');
    startSession(res, user);
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
