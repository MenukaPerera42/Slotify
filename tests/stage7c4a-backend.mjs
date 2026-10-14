import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hash } from "argon2";

const prisma = new PrismaClient();
const base = process.env.SLOTIFY_TEST_URL ?? "http://localhost:3001";
const tag = randomBytes(6).toString("hex");
const password = "abc@12";
const created = { users: [], departments: [], categories: [], resources: [], reservations: [], notifications: [] };
let addressCounter = 1;
const pass = (message) => console.log(`PASS ${message}`);
const cookieHeader = (jar) => Object.entries(jar).map(([key, value]) => `${key}=${value}`).join("; ");
const cookies = (response) => Object.fromEntries(response.headers.getSetCookie().map((line) => line.split(";", 1)[0].split(/=(.*)/s).slice(0, 2)));
async function action(name, args = [], jar = {}) {
  const response = await fetch(`${base}/api/reservation-test`, {
    method: "POST", headers: { Origin: base, Cookie: cookieHeader(jar), "Content-Type": "application/json",
      "x-forwarded-for": `198.19.8.${(addressCounter++ % 250) + 1}` },
    body: JSON.stringify({ name, args }),
  });
  assert.equal(response.status, 200, `${name}: HTTP ${response.status}`);
  return response.json();
}
async function login(email) {
  const jar = {};
  const csrf = await fetch(`${base}/api/auth/csrf`);
  Object.assign(jar, cookies(csrf));
  const { csrfToken } = await csrf.json();
  const response = await fetch(`${base}/api/auth/callback/credentials`, {
    method: "POST", redirect: "manual",
    headers: { Cookie: cookieHeader(jar), "Content-Type": "application/x-www-form-urlencoded",
      "x-forwarded-for": `198.19.9.${(addressCounter++ % 250) + 1}` },
    body: new URLSearchParams({ csrfToken, email, password, callbackUrl: `${base}/dashboard` }),
  });
  Object.assign(jar, cookies(response));
  return { response, jar };
}
function ok(result, label) { assert.equal(result.success, true, `${label}: ${JSON.stringify(result)}`); return result.data; }
function fails(result, code, label) { assert.equal(result.success, false, `${label}: ${JSON.stringify(result)}`); assert.equal(result.code, code, label); return result; }

try {
  const department = await prisma.department.create({ data: { name: `Stage7C4A ${tag}`, code: `C${tag.toUpperCase()}` } });
  created.departments.push(department.id);
  const category = await prisma.resourceCategory.create({ data: { name: `Stage7C4A Category ${tag}` } });
  created.categories.push(category.id);
  const resource = await prisma.resource.create({ data: { name: `Stage7C4A Resource ${tag}`, location: "Test", categoryId: category.id } });
  created.resources.push(resource.id);
  const passwordHash = await hash(password);
  const admin = await prisma.user.create({ data: { name: "Stage Admin", email: `stage7c4a-admin-${tag}@example.test`, role: "ADMIN", departmentId: department.id, passwordHash } });
  const member = await prisma.user.create({ data: { name: "Stage Member", email: `stage7c4a-member-${tag}@example.test`, departmentId: department.id, passwordHash,
    emailVerificationRequiredAt: new Date(), emailVerifiedAt: null } });
  const inactive = await prisma.user.create({ data: { name: "Stage Inactive", email: `stage7c4a-inactive-${tag}@example.test`, departmentId: department.id,
    passwordHash, isActive: false, emailVerificationRequiredAt: new Date() } });
  created.users.push(admin.id, member.id, inactive.id);
  const adminJar = (await login(admin.email)).jar;
  const memberLogin = await login(member.email);
  assert.match(memberLogin.response.headers.get("location") ?? "", /dashboard/);
  assert.match((await login(inactive.email)).response.headers.get("location") ?? "", /error=CredentialsSignin/);
  pass("legacy unverified accounts can log in; inactive accounts remain blocked");

  const signupEmail = `stage7c4a-signup-${tag}@example.test`;
  const registration = { firstName: "Six", lastName: "Character", email: signupEmail.toUpperCase(), departmentId: department.id,
    password, confirmPassword: password };
  fails(await action("registerMemberAction", [{ ...registration, email: "invalid-email" }]), "INVALID_INPUT", "invalid email");
  for (const weak of ["abcdef", "123456", "abc123", "ab@12"]) {
    fails(await action("registerMemberAction", [{ ...registration, password: weak, confirmPassword: weak }]), "INVALID_INPUT", `weak ${weak}`);
  }
  const registered = ok(await action("registerMemberAction", [registration]), "registration");
  assert.equal(registered.email, signupEmail);
  assert.equal(registered.nextPath, "/login?created=1");
  const signedUp = await prisma.user.findUniqueOrThrow({ where: { email: signupEmail } });
  created.users.push(signedUp.id);
  assert.equal(signedUp.role, "MEMBER");
  assert.equal(signedUp.emailVerificationRequiredAt, null);
  assert.equal(signedUp.emailVerifiedAt, null);
  assert.match(signedUp.passwordHash, /^\$argon2id\$/);
  assert.equal(await prisma.emailVerificationChallenge.count({ where: { userId: signedUp.id } }), 0);
  fails(await action("registerMemberAction", [{ ...registration, email: signupEmail }]), "EMAIL_IN_USE", "duplicate signup");
  assert.match((await login(signupEmail)).response.headers.get("location") ?? "", /dashboard/);
  pass("syntax-only signup, password policy, uniqueness and immediate login without mail");

  const managedEmail = `stage7c4a-managed-${tag}@example.test`;
  fails(await action("createMemberAction", [{ firstName: "New", lastName: "Member", email: managedEmail,
    departmentId: department.id, initialPassword: password }], memberLogin.jar), "FORBIDDEN", "member create");
  const managed = ok(await action("createMemberAction", [{ firstName: "New", lastName: "Member", email: managedEmail,
    departmentId: department.id, initialPassword: password }], adminJar), "admin create");
  created.users.push(managed.id);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: managed.id } })).emailVerificationRequiredAt, null);
  assert.match((await login(managedEmail)).response.headers.get("location") ?? "", /dashboard/);
  pass("admin-created members can log in immediately");

  const reservation = await prisma.reservation.create({ data: { title: `Legacy booking ${tag}`, resourceId: resource.id,
    userId: member.id, createdByUserId: admin.id, departmentId: department.id, status: "APPROVED",
    startTime: new Date("2024-02-01T04:30:00.000Z"), endTime: new Date("2024-02-01T05:30:00.000Z") } });
  created.reservations.push(reservation.id);
  // Convert only this isolated historical booking into a legacy NULL row.
  await prisma.$executeRaw`UPDATE reservations SET "departmentId" = NULL WHERE id = ${reservation.id}::uuid`;
  const before = await prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } });
  const shortReason = fails(await action("correctReservationDepartmentAction", [{ reservationId: reservation.id, departmentId: department.id,
    reason: "short" }], adminJar), "INVALID_INPUT", "short reason");
  assert.ok(shortReason.fieldErrors?.reason);
  assert.match(shortReason.error, /at least 10 characters/);
  const malformed = fails(await action("correctReservationDepartmentAction", [{ reservationId: "bad-id", departmentId: department.id,
    reason: "Reviewed old booking" }], adminJar), "INVALID_INPUT", "invalid reservation id");
  assert.ok(malformed.fieldErrors?.reservationId);
  fails(await action("correctReservationDepartmentAction", [{ reservationId: reservation.id, departmentId: department.id,
    reason: "Reviewed old booking" }], memberLogin.jar), "FORBIDDEN", "member correction");
  const correction = ok(await action("correctReservationDepartmentAction", [{ reservationId: reservation.id,
    departmentId: department.id, reason: "testing one" }], adminJar), "legacy correction");
  assert.equal(correction.reservation.departmentId, department.id);
  assert.equal(correction.correction.previousDepartmentId, null);
  assert.equal(correction.correction.correctedByUserId, admin.id);
  const after = await prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } });
  for (const field of ["id", "resourceId", "userId", "createdByUserId", "status"]) assert.equal(after[field], before[field]);
  for (const field of ["startTime", "endTime", "createdAt", "updatedAt"]) assert.equal(after[field].getTime(), before[field].getTime());
  fails(await action("correctReservationDepartmentAction", [{ reservationId: reservation.id, departmentId: department.id,
    reason: "Reviewed old booking" }], adminJar), "STALE_DEPARTMENT", "stale legacy correction");
  assert.equal(await prisma.reservationDepartmentCorrection.count({ where: { reservationId: reservation.id } }), 1);
  pass("legacy department correction, precise validation, authorization, stale guard and audit");

  const n1 = await prisma.notification.create({ data: { recipientUserId: member.id, actorUserId: admin.id, reservationId: reservation.id,
    type: "RESERVATION_APPROVED", title: "Test 1", message: "First test notification" } });
  const n2 = await prisma.notification.create({ data: { recipientUserId: member.id, actorUserId: admin.id, reservationId: reservation.id,
    type: "RESERVATION_APPROVED", title: "Test 2", message: "Second test notification" } });
  const foreign = await prisma.notification.create({ data: { recipientUserId: admin.id, actorUserId: member.id, reservationId: reservation.id,
    type: "RESERVATION_REQUESTED", title: "Foreign", message: "Foreign notification" } });
  created.notifications.push(n1.id, n2.id, foreign.id);
  const initialUnread = ok(await action("getUnreadNotificationCountAction", [], memberLogin.jar), "initial unread");
  const list = ok(await action("listNotificationsAction", [{}], memberLogin.jar), "list");
  assert.ok(list.items.some((item) => item.id === n1.id));
  ok(await action("getReservationAction", [reservation.id], memberLogin.jar), "view reservation");
  assert.equal(ok(await action("getUnreadNotificationCountAction", [], memberLogin.jar), "after view"), initialUnread);
  assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id: n1.id } })).isRead, false);
  fails(await action("markNotificationAsReadAction", [foreign.id], memberLogin.jar), "NOTIFICATION_NOT_FOUND", "foreign mark");
  const read = ok(await action("markNotificationAsReadAction", [n1.id], memberLogin.jar), "mark one");
  assert.equal(read.isRead, true);
  const readAt = new Date(read.readAt).getTime();
  assert.equal(new Date(ok(await action("markNotificationAsReadAction", [n1.id], memberLogin.jar), "repeat mark").readAt).getTime(), readAt);
  assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id: n2.id } })).isRead, false);
  const markedAll = ok(await action("markAllNotificationsAsReadAction", [], memberLogin.jar), "mark all");
  assert.ok(markedAll.count >= 1);
  assert.equal(ok(await action("getUnreadNotificationCountAction", [], memberLogin.jar), "after mark all"), 0);
  assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id: foreign.id } })).isRead, false);
  assert.equal(ok(await action("markAllNotificationsAsReadAction", [], memberLogin.jar), "repeat mark all").count, 0);
  pass("notification listing and reservation view are read-only; explicit marks are scoped and idempotent");

  const changedEmail = `stage7c4a-changed-${tag}@example.test`;
  fails(await action("updateUserProfileAction", [{ userId: member.id, email: changedEmail }], memberLogin.jar), "FORBIDDEN", "member email edit");
  const invalidEmail = fails(await action("updateUserProfileAction", [{ userId: member.id, email: "bad-email" }], adminJar), "INVALID_INPUT", "invalid edit email");
  assert.ok(invalidEmail.fieldErrors?.email);
  fails(await action("updateUserProfileAction", [{ userId: member.id, email: admin.email }], adminJar), "EMAIL_CONFLICT", "duplicate edit email");
  const updated = ok(await action("updateUserProfileAction", [{ userId: member.id, email: changedEmail.toUpperCase() }], adminJar), "email edit");
  assert.equal(updated.email, changedEmail);
  const changed = await prisma.user.findUniqueOrThrow({ where: { id: member.id } });
  assert.equal(changed.id, member.id);
  assert.equal(changed.role, member.role);
  assert.equal(changed.departmentId, member.departmentId);
  assert.equal(changed.isActive, member.isActive);
  assert.equal(changed.emailVerifiedAt, null);
  assert.equal(changed.sessionVersion, member.sessionVersion + 1);
  assert.equal((await prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } })).userId, member.id);
  fails(await action("getUnreadNotificationCountAction", [], memberLogin.jar), "UNAUTHENTICATED", "old session");
  assert.match((await login(changedEmail)).response.headers.get("location") ?? "", /dashboard/);
  assert.match((await login(member.email)).response.headers.get("location") ?? "", /error=CredentialsSignin/);
  const racedEmail = `stage7c4a-race-${tag}@example.test`;
  const concurrentEdits = await Promise.all([
    action("updateUserProfileAction", [{ userId: managed.id, email: racedEmail }], adminJar),
    action("updateUserProfileAction", [{ userId: signedUp.id, email: racedEmail }], adminJar),
  ]);
  assert.equal(concurrentEdits.filter((item) => item.success).length, 1);
  assert.equal(concurrentEdits.filter((item) => item.code === "EMAIL_CONFLICT").length, 1);
  assert.equal(await prisma.user.count({ where: { email: racedEmail } }), 1);
  pass("admin email edit validates, normalizes, preserves ownership and invalidates old sessions");
} finally {
  await prisma.reservationDepartmentCorrection.deleteMany({ where: { reservationId: { in: created.reservations } } });
  await prisma.notification.deleteMany({ where: { id: { in: created.notifications } } });
  await prisma.reservation.deleteMany({ where: { id: { in: created.reservations } } });
  await prisma.resource.deleteMany({ where: { id: { in: created.resources } } });
  await prisma.user.deleteMany({ where: { id: { in: created.users } } });
  await prisma.resourceCategory.deleteMany({ where: { id: { in: created.categories } } });
  await prisma.department.deleteMany({ where: { id: { in: created.departments } } });
  await prisma.$disconnect();
}
