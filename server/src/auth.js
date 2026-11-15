import jwt from 'jsonwebtoken';
import { isProd } from './env.js';

const COOKIE = 'parer_token';
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

if (isProd && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production.');
}
const secret = process.env.JWT_SECRET || 'dev-only-secret-do-not-use-in-production';

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: isProd,
  path: '/',
};

export function startSession(res, user) {
  const token = jwt.sign({ sub: user.id, role: user.role }, secret, {
    algorithm: 'HS256',
    expiresIn: '30d',
  });
  res.cookie(COOKIE, token, { ...cookieOptions, maxAge: THIRTY_DAYS });
}

export function endSession(res) {
  res.clearCookie(COOKIE, cookieOptions);
}

// Reads the session cookie if there is one. Never blocks the request.
export function attachUser(req, _res, next) {
  const token = req.cookies?.[COOKIE];
  if (token) {
    try {
      const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
      req.user = { id: Number(payload.sub), role: payload.role };
    } catch {
      // expired or tampered token: treat as logged out
    }
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please log in to continue.' });
  next();
}

export const requireRole = (role) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Please log in to continue.' });
  if (req.user.role !== role) {
    return res.status(403).json({
      error: role === 'pro' ? 'Only professionals can do this.' : 'Only customers can do this.',
    });
  }
  next();
};
