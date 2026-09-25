import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireOrganizerId } from "@/lib/organizerAccess";
import { TabNav } from "@/components/TabNav";

export default async function OrganizerTournamentLayout({
  children,
  params,
}: LayoutProps<"/organizer/[slug]">) {
  const { slug } = await params;
  const userId = await requireOrganizerId();

  const tournament = await prisma.tournament.findFirst({
    where: { slug, organizerId: userId },
    select: { name: true, events: { select: { entries: { select: { status: true } } } } },
  });
  if (!tournament) notFound();

  const pendingApproval = tournament.events
    .flatMap((event) => event.entries)
    .filter((entry) => entry.status === "PENDING_APPROVAL").length;
  const base = `/organizer/${slug}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/organizer" className="text-sm underline">
          ← Your tournaments
        </Link>
        <Link href={`/t/${slug}`} className="text-sm underline">
          View public page
        </Link>
      </div>

      <h1 className="text-2xl font-semibold">{tournament.name}</h1>

      <TabNav
        ariaLabel="Tournament console sections"
        tabs={[
          { label: "Overview", href: base, exact: true },
          { label: "Events", href: `${base}/events` },
          { label: "Manage entries", href: `${base}/entries`, badge: pendingApproval },
          { label: "Match center", href: `${base}/matches`, alsoActiveFor: [`${base}/schedule`] },
          { label: "Draws", href: `${base}/draws` },
        ]}
      />

      {children}
    </div>
  );
}
