"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  X,
  Clock,
  Building2,
  User,
  Mail,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  approveReservationAction,
  rejectReservationAction,
} from "../actions/reservation-actions";
import { formatColomboDate, formatColomboInterval } from "../utils/client-date";

export interface PendingReservationItem {
  id: string;
  title: string;
  startTime: Date | string;
  endTime: Date | string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  createdAt: Date | string;
  resource: {
    name: string;
    categoryId?: string;
    location?: string;
  };
  user: {
    name: string;
    email?: string;
  };
}

interface AdminApprovalQueueProps {
  initialItems: PendingReservationItem[];
  onActionComplete?: () => void;
}

export function AdminApprovalQueue({
  initialItems,
  onActionComplete,
}: AdminApprovalQueueProps) {
  const router = useRouter();
  const [items, setItems] = useState<PendingReservationItem[]>(initialItems);
  const [isProcessing, startTransition] = useTransition();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);


  const handleApprove = (id: string, title: string) => {
    setFeedback(null);
    setProcessingId(id);

    startTransition(async () => {
      const result = await approveReservationAction(id);
      setProcessingId(null);

      if (!result.success) {
        setFeedback({
          type: "error",
          message: result.error || "Failed to approve reservation.",
        });
        return;
      }

      setItems((prev) => prev.filter((item) => item.id !== id));
      setFeedback({
        type: "success",
        message: `Reservation "${title}" approved successfully.`,
      });
      router.refresh();
      onActionComplete?.();
    });
  };

  const handleReject = (id: string, title: string) => {
    setFeedback(null);
    setProcessingId(id);

    startTransition(async () => {
      const result = await rejectReservationAction(id);
      setProcessingId(null);

      if (!result.success) {
        setFeedback({
          type: "error",
          message: result.error || "Failed to reject reservation.",
        });
        return;
      }

      setItems((prev) => prev.filter((item) => item.id !== id));
      setFeedback({
        type: "success",
        message: `Reservation "${title}" rejected.`,
      });
      router.refresh();
      onActionComplete?.();
    });
  };

  return (
    <div className="space-y-4">
      {/* Feedback Alert */}
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

      {/* Pending Items List */}
      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-10 text-center shadow-2xs">
          <div className="h-12 w-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mx-auto mb-3 shadow-2xs">
            <Inbox className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            All Caught Up!
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            There are no pending booking requests waiting for administrator approval. New requests will appear here in real time.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const isItemProcessing = isProcessing && processingId === item.id;

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-2xs hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left: Request Details */}
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold">
                      PENDING REVIEW
                    </span>
                    <h3 className="text-sm font-bold text-slate-900 truncate">
                      {item.title}
                    </h3>
                  </div>

                  {/* Resource & Time metadata */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
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

                  {/* Requester Info */}
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span className="text-slate-700 font-medium">{item.user.name}</span>
                    </span>
                    {item.user.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        <span>{item.user.email}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Approval & Rejection Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isItemProcessing}
                    onClick={() => handleReject(item.id, item.title)}
                    className="h-9 px-3.5 rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50 hover:border-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    {isItemProcessing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                    <span>Reject</span>
                  </Button>

                  <Button
                    size="sm"
                    disabled={isItemProcessing}
                    onClick={() => handleApprove(item.id, item.title)}
                    className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    {isItemProcessing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    <span>Approve</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
