import { z } from "zod";
import { uuid } from "./reservation-schema";

export const correctReservationDepartmentSchema = z.strictObject({
  reservationId: uuid,
  expectedDepartmentId: uuid.nullable(),
  departmentId: uuid,
  reason: z.string().trim().min(10).max(500),
});

export const unassignedReservationsSchema = z.strictObject({
  page: z.number().int().min(1).max(100000).default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
});

export type CorrectReservationDepartmentInput = z.output<typeof correctReservationDepartmentSchema>;
export type UnassignedReservationsInput = z.output<typeof unassignedReservationsSchema>;
