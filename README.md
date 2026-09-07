# KCA Streetwear — Wholesale System

Inventory, profit tracking, and an online order-request storefront for KCA Streetwear.
Built with Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Drizzle ORM, and PostgreSQL.

## Getting started

```bash
docker compose up -d     # start the local Postgres 16 database (host port 55432)
npm install
npm run db:setup         # create tables + load sample data (WIPES existing data)
npm run dev              # http://localhost:3000
```

## Accounts (sample data)

Created by `npm run db:setup`. **Change these before going live.**

| Role  | Where to sign in       | Email               | Password   |
| ----- | ---------------------- | ------------------- | ---------- |
| Owner | `/admin/login`         | `owner@example.com` | `admin123` |
| Staff | `/admin/login`         | `staff@example.com` | `staff123` |

The owner sees everything including Settings; staff can run products, stock, and orders.
**Buyers need no account** — the shop at `/shop` is open to everyone. Checkout asks for
shop name, contact number, and address; repeat buyers are matched by phone number.

## Pages

| URL            | What it is                                                       |
| -------------- | ---------------------------------------------------------------- |
| `/`            | Public landing page                                              |
| `/shop`        | Catalog → cart → order request (no account, no online payment)   |
| `/shop/orders` | Buyer's orders (remembered per device, or order no. + phone)     |
| `/admin`       | Dashboard: profit today / this week / this month                 |
| `/admin/...`   | Products, stock-in, orders pipeline, customers, reports, settings|

## Database scripts

| Command               | What it does                                            |
| --------------------- | ------------------------------------------------------- |
| `npm run db:migrate`  | Create/update tables from `db/migrations`               |
| `npm run db:seed`     | Load sample data (wipes all tables first)               |
| `npm run db:setup`    | Both of the above                                       |
| `npm run db:generate` | Make a new migration after editing `db/schema.ts`       |
| `npm run db:studio`   | Browse the database in Drizzle Studio                   |

Connection settings live in `.env.local` (`DATABASE_URL`, `AUTH_SECRET`).

## Where things live

```
app/            pages: landing, admin/(app), shop/(store)
actions/        server actions (orders, stock, customers, settings, auth)
lib/            business rules: orders pipeline, pricing, stock, auth, brand
lib/queries/    read queries for every screen
db/             schema, migrations, seed, client
components/     ui primitives, admin + shop + landing components
public/landing/ landing page artwork (swap for real photos)
```

Brand name and contact details: `lib/brand.ts`.

## Key business rules

- Order flow: pending → confirmed (stock reserved) → packed (stock deducted, cost
  snapshotted) → delivered (profit counts on this date) → paid. Cancelling releases stock.
- Profit per line = (unit price − unit cost) × qty, frozen at packing time.
- Wholesale tiers: quantity discounts per style; minimum order quantity per style.
