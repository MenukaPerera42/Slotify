import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hash, verify } from "argon2";

const prisma = new PrismaClient();
const base = process.env.SLOTIFY_TEST_URL ?? "http://localhost:3000";
const tag = randomBytes(6).toString("hex");
const password = `Stage7A-${randomBytes(16).toString("base64url")}`;
const created = { users: [], departments: [], resources: [], categories: [], reservations: [] };
const pass = (message) => console.log(`PASS ${message}`);
const cookieHeader = (jar) => Object.entries(jar).map(([key, value]) => `${key}=${value}`).join("; ");
const cookies = (response) => Object.fromEntries(response.headers.getSetCookie().map((line) => line.split(";", 1)[0].split(/=(.*)/s).slice(0, 2)));

async function login(email, address) {
  const jar = {};
  const csrf = await fetch(`${base}/api/auth/csrf`, { headers: { "x-forwarded-for": address } });
  Object.assign(jar, cookies(csrf));
  const { csrfToken } = await csrf.json();
  const response = await fetch(`${base}/api/auth/callback/credentials`, {
    method: "POST", redirect: "manual",
    headers: { Cookie: cookieHeader(jar), "Content-Type": "application/x-www-form-urlencoded", "x-forwarded-for": address },
    body: new URLSearchParams({ csrfToken, email, password, callbackUrl: `${base}/dashboard` }),
  });
  assert.equal(response.status, 302, `Login failed for ${email}: ${response.headers.get("location")}`);
  Object.assign(jar, cookies(response));
  return jar;
}
async function action(name, args = [], jar = {}) {
  const response = await fetch(`${base}/api/reservation-test`, {
    method: "POST", headers: { Origin: base, Cookie: cookieHeader(jar), "Content-Type": "application/json" },
    body: JSON.stringify({ name, args }),
  });
  assert.equal(response.status, 200, `${name}: HTTP ${response.status}`);
  return response.json();
}
function ok(result, label) {
  assert.equal(result.success, true, `${label}: ${JSON.stringify(result)}`);
  return result.data;
}
function errorCode(result, code) {
  assert.equal(result.success, false, JSON.stringify(result));
  assert.equal(result.code, code, JSON.stringify(result));
}
async function codeFor(challengeId) {
  const challenge = await prisma.emailVerificationChallenge.findUniqueOrThrow({ where: { id: challengeId } });
  const digest = createHmac("sha256", process.env.AUTH_SECRET)
    .update(`slotify-mock-otp:${challenge.id}:${challenge.resendCount}`).digest("hex");
  return (BigInt(`0x${digest}`) % BigInt(1_000_000)).toString().padStart(6, "0");
}

try {
  const baseline = {
    users: await prisma.user.count(), reservations: await prisma.reservation.count(),
    corrections: await prisma.reservationDepartmentCorrection.count(),
  };
  const legacy = await prisma.user.findFirst({ where: { firstName: null, lastName: null }, select: { id: true, name: true } });
  const unassignedBefore = await prisma.reservation.count({ where: { departmentId: null } });
  assert.ok(legacy, "Expected one preserved legacy account");
  assert.ok(unassignedBefore > 0, "Expected preserved historical unassigned reservations");
  const departmentA = await prisma.department.create({ data: { name: `Stage7A A ${tag}`, code: `A${tag.toUpperCase()}` } });
  const departmentB = await prisma.department.create({ data: { name: `Stage7A B ${tag}`, code: `B${tag.toUpperCase()}` } });
  created.departments.push(departmentA.id, departmentB.id);
  const category = await prisma.resourceCategory.create({ data: { name: `Stage7A Category ${tag}` } });
  created.categories.push(category.id);
  const resource = await prisma.resource.create({ data: { name: `Stage7A Room ${tag}`, location: "Test", categoryId: category.id } });
  created.resources.push(resource.id);
  const admin = await prisma.user.create({ data: {
    name: `Stage7A Admin ${tag}`, email: `stage7a-admin-${tag}@test.local`,
    passwordHash: await hash(password), role: "ADMIN", departmentId: departmentA.id,
  } });
  created.users.push(admin.id);
  const member = await prisma.user.create({ data: {
    name: `Stage7A Member ${tag}`, email: `stage7a-member-${tag}@test.local`,
    passwordHash: await hash(password), departmentId: departmentA.id,
  } });
  created.users.push(member.id);
  const adminJar = await login(admin.email, `198.18.1.${randomBytes(1)[0] || 1}`);
  const memberJar = await login(member.email, `198.18.2.${randomBytes(1)[0] || 1}`);

  errorCode(await action("listManagedUsersAction", [{}], memberJar), "FORBIDDEN");
  errorCode(await action("createMemberAction", [{ firstName: "Denied", lastName: "Person", email: `denied-${tag}@test.local`,
    departmentId: departmentA.id, initialPassword: password }], memberJar), "FORBIDDEN");
  errorCode(await action("listUnassignedReservationsAction", [{}], memberJar), "FORBIDDEN");
  pass("member cannot call admin user or correction discovery actions");

  const legacyDetail = ok(await action("getManagedUserAction", [legacy.id], adminJar), "legacy detail");
  assert.equal(legacyDetail.displayName, legacy.name);
  assert.equal(legacyDetail.firstName, null);
  assert.equal(legacyDetail.lastName, null);
  const legacyList = ok(await action("listManagedUsersAction", [{ search: legacy.name, page: 1, pageSize: 10 }], adminJar), "legacy list");
  assert.ok(legacyList.items.some((row) => row.id === legacy.id));
  assert.ok(!JSON.stringify(legacyList).includes("passwordHash"));
  pass("legacy names remain readable without guessed first/last names");

  const managedEmail = `stage7a-created-${tag}@test.local`;
  const newMember = ok(await action("createMemberAction", [{
    firstName: "Ada", lastName: "Lovelace", email: managedEmail,
    departmentId: departmentA.id, initialPassword: password,
  }], adminJar), "create member");
  created.users.push(newMember.id);
  assert.equal(newMember.displayName, "Ada Lovelace");
  assert.equal(newMember.role, "MEMBER");
  assert.ok(!JSON.stringify(newMember).includes("passwordHash"));
  const storedMember = await prisma.user.findUniqueOrThrow({ where: { id: newMember.id } });
  assert.ok(storedMember.passwordHash.startsWith("$argon2id$"));
  assert.notEqual(storedMember.passwordHash, password);
  assert.equal(await verify(storedMember.passwordHash, password), true);
  assert.equal(storedMember.emailVerifiedAt, null);
  const registrationChallenge = await prisma.emailVerificationChallenge.findFirstOrThrow({ where: { userId: newMember.id, purpose: "REGISTRATION", consumedAt: null } });
  ok(await action("verifyRegistrationOtpAction", [{ challengeId: registrationChallenge.id, code: await codeFor(registrationChallenge.id) }]));
  await login(managedEmail, `198.18.3.${randomBytes(1)[0] || 1}`);
  errorCode(await action("createMemberAction", [{
    firstName: "Duplicate", lastName: "Person", email: managedEmail.toUpperCase(),
    departmentId: departmentA.id, initialPassword: password,
  }], adminJar), "EMAIL_CONFLICT");
  pass("admin creates a member with Argon2id and duplicate-email protection");

  const changedEmail = `stage7a-renamed-${tag}@test.local`;
  errorCode(await action("updateUserProfileAction", [{ userId: newMember.id, email: changedEmail }], adminJar), "EMAIL_VERIFICATION_REQUIRED");
  const updated = ok(await action("updateUserProfileAction", [{
    userId: newMember.id, firstName: "Grace", lastName: "Hopper",
  }], adminJar), "update profile");
  assert.equal(updated.displayName, "Grace Hopper");
  assert.equal(updated.name, "Grace Hopper");
  assert.equal(updated.email, managedEmail);
  const pendingEmailChange = ok(await action("requestAdminEmailChangeAction", [{ userId: newMember.id, newEmail: changedEmail }], adminJar));
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: newMember.id } })).email, managedEmail);
  ok(await action("verifyPendingEmailChangeAction", [{ challengeId: pendingEmailChange.challengeId, code: await codeFor(pendingEmailChange.challengeId) }]));
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: newMember.id } })).email, changedEmail);
  const changedJar = await login(changedEmail, `198.18.3.${randomBytes(1)[0] || 1}`);
  assert.equal(ok(await action("getMyDepartmentAction", [], changedJar), "session after email edit").department.id, departmentA.id);
  errorCode(await action("requestAdminEmailChangeAction", [{ userId: newMember.id, newEmail: member.email }], adminJar), "EMAIL_IN_USE");
  errorCode(await action("updateUserProfileAction", [{ userId: legacy.id, firstName: "Unsafe" }], adminJar), "NAME_PAIR_REQUIRED");
  ok(await action("assignUserDepartmentAction", [{ userId: newMember.id, departmentId: departmentB.id }], adminJar), "assign department");
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: newMember.id } })).departmentId, departmentB.id);
  errorCode(await action("setUserRoleAction", [{ userId: newMember.id, role: "ADMIN" }], memberJar), "FORBIDDEN");
  assert.equal(ok(await action("setUserRoleAction", [{ userId: newMember.id, role: "ADMIN" }], adminJar), "promote").role, "ADMIN");
  assert.equal(ok(await action("setUserRoleAction", [{ userId: newMember.id, role: "MEMBER" }], adminJar), "demote").role, "MEMBER");
  errorCode(await action("setUserRoleAction", [{ userId: admin.id, role: "MEMBER" }], adminJar), "SELF_ROLE_CHANGE");
  errorCode(await action("setUserActiveAction", [{ userId: admin.id, isActive: false }], adminJar), "SELF_DEACTIVATION");
  assert.equal(ok(await action("setUserActiveAction", [{ userId: newMember.id, isActive: false }], adminJar), "deactivate").isActive, false);
  assert.equal(ok(await action("setUserActiveAction", [{ userId: newMember.id, isActive: true }], adminJar), "reactivate").isActive, true);
  pass("profile, department, role and active status updates honor authorization and legacy constraints");

  const unassigned = ok(await action("listUnassignedReservationsAction", [{ page: 1, pageSize: 100 }], adminJar), "unassigned");
  assert.equal(unassigned.total, unassignedBefore);
  assert.ok(unassigned.items.every((item) => item.departmentId === undefined));
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 14);
  const day = date.toISOString().slice(0, 10);
  const hours = ok(await action("getEffectiveSchedulingHoursAction", [{ date: day, resourceId: resource.id }], memberJar), "booking hours");
  assert.ok(hours.durationMinutes >= 120, "Admin test requires a two-hour active booking window");
  const localMidnight = Date.parse(`${day}T00:00:00+05:30`);
  const atMinute = (minute) => new Date(localMidnight + minute * 60_000).toISOString();
  const slot = { startTime: atMinute(hours.startMinute), endTime: atMinute(hours.startMinute + 60) };
  const booking = ok(await action("createReservationAction", [{ resourceId: resource.id, title: `Stage7A Booking ${tag}`, ...slot }], memberJar), "member booking");
  created.reservations.push(booking.id);
  assert.equal(booking.departmentId, departmentA.id);
  // Simulate a pre-Stage-6A legacy row using only this isolated test booking.
  await prisma.$executeRaw`UPDATE reservations SET "departmentId" = NULL WHERE id = ${booking.id}::uuid`;
  const legacyBooking = ok(await action("listUnassignedReservationsAction", [{ page: 1, pageSize: 100 }], adminJar), "legacy queue");
  assert.equal(legacyBooking.total, unassignedBefore + 1);
  assert.ok(legacyBooking.items.some((item) => item.id === booking.id));
  errorCode(await action("correctReservationDepartmentAction", [{
    reservationId: booking.id, expectedDepartmentId: null, departmentId: departmentB.id,
    reason: "Reviewed historical allocation", 
  }], memberJar), "FORBIDDEN");
  const before = await prisma.reservation.findUniqueOrThrow({ where: { id: booking.id } });
  const correction = ok(await action("correctReservationDepartmentAction", [{
    reservationId: booking.id, expectedDepartmentId: null, departmentId: departmentB.id,
    reason: "Reviewed historical allocation",
  }], adminJar), "correct department");
  assert.equal(correction.reservation.departmentId, departmentB.id);
  assert.equal(correction.correction.previousDepartmentId, null);
  assert.equal(correction.correction.correctedByUserId, admin.id);
  const after = await prisma.reservation.findUniqueOrThrow({ where: { id: booking.id } });
  for (const key of ["id", "userId", "createdByUserId", "status"]) assert.equal(after[key], before[key]);
  for (const key of ["startTime", "endTime", "createdAt", "updatedAt"]) assert.equal(after[key].getTime(), before[key].getTime());
  const audit = ok(await action("listReservationDepartmentCorrectionsAction", [booking.id], adminJar), "correction audit");
  assert.equal(audit.length, 1);
  errorCode(await action("correctReservationDepartmentAction", [{
    reservationId: booking.id, expectedDepartmentId: null, departmentId: departmentB.id,
    reason: "Stale review must fail",
  }], adminJar), "STALE_DEPARTMENT");
  errorCode(await action("correctReservationDepartmentAction", [{
    reservationId: booking.id, expectedDepartmentId: departmentB.id, departmentId: departmentB.id,
    reason: "Unchanged review must fail",
  }], adminJar), "DEPARTMENT_UNCHANGED");
  const departmentOnly = ok(await action("createAdminReservationAction", [{
    resourceId: resource.id, departmentId: departmentA.id, title: `Stage7A Department Only ${tag}`,
    startTime: atMinute(hours.startMinute + 60), endTime: atMinute(hours.startMinute + 120),
  }], adminJar), "department-only booking");
  created.reservations.push(departmentOnly.id);
  assert.equal(departmentOnly.userId, null);
  await prisma.$executeRaw`UPDATE reservations SET "departmentId" = NULL WHERE id = ${departmentOnly.id}::uuid`;
  const departmentOnlyCorrection = ok(await action("correctReservationDepartmentAction", [{
    reservationId: departmentOnly.id, expectedDepartmentId: null, departmentId: departmentB.id,
    reason: "Reviewed department-only allocation",
  }], adminJar), "department-only correction");
  assert.equal(departmentOnlyCorrection.reservation.userId, null);
  assert.equal(departmentOnlyCorrection.reservation.departmentId, departmentB.id);
  pass("reviewed correction changes only department metadata and writes an audit event");

  const persisted = ok(await action("getReservationAction", [booking.id], memberJar), "persisted reservation");
  assert.equal(persisted.departmentId, departmentB.id);
  const grouped = ok(await action("getGroupedReservationsForDateAction", [{ date: day, resourceId: resource.id }], adminJar), "grouped timeline");
  assert.equal(grouped.flatMap((group) => group.reservationIds).filter((id) => id === booking.id).length, 1);
  assert.equal(grouped.flatMap((group) => group.bookings).filter((item) => item.id === booking.id).length, 1);
  const summary = ok(await action("getReservationSummaryAction", [], memberJar), "dashboard summary");
  assert.equal(summary.totalBookings, await prisma.reservation.count({ where: { userId: member.id } }));
  errorCode(await action("createReservationAction", [{ resourceId: resource.id, title: "Conflict", ...slot }], memberJar), "SLOT_CONFLICT");
  const unread = ok(await action("getUnreadNotificationCountAction", [], memberJar), "unread count");
  assert.equal(typeof unread, "number");
  pass("booking, timeline, dashboard and notification data come from PostgreSQL; conflict protection holds");

  assert.equal(await prisma.user.count(), baseline.users + created.users.length);
  assert.equal(await prisma.reservation.count(), baseline.reservations + 2);
  assert.equal(await prisma.reservationDepartmentCorrection.count(), baseline.corrections + 2);
  pass("isolated test records are the only database additions");
} finally {
  await prisma.reservationDepartmentCorrection.deleteMany({ where: { reservationId: { in: created.reservations } } });
  await prisma.notification.deleteMany({ where: { OR: [
    { reservationId: { in: created.reservations } },
    { recipientUserId: { in: created.users } },
    { actorUserId: { in: created.users } },
  ] } });
  await prisma.reservation.deleteMany({ where: { id: { in: created.reservations } } });
  await prisma.resource.deleteMany({ where: { id: { in: created.resources } } });
  await prisma.user.deleteMany({ where: { id: { in: created.users } } });
  await prisma.resourceCategory.deleteMany({ where: { id: { in: created.categories } } });
  await prisma.department.deleteMany({ where: { id: { in: created.departments } } });
  await prisma.$disconnect();
}
