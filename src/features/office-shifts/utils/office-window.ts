import type { OfficeShiftMode } from "@prisma/client";
import { businessDayBounds, BUSINESS_TIME_ZONE } from "@/features/reservations/utils/business-date";

export const DEFAULT_OFFICE_WINDOW = {
  id: null, name: "Legacy display window", mode: "CUSTOM" as OfficeShiftMode,
  description: "Display fallback until an administrator activates a shift.",
  startMinute: 540, durationMinutes: 540, isActive: false,
};
export const TIMELINE_INTERVAL_MINUTES = 30;
export type WindowDefinition = { startMinute: number; durationMinutes: number; mode?: OfficeShiftMode };

export function localDateOf(instant: Date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(instant).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function previousDate(date: string) {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

export function officeWindow(date: string, definition: WindowDefinition) {
  const calendar = businessDayBounds(date);
  const startTime = new Date(calendar.start.getTime() + definition.startMinute * 60_000);
  const endTime = new Date(startTime.getTime() + definition.durationMinutes * 60_000);
  const endTotal = definition.startMinute + definition.durationMinutes;
  return {
    operationalDate: date, startTime, endTime,
    startMinute: definition.startMinute, endMinute: endTotal % 1440,
    endDayOffset: Math.floor(endTotal / 1440),
    durationMinutes: definition.durationMinutes,
    crossesMidnight: endTime.getTime() > calendar.end.getTime(),
    endsNextDay: endTime.getTime() >= calendar.end.getTime(),
    timeZone: BUSINESS_TIME_ZONE,
    timelineIntervalMinutes: TIMELINE_INTERVAL_MINUTES,
  };
}

export function bookingOperationalDate(startTime: Date, endTime: Date, definition: WindowDefinition) {
  const date = localDateOf(startTime);
  for (const candidate of [date, previousDate(date)]) {
    const window = officeWindow(candidate, definition);
    if (startTime >= window.startTime && startTime < window.endTime) {
      if (endTime <= window.endTime) return candidate;
      // Consecutive full-day windows are continuous; cap one booking at 24 hours.
      if (definition.mode === "FULL_DAY" && definition.durationMinutes === 1440
        && endTime.getTime() - startTime.getTime() <= 86_400_000) return candidate;
    }
  }
  return null;
}
