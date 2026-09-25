import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isDoublesCategory } from "@/lib/eventLabels";
import { formatDate } from "@/lib/formatDate";
import { effectiveWithdrawalDeadline, registrationStatus, withdrawalIsOpen } from "@/lib/registrationDeadline";
import { playerName, playerEmail } from "@/lib/playerDisplay";
import {
  EventRegistrationPanel,
  type MyEntryInfo,
} from "@/app/t/[slug]/EventRegistrationPanel";

export async function generateMetadata({ params }: PageProps<"/t/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    select: { name: true, venue: true },
  });
  if (!tournament) return { title: "Tournament not found" };
  return { title: tournament.name, description: `${tournament.name} at ${tournament.venue}` };
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

const statusBadge = {
  open: {
    label: "Open",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  },
  not_open: {
    label: "Not open yet",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  },
  closed: {
    label: "Closed",
    className: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  },
} as const;

export default async function OverviewTab({ params }: PageProps<"/t/[slug]">) {
  const { slug } = await params;

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    include: {
      organizer: { select: { name: true } },
      events: {
        orderBy: { name: "asc" },
        include: { _count: { select: { entries: { where: { status: "CONFIRMED" } } } } },
      },
    },
  });

  if (!tournament) notFound();

  const session = await auth();
  const userId = session?.user?.id;

  const myEntryPlayers = userId
    ? await prisma.entryPlayer.findMany({
        where: { userId, entry: { event: { tournamentId: tournament.id } } },
        include: {
          entry: {
            include: { players: { include: { user: true } } },
          },
        },
      })
    : [];

  const myEntryByEventId = new Map<string, MyEntryInfo>();
  for (const ep of myEntryPlayers) {
    const other = ep.entry.players.find((p) => p.userId !== userId);
    myEntryByEventId.set(ep.entry.eventId, {
      entryId: ep.entry.id,
      status: ep.entry.status,
      myRole: ep.role,
      myConfirmed: ep.confirmed,
      otherPlayer: other ? { name: playerName(other), email: playerEmail(other) } : null,
    });
  }

  const status = registrationStatus(tournament);
  const badge = statusBadge[status];
  const withdrawalOpen = withdrawalIsOpen(tournament);
  const totalEntries = tournament.events.reduce((sum, event) => sum + event._count.entries, 0);

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="signup-heading" className="flex flex-col gap-3">
        <h2 id="signup-heading" className="text-lg font-semibold">
          Sign up &amp; dates
        </h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-md border border-slate-200 p-4 sm:grid-cols-2 dark:border-slate-700">
          <InfoRow label="Sign up status">
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
              {badge.label}
            </span>
          </InfoRow>
          <InfoRow label="Entries open">
            {tournament.registrationOpensAt ? formatDate(tournament.registrationOpensAt) : "Right away"}
          </InfoRow>
          <InfoRow label="Entry deadline">{formatDate(tournament.registrationDeadline)}</InfoRow>
          <InfoRow label="Withdrawal deadline">
            {formatDate(effectiveWithdrawalDeadline(tournament))}
            {!tournament.withdrawalDeadline && (
              <span className="text-slate-500"> (same as the entry deadline)</span>
            )}
          </InfoRow>
          <InfoRow label="Tournament starts">{formatDate(tournament.startDate)}</InfoRow>
          <InfoRow label="Tournament ends">{formatDate(tournament.endDate)}</InfoRow>
          <InfoRow label="Events">{tournament.events.length}</InfoRow>
          <InfoRow label="Entries">{totalEntries}</InfoRow>
        </dl>
      </section>

      <section aria-labelledby="register-heading" className="flex flex-col gap-3">
        <h2 id="register-heading" className="text-lg font-semibold">
          Register
        </h2>
        {tournament.events.length === 0 ? (
          <p className="text-sm text-slate-500">No events have been added yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {tournament.events.map((event) => (
              <li
                key={event.id}
                className="flex flex-col gap-3 rounded-md border border-slate-200 px-4 py-3 dark:border-slate-700"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{event.name}</span>
                  {event.drawPublished && (
                    <Link href={`/t/${slug}/${event.id}`} className="text-sm underline">
                      View draw →
                    </Link>
                  )}
                </div>
                <EventRegistrationPanel
                  eventId={event.id}
                  isDoubles={isDoublesCategory(event.category)}
                  registrationStatus={status}
                  registrationOpensLabel={
                    tournament.registrationOpensAt ? formatDate(tournament.registrationOpensAt) : null
                  }
                  withdrawalOpen={withdrawalOpen}
                  drawPublished={event.drawPublished}
                  signedIn={Boolean(userId)}
                  myEntry={myEntryByEventId.get(event.id) ?? null}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="details-heading" className="flex flex-col gap-3">
        <h2 id="details-heading" className="text-lg font-semibold">
          Details
        </h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-md border border-slate-200 p-4 sm:grid-cols-2 dark:border-slate-700">
          <InfoRow label="Regulations">
            {tournament.regulationsUrl ? (
              <a
                href={tournament.regulationsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                View regulations document ↗
              </a>
            ) : (
              <span className="text-slate-500">Not provided</span>
            )}
          </InfoRow>
          <InfoRow label="Organizer">{tournament.organizer.name}</InfoRow>
          <InfoRow label="Venue">{tournament.venue}</InfoRow>
        </dl>
      </section>
    </div>
  );
}
