import Link from "next/link";
import Image from "next/image";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canCreateTournaments } from "@/lib/roles";
import { NotificationBell } from "@/components/NotificationBell";
import { AuthLinks } from "@/components/AuthLinks";
import { UserIcon } from "@/components/UserIcon";

const RECENT_NOTIFICATIONS_LIMIT = 10;

export async function NavBar() {
  const session = await auth();

  const [recentNotifications, unreadCount, refereeRoles, me, ownedTournaments] = session?.user?.id
    ? await Promise.all([
        prisma.notification.findMany({
          where: { userId: session.user.id },
          orderBy: { createdAt: "desc" },
          take: RECENT_NOTIFICATIONS_LIMIT,
        }),
        prisma.notification.count({
          where: { userId: session.user.id, read: false },
        }),
        prisma.tournamentReferee.count({ where: { userId: session.user.id } }),
        prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } }),
        prisma.tournament.count({ where: { organizerId: session.user.id } }),
      ])
    : [[], 0, 0, null, 0];
  // Shown even without organizer access if they already have tournaments to
  // manage (e.g. access was revoked after they created one).
  const showOrganizerConsole = canCreateTournaments(me?.role ?? "USER") || ownedTournaments > 0;

  return (
    <header className="border-b border-border">
      <nav className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        {/* The logo file has blank margin around the artwork (and off-white
            noise in it), so the negative margins trim the margin and the
            brightness lift turns the noise pure white. The PNG is black on
            white; the blend modes let it sit directly on the page background
            in both themes (inverted on dark). */}
        <Link href="/" aria-label="Tournament Manager home" className="-my-3 -ml-2 shrink-0">
          <Image
            src="/TM_logo.png"
            alt="Tournament Manager"
            width={1254}
            height={1254}
            sizes="64px"
            loading="eager"
            className="h-16 w-16 brightness-[1.02] mix-blend-multiply dark:mix-blend-screen dark:invert"
          />
        </Link>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <Link href="/" className="hover:underline">
            Tournaments
          </Link>
          {session?.user ? (
            <>
              <Link href="/dashboard" className="hover:underline">
                Dashboard
              </Link>
              {refereeRoles > 0 && (
                <Link href="/referee" className="hover:underline">
                  Referee
                </Link>
              )}
              {showOrganizerConsole && (
                <Link href="/organizer" className="hover:underline">
                  Organizer console
                </Link>
              )}
              {me?.role === "ADMIN" && (
                <Link href="/admin" className="hover:underline">
                  Admin
                </Link>
              )}
              <Link
                href="/account"
                aria-label={`My account (${session.user.email}) — sign out from there`}
                title={session.user.email ?? "My account"}
                className="inline-flex items-center justify-center rounded-full p-1.5 text-muted hover:bg-surface-muted hover:text-text"
              >
                <UserIcon className="h-5 w-5" />
              </Link>
              <NotificationBell notifications={recentNotifications} unreadCount={unreadCount} />
            </>
          ) : (
            <AuthLinks />
          )}
        </div>
      </nav>
    </header>
  );
}
