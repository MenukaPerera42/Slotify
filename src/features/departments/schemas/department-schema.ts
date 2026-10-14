import { z } from "zod";

export const departmentIdSchema = z.string().uuid();
const code = z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9]{1,11}$/, "Use 2–12 uppercase letters or digits");
const name = z.string().trim().min(2).max(100);
const description = z.string().trim().max(500).nullable().optional();

export const createDepartmentSchema = z.strictObject({
  name, code, description, isActive: z.boolean().default(true),
});
export const updateDepartmentSchema = z.strictObject({ name: name.optional(), code: code.optional(), description }).refine(
  (value) => Object.keys(value).length > 0, "Provide at least one field",
);
export const departmentListSchema = z.strictObject({
  search: z.string().trim().max(100).optional(),
  status: z.enum(["ALL", "ACTIVE", "INACTIVE"]).default("ALL"),
  page: z.number().int().min(1).max(100000).default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
});
export const setDepartmentStatusSchema = z.strictObject({ id: departmentIdSchema, isActive: z.boolean() });
export const assignUserDepartmentSchema = z.strictObject({ userId: departmentIdSchema, departmentId: departmentIdSchema });
export const usersByDepartmentSchema = z.strictObject({
  departmentId: departmentIdSchema,
  page: z.number().int().min(1).max(100000).default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
});

export type CreateDepartmentInput = z.output<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.output<typeof updateDepartmentSchema>;
