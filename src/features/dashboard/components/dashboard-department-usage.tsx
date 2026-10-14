"use client";

import { Building2, Layers, Briefcase, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { getDepartmentColorScheme } from "@/features/departments/utils/department-colors";

export interface DepartmentUsageItem {
  departmentId: string | null;
  name: string;
  code: string | null;
  reservationCount: number;
  bookedHours: number;
}

interface DashboardDepartmentUsageProps {
  isAdmin?: boolean;
  departmentsUsage?: DepartmentUsageItem[];
  categories?: { id: string; name: string }[];
  totalActiveResources?: number;
}

export function DashboardDepartmentUsage({
  isAdmin = false,
  departmentsUsage = [],
  categories = [],
  totalActiveResources = 0,
}: DashboardDepartmentUsageProps) {
  // If ADMIN: Show Department Utilization
  if (isAdmin) {
    const totalOrgHours = departmentsUsage.reduce((sum, d) => sum + d.bookedHours, 0);

    return (
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shadow-2xs">
              <Briefcase className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Department Utilization
              </h3>
              <p className="text-[11px] text-slate-400">
                Approved reservation hours by organizational unit
              </p>
            </div>
          </div>

          <Link
            href="/administration"
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
          >
            <span>Departments</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Department List */}
        <div className="space-y-3 pt-1">
          {departmentsUsage.length === 0 ? (
            <div className="py-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
              <Building2 className="h-6 w-6 mx-auto mb-1 text-slate-300" />
              <p className="text-xs font-medium">No Department Usage Recorded</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                No approved bookings with department tags in this period.
              </p>
            </div>
          ) : (
            departmentsUsage.map((dept, index) => {
              const colorScheme = getDepartmentColorScheme(dept.code, dept.name);
              const percentage = totalOrgHours > 0
                ? Math.round((dept.bookedHours / totalOrgHours) * 100)
                : 0;

              return (
                <div key={dept.departmentId ?? `legacy-${index}`} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-slate-400 w-4 text-center">
                        #{index + 1}
                      </span>
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.2 rounded border shadow-2xs shrink-0"
                        style={{
                          backgroundColor: colorScheme.badgeBg,
                          borderColor: colorScheme.badgeBorder,
                          color: colorScheme.badgeText,
                        }}
                      >
                        {dept.code || "N/A"}
                      </span>
                      <span className="font-semibold text-slate-900 truncate">
                        {dept.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 text-right">
                      <span className="text-[11px] text-slate-400 font-medium">
                        {dept.reservationCount} {dept.reservationCount === 1 ? "booking" : "bookings"}
                      </span>
                      <span className="font-bold text-slate-900 min-w-[50px]">
                        {dept.bookedHours.toFixed(1)}h
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.max(4, percentage)}%`,
                        backgroundColor: colorScheme.text,
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // If MEMBER: Show Resource Catalog & Quick Reservation Links
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xs p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-2xs">
            <Layers className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              Resource Catalog
            </h3>
            <p className="text-[11px] text-slate-400">
              {totalActiveResources} operational facilities ready for booking
            </p>
          </div>
        </div>

        <Link
          href="/resources"
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
        >
          <span>Browse All</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-2 gap-2.5 pt-1">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/resources?categoryId=${cat.id}`}
            className="p-3 rounded-xl border border-slate-200/90 hover:border-blue-300 hover:bg-blue-50/20 transition-all flex items-center justify-between group"
          >
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 truncate">
                {cat.name}
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Explore & Reserve</p>
            </div>
            <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-blue-600 transition-colors shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
