# Stage 5A reservation backend contract

Import Server Actions from `@/features/reservations/actions/reservation-actions`. Every action returns `Promise<ReservationResult<T>>`: `{ success: true, data }` or `{ success: false, code, error, fieldErrors? }`. Dates returned from the server are JavaScript `Date` values in React Server Actions; serialize them to ISO strings when using another transport. Inputs use ISO 8601 timestamps **with `Z` or a numeric offset**, for example `2026-10-15T09:00:00+05:30`. The server stores instants in PostgreSQL `timestamptz`.

All actions require an active Auth.js session. Authorization state is reloaded from PostgreSQL for each operation. Client supplied `userId`, `role`, and `status` are never accepted for creation.

| Action | Input | Access | Success `data` |
| --- | --- | --- | --- |
| `createReservationAction` | `{ resourceId: UUID, title: string (1–120 trimmed chars), startTime: ISO instant, endTime: ISO instant }` | Member or admin | Reservation with `PENDING` status |
| `listOwnReservationsAction` | Optional list filter (below) | Member or admin | `{ items, total, page, pageSize }` |
| `getReservationAction` | Reservation UUID | Owner or admin | Reservation detail |
| `cancelReservationAction` | Reservation UUID | Owner or admin | Updated `CANCELLED` reservation |
| `findAvailableResourcesAction` | `{ startTime, endTime, categoryId?: UUID, resourceId?: UUID }` | Member or admin | `{ available, blocked }`, each resource with overlapping intervals |
| `getDailyAvailabilityAction` | `{ date: YYYY-MM-DD, categoryId?: UUID, resourceId?: UUID }` | Member or admin | `{ date, startTime, endTime, available, blocked }` |
| `getReservationsForDateAction` | Same daily input | Member or admin | Blocking intervals on that Colombo calendar day |
| `listAllReservationsAction` | Optional list filter | Admin | Paginated reservations |
| `listPendingReservationsAction` | Optional list filter | Admin | Paginated pending reservations |
| `pendingReservationCountAction` | None | Admin | Number |
| `approveReservationAction` | Reservation UUID | Admin | Updated `APPROVED` reservation |
| `rejectReservationAction` | Reservation UUID | Admin | Updated `REJECTED` reservation |

The optional list filter is `{ status?: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED", resourceId?: UUID, userId?: UUID, from?: ISO instant, to?: ISO instant, page?: integer 1–100000, pageSize?: integer 1–100, sort?: "asc" | "desc" }`. Defaults: page 1, pageSize 20, descending start time. `from` and `to` select reservations overlapping `[from, to)`. Members may only set `userId` to their own ID. `listPendingReservationsAction` forces `PENDING` when given a valid status filter.

`getReservationsForDateAction` returns only `{ resourceId, startTime, endTime, status }` for members. Admins also receive reservation details and the requester's name and email. Availability responses include only resource identity and occupancy intervals, never another member's title, name, email, or user ID. Availability selects **active** resources and queries all blocking intervals in one database read. The snapshot is informative; it does not hold a slot.

`PENDING` and `APPROVED` block `[startTime, endTime)`. `REJECTED` and `CANCELLED` remain in history but do not block. Adjacent intervals are allowed. Pending slots remain blocked until an admin approves or rejects, or an authorized user cancels. No automatic pending expiry is configured. A future operations policy could add escalation or expiration after agreement.

Allowed transitions: `PENDING → APPROVED`, `PENDING → REJECTED`, `PENDING → CANCELLED`, `APPROVED → CANCELLED`. Repeated or stale decisions return `INVALID_STATUS_TRANSITION` with a refresh message. The PostgreSQL transition trigger and GiST exclusion constraint remain the final guards.

Error codes: `UNAUTHENTICATED`, `FORBIDDEN`, `INVALID_INPUT` (may include `fieldErrors`), `RESOURCE_NOT_FOUND`, `RESOURCE_INACTIVE`, `RESERVATION_NOT_FOUND`, `SLOT_CONFLICT`, `INVALID_STATUS_TRANSITION`, `DATABASE_ERROR`. Raw database errors are not sent to clients. The app maps nested PostgreSQL `23P01` exclusion errors to `SLOT_CONFLICT`.

For the calendar, call `getDailyAvailabilityAction` or `getReservationsForDateAction` with the selected **Asia/Colombo** date. For a chosen interval, call `findAvailableResourcesAction`; then submit `createReservationAction`. After create, approve, reject, or cancel, call the relevant read action again. A fresh availability response can differ from the earlier preview because another request may win the database race.

## Verification harness

`npm run test:reservations` exercises the actual actions through `/api/reservation-test`, a test-only route that returns 404 unless the server starts with `SLOTIFY_RESERVATION_TEST_MODE=1`. Run a production build first. The test creates uniquely named users, resources, and reservations and removes them afterward; it asserts the original reservation count is preserved. Keep the test flag unset in normal deployments.
