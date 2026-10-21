import { describe, expect, it } from "vitest";
import { generateResetToken, hashResetToken } from "../passwordReset";

describe("generateResetToken", () => {
  it("returns a 64-character hex string (32 random bytes)", () => {
    const token = generateResetToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns a different token every call", () => {
    const a = generateResetToken();
    const b = generateResetToken();
    expect(a).not.toBe(b);
  });
});

describe("hashResetToken", () => {
  it("is deterministic — the same raw token always hashes the same way", () => {
    const raw = generateResetToken();
    expect(hashResetToken(raw)).toBe(hashResetToken(raw));
  });

  it("produces a different hash for a different token", () => {
    expect(hashResetToken(generateResetToken())).not.toBe(hashResetToken(generateResetToken()));
  });

  it("never just returns the raw token back (the whole point of hashing it)", () => {
    const raw = generateResetToken();
    expect(hashResetToken(raw)).not.toBe(raw);
  });

  it("returns a 64-character hex string (SHA-256)", () => {
    expect(hashResetToken("anything")).toMatch(/^[0-9a-f]{64}$/);
  });
});
