import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * App database client.
 *
 * DATABASE_URL should be the *pooled* connection in production — on Supabase, the
 * "Transaction" pooler (port 6543). `prepare: false` is required for that mode. Migrations
 * and scripts use DIRECT_URL instead (see db/migrate.ts). Keep the pool small on serverless
 * hosts: every function instance opens its own (DB_POOL_MAX, default 5).
 */
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
}

const client = postgres(process.env.DATABASE_URL, {
  prepare: false,
  max: Number(process.env.DB_POOL_MAX ?? 5),
});

export const db = drizzle(client, { schema });
