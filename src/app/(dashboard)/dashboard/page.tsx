import Link from "next/link";
import {
  Layers,
  CalendarDays,
  Building2,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/layout/app-header";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [totalResources, activeResources, totalCategories, totalReservations] =
    await Promise.all([
      prisma.resource.count(),
      prisma.resource.count({ where: { isActive: true } }),
      prisma.resourceCategory.count(),
      prisma.reservation.count({ where: { status: "CONFIRMED" } }),
    ]);

  const recentResources = await prisma.resource.findMany({
    take: 4,
    orderBy: { createdAt: "desc" },
    include: { category: true },
  });

  return (
    <>
      <AppHeader
        title="Operations Dashboard"
        description="Overview of organization resources, capacity metrics, and system status."
        action={
          <Link href="/resources">
            <Button size="sm" className="flex items-center gap-1.5 shadow-xs">
              <Layers className="h-4 w-4" />
              <span>Manage Resources</span>
            </Button>
          </Link>
        }
      />

      <main className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Resources
              </span>
              <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Layers className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">
                {totalResources}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {activeResources} currently operational
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Categories
              </span>
              <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Building2 className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">
                {totalCategories}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Rooms, desks & hardware
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Active Bookings
              </span>
              <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CalendarDays className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">
                {totalReservations}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Confirmed reservations
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                System Status
              </span>
              <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                Ready
              </div>
              <p className="text-xs text-slate-500 mt-1">
                GiST exclusion locks active
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recently Added Resources List */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Organization Resources
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Recently registered shared organizational facilities.
              </p>
            </div>
            <Link
              href="/resources"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <span>View all catalog</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {recentResources.map((res) => (
              <div
                key={res.id}
                className="py-3.5 flex items-center justify-between gap-4 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                    <Building2 className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-slate-900 truncate">
                      {res.name}
                    </h4>
                    <p className="text-xs text-slate-400 truncate">
                      {res.category.name} • {res.location}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      res.isActive
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80"
                        : "bg-slate-100 text-slate-500 border border-slate-200"
                    }`}
                  >
                    {res.isActive ? "Operational" : "Inactive"}
                  </span>
                  <Link href={`/resources/${res.id}`}>
                    <Button variant="ghost" size="sm" className="h-7 text-xs px-2">
                      Details
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
