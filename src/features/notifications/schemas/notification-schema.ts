import { z } from "zod";

export const notificationIdSchema = z.string().uuid("Invalid notification ID");

export const listNotificationsSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  isRead: z.boolean().optional(),
  type: z
    .enum([
      "RESERVATION_REQUESTED",
      "RESERVATION_APPROVED",
      "RESERVATION_REJECTED",
      "RESERVATION_CANCELLED",
    ])
    .optional(),
});

export type ListNotificationsInput = z.infer<typeof listNotificationsSchema>;

