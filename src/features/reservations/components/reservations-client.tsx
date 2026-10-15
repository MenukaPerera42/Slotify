"use client";

import { useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Calendar as CalendarIcon,
  ListFilter,
  Inbox,
  Plus,
  Clock,
  CheckCircle2,
  CalendarCheck2,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReservationFormModal, type ResourceOption } from "./reservation-form-modal";
import { ReservationCalendarView } from "./reservation-calendar-view";
import { AdminApprovalQueue, type PendingReservationItem } from "./admin-approval-queue";
import { ReservationList, type ReservationItem } from "./reservation-list";
import { getReservationSummaryAction } from "@/features/dashboard/actions/dashboard-actions";

interface ReservationsClientProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "MEMBER";
  };
  resources: ResourceOption[];
  categories: { id: string; name: string }[];
  departments?: { id: string; name: string; code: string }[];
  reservations: ReservationItem[];
  pendingReservations: PendingReservationItem[];
  summary: { totalBookings: number; pendingReview: number; approvedBookings: number; activeResources: number };
}

export function ReservationsClient({
  user,
  resources,
  categories,
  departments = [],
  reservations,
  pendingReservations,
  summary,
}: ReservationsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAdmin = user.role === "ADMIN";

  // Real-time all-time metrics state
  const [clientSummary, setClientSummary] = useState<typeof summary | null>(null);
  const summaryData = clientSummary ?? summary;

  const refreshSummary = useCallback(async () => {
    try {
      const res = await getReservationSummaryAction();
      if (res.success && res.data) {
        setClientSummary(res.data);
      }
    } catch (err) {
      console.error("Failed to refresh summary metrics:", err);
    }
  }, []);

  // Active tab state
  const queryTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<"calendar" | "list" | "approvals">(
    queryTab === "approvals" && isAdmin
      ? "approvals"
      : queryTab === "list"
      ? "list"
      : "calendar"
  );

  // Quick booking modal
  const bookResourceIdParam = searchParams.get("bookResourceId");
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [selectedResourceId, setSelectedResourceId] = useState<string | undefined>(undefined);

  const isModalOpen = isManualModalOpen || Boolean(bookResourceIdParam);
  const activeResourceId = selectedResourceId || bookResourceIdParam || undefined;

  const handleTabChange = (tab: "calendar" | "list" | "approvals") => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams ? Array.from(searchParams.entries()) : []);
    params.set("tab", tab);
    router.replace(`/reservations?${params.toString()}`);
  };

  // All-time metrics come from PostgreSQL, independent of paginated lists and calendar dates.
  const totalCount = summaryData.totalBookings;
  const pendingCount = summaryData.pendingReview;
  const approvedCount = summaryData.approvedBookings;
  const activeResourcesCount = summaryData.activeResources;

  return (
    <div className="space-y-6 min-w-0 max-w-full">
      <header className="min-w-0">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            {isAdmin ? "Reservation Management" : "My Reservations"}
          </h1>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-2xl">
            {isAdmin
              ? "Manage organizational reservations, approvals, and resource schedules."
              : "Schedule, track, and manage your room and equipment bookings."}
          </p>
        </div>
      </header>

      {/* Calendar view switcher and booking action */}
      <div className="flex flex-wrap items-center justify-between gap-3 min-w-0">
        <div className="flex w-max max-w-full items-center gap-1.5 p-1 bg-white rounded-xl border border-[#E5E7EB] shadow-2xs overflow-x-auto overscroll-x-contain">
          <button
            type="button"
            onClick={() => handleTabChange("calendar")}
            className={`flex shrink-0 items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === "calendar"
                ? "bg-blue-50 text-blue-700 shadow-2xs border border-blue-200"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            <span>Interactive Calendar</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => handleTabChange("approvals")}
              className={`flex shrink-0 items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all relative ${
                activeTab === "approvals"
                  ? "bg-blue-50 text-blue-700 shadow-2xs border border-blue-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <Inbox className="h-3.5 w-3.5" />
              <span>Pending Approvals</span>
              {pendingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                  {pendingCount}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => handleTabChange("list")}
            className={`flex shrink-0 items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === "list"
                ? "bg-blue-50 text-blue-700 shadow-2xs border border-blue-200"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <ListFilter className="h-3.5 w-3.5" />
            <span>{isAdmin ? "All Bookings" : "My Bookings"}</span>
            <span className="text-[11px] text-slate-400 font-medium">
              ({totalCount})
            </span>
          </button>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setSelectedResourceId(undefined);
            setIsManualModalOpen(true);
          }}
          className="ml-auto rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs flex items-center gap-1.5 shadow-xs shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>New Reservation</span>
        </Button>
      </div>

      {/* Metrics Row matching reference design card style */}
      <div className="grid grid-cols-1 min-[390px]:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-2xs flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-2xs shrink-0">
            <CalendarCheck2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Total Bookings</p>
            <p className="text-xl font-bold text-slate-900 leading-tight mt-0.5">{totalCount}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-2xs flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shadow-2xs shrink-0">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Pending Review</p>
            <p className="text-xl font-bold text-amber-700 leading-tight mt-0.5">{pendingCount}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-2xs flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-2xs shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Approved Bookings</p>
            <p className="text-xl font-bold text-emerald-700 leading-tight mt-0.5">{approvedCount}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-2xs flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 shadow-2xs shrink-0">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Active Resources</p>
            <p className="text-xl font-bold text-slate-900 leading-tight mt-0.5">{activeResourcesCount}</p>
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === "calendar" && (
        <ReservationCalendarView
          resources={resources}
          categories={categories}
          departments={departments}
          isAdmin={isAdmin}
          onRefreshSummary={refreshSummary}
        />
      )}

      {activeTab === "approvals" && isAdmin && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Pending Approval Queue
              </h2>
              <p className="text-xs text-slate-500">
                Review and approve or reject employee reservation requests in Asia/Colombo time.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
              {pendingCount} Pending Requests
            </span>
          </div>

          <AdminApprovalQueue
            key={pendingReservations.map((item) => `${item.id}:${item.status}`).join("|")}
            initialItems={pendingReservations}
            onActionComplete={() => {
              refreshSummary();
              router.refresh();
            }}
          />
        </div>
      )}

      {activeTab === "list" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {isAdmin ? "Organizational Bookings" : "My Reservation History"}
              </h2>
              <p className="text-xs text-slate-500">
                View, filter, and manage reservation statuses.
              </p>
            </div>
          </div>

          <ReservationList
            key={reservations.map((item) => `${item.id}:${item.status}`).join("|")}
            initialItems={reservations}
            isAdmin={isAdmin}
            currentUserId={user.id}
            onRefresh={() => {
              refreshSummary();
              router.refresh();
            }}
          />
        </div>
      )}

      {/* Booking Modal */}
      {isModalOpen && (
        <ReservationFormModal
          isOpen={true}
          onClose={() => {
            setIsManualModalOpen(false);
            setSelectedResourceId(undefined);
            // Clear query param if present
            if (bookResourceIdParam) {
              const p = new URLSearchParams(searchParams ? Array.from(searchParams.entries()) : []);
              p.delete("bookResourceId");
              router.replace(`/reservations${p.toString() ? `?${p.toString()}` : ""}`);
            }
          }}
          onSuccess={() => {
            refreshSummary();
            router.refresh();
          }}
          resources={resources}
          isAdmin={isAdmin}
          initialResourceId={activeResourceId}
        />
      )}
    </div>
  );
}
