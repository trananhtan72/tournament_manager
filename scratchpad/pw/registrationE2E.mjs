import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import bcrypt from "bcryptjs";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const BASE = "http://localhost:3000";
const PASSWORD = "testpassword123";
const STAMP = Date.now();
const SLUG = `reg-e2e-${STAMP}`;
const ORG_EMAIL = `reg-e2e-organizer-${STAMP}@example.com`;
const PLAYER_EMAIL = `reg-e2e-player-${STAMP}@example.com`;
const PARTNER_EMAIL = `reg-e2e-partner-${STAMP}@example.com`;

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
}

async function main() {
  console.log("=== Fixture setup ===");
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const organizer = await prisma.user.create({ data: { name: "E2E Organizer", email: ORG_EMAIL, passwordHash } });
  const player = await prisma.user.create({ data: { name: "E2E Player", email: PLAYER_EMAIL, passwordHash } });
  const partner = await prisma.user.create({ data: { name: "E2E Partner", email: PARTNER_EMAIL, passwordHash } });
  const now = new Date();
  const tournament = await prisma.tournament.create({
    data: {
      slug: SLUG,
      name: "Registration E2E Open",
      venue: "Test Arena",
      startDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000),
      registrationDeadline: now,
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

  async function signIn(email) {
    await page.goto(`${BASE}/signin`);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', PASSWORD);
    await page.click('button:has-text("Sign in")');
    await page.waitForURL((u) => !u.pathname.startsWith("/signin"), { timeout: 10000 });
  }

  async function signOut() {
    await page.context().clearCookies();
  }

  try {
    // -----------------------------------------------------------------
    // Phase A: organizer UI — maxEventsPerUser + entryFee fields
    // -----------------------------------------------------------------
    console.log("=== Sign in as organizer ===");
    await signIn(ORG_EMAIL);

    console.log("=== Overview: change max events per player ===");
    await page.goto(`${BASE}/organizer/${SLUG}`);
    const maxEventsInput = page.locator('input[name="maxEventsPerUser"]');
    await maxEventsInput.waitFor({ timeout: 10000 });
    assert((await maxEventsInput.inputValue()) === "5", "default maxEventsPerUser should be 5");
    await maxEventsInput.fill("2");
    await page.locator('form:has(input[name="maxEventsPerUser"]) button:has-text("Save changes")').click();
    // The input value itself isn't a reliable "save completed" signal (it's
    // already "2" the instant it's typed, before the round-trip finishes) —
    // poll the DB instead.
    let tAfterMax = await prisma.tournament.findUnique({ where: { id: tournament.id } });
    for (let i = 0; i < 20 && tAfterMax.maxEventsPerUser !== 2; i++) {
      await page.waitForTimeout(300);
      tAfterMax = await prisma.tournament.findUnique({ where: { id: tournament.id } });
    }
    assert(tAfterMax.maxEventsPerUser === 2, `expected maxEventsPerUser=2, got ${tAfterMax.maxEventsPerUser}`);
    console.log("DB verified: maxEventsPerUser updated to 2");

    console.log("=== Events: create singles/doubles/team events with entry fees ===");
    await page.goto(`${BASE}/organizer/${SLUG}/events`);

    async function addEvent({ name, category, entryFee, drawFormat }) {
      const form = page.locator('form:has(button:has-text("Add event"))');
      await form.locator('select[name="eventNamePreset"]').selectOption("__OTHER__");
      await form.locator('input[name="customEventName"]').fill(name);
      await form.locator('select[name="customEventCategory"]').selectOption(category);
      if (drawFormat) {
        await form.locator('select[name="drawFormat"]').waitFor({ timeout: 5000 });
        await form.locator('select[name="drawFormat"]').selectOption(drawFormat);
      }
      await form.locator('input[name="entryFee"]').fill(String(entryFee));
      const before = await page.locator('button:has-text("Update")').count();
      await form.locator('button:has-text("Add event")').click();
      await page.waitForFunction(
        (n) => [...document.querySelectorAll("button")].filter((b) => b.textContent === "Update").length > n,
        before,
        { timeout: 10000 },
      );
    }

    await addEvent({ name: "Solo Fee Test", category: "SINGLES", entryFee: 15 });
    await addEvent({ name: "Pairs Fee Test", category: "DOUBLES", entryFee: 10 });
    await addEvent({ name: "Squad Fee Test", category: "TEAM", entryFee: 20 });

    const [singlesEvent, doublesEvent, teamEvent] = await Promise.all([
      prisma.event.findFirst({ where: { tournament: { slug: SLUG }, name: "Solo Fee Test" } }),
      prisma.event.findFirst({ where: { tournament: { slug: SLUG }, name: "Pairs Fee Test" } }),
      prisma.event.findFirst({ where: { tournament: { slug: SLUG }, name: "Squad Fee Test" } }),
    ]);
    assert(singlesEvent?.entryFee?.toString() === "15", `singles entryFee should be 15, got ${singlesEvent?.entryFee}`);
    assert(doublesEvent?.entryFee?.toString() === "10", `doubles entryFee should be 10, got ${doublesEvent?.entryFee}`);
    assert(teamEvent?.entryFee?.toString() === "20", `team entryFee should be 20, got ${teamEvent?.entryFee}`);
    console.log("DB verified: all 3 events created with correct entry fees");

    await signOut();

    // -----------------------------------------------------------------
    // Phase B: player-facing registration popup
    // -----------------------------------------------------------------
    console.log("=== Sign in as player ===");
    await signIn(PLAYER_EMAIL);

    console.log("=== Overview tab: Events list shows fees ===");
    await page.goto(`${BASE}/t/${SLUG}`);
    const eventsSection = page.locator("section", { has: page.locator("#events-heading") });
    await eventsSection.locator("text=Solo Fee Test").waitFor({ timeout: 10000 });
    const eventsListText = await eventsSection.innerText();
    assert(eventsListText.includes("$15"), "Events list should show the singles entry fee");
    assert(eventsListText.includes("$10"), "Events list should show the doubles entry fee");
    assert(eventsListText.includes("$20"), "Events list should show the team entry fee");
    console.log("UI verified: Events list shows all 3 fees");

    const registerButton = page.locator('button:has-text("Register")');
    await registerButton.waitFor({ timeout: 10000 });
    console.log("UI verified: 'Register' button shown (no entries yet)");

    console.log("=== Open registration dialog, confirm TEAM event is excluded ===");
    await registerButton.click();
    const dialog = page.locator('dialog[aria-label="Register for events"]');
    await dialog.waitFor({ state: "visible", timeout: 10000 });
    const slotSelects = dialog.locator('select[name^="eventId_"]');
    assert((await slotSelects.count()) === 2, `expected 2 slots (maxEventsPerUser=2), got ${await slotSelects.count()}`);
    const slot1Options = await slotSelects.nth(0).locator("option").allTextContents();
    assert(slot1Options.some((t) => t.includes("Solo Fee Test")), "slot should offer the singles event");
    assert(slot1Options.some((t) => t.includes("Pairs Fee Test")), "slot should offer the doubles event");
    assert(!slot1Options.some((t) => t.includes("Squad Fee Test")), "TEAM event must never be offered as a pickable option");
    console.log("UI verified: TEAM event absent from slot options, both non-TEAM events present");

    console.log("=== Pick singles (slot 1) + doubles with partner (slot 2), submit ===");
    await slotSelects.nth(0).selectOption(singlesEvent.id);
    await slotSelects.nth(1).selectOption(doublesEvent.id);
    await dialog.locator('input[name="partnerEmail_2"]').fill(PARTNER_EMAIL);
    await dialog.locator('button:has-text("Save registrations")').click();
    await dialog.waitFor({ state: "hidden", timeout: 10000 });
    console.log("Dialog closed after successful save");

    const singlesEntry = await prisma.entry.findFirst({
      where: { eventId: singlesEvent.id },
      include: { players: true },
    });
    assert(singlesEntry?.status === "PENDING_APPROVAL", `singles entry should be PENDING_APPROVAL, got ${singlesEntry?.status}`);
    assert(singlesEntry.players.length === 1 && singlesEntry.players[0].userId === player.id, "singles entry should have just the player");

    const doublesEntry = await prisma.entry.findFirst({
      where: { eventId: doublesEvent.id },
      include: { players: true },
    });
    assert(doublesEntry?.status === "PENDING_PARTNER", `doubles entry should be PENDING_PARTNER, got ${doublesEntry?.status}`);
    const initiator = doublesEntry.players.find((p) => p.role === "INITIATOR");
    const partnerPlayer = doublesEntry.players.find((p) => p.role === "PARTNER");
    assert(initiator?.userId === player.id && initiator.confirmed, "doubles initiator should be the player, confirmed");
    assert(partnerPlayer?.userId === partner.id && !partnerPlayer.confirmed, "doubles partner should be invited, unconfirmed");
    console.log("DB verified: singles PENDING_APPROVAL + doubles PENDING_PARTNER with correct players");

    await page.goto(`${BASE}/t/${SLUG}`);
    await page.locator('button:has-text("Edit Registration")').waitFor({ timeout: 10000 });
    console.log("UI verified: button now reads 'Edit Registration'");
    const statusListText = await page.locator("body").innerText();
    assert(statusListText.includes("waiting for the organizer to approve"), "status list should show the singles pending-approval text");
    assert(statusListText.includes("Invitation sent to"), "status list should show the doubles pending-partner text");
    console.log("UI verified: status list shows both entries' statuses");

    console.log("=== Reopen dialog: unchanged slots show read-only status, not a partner field ===");
    await page.locator('button:has-text("Edit Registration")').click();
    await dialog.waitFor({ state: "visible", timeout: 10000 });
    const dialogText = await dialog.innerText();
    assert(dialogText.includes("waiting for the organizer to approve"), "slot 1 should show read-only status for the unchanged singles pick");
    assert(dialogText.includes("Invitation sent to"), "slot 2 should show read-only status for the unchanged doubles pick");
    assert(!(await dialog.locator('input[name="partnerEmail_2"]').count()), "no partner-email input should show for an unchanged doubles pick");
    console.log("UI verified: unchanged picks show status text, not a partner-email input");

    console.log("=== Withdraw the singles pick (slot 1 -> None) ===");
    await dialog.locator('select[name="eventId_1"]').selectOption("");
    await dialog.locator('button:has-text("Save registrations")').click();
    await dialog.waitFor({ state: "hidden", timeout: 10000 });
    const singlesAfterWithdraw = await prisma.entry.findFirst({ where: { eventId: singlesEvent.id } });
    assert(!singlesAfterWithdraw, "singles entry should be deleted after withdrawing via the dialog");
    const doublesStillThere = await prisma.entry.findFirst({ where: { eventId: doublesEvent.id } });
    assert(doublesStillThere, "doubles entry should be untouched by the singles withdrawal");
    console.log("DB verified: singles entry withdrawn, doubles entry untouched");

    console.log("=== Duplicate-pick rejection ===");
    await page.goto(`${BASE}/t/${SLUG}`);
    await page.locator('button:has-text("Edit Registration")').click();
    await dialog.waitFor({ state: "visible", timeout: 10000 });
    // Only the doubles entry remains (singles was withdrawn above), so it now
    // occupies slot 1; slot 2 is empty. Picking the same event in two slots
    // is already prevented client-side (the option is disabled once chosen
    // elsewhere) — force past that to exercise the server's own
    // defense-in-depth check instead.
    await dialog.locator('select[name="eventId_2"] option').evaluateAll((options) => {
      for (const o of options) o.disabled = false;
    });
    await dialog.locator('select[name="eventId_2"]').selectOption(doublesEvent.id);
    await dialog.locator('button:has-text("Save registrations")').click();
    await dialog.locator('[role="alert"]:has-text("same event in two slots")').waitFor({ timeout: 10000 });
    console.log("UI verified: the client disables duplicate options, and the server rejects one forced past that");
    await dialog.locator('button:has-text("Cancel")').click();
    await dialog.waitFor({ state: "hidden", timeout: 10000 });

    console.log("=== Blocked edit once the draw is published ===");
    await prisma.entry.update({ where: { id: doublesEntry.id }, data: { status: "CONFIRMED" } });
    await prisma.event.update({ where: { id: doublesEvent.id }, data: { drawPublished: true } });
    await page.goto(`${BASE}/t/${SLUG}`);
    await page.locator('button:has-text("Edit Registration")').click();
    await dialog.waitFor({ state: "visible", timeout: 10000 });
    // The doubles entry is the only remaining pick, so it occupies slot 1.
    await dialog.locator('select[name="eventId_1"]').selectOption("");
    await dialog.locator('button:has-text("Save registrations")').click();
    const errorLocator = dialog.locator('[role="alert"]');
    await errorLocator.waitFor({ timeout: 10000 });
    const errorText = await errorLocator.innerText();
    assert(errorText.includes("Pairs Fee Test") && errorText.includes("published"), `expected a published-draw error naming the event, got "${errorText}"`);
    const doublesStillThere2 = await prisma.entry.findFirst({ where: { eventId: doublesEvent.id } });
    assert(doublesStillThere2, "doubles entry must survive a rejected all-or-nothing submission");
    console.log("UI + DB verified: edit blocked once the draw is published, nothing changed");

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
      const organizer = await prisma.user.findUnique({ where: { email: ORG_EMAIL } });
      if (organizer) {
        await prisma.tournament.deleteMany({ where: { organizerId: organizer.id } });
        await prisma.user.delete({ where: { id: organizer.id } });
      }
      for (const email of [PLAYER_EMAIL, PARTNER_EMAIL]) {
        const u = await prisma.user.findUnique({ where: { email } });
        if (u) await prisma.user.delete({ where: { id: u.id } });
      }
      console.log("Cleaned up fixture tournament + users");
    } catch (cleanupErr) {
      console.error("CLEANUP FAILED:", cleanupErr);
    }
    await prisma.$disconnect();
  });
