import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hash } from "argon2";

const prisma = new PrismaClient();
const base = process.env.SLOTIFY_TEST_URL ?? "http://localhost:3000";
const tag = randomBytes(6).toString("hex");
const passphrase = `Test-${randomBytes(18).toString("base64url")}`;
const userIds = [];
let categoryId, resourceId;
let initialNotificationCount;
let initialReservationCount;

const pass = (name) => console.log(`PASS ${name}`);

function cookies(response) {
  return Object.fromEntries(
    response.headers
      .getSetCookie()
      .map((line) => line.split(";", 1)[0].split(/=(.*)/s).slice(0, 2))
  );
}

function cookieHeader(jar) {
  return Object.entries(jar)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

async function login(email, password, address) {
  const jar = {};
  const csrf = await fetch(`${base}/api/auth/csrf`, {
    headers: { "x-forwarded-for": address },
  });
  Object.assign(jar, cookies(csrf));
  const { csrfToken } = await csrf.json();
  const response = await fetch(`${base}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: {
      Cookie: cookieHeader(jar),
      "Content-Type": "application/x-www-form-urlencoded",
      "x-forwarded-for": address,
    },
    body: new URLSearchParams({
      csrfToken,
      email,
      password,
      callbackUrl: `${base}/dashboard`,
    }),
  });
  assert.equal(response.status, 302);
  Object.assign(jar, cookies(response));
  return jar;
}

async function action(name, args, jar = {}) {
  const response = await fetch(`${base}/api/reservation-test`, {
    method: "POST",
    headers: {
      Origin: base,
      Cookie: cookieHeader(jar),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, args }),
    redirect: "manual",
  });
  const text = await response.text();
  assert.equal(
    response.status,
    200,
    `${name}: ${response.status} ${text.slice(0, 300)}`
  );
  return text;
}

function succeeds(text) {
  const res = JSON.parse(text);
  assert.equal(res.success, true, text);
  return res.data;
}

function fails(text, code) {
  const res = JSON.parse(text);
  assert.equal(res.success, false, text);
  if (code) assert.equal(res.code, code, text);
  return res;
}

function slot(hoursFromNow, minutes = 60) {
  const start = new Date(Date.now() + hoursFromNow * 3600_000);
  start.setUTCSeconds(0, 0);
  return {
    startTime: start.toISOString(),
    endTime: new Date(start.valueOf() + minutes * 60_000).toISOString(),
  };
}

try {
  initialNotificationCount = await prisma.notification.count();
  initialReservationCount = await prisma.reservation.count();

  // Create isolated test category and resource
  categoryId = (
    await prisma.resourceCategory.create({
      data: { name: `Stage5E Category ${tag}` },
    })
  ).id;

  resourceId = (
    await prisma.resource.create({
      data: {
        name: `Stage5E Resource ${tag}`,
        location: "Test Suite Wing",
        categoryId,
      },
    })
  ).id;

  // Create test accounts: 2 members, 2 admins
  const users = {};
  for (const [name, role] of [
    ["member1", "MEMBER"],
    ["member2", "MEMBER"],
    ["admin1", "ADMIN"],
    ["admin2", "ADMIN"],
  ]) {
    const email = `${name}-${tag}@stage5e.local`;
    const passwordHash = await hash(passphrase);
    const created = await prisma.user.create({
      data: { name: `User ${name}`, email, role, passwordHash, isActive: true },
    });
    userIds.push(created.id);
    users[name] = {
      id: created.id,
      email,
      role,
      jar: await login(email, passphrase, `198.51.100.${userIds.length}`),
    };
  }

  // 1. Member booking creates admin notification
  const member1BookingInput = {
    resourceId,
    title: `M1 Request ${tag}`,
    ...slot(10),
  };
  const member1Booking = succeeds(
    await action("createReservationAction", [member1BookingInput], users.member1.jar)
  );
  assert.equal(member1Booking.status, "PENDING");

  // Admin1 & Admin2 should have received a RESERVATION_REQUESTED notification
  const admin1Notifications = succeeds(
    await action("listNotificationsAction", [{}], users.admin1.jar)
  );
  const adminReqNotif = admin1Notifications.items.find(
    (n) => n.reservationId === member1Booking.id && n.type === "RESERVATION_REQUESTED"
  );
  assert.ok(adminReqNotif, "Admin should receive RESERVATION_REQUESTED notification");
  assert.equal(adminReqNotif.actorUserId, users.member1.id);
  assert.equal(adminReqNotif.isRead, false);

  // Member1 should NOT have received a notification about their own request
  const member1Notifications = succeeds(
    await action("listNotificationsAction", [{}], users.member1.jar)
  );
  const selfReqNotif = member1Notifications.items.find(
    (n) => n.reservationId === member1Booking.id
  );
  assert.equal(selfReqNotif, undefined, "Actor must not be notified about own action");
  pass("1. member booking creates admin notification and avoids actor self-notification");

  // 2. Admin approval creates owner notification
  const approved = succeeds(
    await action("approveReservationAction", [member1Booking.id], users.admin1.jar)
  );
  assert.equal(approved.status, "APPROVED");

  const member1AfterApprove = succeeds(
    await action("listNotificationsAction", [{}], users.member1.jar)
  );
  const ownerApproveNotif = member1AfterApprove.items.find(
    (n) => n.reservationId === member1Booking.id && n.type === "RESERVATION_APPROVED"
  );
  assert.ok(ownerApproveNotif, "Owner should receive RESERVATION_APPROVED notification");
  assert.equal(ownerApproveNotif.actorUserId, users.admin1.id);
  assert.equal(ownerApproveNotif.recipientUserId, users.member1.id);
  pass("2. admin approval creates owner notification");

  // 3. Admin rejection creates owner notification
  const member2BookingInput = {
    resourceId,
    title: `M2 Request ${tag}`,
    ...slot(14),
  };
  const member2Booking = succeeds(
    await action("createReservationAction", [member2BookingInput], users.member2.jar)
  );
  const rejected = succeeds(
    await action("rejectReservationAction", [member2Booking.id], users.admin2.jar)
  );
  assert.equal(rejected.status, "REJECTED");

  const member2AfterReject = succeeds(
    await action("listNotificationsAction", [{}], users.member2.jar)
  );
  const ownerRejectNotif = member2AfterReject.items.find(
    (n) => n.reservationId === member2Booking.id && n.type === "RESERVATION_REJECTED"
  );
  assert.ok(ownerRejectNotif, "Owner should receive RESERVATION_REJECTED notification");
  assert.equal(ownerRejectNotif.actorUserId, users.admin2.id);
  pass("3. admin rejection creates owner notification");

  // 4. Cancellation creates appropriate notification
  // Case 4A: Admin cancels Member1's approved reservation -> Member1 is notified
  const adminCancel = succeeds(
    await action("cancelReservationAction", [member1Booking.id], users.admin1.jar)
  );
  assert.equal(adminCancel.status, "CANCELLED");

  const member1AfterAdminCancel = succeeds(
    await action("listNotificationsAction", [{}], users.member1.jar)
  );
  const cancelNotifForMember = member1AfterAdminCancel.items.find(
    (n) => n.reservationId === member1Booking.id && n.type === "RESERVATION_CANCELLED"
  );
  assert.ok(cancelNotifForMember, "Member should receive notification when admin cancels");

  // Case 4B: Member cancels own reservation -> Admin is notified, Member is NOT notified
  const member1NewBooking = succeeds(
    await action(
      "createReservationAction",
      [{ resourceId, title: `M1 Self Cancel ${tag}`, ...slot(20) }],
      users.member1.jar
    )
  );
  const memberSelfCancel = succeeds(
    await action("cancelReservationAction", [member1NewBooking.id], users.member1.jar)
  );
  assert.equal(memberSelfCancel.status, "CANCELLED");

  const member1SelfCheck = succeeds(
    await action("listNotificationsAction", [{}], users.member1.jar)
  );
  const selfCancelNotif = member1SelfCheck.items.find(
    (n) => n.reservationId === member1NewBooking.id && n.type === "RESERVATION_CANCELLED"
  );
  assert.equal(selfCancelNotif, undefined, "Cancelling member must not receive self notification");

  const admin1CheckCancel = succeeds(
    await action("listNotificationsAction", [{}], users.admin1.jar)
  );
  const adminNotifMemberCancel = admin1CheckCancel.items.find(
    (n) => n.reservationId === member1NewBooking.id && n.type === "RESERVATION_CANCELLED"
  );
  assert.ok(adminNotifMemberCancel, "Admins should receive notification of member cancellation");
  pass("4. cancellation creates appropriate participant notification without self-noise");

  // 5. Failed booking creates no notification
  const initialAdmin1Count = (
    await prisma.notification.count({ where: { recipientUserId: users.admin1.id } })
  );
  const pastInput = {
    resourceId,
    title: `Past Booking ${tag}`,
    startTime: new Date(Date.now() - 7200_000).toISOString(),
    endTime: new Date(Date.now() - 3600_000).toISOString(),
  };
  fails(await action("createReservationAction", [pastInput], users.member1.jar), "INVALID_INPUT");
  const postFailAdmin1Count = (
    await prisma.notification.count({ where: { recipientUserId: users.admin1.id } })
  );
  assert.equal(postFailAdmin1Count, initialAdmin1Count, "Failed booking must produce zero notifications");
  pass("5. failed booking creates no notification");

  // 6. Stale approval does not duplicate notifications
  // Try to approve an already-cancelled reservation
  const countBeforeStale = await prisma.notification.count({
    where: { reservationId: member1Booking.id },
  });
  fails(
    await action("approveReservationAction", [member1Booking.id], users.admin1.jar),
    "INVALID_STATUS_TRANSITION"
  );
  const countAfterStale = await prisma.notification.count({
    where: { reservationId: member1Booking.id },
  });
  assert.equal(countAfterStale, countBeforeStale, "Stale transition must not duplicate notifications");
  pass("6. stale approval does not duplicate notifications");

  // 7. Unread count is accurate
  const unreadCountMember1 = succeeds(
    await action("getUnreadNotificationCountAction", [], users.member1.jar)
  );
  const dbUnreadCountMember1 = await prisma.notification.count({
    where: { recipientUserId: users.member1.id, isRead: false },
  });
  assert.equal(unreadCountMember1, dbUnreadCountMember1);
  assert.ok(unreadCountMember1 > 0);
  pass("7. unread count is accurate");

  // 8. Mark notification as read works
  const member1Notifs = succeeds(
    await action("listNotificationsAction", [{ isRead: false }], users.member1.jar)
  );
  assert.ok(member1Notifs.items.length > 0);
  const targetNotif = member1Notifs.items[0];

  const marked = succeeds(
    await action("markNotificationAsReadAction", [targetNotif.id], users.member1.jar)
  );
  assert.equal(marked.id, targetNotif.id);
  assert.equal(marked.isRead, true);
  assert.ok(marked.readAt !== null);

  const updatedUnread = succeeds(
    await action("getUnreadNotificationCountAction", [], users.member1.jar)
  );
  assert.equal(updatedUnread, unreadCountMember1 - 1);
  pass("8. mark notification as read works and decrements count");

  // 9. Mark all as read works
  const markAllRes = succeeds(
    await action("markAllNotificationsAsReadAction", [], users.member1.jar)
  );
  assert.ok(markAllRes.count >= 0);

  const postMarkAllUnread = succeeds(
    await action("getUnreadNotificationCountAction", [], users.member1.jar)
  );
  assert.equal(postMarkAllUnread, 0);
  pass("9. mark all as read works");

  // 10. Users cannot read others' notifications
  // Member2 lists notifications -> none should belong to Member1
  const member2InBox = succeeds(
    await action("listNotificationsAction", [{}], users.member2.jar)
  );
  for (const item of member2InBox.items) {
    assert.equal(item.recipientUserId, users.member2.id);
  }
  pass("10. users cannot read others' notifications (isolated inboxes)");

  // 11. Users cannot mark others' notifications as read
  // Member2 tries to mark Member1's notification as read
  fails(
    await action("markNotificationAsReadAction", [targetNotif.id], users.member2.jar),
    "NOTIFICATION_NOT_FOUND"
  );
  pass("11. users cannot mark others' notifications as read");

  // 12. Pagination works
  const paged1 = succeeds(
    await action("listNotificationsAction", [{ page: 1, pageSize: 1 }], users.admin1.jar)
  );
  assert.equal(paged1.items.length, 1);
  assert.equal(paged1.page, 1);
  assert.equal(paged1.pageSize, 1);
  assert.ok(paged1.total >= 1);
  pass("12. pagination works with page and pageSize constraints");

  // 13. Notification data persists and relations remain safe
  const currentNotifCount = await prisma.notification.count();
  assert.ok(currentNotifCount > initialNotificationCount);
  pass("13. notification data persists in PostgreSQL");

  // 14. Existing reservation concurrency protection remains functional
  const concurrentSlot = slot(30);
  const [resA, resB] = await Promise.all([
    action("createReservationAction", [{ resourceId, title: "Race A", ...concurrentSlot }], users.member1.jar),
    action("createReservationAction", [{ resourceId, title: "Race B", ...concurrentSlot }], users.member2.jar),
  ]);
  const aSuccess = JSON.parse(resA).success;
  const bSuccess = JSON.parse(resB).success;
  assert.equal(aSuccess !== bSuccess, true, "Exactly one booking must succeed in a concurrent race");
  pass("14. existing reservation concurrency protection remains functional");

  // 15. Existing authentication and resource management remain functional
  const resourcePageRes = await fetch(`${base}/resources`, {
    headers: { Cookie: cookieHeader(users.member1.jar) },
  });
  assert.equal(resourcePageRes.status, 200);
  pass("15. existing authentication and resource management remain functional");

} finally {
  // Safe cleanup of isolated test data only
  if (resourceId) {
    await prisma.notification.deleteMany({
      where: { reservation: { resourceId } },
    });
    await prisma.reservation.deleteMany({ where: { resourceId } });
    await prisma.resource.deleteMany({ where: { id: resourceId } });
  }
  if (categoryId) {
    await prisma.resourceCategory.delete({ where: { id: categoryId } });
  }
  if (userIds.length) {
    await prisma.notification.deleteMany({
      where: {
        OR: [
          { recipientUserId: { in: userIds } },
          { actorUserId: { in: userIds } },
        ],
      },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  // Verify baseline preservation
  if (initialReservationCount !== undefined) {
    assert.equal(
      await prisma.reservation.count(),
      initialReservationCount,
      "Existing reservation baseline was altered!"
    );
  }
  if (initialNotificationCount !== undefined) {
    assert.equal(
      await prisma.notification.count(),
      initialNotificationCount,
      "Existing notification baseline was altered!"
    );
  }

  await prisma.$disconnect();
}

