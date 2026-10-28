"use client";

import { removeTeamMember } from "@/app/actions/teams";
import { ActionForm } from "@/components/ActionForm";

export function RemoveTeamMemberButton({ memberId }: { memberId: string }) {
  return <ActionForm action={removeTeamMember.bind(null, memberId)} variant="secondary" label="Remove" />;
}
