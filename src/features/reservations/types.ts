export type ReservationErrorCode =
  | "UNAUTHENTICATED" | "FORBIDDEN" | "INVALID_INPUT" | "RESOURCE_NOT_FOUND"
  | "RESOURCE_INACTIVE" | "RESERVATION_NOT_FOUND" | "SLOT_CONFLICT"
  | "INVALID_STATUS_TRANSITION" | "DATABASE_ERROR";

export type ReservationResult<T> =
  | { success: true; data: T }
  | { success: false; code: ReservationErrorCode; error: string; fieldErrors?: Record<string, string[]> };

export class ReservationError extends Error {
  constructor(public readonly code: ReservationErrorCode, message: string) { super(message); }
}
