import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SignOutButton } from "@/components/SignOutButton";
import { NotificationBell } from "@/components/NotificationBell";
import { AuthLinks } from "@/components/AuthLinks";

const RECENT_NOTIFICATIONS_LIMIT = 10;

export async function NavBar() {
  const session = await auth();

  const [recentNotifications, unreadCount] = session?.user?.id
    ? await Promise.all([
        prisma.notification.findMany({
          where: { userId: session.user.id },
          orderBy: { createdAt: "desc" },
          take: RECENT_NOTIFICATIONS_LIMIT,
        }),
        prisma.notification.count({
          where: { userId: session.user.id, read: false },
        }),
      ])
    : [[], 0];

  return (
    <header className="border-b border-slate-200 dark:border-slate-800">
      <nav className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/" className="text-sm font-semibold">
          Tournament Manager
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
              <Link href="/organizer" className="hover:underline">
                Organizer console
              </Link>
              <span className="hidden text-slate-500 sm:inline">
                {session.user.email}
              </span>
              <SignOutButton />
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
