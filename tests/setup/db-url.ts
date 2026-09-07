/** Separate database for tests so they can truncate freely. Override with TEST_DATABASE_URL. */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://wholesale:wholesale@localhost:55432/wholesale_test";
