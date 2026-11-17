import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';
import { ah, parseId, likePattern, phoneSchema, HttpError } from '../util.js';

const router = Router();
const MAX_ACTIVE_PER_USER = 20;

const base = {
  deal: z.enum(['sale', 'rent']),
  title: z.string().trim().min(5, 'Give the listing a title of at least 5 characters.').max(100),
  price_ngn: z.coerce.number().int('Enter the price in whole naira.').min(1, 'Enter a price.').max(1_000_000_000_000),
  area: z.string().trim().min(2, 'Enter the area, for example Barnawa, Kaduna.').max(100),
  description: z.string().trim().min(10, 'Describe it in at least 10 characters.').max(2000),
  phone: phoneSchema,
};

const createSchema = z.discriminatedUnion('category', [
  z.object({
    ...base,
    category: z.literal('house'),
    details: z.object({
      property_type: z.enum(['flat', 'house', 'duplex', 'room', 'shop']),
      bedrooms: z.coerce.number().int().min(0).max(50),
      bathrooms: z.coerce.number().int().min(0).max(50),
    }),
  }),
  z.object({
    ...base,
    category: z.literal('car'),
    details: z.object({
      make: z.string().trim().min(2).max(40),
      model: z.string().trim().min(1).max(40),
      year: z.coerce.number().int().min(1960).max(new Date().getFullYear() + 1),
      condition: z.enum(['new', 'used']),
      transmission: z.enum(['automatic', 'manual']),
    }),
  }),
  z.object({
    ...base,
    category: z.literal('land'),
    details: z.object({
      size_sqm: z.coerce.number().int().min(1).max(100_000_000),
      documents: z.string().trim().max(80).optional().default(''),
    }),
  }),
]);

const cardSelect = `
  l.id, l.category, l.deal, l.title, l.price_ngn::float8 AS price_ngn, l.area, l.details, l.status, l.created_at,
  (SELECT id FROM photos WHERE listing_id = l.id ORDER BY id LIMIT 1) AS "coverPhotoId"`;

router.get(
  '/',
  ah(async (req, res) => {
    const where = ["l.status = 'active'"];
    const params = [];
    const add = (sql, v) => { params.push(v); where.push(sql.replace('$#', `$${params.length}`)); };

    if (['house', 'car', 'land'].includes(req.query.category)) add('l.category = $#', req.query.category);
    if (['sale', 'rent'].includes(req.query.deal)) add('l.deal = $#', req.query.deal);
    if (typeof req.query.q === 'string' && req.query.q.trim()) {
      const p = likePattern(req.query.q.trim().slice(0, 80));
      params.push(p);
      where.push(`(l.title ILIKE $${params.length} OR l.area ILIKE $${params.length} OR l.description ILIKE $${params.length})`);
    }
    const min = Number(req.query.minPrice), max = Number(req.query.maxPrice);
    if (Number.isFinite(min) && min > 0) add('l.price_ngn >= $#', Math.floor(min));
    if (Number.isFinite(max) && max > 0) add('l.price_ngn <= $#', Math.floor(max));

    const { rows } = await query(
      `SELECT ${cardSelect} FROM listings l WHERE ${where.join(' AND ')} ORDER BY l.created_at DESC LIMIT 60`,
      params
    );
    res.json({ listings: rows });
  })
);

router.get(
  '/mine',
  requireAuth,
  ah(async (req, res) => {
    const { rows } = await query(
      `SELECT ${cardSelect} FROM listings l WHERE l.owner_id = $1 ORDER BY l.created_at DESC`,
      [req.user.id]
    );
    res.json({ listings: rows });
  })
);

router.get(
  '/:id',
  ah(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) throw new HttpError(404, 'Listing not found.');
    const { rows } = await query(
      `SELECT l.id, l.owner_id, l.category, l.deal, l.title, l.price_ngn::float8 AS price_ngn, l.area, l.description,
              l.details, l.contact_phone, l.status, l.created_at, u.name AS "ownerName", u.avatar AS "ownerAvatar"
         FROM listings l JOIN users u ON u.id = l.owner_id WHERE l.id = $1`,
      [id]
    );
    const l = rows[0];
    const isOwner = req.user?.id === l?.owner_id;
    // Closed listings are only visible to their owner.
    if (!l || (l.status !== 'active' && !isOwner)) throw new HttpError(404, 'Listing not found.');
    const photos = await query('SELECT id FROM photos WHERE listing_id = $1 ORDER BY id', [id]);
    const { owner_id, contact_phone, ...rest } = l;
    res.json({
      listing: {
        ...rest,
        isOwner,
        // The number is only shown to signed-in people, so bots cannot scrape every contact.
        phone: req.user ? contact_phone : null,
        photos: photos.rows.map((p) => p.id),
      },
    });
  })
);

router.post(
  '/',
  requireAuth,
  ah(async (req, res) => {
    const data = createSchema.parse(req.body);
    const active = await query("SELECT COUNT(*)::int AS n FROM listings WHERE owner_id = $1 AND status = 'active'", [req.user.id]);
    if (active.rows[0].n >= MAX_ACTIVE_PER_USER) {
      throw new HttpError(409, `You can have up to ${MAX_ACTIVE_PER_USER} active listings. Close one to add another.`);
    }
    const { rows } = await query(
      `INSERT INTO listings (owner_id, category, deal, title, price_ngn, area, description, details, contact_phone)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [req.user.id, data.category, data.deal, data.title, data.price_ngn, data.area, data.description, JSON.stringify(data.details), data.phone]
    );
    res.status(201).json({ id: rows[0].id });
  })
);

const statusSchema = z.object({ status: z.enum(['active', 'closed']) });

router.patch(
  '/:id',
  requireAuth,
  ah(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) throw new HttpError(404, 'Listing not found.');
    const { status } = statusSchema.parse(req.body);
    const upd = await query('UPDATE listings SET status = $1 WHERE id = $2 AND owner_id = $3 RETURNING id', [status, id, req.user.id]);
    if (!upd.rowCount) throw new HttpError(404, 'Listing not found.');
    res.json({ ok: true });
  })
);

router.delete(
  '/:id',
  requireAuth,
  ah(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) throw new HttpError(404, 'Listing not found.');
    const del = await query('DELETE FROM listings WHERE id = $1 AND owner_id = $2', [id, req.user.id]);
    if (!del.rowCount) throw new HttpError(404, 'Listing not found.');
    res.json({ ok: true });
  })
);

export default router;
