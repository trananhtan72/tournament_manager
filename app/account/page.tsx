import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { formatDate } from "@/lib/formatDate";
import { canCreateTournaments } from "@/lib/roles";
import { SignOutButton } from "@/components/SignOutButton";

export const metadata: Metadata = { title: "My Account" };

export default async function AccountPage() {
  const userId = await requireUserId();

  const [user, refereeRoles, tournamentCount] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.tournamentReferee.count({ where: { userId } }),
    prisma.tournament.count({ where: { organizerId: userId } }),
  ]);

  // Every account can sign up, register for events and view its own matches
  // (the "Player" role in SPEC.md's table); Referee, Organizer and
  // Administrator are additional access layered on top of that.
  const badges = [
    "Player",
    user.role === "ADMIN" ? "Administrator" : user.role === "ORGANIZER" ? "Organizer" : null,
    refereeRoles > 0 ? "Referee" : null,
  ].filter((b): b is string => b !== null);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8">
      <h1 className="text-xl font-semibold">My account</h1>

      <section className="flex flex-col gap-4 rounded-md border border-border p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Name</p>
          <p className="text-base">{user.name}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Email</p>
          <p className="break-all text-base">{user.email}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Member since</p>
          <p className="text-base">{formatDate(user.createdAt)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Access</p>
          <div className="mt-1 flex flex-wrap gap-2" data-testid="account-badges">
            {badges.map((b) => (
              <span
                key={b}
                className="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-text"
              >
                {b}
              </span>
            ))}
          </div>
        </div>

        {!canCreateTournaments(user.role) && (
          <p className="text-sm text-muted">
            {tournamentCount > 0
              ? `You can still manage the ${tournamentCount} tournament${tournamentCount === 1 ? "" : "s"} you've already created, from the Organizer console.`
              : "Ask the tournament-manager administrator for organizer access to create tournaments."}
          </p>
        )}
      </section>

      <div>
        <SignOutButton />
      </div>
    </div>
  );
}
