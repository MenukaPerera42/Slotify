"use server";

import { z } from "zod";
import {
  listNotificationsSchema,
  notificationIdSchema,
} from "../schemas/notification-schema";
import type { NotificationResult } from "../types";
import { NotificationError } from "../types";
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../services/notification-service";

async function run<T>(operation: () => Promise<T>): Promise<NotificationResult<T>> {
  try {
    return { success: true, data: await operation() };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        code: "INVALID_INPUT",
        error: "Check the submitted fields.",
        fieldErrors: error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    if (error instanceof NotificationError) {
      return { success: false, code: error.code, error: error.message };
    }
    console.error("Notification operation failed:", error);
    return {
      success: false,
      code: "DATABASE_ERROR",
      error: "Unable to complete the notification operation. Please try again.",
    };
  }
}

export async function listNotificationsAction(input: unknown = {}) {
  return run(() => listNotifications(listNotificationsSchema.parse(input)));
}

export async function getUnreadNotificationCountAction() {
  return run(() => getUnreadNotificationCount());
}

export async function markNotificationAsReadAction(id: unknown) {
  return run(() => markNotificationAsRead(notificationIdSchema.parse(id)));
}

export async function markAllNotificationsAsReadAction() {
  return run(() => markAllNotificationsAsRead());
}

export async function listNotificationHistoryAction(input: unknown = {}) {
  return run(() => listNotifications(listNotificationsSchema.parse(input)));
}

