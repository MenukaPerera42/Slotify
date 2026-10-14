import { z } from "zod";

export const MIN_PASSWORD_LENGTH = 6;
export const RECOMMENDED_PASSWORD_LENGTH = 8;

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
  .max(128, "Password is too long.");

