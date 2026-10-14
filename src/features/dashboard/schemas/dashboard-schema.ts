import { z } from "zod";
import { dateSchema } from "@/features/reservations/schemas/reservation-schema";

export const monthInputSchema = z.strictObject({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});

export const selectedDayInputSchema = z.strictObject({ selectedDate: dateSchema });

export type MonthInput = z.output<typeof monthInputSchema>;
export type SelectedDayInput = z.output<typeof selectedDayInputSchema>;
