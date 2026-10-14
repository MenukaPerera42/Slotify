export type DashboardErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "INVALID_INPUT" | "DATABASE_ERROR";

export type DashboardResult<T> =
  | { success: true; data: T }
  | { success: false; code: DashboardErrorCode; error: string; fieldErrors?: Record<string, string[]> };

export class DashboardError extends Error {
  constructor(public readonly code: DashboardErrorCode, message: string) { super(message); }
}
