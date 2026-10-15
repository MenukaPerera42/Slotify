import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { hash } from "argon2";
import { getDepartmentColorScheme } from "../src/features/departments/utils/department-colors.ts";

const prisma = new PrismaClient();
const base = process.env.SLOTIFY_TEST_URL ?? "http://localhost:3000";

const pass = (label) => console.log(`PASS ${label}`);
const tag = randomBytes(8).toString("hex");
const password = `Stage6B1-${randomBytes(18).toString("base64url")}`;
const created = { user: null, department: null, category: null, resources: [], reservations: [] };
const cookieHeader = (jar) => Object.entries(jar).map(([key, value]) => `${key}=${value}`).join("; ");
const cookies = (response) => Object.fromEntries(response.headers.getSetCookie().map((line) => line.split(";", 1)[0].split(/=(.*)/s).slice(0, 2)));


try {
  console.log("--- Starting Stage 6B.1 Verification Suite ---");

  // 1. Department color mapping unit verification
  assert.equal(getDepartmentColorScheme("ENG").bg, "#DBEAFE");
  assert.equal(getDepartmentColorScheme("ENG").border, "#93C5FD");
  assert.equal(getDepartmentColorScheme("ENG").text, "#1D4ED8");

  assert.equal(getDepartmentColorScheme("FE").bg, "#E0E7FF");
  assert.equal(getDepartmentColorScheme("FE").border, "#A5B4FC");
  assert.equal(getDepartmentColorScheme("FE").text, "#3730A3");

  assert.equal(getDepartmentColorScheme("BE").bg, "#EDE9FE");
  assert.equal(getDepartmentColorScheme("BE").border, "#C4B5FD");
  assert.equal(getDepartmentColorScheme("BE").text, "#5B21B6");

  assert.equal(getDepartmentColorScheme("MOBILE").bg, "#E0F2FE");
  assert.equal(getDepartmentColorScheme("MOBILE").border, "#7DD3FC");
  assert.equal(getDepartmentColorScheme("MOBILE").text, "#0369A1");

  assert.equal(getDepartmentColorScheme("IT").bg, "#CFFAFE");
  assert.equal(getDepartmentColorScheme("IT").border, "#67E8F9");
  assert.equal(getDepartmentColorScheme("IT").text, "#155E75");

  assert.equal(getDepartmentColorScheme("HR").bg, "#EFF6FF");
  assert.equal(getDepartmentColorScheme("HR").border, "#BFDBFE");
  assert.equal(getDepartmentColorScheme("HR").text, "#1E40AF");

  // Unassigned / Legacy fallback
  assert.equal(getDepartmentColorScheme(null).bg, "#F1F5F9");
  assert.equal(getDepartmentColorScheme(null).border, "#CBD5E1");
  assert.equal(getDepartmentColorScheme(null).text, "#475569");
  assert.equal(getDepartmentColorScheme(undefined).code, "UNASSIGNED");
  pass("1. Department color palettes match exact hex specifications with deterministic unassigned fallback");

  // Isolated records: no demo login, fixed date, or pre-existing business data.
  const department = await prisma.department.create({ data: { name: `Stage 6B1 ${tag}`, code: `B${tag.toUpperCase()}` } });
  created.department = department.id;
  const category = await prisma.resourceCategory.create({ data: { name: `Stage 6B1 ${tag}` } });
  created.category = category.id;
  const booked = await prisma.resource.create({ data: { name: `Booked ${tag}`, location: "Isolated fixture", categoryId: category.id } });
  const unbooked = await prisma.resource.create({ data: { name: `Unbooked ${tag}`, location: "Isolated fixture", categoryId: category.id } });
  created.resources.push(booked.id, unbooked.id);
  const admin = await prisma.user.create({ data: {
    name: `Stage 6B1 Admin ${tag}`, email: `stage6b1-${tag}@test.local`,
    passwordHash: await hash(password), role: "ADMIN", departmentId: department.id,
  } });
  created.user = admin.id;
  const date = `${new Date().getUTCFullYear() + 2}-04-15`;
  const emptyDate = `${new Date().getUTCFullYear() + 2}-04-16`;
  for (const [start, end] of [["09:00", "09:30"], ["09:30", "10:00"]]) {
    const reservation = await prisma.reservation.create({ data: {
      resourceId: booked.id, userId: admin.id, createdByUserId: admin.id,
      departmentId: department.id, title: `Stage 6B1 ${tag}`,
      startTime: new Date(`${date}T${start}:00+05:30`),
      endTime: new Date(`${date}T${end}:00+05:30`), status: "APPROVED",
    } });
    created.reservations.push(reservation.id);
  }

  const csrfRes = await fetch(`${base}/api/auth/csrf`);
  assert.equal(csrfRes.status, 200);
  const jar = cookies(csrfRes);
  const { csrfToken } = await csrfRes.json();
  const loginRes = await fetch(`${base}/api/auth/callback/credentials`, {
    method: "POST", redirect: "manual",
    headers: { Cookie: cookieHeader(jar), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ csrfToken, email: admin.email, password, callbackUrl: `${base}/dashboard` }),
  });
  assert.equal(loginRes.status, 302, `Fixture login failed: ${loginRes.headers.get("location")}`);
  Object.assign(jar, cookies(loginRes));

  const testAction = async (args) => {
    const res = await fetch(`${base}/api/reservation-test`, {
      method: "POST",
      headers: { Origin: base, Cookie: cookieHeader(jar), "Content-Type": "application/json" },
      body: JSON.stringify({ name: "getGroupedReservationsForDateAction", args }),
    });
    assert.equal(res.status, 200, `Test action HTTP ${res.status}`);
    return res.json();
  };
  const grouped = await testAction([{ date, resourceId: booked.id }]);
  assert.equal(grouped.success, true, JSON.stringify(grouped));
  assert.equal(grouped.data.length, 1);
  assert.equal(grouped.data[0].resourceId, booked.id);
  assert.deepEqual(new Set(grouped.data[0].reservationIds), new Set(created.reservations));
  assert.deepEqual(new Set(grouped.data[0].bookings.map((item) => item.id)), new Set(created.reservations));
  pass("2. Grouped action returns the two adjacent fixture bookings and their original IDs");

  const empty = await testAction([{ date: emptyDate, resourceId: booked.id }]);
  assert.equal(empty.success, true, JSON.stringify(empty));
  assert.deepEqual(empty.data, []);
  pass("3. A separate fixture date returns no bookings");

  const unbookedResult = await testAction([{ date, resourceId: unbooked.id }]);
  assert.equal(unbookedResult.success, true, JSON.stringify(unbookedResult));
  assert.deepEqual(unbookedResult.data, []);
  pass("4. Unbooked fixture resource is absent from grouped occupancy");

  console.log("--- All Stage 6B.1 Functional Checks Passed Successfully! ---");
} finally {
  try {
    if (created.reservations.length) {
      await prisma.notification.deleteMany({ where: { reservationId: { in: created.reservations } } });
      await prisma.reservationTimeChange.deleteMany({ where: { reservationId: { in: created.reservations } } });
      await prisma.reservationDepartmentCorrection.deleteMany({ where: { reservationId: { in: created.reservations } } });
      await prisma.reservation.deleteMany({ where: { id: { in: created.reservations } } });
    }
    if (created.user) {
      await prisma.notification.deleteMany({ where: { OR: [{ recipientUserId: created.user }, { actorUserId: created.user }] } });
      await prisma.user.delete({ where: { id: created.user } });
    }
    if (created.resources.length) await prisma.resource.deleteMany({ where: { id: { in: created.resources } } });
    if (created.category) await prisma.resourceCategory.delete({ where: { id: created.category } });
    if (created.department) await prisma.department.delete({ where: { id: created.department } });
  } finally {
    await prisma.$disconnect();
  }
}

