import { describe, expect, it } from "vitest";
import { assignedMessage, refereeAddedMessage, refereeRemovedMessage, unassignedMessage } from "../refereeMessages";

const match = {
  players: ["Ann Alpha", "Bob Bravo / Cat Charlie"] as [string, string],
  eventName: "Men's Doubles",
  stage: "Semifinals",
  tournamentName: "Spring Open",
  scheduleLabel: "Tue, Dec 1 · 9:00 AM · Court 3",
};

describe("referee messages", () => {
  it("tells a referee what, where and when they're officiating", () => {
    expect(assignedMessage(match)).toBe(
      "You've been assigned to officiate Ann Alpha vs Bob Bravo / Cat Charlie — Men's Doubles · Semifinals at Spring Open (Tue, Dec 1 · 9:00 AM · Court 3). After the toss, open it to choose the court and who serves first.",
    );
  });

  it("leaves out the schedule when there isn't one yet", () => {
    expect(assignedMessage({ ...match, scheduleLabel: null })).toBe(
      "You've been assigned to officiate Ann Alpha vs Bob Bravo / Cat Charlie — Men's Doubles · Semifinals at Spring Open. After the toss, open it to choose the court and who serves first.",
    );
  });

  it("says when an assignment is taken away", () => {
    expect(unassignedMessage(match)).toContain("You're no longer assigned to officiate Ann Alpha vs");
  });

  it("welcomes a new referee", () => {
    expect(refereeAddedMessage("Spring Open")).toContain("added as a referee for Spring Open");
  });

  it("explains a removal, counting the matches that were unassigned", () => {
    expect(refereeRemovedMessage("Spring Open", 0)).toBe("You've been removed as a referee for Spring Open.");
    expect(refereeRemovedMessage("Spring Open", 1)).toContain("Your 1 assigned match was unassigned.");
    expect(refereeRemovedMessage("Spring Open", 3)).toContain("Your 3 assigned matches were unassigned.");
  });
});
