"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  Building2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Search,
  User,
  Ban,
  Check,
  X,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  cancelReservationAction,
  approveReservationAction,
  rejectReservationAction,
} from "../actions/reservation-actions";
import { formatColomboDate, formatColomboInterval } from "../utils/client-date";

export interface ReservationItem {
  id: string;
  title: string;
  startTime: Date | string;
  endTime: Date | string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  createdAt: Date | string;
  resourceId: string;
  userId: string | null;
  departmentId?: string | null;
  department?: { name: string; code: string } | null;
  resource: {
    name: string;
    categoryId?: string;
  };
  user: {
    name: string;
    email?: string;
  } | null;
}

interface ReservationListProps {
  initialItems: ReservationItem[];
  isAdmin?: boolean;
  currentUserId?: string;
  onRefresh?: () => void;
}

export function ReservationList({
  initialItems,
  isAdmin = false,
  currentUserId,
  onRefresh,
}: ReservationListProps) {
  const router = useRouter();
  const [items, setItems] = useState<ReservationItem[]>(initialItems);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isProcessing, startTransition] = useTransition();

  // Cancel Confirmation Modal state
  const [cancelModalItem, setCancelModalItem] = useState<ReservationItem | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Filter items
  const filteredItems = items.filter((item) => {
    if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchResource = item.resource.name.toLowerCase().includes(q);
      const matchUser = (item.user?.name ?? item.department?.name ?? "").toLowerCase().includes(q);
      if (!matchTitle && !matchResource && !matchUser) return false;
    }
    return true;
  });

  const handleConfirmCancel = () => {
    if (!cancelModalItem) return;
    const target = cancelModalItem;
    setCancelModalItem(null);
    setFeedback(null);

    startTransition(async () => {
      const result = await cancelReservationAction(target.id);
      if (!result.success) {
        setFeedback({
          type: "error",
          message: result.error || "Failed to cancel reservation.",
        });
        return;
      }

      setItems((prev) =>
        prev.map((i) => (i.id === target.id ? { ...i, status: "CANCELLED" } : i))
      );
      setFeedback({
        type: "success",
        message: `Reservation "${target.title}" was cancelled successfully.`,
      });
      router.refresh();
      onRefresh?.();
    });
  };

  const handleApprove = (item: ReservationItem) => {
    setFeedback(null);
    startTransition(async () => {
      const result = await approveReservationAction(item.id);
      if (!result.success) {
        setFeedback({
          type: "error",
          message: result.error || "Failed to approve reservation.",
        });
        return;
      }
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: "APPROVED" } : i))
      );
      setFeedback({
        type: "success",
        message: `Reservation "${item.title}" approved.`,
      });
      router.refresh();
      onRefresh?.();
    });
  };

  const handleReject = (item: ReservationItem) => {
    setFeedback(null);
    startTransition(async () => {
      const result = await rejectReservationAction(item.id);
      if (!result.success) {
        setFeedback({
          type: "error",
          message: result.error || "Failed to reject reservation.",
        });
        return;
      }
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: "REJECTED" } : i))
      );
      setFeedback({
        type: "success",
        message: `Reservation "${item.title}" rejected.`,
      });
      router.refresh();
      onRefresh?.();
    });
  };

  const getStatusBadge = (status: ReservationItem["status"]) => {
    switch (status) {
      case "PENDING":
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
            PENDING
          </span>
        );
      case "APPROVED":
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
            APPROVED
          </span>
        );
      case "REJECTED":
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
            REJECTED
          </span>
        );
      case "CANCELLED":
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-500 text-xs font-semibold">
            CANCELLED
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between border shadow-2xs ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-600" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs text-slate-400 hover:text-slate-600 ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-3.5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {["ALL", "PENDING", "APPROVED", "CANCELLED", "REJECTED"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                statusFilter === st
                  ? "bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/70"
              }`}
            >
              {st === "ALL" ? "All Bookings" : st.charAt(0) + st.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search bookings..."
            className="h-8 pl-8 text-xs rounded-xl"
          />
        </div>
      </div>

      {/* Reservations Items */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-10 text-center shadow-2xs">
          <div className="h-10 w-10 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mx-auto mb-3">
            <Layers className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            No Reservations Found
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
            {statusFilter !== "ALL" || searchQuery
              ? "No reservations match your current filter criteria."
              : "You haven't made any reservations yet. Use the '+ New Reservation' button to book a resource."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const canCancel =
              (item.status === "PENDING" || item.status === "APPROVED") &&
              (isAdmin || item.userId === currentUserId);

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-2xs hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left: Metadata */}
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    {getStatusBadge(item.status)}
                    <h3 className="text-sm font-bold text-slate-900 truncate">
                      {item.title}
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                    <span className="flex items-center gap-1.5 font-medium text-slate-900">
                      <Building2 className="h-3.5 w-3.5 text-blue-600" />
                      {item.resource.name}
                    </span>

                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      {formatColomboDate(item.startTime)}
                    </span>

                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      {formatColomboInterval(item.startTime, item.endTime)}
                    </span>
                  </div>

                  {isAdmin && item.user && (
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-0.5">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span className="text-slate-700 font-medium">{item.user.name}</span>
                      </span>
                      {item.user.email && (
                        <span>({item.user.email})</span>
                      )}
                    </div>
                  )}
                  {isAdmin && !item.user && item.department && (
                    <div className="text-[11px] text-slate-500 pt-0.5">{item.department.name} department booking</div>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Admin Quick Approve / Reject for PENDING requests */}
                  {isAdmin && item.status === "PENDING" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isProcessing}
                        onClick={() => handleReject(item)}
                        className="h-8 px-2.5 rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold flex items-center gap-1"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>Reject</span>
                      </Button>
                      <Button
                        size="sm"
                        disabled={isProcessing}
                        onClick={() => handleApprove(item)}
                        className="h-8 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 shadow-xs"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Approve</span>
                      </Button>
                    </>
                  )}

                  {/* Cancel Button */}
                  {canCancel && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isProcessing}
                      onClick={() => setCancelModalItem(item)}
                      className="h-8 px-3 rounded-xl border-slate-200 text-slate-600 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50/50 text-xs font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <Ban className="h-3.5 w-3.5" />
                      <span>Cancel</span>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel Confirmation Dialog */}
      {cancelModalItem && (
        <Modal
          isOpen={true}
          onClose={() => setCancelModalItem(null)}
          title="Cancel Reservation"
          description="Are you sure you want to cancel this booking?"
          className="max-w-md"
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
              <p className="font-bold text-slate-900">{cancelModalItem.title}</p>
              <p className="text-slate-500">{cancelModalItem.resource.name}</p>
              <p className="text-slate-500">
                {formatColomboDate(cancelModalItem.startTime)} · {formatColomboInterval(cancelModalItem.startTime, cancelModalItem.endTime)}
              </p>
            </div>

            <p className="text-xs text-slate-600">
              Cancelling this reservation will immediately release the time slot, allowing other team members to request or reserve this resource.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isProcessing}
                onClick={() => setCancelModalItem(null)}
                className="rounded-xl text-xs h-9"
              >
                Keep Reservation
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isProcessing}
                onClick={handleConfirmCancel}
                className="rounded-xl text-xs h-9 bg-rose-600 hover:bg-rose-700 text-white font-semibold flex items-center gap-1.5 shadow-xs"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    Cancelling...
                  </>
                ) : (
                  "Yes, Cancel Booking"
                )}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

