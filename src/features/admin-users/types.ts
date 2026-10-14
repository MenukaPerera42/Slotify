export type AdminUserErrorCode =
  | "UNAUTHENTICATED" | "FORBIDDEN" | "INVALID_INPUT" | "USER_NOT_FOUND"
  | "EMAIL_CONFLICT" | "EMAIL_VERIFICATION_REQUIRED" | "DEPARTMENT_NOT_FOUND" | "DEPARTMENT_INACTIVE"
  | "DEPARTMENT_REQUIRED" | "NAME_PAIR_REQUIRED" | "LAST_ACTIVE_ADMIN"
  | "SELF_ROLE_CHANGE" | "SELF_DEACTIVATION" | "EMAIL_DELIVERY_FAILED" | "EMAIL_CONFIGURATION_ERROR" | "DATABASE_ERROR";

export type AdminUserResult<T> =
  | { success: true; data: T }
  | { success: false; code: AdminUserErrorCode; error: string; fieldErrors?: Record<string, string[]> };

export class AdminUserError extends Error {
  constructor(public readonly code: AdminUserErrorCode, message: string) { super(message); }
}
