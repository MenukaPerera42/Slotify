"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  activeUserListSchema, availabilitySchema, createAdminReservationSchema, createReservationSchema, dailySchema, idSchema, reservationListSchema,
} from "../schemas/reservation-schema";
import type { ReservationResult } from "../types";
import { ReservationError } from "../types";
import {
  approveReservation, availability, cancelReservation, createAdminReservation, createReservation, dailyAvailability,
  getReservation, groupedReservationsForDate, listActiveUsers, listReservations, pendingReservationCount, rejectReservation, reservationsForDate,
} from "../services/reservation-service";

function databaseCode(error: unknown): string | undefined {
  const seen = new Set<object>();
  function visit(value: unknown, depth: number): string | undefined {
    if (!value || typeof value !== "object" || depth > 5 || seen.has(value)) return undefined;
    seen.add(value);
    const record = value as Record<string, unknown>;
    if (record.code === "23P01" || record.sqlstate === "23P01") return "23P01";
    for (const key of ["meta", "cause", "originalError", "originalCode", "database_error", "message"]) {
      const child = record[key];
      if (typeof child === "string" && /23P01|reservations_no_overlap_blocking_excl/.test(child)) return "23P01";
      const found = visit(child, depth + 1);
      if (found) return found;
    }
    return undefined;
  }
  return visit(error, 0);
}

async function run<T>(operation: () => Promise<T>): Promise<ReservationResult<T>> {
  try { return { success: true, data: await operation() }; }
  catch (error) {
    if (error instanceof z.ZodError) return {
      success: false, code: "INVALID_INPUT", error: "Check the submitted fields.",
      fieldErrors: error.flatten().fieldErrors as Record<string, string[]>,
    };
    if (error instanceof ReservationError) return { success: false, code: error.code, error: error.message };
    if (databaseCode(error) === "23P01") return { success: false, code: "SLOT_CONFLICT", error: "This time slot is already requested or reserved. Refresh availability and choose another time." };
    console.error("Reservation operation failed:", error);
    return { success: false, code: "DATABASE_ERROR", error: "Unable to complete the reservation operation. Please try again." };
  }
}

function refresh() {
  revalidatePath("/reservations");
  revalidatePath("/resources");
  revalidatePath("/dashboard");
}

export async function createReservationAction(input: unknown) {
  return run(async () => {
    const item = await createReservation(createReservationSchema.parse(input));
    refresh();
    return item;
  });
}
export async function createAdminReservationAction(input: unknown) {
  return run(async () => {
    const item = await createAdminReservation(createAdminReservationSchema.parse(input));
    refresh();
    return item;
  });
}
export async function listActiveUsersAction(input: unknown = {}) {
  return run(() => listActiveUsers(activeUserListSchema.parse(input)));
}
export async function listOwnReservationsAction(input: unknown = {}) {
  return run(() => listReservations(reservationListSchema.parse(input), "own"));
}
export async function listAllReservationsAction(input: unknown = {}) {
  return run(() => listReservations(reservationListSchema.parse(input), "all"));
}
export async function listPendingReservationsAction(input: unknown = {}) {
  return run(() => listReservations({ ...reservationListSchema.parse(input), status: "PENDING" }, "all"));
}
export async function getReservationAction(id: unknown) {
  return run(() => getReservation(idSchema.parse(id)));
}
export async function cancelReservationAction(id: unknown) {
  return run(async () => { const item = await cancelReservation(idSchema.parse(id)); refresh(); return item; });
}
export async function approveReservationAction(id: unknown) {
  return run(async () => { const item = await approveReservation(idSchema.parse(id)); refresh(); return item; });
}
export async function rejectReservationAction(id: unknown) {
  return run(async () => { const item = await rejectReservation(idSchema.parse(id)); refresh(); return item; });
}
export async function pendingReservationCountAction() {
  return run(() => pendingReservationCount());
}
export async function findAvailableResourcesAction(input: unknown) {
  return run(() => availability(availabilitySchema.parse(input)));
}
export async function getDailyAvailabilityAction(input: unknown) {
  return run(() => dailyAvailability(dailySchema.parse(input)));
}
export async function getReservationsForDateAction(input: unknown) {
  return run(() => reservationsForDate(dailySchema.parse(input)));
}
export async function getGroupedReservationsForDateAction(input: unknown) {
  return run(() => groupedReservationsForDate(dailySchema.parse(input)));
}
