import { describe, expect, it } from "vitest";
import { RECENT_FINAL_MS, pickCourtDisplay } from "../courtDisplay";

const now = new Date("2026-12-01T10:00:00.000Z");
const ago = (ms: number) => new Date(now.getTime() - ms);
const at = (iso: string) => new Date(`${iso}:00.000Z`);

let n = 0;
const match = (over: Partial<Parameters<typeof pickCourtDisplay>[0][number]> & { id?: string } = {}) => ({
  id: `m${++n}`,
  status: null as string | null,
  liveStartedAt: null as Date | null,
  scheduledAt: null as Date | null,
  updatedAt: ago(60 * 60 * 1000),
  round: 1,
  position: 0,
  ...over,
});

describe("pickCourtDisplay", () => {
  it("shows nothing for an empty court", () => {
    expect(pickCourtDisplay([], now)).toEqual({ kind: "idle" });
  });

  it("shows the live match, ahead of everything else", () => {
    const live = match({ liveStartedAt: ago(5 * 60 * 1000) });
    const result = pickCourtDisplay(
      [match({ scheduledAt: at("2026-12-01T09:00") }), match({ status: "COMPLETED", updatedAt: ago(1000) }), live],
      now,
    );
    expect(result).toEqual({ kind: "live", match: live });
  });

  it("picks the most recently started if two are live", () => {
    const older = match({ liveStartedAt: ago(20 * 60 * 1000) });
    const newer = match({ liveStartedAt: ago(2 * 60 * 1000) });
    expect(pickCourtDisplay([older, newer], now)).toEqual({ kind: "live", match: newer });
  });

  it("a finished live match is not live any more", () => {
    const done = match({ liveStartedAt: ago(40 * 60 * 1000), status: "COMPLETED", updatedAt: ago(30 * 1000) });
    expect(pickCourtDisplay([done], now).kind).toBe("final");
  });

  it("keeps a just-finished match's final score up for 10 minutes", () => {
    const fresh = match({ status: "COMPLETED", updatedAt: ago(RECENT_FINAL_MS - 1000) });
    expect(pickCourtDisplay([fresh], now)).toEqual({ kind: "final", match: fresh });
    const stale = match({ status: "COMPLETED", updatedAt: ago(RECENT_FINAL_MS + 1000) });
    expect(pickCourtDisplay([stale], now)).toEqual({ kind: "idle" });
  });

  it("shows the most recent of several finished matches", () => {
    const first = match({ status: "COMPLETED", updatedAt: ago(8 * 60 * 1000) });
    const second = match({ status: "WALKOVER", updatedAt: ago(2 * 60 * 1000) });
    expect(pickCourtDisplay([first, second], now)).toEqual({ kind: "final", match: second });
  });

  it("with nothing live or just finished, shows the next scheduled match", () => {
    const later = match({ scheduledAt: at("2026-12-01T13:00") });
    const sooner = match({ scheduledAt: at("2026-12-01T11:00") });
    const unscheduled = match();
    expect(pickCourtDisplay([later, unscheduled, sooner], now)).toEqual({ kind: "next", match: sooner });
  });

  it("breaks scheduling ties by round then position", () => {
    const a = match({ scheduledAt: at("2026-12-01T11:00"), round: 2, position: 0 });
    const b = match({ scheduledAt: at("2026-12-01T11:00"), round: 1, position: 3 });
    expect(pickCourtDisplay([a, b], now)).toEqual({ kind: "next", match: b });
  });

  it("ignores matches without a time and old results", () => {
    const old = match({ status: "COMPLETED", updatedAt: ago(3 * 60 * 60 * 1000) });
    expect(pickCourtDisplay([match(), old], now)).toEqual({ kind: "idle" });
  });
});
