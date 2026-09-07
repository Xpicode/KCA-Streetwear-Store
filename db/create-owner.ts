/**
 * Creates the owner account on a real database (or resets its password). Use this instead
 * of db:seed in production — the seed installs public sample logins and wipes every table.
 *
 *   OWNER_EMAIL=you@yourshop.com OWNER_PASSWORD='a long password' OWNER_NAME='Kian' npm run db:create-owner
 *
 * Uses DIRECT_URL when set (Supabase: the session-mode / direct connection), else DATABASE_URL.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { loadEnvLocal } from "./env";
import * as s from "./schema";
import { hashPassword } from "../lib/auth-hash";

loadEnvLocal();
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL missing — create .env.local first");

function readInputs(): { email: string; password: string; name: string | undefined } {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase() ?? "";
  const password = process.env.OWNER_PASSWORD ?? "";
  const name = process.env.OWNER_NAME?.trim() || undefined;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("Set OWNER_EMAIL to a valid email address.");
    process.exit(1);
  }
  if (password.length < 10) {
    console.error("Set OWNER_PASSWORD to at least 10 characters.");
    process.exit(1);
  }
  return { email, password, name };
}
const { email, password, name } = readInputs();

const client = postgres(url, { max: 1 });
const db = drizzle(client, { schema: s });

async function main() {
  const passwordHash = hashPassword(password);
  const [row] = await db
    .insert(s.users)
    .values({ name: name ?? "Owner", email, passwordHash, role: "owner" })
    // an existing account keeps its name unless OWNER_NAME was given
    .onConflictDoUpdate({ target: s.users.email, set: { passwordHash, role: "owner", ...(name ? { name } : {}) } })
    .returning({ id: s.users.id });
  console.log(`Owner account ready: ${email} (user #${row.id}). Sign in at /admin/login.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.end());
