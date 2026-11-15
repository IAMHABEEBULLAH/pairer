import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../db.js';
import { startSession, endSession, requireAuth } from '../auth.js';
import { ah, phoneSchema, HttpError } from '../util.js';

const router = Router();

const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter your name.').max(80),
    email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(160),
    password: z.string().min(8, 'Password must be at least 8 characters.').max(100),
    role: z.enum(['customer', 'pro']),
    phone: z.string().trim().max(20).optional().default(''),
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
    `SELECT u.id, u.name, u.email, u.role, u.phone,
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
        `INSERT INTO users (name, email, password_hash, role, phone)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, role`,
        [data.name, data.email, hash, data.role, data.phone]
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
    const { rows } = await query('SELECT id, role, password_hash FROM users WHERE email = $1', [data.email]);
    const user = rows[0];
    const ok = user && (await bcrypt.compare(data.password, user.password_hash));
    if (!ok) throw new HttpError(401, 'Wrong email or password.');
    startSession(res, user);
    res.json({ user: await loadMe(user.id) });
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
