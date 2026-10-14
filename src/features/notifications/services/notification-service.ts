import "server-only";
import { Prisma, type NotificationType } from "@prisma/client";
import { currentUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { NotificationError } from "../types";
import type { ListNotificationsInput } from "../schemas/notification-schema";

const notificationSelect = {
  id: true,
  recipientUserId: true,
  actorUserId: true,
  reservationId: true,
  type: true,
  title: true,
  message: true,
  isRead: true,
  createdAt: true,
  readAt: true,
  actor: {
    select: {
      name: true,
      email: true,
    },
  },
  reservation: {
    select: {
      title: true,
      startTime: true,
      endTime: true,
      status: true,
      resource: {
        select: {
          name: true,
        },
      },
    },
  },
} satisfies Prisma.NotificationSelect;

async function actor() {
  const user = await currentUser();
  if (!user) {
    throw new NotificationError("UNAUTHENTICATED", "Sign in with an active account to continue.");
  }
  return user;
}

export async function listNotifications(input: ListNotificationsInput) {
  const user = await actor();
  const where: Prisma.NotificationWhereInput = {
    recipientUserId: user.id,
    ...(input.isRead !== undefined ? { isRead: input.isRead } : {}),
    ...(input.type ? { type: input.type } : {}),
  };

  const [items, total, unreadCount] = await prisma.$transaction([
    prisma.notification.findMany({
      where,
      select: notificationSelect,
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: {
        recipientUserId: user.id,
        isRead: false,
      },
    }),
  ]);

  return {
    items,
    total,
    unreadCount,
    page: input.page,
    pageSize: input.pageSize,
  };
}

export async function getUnreadNotificationCount() {
  const user = await actor();
  return prisma.notification.count({
    where: {
      recipientUserId: user.id,
      isRead: false,
    },
  });
}

export async function markNotificationAsRead(id: string) {
  const user = await actor();

  // Attempt atomic update scoped strictly to current recipient
  const result = await prisma.notification.updateMany({
    where: {
      id,
      recipientUserId: user.id,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  if (result.count === 0) {
    const existing = await prisma.notification.findUnique({
      where: { id },
      select: { recipientUserId: true, isRead: true },
    });

    if (!existing || existing.recipientUserId !== user.id) {
      throw new NotificationError("NOTIFICATION_NOT_FOUND", "Notification not found.");
    }
  }

  return prisma.notification.findUniqueOrThrow({
    where: { id },
    select: notificationSelect,
  });
}

export async function markAllNotificationsAsRead() {
  const user = await actor();
  const now = new Date();

  const result = await prisma.notification.updateMany({
    where: {
      recipientUserId: user.id,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: now,
    },
  });

  return { count: result.count };
}

export interface NotificationPayload {
  recipientUserId: string;
  actorUserId?: string | null;
  reservationId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
}

export async function createNotificationsTx(
  tx: Prisma.TransactionClient,
  payloads: NotificationPayload[]
) {
  if (payloads.length === 0) return;

  // Insert notifications within caller's active database transaction
  await tx.notification.createMany({
    data: payloads.map((p) => ({
      recipientUserId: p.recipientUserId,
      actorUserId: p.actorUserId ?? null,
      reservationId: p.reservationId ?? null,
      type: p.type,
      title: p.title,
      message: p.message,
      isRead: false,
    })),
  });
}

