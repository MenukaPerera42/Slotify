import type { ReservationOccupancy, TimelineResourceItem } from "../components/timeline-grid";

export type DragMode = "start" | "end" | "move";

export interface ConfirmedReservationTime {
  id: string;
  startTime: Date | string;
  endTime: Date | string;
  updatedAt: Date | string;
}

export function bookedTimelineResources(
  resources: TimelineResourceItem[],
  occupancy: ReservationOccupancy[],
  windowStart: number,
  windowEnd: number,
) {
  const occupiedIds = new Set(occupancy.filter((booking) =>
    (booking.status === "PENDING" || booking.status === "APPROVED") &&
    new Date(booking.startTime).getTime() < windowEnd &&
    new Date(booking.endTime).getTime() > windowStart
  ).map((booking) => booking.resourceId));
  return resources.filter((resource) => occupiedIds.has(resource.id));
}

export function proposeTimelineDrag(input: {
  mode: DragMode;
  initialStartMs: number;
  initialEndMs: number;
  deltaX: number;
  containerWidth: number;
  windowStartMs: number;
  windowEndMs: number;
  intervalMinutes: number;
}) {
  const stepMs = input.intervalMinutes * 60_000;
  const deltaMs = input.deltaX / input.containerWidth * (input.windowEndMs - input.windowStartMs);
  const snap = (ms: number) => input.windowStartMs + Math.round((ms - input.windowStartMs) / stepMs) * stepMs;
  const startMs = input.mode === "end" ? input.initialStartMs : snap(input.initialStartMs + deltaMs);
  const endMs = input.mode === "start" ? input.initialEndMs :
    input.mode === "move" ? startMs + (input.initialEndMs - input.initialStartMs) : snap(input.initialEndMs + deltaMs);
  return {
    startMs,
    endMs,
    outsideShift: startMs < input.windowStartMs || endMs > input.windowEndMs || endMs - startMs < stepMs,
  };
}

export function dragOverlapsBooking(
  occupancy: ReservationOccupancy[], resourceId: string, reservationId: string,
  startMs: number, endMs: number,
) {
  return occupancy.some((booking) =>
    booking.resourceId === resourceId &&
    (booking.status === "PENDING" || booking.status === "APPROVED") &&
    booking.id !== reservationId &&
    !booking.reservationIds?.includes(reservationId) &&
    new Date(booking.startTime).getTime() < endMs &&
    new Date(booking.endTime).getTime() > startMs
  );
}

export function applyConfirmedTime<T extends ReservationOccupancy>(
  occupancy: T[], confirmed: ConfirmedReservationTime,
): T[] {
  return occupancy.map((booking) => {
    if (booking.id !== confirmed.id && !booking.reservationIds?.includes(confirmed.id)) return booking;
    // Grouped records need a fresh server grouping; only patch individual blocks.
    if ((booking.reservationIds?.length ?? 1) > 1) return booking;
    return { ...booking, startTime: confirmed.startTime, endTime: confirmed.endTime, updatedAt: confirmed.updatedAt,
      bookings: booking.bookings?.map((item) => item.id === confirmed.id
        ? { ...item, startTime: confirmed.startTime, endTime: confirmed.endTime, updatedAt: confirmed.updatedAt }
        : item) };
  });
}
