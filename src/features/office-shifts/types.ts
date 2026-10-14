export type OfficeShiftErrorCode =
  | "UNAUTHENTICATED" | "FORBIDDEN" | "INVALID_INPUT" | "SHIFT_NOT_FOUND"
  | "ACTIVE_SHIFT_IMMUTABLE" | "FULL_DAY_SHIFT_REQUIRED" | "SHIFT_NAME_CONFLICT"
  | "IMPACT_CONFIRMATION_REQUIRED" | "STALE_IMPACT_PREVIEW" | "DATABASE_ERROR";

export class OfficeShiftError extends Error {
  constructor(public readonly code: OfficeShiftErrorCode, message: string, public readonly impact?: unknown) {
    super(message);
  }
}

export type OfficeShiftResult<T> =
  | { success: true; data: T }
  | { success: false; code: OfficeShiftErrorCode; error: string; fieldErrors?: Record<string, string[]>; impact?: unknown };
