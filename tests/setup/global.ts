/** Runs once before the suite: create the test database if needed and bring it up to date. */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { TEST_DATABASE_URL } from "./db-url";

export default async function setup() {
  const url = new URL(TEST_DATABASE_URL);
  const dbName = url.pathname.slice(1);

  const admin = postgres(new URL("/postgres", url).toString(), { max: 1 });
  try {
    const exists = await admin`select 1 from pg_database where datname = ${dbName}`;
    if (exists.length === 0) await admin.unsafe(`create database "${dbName}"`);
  } catch (e) {
    throw new Error(
      `Could not reach Postgres at ${url.host} to prepare "${dbName}". Start it with:  docker compose up -d\n${(e as Error).message}`
    );
  } finally {
    await admin.end();
  }

  const client = postgres(TEST_DATABASE_URL, { max: 1 });
  try {
    await migrate(drizzle(client), { migrationsFolder: "./db/migrations" });
  } finally {
    await client.end();
  }
}
