import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { drawFormatLabels, isDoublesCategory } from "@/lib/eventLabels";
import { playerName as getPlayerName } from "@/lib/playerDisplay";
import { ActionForm } from "@/components/ActionForm";
import { EntrySeedField } from "@/components/EntrySeedField";
import { RemoveEntryButton } from "@/components/RemoveEntryButton";
import { Bracket, type BracketMatchView } from "@/components/Bracket";
import { publishDraw, unpublishDraw } from "@/app/actions/draws";
import { PairEntriesForm } from "@/app/organizer/[slug]/[eventId]/PairEntriesForm";
import { QuickAddEntryForm } from "@/app/organizer/[slug]/[eventId]/QuickAddEntryForm";
import { GenerateDrawForm } from "@/app/organizer/[slug]/[eventId]/GenerateDrawForm";
import { PrintDrawButton } from "@/components/PrintDrawButton";

function entryLabel(entry: { players: { guestName: string | null; user: { name: string; email: string } | null }[] }) {
  return entry.players.map((p) => getPlayerName(p)).join(" / ");
}

export default async function ManageEventPage({
  params,
}: PageProps<"/organizer/[slug]/[eventId]">) {
  const { slug, eventId } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      tournament: true,
      entries: {
        include: { players: { include: { user: true } } },
        orderBy: { createdAt: "asc" },
      },
      matches: {
        include: {
          entry1: { include: { players: { include: { user: true } } } },
          entry2: { include: { players: { include: { user: true } } } },
          winner: { include: { players: { include: { user: true } } } },
        },
        orderBy: [{ round: "asc" }, { position: "asc" }],
      },
    },
  });

  if (!event || event.tournament.slug !== slug || event.tournament.organizerId !== session.user.id) {
    notFound();
  }

  const confirmed = event.entries.filter((e) => e.status === "CONFIRMED");
  const pendingPartner = event.entries.filter((e) => e.status === "PENDING_PARTNER");
  const needsPartner = event.entries.filter((e) => e.status === "NEEDS_PARTNER");

  const pairCandidates = needsPartner.map((e) => ({
    entryId: e.id,
    playerName: e.players[0] ? getPlayerName(e.players[0]) : "Unknown",
  }));

  const bracketMatches: BracketMatchView[] = event.matches.map((m) => ({
    id: m.id,
    round: m.round,
    position: m.position,
    entry1Label: m.entry1 ? entryLabel(m.entry1) : null,
    entry1Seed: m.entry1?.seed ?? null,
    entry2Label: m.entry2 ? entryLabel(m.entry2) : null,
    entry2Seed: m.entry2?.seed ?? null,
    winnerLabel: m.winner ? entryLabel(m.winner) : null,
    isBye: m.isBye,
  }));

  const unpublishWithId = unpublishDraw.bind(null, event.id);
  const publishWithId = publishDraw.bind(null, event.id);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href={`/organizer/${slug}`} className="text-sm underline">
          ← {event.tournament.name}
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold">{event.name}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Draw format: {drawFormatLabels[event.drawFormat]}
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Confirmed entries ({confirmed.length})</h2>
        {confirmed.length === 0 ? (
          <p className="text-sm text-slate-500">No confirmed entries yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {confirmed.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-4 py-3 dark:border-slate-700"
              >
                <span className="text-sm">
                  {entry.players.map((p) => getPlayerName(p)).join(" / ")}
                </span>
                <div className="flex items-center gap-3">
                  <EntrySeedField
                    key={`${entry.id}:${entry.seed}`}
                    entryId={entry.id}
                    currentSeed={entry.seed}
                    disabled={event.drawPublished}
                  />
                  <RemoveEntryButton entryId={entry.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {pendingPartner.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">
            Awaiting partner confirmation ({pendingPartner.length})
          </h2>
          <ul className="flex flex-col gap-2">
            {pendingPartner.map((entry) => {
              const initiator = entry.players.find((p) => p.role === "INITIATOR");
              const partner = entry.players.find((p) => p.role === "PARTNER");
              return (
                <li
                  key={entry.id}
                  className="flex items-center justify-between rounded-md border border-slate-200 px-4 py-3 dark:border-slate-700"
                >
                  <span className="text-sm">
                    {initiator ? getPlayerName(initiator) : "Unknown"} → invited{" "}
                    {partner ? getPlayerName(partner) : "Unknown"} (unconfirmed)
                  </span>
                  <RemoveEntryButton entryId={entry.id} />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Needs a partner ({needsPartner.length})</h2>
        {needsPartner.length === 0 ? (
          <p className="text-sm text-slate-500">No unpaired registrations.</p>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {needsPartner.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between rounded-md border border-slate-200 px-4 py-3 dark:border-slate-700"
                >
                  <span className="text-sm">
                    {entry.players[0] ? getPlayerName(entry.players[0]) : "Unknown"}
                  </span>
                  <RemoveEntryButton entryId={entry.id} />
                </li>
              ))}
            </ul>
            {needsPartner.length >= 2 && (
              <PairEntriesForm eventId={event.id} candidates={pairCandidates} />
            )}
          </>
        )}
      </section>

      <section className="flex flex-col gap-3 border-t border-slate-200 pt-6 dark:border-slate-800">
        <h2 className="text-lg font-semibold">Quick add entry</h2>
        <p className="text-sm text-slate-500">
          For in-person or cash registrations. Leave email blank to add a player without an
          account.
        </p>
        <QuickAddEntryForm eventId={event.id} isDoubles={isDoublesCategory(event.category)} />
      </section>

      <section className="flex flex-col gap-4 border-t border-slate-200 pt-6 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Draw</h2>
          {event.drawPublished && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
              Published
            </span>
          )}
        </div>

        {event.drawFormat !== "SINGLE_ELIMINATION" ? (
          <p className="text-sm text-slate-500">
            Draw generation for {drawFormatLabels[event.drawFormat]} isn&apos;t available yet.
          </p>
        ) : (
          <>
            {bracketMatches.length === 0 ? (
              <p className="text-sm text-slate-500">
                No draw yet. Assign seeds above if you like, then generate the draw once your
                confirmed entries are set (4–64 required).
              </p>
            ) : (
              <div id="printable-draw">
                <div className="hidden print:block print:mb-4">
                  <h1 className="text-xl font-semibold">
                    {event.tournament.name} — {event.name}
                  </h1>
                  <p className="text-sm text-slate-600">
                    Draw format: {drawFormatLabels[event.drawFormat]}
                  </p>
                </div>
                <Bracket matches={bracketMatches} />
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 print:hidden">
              {!event.drawPublished && (
                <GenerateDrawForm eventId={event.id} hasExistingDraw={bracketMatches.length > 0} />
              )}
              {bracketMatches.length > 0 && !event.drawPublished && (
                <ActionForm
                  action={publishWithId}
                  variant="primary"
                  label="Publish draw"
                  pendingLabel="Publishing…"
                  confirmMessage="Publish this draw? Players will be able to see it, and it can no longer be regenerated."
                />
              )}
              {event.drawPublished && (
                <ActionForm
                  action={unpublishWithId}
                  variant="secondary"
                  label="Unpublish"
                  pendingLabel="Unpublishing…"
                  confirmMessage="Unpublish this draw so you can make changes and regenerate it?"
                />
              )}
              {bracketMatches.length > 0 && <PrintDrawButton />}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
