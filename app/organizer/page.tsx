import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CreateTournamentForm } from "@/app/organizer/CreateTournamentForm";
import { formatDate } from "@/lib/formatDate";
import { canCreateTournaments } from "@/lib/roles";

export default async function OrganizerPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }
  const userId = session.user.id;

  const [tournaments, user] = await Promise.all([
    prisma.tournament.findMany({
      where: { organizerId: userId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { events: true } } },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
  ]);
  const canCreate = canCreateTournaments(user?.role ?? "USER");

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h1 className="text-xl font-semibold">Your tournaments</h1>
        {tournaments.length === 0 ? (
          <p className="text-sm text-muted">
            You haven&apos;t created any tournaments yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {tournaments.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/organizer/${t.slug}`}
                  className="flex flex-col gap-1 rounded-md border border-border px-4 py-3 hover:border-primary"
                >
                  <span className="font-medium">{t.name}</span>
                  <span className="text-sm text-muted">
                    {t.venue} · {formatDate(t.startDate)} – {formatDate(t.endDate)} ·{" "}
                    {t._count.events} event{t._count.events === 1 ? "" : "s"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-6">
        <h2 className="text-lg font-semibold">Create a tournament</h2>
        {canCreate ? (
          <CreateTournamentForm />
        ) : (
          <p className="text-sm text-muted">
            Only approved organizers can create tournaments. Ask the tournament-manager administrator for access.
          </p>
        )}
      </section>
    </div>
  );
}
