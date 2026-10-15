"use client";

import {
  CalendarCheck2,
  Clock,
  CheckCircle2,
  Building2,
} from "lucide-react";

interface DashboardSummaryCardsProps {
  summary: {
    scope: "PERSONAL" | "ORGANIZATION";
    totalBookings: number;
    pendingReview: number;
    approvedBookings: number;
    rejectedBookings?: number;
    cancelledBookings?: number;
    activeResources: number;
  };
}

export function DashboardSummaryCards({ summary }: DashboardSummaryCardsProps) {
  const isOrg = summary.scope === "ORGANIZATION";

  return (
    <div className="grid grid-cols-1 min-[390px]:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Bookings */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-4.5 shadow-2xs h-[100px] flex items-center gap-3.5 transition-all hover:border-slate-300">
        <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-2xs shrink-0">
          <CalendarCheck2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500 font-medium truncate">
            {isOrg ? "Total Bookings" : "My Bookings"}
          </p>
          <p className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">
            {summary.totalBookings}
          </p>
          <p className="text-[10px] text-slate-400 truncate">
            All-time reservations
          </p>
        </div>
      </div>

      {/* Pending Review */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-4.5 shadow-2xs h-[100px] flex items-center gap-3.5 transition-all hover:border-slate-300">
        <div className="h-10 w-10 rounded-xl bg-amber-50/80 border border-amber-200/80 flex items-center justify-center text-amber-600 shadow-2xs shrink-0">
          <Clock className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500 font-medium truncate">
            {isOrg ? "Pending Review" : "Pending Approval"}
          </p>
          <p className="text-2xl font-bold tracking-tight text-amber-600 leading-tight">
            {summary.pendingReview}
          </p>
          <p className="text-[10px] text-amber-600/70 truncate">
            Awaiting review
          </p>
        </div>
      </div>

      {/* Approved Bookings */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-4.5 shadow-2xs h-[100px] flex items-center gap-3.5 transition-all hover:border-slate-300">
        <div className="h-10 w-10 rounded-xl bg-emerald-50/80 border border-emerald-200/80 flex items-center justify-center text-emerald-600 shadow-2xs shrink-0">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500 font-medium truncate">
            {isOrg ? "Approved Bookings" : "My Approved"}
          </p>
          <p className="text-2xl font-bold tracking-tight text-emerald-600 leading-tight">
            {summary.approvedBookings}
          </p>
          <p className="text-[10px] text-emerald-600/70 truncate">
            Confirmed slots
          </p>
        </div>
      </div>

      {/* Active Resources */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-4.5 shadow-2xs h-[100px] flex items-center gap-3.5 transition-all hover:border-slate-300">
        <div className="h-10 w-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 shadow-2xs shrink-0">
          <Building2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500 font-medium truncate">
            Active Resources
          </p>
          <p className="text-2xl font-bold tracking-tight text-slate-900 leading-tight">
            {summary.activeResources}
          </p>
          <p className="text-[10px] text-slate-400 truncate">
            Operational facilities
          </p>
        </div>
      </div>
    </div>
  );
}

