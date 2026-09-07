import { defineConfig } from "drizzle-kit";
import { loadEnvLocal } from "./db/env";

loadEnvLocal();

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Supabase: drizzle-kit needs the direct / session-mode connection, not the transaction pooler
    url: (process.env.DIRECT_URL ?? process.env.DATABASE_URL)!,
  },
});
