import './env.js';
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { isProd } from './env.js';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

// Render's Postgres requires TLS for external connections and accepts it internally.
// Set PGSSL=false to turn TLS off (for example, a local Postgres in production mode).
const useSsl = process.env.PGSSL ? process.env.PGSSL === 'true' : isProd;

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  max: 10,
});

export const query = (text, params) => pool.query(text, params);

export async function migrate() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const sql = await readFile(path.join(here, 'schema.sql'), 'utf8');
  await pool.query(sql);
}
