# Stage 6A department backend contract

Import Server Actions from `@/features/departments/actions/department-actions` and reservation actions from `@/features/reservations/actions/reservation-actions`. Actions return `{ success: true, data }` or `{ success: false, code, error, fieldErrors? }`. Authenticated operations reload the current active user and role from PostgreSQL. UUIDs are strings; dates in reservation inputs are ISO instants with `Z` or an offset.

## Data model and migration state

`Department` has `id: UUID`, unique `name` and `code`, optional `description`, `isActive`, `createdAt`, and `updatedAt`. `User.departmentId` and `Reservation.departmentId` are UUID foreign keys. `Reservation.userId` is nullable for admin department-only bookings; `createdByUserId` remains the individual actor. A reservation's department is a historical snapshot and is not rewritten when a user changes departments. New bookings must have an active department, and a selected individual owner must be active in that department. The PostgreSQL insertion trigger enforces those rules even for direct inserts.

The migration deliberately leaves both department foreign keys nullable for legacy rows. Existing users and reservations were **not** assigned a guessed department. The six stable seeded codes are `HR`, `ENG`, `FE`, `BE`, `MOBILE`, and `IT`. Run `npm run db:seed-departments` repeatedly if needed; it inserts missing codes and does not overwrite existing department names or records.

The full demo seed preserves existing account memberships. If it must provision a **new** demo account, set `SLOTIFY_DEMO_DEPARTMENT_CODE` to an explicitly chosen active code; it will refuse to create an unassigned active demo account. This setting does not backfill existing users.

Before a future NOT NULL migration, an administrator must obtain authoritative assignments for each legacy user, including admins, and separate historical evidence for each legacy reservation. A user's present department alone does not establish a past reservation's department. Review `SELECT id, email, role FROM users WHERE "departmentId" IS NULL` and `SELECT id, "userId", "createdAt" FROM reservations WHERE "departmentId" IS NULL`, record verified mappings, then apply them in a reviewed data migration. Recheck both null counts, active memberships, owner/department consistency, historical evidence, and dependent integrations before adding strict constraints. Unresolved historical reservations remain nullable until evidence exists; do not delete or relabel them. An unassigned active user can sign in and read permitted data but cannot create a new booking.

## Department actions

| Action | Input | Access | Success data |
| --- | --- | --- | --- |
| `listSignupDepartmentsAction()` | None | Public | `{ id, name, code }[]` for active departments, name sorted |
| `getMyDepartmentAction()` | None | Active signed-in user | `{ department: { id, name, code, isActive } \| null, assignmentRequired: boolean }` |
| `listDepartmentsAction(input?)` | `{ search?, status?: "ALL" \| "ACTIVE" \| "INACTIVE", page?, pageSize? }` | ADMIN | `{ items: Department[], total, page, pageSize }` |
| `listActiveDepartmentsAction(input?)` | Same list input; status forced active | ADMIN | Paginated active departments |
| `createDepartmentAction(input)` | `{ name, code, description?, isActive? }` | ADMIN | Department |
| `updateDepartmentAction(id, input)` | UUID; at least one of `{ name?, code?, description? }` | ADMIN | Department |
| `setDepartmentStatusAction(input)` | `{ id: UUID, isActive: boolean }` | ADMIN | Department; deactivation refuses active members |
| `assignUserDepartmentAction(input)` | `{ userId: UUID, departmentId: UUID }` | ADMIN | `{ id, name, email, role, isActive, departmentId }` |
| `listUsersByDepartmentAction(input)` | `{ departmentId: UUID, page?, pageSize? }` | ADMIN | Paginated `{ id, name, email, role, isActive, departmentId }` records |

List defaults are page 1 and pageSize 50; maximum pageSize is 100. Codes are trimmed and uppercased. Create accepts a 2–12 character alphanumeric code starting with a letter. Duplicate name/code returns `DEPARTMENT_CONFLICT`. Department deletion is intentionally not exposed. Mutations revalidate `/administration`, `/signup`, and `/reservations`; clients holding local state should refetch or call `router.refresh()`.

Public signup loads `listSignupDepartmentsAction()` through `/signup` and submits `departmentId` to `signupAction` with name, email, password, and confirmation. The server checks the department is active inside the creation transaction and always writes role `MEMBER`. A missing or inactive department returns a `departmentId` field error. Existing signup rate limits and password validation remain in force. The current signup form has a minimal selector for compatibility; department management and profile UI remain Stage 6B work.

## Reservation actions and ownership

`createReservationAction({ resourceId, title, startTime, endTime })` is the self-booking path. It rejects `userId`, `departmentId`, `status`, and role flags as unknown input. The owner is the authenticated user; the department comes from their PostgreSQL membership. MEMBER creates `PENDING`; ADMIN self-booking creates `APPROVED`. An unassigned user receives `DEPARTMENT_REQUIRED`; an inactive department receives `DEPARTMENT_INACTIVE`.

`createAdminReservationAction({ departmentId, targetUserId?, resourceId, title, startTime, endTime })` requires ADMIN. The selected department must be active. If `targetUserId` is present, that user must be active and belong to the selected department; errors are `USER_NOT_FOUND`, `USER_INACTIVE`, or `DEPARTMENT_MISMATCH`. Omitting `targetUserId` creates an `APPROVED` department-only booking with `userId: null`. The authenticated admin is always stored as `createdByUserId`. Use `listActiveUsersAction({ departmentId?, search?, page?, pageSize? })` to populate a target selector; returned users include their department ID. `listAllReservationsAction` and `listPendingReservationsAction` accept `departmentId?` in their list filter. Individual reservation DTOs include `departmentId` and department `{ name, code }`, which can be null for legacy rows. Owner `user` and `userId` can also be null.

`getGroupedReservationsForDateAction({ date, categoryId?, resourceId? })` returns blocking reservations for an Asia/Colombo day, visually grouped only when resource, department, status, and exact endpoint adjacency match. Each group has `{ resourceId, departmentId, status, startTime, endTime, reservationIds }`. A MEMBER receives these occupancy fields only; ADMIN additionally receives `bookings: { id, title, userId }[]`. Groups never change, combine, or delete source reservations. Legacy null-department rows are never combined. Keep `reservationIds` for navigation and individual operations. Use `getReservationsForDateAction` for the existing ungrouped occupancy contract.

`PENDING` and `APPROVED` block a resource across **all** departments, using `[startTime, endTime)`; `REJECTED` and `CANCELLED` do not block. Adjacent intervals are valid. PostgreSQL's existing GiST exclusion constraint remains the final concurrency guard, with collisions returned as `SLOT_CONFLICT`.

## Errors and refresh

Department actions use `UNAUTHENTICATED`, `FORBIDDEN`, `INVALID_INPUT`, `DEPARTMENT_NOT_FOUND`, `DEPARTMENT_INACTIVE`, `DEPARTMENT_IN_USE`, `DEPARTMENT_CONFLICT`, `USER_NOT_FOUND`, and `DATABASE_ERROR`. Reservation actions additionally use `DEPARTMENT_REQUIRED`, `DEPARTMENT_MISMATCH`, `USER_INACTIVE`, `RESOURCE_NOT_FOUND`, `RESOURCE_INACTIVE`, `SLOT_CONFLICT`, and existing reservation status errors. Errors are typed results; raw database messages are not returned.

After department assignment or status changes, refetch the user's department and affected user lists. After reservation mutations, refetch reservation lists, occupancy or grouped timelines, and unread notifications. Availability previews can become stale while another request wins the database race. Stage 6B should add admin department management, member profile display, department and target selectors for admin booking, nullable owner labels, and grouped timeline rendering. No department calendar UI is included in Stage 6A.
