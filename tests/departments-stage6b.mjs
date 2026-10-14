import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hash } from "argon2";

const prisma = new PrismaClient();
const base = process.env.SLOTIFY_TEST_URL ?? "http://localhost:3000";
const tag = randomBytes(4).toString("hex");
const password = `Test-${randomBytes(16).toString("base64url")}`;
const cleanup = { users: [], departments: [], resources: [], categories: [] };

const pass = (label) => console.log(`PASS ${label}`);
const cookies = (response) =>
  Object.fromEntries(
    response.headers
      .getSetCookie()
      .map((line) => line.split(";", 1)[0].split(/=(.*)/s).slice(0, 2))
  );
const cookieHeader = (jar) =>
  Object.entries(jar)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");

async function login(email, address = "127.0.0.1") {
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
  assert.equal(response.status, 302, `Login failed for ${email}`);
  Object.assign(jar, cookies(response));
  return jar;
}

async function callAction(name, args = [], jar = {}) {
  const response = await fetch(`${base}/api/reservation-test`, {
    method: "POST",
    headers: {
      Origin: base,
      Cookie: cookieHeader(jar),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, args }),
  });
  assert.equal(response.status, 200, `${name}: ${response.status}`);
  return response.json();
}

try {
  console.log("--- Starting Stage 6B Verification Suite ---");

  // 1. Setup departments & resources
  const deptEng = await prisma.department.create({
    data: { name: `Engineering ${tag}`, code: `ENG${tag.toUpperCase()}`, isActive: true },
  });
  cleanup.departments.push(deptEng.id);

  const deptDesign = await prisma.department.create({
    data: { name: `Design ${tag}`, code: `DES${tag.toUpperCase()}`, isActive: true },
  });
  cleanup.departments.push(deptDesign.id);

  const cat = await prisma.resourceCategory.create({
    data: { name: `Stage6B Cat ${tag}` },
  });
  cleanup.categories.push(cat.id);

  const res = await prisma.resource.create({
    data: { name: `Stage6B Room ${tag}`, location: "Floor 2", categoryId: cat.id },
  });
  cleanup.resources.push(res.id);

  // 2. Public Active Departments
  const pubDepts = await callAction("listSignupDepartmentsAction", []);
  assert.equal(pubDepts.success, true);
  assert(pubDepts.data.some((d) => d.id === deptEng.id));
  assert(pubDepts.data.some((d) => d.id === deptDesign.id));
  pass("1. listSignupDepartmentsAction returns active departments for signup/modal");

  // 3. User setup
  const passwordHash = await hash(password);

  // Admin user (assigned to deptEng)
  const admin = await prisma.user.create({
    data: {
      name: `Admin 6B ${tag}`,
      email: `admin6b_${tag}@test.local`,
      passwordHash,
      role: "ADMIN",
      isActive: true,
      departmentId: deptEng.id,
    },
  });
  cleanup.users.push(admin.id);

  // Member user with department
  const memberAssigned = await prisma.user.create({
    data: {
      name: `Member Assigned ${tag}`,
      email: `member_assigned_${tag}@test.local`,
      passwordHash,
      role: "MEMBER",
      isActive: true,
      departmentId: deptEng.id,
    },
  });
  cleanup.users.push(memberAssigned.id);

  // Member user unassigned (legacy)
  const memberUnassigned = await prisma.user.create({
    data: {
      name: `Member Unassigned ${tag}`,
      email: `member_unassigned_${tag}@test.local`,
      passwordHash,
      role: "MEMBER",
      isActive: true,
      departmentId: null,
    },
  });
  cleanup.users.push(memberUnassigned.id);

  // 4. Test getMyDepartmentAction
  const adminJar = await login(admin.email, "127.0.0.10");
  const memberAssignedJar = await login(memberAssigned.email, "127.0.0.11");
  const memberUnassignedJar = await login(memberUnassigned.email, "127.0.0.12");

  const myDeptAssigned = await callAction("getMyDepartmentAction", [], memberAssignedJar);
  assert.equal(myDeptAssigned.success, true);
  assert.equal(myDeptAssigned.data.department.id, deptEng.id);
  assert.equal(myDeptAssigned.data.assignmentRequired, false);

  const myDeptUnassigned = await callAction("getMyDepartmentAction", [], memberUnassignedJar);
  assert.equal(myDeptUnassigned.success, true);
  assert.equal(myDeptUnassigned.data.department, null);
  assert.equal(myDeptUnassigned.data.assignmentRequired, true);
  pass("2. getMyDepartmentAction reports assigned vs unassigned status correctly");

  // 5. Unassigned member booking is blocked
  const day = new Date();
  day.setDate(day.getDate() + 3);
  const dateStr = day.toISOString().slice(0, 10);
  const slot1Start = `${dateStr}T09:00:00+05:30`;
  const slot1End = `${dateStr}T10:00:00+05:30`;

  const blockedBooking = await callAction(
    "createReservationAction",
    [{ resourceId: res.id, title: "Blocked Booking", startTime: slot1Start, endTime: slot1End }],
    memberUnassignedJar
  );
  assert.equal(blockedBooking.success, false);
  assert.equal(blockedBooking.code, "DEPARTMENT_REQUIRED");
  pass("3. Unassigned member booking is blocked with DEPARTMENT_REQUIRED");

  // 6. Admin assigns department to unassigned user via assignUserDepartmentAction
  const assignResult = await callAction(
    "assignUserDepartmentAction",
    [{ userId: memberUnassigned.id, departmentId: deptDesign.id }],
    adminJar
  );
  assert.equal(assignResult.success, true);
  assert.equal(assignResult.data.departmentId, deptDesign.id);

  const updatedUser = await prisma.user.findUnique({ where: { id: memberUnassigned.id } });
  assert.equal(updatedUser.departmentId, deptDesign.id);

  const myDeptNowAssigned = await callAction("getMyDepartmentAction", [], memberUnassignedJar);
  assert.equal(myDeptNowAssigned.success, true);
  assert.equal(myDeptNowAssigned.data.assignmentRequired, false);
  assert.equal(myDeptNowAssigned.data.department.id, deptDesign.id);
  pass("4. Admin user department assignment works and unblocks member");

  // 7. Assigned member booking succeeds
  const assignedBooking = await callAction(
    "createReservationAction",
    [{ resourceId: res.id, title: "Assigned Member Slot", startTime: slot1Start, endTime: slot1End }],
    memberAssignedJar
  );
  assert.equal(assignedBooking.success, true);
  assert.equal(assignedBooking.data.status, "PENDING");
  assert.equal(assignedBooking.data.departmentId, deptEng.id);
  pass("5. Assigned member creates booking with attached department");

  // Approve slot 1
  const approveRes = await callAction("approveReservationAction", [assignedBooking.data.id], adminJar);
  assert.equal(approveRes.success, true);

  // 8. Admin Mode A (Myself), Mode B (For User), Mode C (Department Only)
  const slot2Start = `${dateStr}T10:00:00+05:30`;
  const slot2End = `${dateStr}T11:00:00+05:30`;
  const slot3Start = `${dateStr}T11:00:00+05:30`;
  const slot3End = `${dateStr}T12:00:00+05:30`;
  const slot4Start = `${dateStr}T13:00:00+05:30`;
  const slot4End = `${dateStr}T14:00:00+05:30`;

  // Mode A: Myself (Admin self-booking) -> approved directly under admin's dept
  const modeABooking = await callAction(
    "createReservationAction",
    [{ resourceId: res.id, title: "Mode A Self", startTime: slot2Start, endTime: slot2End }],
    adminJar
  );
  assert.equal(modeABooking.success, true);
  assert.equal(modeABooking.data.status, "APPROVED");
  assert.equal(modeABooking.data.departmentId, deptEng.id);
  assert.equal(modeABooking.data.userId, admin.id);
  pass("6. Admin Mode A (Myself) creates directly approved booking under admin department");

  // Mode B: For User (target user in Engineering)
  const modeBBooking = await callAction(
    "createAdminReservationAction",
    [{
      departmentId: deptEng.id,
      targetUserId: memberAssigned.id,
      resourceId: res.id,
      title: "Mode B On-Behalf",
      startTime: slot3Start,
      endTime: slot3End,
    }],
    adminJar
  );
  assert.equal(modeBBooking.success, true);
  assert.equal(modeBBooking.data.status, "APPROVED");
  assert.equal(modeBBooking.data.departmentId, deptEng.id);
  assert.equal(modeBBooking.data.userId, memberAssigned.id);
  pass("7. Admin Mode B (For User) creates approved booking on behalf of target user");

  // Mode C: Department Only (department level, no targetUserId)
  const modeCBooking = await callAction(
    "createAdminReservationAction",
    [{
      departmentId: deptDesign.id,
      resourceId: res.id,
      title: "Mode C Department Only",
      startTime: slot4Start,
      endTime: slot4End,
    }],
    adminJar
  );
  assert.equal(modeCBooking.success, true);
  assert.equal(modeCBooking.data.status, "APPROVED");
  assert.equal(modeCBooking.data.departmentId, deptDesign.id);
  assert.equal(modeCBooking.data.userId, null);
  pass("8. Admin Mode C (Department Only) creates department-level reservation without user ID");

  // 9. Adjacent reservation grouping on continuous timeline
  // Note: slot 1 (09:00-10:00, deptEng, APPROVED), slot 2 (10:00-11:00, deptEng, APPROVED), slot 3 (11:00-12:00, deptEng, APPROVED)
  // are consecutive adjacent slots for the same resource, same department, same status!
  // They should be grouped into a single continuous 09:00-12:00 block (3 hours)!
  const groupedResultAdmin = await callAction(
    "getGroupedReservationsForDateAction",
    [{ date: dateStr }],
    adminJar
  );
  assert.equal(groupedResultAdmin.success, true);
  const resourceGroupsAdmin = groupedResultAdmin.data.filter((g) => g.resourceId === res.id);
  // We expect:
  // 1 group for 09:00 - 12:00 (containing 3 reservations: slot 1, slot 2, slot 3)
  // 1 group for 13:00 - 14:00 (slot 4, deptDesign)
  assert.equal(resourceGroupsAdmin.length, 2, `Expected 2 groups, got ${resourceGroupsAdmin.length}`);

  const combinedGroup = resourceGroupsAdmin.find(
    (g) => new Date(g.startTime).getTime() === new Date(slot1Start).getTime()
  );
  assert(combinedGroup, "Combined group starting at 09:00 must exist");
  assert.equal(
    new Date(combinedGroup.endTime).getTime(),
    new Date(slot3End).getTime(),
    "Combined group must end at 12:00 (slot 3 end)"
  );
  assert.equal(combinedGroup.reservationIds.length, 3, "Combined group must aggregate 3 reservations");
  assert.equal(combinedGroup.departmentId, deptEng.id);
  assert(Array.isArray(combinedGroup.bookings), "Admin group must contain bookings array");
  pass("9. Continuous timeline groups adjacent reservations (09:00 - 12:00) into single block");

  // 10. Privacy check: Member sees privacy-safe data for other departments/users
  const groupedResultMember = await callAction(
    "getGroupedReservationsForDateAction",
    [{ date: dateStr }],
    memberUnassignedJar // belongs to deptDesign
  );
  assert.equal(groupedResultMember.success, true);
  const resourceGroupsMember = groupedResultMember.data.filter((g) => g.resourceId === res.id);
  const engGroupSeenByDesignMember = resourceGroupsMember.find(
    (g) => new Date(g.startTime).getTime() === new Date(slot1Start).getTime()
  );
  assert(engGroupSeenByDesignMember);
  assert.equal(engGroupSeenByDesignMember.bookings, undefined, "Member should not receive admin bookings array");
  pass("10. Member view enforces privacy-safe timeline labels for foreign departments");

  console.log("--- All Stage 6B Verification Checks Passed Successfully! ---");
} finally {
  // Cleanup
  await prisma.notification.deleteMany({ where: { OR: [
    { reservation: { resourceId: { in: cleanup.resources } } },
    { recipientUserId: { in: cleanup.users } },
    { actorUserId: { in: cleanup.users } },
  ] } });
  await prisma.reservation.deleteMany({ where: { resourceId: { in: cleanup.resources } } });
  await prisma.resource.deleteMany({ where: { id: { in: cleanup.resources } } });
  await prisma.resourceCategory.deleteMany({ where: { id: { in: cleanup.categories } } });
  await prisma.user.deleteMany({ where: { id: { in: cleanup.users } } });
  await prisma.department.deleteMany({ where: { id: { in: cleanup.departments } } });
  await prisma.$disconnect();
}
