import './env.js';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ZodError } from 'zod';
import { isProd } from './env.js';
import { pool, migrate } from './db.js';
import { attachUser } from './auth.js';
import authRoutes from './routes/auth.js';
import proRoutes from './routes/pros.js';
import jobRoutes from './routes/jobs.js';
import assistantRoutes from './routes/assistant.js';
import photoRoutes from './routes/photos.js';
import listingRoutes from './routes/listings.js';
import { emailConfigured } from './email.js';

const app = express();
app.set('trust proxy', 1); // Render sits behind a proxy; needed for correct client IPs.

const cspDirectives = {
  'img-src': ["'self'", 'data:', 'blob:'],
  // Google's sign-in button loads a script, a frame, styles and a token request from Google.
  'script-src': ["'self'", 'https://accounts.google.com/gsi/client'],
  'frame-src': ["'self'", 'https://accounts.google.com/gsi/'],
  'connect-src': ["'self'", 'https://accounts.google.com/gsi/'],
  'style-src': ["'self'", 'https:', "'unsafe-inline'"],
  ...(isProd ? {} : { 'upgrade-insecure-requests': null }),
};
app.use(helmet({ contentSecurityPolicy: { useDefaults: true, directives: cspDirectives } }));
app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());

const limiter = (windowMs, limit, message) =>
  rateLimit({ windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: message } });

app.use('/api', attachUser);
app.use('/api', limiter(60 * 1000, 300, 'Too many requests. Slow down and try again in a minute.'));

app.get('/api/config', (_req, res) => res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || null }));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

// Strict limit only on the endpoints that can be brute-forced. /auth/me runs on every page load.
const credentialLimit = limiter(15 * 60 * 1000, 20, 'Too many attempts. Try again in a few minutes.');
app.use('/api/auth/login', credentialLimit);
app.use('/api/auth/register', credentialLimit);
app.use('/api/auth/forgot', credentialLimit);
app.use('/api/auth/reset', credentialLimit);
app.use('/api/auth', authRoutes);
app.use('/api/assistant', limiter(60 * 60 * 1000, 40, 'Assistant limit reached. Try again later.'), assistantRoutes);
app.use('/api/photos', limiter(60 * 60 * 1000, 120, 'Upload limit reached. Try again later.'), photoRoutes);
app.post('/api/listings', limiter(60 * 60 * 1000, 30, 'Listing limit reached. Try again later.'));
app.use('/api/listings', listingRoutes);
app.use('/api/pros', proRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));

// In production the Express server also serves the built React app.
const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(here, '../../client/dist');
if (existsSync(clientDist)) {
  app.use(
    express.static(clientDist, {
      setHeaders(res, filePath) {
        if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
        else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    })
  );
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: err.issues[0]?.message || 'Check the details and try again.' });
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'That file is too large. Try a smaller photo.' });
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
});

const port = Number(process.env.PORT) || 3000;

try {
  await migrate();
  if (isProd && !emailConfigured()) {
    console.warn('Email is not configured (BREVO_API_KEY or RESEND_API_KEY). Password reset emails will NOT be sent.');
  }
  app.listen(port, () => console.log(`Parer listening on port ${port}`));
} catch (err) {
  console.error('Failed to start:', err);
  process.exit(1);
}
