import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hash } from "argon2";

const prisma = new PrismaClient();
const base = process.env.SLOTIFY_TEST_URL ?? "http://localhost:3000";
const tag = randomBytes(5).toString("hex");
const password = `Stage7C-${randomBytes(14).toString("base64url")}`;
const created = { users: [], departments: [], categories: [], resources: [], reservations: [], shifts: [] };
const cookieHeader = (jar) => Object.entries(jar).map(([key, value]) => `${key}=${value}`).join("; ");
const cookies = (response) => Object.fromEntries(response.headers.getSetCookie().map((line) => line.split(";", 1)[0].split(/=(.*)/s).slice(0, 2)));
const pass = (message) => console.log(`PASS ${message}`);
async function verifyDisposableDatabase() {
  const expectedDatabase = process.env.SLOTIFY_DISPOSABLE_DB_NAME;
  const expectedMarker = process.env.SLOTIFY_DISPOSABLE_DB_MARKER;
  assert.match(expectedDatabase ?? "", /^slotify_stage8a1_[a-f0-9]{12}$/,
    "Office-shift mutations require the disposable database runner");
  assert.match(expectedMarker ?? "", /^slotify-stage8a1:[a-f0-9]{32}$/);
  const rows = await prisma.$queryRaw`
    SELECT current_database() AS database, shobj_description(oid, 'pg_database') AS marker
    FROM pg_database WHERE datname = current_database()`;
  assert.equal(rows[0]?.database, expectedDatabase, "Prisma is not connected to the disposable database");
  assert.equal(rows[0]?.marker, expectedMarker, "Disposable database marker mismatch");
  const response = await fetch(`${base}/api/reservation-test`);
  assert.equal(response.status, 200, "Test server database identity endpoint unavailable");
  assert.deepEqual(await response.json(), rows[0], "Test server uses a different database");
  pass("direct Prisma and test server targets match the marked disposable database");
}
function ok(result, label) {
  assert.equal(result.success, true, `${label}: ${JSON.stringify(result)}`);
  return result.data;
}
function failed(result, code) {
  assert.equal(result.success, false, JSON.stringify(result));
  assert.equal(result.code, code, JSON.stringify(result));
  return result;
}
async function action(name, args = [], jar = {}) {
  const response = await fetch(`${base}/api/reservation-test`, {
    method: "POST", headers: { Origin: base, Cookie: cookieHeader(jar), "Content-Type": "application/json" },
    body: JSON.stringify({ name, args }),
  });
  assert.equal(response.status, 200, `${name}: HTTP ${response.status}`);
  return response.json();
}
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
  assert.equal(response.status, 302, `Login failed: ${response.headers.get("location")}`);
  Object.assign(jar, cookies(response));
  return jar;
}
async function makeShift(adminJar, name, mode, startMinute, durationMinutes) {
  const shift = ok(await action("createOfficeShiftAction", [{
    name: `${name} ${tag}`, mode, startMinute, durationMinutes, description: `${name} test definition`,
  }], adminJar), `create ${name}`);
  created.shifts.push(shift.id);
  assert.equal(shift.isActive, false);
  return shift;
}
async function activate(adminJar, shiftId) {
  const preview = ok(await action("previewOfficeShiftActivationAction", [shiftId], adminJar), "preview");
  if (preview.conflictCount) {
    const blocked = failed(await action("activateOfficeShiftAction", [{ shiftId }], adminJar), "IMPACT_CONFIRMATION_REQUIRED");
    assert.equal(blocked.impact.impactToken, preview.impactToken);
  }
  return ok(await action("activateOfficeShiftAction", [{
    shiftId, ...(preview.conflictCount ? { confirmImpactToken: preview.impactToken } : {}),
  }], adminJar), "activate");
}

await verifyDisposableDatabase();
try {
  const baseline = {
    users: await prisma.user.count(), departments: await prisma.department.count(),
    reservations: await prisma.reservation.count(), notifications: await prisma.notification.count(),
  };
  assert.equal(await prisma.officeShift.count({ where: { isActive: true } }), 0,
    "Test needs an unconfigured local scheduler; never replace a real active policy");
  const deptA = await prisma.department.create({ data: { name: `Shift A ${tag}`, code: `SA${tag.toUpperCase()}` } });
  const deptB = await prisma.department.create({ data: { name: `Shift B ${tag}`, code: `SB${tag.toUpperCase()}` } });
  created.departments.push(deptA.id, deptB.id);
  const category = await prisma.resourceCategory.create({ data: { name: `Shift Cat ${tag}` } });
  created.categories.push(category.id);
  const resource = await prisma.resource.create({ data: { name: `Shift Room ${tag}`, location: "Test", categoryId: category.id } });
  created.resources.push(resource.id);
  const passwordHash = await hash(password);
  const admin = await prisma.user.create({ data: { name: `Shift Admin ${tag}`, email: `shift-admin-${tag}@test.local`,
    passwordHash, role: "ADMIN", departmentId: deptA.id } });
  const member = await prisma.user.create({ data: { name: `Shift Member ${tag}`, email: `shift-member-${tag}@test.local`,
    passwordHash, departmentId: deptA.id } });
  created.users.push(admin.id, member.id);
  const adminJar = await login(admin.email, "198.18.21.1");
  const memberJar = await login(member.email, "198.18.21.2");
  const year = new Date().getUTCFullYear() + 1;
  const morningDate = `${year}-10-28`;
  const eveningDate = `${year}-11-01`;
  const nightDate = `${year}-12-31`;
  const nextYear = year + 1;
  const fullDate = `${nextYear}-01-02`;

  const fallback = ok(await action("getEffectiveSchedulingHoursAction", [{ date: morningDate }], memberJar), "fallback hours");
  assert.equal(fallback.enforced, false);
  assert.equal(fallback.startMinute, 540);
  assert.equal(fallback.durationMinutes, 540);
  assert.equal(fallback.timeZone, "Asia/Colombo");
  failed(await action("createOfficeShiftAction", [{
    name: `Denied ${tag}`, mode: "MORNING", startMinute: 480, durationMinutes: 480,
  }], memberJar), "FORBIDDEN");
  failed(await action("createOfficeShiftAction", [{
    name: `Invalid ${tag}`, mode: "FULL_DAY", startMinute: 0, durationMinutes: 0,
  }], adminJar), "INVALID_INPUT");
  const morning = await makeShift(adminJar, "Morning", "MORNING", 480, 480);
  const evening = await makeShift(adminJar, "Evening", "EVENING", 960, 480);
  const night = await makeShift(adminJar, "Night", "NIGHT", 1320, 480);
  const fullDay = await makeShift(adminJar, "Full Day", "FULL_DAY", 0, 1440);
  const config = ok(await action("getOfficeSchedulingConfigurationAction", [], adminJar), "configuration");
  assert.equal(config.shifts.length, 4);
  assert.equal(config.activeShiftId, null);
  failed(await action("previewOfficeShiftActivationAction", ["00000000-0000-4000-8000-000000000000"], adminJar), "SHIFT_NOT_FOUND");
  const updatedNight = ok(await action("updateOfficeShiftAction", [{
    id: night.id, name: night.name, mode: "NIGHT", startMinute: 1320, durationMinutes: 480,
    description: "Reviewed night window",
  }], adminJar), "update inactive");
  assert.equal(updatedNight.description, "Reviewed night window");
  pass("admin definitions, fallback, validation and member write denial");

  await activate(adminJar, morning.id);
  assert.equal(await prisma.officeShift.count({ where: { isActive: true } }), 1);
  failed(await action("updateOfficeShiftAction", [{
    id: morning.id, name: morning.name, mode: "MORNING", startMinute: 480, durationMinutes: 540,
  }], adminJar), "ACTIVE_SHIFT_IMMUTABLE");
  const morningWindow = ok(await action("getEffectiveSchedulingHoursAction", [{ date: morningDate, resourceId: resource.id }], memberJar), "morning window");
  assert.equal(morningWindow.startMinute, 480);
  assert.equal(morningWindow.endMinute, 960);
  assert.equal(morningWindow.durationMinutes, 480);
  assert.equal(morningWindow.endDayOffset, 0);
  assert.equal(morningWindow.enforced, true);
  const morningBooking = ok(await action("createReservationAction", [{
    resourceId: resource.id, title: `Morning ${tag}`,
    startTime: `${morningDate}T09:00:00+05:30`, endTime: `${morningDate}T10:00:00+05:30`,
  }], memberJar), "morning booking");
  created.reservations.push(morningBooking.id);
  failed(await action("createReservationAction", [{
    resourceId: resource.id, title: "Too early",
    startTime: `${morningDate}T07:00:00+05:30`, endTime: `${morningDate}T08:00:00+05:30`,
  }], memberJar), "SHIFT_OUTSIDE_WINDOW");
  const approved = ok(await action("createAdminReservationAction", [{
    resourceId: resource.id, departmentId: deptA.id, title: `Approved Morning ${tag}`,
    startTime: `${morningDate}T10:00:00+05:30`, endTime: `${morningDate}T11:00:00+05:30`,
  }], adminJar), "approved morning");
  created.reservations.push(approved.id);
  failed(await action("createAdminReservationAction", [{
    resourceId: resource.id, departmentId: deptB.id, title: "Cross-department conflict",
    startTime: `${morningDate}T10:00:00+05:30`, endTime: `${morningDate}T11:00:00+05:30`,
  }], adminJar), "SLOT_CONFLICT");
  const storedMorning = await prisma.reservation.findUniqueOrThrow({ where: { id: morningBooking.id } });
  const storedApproved = await prisma.reservation.findUniqueOrThrow({ where: { id: approved.id } });
  const usageBefore = ok(await action("getMonthlyUsageAction", [{ year, month: 10 }], adminJar), "usage before");
  pass("morning bookings enforce boundaries, allow adjacency, and retain cross-department conflict protection");

  const eveningImpact = ok(await action("previewOfficeShiftActivationAction", [evening.id], adminJar), "evening impact");
  assert.ok(eveningImpact.conflicts.some((item) => item.id === morningBooking.id));
  failed(await action("activateOfficeShiftAction", [{ shiftId: evening.id, confirmImpactToken: "0".repeat(64) }], adminJar),
    "STALE_IMPACT_PREVIEW");
  await activate(adminJar, evening.id);
  assert.equal(await prisma.officeShift.count({ where: { isActive: true } }), 1);
  const unchangedMorning = await prisma.reservation.findUniqueOrThrow({ where: { id: morningBooking.id } });
  const unchangedApproved = await prisma.reservation.findUniqueOrThrow({ where: { id: approved.id } });
  for (const [before, after] of [[storedMorning, unchangedMorning], [storedApproved, unchangedApproved]]) {
    for (const key of ["id", "userId", "departmentId", "status"]) assert.equal(after[key], before[key]);
    for (const key of ["startTime", "endTime", "createdAt", "updatedAt"]) assert.equal(after[key].getTime(), before[key].getTime());
  }
  const oldDay = ok(await action("getEffectiveSchedulingHoursAction", [{ date: morningDate, resourceId: resource.id }], adminJar), "old day visibility");
  assert.ok(oldDay.outsideWindowOccupancy.some((item) => item.id === morningBooking.id));
  const usageAfter = ok(await action("getMonthlyUsageAction", [{ year, month: 10 }], adminJar), "usage after");
  assert.equal(usageAfter.totalBookedHours, usageBefore.totalBookedHours);
  const eveningWindow = ok(await action("getEffectiveSchedulingHoursAction", [{ date: eveningDate }], memberJar), "evening window");
  assert.equal(eveningWindow.endDayOffset, 1);
  assert.equal(eveningWindow.endMinute, 0);
  assert.equal(eveningWindow.endsNextDay, true);
  assert.equal(eveningWindow.crossesMidnight, false);
  const eveningBooking = ok(await action("createReservationAction", [{
    resourceId: resource.id, title: `Evening ${tag}`,
    startTime: `${eveningDate}T23:00:00+05:30`, endTime: `${year}-11-02T00:00:00+05:30`,
  }], memberJar), "evening until midnight");
  created.reservations.push(eveningBooking.id);
  failed(await action("createReservationAction", [{
    resourceId: resource.id, title: "After midnight",
    startTime: `${year}-11-02T00:00:00+05:30`, endTime: `${year}-11-02T00:30:00+05:30`,
  }], memberJar), "SHIFT_OUTSIDE_WINDOW");
  pass("activation warns and confirms without changing stored bookings or analytics; evening ends at midnight");

  await activate(adminJar, night.id);
  assert.equal(await prisma.officeShift.count({ where: { isActive: true } }), 1);
  const nightWindow = ok(await action("getEffectiveSchedulingHoursAction", [{ date: nightDate, resourceId: resource.id }], adminJar), "night window");
  assert.equal(nightWindow.crossesMidnight, true);
  assert.equal(nightWindow.endDayOffset, 1);
  assert.equal(nightWindow.endMinute, 360);
  assert.equal(nightWindow.durationMinutes, 480);
  assert.equal(new Date(nightWindow.endTime).toISOString().slice(0, 10), `${nextYear}-01-01`);
  const nightBooking = ok(await action("createReservationAction", [{
    resourceId: resource.id, title: `New Year Night ${tag}`,
    startTime: `${nightDate}T23:30:00+05:30`, endTime: `${nextYear}-01-01T00:30:00+05:30`,
  }], memberJar), "cross-year night booking");
  created.reservations.push(nightBooking.id);
  const adjacent = ok(await action("createReservationAction", [{
    resourceId: resource.id, title: `Adjacent Night ${tag}`,
    startTime: `${nextYear}-01-01T00:30:00+05:30`, endTime: `${nextYear}-01-01T01:00:00+05:30`,
  }], memberJar), "adjacent night booking");
  created.reservations.push(adjacent.id);
  const nightOccupancy = ok(await action("getEffectiveSchedulingHoursAction", [{ date: nightDate, resourceId: resource.id }], adminJar), "night occupancy");
  assert.equal(nightOccupancy.occupancy.filter((item) => item.id === nightBooking.id).length, 1);
  assert.ok(nightOccupancy.occupancy.some((item) => item.id === adjacent.id));
  const privateNight = ok(await action("getEffectiveSchedulingHoursAction", [{ date: nightDate, resourceId: resource.id }], memberJar), "private night occupancy");
  assert.ok(privateNight.occupancy.every((item) => !("title" in item) && !("userId" in item)));
  failed(await action("createReservationAction", [{
    resourceId: resource.id, title: "After night",
    startTime: `${nextYear}-01-01T06:00:00+05:30`, endTime: `${nextYear}-01-01T06:30:00+05:30`,
  }], memberJar), "SHIFT_OUTSIDE_WINDOW");
  pass("night operational date includes next-morning continuation across year rollover");

  failed(await action("enableFullDaySchedulingAction", [{ shiftId: night.id }], adminJar), "FULL_DAY_SHIFT_REQUIRED");
  const fullImpact = ok(await action("previewOfficeShiftActivationAction", [fullDay.id], adminJar), "full-day preview");
  const fullActivation = ok(await action("enableFullDaySchedulingAction", [{
    shiftId: fullDay.id, ...(fullImpact.conflictCount ? { confirmImpactToken: fullImpact.impactToken } : {}),
  }], adminJar), "full-day activation");
  assert.equal(fullActivation.active.mode, "FULL_DAY");
  assert.equal(await prisma.officeShift.count({ where: { isActive: true } }), 1);
  const fullWindow = ok(await action("getEffectiveSchedulingHoursAction", [{ date: fullDate }], memberJar), "24-hour window");
  assert.equal(fullWindow.durationMinutes, 1440);
  assert.equal(fullWindow.endDayOffset, 1);
  assert.equal(fullWindow.endMinute, 0);
  const fullSlot = { resourceId: resource.id, title: `Early Full Day ${tag}`,
    startTime: `${fullDate}T02:00:00+05:30`, endTime: `${fullDate}T03:00:00+05:30` };
  const concurrent = await Promise.all([
    action("createReservationAction", [fullSlot], memberJar),
    action("createAdminReservationAction", [{ ...fullSlot, departmentId: deptB.id }], adminJar),
  ]);
  assert.equal(concurrent.filter((result) => result.success).length, 1);
  failed(concurrent.find((result) => !result.success), "SLOT_CONFLICT");
  created.reservations.push(concurrent.find((result) => result.success).data.id);
  assert.equal(await prisma.reservation.count({ where: { resourceId: resource.id, startTime: new Date(fullSlot.startTime) } }), 1);
  const midnightFullDay = ok(await action("createReservationAction", [{
    resourceId: resource.id, title: `Full Day Midnight ${tag}`,
    startTime: `${fullDate}T23:30:00+05:30`, endTime: `${nextYear}-01-03T00:30:00+05:30`,
  }], memberJar), "full-day midnight booking");
  created.reservations.push(midnightFullDay.id);
  const fullDayOccupancy = ok(await action("getEffectiveSchedulingHoursAction", [{ date: fullDate, resourceId: resource.id }], adminJar), "full-day occupancy");
  assert.equal(fullDayOccupancy.occupancy.filter((item) => item.id === midnightFullDay.id).length, 1);
  pass("24-hour operation allows early bookings and concurrent cross-department requests still have one winner");

  assert.equal(await prisma.user.count(), baseline.users + 2);
  assert.equal(await prisma.department.count(), baseline.departments + 2);
  assert.equal(await prisma.reservation.count(), baseline.reservations + created.reservations.length);
  pass("only isolated records were added; existing reservation history remains intact");
  const transitionSlot = {
    resourceId: resource.id, userId: member.id, createdByUserId: admin.id, departmentId: deptA.id,
    title: `Transition ${tag}`, startTime: new Date(`${fullDate}T04:00:00+05:30`),
    endTime: new Date(`${fullDate}T04:30:00+05:30`),
  };
  const rejected = await prisma.reservation.create({ data: { ...transitionSlot, status: "PENDING" } });
  await prisma.reservation.update({ where: { id: rejected.id }, data: { status: "REJECTED" } });
  const approvedAfterRejection = await prisma.reservation.create({ data: { ...transitionSlot, status: "APPROVED" } });
  await assert.rejects(prisma.reservation.update({ where: { id: approvedAfterRejection.id }, data: { status: "PENDING" } }));
  assert.equal((await prisma.reservation.findUniqueOrThrow({ where: { id: approvedAfterRejection.id } })).status, "APPROVED");
  pass("database status trigger rejects reverse transition; rejected history does not block the slot");
} finally {
  // This suite is restricted to a freshly marked database. The runner drops the
  // entire database after the test; record-level deletion would violate the
  // "last active admin" trigger and is unnecessary for disposable data.
  await prisma.$disconnect();
}
