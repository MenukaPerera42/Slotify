import { z } from "zod";
import { uuid } from "./reservation-schema";

export const correctReservationDepartmentSchema = z.strictObject({
  reservationId: uuid,
  // Older timeline clients omit this field for unassigned legacy bookings.
  // Treat omission as an expected NULL only; the service still rejects a
  // concurrently assigned reservation with STALE_DEPARTMENT.
  expectedDepartmentId: uuid.nullable().optional().default(null),
  departmentId: uuid,
  reason: z.string().trim().min(10, "Enter a correction reason of at least 10 characters.")
    .max(500, "Keep the correction reason within 500 characters."),
});

export const unassignedReservationsSchema = z.strictObject({
  page: z.number().int().min(1).max(100000).default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
});

export type CorrectReservationDepartmentInput = z.output<typeof correctReservationDepartmentSchema>;
export type UnassignedReservationsInput = z.output<typeof unassignedReservationsSchema>;
