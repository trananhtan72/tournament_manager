import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

/** Page title for one of a tournament's tabs, e.g. "Players — Spring Open". */
export async function tournamentTabMetadata(
  params: Promise<{ slug: string }>,
  tab: string,
): Promise<Metadata> {
  const { slug } = await params;
  const tournament = await prisma.tournament.findUnique({ where: { slug }, select: { name: true } });
  return { title: tournament ? `${tab} — ${tournament.name}` : tab };
}
