"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ExternalLink,
  Loader2,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  markNotificationAsReadAction,
  markAllNotificationsAsReadAction,
} from "@/features/notifications/actions/notification-actions";
import { formatColomboInterval, formatColomboDate } from "@/features/reservations/utils/client-date";

export interface NotificationItem {
  id: string;
  type: "RESERVATION_REQUESTED" | "RESERVATION_APPROVED" | "RESERVATION_REJECTED" | "RESERVATION_CANCELLED";
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date | string;
  readAt?: Date | string | null;
  actor?: { name: string; email: string } | null;
  reservationId?: string | null;
  reservation?: {
    title: string;
    startTime: Date | string;
    endTime: Date | string;
    status: string;
    resource?: { name: string } | null;
  } | null;
}

interface NotificationsViewProps {
  initialNotifications: NotificationItem[];
  initialUnreadCount: number;
}

export function NotificationsView({
  initialNotifications,
  initialUnreadCount,
}: NotificationsViewProps) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const [filterMode, setFilterMode] = useState<"ALL" | "UNREAD" | "READ">("ALL");
  const [markingId, setMarkingId] = useState<string | null>(null);
  const viewInFlight = useRef<Set<string>>(new Set());
  // Local read state is applied only after the server confirms persistence.
  const [locallyReadIds, setLocallyReadIds] = useState<string[]>([]);
  const [isAllLocallyRead, setIsAllLocallyRead] = useState(false);

  const notifications = initialNotifications.map((item) => {
    if (isAllLocallyRead || locallyReadIds.includes(item.id)) {
      return { ...item, isRead: true, readAt: item.readAt || new Date() };
    }
    return item;
  });

  const unreadCount = isAllLocallyRead
    ? 0
    : Math.max(0, initialUnreadCount - locallyReadIds.filter((id) => {
        const orig = initialNotifications.find((n) => n.id === id);
        return orig && !orig.isRead;
      }).length);

  // Filter items
  const filtered = notifications.filter((n) => {
    if (filterMode === "UNREAD") return !n.isRead;
    if (filterMode === "READ") return n.isRead;
    return true;
  });

  const [isMarkingAll, setIsMarkingAll] = useState(false);

  // Mark single notification as read
  const handleMarkAsRead = (id: string) => {
    if (markingId || isPending) return;
    const target = notifications.find((n) => n.id === id);
    if (!target || target.isRead) return;

    setMarkingId(id);
    startTransition(async () => {
      try {
        const res = await markNotificationAsReadAction(id);
        if (res.success) {
          // Apply the confirmed read state immediately.
          setLocallyReadIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
          window.dispatchEvent(new Event("slotify:notifications-changed"));
          toast.success("Notification marked as read.");
          router.refresh();
        } else {
          toast.error(res.error || "Failed to mark notification as read.");
        }
      } catch {
        toast.error("An unexpected error occurred.");
      } finally {
        setMarkingId(null);
      }
    });
  };

  // Mark all notifications as read
  const handleMarkAllAsRead = () => {
    if (isMarkingAll || isPending || unreadCount === 0) return;

    setIsMarkingAll(true);
    startTransition(async () => {
      try {
        const res = await markAllNotificationsAsReadAction();
        if (res.success) {
          // Apply the confirmed read state immediately.
          setIsAllLocallyRead(true);
          window.dispatchEvent(new Event("slotify:notifications-changed"));
          toast.success("All notifications marked as read.");
          router.refresh();
        } else {
          toast.error(res.error || "Failed to mark all as read.");
        }
      } catch {
        toast.error("An unexpected error occurred.");
      } finally {
        setIsMarkingAll(false);
      }
    });
  };

  const handleView = async (item: NotificationItem) => {
    if (viewInFlight.current.has(item.id)) return;
    viewInFlight.current.add(item.id);
    setMarkingId(item.id);
    try {
      if (!item.isRead) {
        const result = await markNotificationAsReadAction(item.id);
        if (!result.success) {
          toast.error(result.error || "Unable to mark this notification as read.");
          return;
        }
        setLocallyReadIds((previous) => previous.includes(item.id) ? previous : [...previous, item.id]);
        window.dispatchEvent(new Event("slotify:notifications-changed"));
      }
      router.push("/reservations");
      router.refresh();
    } catch {
      toast.error("Unable to open this notification. Please try again.");
    } finally {
      viewInFlight.current.delete(item.id);
      setMarkingId(null);
    }
  };

  const getTypeIcon = (type: NotificationItem["type"]) => {
    switch (type) {
      case "RESERVATION_APPROVED":
        return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
      case "RESERVATION_REJECTED":
        return <XCircle className="h-5 w-5 text-rose-600" />;
      case "RESERVATION_CANCELLED":
        return <AlertCircle className="h-5 w-5 text-slate-500" />;
      case "RESERVATION_REQUESTED":
      default:
        return <Clock className="h-5 w-5 text-blue-600" />;
    }
  };

  const getTypeBadgeClass = (type: NotificationItem["type"]) => {
    switch (type) {
      case "RESERVATION_APPROVED":
        return "bg-emerald-50 text-emerald-800 border-emerald-200";
      case "RESERVATION_REJECTED":
        return "bg-rose-50 text-rose-800 border-rose-200";
      case "RESERVATION_CANCELLED":
        return "bg-slate-100 text-slate-700 border-slate-200";
      case "RESERVATION_REQUESTED":
      default:
        return "bg-blue-50 text-blue-800 border-blue-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header controls: Filter tabs + Mark all as read */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilterMode("ALL")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border",
              filterMode === "ALL"
                ? "bg-blue-50 text-blue-700 border-blue-200 shadow-2xs font-bold"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            )}
          >
            All ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("UNREAD")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border flex items-center gap-1.5",
              filterMode === "UNREAD"
                ? "bg-blue-50 text-blue-700 border-blue-200 shadow-2xs font-bold"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            )}
          >
            Unread
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("READ")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border",
              filterMode === "READ"
                ? "bg-blue-50 text-blue-700 border-blue-200 shadow-2xs font-bold"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            )}
          >
            Read ({notifications.filter((n) => n.isRead).length})
          </button>
        </div>

        {unreadCount > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleMarkAllAsRead}
            disabled={isMarkingAll || isPending}
            className="h-8 text-xs font-semibold text-slate-700 gap-1.5 border-slate-300 hover:bg-slate-50"
          >
            {isMarkingAll ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCheck className="h-3.5 w-3.5 text-blue-600" />
            )}
            Mark All as Read
          </Button>
        )}
      </div>

      {/* Notification List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-slate-200/80 bg-white">
            <Inbox className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">
              {filterMode === "UNREAD"
                ? "You're all caught up!"
                : "No notifications found"}
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {filterMode === "UNREAD"
                ? "There are no unread notifications waiting for your attention."
                : "When your reservations receive updates, approvals, or cancellations, they will appear here."}
            </p>
          </div>
        ) : (
          filtered.map((item) => {
            const dateStr = formatColomboDate(item.createdAt);
            const isItemMarking = markingId === item.id;

            return (
              <div
                key={item.id}
                className={cn(
                  "p-4 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4",
                  item.isRead
                    ? "bg-white border-slate-200/80"
                    : "bg-blue-50/40 border-blue-200 shadow-2xs"
                )}
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div
                    className={cn(
                      "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border",
                      item.isRead
                        ? "bg-slate-50 border-slate-200"
                        : "bg-white border-blue-200 shadow-2xs"
                    )}
                  >
                    {getTypeIcon(item.type)}
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        {item.title}
                      </span>
                      <span
                        className={cn(
                          "px-2 py-0.2 rounded-full text-[10px] font-bold border",
                          getTypeBadgeClass(item.type)
                        )}
                      >
                        {item.type.replace("RESERVATION_", "")}
                      </span>
                      {!item.isRead && (
                        <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                      )}
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {item.message}
                    </p>

                    {item.reservation && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 pt-0.5">
                        {item.reservation.resource && (
                          <span className="font-semibold text-slate-700">
                            {item.reservation.resource.name}
                          </span>
                        )}
                        <span>
                          {formatColomboDate(item.reservation.startTime)} (
                          {formatColomboInterval(
                            item.reservation.startTime,
                            item.reservation.endTime
                          )}
                          )
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-[10px] text-slate-400 pt-0.5">
                      <Clock className="h-3 w-3" />
                      <span>{dateStr}</span>
                      {item.actor && (
                        <>
                          <span>•</span>
                          <span>by {item.actor.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0 pt-2 sm:pt-0">
                  <button
                    type="button"
                    onClick={() => handleView(item)}
                    disabled={isItemMarking || isPending}
                    className="h-7 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-[11px] font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                  >
                    {isItemMarking ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
                    <span>View</span>
                  </button>

                  {/* Explicit MARK AS READ action on unread notifications */}
                  {!item.isRead ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleMarkAsRead(item.id)}
                      disabled={isItemMarking || isPending}
                      className="h-7 px-2.5 rounded-lg text-[11px] font-semibold text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300 gap-1 transition-all"
                    >
                      {isItemMarking ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                      Mark as Read
                    </Button>
                  ) : (
                    /* Subtle Read state indicator on read notifications */
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium text-slate-400 bg-slate-50 border border-slate-200/60">
                      <Check className="h-3 w-3 text-slate-400" />
                      Read
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
