// Loads environment variables from a .env file (repo root or server/) when present.
// On Render there is no .env file; variables come from the dashboard / render.yaml.
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, '../../.env') });
dotenv.config({ path: path.resolve(here, '../.env') });

export const isProd = process.env.NODE_ENV === 'production';
