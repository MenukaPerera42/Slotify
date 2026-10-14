# Stage 5C reservation backend contract

Import Server Actions from `@/features/reservations/actions/reservation-actions`. Every action returns `Promise<ReservationResult<T>>`: `{ success: true, data }` or `{ success: false, code, error, fieldErrors? }`. Dates returned from the server are JavaScript `Date` values in React Server Actions; serialize them to ISO strings when using another transport. Inputs use ISO 8601 timestamps **with `Z` or a numeric offset**, for example `2026-10-15T09:00:00+05:30`. The server stores instants in PostgreSQL `timestamptz`.

All actions require an active Auth.js session. Authorization state is reloaded from PostgreSQL for each operation. Client supplied actor ID and role are never accepted. Member creation rejects `userId` and `status`; the owner and `PENDING` status come from the server. The dedicated admin creation action accepts `targetUserId` and creates an `APPROVED` reservation.

| Action | Input | Access | Success `data` |
| --- | --- | --- | --- |
| `createReservationAction` | `{ resourceId: UUID, title: string (1–120 trimmed chars), startTime: ISO instant, endTime: ISO instant }` | Member or admin | Reservation with `PENDING` status |
| `createAdminReservationAction` | `{ targetUserId: UUID, resourceId: UUID, title: string (1–120 trimmed chars), startTime: ISO instant, endTime: ISO instant }` | Admin | Reservation owned by target user with `APPROVED` status and `createdByUserId` set to the current admin |
| `listActiveUsersAction` | Optional `{ search?: string (max 100 chars), page?: integer 1–100000, pageSize?: integer 1–100 }` | Admin | `{ items: [{ id, name, email, role }], total, page, pageSize }`; defaults page 1, pageSize 50 |
| `listOwnReservationsAction` | Optional list filter (below) | Member or admin | `{ items, total, page, pageSize }` |
| `getReservationAction` | Reservation UUID | Owner or admin | Reservation detail |
| `cancelReservationAction` | Reservation UUID | Owner or admin | Updated `CANCELLED` reservation |
| `findAvailableResourcesAction` | `{ startTime, endTime, categoryId?: UUID, resourceId?: UUID }` | Member or admin | `{ available, blocked, inactive }`; active resources have overlapping intervals |
| `getDailyAvailabilityAction` | `{ date: YYYY-MM-DD, categoryId?: UUID, resourceId?: UUID }` | Member or admin | `{ date, startTime, endTime, available, blocked, inactive }` |
| `getReservationsForDateAction` | Same daily input | Member or admin | Blocking intervals on that Colombo calendar day |
| `listAllReservationsAction` | Optional list filter | Admin | Paginated reservations |
| `listPendingReservationsAction` | Optional list filter | Admin | Paginated pending reservations |
| `pendingReservationCountAction` | None | Admin | Number |
| `approveReservationAction` | Reservation UUID | Admin | Updated `APPROVED` reservation |
| `rejectReservationAction` | Reservation UUID | Admin | Updated `REJECTED` reservation |

The optional list filter is `{ status?: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED", resourceId?: UUID, userId?: UUID, from?: ISO instant, to?: ISO instant, page?: integer 1–100000, pageSize?: integer 1–100, sort?: "asc" | "desc" }`. Defaults: page 1, pageSize 20, descending start time. `from` and `to` select reservations overlapping `[from, to)`. Members may only set `userId` to their own ID. `listPendingReservationsAction` forces `PENDING` when given a valid status filter.

`getReservationsForDateAction` returns only `{ resourceId, startTime, endTime, status }` for members. Admins also receive reservation details and the requester's name and email. Availability responses include only resource identity and occupancy intervals, never another member's title, name, email, or user ID. `available` and `blocked` contain active resources; `inactive` contains operationally deactivated resources, which cannot be booked. A specific missing or inactive `resourceId` returns `RESOURCE_NOT_FOUND` or `RESOURCE_INACTIVE` instead of appearing available. The snapshot is informative; it does not hold a slot.

`PENDING` and `APPROVED` block `[startTime, endTime)`. `REJECTED` and `CANCELLED` remain in history but do not block. Adjacent intervals are allowed. Pending slots remain blocked until an admin approves or rejects, or an authorized user cancels. No automatic pending expiry is configured. A future operations policy could add escalation or expiration after agreement.

Allowed transitions: `PENDING → APPROVED`, `PENDING → REJECTED`, `PENDING → CANCELLED`, `APPROVED → CANCELLED`. Repeated or stale decisions return `INVALID_STATUS_TRANSITION` with a refresh message. The PostgreSQL transition trigger and GiST exclusion constraint remain the final guards.

Error codes: `UNAUTHENTICATED`, `FORBIDDEN`, `INVALID_INPUT` (may include `fieldErrors`), `RESOURCE_NOT_FOUND`, `RESOURCE_INACTIVE`, `USER_NOT_FOUND`, `RESERVATION_NOT_FOUND`, `SLOT_CONFLICT`, `INVALID_STATUS_TRANSITION`, `DATABASE_ERROR`. An inactive or missing admin booking target returns `USER_NOT_FOUND` with a generic message. Raw database errors are not sent to clients. The app maps nested PostgreSQL `23P01` exclusion errors to `SLOT_CONFLICT`.

For the calendar, call `getDailyAvailabilityAction` for the selected **Asia/Colombo** date when resource availability and inactive state are needed, or `getReservationsForDateAction` when only blocking intervals are needed. For a chosen interval, call `findAvailableResourcesAction`; then submit `createReservationAction`. To book on behalf of a registered active user, admins first call `listActiveUsersAction` and then `createAdminReservationAction`. The server reloads the admin session and records `createdByUserId`; do not pass an actor ID. After create, approve, reject, or cancel, call the relevant read action again. Mutations revalidate `/reservations` and `/resources`; clients holding action results or local component state must also refetch or call `router.refresh()`. A fresh availability response can differ from the earlier preview because another request may win the database race.

`createdByUserId` is nullable for reservations predating the audit migration because their original creator cannot be inferred safely. New member and admin reservations always populate it. It refers to the user who submitted the booking, which can differ from the owner (`userId`) for admin bookings.

Date-only inputs are `YYYY-MM-DD` in Asia/Colombo. Use `Z` or an explicit offset for all instant inputs and send full ISO strings through Server Actions; do not pass locale display strings. Returned `Date` values become ISO UTC strings when serialized as JSON. The backend derives calendar-day UTC boundaries from the Asia/Colombo timezone and uses half-open overlap tests.

## Stage 5D frontend integration notes

- `src/features/resources/components/date-strip-bar.tsx` uses hardcoded December 2026 dates and has no previous/next handlers. Wire it to selected Colombo dates and pass the selected date into the calendar availability action.
- `src/features/resources/components/timeline-grid.tsx` renders a sample “Reserved” block at one fixed cell and does not query occupancy. Replace that sample data with `getDailyAvailabilityAction` or `getReservationsForDateAction` results, using interval overlap for every visible cell.
- `src/features/resources/components/availability-card.tsx` labels all active resources “AVAILABLE”, and `resource-toolbar.tsx` calls the active filter “Active Available”. Those labels represent operational state only. Show interval availability only after an availability query for the selected time.
- `src/features/reservations/components/reservation-form-modal.tsx` calls `createReservationAction` for both roles. Add an admin target-user selector backed by `listActiveUsersAction` and call `createAdminReservationAction` only for the on-behalf path. Keep the member path unchanged.
- The reservation calendar uses fixed visible hours and a fixed `+05:30` slot calculation in `reservation-calendar-view.tsx`; the backend has no operational-hours restriction. Align the visible grid and displayed time conversion with the selected business date without imposing new server-side limits.

## Verification harness

`npm run test:reservations` exercises the actual actions through `/api/reservation-test`, a test-only route that returns 404 unless the server starts with `SLOTIFY_RESERVATION_TEST_MODE=1`. Run a production build first. The test creates uniquely named users, resources, and reservations and removes them afterward; it asserts the original reservation count is preserved. Keep the test flag unset in normal deployments.
