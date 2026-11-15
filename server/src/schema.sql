-- Parer database schema. Safe to run on every boot (all statements are idempotent).

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('customer', 'pro')),
  phone         TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pro_profiles (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  trade      TEXT NOT NULL,
  area       TEXT NOT NULL,
  bio        TEXT NOT NULL DEFAULT '',
  rate       TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jobs (
  id                SERIAL PRIMARY KEY,
  customer_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trade             TEXT NOT NULL,
  area              TEXT NOT NULL,
  description       TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed')),
  accepted_quote_id INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quotes (
  id         SERIAL PRIMARY KEY,
  job_id     INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  pro_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  price_ngn  INTEGER NOT NULL CHECK (price_ngn >= 0),
  message    TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, pro_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id          SERIAL PRIMARY KEY,
  job_id      INTEGER NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE,
  pro_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobs_status_trade ON jobs (status, trade);
CREATE INDEX IF NOT EXISTS idx_jobs_customer ON jobs (customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_job ON quotes (job_id);
CREATE INDEX IF NOT EXISTS idx_quotes_pro ON quotes (pro_id);
CREATE INDEX IF NOT EXISTS idx_reviews_pro ON reviews (pro_id);
CREATE INDEX IF NOT EXISTS idx_profiles_trade ON pro_profiles (trade);

-- Photos live in Postgres (bytea) so they survive redeploys on hosts with ephemeral disks.
-- job_id NULL means a professional's work-gallery photo; otherwise it belongs to that job.
CREATE TABLE IF NOT EXISTS photos (
  id         SERIAL PRIMARY KEY,
  owner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id     INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
  mime       TEXT NOT NULL,
  data       BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_photos_owner ON photos (owner_id) WHERE job_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_photos_job ON photos (job_id);

-- Avatar the person chose for themselves: 'woman', 'man' or 'initials' (the default).
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT NOT NULL DEFAULT 'initials';
