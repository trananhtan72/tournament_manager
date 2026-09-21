import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { eventTypeLabels } from "@/lib/eventLabels";
import { registrationIsOpen } from "@/lib/registrationDeadline";
import { ActionForm } from "@/components/ActionForm";
import {
  confirmPartnerInvite,
  declinePartnerInvite,
  withdrawEntry,
} from "@/app/actions/entries";

function entryStatusText(
  status: "NEEDS_PARTNER" | "PENDING_PARTNER" | "CONFIRMED",
  myRole: "INITIATOR" | "PARTNER",
  otherPlayerName: string | undefined,
): string {
  switch (status) {
    case "CONFIRMED":
      return otherPlayerName ? `Registered with ${otherPlayerName}` : "Registered";
    case "NEEDS_PARTNER":
      return "Waiting for the organizer to pair you with a partner";
    case "PENDING_PARTNER":
      return myRole === "INITIATOR"
        ? `Invitation sent to ${otherPlayerName ?? "your partner"} — awaiting confirmation`
        : "Waiting on your response";
  }
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }
  const userId = session.user.id;

  const entryPlayers = await prisma.entryPlayer.findMany({
    where: { userId },
    include: {
      entry: {
        include: {
          event: { include: { tournament: true } },
          players: { include: { user: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const pendingInvites = entryPlayers.filter(
    (ep) => ep.role === "PARTNER" && !ep.confirmed,
  );
  const myRegistrations = entryPlayers.filter(
    (ep) => !(ep.role === "PARTNER" && !ep.confirmed),
  );

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      {pendingInvites.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Needs your response</h2>
          <ul className="flex flex-col gap-3">
            {pendingInvites.map((ep) => {
              const initiator = ep.entry.players.find((p) => p.role === "INITIATOR");
              return (
                <li
                  key={ep.id}
                  className="flex flex-col gap-2 rounded-md border border-slate-200 px-4 py-3 dark:border-slate-700"
                >
                  <div>
                    <Link
                      href={`/t/${ep.entry.event.tournament.slug}`}
                      className="font-medium underline"
                    >
                      {ep.entry.event.tournament.name}
                    </Link>
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {" "}
                      · {eventTypeLabels[ep.entry.event.type]}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {initiator?.user.name} invited you to be their partner.
                  </p>
                  <div className="flex gap-2">
                    <ActionForm
                      action={confirmPartnerInvite.bind(null, ep.entry.id)}
                      variant="primary"
                      label="Accept"
                      pendingLabel="Accepting…"
                    />
                    <ActionForm
                      action={declinePartnerInvite.bind(null, ep.entry.id)}
                      variant="secondary"
                      label="Decline"
                      pendingLabel="Declining…"
                      confirmMessage="Decline this partner invitation?"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">My registrations</h2>
        {myRegistrations.length === 0 ? (
          <p className="text-sm text-slate-500">
            You haven&apos;t registered for any events yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {myRegistrations.map((ep) => {
              const other = ep.entry.players.find((p) => p.userId !== userId);
              const registrationOpen = registrationIsOpen(
                ep.entry.event.tournament.registrationDeadline,
              );
              return (
                <li
                  key={ep.id}
                  className="flex flex-col gap-2 rounded-md border border-slate-200 px-4 py-3 dark:border-slate-700"
                >
                  <div>
                    <Link
                      href={`/t/${ep.entry.event.tournament.slug}`}
                      className="font-medium underline"
                    >
                      {ep.entry.event.tournament.name}
                    </Link>
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {" "}
                      · {eventTypeLabels[ep.entry.event.type]}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {entryStatusText(ep.entry.status, ep.role, other?.user.name)}
                  </p>
                  {registrationOpen && (
                    <div>
                      <ActionForm
                        action={withdrawEntry.bind(null, ep.entry.id)}
                        variant="secondary"
                        label={
                          ep.entry.status === "PENDING_PARTNER" && ep.role === "INITIATOR"
                            ? "Cancel invitation"
                            : "Withdraw"
                        }
                        pendingLabel="Withdrawing…"
                        confirmMessage="Withdraw from this event? This cannot be undone."
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2 border-t border-slate-200 pt-6 dark:border-slate-800">
        <h2 className="text-lg font-semibold">My matches</h2>
        <p className="text-sm text-slate-500">
          Matches will appear here once draws are generated.
        </p>
      </section>
    </div>
  );
}
