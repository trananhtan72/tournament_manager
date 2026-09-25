"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/Button";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        We couldn&apos;t load this page. Try again, or head back to the tournaments list.
      </p>
      <div className="flex items-center gap-4">
        <Button onClick={() => retry()}>Try again</Button>
        <Link href="/" className="text-sm underline">
          Browse tournaments
        </Link>
      </div>
      {error.digest && <p className="text-xs text-slate-400">Reference: {error.digest}</p>}
    </div>
  );
}
