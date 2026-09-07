# KCA Streetwear — Wholesale System

Inventory, profit tracking, and an online order-request storefront for KCA Streetwear.
Built with Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Drizzle ORM, and PostgreSQL.

## Getting started

```bash
docker compose up -d     # start the local Postgres 16 database (host port 55432)
npm install
cp .env.example .env.local   # then fill in AUTH_SECRET (see the file for a generator)
npm run db:setup         # create tables + load sample data (WIPES existing data; local databases only)
npm run dev              # http://localhost:3000
```

## Accounts (sample data)

Created by `npm run db:setup`. **Change these in Settings before going live** — the seed
prints a warning and refuses to run against anything that isn't a local database.

| Role  | Where to sign in | Email               | Password   |
| ----- | ---------------- | ------------------- | ---------- |
| Owner | `/admin/login`   | `owner@example.com` | `admin123` |
| Staff | `/admin/login`   | `staff@example.com` | `staff123` |

The owner sees everything including Settings; staff can run products, stock, and orders.
**Buyers need no account** — the shop at `/shop` is open to everyone. Checkout asks for
shop name, contact number, and address; the device that placed an order is remembered so
"My orders" works there, and anyone can open one order with its number + phone.

## Pages

| URL            | What it is                                                       |
| -------------- | ---------------------------------------------------------------- |
| `/`            | Public landing page                                              |
| `/shop`        | Catalog → cart → order request (no account, no online payment)   |
| `/shop/orders` | Buyer's orders (remembered per device, or order no. + phone)     |
| `/admin`       | Dashboard: profit today / this week / this month                 |
| `/admin/...`   | Products, stock-in, orders pipeline, customers, reports, settings|

The admin works on phones and tablets (menu in the top bar) as well as desktop.

## Scripts

| Command               | What it does                                            |
| --------------------- | ------------------------------------------------------- |
| `npm run dev`         | Development server                                      |
| `npm run build`       | Production build (then `npm start`)                     |
| `npm test`            | Unit + integration tests (needs the Docker database)    |
| `npm run lint`        | ESLint                                                  |
| `npm run db:migrate`  | Create/update tables from `db/migrations`               |
| `npm run db:seed`     | Load sample data (wipes all tables first; local only)   |
| `npm run db:setup`    | Both of the above                                       |
| `npm run db:generate` | Make a new migration after editing `db/schema.ts`       |
| `npm run db:studio`   | Browse the database in Drizzle Studio                   |

Connection settings live in `.env.local` (`DATABASE_URL`, `AUTH_SECRET`).

## Tests

`npm test` runs [Vitest](https://vitest.dev). Unit tests cover pricing tiers, profit,
password hashing, signed tokens and the login rate limit. Integration tests run the real
order pipeline (create → confirm → pack → pay → deliver, cancel, delete, FIFO cost
snapshots) and storefront cart rules against a separate `wholesale_test` database on the
Docker Postgres — it is created and migrated automatically on the first run and truncated
between tests, so dev data is never touched.

## Security notes

- **Admin access**: `proxy.ts` turns away any `/admin/*` request without a valid signed
  session before page code runs; every admin page and server action also calls
  `requireAdmin()` and checks the user against the database. Owner-only actions
  (settings, deleting orders) check the role server-side.
- **Sessions**: HMAC-signed, `httpOnly`, `secure` in production, 14-day expiry. Signed
  with `AUTH_SECRET` (≥ 32 chars) — rotate it to sign everyone out.
- **Passwords**: scrypt with per-user salt. Sign-in is rate-limited (5 failed attempts
  per email / 15 min, 30 per IP). Counters are in-memory, i.e. per server process.
- **Headers**: a per-request nonce Content-Security-Policy, `X-Frame-Options: DENY`,
  `nosniff`, referrer and permissions policies, HSTS.
- **Storefront identity**: a buyer is matched to an existing customer by phone number
  only when ordering from the device that already placed orders for that customer.
  From a new device the order is still linked, but the profile on file is not changed,
  standard pricing applies and the order note is flagged for review.
- **Seeding**: `db:seed` refuses non-local databases and `NODE_ENV=production` unless
  `ALLOW_SEED=yes`, because it wipes every table and installs public sample passwords.

## Deploying

Product photos are written to `public/uploads/products/` and served as static files, so
the app needs a host with a **persistent disk**: a VPS or a Docker host (run
`npm run build && npm start` behind nginx/Caddy with HTTPS, set `NODE_ENV=production`,
`DATABASE_URL`, `AUTH_SECRET`). Serverless platforms such as Vercel have a read-only,
non-persistent filesystem — to deploy there, move uploads to object storage (S3, R2,
Vercel Blob) first. HTTPS is required in production: session cookies are `secure` and the
CSP upgrades insecure requests.

## Where things live

```
app/            pages: landing, admin/(app), shop/(store)
actions/        server actions (orders, stock, customers, settings, auth)
lib/            business rules: orders pipeline, pricing, stock, auth, rate limit, brand
lib/queries/    read queries for every screen
db/             schema, migrations, seed, client
components/     ui primitives, admin + shop + landing components
proxy.ts        edge auth gate + CSP nonce (runs before every page)
tests/          vitest unit + integration tests
public/landing/ landing page artwork (swap for real photos)
```

## Design system

One system: Tailwind utilities on the **zinc** scale for surfaces and text, and a single
**brand** accent scale (`bg-brand-700`, `text-brand-800`, …) defined once in
`app/globals.css`. To rebrand, replace that `--color-brand-*` block (and the dark-mode
values in the same file). Dark mode is a palette swap inside `.theme-zone` (admin, shop,
login); the landing page stays light. Brand name and contact details: `lib/brand.ts`.

## Key business rules

- Order flow: pending → confirmed (stock reserved) → packed (stock deducted, cost
  snapshotted) → paid → delivered (profit counts on this date). Cancelling releases stock.
- Profit per line = (unit price − unit cost) × qty, frozen at packing time; unit cost is
  the FIFO blend of the stock batches actually consumed.
- Wholesale tiers: quantity discounts per style, optionally per price group; minimum
  order quantity per style.
