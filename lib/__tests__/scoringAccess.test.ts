import { describe, expect, it } from "vitest";
import { isPlayerInMatch, mayRecordResult, scoringRole } from "../scoringAccess";

describe("scoringRole", () => {
  const match = { organizerId: "org", refereeUserId: "ref" };

  it("lets the organizer score any match", () => {
    expect(scoringRole("org", match)).toBe("organizer");
    expect(scoringRole("org", { organizerId: "org", refereeUserId: null })).toBe("organizer");
  });

  it("lets the assigned referee score it", () => {
    expect(scoringRole("ref", match)).toBe("referee");
  });

  it("refuses everyone else, including another referee and a signed-out visitor", () => {
    expect(scoringRole("someone", match)).toBeNull();
    expect(scoringRole("other-ref", match)).toBeNull();
    expect(scoringRole("", match)).toBeNull();
  });

  it("gives nobody referee rights on an unassigned match", () => {
    expect(scoringRole("ref", { organizerId: "org", refereeUserId: null })).toBeNull();
  });

  it("treats an organizer who is also the referee as the organizer", () => {
    expect(scoringRole("org", { organizerId: "org", refereeUserId: "org" })).toBe("organizer");
  });
});

describe("mayRecordResult", () => {
  it("lets the organizer record or replace a result any time", () => {
    expect(mayRecordResult("organizer", false)).toBe(true);
    expect(mayRecordResult("organizer", true)).toBe(true);
  });

  it("lets a referee record a result, but not change a saved one", () => {
    expect(mayRecordResult("referee", false)).toBe(true);
    expect(mayRecordResult("referee", true)).toBe(false);
  });
});

describe("isPlayerInMatch", () => {
  it("spots a referee who is one of the players", () => {
    expect(isPlayerInMatch("u1", ["u2", "u1", null])).toBe(true);
  });

  it("is false for someone else, and ignores walk-in players with no account", () => {
    expect(isPlayerInMatch("u1", ["u2", null, null])).toBe(false);
    expect(isPlayerInMatch("u1", [])).toBe(false);
  });
});
