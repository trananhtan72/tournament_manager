import { describe, expect, it } from "vitest";
import {
  buildPlayerDirectory,
  groupByInitial,
  initialOf,
  playerMatchesQuery,
} from "../playerDirectory";

const registered = (id: string, name: string) => ({ userId: id, guestName: null, user: { name } });
const guest = (name: string) => ({ userId: null, guestName: name, user: null });

describe("buildPlayerDirectory", () => {
  it("lists a player once, with every event they play, sorted A–Z", () => {
    const directory = buildPlayerDirectory([
      { eventName: "Men's Singles", players: [registered("u2", "Zed Zulu")] },
      { eventName: "Men's Doubles", players: [registered("u2", "Zed Zulu"), registered("u1", "Amy Able")] },
    ]);
    expect(directory.map((p) => p.name)).toEqual(["Amy Able", "Zed Zulu"]);
    expect(directory[1].events).toEqual(["Men's Doubles", "Men's Singles"]);
  });

  it("merges walk-ins by name, ignoring case and spacing", () => {
    const directory = buildPlayerDirectory([
      { eventName: "MS", players: [guest("Walk In")] },
      { eventName: "XD", players: [guest("  walk   in ")] },
    ]);
    expect(directory).toHaveLength(1);
    expect(directory[0].events).toEqual(["MS", "XD"]);
  });

  it("keeps a registered player and a same-named walk-in apart", () => {
    const directory = buildPlayerDirectory([
      { eventName: "MS", players: [registered("u1", "Sam Same"), guest("Sam Same")] },
    ]);
    expect(directory).toHaveLength(2);
  });

  it("is empty with no entries", () => {
    expect(buildPlayerDirectory([])).toEqual([]);
  });

  it("sorts accented names with their base letter", () => {
    const directory = buildPlayerDirectory([
      { eventName: "MS", players: [guest("Zoë"), guest("Émile"), guest("Adam")] },
    ]);
    expect(directory.map((p) => p.name)).toEqual(["Adam", "Émile", "Zoë"]);
  });
});

describe("playerMatchesQuery", () => {
  it("matches any part of the name, case-insensitively", () => {
    expect(playerMatchesQuery("Ann Alpha", "alp")).toBe(true);
    expect(playerMatchesQuery("Ann Alpha", "ANN")).toBe(true);
    expect(playerMatchesQuery("Ann Alpha", "bob")).toBe(false);
  });

  it("needs every word, in any order", () => {
    expect(playerMatchesQuery("Ann Alpha", "alpha ann")).toBe(true);
    expect(playerMatchesQuery("Ann Alpha", "ann zed")).toBe(false);
  });

  it("ignores accents in both directions", () => {
    expect(playerMatchesQuery("José Núñez", "jose nunez")).toBe(true);
    expect(playerMatchesQuery("Jose Nunez", "josé")).toBe(true);
  });

  it("matches everyone for a blank query", () => {
    expect(playerMatchesQuery("Ann Alpha", "")).toBe(true);
    expect(playerMatchesQuery("Ann Alpha", "   ")).toBe(true);
  });
});

describe("initialOf / groupByInitial", () => {
  it("uses the first letter, ignoring accents, and # for anything else", () => {
    expect(initialOf("Ann")).toBe("A");
    expect(initialOf("émile")).toBe("E");
    expect(initialOf("3rd Seed")).toBe("#");
    expect(initialOf("")).toBe("#");
  });

  it("groups in A–Z order with # last, keeping order within a letter", () => {
    const groups = groupByInitial([{ name: "Ann" }, { name: "Amy" }, { name: "Bob" }, { name: "1st" }, { name: "Émile" }]);
    expect(groups.map((g) => [g.letter, g.players.map((p) => p.name)])).toEqual([
      ["A", ["Ann", "Amy"]],
      ["B", ["Bob"]],
      ["E", ["Émile"]],
      ["#", ["1st"]],
    ]);
  });
});
