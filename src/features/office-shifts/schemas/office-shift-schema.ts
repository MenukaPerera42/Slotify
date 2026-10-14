import { z } from "zod";
import { dateSchema, uuid } from "@/features/reservations/schemas/reservation-schema";

const definition = {
  name: z.string().trim().min(2).max(100),
  mode: z.enum(["MORNING", "EVENING", "NIGHT", "FULL_DAY", "CUSTOM"]),
  description: z.string().trim().max(500).nullable().optional(),
  startMinute: z.number().int().min(0).max(1439),
  durationMinutes: z.number().int().min(1).max(1440),
};
function validMode(value: { mode: string; durationMinutes: number }) {
  return value.mode !== "FULL_DAY" || value.durationMinutes === 1440;
}
export const createOfficeShiftSchema = z.strictObject(definition).refine(validMode, {
  path: ["durationMinutes"], message: "A full-day shift must last 1440 minutes.",
});
export const updateOfficeShiftSchema = z.strictObject({ id: uuid, ...definition }).refine(validMode, {
  path: ["durationMinutes"], message: "A full-day shift must last 1440 minutes.",
});
export const officeShiftIdSchema = uuid;
export const activateOfficeShiftSchema = z.strictObject({
  shiftId: uuid, confirmImpactToken: z.string().regex(/^[a-f0-9]{64}$/).optional(),
});
export const effectiveSchedulingHoursSchema = z.strictObject({
  date: dateSchema, resourceId: uuid.optional(), categoryId: uuid.optional(),
});

export type OfficeShiftDefinitionInput = z.output<typeof createOfficeShiftSchema>;
export type UpdateOfficeShiftInput = z.output<typeof updateOfficeShiftSchema>;
export type ActivateOfficeShiftInput = z.output<typeof activateOfficeShiftSchema>;
export type EffectiveSchedulingHoursInput = z.output<typeof effectiveSchedulingHoursSchema>;
