import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/formatDate";
import { TournamentTabs } from "@/components/TournamentTabs";

export default async function TournamentTabsLayout({
  children,
  params,
}: LayoutProps<"/t/[slug]">) {
  const { slug } = await params;

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    select: { name: true, venue: true, startDate: true, endDate: true },
  });
  if (!tournament) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{tournament.name}</h1>
        <p className="text-slate-600 dark:text-slate-400">
          {tournament.venue} · {formatDate(tournament.startDate)} – {formatDate(tournament.endDate)}
        </p>
      </div>
      <TournamentTabs slug={slug} />
      {children}
    </div>
  );
}
