import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOrganizerId } from "@/lib/organizerAccess";
import { playerName as getPlayerName, playerEmail } from "@/lib/playerDisplay";
import { CreateTeamForm } from "@/app/organizer/[slug]/teams/CreateTeamForm";
import { AddTeamMemberForm } from "@/app/organizer/[slug]/teams/AddTeamMemberForm";
import { RemoveTeamButton } from "@/app/organizer/[slug]/teams/RemoveTeamButton";
import { RemoveTeamMemberButton } from "@/app/organizer/[slug]/teams/RemoveTeamMemberButton";
import { TeamDrawManager } from "@/app/organizer/[slug]/teams/TeamDrawManager";

export default async function EventTeamsPage({
  params,
}: PageProps<"/organizer/[slug]/teams/[eventId]">) {
  const { slug, eventId } = await params;
  const userId = await requireOrganizerId();

  const event = await prisma.event.findFirst({
    where: { id: eventId, category: "TEAM", tournament: { slug, organizerId: userId } },
    include: {
      teams: {
        include: { members: { include: { user: true } } },
        orderBy: { createdAt: "asc" },
      },
      ties: { orderBy: [{ round: "asc" }, { position: "asc" }] },
    },
  });
  if (!event) notFound();

  return (
    <div className="flex flex-col gap-8">
      {event.drawPublished && (
        <p className="text-sm text-muted">
          The draw has been published — teams can no longer be removed, but rosters can still be edited.
        </p>
      )}

      <TeamDrawManager event={event} slug={slug} />

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Teams ({event.teams.length})</h2>
        {event.teams.length === 0 ? (
          <p className="text-sm text-muted">No teams yet.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {event.teams.map((team) => (
              <li key={team.id} className="flex flex-col gap-3 rounded-md border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium">{team.name}</h3>
                  {!event.drawPublished && <RemoveTeamButton teamId={team.id} />}
                </div>

                {team.members.length === 0 ? (
                  <p className="text-sm text-muted">No roster members yet.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {team.members.map((member) => {
                      const email = playerEmail(member);
                      return (
                        <li
                          key={member.id}
                          className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2"
                        >
                          <span className="flex flex-col text-sm">
                            <span className="font-medium">{getPlayerName(member)}</span>
                            {email && <span className="break-all text-muted">{email}</span>}
                          </span>
                          <RemoveTeamMemberButton memberId={member.id} />
                        </li>
                      );
                    })}
                  </ul>
                )}

                <AddTeamMemberForm teamId={team.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-6">
        <h2 className="text-lg font-semibold">Add a team</h2>
        <CreateTeamForm eventId={event.id} />
      </section>
    </div>
  );
}
