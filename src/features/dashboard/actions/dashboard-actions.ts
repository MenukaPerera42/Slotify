"use server";

import { z } from "zod";
import { monthInputSchema, selectedDayInputSchema } from "../schemas/dashboard-schema";
import { DashboardError, type DashboardResult } from "../types";
import {
  departmentUsage, monthlyCalendarSummary, monthlyUsage, reservationSummary,
  selectedDayDashboardSummary, selectedDaySchedule,
} from "../services/dashboard-analytics-service";

async function run<T>(operation: () => Promise<T>): Promise<DashboardResult<T>> {
  try { return { success: true, data: await operation() }; }
  catch (error) {
    if (error instanceof z.ZodError) return { success: false, code: "INVALID_INPUT", error: "Check the submitted fields.",
      fieldErrors: error.flatten().fieldErrors as Record<string, string[]> };
    if (error instanceof DashboardError) return { success: false, code: error.code, error: error.message };
    console.error("Dashboard analytics operation failed:", error);
    return { success: false, code: "DATABASE_ERROR", error: "Unable to load dashboard analytics." };
  }
}

export async function getReservationSummaryAction() {
  return run(() => reservationSummary());
}
export async function getMonthlyCalendarSummaryAction(input: unknown) {
  return run(() => monthlyCalendarSummary(monthInputSchema.parse(input)));
}
export async function getSelectedDayDashboardSummaryAction(input: unknown) {
  return run(() => selectedDayDashboardSummary(selectedDayInputSchema.parse(input)));
}
export async function getSelectedDayScheduleAction(input: unknown) {
  return run(() => selectedDaySchedule(selectedDayInputSchema.parse(input)));
}
export async function getMonthlyUsageAction(input: unknown) {
  return run(() => monthlyUsage(monthInputSchema.parse(input)));
}
export async function getDepartmentUsageAction(input: unknown) {
  return run(() => departmentUsage(monthInputSchema.parse(input)));
}
