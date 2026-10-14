export type NotificationErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "INVALID_INPUT"
  | "NOTIFICATION_NOT_FOUND"
  | "DATABASE_ERROR";

export type NotificationResult<T> =
  | { success: true; data: T }
  | { success: false; code: NotificationErrorCode; error: string; fieldErrors?: Record<string, string[]> };

export class NotificationError extends Error {
  constructor(public readonly code: NotificationErrorCode, message: string) {
    super(message);
  }
}

