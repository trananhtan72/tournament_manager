import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        That page doesn&apos;t exist, or it&apos;s no longer available.
      </p>
      <Link href="/" className="text-sm underline">
        Browse tournaments
      </Link>
    </div>
  );
}
