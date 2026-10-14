import "server-only";
import { Prisma, type ReservationStatus } from "@prisma/client";
import { currentUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { businessDayBounds } from "@/features/reservations/utils/business-date";
import { DashboardError } from "../types";
import type { MonthInput, SelectedDayInput } from "../schemas/dashboard-schema";
import { clippedMilliseconds, monthDays } from "../utils/reporting-period";

const blocking: ReservationStatus[] = ["PENDING", "APPROVED"];

async function actor() {
  const user = await currentUser();
  if (!user) throw new DashboardError("UNAUTHENTICATED", "Sign in with an active account to continue.");
  return user;
}

type Actor = NonNullable<Awaited<ReturnType<typeof currentUser>>>;
function scope(user: Actor): Prisma.ReservationWhereInput {
  return user.role === "ADMIN" ? {} : { userId: user.id };
}
function scopeName(user: Actor) { return user.role === "ADMIN" ? "ORGANIZATION" as const : "PERSONAL" as const; }
function overlapping(start: Date, end: Date, user: Actor): Prisma.ReservationWhereInput {
  return { ...scope(user), startTime: { lt: end }, endTime: { gt: start } };
}
function statusCounts(rows: { status: ReservationStatus }[]) {
  const counts = { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
  for (const { status } of rows) {
    if (status === "PENDING") counts.pending++;
    else if (status === "APPROVED") counts.approved++;
    else if (status === "REJECTED") counts.rejected++;
    else counts.cancelled++;
  }
  return counts;
}

/** All-time counts; never accepts a selected date or calendar filter. */
export async function reservationSummary() {
  const user = await actor();
  const [byStatus, activeResources] = await Promise.all([
    prisma.reservation.groupBy({ by: ["status"], where: scope(user), _count: { _all: true } }),
    prisma.resource.count({ where: { isActive: true } }),
  ]);
  const counts = { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
  for (const row of byStatus) {
    if (row.status === "PENDING") counts.pending = row._count._all;
    else if (row.status === "APPROVED") counts.approved = row._count._all;
    else if (row.status === "REJECTED") counts.rejected = row._count._all;
    else counts.cancelled = row._count._all;
  }
  return {
    scope: scopeName(user), totalBookings: counts.pending + counts.approved + counts.rejected + counts.cancelled,
    pendingReview: counts.pending, approvedBookings: counts.approved,
    rejectedBookings: counts.rejected, cancelledBookings: counts.cancelled, activeResources,
  };
}

export async function monthlyCalendarSummary(input: MonthInput) {
  const user = await actor();
  const days = monthDays(input);
  const startTime = days[0].start;
  const endTime = days.at(-1)!.end;
  const rows = await prisma.reservation.findMany({
    where: overlapping(startTime, endTime, user),
    select: { status: true, startTime: true, endTime: true },
  });
  return {
    ...input, scope: scopeName(user), timeZone: "Asia/Colombo" as const, startTime, endTime,
    days: days.map((day) => {
      const counts = statusCounts(rows.filter((row) => clippedMilliseconds(row.startTime, row.endTime, day.start, day.end) > 0));
      return { date: day.date, ...counts, scheduled: counts.pending + counts.approved,
        hasActivity: counts.pending + counts.approved + counts.rejected + counts.cancelled > 0 };
    }),
  };
}

export async function selectedDayDashboardSummary(input: SelectedDayInput) {
  const user = await actor();
  const { start, end } = businessDayBounds(input.selectedDate);
  const [rows, activeResources] = await Promise.all([
    prisma.reservation.findMany({ where: overlapping(start, end, user), select: { status: true, resourceId: true } }),
    prisma.resource.count({ where: { isActive: true } }),
  ]);
  const counts = statusCounts(rows);
  const bookedResources = new Set(rows.filter((row) => blocking.includes(row.status)).map((row) => row.resourceId)).size;
  return { selectedDate: input.selectedDate, scope: scopeName(user),
    scheduledReservations: counts.pending + counts.approved, pendingRequests: counts.pending,
    approvedBookings: counts.approved, activeResources, bookedResources };
}

export async function selectedDaySchedule(input: SelectedDayInput) {
  const user = await actor();
  const { start, end } = businessDayBounds(input.selectedDate);
  const items = await prisma.reservation.findMany({
    where: { ...overlapping(start, end, user), status: { in: blocking } },
    select: {
      id: true, title: true, status: true, startTime: true, endTime: true, resourceId: true,
      resource: { select: { name: true, location: true, category: { select: { name: true } } } },
      departmentId: true, department: { select: { name: true, code: true } },
      userId: true, user: { select: { name: true, email: true } }, createdByUserId: true,
    },
    orderBy: [{ startTime: "asc" }, { id: "asc" }],
  });
  // Member rows are owner-scoped and omit other actors' identifiers and profiles.
  const visibleItems = user.role === "ADMIN" ? items : items.map(({
    id, title, status, startTime, endTime, resourceId, resource, departmentId, department, userId,
  }) => ({ id, title, status, startTime, endTime, resourceId, resource, departmentId, department, userId }));
  return { selectedDate: input.selectedDate, scope: scopeName(user), items: visibleItems };
}

export async function monthlyUsage(input: MonthInput) {
  const user = await actor();
  const days = monthDays(input);
  const startTime = days[0].start;
  const endTime = days.at(-1)!.end;
  const rows = await prisma.reservation.findMany({
    where: { ...overlapping(startTime, endTime, user), status: "APPROVED" },
    select: { startTime: true, endTime: true },
  });
  const daily = days.map((day) => {
    const bookedMilliseconds = rows.reduce((sum, row) => sum + clippedMilliseconds(row.startTime, row.endTime, day.start, day.end), 0);
    return { date: day.date, bookedHours: bookedMilliseconds / 3_600_000 };
  });
  return { ...input, scope: scopeName(user), timeZone: "Asia/Colombo" as const,
    metric: "APPROVED_BOOKED_HOURS" as const, startTime, endTime,
    totalBookedHours: daily.reduce((sum, day) => sum + day.bookedHours, 0), days: daily };
}

export async function departmentUsage(input: MonthInput) {
  const user = await actor();
  if (user.role !== "ADMIN") throw new DashboardError("FORBIDDEN", "Administrator access is required.");
  const days = monthDays(input);
  const startTime = days[0].start;
  const endTime = days.at(-1)!.end;
  const rows = await prisma.reservation.findMany({
    where: { status: "APPROVED", startTime: { lt: endTime }, endTime: { gt: startTime } },
    select: { departmentId: true, department: { select: { name: true, code: true } }, startTime: true, endTime: true },
  });
  const groups = new Map<string, { departmentId: string | null; name: string; code: string | null; reservationCount: number; bookedMilliseconds: number }>();
  for (const row of rows) {
    const key = row.departmentId ?? "LEGACY";
    const group = groups.get(key) ?? { departmentId: row.departmentId, name: row.department?.name ?? "Unassigned/Legacy",
      code: row.department?.code ?? null, reservationCount: 0, bookedMilliseconds: 0 };
    group.reservationCount++;
    group.bookedMilliseconds += clippedMilliseconds(row.startTime, row.endTime, startTime, endTime);
    groups.set(key, group);
  }
  return { ...input, timeZone: "Asia/Colombo" as const, metric: "APPROVED_BOOKED_HOURS" as const, startTime, endTime,
    departments: [...groups.values()].map(({ bookedMilliseconds, ...group }) => ({ ...group, bookedHours: bookedMilliseconds / 3_600_000 }))
      .sort((a, b) => b.bookedHours - a.bookedHours || a.name.localeCompare(b.name)) };
}
