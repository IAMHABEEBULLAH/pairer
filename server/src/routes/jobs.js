import { Router } from 'express';
import { z } from 'zod';
import { query, pool } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { TRADES } from '../trades.js';
import { ah, parseId, HttpError } from '../util.js';

const router = Router();

const jobSchema = z.object({
  trade: z.enum(TRADES),
  area: z.string().trim().min(2, 'Enter your area, for example Garki, Abuja.').max(80),
  description: z.string().trim().min(10, 'Describe the job in at least 10 characters.').max(1000),
});

const quoteSchema = z.object({
  priceNgn: z.coerce.number().int('Enter a whole number.').min(0).max(100_000_000),
  message: z.string().trim().max(500).default(''),
});

const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(500).default(''),
});

const jobShape = (r) => ({
  id: r.id,
  trade: r.trade,
  area: r.area,
  description: r.description,
  status: r.status,
  createdAt: r.created_at,
  quoteCount: r.quote_count ?? undefined,
  customerName: r.customer_name ? r.customer_name.split(' ')[0] : undefined,
});

const quoteShape = (r, job, isOwner) => ({
  id: r.id,
  jobId: r.job_id,
  proId: r.pro_id,
  proName: r.pro_name,
  trade: r.trade,
  area: r.area,
  rating: Math.round((r.rating ?? 0) * 10) / 10,
  reviewCount: r.review_count ?? 0,
  priceNgn: r.price_ngn,
  message: r.message,
  createdAt: r.created_at,
  accepted: job.accepted_quote_id === r.id,
  // Only the customer who accepted this quote gets the pro's phone number.
  phone: isOwner && job.accepted_quote_id === r.id ? r.phone : null,
});

const QUOTE_SELECT = `
  SELECT q.id, q.job_id, q.pro_id, q.price_ngn, q.message, q.created_at,
         u.name AS pro_name, u.phone, p.trade, p.area,
         COALESCE((SELECT AVG(r.rating) FROM reviews r WHERE r.pro_id = q.pro_id), 0)::float AS rating,
         (SELECT COUNT(*) FROM reviews r WHERE r.pro_id = q.pro_id)::int AS review_count
    FROM quotes q JOIN users u ON u.id = q.pro_id LEFT JOIN pro_profiles p ON p.user_id = q.pro_id`;

// Open jobs board (public).
router.get(
  '/',
  ah(async (req, res) => {
    const trade = TRADES.includes(req.query.trade) ? req.query.trade : null;
    const { rows } = await query(
      `SELECT j.*, u.name AS customer_name,
              (SELECT COUNT(*) FROM quotes q WHERE q.job_id = j.id)::int AS quote_count
         FROM jobs j JOIN users u ON u.id = j.customer_id
        WHERE j.status = 'open' AND ($1::text IS NULL OR j.trade = $1)
        ORDER BY j.created_at DESC LIMIT 60`,
      [trade]
    );
    res.json({ jobs: rows.map(jobShape) });
  })
);

// My jobs: customers see their own jobs with quotes; pros see jobs they quoted on.
router.get(
  '/mine',
  requireAuth,
  ah(async (req, res) => {
    if (req.user.role === 'customer') {
      const { rows: jobs } = await query(
        `SELECT j.*, (SELECT COUNT(*) FROM quotes q WHERE q.job_id = j.id)::int AS quote_count,
                EXISTS (SELECT 1 FROM reviews r WHERE r.job_id = j.id) AS reviewed
           FROM jobs j WHERE j.customer_id = $1 ORDER BY j.created_at DESC`,
        [req.user.id]
      );
      const ids = jobs.map((j) => j.id);
      const { rows: quotes } = ids.length
        ? await query(`${QUOTE_SELECT} WHERE q.job_id = ANY($1) ORDER BY q.price_ngn ASC`, [ids])
        : { rows: [] };
      return res.json({
        jobs: jobs.map((j) => ({
          ...jobShape(j),
          reviewed: j.reviewed,
          quotes: quotes.filter((q) => q.job_id === j.id).map((q) => quoteShape(q, j, true)),
        })),
      });
    }

    const { rows } = await query(
      `SELECT j.id, j.trade, j.area, j.description, j.status, j.created_at,
              q.id AS quote_id, q.price_ngn, q.message, (j.accepted_quote_id = q.id) AS accepted,
              c.name AS customer_name, c.phone AS customer_phone
         FROM quotes q JOIN jobs j ON j.id = q.job_id JOIN users c ON c.id = j.customer_id
        WHERE q.pro_id = $1 ORDER BY q.created_at DESC`,
      [req.user.id]
    );
    res.json({
      quotes: rows.map((r) => ({
        quoteId: r.quote_id,
        priceNgn: r.price_ngn,
        message: r.message,
        accepted: r.accepted,
        job: jobShape(r),
        // The customer's contact is revealed only when they accept this pro.
        customerName: r.accepted ? r.customer_name : r.customer_name.split(' ')[0],
        customerPhone: r.accepted ? r.customer_phone : null,
      })),
    });
  })
);

router.post(
  '/',
  requireRole('customer'),
  ah(async (req, res) => {
    const data = jobSchema.parse(req.body);
    const { rows } = await query(
      `INSERT INTO jobs (customer_id, trade, area, description) VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.id, data.trade, data.area, data.description]
    );
    res.status(201).json({ job: jobShape(rows[0]) });
  })
);

router.get(
  '/:id',
  ah(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) throw new HttpError(404, 'Job not found.');
    const { rows } = await query(
      `SELECT j.*, u.name AS customer_name,
              (SELECT COUNT(*) FROM quotes q WHERE q.job_id = j.id)::int AS quote_count
         FROM jobs j JOIN users u ON u.id = j.customer_id WHERE j.id = $1`,
      [id]
    );
    const job = rows[0];
    if (!job) throw new HttpError(404, 'Job not found.');
    const isOwner = req.user?.id === job.customer_id;
    const out = { job: { ...jobShape(job), isOwner } };
    if (isOwner) {
      const q = await query(`${QUOTE_SELECT} WHERE q.job_id = $1 ORDER BY q.price_ngn ASC`, [id]);
      out.quotes = q.rows.map((r) => quoteShape(r, job, true));
    } else if (req.user?.role === 'pro') {
      const q = await query(`${QUOTE_SELECT} WHERE q.job_id = $1 AND q.pro_id = $2`, [id, req.user.id]);
      out.myQuote = q.rows[0] ? quoteShape(q.rows[0], job, false) : null;
    }
    res.json(out);
  })
);

// A pro sends (or updates) a quote on an open job.
router.post(
  '/:id/quotes',
  requireRole('pro'),
  ah(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) throw new HttpError(404, 'Job not found.');
    const data = quoteSchema.parse(req.body);

    const profile = await query('SELECT 1 FROM pro_profiles WHERE user_id = $1', [req.user.id]);
    if (!profile.rowCount) throw new HttpError(400, 'Create your professional profile before sending quotes.');

    const job = await query('SELECT status FROM jobs WHERE id = $1', [id]);
    if (!job.rowCount) throw new HttpError(404, 'Job not found.');
    if (job.rows[0].status !== 'open') throw new HttpError(409, 'This job is no longer open.');

    await query(
      `INSERT INTO quotes (job_id, pro_id, price_ngn, message) VALUES ($1, $2, $3, $4)
       ON CONFLICT (job_id, pro_id) DO UPDATE SET price_ngn = EXCLUDED.price_ngn, message = EXCLUDED.message`,
      [id, req.user.id, data.priceNgn, data.message]
    );
    res.status(201).json({ ok: true });
  })
);

// The customer accepts one quote. The job moves to in_progress.
router.post(
  '/:id/accept',
  requireRole('customer'),
  ah(async (req, res) => {
    const id = parseId(req.params.id);
    const quoteId = parseId(req.body?.quoteId);
    if (!id || !quoteId) throw new HttpError(400, 'Choose a quote to accept.');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const quote = await client.query('SELECT id FROM quotes WHERE id = $1 AND job_id = $2', [quoteId, id]);
      if (!quote.rowCount) throw new HttpError(404, 'Quote not found for this job.');
      const upd = await client.query(
        `UPDATE jobs SET status = 'in_progress', accepted_quote_id = $1
          WHERE id = $2 AND customer_id = $3 AND status = 'open'`,
        [quoteId, id, req.user.id]
      );
      if (!upd.rowCount) throw new HttpError(409, 'This job is not open, or it is not yours.');
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    res.json({ ok: true });
  })
);

router.post(
  '/:id/complete',
  requireRole('customer'),
  ah(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) throw new HttpError(404, 'Job not found.');
    const upd = await query(
      `UPDATE jobs SET status = 'completed'
        WHERE id = $1 AND customer_id = $2 AND status = 'in_progress'`,
      [id, req.user.id]
    );
    if (!upd.rowCount) throw new HttpError(409, 'Only your jobs that are in progress can be marked complete.');
    res.json({ ok: true });
  })
);

router.post(
  '/:id/review',
  requireRole('customer'),
  ah(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) throw new HttpError(404, 'Job not found.');
    const data = reviewSchema.parse(req.body);
    const job = await query(
      `SELECT j.status, q.pro_id FROM jobs j JOIN quotes q ON q.id = j.accepted_quote_id
        WHERE j.id = $1 AND j.customer_id = $2`,
      [id, req.user.id]
    );
    if (!job.rowCount) throw new HttpError(404, 'Job not found.');
    if (job.rows[0].status !== 'completed') throw new HttpError(409, 'You can review a job once it is completed.');
    try {
      await query(
        `INSERT INTO reviews (job_id, pro_id, customer_id, rating, comment) VALUES ($1, $2, $3, $4, $5)`,
        [id, job.rows[0].pro_id, req.user.id, data.rating, data.comment]
      );
    } catch (err) {
      if (err.code === '23505') throw new HttpError(409, 'You already reviewed this job.');
      throw err;
    }
    res.status(201).json({ ok: true });
  })
);

export default router;
