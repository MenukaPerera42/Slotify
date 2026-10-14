# Stage 5E Notification Backend & Quick Action Integration Contract

## 1. Overview
In-app notifications in Slotify are persistent, strictly isolated per user inbox, and transactionally tied to reservation business events. No arbitrary notification creation is exposed to clients; all notifications are generated within trusted server-side transactions during reservation lifecycle mutations.

Import Server Actions from `@/features/notifications/actions/notification-actions`.
Every action returns `Promise<NotificationResult<T>>`:
- Success: `{ success: true, data: T }`
- Failure: `{ success: false, code: NotificationErrorCode, error: string, fieldErrors?: Record<string, string[]> }`

---

## 2. Notification Types & Generation Rules

| Notification Type | Trigger Event | Recipient | Actor | Payload Title | Payload Message Summary |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `RESERVATION_REQUESTED` | Member creates a `PENDING` reservation | All active Administrators | Member (requester) | `New Reservation Request` | `{Resource}: "{Title}" requested by {Member}.` |
| `RESERVATION_APPROVED` | Admin approves a pending reservation | Reservation Owner | Approving Admin | `Reservation Approved` | `Your reservation for "{Title}" has been approved.` |
| `RESERVATION_APPROVED` | Admin creates reservation on-behalf (Mode B) | Target User (Owner) | Admin (creator) | `Reservation Created` | `An administrator reserved {Resource} ("{Title}") on your behalf.` |
| `RESERVATION_REJECTED` | Admin rejects a pending reservation | Reservation Owner | Rejecting Admin | `Reservation Rejected` | `Your reservation for "{Title}" was not approved.` |
| `RESERVATION_CANCELLED` | Admin cancels an approved/pending member reservation | Reservation Owner | Admin (canceller) | `Reservation Cancelled` | `Your reservation for "{Title}" was cancelled by an administrator.` |
| `RESERVATION_CANCELLED` | Owner cancels own approved/pending reservation | All active Administrators (excluding owner) | Owner (canceller) | `Reservation Cancelled` | `{Member} cancelled their reservation for "{Title}".` |

### Generation Invariants
1. **No Self-Noise**: An actor is never notified about their own action.
2. **Transactional Consistency**: Notifications are created within the exact same database transaction (`prisma.$transaction`) as the reservation status mutation. If a reservation mutation fails (conflict, stale status, past date), zero notifications are generated.
3. **Idempotency & Stale Guard**: Stale transitions (`INVALID_STATUS_TRANSITION`) or repeated decisions update zero records and produce zero duplicate notifications.
4. **Department Bookings**: An admin booking for a selected target user sends the target one `RESERVATION_APPROVED` notification. A department-only booking has no individual owner, so creation or cancellation does not attempt an owner notification. Admin self-booking is directly approved without a self-notification. These rules run in the same reservation transaction.

---

## 3. Server Actions Specification

### `listNotificationsAction`
- **Input**:
  ```ts
  {
    page?: number;       // Integer 1–100000, default 1
    pageSize?: number;   // Integer 1–100, default 20
    isRead?: boolean;     // Optional filter by read/unread status
    type?: "RESERVATION_REQUESTED" | "RESERVATION_APPROVED" | "RESERVATION_REJECTED" | "RESERVATION_CANCELLED";
  }
  ```
- **Access**: Current authenticated user (MEMBER or ADMIN).
- **Behavior**: Scoped strictly to `recipientUserId === session.user.id`. Ordered by `createdAt DESC`.
- **Read semantics**: Listing and `listNotificationHistoryAction` are read-only. Opening a linked reservation through `getReservationAction` or the `View` link does not update `isRead`.
- **Success `data`**:
  ```ts
  {
    items: Array<{
      id: string;
      recipientUserId: string;
      actorUserId: string | null;
      reservationId: string | null;
      type: NotificationType;
      title: string;
      message: string;
      isRead: boolean;
      createdAt: Date;
      readAt: Date | null;
      actor?: { name: string; email: string } | null;
      reservation?: {
        title: string;
        startTime: Date;
        endTime: Date;
        status: ReservationStatus;
        resource?: { name: string } | null;
      } | null;
    }>;
    total: number;
    unreadCount: number;
    page: number;
    pageSize: number;
  }
  ```

### `getUnreadNotificationCountAction`
- **Input**: None (`void`).
- **Access**: Current authenticated user.
- **Success `data`**: `number` (count of unread notifications for current user).

### `markNotificationAsReadAction`
- **Input**: `id: string (UUID)`.
- **Access**: Current authenticated user.
- **Behavior**: Atomically updates `isRead: true` and `readAt: now()` where `id === input.id AND recipientUserId === session.user.id`.
- **Security Guard**: If the notification ID belongs to another user or does not exist, returns `{ success: false, code: "NOTIFICATION_NOT_FOUND" }`. It never reveals or alters foreign records.
- **Success `data`**: Updated Notification record.
- **Idempotency**: Repeating the action on an already-read notification succeeds without changing its original `readAt`.

### `markAllNotificationsAsReadAction`
- **Input**: None (`void`).
- **Access**: Current authenticated user.
- **Behavior**: Marks all unread notifications for the caller as read.
- **Success `data`**: `{ count: number }`.
- **Idempotency**: A repeat request returns `{ count: 0 }`. Only the caller's unread rows are updated.

### `listNotificationHistoryAction`
- **Input**: Same as `listNotificationsAction`.
- **Access**: Current authenticated user.
- **Success `data`**: Paginated notification history.

---

## 4. Error Handling & Error Codes

| Error Code | HTTP Equiv | Description |
| :--- | :--- | :--- |
| `UNAUTHENTICATED` | 401 | Missing or invalid user session. |
| `FORBIDDEN` | 403 | Attempt to perform unauthorized operation. |
| `INVALID_INPUT` | 400 | Zod schema validation failed (returns `fieldErrors`). |
| `NOTIFICATION_NOT_FOUND` | 404 | Notification does not exist or does not belong to the authenticated user. |
| `DATABASE_ERROR` | 500 | Internal database error (sanitized; raw SQL errors never leaked). |

---

## 5. Privacy, Isolation & Security Rules
- **No Client-Supplied Recipient**: Client callers never supply `recipientUserId` or `actorUserId`. Recipients are resolved internally from trusted database state (e.g. reservation owner, active admin list).
- **Strict Inbox Isolation**: Members and Administrators operate exclusively on their own inboxes. Admins cannot read, mark, or tamper with member notifications.
- **Data Persistence**: `Notification` references `users(id)` and `reservations(id)`. When reservations are deleted or updated, `onDelete: SetNull` ensures historical notifications remain intact. If a user is deactivated, their notifications remain safe in PostgreSQL.

---

## 6. Quick Action Integration Mapping

The application sidebar includes a "Quick Actions" navigation group. Below is the exact operational mapping to verified existing routes and Server Actions:

### Member Quick Actions
1. **New Reservation**:
   - *Target UI*: Opens `ReservationFormModal` in self-booking mode.
   - *Route*: `/reservations?book=true` or modal trigger on `/resources`.
   - *Server Action*: `createReservationAction({ resourceId, title, startTime, endTime })`.
2. **Browse Resources**:
   - *Target UI*: Resource Catalog & Timeline.
   - *Route*: `/resources`.
   - *Server Action*: `findAvailableResourcesAction` / `getReservationsForDateAction`.
3. **My Reservations**:
   - *Target UI*: Personal booking history tab.
   - *Route*: `/reservations` (Tab: "My Bookings").
   - *Server Action*: `listOwnReservationsAction({ page, pageSize })`.
4. **View Pending Requests**:
   - *Target UI*: Filtered personal pending requests.
   - *Route*: `/reservations` (Filtered by `status=PENDING`).
   - *Server Action*: `listOwnReservationsAction({ status: "PENDING" })`.

### Administrator Quick Actions
1. **Review Pending Approvals**:
   - *Target UI*: Admin approval queue tab with Approve/Reject actions.
   - *Route*: `/reservations` (Tab: "Pending Approvals").
   - *Server Action*: `listPendingReservationsAction` + `approveReservationAction` / `rejectReservationAction`.
2. **Add Resource**:
   - *Target UI*: Opens `ResourceFormModal` create dialog.
   - *Route*: `/resources` (Action button: `+ Add Resource`).
   - *Server Action*: `createResourceAction({ name, categoryId, location, capacity, isActive })`.
3. **Create Reservation for User**:
   - *Target UI*: Opens `ReservationFormModal` in Admin Mode B ("Book on Behalf of User").
   - *Route*: `/resources` or `/reservations`.
   - *Server Action*: `listActiveUsersAction({ departmentId })` + `createAdminReservationAction({ departmentId, targetUserId, resourceId, title, startTime, endTime })`. Omit `targetUserId` for a department-only booking.
4. **Manage Users**:
   - *Target UI*: User Administration & Role management.
   - *Route*: `/administration`.
   - *Server Action*: `listActiveUsersAction` (or existing user service).
5. **View All Reservations**:
   - *Target UI*: Global organizational reservations table.
   - *Route*: `/reservations` (Tab: "All Bookings").
   - *Server Action*: `listAllReservationsAction({ page, pageSize, status, resourceId })`.

---

## 7. Client Polling & Revalidation Recommendations
1. **Sidebar Unread Count**: Poll `getUnreadNotificationCountAction()` on a 30-to-60-second background interval or upon window focus.
2. **After Mutations**: Call `getUnreadNotificationCountAction()` and revalidate after approving, rejecting, creating, or cancelling a booking.

