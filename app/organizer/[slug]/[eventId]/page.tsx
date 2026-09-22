import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { drawFormatLabels, isDoublesCategory } from "@/lib/eventLabels";
import { playerName as getPlayerName } from "@/lib/playerDisplay";
import { ActionForm } from "@/components/ActionForm";
import { removeEntryAsOrganizer } from "@/app/actions/entries";
import { PairEntriesForm } from "@/app/organizer/[slug]/[eventId]/PairEntriesForm";
import { QuickAddEntryForm } from "@/app/organizer/[slug]/[eventId]/QuickAddEntryForm";

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
                className="flex items-center justify-between rounded-md border border-slate-200 px-4 py-3 dark:border-slate-700"
              >
                <span className="text-sm">
                  {entry.players.map((p) => getPlayerName(p)).join(" / ")}
                </span>
                <ActionForm
                  action={removeEntryAsOrganizer.bind(null, entry.id)}
                  variant="danger"
                  label="Remove"
                  pendingLabel="Removing…"
                  confirmMessage="Remove this entry?"
                />
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
                  <ActionForm
                    action={removeEntryAsOrganizer.bind(null, entry.id)}
                    variant="danger"
                    label="Remove"
                    pendingLabel="Removing…"
                    confirmMessage="Remove this entry?"
                  />
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
                  <ActionForm
                    action={removeEntryAsOrganizer.bind(null, entry.id)}
                    variant="danger"
                    label="Remove"
                    pendingLabel="Removing…"
                    confirmMessage="Remove this entry?"
                  />
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
