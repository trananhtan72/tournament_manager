import { playerName, playerEmail } from "@/lib/playerDisplay";

export function EntryPlayersWithEmail({
  players,
}: {
  players: { id: string; guestName: string | null; user: { name: string; email: string } | null }[];
}) {
  return (
    <ul className="flex min-w-0 flex-col gap-1">
      {players.map((p) => {
        const email = playerEmail(p);
        return (
          <li key={p.id} className="flex flex-col text-sm">
            <span className="font-medium">{playerName(p)}</span>
            {email && <span className="break-all text-slate-600 dark:text-slate-400">{email}</span>}
          </li>
        );
      })}
    </ul>
  );
}
