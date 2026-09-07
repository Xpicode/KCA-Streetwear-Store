import { describe, expect, it } from "vitest";
import { clear, hit, retryAfter } from "@/lib/rate-limit";

const rule = { limit: 3, windowMs: 60_000 };

describe("rate limit", () => {
  it("allows up to the limit, then blocks until the window ends", () => {
    const key = `t:${Math.random()}`;
    const t0 = 1_000_000;
    expect(retryAfter(key, rule, t0)).toBe(0);
    hit(key, rule, t0);
    hit(key, rule, t0 + 1000);
    expect(retryAfter(key, rule, t0 + 2000)).toBe(0);
    hit(key, rule, t0 + 2000);
    expect(retryAfter(key, rule, t0 + 2000)).toBe(58);
    expect(retryAfter(key, rule, t0 + 60_000)).toBe(0);
  });

  it("clear() forgets the key", () => {
    const key = `t:${Math.random()}`;
    for (let i = 0; i < 5; i++) hit(key, rule, 5000);
    expect(retryAfter(key, rule, 5000)).toBeGreaterThan(0);
    clear(key);
    expect(retryAfter(key, rule, 5000)).toBe(0);
  });

  it("keys are independent", () => {
    const a = `a:${Math.random()}`;
    const b = `b:${Math.random()}`;
    for (let i = 0; i < 3; i++) hit(a, rule, 1);
    expect(retryAfter(a, rule, 1)).toBeGreaterThan(0);
    expect(retryAfter(b, rule, 1)).toBe(0);
  });
});
