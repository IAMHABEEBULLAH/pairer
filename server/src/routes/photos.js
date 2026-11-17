import { Router } from 'express';
import express from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';
import { ah, parseId, HttpError } from '../util.js';

const router = Router();

const MAX_WORK_PHOTOS = 8; // pro gallery
const MAX_JOB_PHOTOS = 3; // per job
const MAX_LISTING_PHOTOS = 8; // per Explore listing

// Decide the type from the file's own first bytes, never from what the client claims.
function sniffMime(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return 'image/png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

// Photos are stored in Postgres, so they survive Render redeploys (the web server's disk does not).
// The app shrinks images in the browser first, so a typical upload is 100 to 400 KB.
router.post(
  '/',
  requireAuth,
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '1.5mb' }),
  ah(async (req, res) => {
    const body = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      throw new HttpError(400, 'Choose a JPG, PNG or WebP image.');
    }
    const mime = sniffMime(body);
    if (!mime) throw new HttpError(400, 'That file is not a valid image. Use a JPG, PNG or WebP.');

    const jobId = req.query.jobId === undefined ? null : parseId(req.query.jobId);
    if (req.query.jobId !== undefined && !jobId) throw new HttpError(404, 'Job not found.');
    const listingId = req.query.listingId === undefined ? null : parseId(req.query.listingId);
    if (req.query.listingId !== undefined && !listingId) throw new HttpError(404, 'Listing not found.');

    if (listingId) {
      const own = await query('SELECT 1 FROM listings WHERE id = $1 AND owner_id = $2', [listingId, req.user.id]);
      if (!own.rowCount) throw new HttpError(404, 'Listing not found.');
      const count = await query('SELECT COUNT(*)::int AS n FROM photos WHERE listing_id = $1', [listingId]);
      if (count.rows[0].n >= MAX_LISTING_PHOTOS) throw new HttpError(409, `A listing can have up to ${MAX_LISTING_PHOTOS} photos.`);
    } else if (jobId) {
      if (req.user.role !== 'customer') throw new HttpError(403, 'Only the customer who posted a job can add photos to it.');
      const job = await query('SELECT status FROM jobs WHERE id = $1 AND customer_id = $2', [jobId, req.user.id]);
      if (!job.rowCount) throw new HttpError(404, 'Job not found.');
      if (job.rows[0].status !== 'open') throw new HttpError(409, 'Photos can only be added while a job is open.');
      const count = await query('SELECT COUNT(*)::int AS n FROM photos WHERE job_id = $1', [jobId]);
      if (count.rows[0].n >= MAX_JOB_PHOTOS) throw new HttpError(409, `A job can have up to ${MAX_JOB_PHOTOS} photos.`);
    } else {
      if (req.user.role !== 'pro') throw new HttpError(403, 'Only professionals have a work gallery.');
      const profile = await query('SELECT 1 FROM pro_profiles WHERE user_id = $1', [req.user.id]);
      if (!profile.rowCount) throw new HttpError(400, 'Create your professional profile before adding photos.');
      const count = await query('SELECT COUNT(*)::int AS n FROM photos WHERE owner_id = $1 AND job_id IS NULL AND listing_id IS NULL', [req.user.id]);
      if (count.rows[0].n >= MAX_WORK_PHOTOS) throw new HttpError(409, `Your gallery can hold up to ${MAX_WORK_PHOTOS} photos. Delete one to add another.`);
    }

    const { rows } = await query(
      'INSERT INTO photos (owner_id, job_id, listing_id, mime, data) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [req.user.id, jobId, listingId, mime, body]
    );
    res.status(201).json({ id: rows[0].id });
  })
);

// Public: photos belong to public pages (pro profiles and the open jobs board).
router.get(
  '/:id',
  ah(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) throw new HttpError(404, 'Photo not found.');
    const { rows } = await query('SELECT mime, data FROM photos WHERE id = $1', [id]);
    if (!rows[0]) throw new HttpError(404, 'Photo not found.');
    res.set({
      'Content-Type': rows[0].mime,
      'Cache-Control': 'public, max-age=31536000, immutable', // a photo never changes once stored
      'Content-Length': rows[0].data.length,
    });
    res.send(rows[0].data);
  })
);

router.delete(
  '/:id',
  requireAuth,
  ah(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) throw new HttpError(404, 'Photo not found.');
    const del = await query('DELETE FROM photos WHERE id = $1 AND owner_id = $2', [id, req.user.id]);
    if (!del.rowCount) throw new HttpError(404, 'Photo not found.');
    res.json({ ok: true });
  })
);

export default router;
