import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdminId } from "@/lib/adminAccess";
import { GrantOrganizerForm } from "@/app/admin/GrantOrganizerForm";
import { RevokeOrganizerButton } from "@/app/admin/RevokeOrganizerButton";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  await requireAdminId();

  const users = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "ORGANIZER"] } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    include: { _count: { select: { tournaments: true } } },
  });
  const admins = users.filter((u) => u.role === "ADMIN");
  const organizers = users.filter((u) => u.role === "ORGANIZER");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Administrator console</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Only approved organizers can create tournaments. Grant access to an existing account by email, or revoke it
          below.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Administrators</h2>
        <ul className="flex flex-col gap-2">
          {admins.map((u) => (
            <li
              key={u.id}
              className="flex flex-col rounded-md border border-slate-200 px-4 py-3 text-sm dark:border-slate-700"
            >
              <span className="font-medium">{u.name}</span>
              <span className="break-all text-slate-600 dark:text-slate-400">{u.email}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3 border-t border-slate-200 pt-6 dark:border-slate-800">
        <h2 className="text-lg font-semibold">Organizers ({organizers.length})</h2>
        {organizers.length === 0 ? (
          <p className="text-sm text-slate-500">No one else can create tournaments yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {organizers.map((u) => (
              <li
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 px-4 py-3 dark:border-slate-700"
              >
                <div className="flex min-w-0 flex-col text-sm">
                  <span className="font-medium">{u.name}</span>
                  <span className="break-all text-slate-600 dark:text-slate-400">{u.email}</span>
                  <span className="text-xs text-slate-500">
                    {u._count.tournaments} tournament{u._count.tournaments === 1 ? "" : "s"}
                  </span>
                </div>
                <RevokeOrganizerButton userId={u.id} name={u.name} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 border-t border-slate-200 pt-6 dark:border-slate-800">
        <h2 className="text-lg font-semibold">Grant organizer access</h2>
        <p className="text-sm text-slate-500">
          They need an account already — ask them to sign up first. Once granted they&apos;ll see a &ldquo;Create a
          tournament&rdquo; form in the Organizer console, and they&apos;re notified.
        </p>
        <GrantOrganizerForm />
      </section>
    </div>
  );
}
