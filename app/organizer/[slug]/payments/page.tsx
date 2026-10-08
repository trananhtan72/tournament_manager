import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireOrganizerId } from "@/lib/organizerAccess";
import { formatDayHeading, formatTimeOfDay, toDateTimeLocal } from "@/lib/tournament/schedule";
import { UnpaidAthleteCard } from "@/app/organizer/[slug]/payments/UnpaidAthleteCard";
import { PaidAthleteCard } from "@/app/organizer/[slug]/payments/PaidAthleteCard";
import type { AthleteKey } from "@/app/actions/payments";

export const metadata: Metadata = { title: "Entry payments" };

type AthleteGroup = {
  key: string;
  athlete: AthleteKey;
  name: string;
  /** One line per event entry, e.g. "Men's Singles" or "Men's Doubles (with Bob Partner)". */
  eventLines: string[];
};

export default async function PaymentsPage({ params }: PageProps<"/organizer/[slug]/payments">) {
  const { slug } = await params;
  const userId = await requireOrganizerId();

  const tournament = await prisma.tournament.findFirst({
    where: { slug, organizerId: userId },
    select: {
      id: true,
      payments: {
        select: { userId: true, guestName: true, amount: true, method: true, note: true, paidAt: true },
      },
      events: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          entries: {
            select: {
              id: true,
              status: true,
              players: {
                select: { id: true, userId: true, guestName: true, user: { select: { name: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!tournament) notFound();

  // One group per distinct athlete across the whole tournament — a registered
  // user is grouped by their stable id; a guest by name (the best available
  // identity for them — see the TournamentPayment model's own comment).
  const groups = new Map<string, AthleteGroup>();
  for (const event of tournament.events) {
    for (const entry of event.entries) {
      for (const player of entry.players) {
        const name = player.user?.name ?? player.guestName ?? "Unknown";
        const athlete: AthleteKey = player.userId ? { userId: player.userId } : { guestName: player.guestName! };
        const key = player.userId ? `user:${player.userId}` : `guest:${player.guestName}`;
        const partners = entry.players
          .filter((p) => p.id !== player.id)
          .map((p) => p.user?.name ?? p.guestName ?? "Unknown");
        const eventLine = partners.length > 0 ? `${event.name} (with ${partners.join(", ")})` : event.name;

        const group = groups.get(key) ?? { key, athlete, name, eventLines: [] };
        group.eventLines.push(eventLine);
        groups.set(key, group);
      }
    }
  }

  const paymentByKey = new Map(
    tournament.payments.map((p) => [p.userId ? `user:${p.userId}` : `guest:${p.guestName}`, p]),
  );

  const athletes = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  const unpaid = athletes.filter((a) => !paymentByKey.get(a.key)?.paidAt);
  const paid = athletes.filter((a) => paymentByKey.get(a.key)?.paidAt);

  const eventSummaryFor = (group: AthleteGroup) =>
    `${group.eventLines.length} ${group.eventLines.length === 1 ? "event" : "events"}: ${group.eventLines.join(" · ")}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Entry payments</h1>
        <p className="text-sm text-muted">
          One record per athlete, covering every event they&apos;ve entered — not per registration. This doesn&apos;t
          process any payments itself; it&apos;s just a record the organizer keeps up to date.
        </p>
      </div>

      {athletes.length === 0 ? (
        <p className="text-sm text-muted">No entries yet. Once athletes register for an event, they&apos;ll show up here.</p>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <section aria-labelledby="unpaid-heading" className="flex min-w-0 flex-col gap-4">
            <h2 id="unpaid-heading" className="text-lg font-semibold">
              Unpaid ({unpaid.length})
            </h2>
            {unpaid.length === 0 ? (
              <p className="text-sm text-muted">Everyone&apos;s paid up.</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {unpaid.map((group) => {
                  const payment = paymentByKey.get(group.key);
                  return (
                    <UnpaidAthleteCard
                      key={group.key}
                      tournamentId={tournament.id}
                      athlete={group.athlete}
                      name={group.name}
                      eventSummary={eventSummaryFor(group)}
                      initialAmount={payment?.amount ? payment.amount.toString() : ""}
                      initialMethod={payment?.method ?? "ZELLE"}
                      initialNote={payment?.note ?? ""}
                    />
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="paid-heading" className="flex min-w-0 flex-col gap-4">
            <h2 id="paid-heading" className="text-lg font-semibold">
              Paid ({paid.length})
            </h2>
            {paid.length === 0 ? (
              <p className="text-sm text-muted">No one&apos;s paid yet.</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {paid.map((group) => {
                  const payment = paymentByKey.get(group.key)!;
                  return (
                    <PaidAthleteCard
                      key={group.key}
                      tournamentId={tournament.id}
                      athlete={group.athlete}
                      name={group.name}
                      eventSummary={eventSummaryFor(group)}
                      amount={payment.amount ? payment.amount.toString() : ""}
                      method={payment.method ?? "ZELLE"}
                      note={payment.note ?? ""}
                      paidAtLabel={`${formatDayHeading(payment.paidAt!)} · ${formatTimeOfDay(payment.paidAt!)}`}
                      initialPaidAt={toDateTimeLocal(payment.paidAt!)}
                    />
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
