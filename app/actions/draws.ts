"use server";

import { z } from "zod";
import { Prisma, type DrawFormat } from "@prisma/client";
import { revalidateTournament } from "@/lib/revalidate";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { notify } from "@/lib/notify";
import {
  generateSingleEliminationBracket,
  nextPowerOfTwo,
  MIN_BRACKET_ENTRIES,
  MAX_BRACKET_ENTRIES,
  type SeededEntry,
} from "@/lib/tournament/singleElimination";
import { generateRoundRobinMatches, computeRoundRobinStandings, MIN_ROUND_ROBIN_ENTRIES } from "@/lib/tournament/roundRobin";
import {
  choosePoolCount,
  poolName,
  assignEntriesToPools,
  selectKnockoutAdvancers,
  inferAdvancesPerPool,
} from "@/lib/tournament/pools";

export type DrawActionState = { error?: string };

async function requireOwnedEvent(eventId: string, userId: string) {
  return prisma.event.findFirst({
    where: { id: eventId, tournament: { organizerId: userId } },
    include: { tournament: true },
  });
}

async function clearExistingDraw(eventId: string): Promise<void> {
  await prisma.$transaction([
    prisma.match.deleteMany({ where: { eventId } }),
    prisma.pool.deleteMany({ where: { eventId } }),
    prisma.entry.updateMany({ where: { eventId }, data: { poolId: null } }),
  ]);
}

/**
 * Creates an empty single-elimination bracket shell for a manual draw: every
 * round-1 slot present but unassigned, plus the usual TBD matches for later
 * rounds — no entries placed, no seeding algorithm involved. The organizer
 * fills it in themselves via assignEntryToMatch.
 */
async function createEmptyBracketStructure(eventId: string, entryCount: number): Promise<void> {
  const bracketSize = nextPowerOfTwo(entryCount);
  const numRounds = Math.log2(bracketSize);

  const matches: Prisma.MatchCreateManyInput[] = [];
  for (let position = 0; position < bracketSize / 2; position++) {
    matches.push({ eventId, round: 1, position, entry1Id: null, entry2Id: null, winnerId: null, isBye: false });
  }
  for (let round = 2; round <= numRounds; round++) {
    const matchesInRound = bracketSize / Math.pow(2, round);
    for (let position = 0; position < matchesInRound; position++) {
      matches.push({ eventId, round, position, entry1Id: null, entry2Id: null, winnerId: null, isBye: false });
    }
  }
  await prisma.match.createMany({ data: matches });
}

export async function generateDraw(
  eventId: string,
  _prevState: DrawActionState,
  _formData: FormData,
): Promise<DrawActionState> {
  const userId = await requireUserId();
  const event = await requireOwnedEvent(eventId, userId);
  if (!event) return { error: "Event not found." };
  if (event.drawPublished) {
    return { error: "The draw has already been published. Unpublish it first to regenerate." };
  }

  const confirmedEntries = await prisma.entry.findMany({
    where: { eventId, status: "CONFIRMED" },
    select: { id: true, seed: true },
  });

  if (event.drawFormat === "SINGLE_ELIMINATION") {
    if (confirmedEntries.length < MIN_BRACKET_ENTRIES) {
      return {
        error: `Need at least ${MIN_BRACKET_ENTRIES} confirmed entries to generate a draw (have ${confirmedEntries.length}).`,
      };
    }
    if (confirmedEntries.length > MAX_BRACKET_ENTRIES) {
      return {
        error: `Single elimination supports at most ${MAX_BRACKET_ENTRIES} entries (have ${confirmedEntries.length}).`,
      };
    }

    const seededEntries: SeededEntry[] = confirmedEntries.map((e) => ({ entryId: e.id, seed: e.seed }));
    let bracket;
    try {
      bracket = generateSingleEliminationBracket(seededEntries);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Couldn't generate the draw." };
    }

    await clearExistingDraw(eventId);
    await prisma.match.createMany({
      data: bracket.map((m) => ({
        eventId,
        round: m.round,
        position: m.position,
        entry1Id: m.entry1Id,
        entry2Id: m.entry2Id,
        winnerId: m.winnerId,
        isBye: m.isBye,
      })),
    });
  } else if (event.drawFormat === "ROUND_ROBIN") {
    if (confirmedEntries.length < MIN_ROUND_ROBIN_ENTRIES) {
      return {
        error: `Need at least ${MIN_ROUND_ROBIN_ENTRIES} confirmed entries for round robin (have ${confirmedEntries.length}).`,
      };
    }

    const matches = generateRoundRobinMatches(confirmedEntries.map((e) => e.id));
    await clearExistingDraw(eventId);
    await prisma.match.createMany({
      data: matches.map((m) => ({
        eventId,
        round: 1,
        position: m.position,
        entry1Id: m.entry1Id,
        entry2Id: m.entry2Id,
      })),
    });
  } else {
    // POOLS_KNOCKOUT: this generates the pool stage only. The knockout
    // stage is generated separately, once every pool match is complete.
    let poolCount: number;
    try {
      poolCount = choosePoolCount(confirmedEntries.length);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Couldn't split entries into pools." };
    }

    const pools = assignEntriesToPools(
      confirmedEntries.map((e) => ({ entryId: e.id, seed: e.seed })),
      poolCount,
    );

    await clearExistingDraw(eventId);
    await prisma.$transaction(async (tx) => {
      let position = 0;
      for (const [index, poolEntryIds] of pools.entries()) {
        const pool = await tx.pool.create({ data: { eventId, name: poolName(index) } });
        await tx.entry.updateMany({ where: { id: { in: poolEntryIds } }, data: { poolId: pool.id } });
        const matches = generateRoundRobinMatches(poolEntryIds);
        await tx.match.createMany({
          data: matches.map((m) => ({
            eventId,
            poolId: pool.id,
            round: 0,
            position: position++,
            entry1Id: m.entry1Id,
            entry2Id: m.entry2Id,
          })),
        });
      }
    });
  }

  revalidateTournament(event.tournament.slug);
  return {};
}

/**
 * Sets up a single-elimination bracket for a manual draw instead of the
 * automatic seeded one: same size and slot count generateDraw would produce,
 * but every slot starts empty for the organizer to fill in themselves (e.g.
 * conducting a live draw, or placing entries by hand for reasons the seeding
 * algorithm doesn't account for).
 */
export async function generateManualDraw(
  eventId: string,
  _prevState: DrawActionState,
  _formData: FormData,
): Promise<DrawActionState> {
  const userId = await requireUserId();
  const event = await requireOwnedEvent(eventId, userId);
  if (!event) return { error: "Event not found." };
  if (event.drawFormat !== "SINGLE_ELIMINATION") {
    return { error: "This event doesn't use a single-elimination bracket." };
  }
  if (event.drawPublished) {
    return { error: "The draw has already been published. Unpublish it first to regenerate." };
  }

  const confirmedCount = await prisma.entry.count({ where: { eventId, status: "CONFIRMED" } });
  if (confirmedCount < MIN_BRACKET_ENTRIES) {
    return {
      error: `Need at least ${MIN_BRACKET_ENTRIES} confirmed entries to generate a draw (have ${confirmedCount}).`,
    };
  }
  if (confirmedCount > MAX_BRACKET_ENTRIES) {
    return { error: `Single elimination supports at most ${MAX_BRACKET_ENTRIES} entries (have ${confirmedCount}).` };
  }

  await clearExistingDraw(eventId);
  await createEmptyBracketStructure(eventId, confirmedCount);

  revalidateTournament(event.tournament.slug);
  return {};
}

/**
 * Generates the knockout stage of a pools+knockout event: takes the top 1 or
 * 2 finishers from every pool (by the same standings logic as round robin)
 * and seeds them into a single-elimination bracket, pool winners first.
 * Requires every pool match to be completed first.
 */
export async function generateKnockoutStage(
  eventId: string,
  _prevState: DrawActionState,
  formData: FormData,
): Promise<DrawActionState> {
  const userId = await requireUserId();
  const event = await requireOwnedEvent(eventId, userId);
  if (!event) return { error: "Event not found." };
  if (event.drawFormat !== "POOLS_KNOCKOUT") return { error: "This event isn't a pools + knockout event." };

  const existingKnockoutMatches = await prisma.match.findMany({
    where: { eventId, poolId: null },
    select: { status: true },
  });
  if (existingKnockoutMatches.some((m) => m.status !== null)) {
    return { error: "Can't regenerate — the knockout stage already has scored matches." };
  }

  const advancesPerPoolRaw = formData.get("advancesPerPool");
  const advancesPerPool = advancesPerPoolRaw === "2" ? 2 : advancesPerPoolRaw === "1" ? 1 : null;
  if (advancesPerPool === null) {
    return { error: "Choose how many entries advance per pool." };
  }

  const pools = await prisma.pool.findMany({
    where: { eventId },
    orderBy: { name: "asc" },
    include: {
      entries: { select: { id: true } },
      matches: { select: { entry1Id: true, entry2Id: true, winnerId: true, games: true } },
    },
  });
  if (pools.length === 0) return { error: "Generate the pools first." };

  const incompletePool = pools.find((p) => p.matches.some((m) => m.winnerId === null));
  if (incompletePool) {
    return { error: `${incompletePool.name} still has unplayed matches.` };
  }

  const poolStandings = pools.map((pool) => {
    const entryIds = pool.entries.map((e) => e.id);
    // Pool matches are always generated with both entries filled in (never
    // a bye/TBD), so this filter is just satisfying the type checker.
    const playedMatches = pool.matches.filter(
      (m): m is typeof m & { entry1Id: string; entry2Id: string } => m.entry1Id !== null && m.entry2Id !== null,
    );
    const standings = computeRoundRobinStandings(entryIds, playedMatches);
    return standings.map((s) => s.entryId);
  });

  const advancers = selectKnockoutAdvancers(poolStandings, advancesPerPool);
  if (advancers.length < MIN_BRACKET_ENTRIES) {
    return {
      error: `Not enough advancers for a knockout bracket (need at least ${MIN_BRACKET_ENTRIES}, have ${advancers.length}).`,
    };
  }
  if (advancers.length > MAX_BRACKET_ENTRIES) {
    return {
      error: `Too many advancers for a knockout bracket (max ${MAX_BRACKET_ENTRIES}, have ${advancers.length}). Choose 1 per pool instead.`,
    };
  }

  const seededEntries: SeededEntry[] = advancers.map((a) => ({ entryId: a.entryId, seed: a.seed }));
  let bracket;
  try {
    // Deterministic: pool rank is a meaningful order (unlike organizer-tied
    // seeds 3/4), so it must survive exactly or two same-pool entries could
    // end up paired in the very first knockout round.
    bracket = generateSingleEliminationBracket(seededEntries, Math.random, true);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn't generate the knockout bracket." };
  }

  await prisma.$transaction([
    prisma.match.deleteMany({ where: { eventId, poolId: null } }),
    prisma.match.createMany({
      data: bracket.map((m) => ({
        eventId,
        round: m.round,
        position: m.position,
        entry1Id: m.entry1Id,
        entry2Id: m.entry2Id,
        winnerId: m.winnerId,
        isBye: m.isBye,
      })),
    }),
  ]);

  // The draw was already published for the pool stage — let advancers know
  // their knockout match is ready, same as the initial publish notice.
  if (event.drawPublished) {
    const advancerPlayers = await prisma.entryPlayer.findMany({
      where: { entryId: { in: advancers.map((a) => a.entryId) } },
      select: { userId: true },
    });
    const userIds = [...new Set(advancerPlayers.map((p) => p.userId).filter((id): id is string => id !== null))];
    await Promise.all(
      userIds.map((uid) =>
        notify(
          uid,
          `The knockout stage for ${event.name} at ${event.tournament.name} has been generated.`,
          `/t/${event.tournament.slug}/${eventId}`,
        ),
      ),
    );
  }

  revalidateTournament(event.tournament.slug);
  return {};
}

/**
 * Sets up an empty knockout-stage bracket for a manual draw: same size
 * requirements as generateKnockoutStage (every pool match complete, sized by
 * advances-per-pool), but no automatic seeding — the organizer places
 * entries themselves via assignEntryToMatch, and isn't limited to the
 * standings-computed advancers (a manual draw is meant to override that).
 */
export async function generateManualKnockoutStage(
  eventId: string,
  _prevState: DrawActionState,
  formData: FormData,
): Promise<DrawActionState> {
  const userId = await requireUserId();
  const event = await requireOwnedEvent(eventId, userId);
  if (!event) return { error: "Event not found." };
  if (event.drawFormat !== "POOLS_KNOCKOUT") return { error: "This event isn't a pools + knockout event." };

  const existingKnockoutMatches = await prisma.match.findMany({
    where: { eventId, poolId: null },
    select: { status: true },
  });
  if (existingKnockoutMatches.some((m) => m.status !== null)) {
    return { error: "Can't regenerate — the knockout stage already has scored matches." };
  }

  const advancesPerPoolRaw = formData.get("advancesPerPool");
  const advancesPerPool = advancesPerPoolRaw === "2" ? 2 : advancesPerPoolRaw === "1" ? 1 : null;
  if (advancesPerPool === null) {
    return { error: "Choose how many entries advance per pool." };
  }

  const pools = await prisma.pool.findMany({
    where: { eventId },
    include: { matches: { select: { winnerId: true } } },
  });
  if (pools.length === 0) return { error: "Generate the pools first." };

  const incompletePool = pools.find((p) => p.matches.some((m) => m.winnerId === null));
  if (incompletePool) {
    return { error: `${incompletePool.name} still has unplayed matches.` };
  }

  const totalAdvancers = pools.length * advancesPerPool;
  if (totalAdvancers < MIN_BRACKET_ENTRIES) {
    return {
      error: `Not enough advancers for a knockout bracket (need at least ${MIN_BRACKET_ENTRIES}, have ${totalAdvancers}).`,
    };
  }
  if (totalAdvancers > MAX_BRACKET_ENTRIES) {
    return {
      error: `Too many advancers for a knockout bracket (max ${MAX_BRACKET_ENTRIES}, have ${totalAdvancers}). Choose 1 per pool instead.`,
    };
  }

  await prisma.match.deleteMany({ where: { eventId, poolId: null } });
  await createEmptyBracketStructure(eventId, totalAdvancers);

  revalidateTournament(event.tournament.slug);
  return {};
}

export async function publishDraw(eventId: string): Promise<void> {
  const userId = await requireUserId();
  const event = await requireOwnedEvent(eventId, userId);
  if (!event) redirect("/organizer");

  // Not scoped to round 1: single elimination and round robin both place
  // every entry there, but pools+knockout's pool stage lives at round 0.
  const allMatches = await prisma.match.findMany({
    where: { eventId },
    include: {
      entry1: { include: { players: true } },
      entry2: { include: { players: true } },
    },
  });
  if (allMatches.length === 0) redirect(`/organizer/${event.tournament.slug}/draws`);

  await prisma.event.update({ where: { id: eventId }, data: { drawPublished: true } });

  // Notify everyone actually placed in the draw (not just "confirmed"
  // entries in general, in case one was added after the draw was generated
  // but before it was published).
  const notifiedUserIds = new Set<string>();
  for (const match of allMatches) {
    for (const entry of [match.entry1, match.entry2]) {
      for (const player of entry?.players ?? []) {
        if (player.userId) notifiedUserIds.add(player.userId);
      }
    }
  }
  await Promise.all(
    [...notifiedUserIds].map((uid) =>
      notify(
        uid,
        `The draw for ${event.name} at ${event.tournament.name} has been published.`,
        `/t/${event.tournament.slug}/${eventId}`,
      ),
    ),
  );

  revalidateTournament(event.tournament.slug);
}

export async function unpublishDraw(eventId: string): Promise<void> {
  const userId = await requireUserId();
  const event = await requireOwnedEvent(eventId, userId);
  if (!event) redirect("/organizer");

  await prisma.event.update({ where: { id: eventId }, data: { drawPublished: false } });

  revalidateTournament(event.tournament.slug);
}

type Round1Match = { id: string; position: number; entry1Id: string | null; entry2Id: string | null };
type Round1Final = { entry1Id: string | null; entry2Id: string | null; isBye: boolean; winnerId: string | null };

/**
 * Writes the new entries/bye status for one or two round-1 matches, and
 * patches whichever round-2 slot(s) they feed: a match that's now a bye
 * auto-advances its winner into round 2; a match that's no longer a bye
 * clears whatever bye winner had been sitting there.
 */
async function applyRound1Changes(
  eventId: string,
  changes: { match: Round1Match; final: Round1Final }[],
): Promise<void> {
  const round2PositionFor = (position: number) => Math.floor(position / 2);
  const round2SlotFor = (position: number): "entry1Id" | "entry2Id" =>
    position % 2 === 0 ? "entry1Id" : "entry2Id";

  const round2Matches = await prisma.match.findMany({
    where: {
      eventId,
      round: 2,
      position: { in: [...new Set(changes.map((c) => round2PositionFor(c.match.position)))] },
    },
    select: { id: true, position: true },
  });

  const round2Updates = new Map<string, { entry1Id?: string | null; entry2Id?: string | null }>();
  for (const { match, final } of changes) {
    const r2Match = round2Matches.find((rm) => rm.position === round2PositionFor(match.position));
    if (!r2Match) continue;
    const slot = round2SlotFor(match.position);
    round2Updates.set(r2Match.id, {
      ...round2Updates.get(r2Match.id),
      [slot]: final.isBye ? final.winnerId : null,
    });
  }

  await prisma.$transaction([
    ...changes.map(({ match, final }) => prisma.match.update({ where: { id: match.id }, data: final })),
    ...[...round2Updates.entries()].map(([id, data]) => prisma.match.update({ where: { id }, data })),
  ]);
}

/**
 * Swaps two entries' positions in an already-generated round-1 draw, without
 * touching anyone else's slot. Recomputes each affected match's bye status
 * and, since no real match results exist before round 2, patches the round-2
 * slot(s) either match had already auto-advanced a bye winner into.
 */
export async function swapBracketEntries(
  eventId: string,
  _prevState: DrawActionState,
  formData: FormData,
): Promise<DrawActionState> {
  const userId = await requireUserId();
  const event = await requireOwnedEvent(eventId, userId);
  if (!event) return { error: "Event not found." };

  const entryIdA = formData.get("entryIdA");
  const entryIdB = formData.get("entryIdB");
  if (typeof entryIdA !== "string" || typeof entryIdB !== "string" || !entryIdA || !entryIdB) {
    return { error: "Select two entries to swap." };
  }
  if (entryIdA === entryIdB) {
    return { error: "Select two different entries to swap." };
  }

  // poolId: null scopes this to the bracket (for pools+knockout, the
  // knockout stage) — without it, a pools+knockout entry's completed pool
  // matches would always trip the "already played" check below.
  const allMatches = await prisma.match.findMany({
    where: { eventId, poolId: null },
    select: { id: true, round: true, position: true, entry1Id: true, entry2Id: true, status: true, liveStartedAt: true },
  });
  const involvesEntry = (m: { entry1Id: string | null; entry2Id: string | null }) =>
    m.entry1Id === entryIdA || m.entry2Id === entryIdA || m.entry1Id === entryIdB || m.entry2Id === entryIdB;
  if (allMatches.some((m) => m.status === null && m.liveStartedAt !== null && involvesEntry(m))) {
    return { error: "Can't swap — one of these entries is in a match being scored live. Finish or discard the live score first." };
  }
  const alreadyPlayed = allMatches.some(
    (m) => m.status !== null && (m.entry1Id === entryIdA || m.entry2Id === entryIdA || m.entry1Id === entryIdB || m.entry2Id === entryIdB),
  );
  if (alreadyPlayed) {
    return { error: "Can't swap — one of these entries has already played a scored match." };
  }

  const round1Matches: Round1Match[] = allMatches.filter((m) => m.round === 1);
  const matchA = round1Matches.find((m) => m.entry1Id === entryIdA || m.entry2Id === entryIdA);
  const matchB = round1Matches.find((m) => m.entry1Id === entryIdB || m.entry2Id === entryIdB);
  if (!matchA || !matchB) {
    return { error: "Both entries must currently be placed in the draw." };
  }

  const recompute = (entry1Id: string | null, entry2Id: string | null) => {
    const isBye = (entry1Id === null) !== (entry2Id === null);
    return { entry1Id, entry2Id, isBye, winnerId: isBye ? (entry1Id ?? entry2Id) : null };
  };

  if (matchA.id === matchB.id) {
    // Both entries are already in the same real match (a bye match only has
    // one entry, so this can't happen for a bye) — just flip their sides.
    await prisma.match.update({
      where: { id: matchA.id },
      data: { entry1Id: matchA.entry2Id, entry2Id: matchA.entry1Id },
    });
  } else {
    const finalA = recompute(
      matchA.entry1Id === entryIdA ? entryIdB : matchA.entry1Id,
      matchA.entry2Id === entryIdA ? entryIdB : matchA.entry2Id,
    );
    const finalB = recompute(
      matchB.entry1Id === entryIdB ? entryIdA : matchB.entry1Id,
      matchB.entry2Id === entryIdB ? entryIdA : matchB.entry2Id,
    );

    await applyRound1Changes(eventId, [
      { match: matchA, final: finalA },
      { match: matchB, final: finalB },
    ]);
  }

  revalidateTournament(event.tournament.slug);
  return {};
}

/**
 * Moves one entry out of its round-1 match into an existing empty bye slot
 * elsewhere in the same round; its former opponent inherits the bye it
 * leaves behind. Unlike swapBracketEntries (which always trades two occupied
 * slots), this is for handing someone's bye to a different entry outright —
 * e.g. to seed a late addition into the easier side of the draw.
 */
export async function moveEntryToByeSlot(
  eventId: string,
  _prevState: DrawActionState,
  formData: FormData,
): Promise<DrawActionState> {
  const userId = await requireUserId();
  const event = await requireOwnedEvent(eventId, userId);
  if (!event) return { error: "Event not found." };

  const entryId = formData.get("entryId");
  const targetMatchId = formData.get("targetMatchId");
  if (typeof entryId !== "string" || !entryId || typeof targetMatchId !== "string" || !targetMatchId) {
    return { error: "Select an entry and an empty slot to move it to." };
  }

  const allMatches = await prisma.match.findMany({
    where: { eventId, poolId: null },
    select: {
      id: true,
      round: true,
      position: true,
      entry1Id: true,
      entry2Id: true,
      isBye: true,
      status: true,
      liveStartedAt: true,
    },
  });

  const sourceMatch = allMatches.find(
    (m) => m.round === 1 && !m.isBye && (m.entry1Id === entryId || m.entry2Id === entryId),
  );
  if (!sourceMatch) {
    return { error: "That entry isn't currently in a round-1 match with an opponent to move away from." };
  }
  const targetMatch = allMatches.find((m) => m.id === targetMatchId);
  if (!targetMatch || targetMatch.round !== 1 || !targetMatch.isBye) {
    return { error: "Pick an empty (bye) slot to move the entry into." };
  }

  const opponentId = (sourceMatch.entry1Id === entryId ? sourceMatch.entry2Id : sourceMatch.entry1Id)!;
  const byeOccupantId = (targetMatch.entry1Id ?? targetMatch.entry2Id)!;

  const involved = new Set([entryId, opponentId, byeOccupantId]);
  const involvesAny = (m: { entry1Id: string | null; entry2Id: string | null }) =>
    (m.entry1Id !== null && involved.has(m.entry1Id)) || (m.entry2Id !== null && involved.has(m.entry2Id));
  if (allMatches.some((m) => m.status === null && m.liveStartedAt !== null && involvesAny(m))) {
    return { error: "Can't move — one of these entries is in a match being scored live. Finish or discard the live score first." };
  }
  if (allMatches.some((m) => m.status !== null && involvesAny(m))) {
    return { error: "Can't move — one of these entries has already played a scored match." };
  }

  // A bye match always carries its occupant in entry1Id with entry2Id null
  // (see generateSingleEliminationBracket) — the bracket display relies on
  // that and always renders entry2Id's side as the literal "Bye", so the
  // survivor has to land in entry1Id here regardless of which side it was on.
  const finalSource: Round1Final = {
    entry1Id: opponentId,
    entry2Id: null,
    isBye: true,
    winnerId: opponentId,
  };
  const finalTarget: Round1Final = {
    entry1Id: targetMatch.entry1Id ?? entryId,
    entry2Id: targetMatch.entry2Id ?? entryId,
    isBye: false,
    winnerId: null,
  };

  await applyRound1Changes(eventId, [
    { match: sourceMatch, final: finalSource },
    { match: targetMatch, final: finalTarget },
  ]);

  revalidateTournament(event.tournament.slug);
  return {};
}

/**
 * Which entries a manual draw's position picker offers, and how many of them
 * there are meant to eventually be (used to detect "everyone's placed, so
 * whatever's left over is a bye"). For single elimination that's simply
 * every confirmed entry. For pools+knockout it has to be the pool-standings
 * advancers instead — not every confirmed entry is meant to reach the
 * knockout bracket, and unlike single elimination that expected count isn't
 * implied by "how many confirmed entries does this event have" at all.
 * advancesPerPool itself isn't stored anywhere (generateManualKnockoutStage
 * only uses it once, to size the bracket), so it's recovered from the
 * bracket size that produced instead — see inferAdvancesPerPool.
 */
async function eligibleEntryIds(eventId: string, drawFormat: DrawFormat, bracketSize: number): Promise<Set<string>> {
  const confirmed = await prisma.entry.findMany({ where: { eventId, status: "CONFIRMED" }, select: { id: true } });
  const confirmedIds = new Set(confirmed.map((e) => e.id));
  if (drawFormat !== "POOLS_KNOCKOUT") return confirmedIds;

  const pools = await prisma.pool.findMany({
    where: { eventId },
    orderBy: { name: "asc" },
    include: {
      entries: { select: { id: true } },
      matches: { select: { entry1Id: true, entry2Id: true, winnerId: true, games: true } },
    },
  });
  const advancesPerPool = pools.length > 0 ? inferAdvancesPerPool(pools.length, bracketSize) : null;
  if (!advancesPerPool) return confirmedIds; // shouldn't happen for a genuinely manually-generated knockout bracket

  const poolStandings = pools.map((pool) => {
    const entryIds = pool.entries.map((e) => e.id);
    const playedMatches = pool.matches.filter(
      (m): m is typeof m & { entry1Id: string; entry2Id: string } => m.entry1Id !== null && m.entry2Id !== null,
    );
    return computeRoundRobinStandings(entryIds, playedMatches).map((s) => s.entryId);
  });
  return new Set(selectKnockoutAdvancers(poolStandings, advancesPerPool).map((a) => a.entryId));
}

/**
 * Sets (or clears) which numbered bracket position a confirmed entry sits
 * at, during a manual draw — position 1 is round 1's first match's entry1,
 * position 2 that match's entry2, position 3 the next match's entry1, and so
 * on. This is the only edit a manual draw needs: moving an entry away from a
 * slot leaves it fully empty (unless doing so completes every other entry's
 * placement — see below), and placing one fills whichever side of the target
 * match that position refers to, un-finalizing a bye there if there was one.
 *
 * Byes are never a separate step: once every eligible entry (see
 * eligibleEntryIds) has *some* position, any match still left with exactly
 * one occupant is nobody's opponent by construction, so it's finalized as
 * that entry's bye right here, automatically. Removing a different entry
 * afterwards doesn't undo an already-finalized bye — only touching that
 * bye's own occupant does.
 */
export async function setEntryPosition(
  eventId: string,
  _prevState: DrawActionState,
  formData: FormData,
): Promise<DrawActionState> {
  const userId = await requireUserId();
  const event = await requireOwnedEvent(eventId, userId);
  if (!event) return { error: "Event not found." };
  if (event.drawPublished) return { error: "The draw has already been published." };

  const entryId = formData.get("entryId");
  const positionRaw = formData.get("position");
  if (typeof entryId !== "string" || !entryId) return { error: "Entry not found." };

  const round1 = await prisma.match.findMany({
    where: { eventId, round: 1, poolId: null },
    select: { id: true, position: true, entry1Id: true, entry2Id: true, isBye: true, status: true, liveStartedAt: true },
    orderBy: { position: "asc" },
  });
  if (round1.length === 0) return { error: "Generate the draw first." };
  const bracketSize = round1.length * 2;

  const eligibleIds = await eligibleEntryIds(eventId, event.drawFormat, bracketSize);
  if (!eligibleIds.has(entryId)) return { error: "That entry can't be placed in this draw." };

  let targetPosition: number | null = null;
  if (typeof positionRaw === "string" && positionRaw !== "") {
    const parsed = Number(positionRaw);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > bracketSize) {
      return { error: "Choose a valid position." };
    }
    targetPosition = parsed;
  }

  const currentMatch = round1.find((m) => m.entry1Id === entryId || m.entry2Id === entryId) ?? null;
  const targetIndex = targetPosition !== null ? Math.floor((targetPosition - 1) / 2) : null;
  const targetSide: "entry1Id" | "entry2Id" | null =
    targetPosition !== null ? ((targetPosition - 1) % 2 === 0 ? "entry1Id" : "entry2Id") : null;
  const targetMatch = targetIndex !== null ? round1[targetIndex] : null;

  if (targetMatch && targetSide) {
    const occupant = targetMatch[targetSide];
    if (occupant !== null && occupant !== entryId) {
      return { error: "That position is already taken." };
    }
  }
  if (!currentMatch && !targetMatch) return {}; // clearing an already-unassigned entry: no-op

  const touched = [currentMatch, targetMatch].filter((m): m is (typeof round1)[number] => m !== null);
  if (touched.some((m) => m.status !== null)) {
    return { error: "Can't change this — one of these matches has already been scored." };
  }
  if (touched.some((m) => m.liveStartedAt !== null)) {
    return { error: "Can't change this — one of these matches is being scored live. Finish or discard the live score first." };
  }

  // Simulate the move across every round-1 match.
  const sim = round1.map((m) => ({ entry1Id: m.entry1Id, entry2Id: m.entry2Id }));
  if (currentMatch) {
    const idx = round1.findIndex((m) => m.id === currentMatch.id);
    if (sim[idx].entry1Id === entryId) sim[idx].entry1Id = null;
    if (sim[idx].entry2Id === entryId) sim[idx].entry2Id = null;
  }
  if (targetIndex !== null && targetSide) {
    sim[targetIndex][targetSide] = entryId;
  }

  const placedCount = sim.reduce((n, s) => n + (s.entry1Id !== null ? 1 : 0) + (s.entry2Id !== null ? 1 : 0), 0);
  const allPlaced = placedCount === eligibleIds.size;

  const changes: { match: Round1Match; final: Round1Final }[] = [];
  for (let i = 0; i < round1.length; i++) {
    const before = round1[i];
    const { entry1Id, entry2Id } = sim[i];
    const full = entry1Id !== null && entry2Id !== null;
    const lone = (entry1Id !== null) !== (entry2Id !== null);
    const isBye = !full && lone && (before.isBye || allPlaced);
    const occupant = entry1Id ?? entry2Id;
    const final: Round1Final = isBye
      ? { entry1Id: occupant, entry2Id: null, isBye: true, winnerId: occupant }
      : { entry1Id, entry2Id, isBye: false, winnerId: null };
    const unchanged = final.entry1Id === before.entry1Id && final.entry2Id === before.entry2Id && final.isBye === before.isBye;
    if (!unchanged) changes.push({ match: before, final });
  }

  if (changes.length > 0) {
    await applyRound1Changes(eventId, changes);
  }

  revalidateTournament(event.tournament.slug);
  return {};
}

/**
 * Swaps two entries between their pools (pools+knockout only). Unlike a
 * bracket-position swap, a pool has no "slots" to trade — moving an entry
 * means it now plays everyone in its new pool and no longer plays anyone in
 * its old one, so the fix is to delete its old pool's matches against it and
 * create fresh ones against its new pool's other entries.
 */
export async function swapPoolEntries(
  eventId: string,
  _prevState: DrawActionState,
  formData: FormData,
): Promise<DrawActionState> {
  const userId = await requireUserId();
  const event = await requireOwnedEvent(eventId, userId);
  if (!event) return { error: "Event not found." };
  if (event.drawFormat !== "POOLS_KNOCKOUT") return { error: "This event doesn't use pools." };

  const entryIdA = formData.get("entryIdA");
  const entryIdB = formData.get("entryIdB");
  if (typeof entryIdA !== "string" || typeof entryIdB !== "string" || !entryIdA || !entryIdB) {
    return { error: "Select two entries to swap." };
  }
  if (entryIdA === entryIdB) {
    return { error: "Select two different entries to swap." };
  }

  const knockoutMatchCount = await prisma.match.count({ where: { eventId, poolId: null } });
  if (knockoutMatchCount > 0) {
    return { error: "Can't swap pools — the knockout stage has already been generated." };
  }

  const [entryA, entryB] = await Promise.all([
    prisma.entry.findUnique({ where: { id: entryIdA }, select: { id: true, poolId: true } }),
    prisma.entry.findUnique({ where: { id: entryIdB }, select: { id: true, poolId: true } }),
  ]);
  if (!entryA?.poolId || !entryB?.poolId || entryA.poolId === entryB.poolId) {
    return { error: "Both entries must currently be in two different pools." };
  }

  const [poolAMatches, poolBMatches] = await Promise.all([
    prisma.match.findMany({ where: { poolId: entryA.poolId }, select: { id: true, entry1Id: true, entry2Id: true, status: true } }),
    prisma.match.findMany({ where: { poolId: entryB.poolId }, select: { id: true, entry1Id: true, entry2Id: true, status: true } }),
  ]);
  const alreadyPlayed = [...poolAMatches, ...poolBMatches].some(
    (m) => m.status !== null && (m.entry1Id === entryIdA || m.entry2Id === entryIdA || m.entry1Id === entryIdB || m.entry2Id === entryIdB),
  );
  if (alreadyPlayed) {
    return { error: "Can't swap — one of these entries has already played a scored pool match." };
  }

  const poolAOthers = [
    ...new Set(poolAMatches.flatMap((m) => [m.entry1Id, m.entry2Id]).filter((id): id is string => id !== null && id !== entryIdA)),
  ];
  const poolBOthers = [
    ...new Set(poolBMatches.flatMap((m) => [m.entry1Id, m.entry2Id]).filter((id): id is string => id !== null && id !== entryIdB)),
  ];

  const maxPosition = await prisma.match.aggregate({ where: { eventId, round: 0 }, _max: { position: true } });
  let nextPosition = (maxPosition._max.position ?? -1) + 1;

  await prisma.$transaction([
    prisma.match.deleteMany({ where: { poolId: entryA.poolId, OR: [{ entry1Id: entryIdA }, { entry2Id: entryIdA }] } }),
    prisma.match.deleteMany({ where: { poolId: entryB.poolId, OR: [{ entry1Id: entryIdB }, { entry2Id: entryIdB }] } }),
    prisma.entry.update({ where: { id: entryIdA }, data: { poolId: entryB.poolId } }),
    prisma.entry.update({ where: { id: entryIdB }, data: { poolId: entryA.poolId } }),
    prisma.match.createMany({
      data: [
        ...poolBOthers.map((otherId) => ({
          eventId,
          poolId: entryB.poolId!,
          round: 0,
          position: nextPosition++,
          entry1Id: entryIdA,
          entry2Id: otherId,
        })),
        ...poolAOthers.map((otherId) => ({
          eventId,
          poolId: entryA.poolId!,
          round: 0,
          position: nextPosition++,
          entry1Id: entryIdB,
          entry2Id: otherId,
        })),
      ],
    }),
  ]);

  revalidateTournament(event.tournament.slug);
  return {};
}

/**
 * Moves a single entry into a different pool, leaving pool sizes unequal —
 * for when swapping two entries (which preserves both pools' sizes) isn't
 * what's needed, e.g. correcting a pool that ended up too big or too small.
 */
export async function movePoolEntry(
  eventId: string,
  _prevState: DrawActionState,
  formData: FormData,
): Promise<DrawActionState> {
  const userId = await requireUserId();
  const event = await requireOwnedEvent(eventId, userId);
  if (!event) return { error: "Event not found." };
  if (event.drawFormat !== "POOLS_KNOCKOUT") return { error: "This event doesn't use pools." };

  const entryId = formData.get("entryId");
  const targetPoolId = formData.get("targetPoolId");
  if (typeof entryId !== "string" || !entryId || typeof targetPoolId !== "string" || !targetPoolId) {
    return { error: "Select an entry and a destination pool." };
  }

  const knockoutMatchCount = await prisma.match.count({ where: { eventId, poolId: null } });
  if (knockoutMatchCount > 0) {
    return { error: "Can't move entries — the knockout stage has already been generated." };
  }

  const entry = await prisma.entry.findUnique({ where: { id: entryId }, select: { id: true, poolId: true } });
  if (!entry?.poolId) return { error: "Entry not found in any pool." };
  if (entry.poolId === targetPoolId) return { error: "That entry is already in this pool." };

  const targetPool = await prisma.pool.findUnique({ where: { id: targetPoolId }, select: { id: true, eventId: true } });
  if (!targetPool || targetPool.eventId !== eventId) return { error: "Destination pool not found." };

  const sourcePoolMatches = await prisma.match.findMany({
    where: { poolId: entry.poolId },
    select: { entry1Id: true, entry2Id: true, status: true },
  });
  const alreadyPlayed = sourcePoolMatches.some(
    (m) => m.status !== null && (m.entry1Id === entryId || m.entry2Id === entryId),
  );
  if (alreadyPlayed) {
    return { error: "Can't move — this entry has already played a scored pool match." };
  }

  const sourcePoolOtherIds = [
    ...new Set(
      sourcePoolMatches.flatMap((m) => [m.entry1Id, m.entry2Id]).filter((id): id is string => id !== null && id !== entryId),
    ),
  ];
  if (sourcePoolOtherIds.length === 0) {
    return { error: "Can't move — this is the last entry in its pool." };
  }

  const targetPoolOtherIds = (await prisma.entry.findMany({ where: { poolId: targetPoolId }, select: { id: true } })).map(
    (e) => e.id,
  );

  const maxPosition = await prisma.match.aggregate({ where: { eventId, round: 0 }, _max: { position: true } });
  let nextPosition = (maxPosition._max.position ?? -1) + 1;

  await prisma.$transaction([
    prisma.match.deleteMany({ where: { poolId: entry.poolId, OR: [{ entry1Id: entryId }, { entry2Id: entryId }] } }),
    prisma.entry.update({ where: { id: entryId }, data: { poolId: targetPoolId } }),
    prisma.match.createMany({
      data: targetPoolOtherIds.map((otherId) => ({
        eventId,
        poolId: targetPoolId,
        round: 0,
        position: nextPosition++,
        entry1Id: entryId,
        entry2Id: otherId,
      })),
    }),
  ]);

  revalidateTournament(event.tournament.slug);
  return {};
}

const seedSchema = z.union([
  z.literal(""),
  z.coerce.number().int().min(1, "Seed must be 1-8").max(8, "Seed must be 1-8"),
]);

export async function setEntrySeed(
  entryId: string,
  _prevState: DrawActionState,
  formData: FormData,
): Promise<DrawActionState> {
  const userId = await requireUserId();

  const entry = await prisma.entry.findUnique({
    where: { id: entryId },
    include: { event: { include: { tournament: true } } },
  });
  if (!entry || entry.event.tournament.organizerId !== userId) {
    return { error: "Entry not found." };
  }
  if (entry.event.drawPublished) {
    return { error: "Can't change seeds after the draw is published." };
  }

  const parsed = seedSchema.safeParse(formData.get("seed"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid seed" };
  }
  const seed = parsed.data === "" ? null : parsed.data;

  try {
    await prisma.entry.update({ where: { id: entryId }, data: { seed } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: `Seed ${seed} is already assigned to another entry in this event.` };
    }
    throw error;
  }

  revalidateTournament(entry.event.tournament.slug);
  return {};
}
