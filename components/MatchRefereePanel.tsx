import { MatchRefereeForm } from "@/app/organizer/[slug]/referees/MatchRefereeForm";

/**
 * The organizer's view of who referees a match, with the control to change it —
 * shown on the start screen (open, since assigning comes first) and while the
 * match is live (collapsed).
 */
export function MatchRefereePanel({
  matchId,
  currentRefereeId,
  refereeName,
  referees,
  defaultOpen,
}: {
  matchId: string;
  currentRefereeId: string | null;
  refereeName: string | null;
  referees: { id: string; name: string }[];
  defaultOpen: boolean;
}) {
  return (
    <details open={defaultOpen} className="rounded-lg border border-border px-4 py-3">
      <summary className="cursor-pointer text-sm font-semibold">
        Referee: {refereeName ?? "none assigned"}
      </summary>
      <div className="flex flex-col gap-3 pt-3">
        <p className="text-sm text-muted">
          {refereeName
            ? `${refereeName} can score this match from their phone or tablet. Assign someone else, or nobody, below.`
            : "Assign a referee to hand scoring over — pick from your referees or enter an email. They're notified straight away. With no referee, you score it yourself."}
        </p>
        <MatchRefereeForm matchId={matchId} currentRefereeId={currentRefereeId} referees={referees} />
      </div>
    </details>
  );
}
