import "server-only";
import { createHash } from "node:crypto";
import { Prisma, type OfficeShift } from "@prisma/client";
import { currentUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { businessDayBounds } from "@/features/reservations/utils/business-date";
import type {
  ActivateOfficeShiftInput, EffectiveSchedulingHoursInput, OfficeShiftDefinitionInput, UpdateOfficeShiftInput,
} from "../schemas/office-shift-schema";
import { OfficeShiftError } from "../types";
import { bookingOperationalDate, DEFAULT_OFFICE_WINDOW, officeWindow } from "../utils/office-window";

type Db = Prisma.TransactionClient;
type Shift = Pick<OfficeShift, "id" | "name" | "mode" | "description" | "startMinute" | "durationMinutes" | "isActive">;

export async function lockSchedulingPolicy(tx: Db) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(618312, 7)::text`;
}

async function actor() {
  const user = await currentUser();
  if (!user) throw new OfficeShiftError("UNAUTHENTICATED", "Sign in with an active account to continue.");
  return user;
}
async function admin() {
  const user = await actor();
  if (user.role !== "ADMIN") throw new OfficeShiftError("FORBIDDEN", "Administrator access is required.");
  return user;
}

export async function activeShift(db: Db | typeof prisma = prisma) {
  return db.officeShift.findFirst({ where: { isActive: true } });
}

export async function getOfficeSchedulingConfiguration() {
  await admin();
  const [shifts, effective] = await Promise.all([
    prisma.officeShift.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] }),
    activeShift(),
  ]);
  return { shifts, activeShiftId: effective?.id ?? null, fallback: DEFAULT_OFFICE_WINDOW,
    enforced: Boolean(effective) };
}

export async function listOfficeShifts() {
  await admin();
  return prisma.officeShift.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] });
}

export async function createOfficeShift(input: OfficeShiftDefinitionInput) {
  const user = await admin();
  return prisma.officeShift.create({ data: { ...input, updatedByUserId: user.id } });
}

export async function updateOfficeShift(input: UpdateOfficeShiftInput) {
  const user = await admin();
  return prisma.$transaction(async (tx) => {
    await lockSchedulingPolicy(tx);
    const rows = await tx.$queryRaw<Array<{ id: string; isActive: boolean }>>`
      SELECT id, "isActive" FROM office_shifts WHERE id = ${input.id}::uuid FOR UPDATE`;
    if (!rows[0]) throw new OfficeShiftError("SHIFT_NOT_FOUND", "Shift not found.");
    if (rows[0].isActive) throw new OfficeShiftError("ACTIVE_SHIFT_IMMUTABLE", "Create or edit an inactive shift, then preview and activate it.");
    const { id, ...values } = input;
    return tx.officeShift.update({ where: { id }, data: { ...values, updatedByUserId: user.id } });
  });
}

type ImpactReservation = {
  id: string; resourceId: string; departmentId: string | null;
  startTime: Date; endTime: Date; status: "PENDING" | "APPROVED";
};
async function activationImpact(tx: Db, shift: Shift) {
  const bookings = await tx.reservation.findMany({
    where: { status: { in: ["PENDING", "APPROVED"] }, endTime: { gt: new Date() } },
    select: { id: true, resourceId: true, departmentId: true, startTime: true, endTime: true, status: true },
    orderBy: [{ startTime: "asc" }, { id: "asc" }],
  }) as ImpactReservation[];
  const conflicts = bookings.filter((booking) =>
    !bookingOperationalDate(booking.startTime, booking.endTime, shift));
  const token = createHash("sha256").update(JSON.stringify({
    shift: [shift.id, shift.mode, shift.startMinute, shift.durationMinutes],
    conflicts: conflicts.map(({ id, startTime, endTime, status }) => [id, startTime.toISOString(), endTime.toISOString(), status]),
  })).digest("hex");
  return { shiftId: shift.id, conflictCount: conflicts.length, conflicts: conflicts.slice(0, 100),
    truncated: conflicts.length > 100, impactToken: token,
    explanation: "Existing bookings remain unchanged and visible after activation." };
}

export async function previewOfficeShiftActivation(shiftId: string) {
  await admin();
  const shift = await prisma.officeShift.findUnique({ where: { id: shiftId } });
  if (!shift) throw new OfficeShiftError("SHIFT_NOT_FOUND", "Shift not found.");
  return activationImpact(prisma as Db, shift);
}

export async function activateOfficeShift(input: ActivateOfficeShiftInput, fullDayOnly = false) {
  const user = await admin();
  return prisma.$transaction(async (tx) => {
    await lockSchedulingPolicy(tx);
    const shift = await tx.officeShift.findUnique({ where: { id: input.shiftId } });
    if (!shift) throw new OfficeShiftError("SHIFT_NOT_FOUND", "Shift not found.");
    if (fullDayOnly && shift.mode !== "FULL_DAY") throw new OfficeShiftError("FULL_DAY_SHIFT_REQUIRED", "Select a full-day shift.");
    const impact = await activationImpact(tx, shift);
    if (input.confirmImpactToken && input.confirmImpactToken !== impact.impactToken) {
      throw new OfficeShiftError("STALE_IMPACT_PREVIEW", "Bookings or shift settings changed. Preview activation again.", impact);
    }
    if (impact.conflictCount > 0 && !input.confirmImpactToken) {
      throw new OfficeShiftError("IMPACT_CONFIRMATION_REQUIRED", "Review future bookings outside this shift and confirm activation.", impact);
    }
    await tx.officeShift.updateMany({ where: { isActive: true }, data: { isActive: false, updatedByUserId: user.id } });
    const active = await tx.officeShift.update({ where: { id: shift.id },
      data: { isActive: true, updatedByUserId: user.id } });
    return { active, impact };
  });
}

export async function getEffectiveSchedulingHours(input: EffectiveSchedulingHoursInput) {
  const user = await actor();
  const shift = await activeShift();
  const policy = shift ?? DEFAULT_OFFICE_WINDOW;
  const window = officeWindow(input.date, policy);
  const calendar = businessDayBounds(input.date);
  const queryStart = new Date(Math.min(calendar.start.getTime(), window.startTime.getTime()));
  const queryEnd = new Date(Math.max(calendar.end.getTime(), window.endTime.getTime()));
  const resources = await prisma.resource.findMany({ where: {
    ...(input.resourceId ? { id: input.resourceId } : {}),
    ...(input.categoryId ? { categoryId: input.categoryId } : {}),
  }, select: { id: true } });
  const resourceIds = resources.map(({ id }) => id);
  const rows = await prisma.reservation.findMany({
    where: { resourceId: { in: resourceIds }, status: { in: ["PENDING", "APPROVED"] },
      startTime: { lt: queryEnd }, endTime: { gt: queryStart } },
    select: { id: true, resourceId: true, departmentId: true, startTime: true, endTime: true,
      status: true, title: true, userId: true },
    orderBy: [{ startTime: "asc" }, { id: "asc" }],
  });
  const serialize = (row: typeof rows[number]) => ({
    resourceId: row.resourceId, startTime: row.startTime, endTime: row.endTime, status: row.status,
    outsideEffectiveWindow: !bookingOperationalDate(row.startTime, row.endTime, policy),
    ...(user.role === "ADMIN" ? { id: row.id, title: row.title, userId: row.userId, departmentId: row.departmentId } : {}),
  });
  const occupancy = rows.filter((row) => row.startTime < window.endTime && row.endTime > window.startTime).map(serialize);
  const outsideWindowOccupancy = rows.filter((row) => !bookingOperationalDate(row.startTime, row.endTime, policy)).map(serialize);
  return { ...window, policy: { id: policy.id, name: policy.name, mode: policy.mode,
      description: policy.description, isActive: policy.isActive },
    enforced: Boolean(shift), allowedBookingStart: window.startTime, allowedBookingEnd: window.endTime,
    occupancy, outsideWindowOccupancy };
}
