# Stage 7A backend contract for Stage 7B

## User identity and migration

`User.firstName` and `User.lastName` are nullable for legacy rows. The migration leaves existing `User.name`, account IDs, credentials, departments and reservations unchanged. No automatic name split is safe: a one-word or ambiguous historical display name remains exactly as stored. New public signups and admin-created members require both names; the server stores the joined name in the legacy `name` column. User management DTOs return `displayName` from both structured names when present, otherwise from the original `name`.

The signup form posts `firstName`, `lastName`, `email`, `password`, `confirmPassword`, and an active `departmentId`. Signup creates a MEMBER who can log in immediately. See the [authentication contract](auth-api-contract.md).

## Result and user DTO

All management actions return `{ success: true, data }` or `{ success: false, code, error, fieldErrors? }`. Dates in Server Action responses are serialized by React; the local JSON integration harness emits ISO strings. Use the `success` discriminant.

```ts
type ManagedUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  name: string;               // stored legacy-compatible full name
  displayName: string;        // preferred UI label
  email: string;
  role: "ADMIN" | "MEMBER";
  isActive: boolean;
  departmentId: string | null;
  department: { id: string; name: string; code: string; isActive: boolean } | null;
  createdAt: Date;
  updatedAt: Date;
};
type Page<T> = { items: T[]; total: number; page: number; pageSize: number };
```

No user management DTO includes `passwordHash` or plaintext credentials. Do not display or email the admin-created initial password after submission.

## Admin user actions

Import from `@/features/admin-users/actions/admin-user-actions`. The services also enforce ADMIN access on every request and reject inactive sessions. IDs must be UUIDs.

| Action signature | Data | Notes |
| --- | --- | --- |
| `listManagedUsersAction(input?: { search?: string; role?: "ADMIN" \| "MEMBER"; isActive?: boolean; page?: number; pageSize?: number })` | `Page<ManagedUser>` | Defaults: page 1, pageSize 50; search covers name and email. |
| `getManagedUserAction(userId: string)` | `ManagedUser` | Returns `USER_NOT_FOUND` for missing ID. |
| `createMemberAction(input: { firstName: string; lastName: string; email: string; departmentId: string; initialPassword: string })` | `ManagedUser` | Always creates MEMBER with immediate login. Department must be active. No email is sent. |
| `updateUserProfileAction(input: { userId: string; firstName?: string; lastName?: string; email?: string })` | `ManagedUser` | Updates names and/or a validated, normalized email. A changed email clears the old verification timestamp and invalidates existing sessions. Legacy rows need both names when first adding structured names. |
| `setUserRoleAction(input: { userId: string; role: "ADMIN" \| "MEMBER" })` | `ManagedUser` | An admin cannot change their own role; last active admin is protected. |
| `setUserActiveAction(input: { userId: string; isActive: boolean })` | `ManagedUser` | An admin cannot deactivate self; activation needs an active department. |

Existing department assignment remains `assignUserDepartmentAction({ userId, departmentId })` from `@/features/departments/actions/department-actions`. Use `listActiveDepartmentsAction({})` for choices. Assignment does not rewrite historical reservations.

Management error codes: `UNAUTHENTICATED`, `FORBIDDEN`, `INVALID_INPUT`, `USER_NOT_FOUND`, `EMAIL_CONFLICT`, `DEPARTMENT_NOT_FOUND`, `DEPARTMENT_INACTIVE`, `DEPARTMENT_REQUIRED`, `NAME_PAIR_REQUIRED`, `LAST_ACTIVE_ADMIN`, `SELF_ROLE_CHANGE`, `SELF_DEACTIVATION`, `DATABASE_ERROR`. `INVALID_INPUT` may include `fieldErrors`. Department assignment retains the existing department action result/error type.

Mutations revalidate `/administration`, `/dashboard`, and `/reservations`; department assignment uses its existing revalidation. Refresh client state after a mutation before showing a changed list or profile. A changed email increments `sessionVersion`, invalidating prior sessions on their next authorization check. A syntactically valid email does not prove mailbox ownership. The current Administration frontend still has OTP controls; Antigravity must replace that flow with a direct `updateUserProfileAction` call.

## Reviewed reservation department correction

Import from `@/features/reservations/actions/reservation-actions`. These actions require ADMIN. The correction is historical metadata review: it does not create, remove, approve, reject, cancel, or reschedule a booking. An owner’s present-day department is not evidence for an old booking.

| Action signature | Data |
| --- | --- |
| `listUnassignedReservationsAction(input?: { page?: number; pageSize?: number })` | `Page<UnassignedReservation>`; defaults 1/50, maximum pageSize 100 |
| `listReservationDepartmentCorrectionsAction(reservationId: string)` | Audit rows, newest first |
| `correctReservationDepartmentAction(input: { reservationId: string; expectedDepartmentId?: string \| null; departmentId: string; reason: string })` | `{ reservation, correction }` |

`UnassignedReservation` includes ID, title, status, start/end/created timestamps, resource ID/name, nullable owner and creator IDs, and owner name/email. It includes only rows where `departmentId IS NULL`. The action supports legacy department-only reservations with `userId = null`.

The UI should show the reservation and its current department, require explicit selection of an active destination and a 10–500 character review reason, then pass the displayed current department as `expectedDepartmentId`. Omission is accepted only as an expectation of `null` for older unassigned-booking clients; an already assigned booking returns `STALE_DEPARTMENT`. The screenshot's reason `testing one` is 11 characters and valid; the current timeline modal omitted `expectedDepartmentId`, causing its prior `INVALID_INPUT`. Antigravity should send `expectedDepartmentId: booking.departmentId ?? null`, require `reason.trim().length >= 10`, and show `fieldErrors.reason`/`fieldErrors.reservationId` when returned. A stale value returns `STALE_DEPARTMENT`; reload before retrying. A same-department choice returns `DEPARTMENT_UNCHANGED`. The transaction locks the reservation, validates the active department, changes only `departmentId`, and writes an audit row with previous/new department, admin ID, reason, and timestamp. Booking ID, owner, creator, status, start/end, `createdAt`, and `updatedAt` are preserved. The database overlap constraint remains active. Correction revalidates `/reservations`, `/resources`, `/dashboard`, and `/administration`. Reload timeline and analytics queries after success.

Correction error codes: `UNAUTHENTICATED`, `FORBIDDEN`, `INVALID_INPUT`, `RESERVATION_NOT_FOUND`, `DEPARTMENT_NOT_FOUND`, `DEPARTMENT_INACTIVE`, `STALE_DEPARTMENT`, `DEPARTMENT_UNCHANGED`, `DATABASE_ERROR`.

## Navigation and quick actions

Existing working destinations are `/dashboard`, `/resources`, `/reservations` (member-owned or admin scope), and ADMIN-only `/administration`. Resource creation is the existing `createResourceAction`; pending review uses `listPendingReservationsAction` plus `approveReservationAction`/`rejectReservationAction`; booking uses `createReservationAction` or ADMIN-only `createAdminReservationAction`. The latter supports a target user or a department-only booking by omitting `targetUserId`.

Notification backend actions already exist: `listNotificationsAction`, `getUnreadNotificationCountAction`, `markNotificationAsReadAction`, and `markAllNotificationsAsReadAction` in `@/features/notifications/actions/notification-actions`. Listing and opening reservation details do not mark notifications read; only explicit mark actions do. See [notification contract](notifications-api-contract.md).

Reservation and analytics actions read persisted PostgreSQL rows. Grouped timeline output is a view over bookings, not extra reservation records. Existing seeded rows are real database records.
