import { describe, expect, it } from "vitest";
import { canCreateTournaments, isAdminEmail } from "../roles";

describe("isAdminEmail", () => {
  it("matches the administrator's email regardless of case or surrounding space", () => {
    expect(isAdminEmail("tea@gmail.com")).toBe(true);
    expect(isAdminEmail("Tea@gmail.com")).toBe(true);
    expect(isAdminEmail("  TEA@GMAIL.COM  ")).toBe(true);
  });

  it("rejects anyone else", () => {
    expect(isAdminEmail("ann@example.com")).toBe(false);
    expect(isAdminEmail("tea@gmail.com.evil.com")).toBe(false);
  });
});

describe("canCreateTournaments", () => {
  it("allows ADMIN and ORGANIZER accounts", () => {
    expect(canCreateTournaments("ADMIN")).toBe(true);
    expect(canCreateTournaments("ORGANIZER")).toBe(true);
  });

  it("disallows a plain USER", () => {
    expect(canCreateTournaments("USER")).toBe(false);
  });
});
