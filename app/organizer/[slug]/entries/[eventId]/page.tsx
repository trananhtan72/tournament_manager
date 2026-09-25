import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOrganizerId } from "@/lib/organizerAccess";
import { drawFormatLabels, isDoublesCategory } from "@/lib/eventLabels";
import { playerName as getPlayerName } from "@/lib/playerDisplay";
import { describeEventGameFormats } from "@/lib/tournament/gameFormat";
import { EntrySeedField } from "@/components/EntrySeedField";
import { RemoveEntryButton } from "@/components/RemoveEntryButton";
import { PendingEntryActions } from "@/components/PendingEntryActions";
import { EntryPlayersWithEmail } from "@/components/EntryPlayersWithEmail";
import { PairEntriesForm } from "@/app/organizer/[slug]/entries/PairEntriesForm";
import { QuickAddEntryForm } from "@/app/organizer/[slug]/entries/QuickAddEntryForm";

export default async function EventEntriesPage({
  params,
}: PageProps<"/organizer/[slug]/entries/[eventId]">) {
  const { slug, eventId } = await params;
  const userId = await requireOrganizerId();

  const event = await prisma.event.findFirst({
    where: { id: eventId, tournament: { slug, organizerId: userId } },
    include: {
      entries: {
        include: { players: { include: { user: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!event) notFound();

  const pendingApproval = event.entries.filter((e) => e.status === "PENDING_APPROVAL");
  const confirmed = event.entries.filter((e) => e.status === "CONFIRMED");
  const pendingPartner = event.entries.filter((e) => e.status === "PENDING_PARTNER");
  const needsPartner = event.entries.filter((e) => e.status === "NEEDS_PARTNER");

  const pairCandidates = needsPartner.map((e) => ({
    entryId: e.id,
    playerName: e.players[0] ? getPlayerName(e.players[0]) : "Unknown",
  }));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {drawFormatLabels[event.drawFormat]} · {describeEventGameFormats(event)}
        </p>
        <Link href={`/organizer/${slug}/draws#draw-${event.id}`} className="text-sm underline">
          Go to this draw →
        </Link>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Pending approval ({pendingApproval.length})</h2>
        {pendingApproval.length === 0 ? (
          <p className="text-sm text-slate-500">No registrations waiting for approval.</p>
        ) : (
          <>
            <p className="text-sm text-slate-500">
              Players who registered themselves. Approve a registration to move it to the
              confirmed entries; only confirmed entries go into the draw.
            </p>
            <ul className="flex flex-col gap-2">
              {pendingApproval.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950/40"
                >
                  <EntryPlayersWithEmail players={entry.players} />
                  <PendingEntryActions entryId={entry.id} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Confirmed entries ({confirmed.length})</h2>
        {confirmed.length === 0 ? (
          <p className="text-sm text-slate-500">No confirmed entries yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {confirmed.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 px-4 py-3 dark:border-slate-700"
              >
                <EntryPlayersWithEmail players={entry.players} />
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
    </div>
  );
}
