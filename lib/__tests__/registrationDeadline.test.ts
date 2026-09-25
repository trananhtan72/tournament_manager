import { describe, expect, it } from "vitest";
import {
  effectiveWithdrawalDeadline,
  registrationIsOpen,
  registrationStatus,
  withdrawalIsOpen,
} from "../registrationDeadline";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const at = (iso: string) => new Date(iso);

describe("registrationIsOpen", () => {
  const deadline = d("2026-11-25");

  it("stays open through the whole deadline day", () => {
    expect(registrationIsOpen(deadline, at("2026-11-25T00:00:00.000Z"))).toBe(true);
    expect(registrationIsOpen(deadline, at("2026-11-25T23:59:59.000Z"))).toBe(true);
  });

  it("closes when the deadline day is over", () => {
    expect(registrationIsOpen(deadline, at("2026-11-26T00:00:00.000Z"))).toBe(false);
  });
});

describe("registrationStatus", () => {
  const base = { registrationDeadline: d("2026-11-25") };

  it("is open straight away when there is no opens date", () => {
    expect(registrationStatus({ ...base, registrationOpensAt: null }, at("2026-01-01T00:00:00.000Z"))).toBe("open");
  });

  it("is not open before the opens date, and open from the start of that day", () => {
    const t = { ...base, registrationOpensAt: d("2026-10-01") };
    expect(registrationStatus(t, at("2026-09-30T23:59:59.000Z"))).toBe("not_open");
    expect(registrationStatus(t, at("2026-10-01T00:00:00.000Z"))).toBe("open");
  });

  it("is closed after the deadline day", () => {
    const t = { ...base, registrationOpensAt: d("2026-10-01") };
    expect(registrationStatus(t, at("2026-11-25T12:00:00.000Z"))).toBe("open");
    expect(registrationStatus(t, at("2026-11-26T00:00:00.000Z"))).toBe("closed");
  });
});

describe("withdrawal deadline", () => {
  it("defaults to the registration deadline", () => {
    const t = { registrationDeadline: d("2026-11-25"), withdrawalDeadline: null };
    expect(effectiveWithdrawalDeadline(t)).toEqual(d("2026-11-25"));
    expect(withdrawalIsOpen(t, at("2026-11-25T20:00:00.000Z"))).toBe(true);
    expect(withdrawalIsOpen(t, at("2026-11-26T00:00:00.000Z"))).toBe(false);
  });

  it("can run past the registration deadline", () => {
    const t = { registrationDeadline: d("2026-11-25"), withdrawalDeadline: d("2026-11-28") };
    expect(effectiveWithdrawalDeadline(t)).toEqual(d("2026-11-28"));
    expect(withdrawalIsOpen(t, at("2026-11-27T10:00:00.000Z"))).toBe(true);
    expect(withdrawalIsOpen(t, at("2026-11-29T00:00:00.000Z"))).toBe(false);
  });
});
