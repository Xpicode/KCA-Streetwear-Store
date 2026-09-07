import path from "node:path";
import { defineConfig } from "vitest/config";
import { TEST_DATABASE_URL } from "./tests/setup/db-url";

/**
 * Unit tests are plain. Integration tests (tests/integration) run against a separate
 * `wholesale_test` database on the local Docker Postgres — created and migrated by
 * tests/setup/global.ts — and truncate it between tests, so they never touch dev data.
 * Start the database first:  docker compose up -d
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(process.cwd()),
      // `import "server-only"` throws outside React Server Components; stub it for tests
      "server-only": path.resolve(process.cwd(), "tests/setup/server-only.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/setup/global.ts"],
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      AUTH_SECRET: "vitest-only-secret-not-for-real-use-0123456789",
    },
    // integration tests share one database
    fileParallelism: false,
  },
});
