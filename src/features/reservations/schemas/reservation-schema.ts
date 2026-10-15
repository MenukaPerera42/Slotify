import { z } from "zod";

export const uuid = z.string().uuid();
const instant = z.string().datetime({ offset: true }).refine((value) => !Number.isNaN(Date.parse(value)), "Invalid timestamp");
export const intervalSchema = z.strictObject({ startTime: instant, endTime: instant }).refine(
  ({ startTime, endTime }) => Date.parse(startTime) < Date.parse(endTime),
  { path: ["endTime"], message: "End time must be after start time" },
);
export const createReservationSchema = z.strictObject({
  resourceId: uuid,
  title: z.string().trim().min(1).max(120),
  startTime: instant,
  endTime: instant,
}).refine(({ startTime, endTime }) => Date.parse(startTime) < Date.parse(endTime), {
  path: ["endTime"], message: "End time must be after start time",
});
export const createAdminReservationSchema = z.strictObject({
  departmentId: uuid,
  targetUserId: uuid.optional(),
  resourceId: uuid,
  title: z.string().trim().min(1).max(120),
  startTime: instant,
  endTime: instant,
}).refine(({ startTime, endTime }) => Date.parse(startTime) < Date.parse(endTime), {
  path: ["endTime"], message: "End time must be after start time",
});
export const updateReservationTimeSchema = z.strictObject({
  reservationId: uuid,
  startTime: instant,
  endTime: instant,
  expectedUpdatedAt: instant,
}).refine(({ startTime, endTime }) => Date.parse(startTime) < Date.parse(endTime), {
  path: ["endTime"], message: "End time must be after start time",
});
export const activeUserListSchema = z.strictObject({
  search: z.string().trim().max(100).optional(),
  departmentId: uuid.optional(),
  page: z.number().int().min(1).max(100000).default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
});
export const idSchema = uuid;
export const dateSchema = z.iso.date().refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}, "Invalid calendar date");
export const reservationListSchema = z.strictObject({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]).optional(),
  resourceId: uuid.optional(),
  userId: uuid.optional(),
  departmentId: uuid.optional(),
  from: instant.optional(),
  to: instant.optional(),
  page: z.number().int().min(1).max(100000).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  sort: z.enum(["asc", "desc"]).default("desc"),
}).refine(({ from, to }) => !from || !to || Date.parse(from) < Date.parse(to), {
  path: ["to"], message: "End of filter must be after start",
});
export const availabilitySchema = z.strictObject({
  startTime: instant,
  endTime: instant,
  categoryId: uuid.optional(),
  resourceId: uuid.optional(),
}).refine(({ startTime, endTime }) => Date.parse(startTime) < Date.parse(endTime), {
  path: ["endTime"], message: "End time must be after start time",
});
export const dailySchema = z.strictObject({ date: dateSchema, categoryId: uuid.optional(), resourceId: uuid.optional() });

export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export type CreateAdminReservationInput = z.infer<typeof createAdminReservationSchema>;
export type UpdateReservationTimeInput = z.infer<typeof updateReservationTimeSchema>;
export type ReservationListInput = z.input<typeof reservationListSchema>;
export type AvailabilityInput = z.infer<typeof availabilitySchema>;
export type DailyInput = z.infer<typeof dailySchema>;
