import { BUSINESS_TIME_ZONE } from "./business-date";

/**
 * Returns today's calendar date in Asia/Colombo as 'YYYY-MM-DD'.
 */
export function getColomboTodayString(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

/**
 * Checks if a YYYY-MM-DD date string is today in Asia/Colombo.
 */
export function isColomboDateToday(dateStr: string): boolean {
  return dateStr === getColomboTodayString();
}

/**
 * Shifts a YYYY-MM-DD date string by a number of days safely across months and years.
 */
export function shiftColomboDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  return target.toISOString().slice(0, 10);
}

/**
 * Formats a Date or ISO string into human-readable Colombo date e.g. "Thu, Oct 15, 2026".
 */
export function formatColomboDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    ...options,
  }).format(d);
}

/**
 * Formats a Date or ISO string into human-readable Colombo time e.g. "09:30 AM".
 */
export function formatColomboTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/**
 * Formats a start and end time interval into e.g. "09:00 AM – 10:30 AM".
 */
export function formatColomboInterval(start: Date | string, end: Date | string): string {
  return `${formatColomboTime(start)} – ${formatColomboTime(end)}`;
}

/**
 * Returns an array of date objects for a multi-day strip around a center date.
 */
export function getColomboDateStrip(centerDateStr: string, count = 12) {
  // Parse YYYY-MM-DD
  const [year, month, day] = centerDateStr.split("-").map(Number);
  const base = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  const items = [];
  const offsetStart = -2;
  for (let i = offsetStart; i < count + offsetStart; i++) {
    const d = new Date(base.getTime() + i * 86_400_000);
    const dateStr = d.toISOString().slice(0, 10);
    const weekday = new Intl.DateTimeFormat("en-US", { timeZone: BUSINESS_TIME_ZONE, weekday: "short" }).format(d);
    const dayNum = new Intl.DateTimeFormat("en-US", { timeZone: BUSINESS_TIME_ZONE, day: "numeric" }).format(d);
    const monthStr = new Intl.DateTimeFormat("en-US", { timeZone: BUSINESS_TIME_ZONE, month: "short" }).format(d);

    items.push({
      dateStr,
      day: weekday,
      dateNum: parseInt(dayNum, 10),
      month: monthStr,
      isToday: isColomboDateToday(dateStr),
    });
  }
  return items;
}

/**
 * Generates ISO string with +05:30 offset for Colombo date and time:
 * date: "YYYY-MM-DD", time: "HH:MM" -> "YYYY-MM-DDTHH:MM:00+05:30"
 */
export function createColomboISO(dateStr: string, timeStr: string): string {
  // Ensure HH:MM format
  const [h, m] = timeStr.split(":");
  const hh = h.padStart(2, "0");
  const mm = m.padStart(2, "0");
  return `${dateStr}T${hh}:${mm}:00+05:30`;
}

/**
 * Standard business operating time slots in 30-minute intervals (07:00 to 19:00).
 */
export const BUSINESS_TIME_SLOTS = [
  "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00",
];

export function formatSlotLabel(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${m.toString().padStart(2, "0")} ${period}`;
}

/**
 * Category-aware CTA labels for booking buttons per assessment requirements.
 */
export function getResourceBookingCta(categoryName?: string): string {
  const lower = (categoryName || "").toLowerCase();
  if (lower.includes("meeting") || lower.includes("room") || lower.includes("board")) {
    return "Book meeting room";
  }
  if (lower.includes("workstation") || lower.includes("desk") || lower.includes("pod")) {
    return "Reserve workspace";
  }
  if (lower.includes("lab") || lower.includes("equipment") || lower.includes("server") || lower.includes("gpu")) {
    return "Reserve equipment";
  }
  return "Reserve resource";
}
