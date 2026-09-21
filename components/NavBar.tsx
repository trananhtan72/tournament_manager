import Link from "next/link";
import { auth } from "@/auth";
import { SignOutButton } from "@/components/SignOutButton";

export async function NavBar() {
  const session = await auth();

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
              <Link href="/organizer" className="hover:underline">
                Organizer console
              </Link>
              <span className="hidden text-slate-500 sm:inline">
                {session.user.email}
              </span>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/signin" className="hover:underline">
                Sign in
              </Link>
              <Link href="/signup" className="hover:underline">
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
