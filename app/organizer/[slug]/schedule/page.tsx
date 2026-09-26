import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { entryDisplayName } from "@/lib/playerDisplay";
import { formatDate } from "@/lib/formatDate";
import { dayKey, knockoutRoundCount, stageLabel, toDateTimeLocal } from "@/lib/tournament/schedule";
import { MatchScheduleForm } from "@/app/organizer/[slug]/schedule/MatchScheduleForm";
import { MatchRefereeForm } from "@/app/organizer/[slug]/referees/MatchRefereeForm";

export const metadata: Metadata = { title: "Match schedule" };

export default async function OrganizerSchedulePage({
  params,
}: PageProps<"/organizer/[slug]/schedule">) {
  const { slug } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    include: {
      referees: { include: { user: { select: { name: true } } } },
      events: {
        orderBy: { name: "asc" },
        include: {
          pools: true,
          matches: {
            orderBy: [{ round: "asc" }, { position: "asc" }],
            include: {
              entry1: { include: { players: { include: { user: true } } } },
              entry2: { include: { players: { include: { user: true } } } },
            },
          },
        },
      },
    },
  });
  if (!tournament || tournament.organizerId !== session.user.id) {
    notFound();
  }

  const refereeChoices = tournament.referees
    .map((r) => ({ id: r.id, name: r.user.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  const firstDay = dayKey(tournament.startDate);
  const lastDay = dayKey(tournament.endDate);

  const events = tournament.events
    .map((event) => {
      const knockoutRounds = knockoutRoundCount(event.matches);
      const poolNames = new Map(event.pools.map((p) => [p.id, p.name]));
      const groups = new Map<string, { title: string; matches: typeof event.matches }>();
      for (const match of event.matches) {
        if (match.isBye) continue;
        const title = stageLabel(
          { poolName: match.poolId ? (poolNames.get(match.poolId) ?? null) : null, round: match.round },
          { drawFormat: event.drawFormat, knockoutRounds },
        );
        const group = groups.get(title) ?? { title, matches: [] };
        group.matches.push(match);
        groups.set(title, group);
      }
      return { event, groups: [...groups.values()] };
    })
    .filter(({ groups }) => groups.length > 0);

  const allMatches = events.flatMap(({ groups }) => groups.flatMap((g) => g.matches));
  const scheduledCount = allMatches.filter((m) => m.scheduledAt !== null).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={`/organizer/${slug}/matches`} className="text-sm underline">
          ← Match center
        </Link>
        <Link href={`/t/${slug}/matches`} className="text-sm underline">
          View public matches
        </Link>
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Match schedule</h1>
        <p className="text-sm text-muted">
          Give each match a start time and, if you like, a court. Times are local to the venue
          ({formatDate(tournament.startDate)} – {formatDate(tournament.endDate)}). Players see the
          schedule once an event&apos;s draw is published.
        </p>
        {allMatches.length > 0 && (
          <p className="text-sm text-muted">
            {scheduledCount} of {allMatches.length} matches scheduled.
          </p>
        )}
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-muted">
          There are no matches to schedule yet. Generate a draw for an event first.
        </p>
      ) : (
        events.map(({ event, groups }) => (
          <section key={event.id} className="flex flex-col gap-4 border-t border-border pt-6">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold">{event.name}</h2>
              {!event.drawPublished && (
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-muted">
                  Draw not published — hidden from players
                </span>
              )}
            </div>
            {groups.map((group) => (
              <div key={group.title} className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-text">{group.title}</h3>
                <ul className="flex flex-col gap-2">
                  {group.matches.map((match) => (
                    <li
                      key={match.id}
                      className="flex flex-col gap-2 rounded-md border border-border px-4 py-3 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="min-w-0 text-sm">
                        <span className="font-medium">
                          {match.entry1 ? entryDisplayName(match.entry1) : "TBD"}
                        </span>{" "}
                        <span className="text-muted">vs</span>{" "}
                        <span className="font-medium">
                          {match.entry2 ? entryDisplayName(match.entry2) : "TBD"}
                        </span>
                        {match.status && (
                          <span className="ml-2 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                            Played
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-3">
                        <MatchScheduleForm
                          matchId={match.id}
                          initialScheduledAt={match.scheduledAt ? toDateTimeLocal(match.scheduledAt) : ""}
                          initialCourt={match.court ?? ""}
                          courtCount={tournament.courtCount}
                          firstDay={firstDay}
                          lastDay={lastDay}
                        />
                        {match.status === null ? (
                          <MatchRefereeForm
                            matchId={match.id}
                            currentRefereeId={match.refereeId}
                            referees={refereeChoices}
                          />
                        ) : (
                          match.refereeId && (
                            <p className="text-xs text-muted">
                              Referee: {refereeChoices.find((r) => r.id === match.refereeId)?.name ?? "—"}
                            </p>
                          )
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
