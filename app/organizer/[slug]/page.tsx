import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOrganizerId } from "@/lib/organizerAccess";
import { regulationsForDisplay } from "@/lib/regulations";
import { EditTournamentForm } from "@/app/organizer/[slug]/EditTournamentForm";
import { RegulationsEditorDialog } from "@/app/organizer/[slug]/RegulationsEditorDialog";
import { ActionForm } from "@/components/ActionForm";
import { RegulationsContent } from "@/components/RegulationsContent";
import { RegulationsDialog } from "@/components/RegulationsDialog";
import { deleteTournament } from "@/app/actions/tournaments";

function Stat({ label, value, children }: { label: string; value: number; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-slate-200 px-4 py-3 dark:border-slate-700">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {children}
    </div>
  );
}

export default async function OrganizerOverviewPage({
  params,
}: PageProps<"/organizer/[slug]">) {
  const { slug } = await params;
  const userId = await requireOrganizerId();

  const tournament = await prisma.tournament.findFirst({
    where: { slug, organizerId: userId },
    include: { events: { include: { entries: { select: { status: true } } } } },
  });
  if (!tournament) notFound();

  const entries = tournament.events.flatMap((event) => event.entries);
  const confirmedCount = entries.filter((e) => e.status === "CONFIRMED").length;
  const pendingCount = entries.filter((e) => e.status === "PENDING_APPROVAL").length;
  const regulations = regulationsForDisplay(tournament.regulations);
  const deleteWithId = deleteTournament.bind(null, tournament.id);

  return (
    <div className="flex flex-col gap-8">
      <section aria-label="Totals" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Events" value={tournament.events.length} />
        <Stat label="Confirmed entries" value={confirmedCount} />
        <Stat label="Pending approval" value={pendingCount}>
          {pendingCount > 0 && (
            <Link href={`/organizer/${slug}/entries`} className="text-sm underline">
              Review them →
            </Link>
          )}
        </Stat>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Tournament details</h2>
        <EditTournamentForm
          key={tournament.updatedAt.getTime()}
          tournamentId={tournament.id}
          name={tournament.name}
          venue={tournament.venue}
          startDate={tournament.startDate}
          endDate={tournament.endDate}
          registrationDeadline={tournament.registrationDeadline}
          registrationOpensAt={tournament.registrationOpensAt}
          withdrawalDeadline={tournament.withdrawalDeadline}
        />
      </section>

      <section className="flex flex-col gap-3 border-t border-slate-200 pt-6 dark:border-slate-800">
        <h2 className="text-lg font-semibold">Regulations</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {regulations
            ? "Players can read these in a popup on the tournament page."
            : "Not written yet. Once you add regulations, players can read them in a popup on the tournament page."}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <RegulationsEditorDialog tournamentId={tournament.id} initialDoc={regulations} />
          {regulations && (
            <RegulationsDialog title={`Regulations — ${tournament.name}`} triggerLabel="Preview as players see it">
              <RegulationsContent doc={regulations} />
            </RegulationsDialog>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3 border-t border-slate-200 pt-6 dark:border-slate-800">
        <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">Danger zone</h2>
        <ActionForm
          action={deleteWithId}
          variant="danger"
          label="Delete tournament"
          pendingLabel="Deleting…"
          confirmMessage={`Delete "${tournament.name}"? This will remove all its events and cannot be undone.`}
        />
      </section>
    </div>
  );
}
