import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import bcrypt from "bcryptjs";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const BASE = "http://localhost:3000";
const PASSWORD = "testpassword123";
const STAMP = Date.now();
const SLUG = `team-e2e-${STAMP}`;
const EMAIL = `team-e2e-organizer-${STAMP}@example.com`;

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
}

async function main() {
  console.log("=== Fixture setup ===");
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const organizer = await prisma.user.create({
    data: { name: "E2E Organizer", email: EMAIL, passwordHash },
  });
  const now = new Date();
  const tournament = await prisma.tournament.create({
    data: {
      slug: SLUG,
      name: "Team Format E2E Open",
      venue: "Test Arena",
      startDate: now,
      endDate: now,
      registrationDeadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      organizerId: organizer.id,
    },
  });
  console.log(`Created tournament ${tournament.slug} (organizer ${organizer.email})`);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on("dialog", (d) => d.accept());
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("CONSOLE ERROR:", msg.text());
  });

  // --- shared helpers -------------------------------------------------
  async function submitLineup(tieDetailUrl, slotLabel, side, team, memberNames) {
    const slotCard = page.locator("li", { has: page.locator(`h3:has-text("${slotLabel}")`) });
    const column = slotCard.locator(side === 1 ? "div.grid > div:nth-child(1)" : "div.grid > div:nth-child(2)");
    await column.locator('select[name="memberId1"]').selectOption({ label: `${team.name} ${memberNames[0]}` });
    if (memberNames.length === 2) {
      await column.locator('select[name="memberId2"]').selectOption({ label: `${team.name} ${memberNames[1]}` });
    }
    await column.locator('button:has-text("Save lineup")').click();
    await column.locator("span.text-sm.font-medium").waitFor({ timeout: 10000 });
  }

  async function manualScoreRubber(eventId, matchId, winnerSide, score) {
    await page.goto(`${BASE}/organizer/${SLUG}/matches?event=${eventId}`);
    const liveLink = page.locator(`a[href="/organizer/${SLUG}/matches/${matchId}"]`);
    const row = page.locator("li", { has: liveLink });
    await row.locator('summary:has-text("Enter manually")').click();
    await row.locator('select[name="status"]').selectOption("COMPLETED");
    for (let i = 0; i < score.length; i++) {
      const [a, b] = winnerSide === 1 ? score[i] : [score[i][1], score[i][0]];
      await row.locator(`input[name="game${i + 1}Entry1"]`).fill(String(a));
      await row.locator(`input[name="game${i + 1}Entry2"]`).fill(String(b));
    }
    const alertBefore = await row.locator('[role="alert"]').allTextContents();
    await row.locator('button:has-text("Save result")').click();
    try {
      // The "Live match score" link only exists while the match is unscored
      // — once the result is saved, that whole branch is replaced, so its
      // disappearance is the signal the save actually went through.
      await liveLink.waitFor({ state: "detached", timeout: 10000 });
    } catch (err) {
      const alertText = await row.locator('[role="alert"]').allTextContents();
      console.log("DEBUG manualScoreRubber failure. Alert before:", alertBefore, "after:", alertText);
      console.log("DEBUG row text:", await row.innerText().catch(() => "<row gone>"));
      throw err;
    }
  }

  async function liveScoreRubberStraight(matchId, pointsToWin, gamesToWin) {
    await page.goto(`${BASE}/organizer/${SLUG}/matches/${matchId}`);
    await page.locator('select[name="court"]').selectOption({ index: 1 });
    await page.locator('button:has-text("serves first")').first().click();
    await page.locator('[aria-label^="Point for"]').first().waitFor({ timeout: 10000 });

    const firstLabel = await page.locator('[aria-label^="Point for"]').first().getAttribute("aria-label");
    const winnerButton = page.locator(`[aria-label="${firstLabel}"]`);
    for (let game = 0; game < gamesToWin; game++) {
      for (let i = 0; i < pointsToWin; i++) {
        await winnerButton.click();
        // The score updates optimistically but syncs to the server in the
        // background (see LiveScorer's apply()) — a short pause between taps
        // avoids racing overlapping recordPoint calls, same as a human would.
        await page.waitForTimeout(60);
      }
    }
    await page.waitForTimeout(500);
    await page.locator('button:has-text("Confirm & save result")').click();
    try {
      await page.waitForFunction(
        (path) => window.location.pathname === path,
        `/organizer/${SLUG}/matches`,
        { timeout: 30000 },
      );
    } catch (err) {
      console.log("DEBUG after confirm click, url:", page.url());
      const dbMatch = await prisma.match.findUnique({ where: { id: matchId } });
      console.log("DEBUG match row in DB:", dbMatch);
      throw err;
    }
  }

  try {
    console.log("=== Sign in ===");
    await page.goto(`${BASE}/signin`);
    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="password"]', PASSWORD);
    await page.click('button:has-text("Sign in")');
    await page.waitForURL((u) => !u.pathname.startsWith("/signin"), { timeout: 10000 });
    console.log("Signed in OK");

    // ---------------------------------------------------------------
    // Event 1: knockout team event, standard 5-match tie preset
    // ---------------------------------------------------------------
    console.log("=== Create knockout team event (standard preset) ===");
    await page.goto(`${BASE}/organizer/${SLUG}/events`);
    const addEventForm = page.locator('form:has(button:has-text("Add event"))');
    await addEventForm.locator('select[name="eventNamePreset"]').selectOption("__OTHER__");
    await addEventForm.locator('input[name="customEventName"]').fill("City Shield");
    await addEventForm.locator('select[name="customEventCategory"]').selectOption("TEAM");
    await addEventForm.locator('select[name="tieFormatPreset"]').waitFor({ timeout: 5000 });
    const drawFormatOptions = await addEventForm.locator('select[name="drawFormat"] option').allTextContents();
    assert(!drawFormatOptions.some((t) => t.includes("Pools")), "pools+knockout should be hidden for TEAM events");
    const updateButtonCountBefore = await page.locator('button:has-text("Update")').count();
    await addEventForm.locator('button:has-text("Add event")').click();
    await page.waitForFunction(
      (n) => document.querySelectorAll("button").length > 0 && [...document.querySelectorAll("button")].filter((b) => b.textContent === "Update").length > n,
      updateButtonCountBefore,
      { timeout: 10000 },
    );
    console.log("Event created in UI");

    const knockoutEvent = await prisma.event.findFirst({
      where: { tournament: { slug: SLUG }, name: "City Shield" },
      include: { tieFormatSlots: { orderBy: { order: "asc" } } },
    });
    assert(knockoutEvent, "knockout event should exist in DB");
    assert(knockoutEvent.category === "TEAM", "category should be TEAM");
    assert(knockoutEvent.drawFormat === "SINGLE_ELIMINATION", "drawFormat should default to SINGLE_ELIMINATION");
    assert(knockoutEvent.tieFormatSlots.length === 5, `expected 5 tie slots, got ${knockoutEvent.tieFormatSlots.length}`);
    assert(
      knockoutEvent.tieFormatSlots.map((s) => s.type).join(",") === "DOUBLES,SINGLES,DOUBLES,SINGLES,SINGLES",
      "standard preset slot types should match",
    );
    console.log("DB verified: TEAM category, knockout, 5 standard tie slots");

    // ---------------------------------------------------------------
    // Create 4 teams with rosters
    // ---------------------------------------------------------------
    console.log("=== Create 4 teams with rosters ===");
    await page.goto(`${BASE}/organizer/${SLUG}/teams/${knockoutEvent.id}`);
    const teamNames = ["Falcons", "Hawks", "Eagles", "Owls"];
    for (const name of teamNames) {
      await page.locator('form:has(button:has-text("Add team"))').locator('input[name="name"]').fill(name);
      await page.locator('form:has(button:has-text("Add team"))').locator('button:has-text("Add team")').click();
      await page.waitForFunction((n) => document.body.innerText.includes(n), name, { timeout: 10000 });
    }

    const teams = await prisma.team.findMany({ where: { eventId: knockoutEvent.id }, orderBy: { createdAt: "asc" } });
    assert(teams.length === 4, `expected 4 teams, got ${teams.length}`);
    for (const team of teams) assert(team.entryId !== null, `team ${team.name} should have a shim entry`);
    console.log("DB verified: 4 teams with shim entries");

    for (const team of teams) {
      const teamCard = page.locator("li", { has: page.locator(`h3:has-text("${team.name}")`) });
      for (let i = 1; i <= 4; i++) {
        const addForm = teamCard.locator('form:has(button:has-text("Add to roster"))');
        await addForm.locator('input[name="name"]').fill(`${team.name} P${i}`);
        await addForm.locator('button:has-text("Add to roster")').click();
        await page.waitForFunction((n) => document.body.innerText.includes(n), `${team.name} P${i}`, { timeout: 10000 });
      }
    }

    const members = await prisma.teamMember.findMany({ where: { team: { eventId: knockoutEvent.id } } });
    assert(members.length === 16, `expected 16 roster members total, got ${members.length}`);
    console.log("DB verified: 4 roster members per team");

    // ---------------------------------------------------------------
    // Generate + publish the knockout draw
    // ---------------------------------------------------------------
    console.log("=== Generate + publish knockout draw ===");
    await page.goto(`${BASE}/organizer/${SLUG}/teams/${knockoutEvent.id}`);
    await page.locator('button:has-text("Generate draw")').click();
    await page.locator('button:has-text("Publish draw")').waitFor({ timeout: 10000 });

    let ties = await prisma.tie.findMany({ where: { eventId: knockoutEvent.id }, orderBy: [{ round: "asc" }, { position: "asc" }] });
    assert(ties.length === 3, `expected 3 ties (2 round1 + 1 final), got ${ties.length}`);
    assert(ties.filter((t) => t.round === 1).length === 2, "expected 2 round-1 ties");
    assert(ties.filter((t) => t.round === 2).length === 1, "expected 1 final tie");
    console.log("DB verified: 3 ties generated (2 semis + 1 final)");

    await page.locator('button:has-text("Publish draw")').click();
    await page.waitForFunction(() => document.body.innerText.includes("Published"), null, { timeout: 10000 });
    const publishedEvent = await prisma.event.findUnique({ where: { id: knockoutEvent.id } });
    assert(publishedEvent.drawPublished === true, "event should be published");
    console.log("DB verified: draw published");

    const round1Ties = ties.filter((t) => t.round === 1).sort((a, b) => a.position - b.position);
    const finalTie = ties.find((t) => t.round === 2);
    const teamByEntryId = new Map(teams.map((t) => [t.entryId, t]));

    // ---------------------------------------------------------------
    // Tie 1: submit lineups for both sides, score 3 rubbers manually + 1 live, then the 5th manually
    // ---------------------------------------------------------------
    console.log("=== Tie 1: lineups + scoring ===");
    const tie1 = round1Ties[0];
    const tie1Team1 = teamByEntryId.get(tie1.team1Id);
    const tie1Team2 = teamByEntryId.get(tie1.team2Id);
    assert(tie1Team1 && tie1Team2, "tie1 should have two real teams");
    console.log(`Tie 1: ${tie1Team1.name} vs ${tie1Team2.name}`);

    const tie1Url = `${BASE}/organizer/${SLUG}/teams/${knockoutEvent.id}/ties/${tie1.id}`;
    await page.goto(tie1Url);
    const slots = knockoutEvent.tieFormatSlots;
    for (const slot of slots) {
      const names = slot.type === "DOUBLES" ? ["P1", "P2"] : ["P1"];
      await submitLineup(tie1Url, slot.label, 1, tie1Team1, names);
      await submitLineup(tie1Url, slot.label, 2, tie1Team2, names);
    }
    console.log("Lineups submitted for all 5 slots, both sides");

    const tie1Matches = await prisma.match.findMany({ where: { tieId: tie1.id }, orderBy: { position: "asc" } });
    assert(tie1Matches.length === 5, `expected 5 rubber matches for tie1, got ${tie1Matches.length}`);
    for (const m of tie1Matches) {
      assert(m.entry1Id && m.entry2Id, `rubber ${m.id} should have both entries set`);
      assert(m.gamesPerMatch === 3 && m.pointsPerGame === 21, "rubber should inherit the standard slot format");
    }
    console.log("DB verified: 5 rubber matches created with both sides + inherited format");

    const [doubles1, singles1, doubles2, singles2, singles3] = tie1Matches;

    await manualScoreRubber(knockoutEvent.id, doubles1.id, 1, [
      [21, 15],
      [21, 18],
    ]);
    await manualScoreRubber(knockoutEvent.id, singles1.id, 1, [
      [21, 10],
      [21, 12],
    ]);
    console.log("Doubles 1 + Singles 1 scored manually (team1 2-0)");

    console.log("Live-scoring Doubles 2...");
    await liveScoreRubberStraight(doubles2.id, 21, 2);
    console.log("Doubles 2 live-scored (team1 wins straight games) -> should clinch the tie at 3-0");

    let tie1Row = await prisma.tie.findUnique({ where: { id: tie1.id } });
    assert(tie1Row.winnerId === tie1.team1Id, `tie1 should be clinched by team1 after 3 rubbers (winnerId=${tie1Row.winnerId})`);
    console.log("DB verified: tie1 clinched at 3-0 after Doubles 2, before Singles 2/3 are played");

    // Still playable after clinching (no early-stop) — score the remaining 2 for team2.
    await manualScoreRubber(knockoutEvent.id, singles2.id, 2, [
      [15, 21],
      [12, 21],
    ]);
    await manualScoreRubber(knockoutEvent.id, singles3.id, 2, [
      [18, 21],
      [10, 21],
    ]);
    tie1Row = await prisma.tie.findUnique({ where: { id: tie1.id } });
    assert(tie1Row.winnerId === tie1.team1Id, "tie1 winner should remain team1 (3-2) after playing out the rest");
    const finalRubberCount = await prisma.match.count({ where: { tieId: tie1.id, status: { not: null } } });
    assert(finalRubberCount === 5, `expected all 5 rubbers decided, got ${finalRubberCount}`);
    console.log("DB verified: all 5 rubbers played, tie1 final score 3-2 to team1, no early-stop enforced");

    // ---------------------------------------------------------------
    // Tie 2: clinch quickly (3 rubbers), leave the rest unplayed
    // ---------------------------------------------------------------
    console.log("=== Tie 2: lineups + quick clinch ===");
    const tie2 = round1Ties[1];
    const tie2Team1 = teamByEntryId.get(tie2.team1Id);
    const tie2Team2 = teamByEntryId.get(tie2.team2Id);
    console.log(`Tie 2: ${tie2Team1.name} vs ${tie2Team2.name}`);

    const tie2Url = `${BASE}/organizer/${SLUG}/teams/${knockoutEvent.id}/ties/${tie2.id}`;
    await page.goto(tie2Url);
    for (const slot of slots.slice(0, 3)) {
      const names = slot.type === "DOUBLES" ? ["P1", "P2"] : ["P1"];
      await submitLineup(tie2Url, slot.label, 1, tie2Team1, names);
      await submitLineup(tie2Url, slot.label, 2, tie2Team2, names);
    }

    const tie2Matches = await prisma.match.findMany({ where: { tieId: tie2.id }, orderBy: { position: "asc" } });
    assert(tie2Matches.length === 3, `expected 3 rubber matches submitted for tie2, got ${tie2Matches.length}`);
    for (const m of tie2Matches) {
      await manualScoreRubber(knockoutEvent.id, m.id, 1, [
        [21, 5],
        [21, 7],
      ]);
    }

    const tie2Row = await prisma.tie.findUnique({ where: { id: tie2.id } });
    assert(tie2Row.winnerId === tie2.team1Id, "tie2 should be clinched by team1 at 3-0");
    const tie2PlayedCount = await prisma.match.count({ where: { tieId: tie2.id } });
    assert(tie2PlayedCount === 3, `tie2 should have only 3 rubber matches (lineups never submitted for slots 4/5), got ${tie2PlayedCount}`);
    console.log("DB verified: tie2 clinched 3-0, remaining slots never even got lineups (also fine)");

    // ---------------------------------------------------------------
    // Verify the final advanced correctly
    // ---------------------------------------------------------------
    const finalRow = await prisma.tie.findUnique({ where: { id: finalTie.id } });
    assert(finalRow.team1Id === tie1.team1Id, "final's team1 should be tie1's winner");
    assert(finalRow.team2Id === tie2.team1Id, "final's team2 should be tie2's winner");
    console.log(`DB verified: final advanced to ${tie1Team1.name} vs ${tie2Team1.name}`);

    await page.goto(`${BASE}/organizer/${SLUG}/teams/${knockoutEvent.id}`);
    await page.waitForFunction(
      (names) => names.every((n) => document.body.innerText.includes(n)),
      [tie1Team1.name, tie2Team1.name],
      { timeout: 10000 },
    );
    console.log("Bracket view shows the advanced final matchup");

    // ---------------------------------------------------------------
    // Event 2: round-robin team event, custom fast tie format
    // ---------------------------------------------------------------
    console.log("=== Create round-robin team event (custom preset) ===");
    await page.goto(`${BASE}/organizer/${SLUG}/events`);
    const addEventForm2 = page.locator('form:has(button:has-text("Add event"))');
    await addEventForm2.locator('select[name="eventNamePreset"]').selectOption("__OTHER__");
    await addEventForm2.locator('input[name="customEventName"]').fill("Regional League");
    await addEventForm2.locator('select[name="customEventCategory"]').selectOption("TEAM");
    await addEventForm2.locator('select[name="tieFormatPreset"]').waitFor({ timeout: 5000 });
    await addEventForm2.locator('select[name="drawFormat"]').selectOption("ROUND_ROBIN");
    await addEventForm2.locator('select[name="tieFormatPreset"]').selectOption("CUSTOM");
    for (let i = 0; i < 5; i++) {
      await addEventForm2.locator(`select[name="tieSlotGames-${i}"]`).selectOption("1");
      await addEventForm2.locator(`input[name="tieSlotPoints-${i}"]`).fill("5");
    }
    const updateButtonCountBefore2 = await page.locator('button:has-text("Update")').count();
    await addEventForm2.locator('button:has-text("Add event")').click();
    await page.waitForFunction(
      (n) => [...document.querySelectorAll("button")].filter((b) => b.textContent === "Update").length > n,
      updateButtonCountBefore2,
      { timeout: 10000 },
    );

    const rrEvent = await prisma.event.findFirst({
      where: { tournament: { slug: SLUG }, name: "Regional League" },
      include: { tieFormatSlots: { orderBy: { order: "asc" } } },
    });
    assert(rrEvent, "round robin event should exist");
    assert(rrEvent.drawFormat === "ROUND_ROBIN", "drawFormat should be ROUND_ROBIN");
    assert(
      rrEvent.tieFormatSlots.every((s) => s.gamesPerMatch === 1 && s.pointsPerGame === 5),
      "custom tie format should be 1 game to 5 points on every slot",
    );
    console.log("DB verified: round-robin event with custom fast tie format");

    console.log("=== Create 3 teams with rosters ===");
    await page.goto(`${BASE}/organizer/${SLUG}/teams/${rrEvent.id}`);
    const rrTeamNames = ["Lions", "Tigers", "Bears"];
    for (const name of rrTeamNames) {
      await page.locator('form:has(button:has-text("Add team"))').locator('input[name="name"]').fill(name);
      await page.locator('form:has(button:has-text("Add team"))').locator('button:has-text("Add team")').click();
      await page.waitForFunction((n) => document.body.innerText.includes(n), name, { timeout: 10000 });
    }
    const rrTeams = await prisma.team.findMany({ where: { eventId: rrEvent.id }, orderBy: { createdAt: "asc" } });
    assert(rrTeams.length === 3, `expected 3 teams, got ${rrTeams.length}`);
    for (const team of rrTeams) {
      const teamCard = page.locator("li", { has: page.locator(`h3:has-text("${team.name}")`) });
      for (let i = 1; i <= 2; i++) {
        const addForm = teamCard.locator('form:has(button:has-text("Add to roster"))');
        await addForm.locator('input[name="name"]').fill(`${team.name} P${i}`);
        await addForm.locator('button:has-text("Add to roster")').click();
        await page.waitForFunction((n) => document.body.innerText.includes(n), `${team.name} P${i}`, { timeout: 10000 });
      }
    }
    console.log("DB verified: 3 round-robin teams with rosters");

    console.log("=== Generate + publish round-robin draw ===");
    await page.goto(`${BASE}/organizer/${SLUG}/teams/${rrEvent.id}`);
    await page.locator('button:has-text("Generate draw")').click();
    await page.locator('button:has-text("Publish draw")').waitFor({ timeout: 10000 });
    let rrTies = await prisma.tie.findMany({ where: { eventId: rrEvent.id } });
    assert(rrTies.length === 3, `expected 3 round-robin ties, got ${rrTies.length}`);
    await page.locator('button:has-text("Publish draw")').click();
    await page.waitForFunction(() => document.body.innerText.includes("Published"), null, { timeout: 10000 });
    console.log("DB verified: 3 round-robin ties generated and published");

    const rrTeamByEntryId = new Map(rrTeams.map((t) => [t.entryId, t]));
    async function playOutTieFully(tie, winnerTeam) {
      const t1 = rrTeamByEntryId.get(tie.team1Id);
      const t2 = rrTeamByEntryId.get(tie.team2Id);
      const tieUrl = `${BASE}/organizer/${SLUG}/teams/${rrEvent.id}/ties/${tie.id}`;
      await page.goto(tieUrl);
      for (const slot of rrEvent.tieFormatSlots) {
        const names = slot.type === "DOUBLES" ? ["P1", "P2"] : ["P1"];
        await submitLineup(tieUrl, slot.label, 1, t1, names);
        await submitLineup(tieUrl, slot.label, 2, t2, names);
      }
      const matches = await prisma.match.findMany({ where: { tieId: tie.id }, orderBy: { position: "asc" } });
      for (const m of matches) {
        const winnerIsSide1 = winnerTeam.id === t1.id;
        await manualScoreRubber(rrEvent.id, m.id, winnerIsSide1 ? 1 : 2, [[5, 0]]);
      }
    }

    const tieXY = rrTies.find(
      (t) =>
        [rrTeamByEntryId.get(t.team1Id)?.name, rrTeamByEntryId.get(t.team2Id)?.name].sort().join() ===
        ["Lions", "Tigers"].sort().join(),
    );
    const tieXZ = rrTies.find(
      (t) =>
        [rrTeamByEntryId.get(t.team1Id)?.name, rrTeamByEntryId.get(t.team2Id)?.name].sort().join() ===
        ["Lions", "Bears"].sort().join(),
    );
    const tieYZ = rrTies.find(
      (t) =>
        [rrTeamByEntryId.get(t.team1Id)?.name, rrTeamByEntryId.get(t.team2Id)?.name].sort().join() ===
        ["Tigers", "Bears"].sort().join(),
    );
    const lions = rrTeams.find((t) => t.name === "Lions");
    const tigers = rrTeams.find((t) => t.name === "Tigers");
    const bears = rrTeams.find((t) => t.name === "Bears");

    console.log("=== Playing out all 3 round-robin ties (Lions win both, Tigers beat Bears) ===");
    await playOutTieFully(tieXY, lions);
    await playOutTieFully(tieXZ, lions);
    await playOutTieFully(tieYZ, tigers);

    const decidedTies = await prisma.tie.findMany({ where: { eventId: rrEvent.id } });
    assert(decidedTies.every((t) => t.winnerId !== null), "every round-robin tie should have a winner");
    const lionsWins = decidedTies.filter((t) => t.winnerId === lions.entryId).length;
    const tigersWins = decidedTies.filter((t) => t.winnerId === tigers.entryId).length;
    const bearsWins = decidedTies.filter((t) => t.winnerId === bears.entryId).length;
    assert(lionsWins === 2, `Lions should have 2 wins, got ${lionsWins}`);
    assert(tigersWins === 1, `Tigers should have 1 win, got ${tigersWins}`);
    assert(bearsWins === 0, `Bears should have 0 wins, got ${bearsWins}`);
    console.log("DB verified: round-robin results — Lions 2-0, Tigers 1-1, Bears 0-2");

    await page.goto(`${BASE}/organizer/${SLUG}/teams/${rrEvent.id}`);
    const standingsText = await page.locator("table").innerText();
    const lionsLineIndex = standingsText.indexOf("Lions");
    const bearsLineIndex = standingsText.indexOf("Bears");
    assert(lionsLineIndex !== -1 && bearsLineIndex !== -1 && lionsLineIndex < bearsLineIndex, "Lions should rank above Bears in the standings table");
    console.log("UI verified: standings table ranks Lions above Bears");

    console.log("\n=== ALL CHECKS PASSED ===");
  } finally {
    await browser.close();
  }
}

main()
  .catch((err) => {
    console.error("E2E FAILED:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    console.log("=== Cleanup ===");
    try {
      const organizer = await prisma.user.findUnique({ where: { email: EMAIL } });
      if (organizer) {
        await prisma.tournament.deleteMany({ where: { organizerId: organizer.id } });
        await prisma.user.delete({ where: { id: organizer.id } });
        console.log("Cleaned up fixture tournament + organizer");
      }
    } catch (cleanupErr) {
      console.error("CLEANUP FAILED:", cleanupErr);
    }
    await prisma.$disconnect();
  });
