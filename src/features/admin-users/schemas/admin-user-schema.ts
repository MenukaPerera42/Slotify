import { z } from "zod";
import { emailSchema } from "@/features/auth/email-schema";
import { passwordSchema } from "@/features/auth/password-schema";

export const userIdSchema = z.string().uuid();
export const personNameSchema = z.string().trim().min(1).max(80);

export const createMemberSchema = z.strictObject({
  firstName: personNameSchema,
  lastName: personNameSchema,
  email: emailSchema,
  departmentId: userIdSchema,
  initialPassword: passwordSchema,
});

export const updateUserProfileSchema = z.strictObject({
  userId: userIdSchema,
  firstName: personNameSchema.optional(),
  lastName: personNameSchema.optional(),
  email: emailSchema.optional(),
}).refine(({ firstName, lastName, email }) => firstName !== undefined || lastName !== undefined || email !== undefined,
  "Provide a name or email change.");

export const listUsersSchema = z.strictObject({
  search: z.string().trim().max(100).optional(),
  role: z.enum(["ADMIN", "MEMBER"]).optional(),
  isActive: z.boolean().optional(),
  page: z.number().int().min(1).max(100000).default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
});

export const setUserRoleSchema = z.strictObject({ userId: userIdSchema, role: z.enum(["ADMIN", "MEMBER"]) });
export const setUserActiveSchema = z.strictObject({ userId: userIdSchema, isActive: z.boolean() });

export type CreateMemberInput = z.output<typeof createMemberSchema>;
export type UpdateUserProfileInput = z.output<typeof updateUserProfileSchema>;
export type ListUsersInput = z.output<typeof listUsersSchema>;
