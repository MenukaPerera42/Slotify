import type { ShiftMode } from "../components/admin-office-shifts";

export interface EffectivePolicy {
  id: string | null;
  name: string;
  mode: ShiftMode;
  description: string | null;
  isActive: boolean;
}

export interface EffectiveScheduleOccupancy {
  id?: string;
  resourceId: string;
  departmentId?: string | null;
  startTime: Date | string;
  endTime: Date | string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  title?: string;
  userId?: string | null;
  outsideEffectiveWindow?: boolean;
}

export interface EffectiveSchedule {
  operationalDate: string;
  startTime: Date | string;
  endTime: Date | string;
  startMinute: number;
  endMinute: number;
  endDayOffset: number;
  durationMinutes: number;
  crossesMidnight: boolean;
  endsNextDay: boolean;
  timeZone: string;
  timelineIntervalMinutes: number;
  policy: EffectivePolicy;
  enforced: boolean;
  allowedBookingStart: Date | string;
  allowedBookingEnd: Date | string;
  occupancy: EffectiveScheduleOccupancy[];
  outsideWindowOccupancy: EffectiveScheduleOccupancy[];
}

