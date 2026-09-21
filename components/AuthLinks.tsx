"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function AuthLinks() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const onAuthPage = pathname === "/signin" || pathname === "/signup";
  // On the auth pages themselves, forward whatever callback they already
  // carry instead of pointing back at /signin or /signup.
  const target = onAuthPage ? searchParams.get("callbackUrl") : pathname;
  const suffix = target ? `?callbackUrl=${encodeURIComponent(target)}` : "";

  return (
    <>
      <Link href={`/signin${suffix}`} className="hover:underline">
        Sign in
      </Link>
      <Link href={`/signup${suffix}`} className="hover:underline">
        Sign up
      </Link>
    </>
  );
}
