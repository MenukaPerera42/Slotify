import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hash } from "argon2";
import { monthDays, clippedMilliseconds } from "../src/features/dashboard/utils/reporting-period.ts";

const prisma = new PrismaClient();
const base = process.env.SLOTIFY_TEST_URL ?? "http://localhost:3000";
const tag = randomBytes(5).toString("hex");
const password = `Test-${randomBytes(18).toString("base64url")}`;
const userIds = [], departmentIds = [], resourceIds = [];
let categoryId;
let original;
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
  const body = await response.text();
  assert.equal(response.status, 200, `${name}: ${response.status} ${body.slice(0, 300)}`);
  return JSON.parse(body);
}
function success(result) { assert.equal(result.success, true, JSON.stringify(result)); return result.data; }
function failure(result, code) { assert.equal(result.success, false, JSON.stringify(result)); assert.equal(result.code, code); }
const instant = (date, time) => new Date(`${date}T${time}:00+05:30`);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} !== ${expected}`);

try {
  original = { users: await prisma.user.count(), reservations: await prisma.reservation.count(), notifications: await prisma.notification.count(), resources: await prisma.resource.count(), departments: await prisma.department.count() };
  assert.equal(monthDays({ year: 2028, month: 2 }).length, 29);
  assert.equal(monthDays({ year: 2027, month: 2 }).length, 28);
  assert.equal(monthDays({ year: 2032, month: 2 })[0].start.toISOString(), "2032-01-31T18:30:00.000Z");
  assert.equal(monthDays({ year: 2032, month: 2 }).at(-1).end.toISOString(), "2032-02-29T18:30:00.000Z");
  assert.equal(clippedMilliseconds(instant("2032-02-29", "23:30"), instant("2032-03-01", "01:30"),
    monthDays({ year: 2032, month: 2 }).at(-1).start, monthDays({ year: 2032, month: 2 }).at(-1).end), 1_800_000);
  pass("Colombo month boundaries, leap years, midnight, and clipping");

  for (const suffix of ["A", "B"]) {
    const department = await prisma.department.create({ data: { name: `Stage6C ${suffix} ${tag}`, code: `C${suffix}${tag.toUpperCase()}` } });
    departmentIds.push(department.id);
  }
  categoryId = (await prisma.resourceCategory.create({ data: { name: `Stage6C ${tag}` } })).id;
  for (const [name, isActive] of [["Room one", true], ["Room two", true], ["Inactive", false]]) {
    const resource = await prisma.resource.create({ data: { name: `${name} ${tag}`, location: "Test", categoryId, isActive } });
    resourceIds.push(resource.id);
  }
  for (const [name, role, departmentId] of [["member", "MEMBER", departmentIds[0]], ["other", "MEMBER", departmentIds[1]], ["zero", "MEMBER", departmentIds[0]], ["admin", "ADMIN", departmentIds[0]]]) {
    const user = await prisma.user.create({ data: { name, email: `${name}-${tag}@example.test`, role, departmentId, passwordHash: await hash(password) } });
    userIds.push(user.id);
  }
  const [member, other, zero, admin] = await Promise.all([
    login(`member-${tag}@example.test`, "198.51.100.51"), login(`other-${tag}@example.test`, "198.51.100.52"),
    login(`zero-${tag}@example.test`, "198.51.100.53"), login(`admin-${tag}@example.test`, "198.51.100.54"),
  ]);
  failure(await action("getReservationSummaryAction"), "UNAUTHENTICATED");
  failure(await action("getMonthlyCalendarSummaryAction", [{ year: 2032, month: 13 }], member), "INVALID_INPUT");
  failure(await action("getSelectedDayDashboardSummaryAction", [{ selectedDate: "2032-02-30" }], member), "INVALID_INPUT");
  failure(await action("getDepartmentUsageAction", [{ year: 2032, month: 2 }], member), "FORBIDDEN");
  const zeroSummary = success(await action("getReservationSummaryAction", [], zero));
  assert.deepEqual([zeroSummary.totalBookings, zeroSummary.pendingReview, zeroSummary.approvedBookings], [0, 0, 0]);
  assert.equal(zeroSummary.activeResources, (await prisma.resource.count({ where: { isActive: true } })));
  pass("validation, authentication, admin-only department usage, and zero-booking user");

  const day = "2032-02-29";
  const monthInput = { year: 2032, month: 2 };
  const adminBefore = success(await action("getReservationSummaryAction", [], admin));
  const febBefore = success(await action("getMonthlyUsageAction", [monthInput], admin));
  const dayBefore = success(await action("getSelectedDayDashboardSummaryAction", [{ selectedDate: day }], admin));
  const rows = [
    [resourceIds[0], userIds[0], departmentIds[0], "APPROVED", "2032-02-28", "23:30", "2032-02-29", "01:30"],
    [resourceIds[0], userIds[0], departmentIds[0], "PENDING", day, "09:00", day, "10:00"],
    [resourceIds[0], userIds[0], departmentIds[0], "APPROVED", day, "10:00", day, "11:00"],
    [resourceIds[0], userIds[0], departmentIds[0], "REJECTED", day, "11:00", day, "12:00"],
    [resourceIds[0], userIds[0], departmentIds[0], "CANCELLED", day, "12:00", day, "13:00"],
    [resourceIds[1], null, departmentIds[1], "APPROVED", day, "13:00", day, "14:00"],
    [resourceIds[1], userIds[1], departmentIds[1], "APPROVED", day, "14:00", day, "15:00"],
    [resourceIds[0], userIds[0], departmentIds[0], "APPROVED", day, "23:30", "2032-03-01", "01:30"],
  ];
  for (const [resourceId, userId, departmentId, status, startDate, startClock, endDate, endClock] of rows) {
    await prisma.reservation.create({ data: { resourceId, userId, departmentId,
      createdByUserId: userId === userIds[1] || userId === null ? userIds[3] : userId,
      status, title: `Stage6C ${status} ${tag}`, startTime: instant(startDate, startClock), endTime: instant(endDate, endClock) } });
  }
  const memberSummary = success(await action("getReservationSummaryAction", [], member));
  assert.deepEqual([memberSummary.totalBookings, memberSummary.pendingReview, memberSummary.approvedBookings, memberSummary.rejectedBookings, memberSummary.cancelledBookings], [6, 1, 3, 1, 1]);
  assert.equal(memberSummary.scope, "PERSONAL");
  const otherSummary = success(await action("getReservationSummaryAction", [], other));
  assert.deepEqual([otherSummary.totalBookings, otherSummary.approvedBookings], [1, 1]);
  assert.equal((await prisma.reservation.findFirstOrThrow({ where: { resourceId: resourceIds[1], userId: userIds[1] } })).createdByUserId, userIds[3]);
  const adminSummary = success(await action("getReservationSummaryAction", [], admin));
  assert.equal(adminSummary.scope, "ORGANIZATION");
  assert.equal(adminSummary.totalBookings, adminBefore.totalBookings + 8);
  assert.equal(adminSummary.pendingReview, adminBefore.pendingReview + 1);
  assert.equal(adminSummary.approvedBookings, adminBefore.approvedBookings + 5);
  assert.equal(adminSummary.rejectedBookings, adminBefore.rejectedBookings + 1);
  assert.equal(adminSummary.cancelledBookings, adminBefore.cancelledBookings + 1);
  assert.equal(adminSummary.activeResources, zeroSummary.activeResources);
  const memberPage = await fetch(`${base}/reservations`, { headers: { Cookie: cookieHeader(member) } });
  assert.equal(memberPage.status, 200);
  const memberHtml = await memberPage.text();
  assert.match(memberHtml, /Total Bookings<\/p><p[^>]*>6<\/p>/);
  assert.match(memberHtml, /Pending Review<\/p><p[^>]*>1<\/p>/);
  assert.match(memberHtml, /Approved Bookings<\/p><p[^>]*>3<\/p>/);
  pass("all-time personal and organization counts, history, ownership, department-only, and active resources");

  const memberMonth = success(await action("getMonthlyCalendarSummaryAction", [monthInput], member));
  assert.equal(memberMonth.days.length, 29);
  assert.deepEqual([memberMonth.days[28].pending, memberMonth.days[28].approved, memberMonth.days[28].rejected, memberMonth.days[28].cancelled], [1, 3, 1, 1]);
  assert.equal(memberMonth.days[27].approved, 1);
  const adminDay = success(await action("getSelectedDayDashboardSummaryAction", [{ selectedDate: day }], admin));
  assert.equal(adminDay.scheduledReservations, dayBefore.scheduledReservations + 6);
  assert.equal(adminDay.pendingRequests, dayBefore.pendingRequests + 1);
  assert.equal(adminDay.approvedBookings, dayBefore.approvedBookings + 5);
  assert.equal(adminDay.bookedResources, dayBefore.bookedResources + 2);
  const memberDay = success(await action("getSelectedDayDashboardSummaryAction", [{ selectedDate: day }], member));
  assert.deepEqual([memberDay.scheduledReservations, memberDay.pendingRequests, memberDay.approvedBookings, memberDay.bookedResources], [4, 1, 3, 1]);
  const march = success(await action("getMonthlyCalendarSummaryAction", [{ year: 2032, month: 3 }], member));
  assert.equal(march.days[0].approved, 1);
  assert.deepEqual([memberSummary.totalBookings, success(await action("getReservationSummaryAction", [], member)).totalBookings], [6, 6]);
  pass("all-time counts ignore date; day and month overlap filters handle midnight and month transition");

  const memberSchedule = success(await action("getSelectedDayScheduleAction", [{ selectedDate: day }], member));
  assert.equal(memberSchedule.items.length, 4);
  assert.ok(memberSchedule.items.every((item) => item.userId === userIds[0] && !("createdByUserId" in item) && !("user" in item)));
  assert.ok(memberSchedule.items.every((item, i, items) => i === 0 || item.startTime >= items[i - 1].startTime));
  const adminSchedule = success(await action("getSelectedDayScheduleAction", [{ selectedDate: day }], admin));
  assert.ok(adminSchedule.items.some((item) => item.userId === null && item.departmentId === departmentIds[1]));
  assert.ok(adminSchedule.items.some((item) => item.userId === userIds[1] && item.user?.email === `other-${tag}@example.test`));
  pass("member schedule privacy and ordered admin details including department-only booking");

  const memberUsage = success(await action("getMonthlyUsageAction", [monthInput], member));
  near(memberUsage.totalBookedHours, 3.5);
  near(memberUsage.days[27].bookedHours, 0.5);
  near(memberUsage.days[28].bookedHours, 3);
  const adminUsage = success(await action("getMonthlyUsageAction", [monthInput], admin));
  near(adminUsage.totalBookedHours - febBefore.totalBookedHours, 5.5);
  const marchUsage = success(await action("getMonthlyUsageAction", [{ year: 2032, month: 3 }], member));
  near(marchUsage.days[0].bookedHours, 1.5);
  const deptUsage = success(await action("getDepartmentUsageAction", [monthInput], admin));
  near(deptUsage.departments.find((item) => item.departmentId === departmentIds[0]).bookedHours, 3.5);
  near(deptUsage.departments.find((item) => item.departmentId === departmentIds[1]).bookedHours, 2);
  const legacyApproved = await prisma.reservation.findFirst({ where: { departmentId: null, status: "APPROVED" }, select: { startTime: true } });
  if (legacyApproved) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo", year: "numeric", month: "2-digit" }).formatToParts(legacyApproved.startTime);
    const year = Number(parts.find((part) => part.type === "year").value);
    const month = Number(parts.find((part) => part.type === "month").value);
    const legacyUsage = success(await action("getDepartmentUsageAction", [{ year, month }], admin));
    assert.ok(legacyUsage.departments.some((item) => item.departmentId === null && item.name === "Unassigned/Legacy"));
  }
  pass("approved booked hours clip to Colombo month; department and legacy usage preserve ownership");

  const mutation = success(await action("createReservationAction", [{ resourceId: resourceIds[0], title: `Mutation ${tag}`,
    startTime: instant(day, "15:00").toISOString(), endTime: instant(day, "16:00").toISOString() }], member));
  assert.equal(mutation.status, "PENDING");
  const afterCreate = success(await action("getReservationSummaryAction", [], member));
  assert.equal(afterCreate.totalBookings, 7); assert.equal(afterCreate.pendingReview, 2);
  success(await action("cancelReservationAction", [mutation.id], member));
  const afterCancel = success(await action("getReservationSummaryAction", [], member));
  assert.equal(afterCancel.totalBookings, 7); assert.equal(afterCancel.pendingReview, 1); assert.equal(afterCancel.cancelledBookings, 2);
  pass("booking and cancellation refresh database-backed metrics without losing history");

  assert.equal(await prisma.user.count(), original.users + 4);
  assert.equal(await prisma.reservation.count(), original.reservations + 9);
} finally {
  if (resourceIds.length) {
    const reservations = await prisma.reservation.findMany({ where: { resourceId: { in: resourceIds } }, select: { id: true } });
    await prisma.notification.deleteMany({ where: { reservationId: { in: reservations.map((item) => item.id) } } });
    await prisma.reservation.deleteMany({ where: { resourceId: { in: resourceIds } } });
    await prisma.resource.deleteMany({ where: { id: { in: resourceIds } } });
  }
  if (categoryId) await prisma.resourceCategory.delete({ where: { id: categoryId } });
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  if (departmentIds.length) await prisma.department.deleteMany({ where: { id: { in: departmentIds } } });
  if (original) assert.deepEqual({ users: await prisma.user.count(), reservations: await prisma.reservation.count(),
    notifications: await prisma.notification.count(), resources: await prisma.resource.count(), departments: await prisma.department.count() }, original);
  await prisma.$disconnect();
}
