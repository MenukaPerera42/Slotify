export type DepartmentErrorCode =
  | "UNAUTHENTICATED" | "FORBIDDEN" | "INVALID_INPUT" | "DEPARTMENT_NOT_FOUND"
  | "DEPARTMENT_INACTIVE" | "DEPARTMENT_IN_USE" | "DEPARTMENT_CONFLICT"
  | "DUPLICATE_NAME" | "DUPLICATE_CODE" | "NOT_FOUND" | "IN_USE"
  | "USER_NOT_FOUND" | "DATABASE_ERROR";

export type DepartmentResult<T> =
  | { success: true; data: T }
  | { success: false; code: DepartmentErrorCode; error: string; fieldErrors?: Record<string, string[]> };

export class DepartmentError extends Error {
  constructor(public readonly code: DepartmentErrorCode, message: string) { super(message); }
}
