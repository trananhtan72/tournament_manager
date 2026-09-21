import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SignOutButton } from "@/components/SignOutButton";
import { BellIcon } from "@/components/BellIcon";
import { AuthLinks } from "@/components/AuthLinks";

export async function NavBar() {
  const session = await auth();

  const unreadCount = session?.user?.id
    ? await prisma.notification.count({
        where: { userId: session.user.id, read: false },
      })
    : 0;

  return (
    <header className="border-b border-slate-200 dark:border-slate-800">
      <nav className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-sm font-semibold">
          Tournament Manager
        </Link>
        <div className="flex items-center gap-3 text-sm">
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
              <Link
                href="/notifications"
                aria-label={
                  unreadCount > 0
                    ? `Notifications (${unreadCount} unread)`
                    : "Notifications"
                }
                className="relative inline-flex items-center hover:text-slate-600 dark:hover:text-slate-300"
              >
                <BellIcon className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-medium text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
              <span className="hidden text-slate-500 sm:inline">
                {session.user.email}
              </span>
              <SignOutButton />
            </>
          ) : (
            <AuthLinks />
          )}
        </div>
      </nav>
    </header>
  );
}
