import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { loadEnvLocal } from "./env";

loadEnvLocal();
// Supabase: migrations need a direct / session-mode connection, not the transaction pooler
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL missing — create .env.local first");

console.log("Connecting to", url.replace(/:\/\/([^:]+):[^@]*@/, "://$1:***@"));
const client = postgres(url, { max: 1 });

async function main() {
  try {
    await migrate(drizzle(client), { migrationsFolder: "./db/migrations" });
    console.log("Migrations applied.");
  } catch (e) {
    console.error("Migration failed:", e);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
