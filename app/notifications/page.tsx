import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/formatDateTime";
import { ActionForm } from "@/components/ActionForm";
import { markAllNotificationsRead } from "@/app/actions/notifications";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/signin");
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  const hasUnread = notifications.some((n) => !n.read);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Notifications</h1>
        {hasUnread && (
          <ActionForm
            action={markAllNotificationsRead}
            variant="secondary"
            label="Mark all as read"
            pendingLabel="Marking…"
          />
        )}
      </div>

      {notifications.length === 0 ? (
        <p className="text-sm text-slate-500">You have no notifications yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notifications.map((n) => {
            const content = (
              <div
                className={`flex flex-col gap-1 rounded-md border px-4 py-3 ${
                  n.read
                    ? "border-slate-200 dark:border-slate-700"
                    : "border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-slate-800"
                }`}
              >
                <p className="text-sm text-slate-900 dark:text-white">{n.message}</p>
                <p className="text-xs text-slate-500">{formatDateTime(n.createdAt)}</p>
              </div>
            );
            return (
              <li key={n.id}>
                {n.link ? (
                  <Link href={n.link} className="block">
                    {content}
                  </Link>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
