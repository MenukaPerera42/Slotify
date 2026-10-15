import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hash } from "argon2";
import { bookingOperationalDate, officeWindow } from "../src/features/office-shifts/utils/office-window.ts";

const prisma = new PrismaClient();
const base = process.env.SLOTIFY_TEST_URL ?? "http://localhost:3000";
const tag = randomBytes(5).toString("hex");
const password = "Test-7-safe-password";
const ids = { users: [], reservations: [], resources: [], departments: [], categories: [] };
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
  assert.equal(response.status, 200, `${name}: HTTP ${response.status}`);
  return response.json();
}
function ok(result) { assert.equal(result.success, true, JSON.stringify(result)); return result.data; }
function fail(result, code) { assert.equal(result.success, false, JSON.stringify(result)); assert.equal(result.code, code, JSON.stringify(result)); }
const iso = (time) => new Date(time).toISOString();

try {
  const category = ok(await (async () => {
    const department = await prisma.department.create({ data: { name: `Time edit ${tag}`, code: `R${tag.toUpperCase()}` } });
    ids.departments.push(department.id);
    for (const [role, suffix] of [["ADMIN", "admin"], ["MEMBER", "member"]]) {
      const user = await prisma.user.create({ data: { name: suffix, email: `${suffix}-${tag}@example.test`, passwordHash: await hash(password), role, departmentId: department.id } });
      ids.users.push(user.id);
    }
    return action("createCategoryAction", [{ name: `Time edit ${tag}`, description: "asdf", isActive: true }], await login(`admin-${tag}@example.test`, "198.51.100.61"));
  })());
  ids.categories.push(category.id);
  const admin = await login(`admin-${tag}@example.test`, "198.51.100.62");
  const member = await login(`member-${tag}@example.test`, "198.51.100.63");
  assert.equal(category.isActive, true);
  assert.equal((await prisma.resourceCategory.findUniqueOrThrow({ where: { id: category.id } })).description, "asdf");
  const invalidName = await action("createCategoryAction", [{ name: "x", isActive: true }], admin);
  fail(invalidName, "INVALID_INPUT");
  assert.ok(invalidName.fieldErrors.name?.length);
  const invalidStatus = await action("createCategoryAction", [{ name: `Invalid status ${tag}`, isActive: "true" }], admin);
  fail(invalidStatus, "INVALID_INPUT");
  assert.ok(invalidStatus.fieldErrors.isActive?.length);
  fail(await action("createCategoryAction", [{ name: `TIME EDIT ${tag}`, isActive: true }], admin), "DUPLICATE_NAME");
  fail(await action("createCategoryAction", [{ name: "Denied", isActive: true }], member), "FORBIDDEN");
  console.log("PASS category form payload, validation, duplicate check, readback, and authorization");

  const resource = await prisma.resource.create({ data: { name: `Time room ${tag}`, location: "Test", categoryId: category.id } });
  ids.resources.push(resource.id);
  const shift = await prisma.officeShift.findFirst({ where: { isActive: true } });
  const date = new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);
  const window = officeWindow(date, shift ?? { mode: "CUSTOM", startMinute: 0, durationMinutes: 1440 });
  assert.ok(window.durationMinutes >= 300, "The active shift must allow isolated test intervals of at least five hours");
  const at = (minute) => new Date(window.startTime.getTime() + minute * 60_000);
  const departmentId = ids.departments[0];
  const makeReservation = async (start, end) => {
    const item = await prisma.reservation.create({ data: {
      resourceId: resource.id, departmentId, userId: ids.users[1], createdByUserId: ids.users[0],
      title: `Time edit ${tag}`, startTime: at(start), endTime: at(end), status: "APPROVED",
    } });
    ids.reservations.push(item.id);
    return item;
  };
  const first = await makeReservation(60, 120);
  const second = await makeReservation(180, 240);
  const third = await makeReservation(240, 300);
  let version = first.updatedAt.toISOString();
  const edit = (start, end, expectedUpdatedAt = version, jar = admin) => action("updateReservationTimeAction", [{
    reservationId: first.id, startTime: iso(at(start)), endTime: iso(at(end)), expectedUpdatedAt,
  }], jar);
  fail(await edit(40, 120, version, member), "FORBIDDEN");
  fail(await edit(120, 120), "INVALID_INPUT");
  fail(await edit(-30, 120), "OUTSIDE_SHIFT_HOURS");
  let updated = ok(await edit(30, 120)).reservation;
  assert.equal(updated.id, first.id);
  version = updated.updatedAt;
  updated = ok(await edit(30, 150)).reservation;
  version = updated.updatedAt;
  updated = ok(await edit(60, 120)).reservation;
  version = updated.updatedAt;
  fail(await edit(60, 190), "SLOT_CONFLICT");
  updated = ok(await edit(60, 180)).reservation;
  version = updated.updatedAt;
  assert.equal(updated.endTime, iso(at(180)));
  fail(await edit(60, 170, first.updatedAt.toISOString()), "STALE_UPDATE");
  const concurrent = await Promise.all([edit(60, 160, version), edit(60, 170, version)]);
  assert.equal(concurrent.filter((r) => r.success).length, 1);
  assert.equal(concurrent.filter((r) => r.code === "STALE_UPDATE").length, 1);
  const persisted = await prisma.reservation.findUniqueOrThrow({ where: { id: first.id } });
  assert.equal(persisted.id, first.id);
  assert.equal(persisted.resourceId, resource.id);
  assert.equal(persisted.departmentId, departmentId);
  assert.equal(persisted.userId, ids.users[1]);
  assert.equal(persisted.createdByUserId, ids.users[0]);
  assert.equal(persisted.status, "APPROVED");
  assert.equal(persisted.startTime.toISOString(), iso(at(60)));
  assert.equal(persisted.endTime.toISOString(), concurrent.find((r) => r.success).data.reservation.endTime);
  assert.equal(await prisma.reservationTimeChange.count({ where: { reservationId: first.id } }), 5);
  assert.equal((await prisma.reservation.findUniqueOrThrow({ where: { id: second.id } })).endTime.toISOString(), iso(at(240)));
  assert.equal((await prisma.reservation.findUniqueOrThrow({ where: { id: third.id } })).startTime.toISOString(), iso(at(240)));
  const grouped = ok(await action("getGroupedReservationsForDateAction", [{ date, resourceId: resource.id }], admin));
  assert.ok(grouped.some((group) => group.reservationIds.includes(second.id) && group.reservationIds.includes(third.id)));
  assert.ok(grouped.flatMap((group) => group.bookings).every((booking) => booking.id && booking.updatedAt));
  const night = { mode: "NIGHT", startMinute: 1320, durationMinutes: 480 };
  const nightWindow = officeWindow(date, night);
  assert.ok(bookingOperationalDate(new Date(nightWindow.startTime.getTime() + 60 * 60_000), new Date(nightWindow.startTime.getTime() + 180 * 60_000), night));
  const fullDay = { mode: "FULL_DAY", startMinute: 0, durationMinutes: 1440 };
  const fullDayWindow = officeWindow(date, fullDay);
  assert.ok(bookingOperationalDate(new Date(fullDayWindow.startTime.getTime() + 1380 * 60_000), new Date(fullDayWindow.startTime.getTime() + 1500 * 60_000), fullDay));
  console.log("PASS exact time edits, shift guard, conflicts, adjacency, stale writes, grouped IDs, audit, and persistence");
} finally {
  await prisma.reservationTimeChange.deleteMany({ where: { reservationId: { in: ids.reservations } } });
  await prisma.reservation.deleteMany({ where: { id: { in: ids.reservations } } });
  await prisma.resource.deleteMany({ where: { id: { in: ids.resources } } });
  await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  await prisma.department.deleteMany({ where: { id: { in: ids.departments } } });
  await prisma.resourceCategory.deleteMany({ where: { id: { in: ids.categories } } });
  await prisma.$disconnect();
}
