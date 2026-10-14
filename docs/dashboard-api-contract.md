# Stage 6C dashboard analytics backend contract

Import Server Actions from `@/features/dashboard/actions/dashboard-actions`. Every action returns `{ success: true, data }` or `{ success: false, code, error, fieldErrors? }`. All actions require an active Auth.js user and resolve role and user ID from PostgreSQL. A MEMBER receives personal reservation data; an ADMIN receives organization-wide data. Inputs do not accept role or user ID. Dates are `YYYY-MM-DD` in **Asia/Colombo**; timestamps in results are `Date` values through Server Actions (ISO UTC strings through JSON).

| Action | Input | MEMBER scope | ADMIN scope |
| --- | --- | --- | --- |
| `getReservationSummaryAction()` | None | All-time bookings owned by the user | All-time organization bookings |
| `getMonthlyCalendarSummaryAction({ year, month })` | Integers: year 2000–2100, month 1–12 | Personal overlapping reservations per day | All organization overlapping reservations per day |
| `getSelectedDayDashboardSummaryAction({ selectedDate })` | Strict Colombo date | Personal day counts | Organization day counts |
| `getSelectedDayScheduleAction({ selectedDate })` | Strict Colombo date | Own scheduled booking details | All scheduled booking details |
| `getMonthlyUsageAction({ year, month })` | Same month input | Personal approved booked hours | Organization approved booked hours |
| `getDepartmentUsageAction({ year, month })` | Same month input | `FORBIDDEN` | Approved booked hours by reservation department |

## All-time reservation cards

`getReservationSummaryAction()` returns `{ scope: "PERSONAL" | "ORGANIZATION", totalBookings, pendingReview, approvedBookings, rejectedBookings, cancelledBookings, activeResources }`. `totalBookings` includes **all four statuses**. Personal ownership is `Reservation.userId`, never `createdByUserId`; a department-only booking (`userId: null`) appears only in organization totals. `activeResources` counts resources with `isActive: true` for either role. Counts come from PostgreSQL `groupBy` and `count`, return zero for empty groups, and have **no date argument**. The Reservations page uses these values for its existing four cards. Its booking table and approval queue are still loaded with a 100-row limit, so their visible rows may be fewer than an all-time count.

## Selected day and monthly calendar

`getMonthlyCalendarSummaryAction` returns `{ year, month, scope, timeZone: "Asia/Colombo", startTime, endTime, days }`. Each `days[]` item is `{ date, pending, approved, rejected, cancelled, scheduled, hasActivity }`, with `scheduled = pending + approved`. A reservation contributes to every Colombo day its stored interval overlaps, using half-open `[startTime, endTime)` boundaries. Cancelled and rejected reservations are reported as history on their former scheduled dates; they do not count as scheduled or booked hours. `hasActivity` is true when any of the four counts is nonzero. Monthly counts are per-day occupancy indicators and must not be summed to infer unique monthly reservations, because a midnight-spanning reservation appears on both days.

`getSelectedDayDashboardSummaryAction` returns `{ selectedDate, scope, scheduledReservations, pendingRequests, approvedBookings, activeResources, bookedResources }`. `scheduledReservations` counts pending and approved intervals overlapping the day; `bookedResources` is the number of distinct resource IDs among those intervals. The active resource count remains an operational count, independent of the selected day. Rejected and cancelled history is excluded from scheduled counts.

`getSelectedDayScheduleAction` returns `{ selectedDate, scope, items }`, sorted by `startTime`, then ID. It includes only `PENDING` and `APPROVED` rows overlapping the day. Every item includes its reservation `id`, `title`, `status`, `startTime`, `endTime`, `resourceId`, resource `{ name, location, category: { name } }`, `departmentId`, department `{ name, code } | null`, and `userId`. Legacy department IDs can be null; department-only owner IDs can be null. ADMIN items additionally include `user: { name, email } | null` and `createdByUserId`. MEMBER items are restricted in the database to `userId === currentUser.id` and omit those additional fields. For public occupancy of other users' resources, use the existing privacy-safe availability action; this schedule is a personal or admin detail feed.

## Usage data

`getMonthlyUsageAction` returns `{ year, month, scope, timeZone, metric: "APPROVED_BOOKED_HOURS", startTime, endTime, totalBookedHours, days: [{ date, bookedHours }] }`. It sums only approved reservation duration **clipped to each Colombo day and to the requested month**. An interval crossing midnight or a month boundary contributes only its intersecting hours to each bucket. The existing PostgreSQL exclusion constraint prevents overlapping approved intervals on one resource; hours across different resources are additive. Historical bookings on resources now inactive are included. There is no utilization percentage because resource operating hours and a defensible denominator are not modeled.

`getDepartmentUsageAction` returns `{ year, month, timeZone, metric, startTime, endTime, departments: [{ departmentId, name, code, reservationCount, bookedHours }] }`, sorted by booked hours descending. It uses each reservation's stored `departmentId`, not the owner's current department. A null ID is shown as `name: "Unassigned/Legacy", code: null`; no historical department is inferred. `reservationCount` is the count of approved rows overlapping the month; `bookedHours` is their clipped duration. Zero-use departments are omitted.

## Refresh and integration

Reservation create, approve, reject, and cancel actions revalidate `/reservations`, `/resources`, and `/dashboard`. The analytics actions query PostgreSQL on every call. After any mutation, Stage 6D should call the relevant analytics actions again or `router.refresh()`; do the same on month or selected-date changes. Keep all-time cards on `getReservationSummaryAction()` and use the selected-day action only for day-specific widgets. Department reassignment does not rewrite historical reservation departments. Validation failures return `INVALID_INPUT` with `fieldErrors`; missing auth returns `UNAUTHENTICATED`; member department usage returns `FORBIDDEN`; unexpected database failures return sanitized `DATABASE_ERROR`.

The backend returns data contracts only. Stage 6D can render a calendar, schedule, chart, and department breakdown from these results without fabricated figures or a second analytics API.
