import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { eventTypeLabels, drawFormatLabels } from "@/lib/eventLabels";
import { ActionForm } from "@/components/ActionForm";
import { removeEntryAsOrganizer } from "@/app/actions/entries";
import { PairEntriesForm } from "@/app/organizer/[slug]/[eventId]/PairEntriesForm";

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
    playerName: e.players[0]?.user.name ?? "Unknown",
  }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href={`/organizer/${slug}`} className="text-sm underline">
          ← {event.tournament.name}
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold">{eventTypeLabels[event.type]}</h1>
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
                  {entry.players.map((p) => p.user.name).join(" / ")}
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
                    {initiator?.user.name} → invited {partner?.user.name} (unconfirmed)
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
                  <span className="text-sm">{entry.players[0]?.user.name}</span>
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
    </div>
  );
}
