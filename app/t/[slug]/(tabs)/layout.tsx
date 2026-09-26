import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/formatDate";
import { TabNav } from "@/components/TabNav";

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
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{tournament.name}</h1>
        <p className="text-muted">
          {tournament.venue} · {formatDate(tournament.startDate)} – {formatDate(tournament.endDate)}
        </p>
      </div>
      <TabNav
        ariaLabel="Tournament sections"
        tabs={[
          { label: "Overview", href: `/t/${slug}`, exact: true },
          { label: "Events", href: `/t/${slug}/events` },
          { label: "Draws", href: `/t/${slug}/draws` },
          { label: "Matches", href: `/t/${slug}/matches` },
          { label: "Players", href: `/t/${slug}/players` },
        ]}
      />
      {children}
    </div>
  );
}
