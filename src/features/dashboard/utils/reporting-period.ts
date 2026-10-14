import { businessDayBounds } from "@/features/reservations/utils/business-date";
import type { MonthInput } from "../schemas/dashboard-schema";

export type ReportingDay = { date: string; start: Date; end: Date };

export function monthDays({ year, month }: MonthInput): ReportingDay[] {
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: count }, (_, index) => {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`;
    return { date, ...businessDayBounds(date) };
  });
}

export function clippedMilliseconds(start: Date, end: Date, boundaryStart: Date, boundaryEnd: Date) {
  return Math.max(0, Math.min(end.getTime(), boundaryEnd.getTime()) - Math.max(start.getTime(), boundaryStart.getTime()));
}
