"use client";

import Link from "next/link";
import { useTransition } from "react";
import { markNotificationRead } from "@/app/actions/notifications";

export function MarkReadLink({
  notificationId,
  href,
  read,
  className,
  children,
}: {
  notificationId: string;
  href: string | null;
  read: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [, startTransition] = useTransition();

  const handleClick = () => {
    if (!read) startTransition(() => markNotificationRead(notificationId));
  };

  if (href) {
    return (
      <Link href={href} onClick={handleClick} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={handleClick} className={className}>
      {children}
    </button>
  );
}
