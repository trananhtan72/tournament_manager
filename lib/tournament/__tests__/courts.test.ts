import { describe, expect, it } from "vitest";
import { courtName, courtNumbers, parseCourtNumber, toCourtNumber } from "../courts";

describe("court names", () => {
  it("names courts 'Court N'", () => {
    expect(courtName(1)).toBe("Court 1");
    expect(courtName(12)).toBe("Court 12");
  });

  it("reads the number back from a court name, whatever the case or spacing", () => {
    expect(parseCourtNumber("Court 3")).toBe(3);
    expect(parseCourtNumber("court 12")).toBe(12);
    expect(parseCourtNumber("  COURT   7 ")).toBe(7);
    expect(parseCourtNumber("Court3")).toBe(3);
  });

  it("returns null for free-text courts and junk", () => {
    for (const bad of ["Centre court", "Court", "Court 0", "Court -1", "3", "Court 3b", "", "  "]) {
      expect(parseCourtNumber(bad)).toBeNull();
    }
    expect(parseCourtNumber(null)).toBeNull();
    expect(parseCourtNumber(undefined)).toBeNull();
  });

  it("round-trips with courtName", () => {
    for (const n of [1, 9, 10, 50]) expect(parseCourtNumber(courtName(n))).toBe(n);
  });
});

describe("courtNumbers / toCourtNumber", () => {
  it("lists 1..count", () => {
    expect(courtNumbers(3)).toEqual([1, 2, 3]);
    expect(courtNumbers(0)).toEqual([]);
    expect(courtNumbers(12)).toHaveLength(12);
  });

  it("accepts a whole number within the tournament's courts", () => {
    expect(toCourtNumber("1", 12)).toBe(1);
    expect(toCourtNumber("12", 12)).toBe(12);
    expect(toCourtNumber(5, 12)).toBe(5);
  });

  it("rejects out-of-range and non-numeric values", () => {
    for (const bad of ["0", "13", "-1", "1.5", "abc", "", " ", "3 4"]) expect(toCourtNumber(bad, 12)).toBeNull();
    expect(toCourtNumber(null, 12)).toBeNull();
    expect(toCourtNumber(undefined, 12)).toBeNull();
    expect(toCourtNumber(13, 12)).toBeNull();
    expect(toCourtNumber(2.5, 12)).toBeNull();
  });
});
