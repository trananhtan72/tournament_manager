import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/formatDateTime";
import { ActionForm } from "@/components/ActionForm";
import { MarkReadLink } from "@/components/MarkReadLink";
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
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
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
        <p className="text-sm text-muted">You have no notifications yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notifications.map((n) => (
            <li key={n.id}>
              <MarkReadLink notificationId={n.id} href={n.link} read={n.read} className="block w-full text-left">
                <div
                  className={`flex flex-col gap-1 rounded-md border px-4 py-3 ${
                    n.read
                      ? "border-border"
                      : "border-primary/40 bg-primary/5"
                  }`}
                >
                  <p className="text-sm text-text">{n.message}</p>
                  <p className="text-xs text-muted">{formatDateTime(n.createdAt)}</p>
                </div>
              </MarkReadLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
