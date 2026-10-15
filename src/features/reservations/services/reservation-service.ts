import "server-only";
import { Prisma, type ReservationStatus } from "@prisma/client";
import { z } from "zod";
import { currentUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { businessDayBounds } from "../utils/business-date";
import { ReservationError } from "../types";
import { activeUserListSchema, reservationListSchema, type AvailabilityInput, type CreateAdminReservationInput, type CreateReservationInput, type DailyInput, type UpdateReservationTimeInput } from "../schemas/reservation-schema";
import { createNotificationsTx } from "@/features/notifications/services/notification-service";
import { groupAdjacentReservations } from "../utils/group-adjacent";
import { activeShift, lockSchedulingPolicy } from "@/features/office-shifts/services/office-shift-service";
import { bookingOperationalDate } from "@/features/office-shifts/utils/office-window";

const blocking: ReservationStatus[] = ["PENDING", "APPROVED"];
const reservationSelect = {
  id: true, resourceId: true, userId: true, departmentId: true, createdByUserId: true, title: true, startTime: true,
  endTime: true, status: true, createdAt: true, updatedAt: true,
  resource: { select: { name: true, categoryId: true } },
  user: { select: { name: true, email: true } },
  department: { select: { name: true, code: true } },
} satisfies Prisma.ReservationSelect;

async function actor() {
  const user = await currentUser();
  if (!user) throw new ReservationError("UNAUTHENTICATED", "Sign in with an active account to continue.");
  return user;
}

async function admin() {
  const user = await actor();
  if (user.role !== "ADMIN") throw new ReservationError("FORBIDDEN", "Administrator access is required.");
  return user;
}

function overlap(start: Date, end: Date): Prisma.ReservationWhereInput {
  return { status: { in: blocking }, startTime: { lt: end }, endTime: { gt: start } };
}

async function insertReservation(
  input: CreateReservationInput,
  ownerId: string | null,
  departmentId: string,
  creator: { id: string; name: string },
  status: "PENDING" | "APPROVED",
) {
  const startTime = new Date(input.startTime);
  const endTime = new Date(input.endTime);
  if (endTime <= new Date()) throw new ReservationError("INVALID_INPUT", "The reservation must not be entirely in the past.");
  return prisma.$transaction(async (tx) => {
    // Serialize booking validation with policy activation.
    await lockSchedulingPolicy(tx);
    const shift = await activeShift(tx);
    if (shift && !bookingOperationalDate(startTime, endTime, shift)) {
      throw new ReservationError("SHIFT_OUTSIDE_WINDOW", "The booking must fit entirely within an active office shift.");
    }
    // Lock the resource row against a simultaneous deactivate operation.
    const rows = await tx.$queryRaw<Array<{ id: string; name: string; isActive: boolean }>>`
      SELECT id, name, "isActive" FROM resources WHERE id = ${input.resourceId}::uuid FOR SHARE`;
    const resource = rows[0];
    if (!resource) throw new ReservationError("RESOURCE_NOT_FOUND", "Resource not found.");
    if (!resource.isActive) throw new ReservationError("RESOURCE_INACTIVE", "This resource is inactive.");
    const departments = await tx.$queryRaw<Array<{ id: string; isActive: boolean }>>`
      SELECT id, "isActive" FROM departments WHERE id = ${departmentId}::uuid FOR SHARE`;
    if (!departments[0]) throw new ReservationError("DEPARTMENT_NOT_FOUND", "Department not found.");
    if (!departments[0].isActive) throw new ReservationError("DEPARTMENT_INACTIVE", "Department is inactive.");
    if (ownerId) {
      const users = await tx.$queryRaw<Array<{ id: string; isActive: boolean; departmentId: string | null }>>`
        SELECT id, "isActive", "departmentId" FROM users WHERE id = ${ownerId}::uuid FOR SHARE`;
      if (!users[0]) throw new ReservationError("USER_NOT_FOUND", "Target user not found.");
      if (!users[0].isActive) throw new ReservationError("USER_INACTIVE", "Target user is inactive.");
      if (users[0].departmentId !== departmentId) throw new ReservationError("DEPARTMENT_MISMATCH", "Target user belongs to a different department.");
    }
    // The GiST exclusion constraint is the final overlap authority.
    const created = await tx.reservation.create({
      data: { resourceId: input.resourceId, userId: ownerId, departmentId, createdByUserId: creator.id, title: input.title, startTime, endTime, status },
      select: reservationSelect,
    });

    if (status === "PENDING") {
      const admins = await tx.user.findMany({
        where: { role: "ADMIN", isActive: true },
        select: { id: true },
      });
      const recipients = admins.filter((a) => a.id !== creator.id);
      if (recipients.length > 0) {
        await createNotificationsTx(
          tx,
          recipients.map((a) => ({
            recipientUserId: a.id,
            actorUserId: creator.id,
            reservationId: created.id,
            type: "RESERVATION_REQUESTED",
            title: "New Reservation Request",
            message: `${creator.name} requested "${input.title}" for ${resource.name}.`,
          }))
        );
      }
    } else if (status === "APPROVED" && ownerId && ownerId !== creator.id) {
      await createNotificationsTx(tx, [
        {
          recipientUserId: ownerId,
          actorUserId: creator.id,
          reservationId: created.id,
          type: "RESERVATION_APPROVED",
          title: "Reservation Created",
          message: `An administrator reserved ${resource.name} ("${input.title}") on your behalf.`,
        },
      ]);
    }

    return created;
  });
}

export async function createReservation(input: CreateReservationInput) {
  const user = await actor();
  if (!user.departmentId) throw new ReservationError("DEPARTMENT_REQUIRED", "A department assignment is required before booking.");
  return insertReservation(input, user.id, user.departmentId, user, user.role === "ADMIN" ? "APPROVED" : "PENDING");
}

export async function createAdminReservation(input: CreateAdminReservationInput) {
  const user = await admin();
  return insertReservation(input, input.targetUserId ?? null, input.departmentId, user, "APPROVED");
}

export async function updateReservationTime(input: UpdateReservationTimeInput) {
  const user = await admin();
  const startTime = new Date(input.startTime);
  const endTime = new Date(input.endTime);
  return prisma.$transaction(async (tx) => {
    // Match creation's lock order so a shift activation cannot race this validation.
    await lockSchedulingPolicy(tx);
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM reservations WHERE id = ${input.reservationId}::uuid FOR UPDATE`;
    if (!rows[0]) throw new ReservationError("NOT_FOUND", "Reservation not found.");
    const existing = await tx.reservation.findUniqueOrThrow({ where: { id: input.reservationId } });
    if (existing.updatedAt.getTime() !== Date.parse(input.expectedUpdatedAt)) {
      throw new ReservationError("STALE_UPDATE", "This reservation changed. Refresh it before editing its time.");
    }
    if (!blocking.includes(existing.status)) {
      throw new ReservationError("INVALID_STATUS_TRANSITION", "Only pending or approved reservations can be rescheduled.");
    }
    const shift = await activeShift(tx);
    if (shift && !bookingOperationalDate(startTime, endTime, shift)) {
      throw new ReservationError("OUTSIDE_SHIFT_HOURS", "The new interval must fit within the active office shift.");
    }
    const conflict = await tx.reservation.findFirst({ where: {
      id: { not: existing.id }, resourceId: existing.resourceId, ...overlap(startTime, endTime),
    }, select: { id: true } });
    if (conflict) throw new ReservationError("SLOT_CONFLICT", "The new interval overlaps another reservation for this resource.");
    // TIMESTAMPTZ(3) and Prisma @updatedAt have millisecond precision. Advance
    // at least one millisecond so even rapid sequential edits invalidate old views.
    const updatedAt = new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1));
    const updated = await tx.reservation.update({
      where: { id: existing.id }, data: { startTime, endTime, updatedAt }, select: reservationSelect,
    });
    const audit = await tx.reservationTimeChange.create({ data: {
      reservationId: existing.id, changedByUserId: user.id,
      previousStartTime: existing.startTime, previousEndTime: existing.endTime,
      newStartTime: startTime, newEndTime: endTime,
    } });
    return { reservation: updated, timeChange: audit };
  });
}

export async function listActiveUsers(input: z.output<typeof activeUserListSchema>) {
  await admin();
  const where: Prisma.UserWhereInput = {
    isActive: true,
    ...(input.departmentId ? { departmentId: input.departmentId } : {}),
    ...(input.search ? { OR: [{ name: { contains: input.search, mode: "insensitive" } }, { email: { contains: input.search, mode: "insensitive" } }] } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({ where, select: { id: true, name: true, email: true, role: true, departmentId: true }, orderBy: [{ name: "asc" }, { id: "asc" }], skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
    prisma.user.count({ where }),
  ]);
  return { items, total, page: input.page, pageSize: input.pageSize };
}

export async function listReservations(input: z.output<typeof reservationListSchema>, scope: "own" | "all") {
  const user = scope === "all" ? await admin() : await actor();
  if (scope === "own" && input.userId && input.userId !== user.id) throw new ReservationError("FORBIDDEN", "You may only view your own reservations.");
  const where: Prisma.ReservationWhereInput = {
    ...(scope === "own" ? { userId: user.id } : input.userId ? { userId: input.userId } : {}),
    ...(input.resourceId ? { resourceId: input.resourceId } : {}),
    ...(input.departmentId ? { departmentId: input.departmentId } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.from ? { endTime: { gt: new Date(input.from) } } : {}),
    ...(input.to ? { startTime: { lt: new Date(input.to) } } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.reservation.findMany({ where, select: reservationSelect, orderBy: [{ startTime: input.sort }, { id: input.sort }], skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
    prisma.reservation.count({ where }),
  ]);
  return { items, total, page: input.page, pageSize: input.pageSize };
}

export async function getReservation(id: string) {
  const user = await actor();
  const item = await prisma.reservation.findUnique({ where: { id }, select: reservationSelect });
  if (!item || (user.role !== "ADMIN" && item.userId !== user.id)) {
    throw new ReservationError("RESERVATION_NOT_FOUND", "Reservation not found.");
  }
  return item;
}

async function transition(id: string, status: "APPROVED" | "REJECTED" | "CANCELLED") {
  const user = status === "CANCELLED" ? await actor() : await admin();
  const where: Prisma.ReservationWhereInput = {
    id, status: status === "CANCELLED" ? { in: blocking } : "PENDING",
    ...(user.role === "ADMIN" ? {} : { userId: user.id }),
  };

  return prisma.$transaction(async (tx) => {
    const result = await tx.reservation.updateMany({ where, data: { status } });
    if (result.count === 0) {
      const existing = await tx.reservation.findUnique({ where: { id }, select: { status: true, userId: true } });
      if (!existing || (user.role !== "ADMIN" && existing.userId !== user.id)) {
        throw new ReservationError("RESERVATION_NOT_FOUND", "Reservation not found.");
      }
      throw new ReservationError("INVALID_STATUS_TRANSITION", `This request is now ${existing.status.toLowerCase()}. Refresh and review its current status.`);
    }

    const updated = await tx.reservation.findUniqueOrThrow({ where: { id }, select: reservationSelect });

    if (status === "APPROVED") {
      if (updated.userId && updated.userId !== user.id) {
        await createNotificationsTx(tx, [
          {
            recipientUserId: updated.userId,
            actorUserId: user.id,
            reservationId: updated.id,
            type: "RESERVATION_APPROVED",
            title: "Reservation Approved",
            message: `Your reservation for "${updated.title}" has been approved.`,
          },
        ]);
      }
    } else if (status === "REJECTED") {
      if (updated.userId && updated.userId !== user.id) {
        await createNotificationsTx(tx, [
          {
            recipientUserId: updated.userId,
            actorUserId: user.id,
            reservationId: updated.id,
            type: "RESERVATION_REJECTED",
            title: "Reservation Rejected",
            message: `Your reservation for "${updated.title}" was not approved.`,
          },
        ]);
      }
    } else if (status === "CANCELLED") {
      if (updated.userId && updated.userId !== user.id) {
        // Admin cancelled someone else's reservation
        await createNotificationsTx(tx, [
          {
            recipientUserId: updated.userId,
            actorUserId: user.id,
            reservationId: updated.id,
            type: "RESERVATION_CANCELLED",
            title: "Reservation Cancelled",
            message: `Your reservation for "${updated.title}" was cancelled by an administrator.`,
          },
        ]);
      } else if (updated.userId === user.id) {
        // Owner cancelled their own reservation -> notify active admins (excluding owner)
        const admins = await tx.user.findMany({
          where: { role: "ADMIN", isActive: true },
          select: { id: true },
        });
        const recipients = admins.filter((a) => a.id !== user.id);
        if (recipients.length > 0) {
          await createNotificationsTx(
            tx,
            recipients.map((a) => ({
              recipientUserId: a.id,
              actorUserId: user.id,
              reservationId: updated.id,
              type: "RESERVATION_CANCELLED",
              title: "Reservation Cancelled",
              message: `${user.name} cancelled their reservation for "${updated.title}".`,
            }))
          );
        }
      }
    }

    return updated;
  });
}

export const approveReservation = (id: string) => transition(id, "APPROVED");
export const rejectReservation = (id: string) => transition(id, "REJECTED");
export const cancelReservation = (id: string) => transition(id, "CANCELLED");

export async function pendingReservationCount() {
  await admin();
  return prisma.reservation.count({ where: { status: "PENDING" } });
}

export async function availability(input: AvailabilityInput) {
  await actor();
  const start = new Date(input.startTime);
  const end = new Date(input.endTime);
  if (input.resourceId) {
    const requested = await prisma.resource.findUnique({ where: { id: input.resourceId }, select: { isActive: true, categoryId: true } });
    if (!requested) throw new ReservationError("RESOURCE_NOT_FOUND", "Resource not found.");
    if (!requested.isActive) throw new ReservationError("RESOURCE_INACTIVE", "This resource is inactive.");
    if (input.categoryId && requested.categoryId !== input.categoryId) throw new ReservationError("INVALID_INPUT", "Resource does not belong to the selected category.");
  }
  const resources = await prisma.resource.findMany({
    where: { ...(input.categoryId ? { categoryId: input.categoryId } : {}), ...(input.resourceId ? { id: input.resourceId } : {}) },
    select: { id: true, name: true, categoryId: true, location: true, capacity: true, isActive: true },
    orderBy: { name: "asc" },
  });
  const activeResources = resources.filter((resource) => resource.isActive);
  const intervals = await prisma.reservation.findMany({
    where: { resourceId: { in: activeResources.map((resource) => resource.id) }, ...overlap(start, end) },
    select: { resourceId: true, startTime: true, endTime: true, status: true },
    orderBy: { startTime: "asc" },
  });
  const byResource = new Map<string, typeof intervals>();
  for (const interval of intervals) byResource.set(interval.resourceId, [...(byResource.get(interval.resourceId) ?? []), interval]);
  const snapshot = activeResources.map((resource) => ({ ...resource, intervals: byResource.get(resource.id) ?? [] }));
  return {
    available: snapshot.filter((resource) => resource.intervals.length === 0),
    blocked: snapshot.filter((resource) => resource.intervals.length > 0),
    inactive: resources.filter((resource) => !resource.isActive),
  };
}

export async function dailyAvailability(input: DailyInput) {
  const { start, end } = businessDayBounds(input.date);
  const result = await availability({ startTime: start.toISOString(), endTime: end.toISOString(), categoryId: input.categoryId, resourceId: input.resourceId });
  return { date: input.date, startTime: start, endTime: end, ...result };
}

export async function reservationsForDate(input: DailyInput) {
  const user = await actor();
  const { start, end } = businessDayBounds(input.date);
  const items = await prisma.reservation.findMany({
    where: { ...overlap(start, end), ...(input.resourceId ? { resourceId: input.resourceId } : {}), ...(input.categoryId ? { resource: { categoryId: input.categoryId } } : {}) },
    select: user.role === "ADMIN" ? { ...reservationSelect, user: { select: { name: true, email: true } } } : {
      id: true, resourceId: true, startTime: true, endTime: true, status: true,
    },
    orderBy: [{ startTime: "asc" }, { id: "asc" }],
  });
  // Members receive only occupancy data, without IDs or private booking details.
  return user.role === "ADMIN" ? items : items.map((item) => ({ resourceId: item.resourceId, startTime: item.startTime, endTime: item.endTime, status: item.status }));
}

export async function groupedReservationsForDate(input: DailyInput) {
  const user = await actor();
  const { start, end } = businessDayBounds(input.date);
  const items = await prisma.reservation.findMany({
    where: { ...overlap(start, end), ...(input.resourceId ? { resourceId: input.resourceId } : {}), ...(input.categoryId ? { resource: { categoryId: input.categoryId } } : {}) },
    select: { id: true, resourceId: true, departmentId: true, status: true, startTime: true, endTime: true, updatedAt: true, title: true, userId: true },
  });
  const groups = groupAdjacentReservations(items);
  if (user.role !== "ADMIN") return groups;
  const details = new Map(items.map(({ id, title, userId, startTime, endTime, updatedAt }) => [id, { id, title, userId, startTime, endTime, updatedAt }]));
  return groups.map((group) => ({ ...group, bookings: group.reservationIds.map((id) => details.get(id)!) }));
}
