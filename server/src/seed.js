// Demo data for local development only: npm run seed
// Creates sample accounts (password: demo1234). Never run this against a real production database.
import './env.js';
import bcrypt from 'bcryptjs';
import { pool, migrate, query } from './db.js';
import { isProd } from './env.js';

if (isProd && process.env.ALLOW_SEED !== 'true') {
  console.error('Refusing to seed in production. Set ALLOW_SEED=true if you really mean it.');
  process.exit(1);
}

const hash = await bcrypt.hash('demo1234', 10);
await migrate();

const pros = [
  ['Musa Ibrahim', 'musa@demo.parer', '08011111111', 'Electrician', 'Kaduna North', 'Wiring, sockets, inverters and generator changeover. 8 years on residential jobs.', 'From ₦5,000'],
  ['Amina Yusuf', 'amina@demo.parer', '08022222222', 'Plumber', 'Garki, Abuja', 'Leaks, tanks, boreholes and bathroom fittings. Neat work, on time.', '₦6,000 per visit'],
  ['Chidi Okafor', 'chidi@demo.parer', '08033333333', 'Carpenter', 'Wuse 2, Abuja', 'Wardrobes, doors and custom furniture.', 'Quote per job'],
  ['Halima Bello', 'halima@demo.parer', '08044444444', 'Tutor', 'Barnawa, Kaduna', 'Primary and JSS maths and English, WAEC prep.', '₦3,000 per lesson'],
  ['Tunde Adeyemi', 'tunde@demo.parer', '08055555555', 'Mechanic', 'Ikeja, Lagos', 'Cars and generators. Diagnosis first, honest quotes.', 'From ₦4,000'],
];

for (const [name, email, phone, trade, area, bio, rate] of pros) {
  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash, role, phone) VALUES ($1, $2, $3, 'pro', $4)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    [name, email, hash, phone]
  );
  await query(
    `INSERT INTO pro_profiles (user_id, trade, area, bio, rate) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO NOTHING`,
    [rows[0].id, trade, area, bio, rate]
  );
}

await query(
  `INSERT INTO users (name, email, password_hash, role, phone) VALUES ('Demo Customer', 'customer@demo.parer', $1, 'customer', '08099999999')
   ON CONFLICT (email) DO NOTHING`,
  [hash]
);

console.log('Seeded 5 demo pros and 1 demo customer. Log in with any @demo.parer email and password demo1234.');
await pool.end();
