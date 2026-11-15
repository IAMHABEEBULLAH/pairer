# Parer

**Skilled people. Trusted work.**

Parer connects households and businesses with trusted local professionals (electricians, plumbers, carpenters, mechanics, tutors, cleaners and more), and gives those professionals a profile, reviews and a way to win work.

Full stack in one repo: a React app (`client/`) and a Node + Express + PostgreSQL API (`server/`). In production the server also serves the built React app, so it deploys as a single Render web service.

## What it does

**Customers** describe a problem (the job assistant suggests the right trade), attach up to 3 photos, post a job, compare quotes, accept one, mark the job complete, and leave a review.

**Professionals** create a profile with a work-photo gallery (up to 8 photos), browse open jobs, send quotes, and collect reviews.

**Everyone** can search professionals by trade, name or area, and browse the open jobs board.

Privacy by design: pro phone numbers are visible to logged-in users only, and a customer's phone number is shared only with the pro whose quote they accept.

## Tech

| Part | Choice |
|---|---|
| Frontend | React 18, React Router, Vite |
| Backend | Node 20+, Express 4, `pg`, Zod validation |
| Database | PostgreSQL (schema in `server/src/schema.sql`, applied automatically on boot) |
| Auth | Email and password (bcrypt), signed JWT in an httpOnly cookie |
| Photos | Shrunk in the browser (max 1280px JPEG), stored in Postgres so they survive redeploys |
| Security | Helmet (CSP), rate limiting, input validation, parameterised SQL |
| Job assistant | Keyword matcher by default; real AI (Claude) if `ANTHROPIC_API_KEY` is set |

## Run it locally

You need Node.js 20 or newer and a PostgreSQL database.

```bash
# 1. install everything (client and server)
npm install

# 2. create a database and your env file
createdb parer
cp .env.example .env        # then edit DATABASE_URL and JWT_SECRET

# 3. (optional) add demo data: 5 sample pros, password demo1234
npm run seed

# 4. start the API (port 3000) and the React dev server (port 5173)
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to the server, so cookies work exactly as in production.

Check the API end to end (with the server running):

```bash
npm run test:smoke -w server     # set BASE_URL=http://localhost:3000 if needed
```

## Put it on GitHub

```bash
git init
git add .
git commit -m "Initial commit: Parer"
git branch -M main
git remote add origin https://github.com/<your-username>/parer.git
git push -u origin main
```

`.env` is git-ignored, so your secrets stay off GitHub. Only `.env.example` is committed.

## Deploy on Render

**Option A: Blueprint (fastest).** `render.yaml` creates the web service and the Postgres database together.

1. Push the repo to GitHub (above).
2. In Render: **New > Blueprint**, pick the repo, and click **Apply**.
3. When prompted for `ANTHROPIC_API_KEY`, paste a key to enable the real AI assistant, or leave it blank to use keyword matching.
4. Wait for the first deploy to finish. Open the `.onrender.com` URL.

`JWT_SECRET` is generated for you and `DATABASE_URL` is wired to the database automatically.

**Option B: by hand.**

1. **New > PostgreSQL**, create a database, and copy its **Internal Database URL**.
2. **New > Web Service**, pick the repo, then set:
   - Build command: `npm ci --include=dev && npm run build`
   - Start command: `npm start`
   - Health check path: `/api/health`
3. Add environment variables: `NODE_ENV=production`, `NODE_VERSION=22`, `DATABASE_URL` (the URL from step 1), `JWT_SECRET` (a long random string), and optionally `ANTHROPIC_API_KEY`.

### Things to know about Render's free plan

Check Render's current pricing page, because free-plan terms change.

- The free web service goes to sleep when idle, so the first visit after a quiet period is slow (about a minute).
- The free Postgres database has an expiry. When it expires, the data is deleted. Upgrade the database before you have real users, or export your data.
- Use a paid plan for both before you launch publicly.

## Environment variables

| Name | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `JWT_SECRET` | yes in production | Signs login cookies. The server refuses to start without it |
| `NODE_ENV` | on Render | Set to `production` |
| `ANTHROPIC_API_KEY` | no | Enables the real AI job assistant |
| `ANTHROPIC_MODEL` | no | Model for the assistant (default `claude-haiku-5-5`) |
| `PGSSL` | no | `true` or `false` to force database TLS. Default: on in production, off in development |
| `PORT` | no | Defaults to 3000. Render sets it for you |

## Project structure

```
parer/
  render.yaml            Render Blueprint (web service + Postgres)
  .env.example           copy to .env for local development
  package.json           npm workspaces: client + server
  client/                React app (Vite)
    src/pages/           Home, Pros, ProDetail, Jobs, JobDetail, PostJob, Dashboard, Login/Register
    src/components/      Nav, Footer, cards, form field, route guard
    src/auth.jsx         session context
    src/api.js           fetch wrapper
  server/
    src/index.js         app setup, security, static serving
    src/routes/          auth, pros, jobs, assistant
    src/schema.sql       database tables
    src/seed.js          demo data (development only)
    test/smoke.mjs       end-to-end API test
```

## API at a glance

| Method and path | Who | What |
|---|---|---|
| `POST /api/auth/register`, `/login`, `/logout`; `GET /api/auth/me` | anyone / logged in | Accounts |
| `GET /api/pros`, `GET /api/pros/:id` | anyone | Search and view professionals |
| `PUT /api/pros/me` | pro | Create or update my profile |
| `GET /api/jobs`, `GET /api/jobs/:id` | anyone | Open jobs board and job detail |
| `GET /api/jobs/mine` | logged in | My jobs (customer) or my quotes (pro) |
| `POST /api/jobs` | customer | Post a job |
| `POST /api/jobs/:id/quotes` | pro | Send or update a quote |
| `POST /api/jobs/:id/accept`, `/complete`, `/review` | customer | Accept a quote, finish the job, review the pro |
| `POST /api/photos` (`?jobId=` for job photos), `DELETE /api/photos/:id` | pro / customer | Upload a work photo or a job photo, delete your own |
| `GET /api/photos/:id` | anyone | Serve a photo |
| `POST /api/assistant` | anyone | Suggest a trade from a plain-language description |
| `GET /api/health` | anyone | Health check |

## Photos and storage

Photos are stored in the Postgres database, not on the web server's disk, because Render's disk is wiped on every deploy. This is simple and fine for an early product. Browsers shrink each photo first, so a typical photo is 100 to 500 KB. If you grow to thousands of photos, move them to object storage such as Cloudinary or S3 and keep only the link in the database.

## Not built yet

Payments and escrow, identity verification, notifications (SMS or email), password reset, and admin tools. Each is a natural next step, and payments is the most important one before charging customers.

## Brand

Ink `#132B22`, Paper `#F4F1E6`, Green `#2E7D4E`, Lime `#8FC93F`, Amber `#E8A33D`. Fjalla One for headings, Inter for body text.

Before launch, check that the Parer name is free as a domain (.com and .ng) and on social media, and run a trademark search with the Corporate Affairs Commission.
