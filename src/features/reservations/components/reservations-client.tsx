"use client";

import { useState } from "react";
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

interface ReservationsClientProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "MEMBER";
  };
  resources: ResourceOption[];
  categories: { id: string; name: string }[];
  reservations: ReservationItem[];
  pendingReservations: PendingReservationItem[];
}

export function ReservationsClient({
  user,
  resources,
  categories,
  reservations,
  pendingReservations,
}: ReservationsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAdmin = user.role === "ADMIN";

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

  // Metrics calculation
  const totalCount = reservations.length;
  const pendingCount = pendingReservations.length;
  const approvedCount = reservations.filter((r) => r.status === "APPROVED").length;
  const activeResourcesCount = resources.filter((r) => r.isActive !== false).length;

  return (
    <div className="space-y-6">
      {/* Top Action Bar & Stat Cards */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl border border-[#E5E7EB] shadow-2xs">
          <button
            type="button"
            onClick={() => handleTabChange("calendar")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
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
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all relative ${
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
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
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

        {/* Primary CTA: + New Reservation */}
        <Button
          onClick={() => {
            setSelectedResourceId(undefined);
            setIsManualModalOpen(true);
          }}
          className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs flex items-center gap-2 shadow-xs transition-colors shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>New Reservation</span>
        </Button>
      </div>

      {/* Metrics Row matching reference design card style */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
          isAdmin={isAdmin}
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
            onActionComplete={() => router.refresh()}
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
            onRefresh={() => router.refresh()}
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
