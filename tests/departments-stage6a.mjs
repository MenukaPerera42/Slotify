import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hash } from "argon2";
import { groupAdjacentReservations } from "../src/features/reservations/utils/group-adjacent.ts";
import { seedDepartments } from "../prisma/departments.ts";

const prisma = new PrismaClient();
const base = process.env.SLOTIFY_TEST_URL ?? "http://localhost:3000";
const tag = randomBytes(5).toString("hex");
const password = `Test-${randomBytes(18).toString("base64url")}`;
const users = [];
const departments = [];
let categoryId, resourceId;
const pass = (label) => console.log(`PASS ${label}`);
const cookies = (response) => Object.fromEntries(response.headers.getSetCookie().map((line) => line.split(";", 1)[0].split(/=(.*)/s).slice(0, 2)));
const cookieHeader = (jar) => Object.entries(jar).map(([key, value]) => `${key}=${value}`).join("; ");
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
  assert.equal(response.status, 302);
  Object.assign(jar, cookies(response));
  return jar;
}
async function action(name, args = [], jar = {}) {
  const response = await fetch(`${base}/api/reservation-test`, {
    method: "POST", headers: { Origin: base, Cookie: cookieHeader(jar), "Content-Type": "application/json" },
    body: JSON.stringify({ name, args }),
  });
  assert.equal(response.status, 200, `${name}: ${response.status}`);
  return response.json();
}
function success(result) { assert.equal(result.success, true, JSON.stringify(result)); return result.data; }
function failure(result, code) { assert.equal(result.success, false, JSON.stringify(result)); assert.equal(result.code, code); }
function interval(hours, minutes = 60) {
  const start = new Date(Date.now() + hours * 3600_000); start.setUTCMinutes(0, 0, 0);
  return { startTime: start.toISOString(), endTime: new Date(start.valueOf() + minutes * 60_000).toISOString() };
}
const booking = (range, title) => ({ resourceId, title: `${title} ${tag}`, ...range });

try {
  const original = { users: await prisma.user.count(), reservations: await prisma.reservation.count(), notifications: await prisma.notification.count() };
  const beforeSeed = await prisma.department.count();
  await seedDepartments(prisma); await seedDepartments(prisma);
  assert.equal(await prisma.department.count(), beforeSeed);
  pass("department seed is idempotent and existing rows persist");

  categoryId = (await prisma.resourceCategory.create({ data: { name: `Stage6A-${tag}` } })).id;
  resourceId = (await prisma.resource.create({ data: { name: `Stage6A room ${tag}`, location: "Test", categoryId } })).id;
  for (const [suffix, active] of [["A", true], ["B", true], ["C", false]]) {
    const item = await prisma.department.create({ data: { name: `Stage6A ${suffix} ${tag}`, code: `T${suffix}${tag.toUpperCase()}`, isActive: active } });
    departments.push(item.id);
  }
  for (const [name, role, departmentId] of [["member", "MEMBER", departments[0]], ["other", "MEMBER", departments[1]], ["admin", "ADMIN", departments[0]], ["unassigned", "MEMBER", null]]) {
    const user = await prisma.user.create({ data: { name, email: `${name}-${tag}@example.test`, passwordHash: await hash(password), role, departmentId } });
    users.push(user.id);
  }
  const [member, other, admin, unassigned] = await Promise.all([
    login(`member-${tag}@example.test`, "198.51.100.11"), login(`other-${tag}@example.test`, "198.51.100.12"),
    login(`admin-${tag}@example.test`, "198.51.100.13"), login(`unassigned-${tag}@example.test`, "198.51.100.14"),
  ]);

  const publicList = success(await action("listSignupDepartmentsAction"));
  assert.ok(publicList.some((item) => item.id === departments[0]));
  assert.ok(!publicList.some((item) => item.id === departments[2]));
  failure(await action("listDepartmentsAction", [{}], member), "FORBIDDEN");
  failure(await action("createDepartmentAction", [{ name: "Denied", code: "DENIED" }], member), "FORBIDDEN");
  const created = success(await action("createDepartmentAction", [{ name: `Stage6A managed ${tag}`, code: `M${tag.toUpperCase()}` }], admin));
  departments.push(created.id);
  assert.equal(success(await action("updateDepartmentAction", [created.id, { description: "Updated" }], admin)).description, "Updated");
  failure(await action("createDepartmentAction", [{ name: created.name, code: `X${tag.toUpperCase()}` }], admin), "DEPARTMENT_CONFLICT");
  assert.ok(success(await action("listDepartmentsAction", [{ search: tag }], admin)).items.some((item) => item.id === created.id));
  success(await action("setDepartmentStatusAction", [{ id: created.id, isActive: false }], admin));
  failure(await action("assignUserDepartmentAction", [{ userId: users[1], departmentId: created.id }], admin), "DEPARTMENT_INACTIVE");
  success(await action("setDepartmentStatusAction", [{ id: created.id, isActive: true }], admin));
  failure(await action("setDepartmentStatusAction", [{ id: departments[0], isActive: false }], admin), "DEPARTMENT_IN_USE");
  failure(await action("listUsersByDepartmentAction", [{ departmentId: departments[0] }], member), "FORBIDDEN");
  assert.ok(success(await action("listUsersByDepartmentAction", [{ departmentId: departments[0] }], admin)).items.some((item) => item.id === users[0]));
  pass("department CRUD, active list, duplicate handling, and admin authorization");

  assert.equal(success(await action("getMyDepartmentAction", [], member)).department.id, departments[0]);
  assert.equal(success(await action("getMyDepartmentAction", [], unassigned)).assignmentRequired, true);
  failure(await action("createReservationAction", [booking(interval(200), "Unassigned")], unassigned), "DEPARTMENT_REQUIRED");
  failure(await action("createReservationAction", [{ ...booking(interval(200), "Forged"), departmentId: departments[1] }], member), "INVALID_INPUT");
  failure(await action("createReservationAction", [{ ...booking(interval(200), "Forged"), userId: users[1] }], member), "INVALID_INPUT");
  const memberReservation = success(await action("createReservationAction", [booking(interval(200), "Member")], member));
  assert.equal(memberReservation.departmentId, departments[0]);
  assert.equal(memberReservation.userId, users[0]);
  assert.equal(memberReservation.status, "PENDING");
  failure(await action("createReservationAction", [booking(interval(200), "Other conflict")], other), "SLOT_CONFLICT");
  pass("member uses trusted membership and cross-department conflict still blocks");

  failure(await action("createAdminReservationAction", [{ ...booking(interval(201), "Mismatch"), departmentId: departments[0], targetUserId: users[1] }], admin), "DEPARTMENT_MISMATCH");
  failure(await action("createAdminReservationAction", [{ ...booking(interval(201), "Inactive"), departmentId: departments[2] }], admin), "DEPARTMENT_INACTIVE");
  const adminTarget = success(await action("createAdminReservationAction", [{ ...booking(interval(201), "Target"), departmentId: departments[1], targetUserId: users[1] }], admin));
  assert.equal(adminTarget.status, "APPROVED");
  assert.equal(adminTarget.createdByUserId, users[2]);
  assert.equal(adminTarget.userId, users[1]);
  assert.equal(adminTarget.departmentId, departments[1]);
  const departmentOnly = success(await action("createAdminReservationAction", [{ ...booking(interval(202), "Department only"), departmentId: departments[1] }], admin));
  assert.equal(departmentOnly.userId, null);
  assert.equal(departmentOnly.createdByUserId, users[2]);
  assert.equal(departmentOnly.status, "APPROVED");
  const self = success(await action("createReservationAction", [booking(interval(203), "Admin self")], admin));
  assert.equal(self.status, "APPROVED"); assert.equal(self.userId, users[2]);
  failure(await action("createAdminReservationAction", [{ ...booking(interval(200), "Admin conflict"), departmentId: departments[1] }], admin), "SLOT_CONFLICT");
  pass("admin selected, target, department-only, self booking, creator and conflict rules");

  const notificationsBeforeFailed = await prisma.notification.count({ where: { reservationId: { in: [memberReservation.id, adminTarget.id, departmentOnly.id, self.id] } } });
  failure(await action("createAdminReservationAction", [{ ...booking(interval(201), "Failed") , departmentId: departments[1] }], admin), "SLOT_CONFLICT");
  assert.equal(await prisma.notification.count({ where: { reservationId: { in: [memberReservation.id, adminTarget.id, departmentOnly.id, self.id] } } }), notificationsBeforeFailed);
  assert.equal(await prisma.notification.count({ where: { reservationId: departmentOnly.id } }), 0);
  assert.equal(await prisma.notification.count({ where: { reservationId: self.id } }), 0);
  assert.equal(await prisma.notification.count({ where: { reservationId: adminTarget.id, recipientUserId: users[1] } }), 1);
  pass("target notified, department-only and self booking silent, failed booking creates no notification");

  const originalDepartment = memberReservation.departmentId;
  success(await action("assignUserDepartmentAction", [{ userId: users[0], departmentId: departments[1] }], admin));
  assert.equal((await prisma.reservation.findUniqueOrThrow({ where: { id: memberReservation.id } })).departmentId, originalDepartment);
  const reassigned = success(await action("createReservationAction", [booking(interval(204), "Reassigned")], member));
  assert.equal(reassigned.departmentId, departments[1]);
  pass("admin reassignment changes future bookings without rewriting history");

  const start = new Date("2027-03-01T09:00:00Z");
  const rows = [
    { id: "a", resourceId, departmentId: departments[0], status: "PENDING", startTime: start, endTime: new Date(start.valueOf() + 3600_000) },
    { id: "b", resourceId, departmentId: departments[0], status: "PENDING", startTime: new Date(start.valueOf() + 3600_000), endTime: new Date(start.valueOf() + 7200_000) },
    { id: "c", resourceId, departmentId: departments[1], status: "PENDING", startTime: new Date(start.valueOf() + 7200_000), endTime: new Date(start.valueOf() + 10800_000) },
    { id: "d", resourceId, departmentId: departments[0], status: "APPROVED", startTime: new Date(start.valueOf() + 7200_000), endTime: new Date(start.valueOf() + 10800_000) },
    { id: "e", resourceId, departmentId: departments[0], status: "PENDING", startTime: new Date(start.valueOf() + 14400_000), endTime: new Date(start.valueOf() + 18000_000) },
    { id: "f", resourceId, departmentId: departments[0], status: "REJECTED", startTime: start, endTime: new Date(start.valueOf() + 3600_000) },
  ];
  const groups = groupAdjacentReservations(rows);
  assert.ok(groups.some((group) => group.reservationIds.join(",") === "a,b"));
  assert.equal(groups.length, 4);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(memberReservation.startTime));
  const memberGroups = success(await action("getGroupedReservationsForDateAction", [{ date: day, resourceId }], member));
  assert.ok(memberGroups.some((group) => group.reservationIds.includes(memberReservation.id)));
  assert.ok(memberGroups.every((group) => !("bookings" in group)));
  const adminGroups = success(await action("getGroupedReservationsForDateAction", [{ date: day, resourceId }], admin));
  assert.ok(adminGroups.every((group) => group.bookings));
  pass("adjacent grouping preserves IDs, respects department/status/gaps, and member data is limited");

  assert.equal(await prisma.user.count(), original.users + users.length);
  assert.equal(await prisma.reservation.count(), original.reservations + 5);
} finally {
  if (resourceId) {
    const testReservations = await prisma.reservation.findMany({ where: { resourceId }, select: { id: true } });
    await prisma.notification.deleteMany({ where: { reservationId: { in: testReservations.map((item) => item.id) } } });
  }
  if (resourceId) await prisma.reservation.deleteMany({ where: { resourceId } });
  if (resourceId) await prisma.resource.delete({ where: { id: resourceId } });
  if (categoryId) await prisma.resourceCategory.delete({ where: { id: categoryId } });
  if (users.length) await prisma.user.deleteMany({ where: { id: { in: users } } });
  if (departments.length) await prisma.department.deleteMany({ where: { id: { in: departments } } });
  await prisma.$disconnect();
}
