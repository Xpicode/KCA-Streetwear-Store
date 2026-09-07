import { afterEach, describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth-hash";
import { signPayload, verifyPayload } from "@/lib/session-token";

describe("password hashing", () => {
  it("round-trips and salts", () => {
    const a = hashPassword("hunter22");
    const b = hashPassword("hunter22");
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt$")).toBe(true);
    expect(verifyPassword("hunter22", a)).toBe(true);
    expect(verifyPassword("hunter23", a)).toBe(false);
  });

  it("rejects malformed or missing hashes", () => {
    expect(verifyPassword("x", null)).toBe(false);
    expect(verifyPassword("x", "plaintext")).toBe(false);
    expect(verifyPassword("x", "scrypt$abc")).toBe(false);
  });
});

describe("signed tokens", () => {
  const original = process.env.AUTH_SECRET;
  afterEach(() => {
    process.env.AUTH_SECRET = original;
  });

  it("verifies what it signed", () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    const t = signPayload({ kind: "admin", id: 7, exp });
    expect(verifyPayload<{ id: number; exp: number }>(t)).toMatchObject({ id: 7, exp });
  });

  it("rejects tampering, expiry and garbage", () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    const t = signPayload({ id: 7, exp });
    const [data, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ id: 1, exp })).toString("base64url");
    expect(verifyPayload(`${forged}.${sig}`)).toBeNull();
    expect(verifyPayload(`${data}.${sig.slice(0, -1)}x`)).toBeNull();
    expect(verifyPayload(signPayload({ id: 7, exp: Math.floor(Date.now() / 1000) - 1 }))).toBeNull();
    expect(verifyPayload("not-a-token")).toBeNull();
    expect(verifyPayload(undefined)).toBeNull();
  });

  it("is signed by the secret", () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    const t = signPayload({ id: 7, exp });
    process.env.AUTH_SECRET = "another-secret-another-secret-another-secret";
    expect(verifyPayload(t)).toBeNull();
  });

  it("refuses a short secret", () => {
    process.env.AUTH_SECRET = "short";
    expect(() => signPayload({ exp: 1 })).toThrow(/32 characters/);
  });
});
