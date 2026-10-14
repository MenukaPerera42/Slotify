# Stage 7C.1 office scheduling contract

## Model and compatibility

`OfficeShift` stores `id`, unique `name`, `mode` (`MORNING`, `EVENING`, `NIGHT`, `FULL_DAY`, `CUSTOM`), optional `description`, `startMinute` (0–1439 after Asia/Colombo midnight), `durationMinutes` (1–1440), `isActive`, nullable `updatedByUserId`, and timestamps. `FULL_DAY` requires 1440 minutes. A PostgreSQL partial unique index permits at most one active row. The absence of an active row means the deterministic 09:00–18:00 **display fallback** is effective; `enforced: false` keeps pre-Stage-7C.1 bookings unrestricted until an admin explicitly activates a shift. No existing reservations were changed or backfilled.

Shifts recur daily. A selected **operational date** is the local Asia/Colombo date on which a shift starts. A 22:00–06:00 shift selected for December 31 includes January 1 morning. `endDayOffset` is derived from `startMinute + durationMinutes`; it is 1 when the end is on the next local date. Endpoints are half-open `[startTime, endTime)`. A 00:00 start with 1440-minute duration ends at 00:00 the next day, not zero minutes later. Consecutive full-day windows are continuous, so a booking of at most 24 hours may cross their midnight boundary. `crossesMidnight` means time continues after midnight; `endsNextDay` also includes shifts ending exactly at midnight.

Mode is a label, except that `FULL_DAY` requires 1440 minutes. No mode imposes preset clock times. The timeline resolution hint is 30 minutes; booking instants are not rounded by the backend.

## Server Actions

Import from `@/features/office-shifts/actions/office-shift-actions`. Each returns `{ success: true, data }` or `{ success: false, code, error, fieldErrors?, impact? }`. All actions require an active Auth.js user. Read/write configuration actions require ADMIN in both action and service. `getEffectiveSchedulingHoursAction` permits MEMBER and ADMIN.

| Action | Input | Result |
| --- | --- | --- |
| `getOfficeSchedulingConfigurationAction()` | none | `{ shifts, activeShiftId, fallback, enforced }` |
| `listOfficeShiftsAction()` | none | `OfficeShift[]` |
| `createOfficeShiftAction(input)` | `{ name, mode, description?, startMinute, durationMinutes }` | Inactive `OfficeShift` |
| `updateOfficeShiftAction(input)` | Definition plus `id` | Updated inactive `OfficeShift`; active definitions cannot be edited in place |
| `previewOfficeShiftActivationAction(shiftId)` | UUID | `ActivationImpact` |
| `activateOfficeShiftAction(input)` | `{ shiftId, confirmImpactToken? }` | `{ active, impact }` |
| `enableFullDaySchedulingAction(input)` | Same activation input; target must be `FULL_DAY` | `{ active, impact }` |
| `getEffectiveSchedulingHoursAction(input)` | `{ date: "YYYY-MM-DD", resourceId?, categoryId? }` | `EffectiveSchedule` |

`ActivationImpact` contains `shiftId`, `conflictCount`, up to 100 `conflicts` (`id`, `resourceId`, `departmentId`, `startTime`, `endTime`, `status`), `truncated`, `impactToken`, and an explanation. It includes future or in-progress PENDING/APPROVED reservations that do not fit any occurrence of the proposed recurring shift. First call preview; if conflicts exist, activation without confirmation returns `IMPACT_CONFIRMATION_REQUIRED` and `impact`. Show the warning and require an explicit admin confirmation. Then submit `confirmImpactToken: impact.impactToken`. If bookings or the definition changed, `STALE_IMPACT_PREVIEW` returns a fresh `impact`; show it and ask again. Activation serializes against booking inserts. Existing bookings retain ID, owner, department, status, and stored timestamps. They remain commitments even when outside the new window.

`EffectiveSchedule` contains `operationalDate`, `startTime`, `endTime`, `startMinute`, `endMinute`, `endDayOffset`, `durationMinutes`, `crossesMidnight`, `endsNextDay`, `timeZone: "Asia/Colombo"`, `timelineIntervalMinutes: 30`, `policy: { id, name, mode, description, isActive }`, `enforced`, `allowedBookingStart`, `allowedBookingEnd`, `occupancy`, and `outsideWindowOccupancy`. Times are UTC instants as `Date` through Server Actions or ISO strings through JSON. `occupancy` contains blocking reservations overlapping the operational interval; `outsideWindowOccupancy` exposes blocking bookings in the surrounding calendar/operational range that do not fit the effective shift. Entries indicate `outsideEffectiveWindow`. Members receive resource ID, times, status, and this flag; admins additionally receive booking ID, title, owner ID, and department ID. The UI must provide an accessible way to inspect outside-window commitments when changing visible timeline hours.

For a night shift, request its **start date** to get the next-morning continuation. A booking crossing midnight appears once in that operational window. Ordinary dashboard calendar summaries still count it on each local calendar date it overlaps; those daily counts are not unique-booking totals. Existing `getDailyAvailabilityAction` and `getGroupedReservationsForDateAction` retain calendar-day semantics for compatibility. Stage 7C.2 should use the new effective-hours action for operational timelines.

## Booking, errors, and refresh

`createReservationAction` and `createAdminReservationAction` use the database active policy, never a client policy ID. When active, the entire requested interval must fit one occurrence of the shift; otherwise they return `SHIFT_OUTSIDE_WINDOW`. Adjacent bookings remain allowed. Resource status, department checks, ADMIN/MEMBER permissions, PENDING/APPROVED rules, notifications, and the PostgreSQL GiST exclusion constraint remain in force. Existing bookings outside a newly activated shift stay visible in history and analytics; approved booked hours use stored UTC timestamps and are never recalculated from shift settings.

Shift action errors: `UNAUTHENTICATED`, `FORBIDDEN`, `INVALID_INPUT`, `SHIFT_NOT_FOUND`, `ACTIVE_SHIFT_IMMUTABLE`, `FULL_DAY_SHIFT_REQUIRED`, `SHIFT_NAME_CONFLICT`, `IMPACT_CONFIRMATION_REQUIRED`, `STALE_IMPACT_PREVIEW`, `DATABASE_ERROR`. Invalid fields may be in `fieldErrors`. Definition changes do not activate a shift. Create a new inactive definition to replace an active one, preview its impact, then activate it.

Mutations revalidate `/administration`, `/resources`, `/reservations`, and `/dashboard`. Client state holding a prior schedule or occupancy response must refetch it or call `router.refresh()`. Resource and reservation timelines, slot pickers, and booking dialogs currently contain 09:00–18:00 UI assumptions; Stage 7C.2 must replace those display ranges with `EffectiveSchedule` and keep outside-window commitments accessible. Dashboard charts do not need a scheduling calculation change.
