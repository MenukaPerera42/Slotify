import "server-only";
import { Prisma, type ReservationStatus } from "@prisma/client";
import { z } from "zod";
import { currentUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { businessDayBounds } from "../utils/business-date";
import { ReservationError } from "../types";
import { activeUserListSchema, reservationListSchema, type AvailabilityInput, type CreateAdminReservationInput, type CreateReservationInput, type DailyInput } from "../schemas/reservation-schema";

const blocking: ReservationStatus[] = ["PENDING", "APPROVED"];
const reservationSelect = {
  id: true, resourceId: true, userId: true, createdByUserId: true, title: true, startTime: true,
  endTime: true, status: true, createdAt: true, updatedAt: true,
  resource: { select: { name: true, categoryId: true } },
  user: { select: { name: true, email: true } },
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

async function insertReservation(input: CreateReservationInput, ownerId: string, creatorId: string, status: "PENDING" | "APPROVED", verifyTarget: boolean) {
  const startTime = new Date(input.startTime);
  const endTime = new Date(input.endTime);
  if (endTime <= new Date()) throw new ReservationError("INVALID_INPUT", "The reservation must not be entirely in the past.");
  return prisma.$transaction(async (tx) => {
    // Lock the resource row against a simultaneous deactivate operation.
    const rows = await tx.$queryRaw<Array<{ id: string; isActive: boolean }>>`
      SELECT id, "isActive" FROM resources WHERE id = ${input.resourceId}::uuid FOR SHARE`;
    const resource = rows[0];
    if (!resource) throw new ReservationError("RESOURCE_NOT_FOUND", "Resource not found.");
    if (!resource.isActive) throw new ReservationError("RESOURCE_INACTIVE", "This resource is inactive.");
    if (verifyTarget) {
      const users = await tx.$queryRaw<Array<{ id: string; isActive: boolean }>>`
        SELECT id, "isActive" FROM users WHERE id = ${ownerId}::uuid FOR SHARE`;
      if (!users[0]?.isActive) throw new ReservationError("USER_NOT_FOUND", "Active target user not found.");
    }
    // The GiST exclusion constraint is the final overlap authority.
    return tx.reservation.create({
      data: { resourceId: input.resourceId, userId: ownerId, createdByUserId: creatorId, title: input.title, startTime, endTime, status },
      select: reservationSelect,
    });
  });
}

export async function createReservation(input: CreateReservationInput) {
  const user = await actor();
  return insertReservation(input, user.id, user.id, "PENDING", false);
}

export async function createAdminReservation(input: CreateAdminReservationInput) {
  const user = await admin();
  return insertReservation(input, input.targetUserId, user.id, "APPROVED", true);
}

export async function listActiveUsers(input: z.output<typeof activeUserListSchema>) {
  await admin();
  const where: Prisma.UserWhereInput = {
    isActive: true,
    ...(input.search ? { OR: [{ name: { contains: input.search, mode: "insensitive" } }, { email: { contains: input.search, mode: "insensitive" } }] } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({ where, select: { id: true, name: true, email: true, role: true }, orderBy: [{ name: "asc" }, { id: "asc" }], skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
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
  const result = await prisma.reservation.updateMany({ where, data: { status } });
  if (result.count === 1) return prisma.reservation.findUniqueOrThrow({ where: { id }, select: reservationSelect });
  const existing = await prisma.reservation.findUnique({ where: { id }, select: { status: true, userId: true } });
  if (!existing || (user.role !== "ADMIN" && existing.userId !== user.id)) {
    throw new ReservationError("RESERVATION_NOT_FOUND", "Reservation not found.");
  }
  throw new ReservationError("INVALID_STATUS_TRANSITION", `This request is now ${existing.status.toLowerCase()}. Refresh and review its current status.`);
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
