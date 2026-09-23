import { describe, it, expect } from "vitest";
import { isValidGameScore, validateCompletedMatch } from "../scoring";

describe("isValidGameScore", () => {
  it("accepts a direct win at 21 with the loser at 19 or below", () => {
    expect(isValidGameScore(21, 0)).toBe(true);
    expect(isValidGameScore(21, 19)).toBe(true);
    expect(isValidGameScore(19, 21)).toBe(true);
  });

  it("rejects 21 with the loser at 20 (impossible in rally scoring)", () => {
    expect(isValidGameScore(21, 20)).toBe(false);
    expect(isValidGameScore(20, 21)).toBe(false);
  });

  it("rejects an unfinished game", () => {
    expect(isValidGameScore(20, 18)).toBe(false);
    expect(isValidGameScore(0, 0)).toBe(false);
  });

  it("rejects a tie", () => {
    expect(isValidGameScore(20, 20)).toBe(false);
    expect(isValidGameScore(29, 29)).toBe(false);
  });

  it("requires exactly a 2-point margin between 22 and 29, with the loser at 20+", () => {
    expect(isValidGameScore(22, 20)).toBe(true);
    expect(isValidGameScore(29, 27)).toBe(true);
    expect(isValidGameScore(25, 24)).toBe(false); // 1-point margin, not a stopping point
    expect(isValidGameScore(23, 20)).toBe(false); // 3-point margin, skipped a stopping point
  });

  it("caps at 30, valid only with the loser at 28 or 29", () => {
    expect(isValidGameScore(30, 29)).toBe(true);
    expect(isValidGameScore(30, 28)).toBe(true);
    expect(isValidGameScore(30, 27)).toBe(false);
    expect(isValidGameScore(31, 29)).toBe(false);
  });

  it("rejects negative or non-integer scores", () => {
    expect(isValidGameScore(-1, 21)).toBe(false);
    expect(isValidGameScore(21.5, 19)).toBe(false);
  });
});

describe("validateCompletedMatch", () => {
  it("decides the match 2-0 without needing a third game", () => {
    const result = validateCompletedMatch([
      { entry1Score: 21, entry2Score: 15 },
      { entry1Score: 21, entry2Score: 18 },
      null,
    ]);
    expect(result).toEqual({ valid: true, winnerSide: 1 });
  });

  it("rejects a third game when the match was already decided 2-0", () => {
    const result = validateCompletedMatch([
      { entry1Score: 21, entry2Score: 15 },
      { entry1Score: 21, entry2Score: 18 },
      { entry1Score: 21, entry2Score: 10 },
    ]);
    expect(result.valid).toBe(false);
  });

  it("requires a third game when split 1-1", () => {
    const result = validateCompletedMatch([
      { entry1Score: 21, entry2Score: 15 },
      { entry1Score: 18, entry2Score: 21 },
      null,
    ]);
    expect(result.valid).toBe(false);
  });

  it("decides the match from game 3 when split 1-1", () => {
    const result = validateCompletedMatch([
      { entry1Score: 21, entry2Score: 15 },
      { entry1Score: 18, entry2Score: 21 },
      { entry1Score: 21, entry2Score: 19 },
    ]);
    expect(result).toEqual({ valid: true, winnerSide: 1 });
    const result2 = validateCompletedMatch([
      { entry1Score: 21, entry2Score: 15 },
      { entry1Score: 18, entry2Score: 21 },
      { entry1Score: 19, entry2Score: 21 },
    ]);
    expect(result2).toEqual({ valid: true, winnerSide: 2 });
  });

  it("rejects when game 1 or 2 is missing", () => {
    expect(validateCompletedMatch([null, { entry1Score: 21, entry2Score: 15 }, null]).valid).toBe(false);
  });

  it("rejects an invalid individual game score", () => {
    const result = validateCompletedMatch([
      { entry1Score: 21, entry2Score: 20 },
      { entry1Score: 21, entry2Score: 18 },
      null,
    ]);
    expect(result.valid).toBe(false);
  });
});
