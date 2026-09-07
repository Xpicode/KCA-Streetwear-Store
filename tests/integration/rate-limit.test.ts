import { beforeEach, describe, expect, it } from "vitest";
import { clear, hit, retryAfter } from "@/lib/rate-limit";
import { resetDb } from "../helpers/fixtures";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(resetDb);

describe("rate limit (database-backed)", () => {
  it("allows up to the limit, then blocks", async () => {
    const rule = { limit: 3, windowMs: 60_000 };
    const key = "login:email:a@test.local";
    expect(await retryAfter(key, rule)).toBe(0);
    await hit(key, rule);
    await hit(key, rule);
    expect(await retryAfter(key, rule)).toBe(0);
    await hit(key, rule);
    const wait = await retryAfter(key, rule);
    expect(wait).toBeGreaterThan(50);
    expect(wait).toBeLessThanOrEqual(60);
  });

  it("starts a fresh window once the old one has passed", async () => {
    const rule = { limit: 2, windowMs: 40 };
    const key = "login:ip:1.2.3.4";
    await hit(key, rule);
    await hit(key, rule);
    expect(await retryAfter(key, rule)).toBe(1);
    await sleep(60);
    expect(await retryAfter(key, rule)).toBe(0);
    await hit(key, rule); // count restarts at 1, not 3
    expect(await retryAfter(key, rule)).toBe(0);
  });

  it("clear() forgets the key and keys are independent", async () => {
    const rule = { limit: 1, windowMs: 60_000 };
    await hit("a", rule);
    expect(await retryAfter("a", rule)).toBeGreaterThan(0);
    expect(await retryAfter("b", rule)).toBe(0);
    await clear("a");
    expect(await retryAfter("a", rule)).toBe(0);
  });
});
