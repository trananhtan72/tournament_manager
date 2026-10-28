"use client";

import { removeTeam } from "@/app/actions/teams";
import { ActionForm } from "@/components/ActionForm";

export function RemoveTeamButton({ teamId }: { teamId: string }) {
  return (
    <ActionForm
      action={removeTeam.bind(null, teamId)}
      variant="danger"
      label="Remove team"
      pendingLabel="Removing…"
      confirmMessage="Remove this team and its roster? This cannot be undone."
    />
  );
}
