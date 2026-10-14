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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Bookings */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4.5 shadow-2xs flex items-center gap-3.5 transition-all hover:border-slate-300">
        <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-2xs shrink-0">
          <CalendarCheck2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-400 font-medium truncate">
            {isOrg ? "Total Bookings" : "My Bookings"}
          </p>
          <p className="text-2xl font-bold text-slate-900 leading-tight mt-0.5">
            {summary.totalBookings}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            All-time reservations
          </p>
        </div>
      </div>

      {/* Pending Review */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4.5 shadow-2xs flex items-center gap-3.5 transition-all hover:border-slate-300">
        <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shadow-2xs shrink-0">
          <Clock className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-400 font-medium truncate">
            {isOrg ? "Pending Review" : "Pending Approval"}
          </p>
          <p className="text-2xl font-bold text-amber-700 leading-tight mt-0.5">
            {summary.pendingReview}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Awaiting administrator review
          </p>
        </div>
      </div>

      {/* Approved Bookings */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4.5 shadow-2xs flex items-center gap-3.5 transition-all hover:border-slate-300">
        <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-2xs shrink-0">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-400 font-medium truncate">
            {isOrg ? "Approved Bookings" : "My Approved"}
          </p>
          <p className="text-2xl font-bold text-emerald-700 leading-tight mt-0.5">
            {summary.approvedBookings}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Confirmed active slots
          </p>
        </div>
      </div>

      {/* Active Resources */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4.5 shadow-2xs flex items-center gap-3.5 transition-all hover:border-slate-300">
        <div className="h-10 w-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 shadow-2xs shrink-0">
          <Building2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-400 font-medium truncate">
            Active Resources
          </p>
          <p className="text-2xl font-bold text-slate-900 leading-tight mt-0.5">
            {summary.activeResources}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Operational facilities
          </p>
        </div>
      </div>
    </div>
  );
}

