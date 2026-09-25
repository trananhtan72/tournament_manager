import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireOrganizerId } from "@/lib/organizerAccess";
import { AddRefereeForm } from "@/app/organizer/[slug]/referees/AddRefereeForm";
import { RemoveRefereeButton } from "@/app/organizer/[slug]/referees/RemoveRefereeButton";

export const metadata: Metadata = { title: "Referees" };

export default async function RefereesPage({ params }: PageProps<"/organizer/[slug]/referees">) {
  const { slug } = await params;
  const userId = await requireOrganizerId();

  const tournament = await prisma.tournament.findFirst({
    where: { slug, organizerId: userId },
    include: {
      referees: {
        include: {
          user: { select: { name: true, email: true } },
          matches: { where: { isBye: false }, select: { status: true } },
        },
      },
    },
  });
  if (!tournament) notFound();

  const referees = [...tournament.referees].sort((a, b) =>
    a.user.name.localeCompare(b.user.name, "en", { sensitivity: "base" }),
  );

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold">Referees ({referees.length})</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Referees can enter scores from their phone or tablet for the matches you assign to them — and are
            notified when you do. Assign a match from the{" "}
            <Link href={`/organizer/${slug}/matches`} className="underline">
              Match center
            </Link>{" "}
            or the{" "}
            <Link href={`/organizer/${slug}/schedule`} className="underline">
              schedule
            </Link>
            , picking from this list or typing an email.
          </p>
        </div>

        {referees.length === 0 ? (
          <p className="text-sm text-slate-500">No referees yet. Add one below.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {referees.map((referee) => {
              const upcoming = referee.matches.filter((m) => m.status === null).length;
              const done = referee.matches.length - upcoming;
              return (
                <li
                  key={referee.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 px-4 py-3 dark:border-slate-700"
                >
                  <div className="flex min-w-0 flex-col text-sm">
                    <span className="font-medium">{referee.user.name}</span>
                    <span className="break-all text-slate-600 dark:text-slate-400">{referee.user.email}</span>
                    <span className="text-xs text-slate-500">
                      {upcoming} to officiate · {done} done
                    </span>
                  </div>
                  <RemoveRefereeButton refereeId={referee.id} name={referee.user.name} assigned={upcoming} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 border-t border-slate-200 pt-6 dark:border-slate-800">
        <h2 className="text-lg font-semibold">Add a referee</h2>
        <p className="text-sm text-slate-500">
          They need an account already — ask them to sign up first. Once added they&apos;ll see a &ldquo;Referee&rdquo; link
          in the menu.
        </p>
        <AddRefereeForm tournamentId={tournament.id} />
      </section>
    </div>
  );
}
