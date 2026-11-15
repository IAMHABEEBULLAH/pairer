import { z } from 'zod';

// Express 4 does not catch rejected promises from async handlers; this does.
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n < 2_147_483_647 ? n : null;
}

// Escape % and _ so user text is matched literally inside ILIKE.
export const likePattern = (text) => `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[+0-9()\s-]{7,20}$/, 'Enter a valid phone number, for example 08012345678.');

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
