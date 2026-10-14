import "server-only";
import { currentUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { ReservationError } from "../types";
import type { CorrectReservationDepartmentInput, UnassignedReservationsInput } from "../schemas/reservation-department-correction-schema";

async function admin() {
  const user = await currentUser();
  if (!user) throw new ReservationError("UNAUTHENTICATED", "Sign in with an active account to continue.");
  if (user.role !== "ADMIN") throw new ReservationError("FORBIDDEN", "Administrator access is required.");
  return user;
}

export async function listUnassignedReservations(input: UnassignedReservationsInput) {
  await admin();
  const where = { departmentId: null };
  const [items, total] = await prisma.$transaction([
    prisma.reservation.findMany({ where, select: {
      id: true, title: true, status: true, startTime: true, endTime: true, createdAt: true,
      resourceId: true, resource: { select: { name: true } }, userId: true,
      user: { select: { name: true, email: true } }, createdByUserId: true,
    }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
    prisma.reservation.count({ where }),
  ]);
  return { items, total, page: input.page, pageSize: input.pageSize };
}

export async function listReservationDepartmentCorrections(reservationId: string) {
  await admin();
  const exists = await prisma.reservation.findUnique({ where: { id: reservationId }, select: { id: true } });
  if (!exists) throw new ReservationError("RESERVATION_NOT_FOUND", "Reservation not found.");
  return prisma.reservationDepartmentCorrection.findMany({ where: { reservationId },
    select: { id: true, reservationId: true, previousDepartmentId: true, newDepartmentId: true,
      correctedByUserId: true, correctedBy: { select: { name: true } }, reason: true, createdAt: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
}

export async function correctReservationDepartment(input: CorrectReservationDepartmentInput) {
  const user = await admin();
  return prisma.$transaction(async (tx) => {
    const reservations = await tx.$queryRaw<Array<{ id: string; departmentId: string | null }>>`
      SELECT id, "departmentId" FROM reservations WHERE id = ${input.reservationId}::uuid FOR UPDATE`;
    const reservation = reservations[0];
    if (!reservation) throw new ReservationError("RESERVATION_NOT_FOUND", "Reservation not found.");
    if (reservation.departmentId !== input.expectedDepartmentId) {
      throw new ReservationError("STALE_DEPARTMENT", "This reservation's department changed. Refresh it before correcting.");
    }
    if (reservation.departmentId === input.departmentId) {
      throw new ReservationError("DEPARTMENT_UNCHANGED", "Select a different department.");
    }
    const departments = await tx.$queryRaw<Array<{ id: string; isActive: boolean }>>`
      SELECT id, "isActive" FROM departments WHERE id = ${input.departmentId}::uuid FOR SHARE`;
    if (!departments[0]) throw new ReservationError("DEPARTMENT_NOT_FOUND", "Department not found.");
    if (!departments[0].isActive) throw new ReservationError("DEPARTMENT_INACTIVE", "Department is inactive.");

    // A raw metadata-only update preserves the booking's original updatedAt.
    await tx.$executeRaw`UPDATE reservations SET "departmentId" = ${input.departmentId}::uuid WHERE id = ${input.reservationId}::uuid`;
    const audit = await tx.reservationDepartmentCorrection.create({ data: {
      reservationId: input.reservationId, previousDepartmentId: reservation.departmentId,
      newDepartmentId: input.departmentId, correctedByUserId: user.id, reason: input.reason,
    }, select: { id: true, reservationId: true, previousDepartmentId: true, newDepartmentId: true,
      correctedByUserId: true, reason: true, createdAt: true } });
    const updated = await tx.reservation.findUniqueOrThrow({ where: { id: input.reservationId }, select: {
      id: true, departmentId: true, userId: true, createdByUserId: true, status: true,
      startTime: true, endTime: true, createdAt: true, updatedAt: true,
      department: { select: { name: true, code: true } },
    } });
    return { reservation: updated, correction: audit };
  });
}
