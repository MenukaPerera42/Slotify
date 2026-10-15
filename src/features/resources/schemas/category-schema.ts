import { z } from "zod";

export const categoryIdSchema = z.string().uuid();
const name = z.string().trim().min(2).max(100);
const description = z.string().trim().max(500).nullable().optional();
export const createCategorySchema = z.strictObject({ name, description, isActive: z.boolean().default(true) });
export const updateCategorySchema = z.strictObject({ name: name.optional(), description }).refine(
  (value) => Object.keys(value).length > 0, "Provide at least one field",
);
export const setCategoryStatusSchema = z.strictObject({ id: categoryIdSchema, isActive: z.boolean() });
export const categoryListSchema = z.strictObject({
  search: z.string().trim().max(100).optional(),
  status: z.enum(["ALL", "ACTIVE", "INACTIVE"]).default("ALL"),
  page: z.number().int().min(1).max(100000).default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
});
