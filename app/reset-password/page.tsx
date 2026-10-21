import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/app/reset-password/ResetPasswordForm";

export const metadata: Metadata = { title: "Reset your password" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : null;

  if (!token) {
    return (
      <div className="mx-auto max-w-sm">
        <h1 className="mb-4 text-xl font-semibold">Reset your password</h1>
        <p className="text-sm text-error">This reset link is missing its token. Request a new one.</p>
        <p className="mt-4 text-sm text-muted">
          <Link href="/forgot-password" className="underline">
            Request a new reset link
          </Link>
        </p>
      </div>
    );
  }

  return <ResetPasswordForm token={token} />;
}
