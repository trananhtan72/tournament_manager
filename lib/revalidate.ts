import { revalidatePath } from "next/cache";

/**
 * Refreshes every organizer-console tab and every public tournament page for
 * a tournament. The console's tabs and the public tabs each show overlapping
 * data (counts, badges, entries, draws), so after any change they all need
 * to re-render — revalidating the two layouts covers every page beneath them.
 */
export function revalidateTournament(slug: string): void {
  revalidatePath(`/organizer/${slug}`, "layout");
  revalidatePath(`/t/${slug}`, "layout");
  revalidatePath("/referee", "layout");
}
