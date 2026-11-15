import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireRole } from '../auth.js';
import { TRADES } from '../trades.js';
import { ah, parseId, likePattern, phoneSchema, HttpError } from '../util.js';

const router = Router();

const RATING = `COALESCE((SELECT AVG(r.rating) FROM reviews r WHERE r.pro_id = u.id), 0)::float`;
const REVIEW_COUNT = `(SELECT COUNT(*) FROM reviews r WHERE r.pro_id = u.id)::int`;
const JOBS_DONE = `(SELECT COUNT(*) FROM jobs j JOIN quotes q ON q.id = j.accepted_quote_id
                     WHERE q.pro_id = u.id AND j.status = 'completed')::int`;

const profileSchema = z.object({
  trade: z.enum(TRADES),
  area: z.string().trim().min(2, 'Enter your area, for example Wuse 2, Abuja.').max(80),
  bio: z.string().trim().max(500).default(''),
  rate: z.string().trim().max(60).default(''),
  phone: phoneSchema,
});

// Phone numbers are visible to logged-in users only.
const shape = (row, loggedIn) => ({
  id: row.id,
  name: row.name,
  trade: row.trade,
  area: row.area,
  bio: row.bio,
  rate: row.rate,
  phone: loggedIn ? row.phone : null,
  rating: Math.round(row.rating * 10) / 10,
  reviewCount: row.review_count,
  jobsDone: row.jobs_done,
  joinedAt: row.joined_at,
});

router.get(
  '/',
  ah(async (req, res) => {
    const trade = TRADES.includes(req.query.trade) ? req.query.trade : null;
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 80) : '';
    const { rows } = await query(
      `SELECT u.id, u.name, u.phone, u.created_at AS joined_at, p.trade, p.area, p.bio, p.rate,
              ${RATING} AS rating, ${REVIEW_COUNT} AS review_count, ${JOBS_DONE} AS jobs_done
         FROM pro_profiles p JOIN users u ON u.id = p.user_id
        WHERE ($1::text IS NULL OR p.trade = $1)
          AND ($2::text IS NULL OR u.name ILIKE $2 OR p.area ILIKE $2 OR p.bio ILIKE $2 OR p.trade ILIKE $2)
        ORDER BY review_count DESC, rating DESC, p.updated_at DESC
        LIMIT 60`,
      [trade, q ? likePattern(q) : null]
    );
    res.json({ pros: rows.map((r) => shape(r, Boolean(req.user))) });
  })
);

router.get(
  '/:id',
  ah(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) throw new HttpError(404, 'Professional not found.');
    const { rows } = await query(
      `SELECT u.id, u.name, u.phone, u.created_at AS joined_at, p.trade, p.area, p.bio, p.rate,
              ${RATING} AS rating, ${REVIEW_COUNT} AS review_count, ${JOBS_DONE} AS jobs_done
         FROM pro_profiles p JOIN users u ON u.id = p.user_id
        WHERE u.id = $1`,
      [id]
    );
    if (!rows[0]) throw new HttpError(404, 'Professional not found.');
    const reviews = await query(
      `SELECT r.id, r.rating, r.comment, r.created_at, c.name AS customer_name, j.description AS job
         FROM reviews r JOIN users c ON c.id = r.customer_id JOIN jobs j ON j.id = r.job_id
        WHERE r.pro_id = $1 ORDER BY r.created_at DESC LIMIT 30`,
      [id]
    );
    res.json({
      pro: shape(rows[0], Boolean(req.user)),
      reviews: reviews.rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.created_at,
        customerName: r.customer_name.split(' ')[0],
        job: r.job,
      })),
    });
  })
);

// Create or update my own professional profile.
router.put(
  '/me',
  requireRole('pro'),
  ah(async (req, res) => {
    const data = profileSchema.parse(req.body);
    await query('UPDATE users SET phone = $1 WHERE id = $2', [data.phone, req.user.id]);
    await query(
      `INSERT INTO pro_profiles (user_id, trade, area, bio, rate)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE
         SET trade = EXCLUDED.trade, area = EXCLUDED.area, bio = EXCLUDED.bio,
             rate = EXCLUDED.rate, updated_at = now()`,
      [req.user.id, data.trade, data.area, data.bio, data.rate]
    );
    res.json({ ok: true });
  })
);

export default router;
