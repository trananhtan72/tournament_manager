import { describe, expect, it } from "vitest";
import { entryScoreboardName, shortenPlayerName } from "../playerDisplay";

describe("shortenPlayerName", () => {
  it("keeps the first word and collapses the rest to initials", () => {
    expect(shortenPlayerName("Lee Chong Wei")).toBe("Lee C.W.");
  });

  it("handles a plain two-word name", () => {
    expect(shortenPlayerName("Viktor Axelsen")).toBe("Viktor A.");
  });

  it("returns a single-word name unchanged", () => {
    expect(shortenPlayerName("Taufik")).toBe("Taufik");
    expect(shortenPlayerName("Unknown")).toBe("Unknown");
  });

  it("collapses extra whitespace between words", () => {
    expect(shortenPlayerName("Lee   Chong   Wei")).toBe("Lee C.W.");
  });

  it("uppercases a lowercase initial", () => {
    expect(shortenPlayerName("Lee chong wei")).toBe("Lee C.W.");
  });
});

describe("entryScoreboardName", () => {
  it("shortens a singles entry's name and keeps the seed suffix", () => {
    const entry = { seed: 2, players: [{ guestName: "Lee Chong Wei", user: null }] };
    expect(entryScoreboardName(entry)).toBe("Lee C.W. [2]");
  });

  it("shortens every player in a doubles entry", () => {
    const entry = {
      seed: null,
      players: [
        { guestName: "Lee Chong Wei", user: null },
        { guestName: "Wong Bo Han", user: null },
      ],
    };
    expect(entryScoreboardName(entry)).toBe("Lee C.W. / Wong B.H.");
  });

  it("omits the seed suffix for an unseeded entry", () => {
    const entry = { seed: null, players: [{ guestName: "Viktor Axelsen", user: null }] };
    expect(entryScoreboardName(entry)).toBe("Viktor A.");
  });
});
