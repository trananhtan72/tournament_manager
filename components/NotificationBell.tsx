"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellIcon } from "@/components/BellIcon";
import { markNotificationRead, markAllNotificationsRead } from "@/app/actions/notifications";
import { formatDateTime } from "@/lib/formatDateTime";

export type NotificationItem = {
  id: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: Date;
};

const POPUP_WIDTH = 320;
const VIEWPORT_MARGIN = 8;

export function NotificationBell({
  notifications: initialNotifications,
  unreadCount: initialUnreadCount,
}: {
  notifications: NotificationItem[];
  unreadCount: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [popupPosition, setPopupPosition] = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Anchored to the button's live on-screen position (not a CSS `absolute
  // right-0` relative to it) so the popup lands correctly regardless of
  // where the bell ends up — including when the nav wraps onto multiple
  // lines on narrow screens and the bell is no longer pinned to the far
  // right edge.
  function computePopupPosition() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(POPUP_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
    const left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(rect.right - width, window.innerWidth - width - VIEWPORT_MARGIN),
    );
    setPopupPosition({ top: rect.bottom + 8, left });
  }

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleReposition() {
      computePopupPosition();
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [isOpen]);

  function toggleOpen() {
    if (!isOpen) computePopupPosition();
    setIsOpen((open) => !open);
  }

  function handleNotificationClick(notification: NotificationItem) {
    if (!notification.read) {
      setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)));
      setUnreadCount((count) => Math.max(0, count - 1));
      startTransition(() => {
        markNotificationRead(notification.id);
      });
    }
    setIsOpen(false);
    if (notification.link) router.push(notification.link);
  }

  function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    startTransition(() => {
      markAllNotificationsRead();
    });
  }

  return (
    <div ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
        className="relative inline-flex items-center hover:text-muted"
        onClick={toggleOpen}
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-medium text-error-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && popupPosition && (
        <div
          style={{ position: "fixed", top: popupPosition.top, left: popupPosition.left, width: POPUP_WIDTH }}
          className="z-50 max-w-[calc(100vw-1rem)] rounded-md border border-border bg-surface text-left shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-semibold text-text">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                className="text-xs text-muted hover:underline"
                onClick={handleMarkAllRead}
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted">No notifications yet.</p>
            ) : (
              <ul className="flex flex-col">
                {notifications.map((n) => (
                  <li key={n.id} className="border-b border-border last:border-b-0">
                    <button
                      type="button"
                      onClick={() => handleNotificationClick(n)}
                      className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-surface-muted ${
                        n.read ? "" : "bg-surface-muted"
                      }`}
                    >
                      <span className="text-text">{n.message}</span>
                      <span className="text-xs text-muted">{formatDateTime(n.createdAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Link
            href="/notifications"
            onClick={() => setIsOpen(false)}
            className="block border-t border-border px-3 py-2 text-center text-xs text-muted hover:underline"
          >
            View all
          </Link>
        </div>
      )}
    </div>
  );
}
