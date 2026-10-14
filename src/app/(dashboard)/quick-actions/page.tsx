import { requireUser } from "@/lib/authorization";
import Link from "next/link";
import {
  Calendar,
  Layers,
  Clock,
  Bell,
  Shield,
  UserCheck,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Building2,
  CalendarCheck,
} from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { getUnreadNotificationCountAction } from "@/features/notifications/actions/notification-actions";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Quick Actions | Slotify",
  description: "Direct shortcuts to primary reservation, resource, and administrative workflows.",
};

export default async function QuickActionsPage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  const [unreadRes, pendingCount, unassignedCount] = await Promise.all([
    getUnreadNotificationCountAction(),
    isAdmin ? prisma.reservation.count({ where: { status: "PENDING" } }) : Promise.resolve(0),
    isAdmin ? prisma.reservation.count({ where: { departmentId: null } }) : Promise.resolve(0),
  ]);

  const unreadCount = unreadRes.success ? unreadRes.data : 0;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <AppHeader
        title="Quick Actions"
        description="Streamlined shortcuts to your daily reservation workflows and management tasks."
      />
      <main className="flex-1 px-8 pb-12 max-w-7xl w-full space-y-6">
        {/* Welcome Banner */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-blue-200 text-xs font-semibold backdrop-blur-xs">
              <Sparkles className="h-3 w-3 text-blue-300" />
              Role: {user.role}
            </div>
            <h2 className="text-xl font-bold tracking-tight">
              Welcome to Slotify Hub
            </h2>
            <p className="text-xs text-blue-200/90 leading-relaxed">
              Quickly reserve spaces, review your upcoming schedules, track organizational notifications, or manage system governance.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <Link
              href="/resources"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md"
            >
              <Calendar className="h-4 w-4" />
              Book a Resource
            </Link>
          </div>
        </div>

        {/* Section 1: Core Member Workflows */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-blue-600" />
              Reservation & Schedule Workflows
            </h3>
            <p className="text-xs text-slate-500">
              Primary booking and schedule tools accessible to all team members.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Book Resource */}
            <Link
              href="/resources"
              className="group p-5 rounded-xl border border-slate-200/80 bg-white hover:border-blue-400 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-2.5">
                <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold group-hover:scale-105 transition-transform">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    Reserve a Resource
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Check live visual timeline availability across conference rooms, labs, and collaborative spaces.
                  </p>
                </div>
              </div>
              <div className="pt-4 flex items-center text-xs font-bold text-blue-600 group-hover:translate-x-1 transition-transform">
                Go to Resources <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </div>
            </Link>

            {/* My Reservations */}
            <Link
              href="/reservations"
              className="group p-5 rounded-xl border border-slate-200/80 bg-white hover:border-blue-400 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-2.5">
                <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold group-hover:scale-105 transition-transform">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                    My Reservations
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Manage your upcoming bookings, cancel scheduled slots, or review status approvals.
                  </p>
                </div>
              </div>
              <div className="pt-4 flex items-center text-xs font-bold text-indigo-600 group-hover:translate-x-1 transition-transform">
                View Reservations <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </div>
            </Link>

            {/* Calendar & Dashboard */}
            <Link
              href="/dashboard"
              className="group p-5 rounded-xl border border-slate-200/80 bg-white hover:border-blue-400 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-2.5">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold group-hover:scale-105 transition-transform">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                    Dashboard & Analytics
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    View organizational utilization metrics, day-by-day business timeline schedules, and stats.
                  </p>
                </div>
              </div>
              <div className="pt-4 flex items-center text-xs font-bold text-emerald-600 group-hover:translate-x-1 transition-transform">
                Open Dashboard <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </div>
            </Link>

            {/* Notifications */}
            <Link
              href="/notifications"
              className="group p-5 rounded-xl border border-slate-200/80 bg-white hover:border-blue-400 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div className="space-y-2.5">
                <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold group-hover:scale-105 transition-transform relative">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-rose-600 text-white text-[9px] font-bold flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
                      Notifications Inbox
                    </h4>
                    {unreadCount > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800">
                        {unreadCount} Unread
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Stay updated with real-time alerts on reservation submissions, approvals, rejections, and cancellations.
                  </p>
                </div>
              </div>
              <div className="pt-4 flex items-center text-xs font-bold text-amber-600 group-hover:translate-x-1 transition-transform">
                Open Notifications <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </div>
            </Link>
          </div>
        </div>

        {/* Section 2: Administrative Governance (Admin only) */}
        {isAdmin && (
          <div className="space-y-4 pt-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Shield className="h-4 w-4 text-indigo-600" />
                Administrator Governance & Approvals
              </h3>
              <p className="text-xs text-slate-500">
                Authorized management tools for user lifecycle, department allocations, and reservation approvals.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* User Management */}
              <Link
                href="/administration"
                className="group p-5 rounded-xl border border-slate-200/80 bg-white hover:border-indigo-400 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold group-hover:scale-105 transition-transform">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      Team & Department Governance
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Create new members, modify structured user profiles, adjust access roles, and assign departments.
                    </p>
                  </div>
                </div>
                <div className="pt-4 flex items-center text-xs font-bold text-indigo-600 group-hover:translate-x-1 transition-transform">
                  Manage Directory <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </div>
              </Link>

              {/* Pending Approvals */}
              <Link
                href="/reservations?status=PENDING"
                className="group p-5 rounded-xl border border-slate-200/80 bg-white hover:border-indigo-400 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold group-hover:scale-105 transition-transform relative">
                    <CheckCircle2 className="h-5 w-5" />
                    {pendingCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-amber-600 text-white text-[9px] font-bold flex items-center justify-center">
                        {pendingCount}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
                        Pending Approvals
                      </h4>
                      {pendingCount > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800">
                          {pendingCount} Pending
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Review reservation requests submitted by team members and approve or reject them.
                    </p>
                  </div>
                </div>
                <div className="pt-4 flex items-center text-xs font-bold text-amber-600 group-hover:translate-x-1 transition-transform">
                  Review Approvals <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </div>
              </Link>

              {/* Legacy Unassigned Queue */}
              <Link
                href="/administration"
                className="group p-5 rounded-xl border border-slate-200/80 bg-white hover:border-indigo-400 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold group-hover:scale-105 transition-transform relative">
                    <Building2 className="h-5 w-5" />
                    {unassignedCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-rose-600 text-white text-[9px] font-bold flex items-center justify-center">
                        {unassignedCount}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-rose-600 transition-colors">
                        Unassigned Booking Review
                      </h4>
                      {unassignedCount > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800">
                          {unassignedCount} Unassigned
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Review historical reservations and reassign them to their proper organizational department with audit logging.
                    </p>
                  </div>
                </div>
                <div className="pt-4 flex items-center text-xs font-bold text-rose-600 group-hover:translate-x-1 transition-transform">
                  Open Audit Queue <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </div>
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

