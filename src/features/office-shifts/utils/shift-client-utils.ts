import { formatSlotLabel } from "@/features/reservations/utils/client-date";

/**
 * Converts minute of day (0-1439) to HH:MM format.
 */
export function minuteToTimeStr(minute: number): string {
  const h = Math.floor((minute % 1440) / 60);
  const m = minute % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/**
 * Converts HH:MM string to minute of day (0-1439).
 */
export function timeStrToMinute(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return (h * 60 + m) % 1440;
}

/**
 * Formats a shift's startMinute and durationMinutes to human-readable label:
 * e.g. "08:00 AM – 04:00 PM" or "10:00 PM – 06:00 AM (+1 day)"
 */
export function formatShiftHours(startMinute: number, durationMinutes: number): string {
  const endTotal = startMinute + durationMinutes;
  const startTime = minuteToTimeStr(startMinute);
  const endTime = minuteToTimeStr(endTotal % 1440);
  const dayOffset = Math.floor(endTotal / 1440);

  const startLabel = formatSlotLabel(startTime);
  const endLabel =
    durationMinutes === 1440 && startMinute === 0
      ? "24:00 (Full Day)"
      : `${formatSlotLabel(endTime)}${dayOffset > 0 ? " (+1 day)" : ""}`;

  return `${startLabel} – ${endLabel}`;
}

export interface ShiftTimelineSlot {
  slotTime: string; // HH:MM
  label: string; // e.g. "9:00 AM" or "12:00 AM (+1d)"
  dayOffset: number; // 0 or 1
  minuteOffset: number; // from operational start
  isRollover: boolean;
  isNoon: boolean;
  isMidnight: boolean;
}

/**
 * Generates an array of 30-minute timeline intervals for a given shift duration.
 */
export function generateShiftTimelineSlots(
  startMinute: number,
  durationMinutes: number
): ShiftTimelineSlot[] {
  const slots: ShiftTimelineSlot[] = [];
  const count = Math.ceil(durationMinutes / 30);

  for (let i = 0; i < count; i++) {
    const minuteFromMidnight = (startMinute + i * 30) % 1440;
    const dayOffset = Math.floor((startMinute + i * 30) / 1440);
    const time24 = minuteToTimeStr(minuteFromMidnight);

    const isMidnight = minuteFromMidnight === 0;
    const isNoon = minuteFromMidnight === 720;
    const isRollover = dayOffset > 0;

    let label = formatSlotLabel(time24);
    if (isMidnight && isRollover) {
      label = "00:00 (+1d)";
    } else if (isRollover) {
      label = `${label} (+1d)`;
    }

    slots.push({
      slotTime: time24,
      label,
      dayOffset,
      minuteOffset: i * 30,
      isRollover,
      isNoon,
      isMidnight,
    });
  }

  return slots;
}

export interface BookingTimeOption {
  timeStr: string; // HH:MM
  label: string; // e.g. "09:00 AM" or "02:00 AM (Next Day)"
  dayOffset: number; // 0 or 1
  minuteOffset: number; // from operational start
}

export function generateBookingStartOptions(
  startMinute: number,
  durationMinutes: number
): BookingTimeOption[] {
  const options: BookingTimeOption[] = [];
  const slotCount = Math.floor(durationMinutes / 30);
  // Start times can go up to 30 mins before shift end
  for (let i = 0; i < slotCount; i++) {
    const minuteFromMidnight = (startMinute + i * 30) % 1440;
    const dayOffset = Math.floor((startMinute + i * 30) / 1440);
    const time24 = minuteToTimeStr(minuteFromMidnight);
    const label = `${formatSlotLabel(time24)}${dayOffset > 0 ? " (Next Day)" : ""}`;
    options.push({
      timeStr: time24,
      label,
      dayOffset,
      minuteOffset: i * 30,
    });
  }
  return options;
}

export function generateBookingEndOptions(
  selectedStartTime: string,
  startMinute: number,
  durationMinutes: number
): BookingTimeOption[] {
  const options: BookingTimeOption[] = [];
  const [startH, startM] = selectedStartTime.split(":").map(Number);
  const startMinuteOfDay = startH * 60 + startM;

  let startOffsetMinutes = (startMinuteOfDay - startMinute + 1440) % 1440;
  if (startMinuteOfDay === startMinute) startOffsetMinutes = 0;

  const totalSlots = Math.floor(durationMinutes / 30);
  const startSlotIndex = Math.floor(startOffsetMinutes / 30);

  for (let i = startSlotIndex + 1; i <= totalSlots; i++) {
    const minuteFromStart = i * 30;
    const minuteFromMidnight = (startMinute + minuteFromStart) % 1440;
    const dayOffset = Math.floor((startMinute + minuteFromStart) / 1440);
    const time24 = minuteToTimeStr(minuteFromMidnight);
    const durationHours = (i - startSlotIndex) * 0.5;

    let timeLabel = formatSlotLabel(time24);
    if (time24 === "00:00" && dayOffset > 0) {
      timeLabel = "12:00 AM (Midnight)";
    }
    const label = `${timeLabel}${dayOffset > 0 ? " (Next Day)" : ""} · ${durationHours}h`;

    options.push({
      timeStr: time24,
      label,
      dayOffset,
      minuteOffset: minuteFromStart,
    });
  }
  return options;
}

