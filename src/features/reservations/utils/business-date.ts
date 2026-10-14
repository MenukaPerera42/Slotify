import { ReservationError } from "../types";

export const BUSINESS_TIME_ZONE = "Asia/Colombo";
const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

function offsetAt(instant: number) {
  const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(({ type, value }) => [type, value]));
  const localAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return localAsUtc - instant;
}

function localMidnightAsUtc(utcDate: number) {
  let candidate = utcDate - offsetAt(utcDate);
  candidate = utcDate - offsetAt(candidate);
  return new Date(candidate);
}

export function businessDayBounds(day: string) {
  const utcDay = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(utcDay.valueOf()) || utcDay.toISOString().slice(0, 10) !== day) {
    throw new ReservationError("INVALID_INPUT", "Invalid calendar date.");
  }
  return { start: localMidnightAsUtc(utcDay.valueOf()), end: localMidnightAsUtc(utcDay.valueOf() + 86_400_000) };
}
