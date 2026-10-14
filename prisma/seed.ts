import { PrismaClient, UserRole, ReservationStatus } from "@prisma/client";
import { hash } from "argon2";
import { seedDepartments } from "./departments";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");
  await seedDepartments(prisma);

  const adminPassword = process.env.SLOTIFY_DEMO_ADMIN_PASSWORD;
  const memberPassword = process.env.SLOTIFY_DEMO_MEMBER_PASSWORD;
  const demoDepartmentCode = process.env.SLOTIFY_DEMO_DEPARTMENT_CODE?.trim().toUpperCase();
  const ensureDemoUser = async (name: string, email: string, role: UserRole, password?: string) => {
    let existing = await prisma.user.findUnique({ where: { email } });
    if (!existing && email === "adminslotify@gmail.com") {
      const legacyAdmin = await prisma.user.findUnique({ where: { email: "alex.admin@primewave.local" } });
      if (legacyAdmin) {
        existing = await prisma.user.update({
          where: { id: legacyAdmin.id },
          data: { email: "adminslotify@gmail.com" },
        });
      }
    }
    if (existing && role === UserRole.ADMIN && existing.role !== UserRole.ADMIN) {
      throw new Error(`The existing ${email} account is not an admin. Review it before seeding.`);
    }
    if (existing?.passwordHash) return existing;
    if (!password || password.length < 6) {
      throw new Error(`Set the 6+ character demo password environment variable before provisioning ${email}.`);
    }
    let newUserDepartmentId: string | undefined;
    if (!existing) {
      const department = demoDepartmentCode
        ? await prisma.department.findUnique({ where: { code: demoDepartmentCode }, select: { id: true, isActive: true } })
        : null;
      if (!department?.isActive) throw new Error(`Set SLOTIFY_DEMO_DEPARTMENT_CODE to an active, explicitly chosen department before provisioning ${email}.`);
      newUserDepartmentId = department.id;
    }
    const passwordHash = await hash(password);
    return existing
      ? prisma.user.update({ where: { id: existing.id }, data: { passwordHash } })
      : prisma.user.create({ data: { name, email, role, passwordHash, departmentId: newUserDepartmentId } });
  };
  const alexAdmin = await ensureDemoUser("Alex Vance", "adminslotify@gmail.com", UserRole.ADMIN, adminPassword);
  const sarahMember = await ensureDemoUser("Sarah Chen", "sarah.chen@primewave.local", UserRole.MEMBER, memberPassword);
  const davidMember = await ensureDemoUser("David Kim", "david.kim@primewave.local", UserRole.MEMBER, memberPassword);
  const emilyMember = await ensureDemoUser("Emily Watson", "emily.watson@primewave.local", UserRole.MEMBER, memberPassword);

  console.log(`👤 Demo users present; existing credentials and roles were preserved.`);

  // 3. Seed Resource Categories
  const catMeetingRooms = await prisma.resourceCategory.upsert({
    where: { name: "Meeting Rooms" },
    update: {},
    create: {
      name: "Meeting Rooms",
      description: "Collaborative team spaces equipped with audio-visual setups.",
    },
  });

  const catWorkstations = await prisma.resourceCategory.upsert({
    where: { name: "Workstations & Pods" },
    update: {},
    create: {
      name: "Workstations & Pods",
      description: "Dedicated quiet focus desks and individual developer pods.",
    },
  });

  const catLabEquipment = await prisma.resourceCategory.upsert({
    where: { name: "Lab & Hardware Equipment" },
    update: {},
    create: {
      name: "Lab & Hardware Equipment",
      description: "High-performance testing hardware, oscilloscopes, and GPU clusters.",
    },
  });

  console.log(`📁 Seeded 3 resource categories.`);

  const seedResource = async (args: Parameters<typeof prisma.resource.create>[0]) => {
    const name = args.data.name as string;
    return (await prisma.resource.findFirst({ where: { name } })) ?? prisma.resource.create(args);
  };

  // 4. Seed Resources
  const boardroom = await seedResource({
    data: {
      name: "Grand Horizon Boardroom (A-101)",
      description: "Executive conference room with 4K telepresence display and whiteboards.",
      categoryId: catMeetingRooms.id,
      location: "Building A, 1st Floor",
      capacity: 16,
      isActive: true,
    },
  });

  const focusRoom = await seedResource({
    data: {
      name: "Innovation Pod Alpha",
      description: "Acoustic focus booth for 1-on-1 sprint reviews or client calls.",
      categoryId: catMeetingRooms.id,
      location: "Building A, 2nd Floor",
      capacity: 4,
      isActive: true,
    },
  });

  const devDesk = await seedResource({
    data: {
      name: "Dual-Monitor Standing Desk #12",
      description: "Ergonomic motorized standing desk with dual 27-inch 4K USB-C monitors.",
      categoryId: catWorkstations.id,
      location: "Building B, Open Space West",
      capacity: 1,
      isActive: true,
    },
  });

  const gpuServer = await seedResource({
    data: {
      name: "AI Training Rig — H100 Node 01",
      description: "Dedicated 8x NVIDIA H100 SXM5 server node for model fine-tuning.",
      categoryId: catLabEquipment.id,
      location: "Server Room B-02 (Remote SSH)",
      capacity: 1,
      isActive: true,
    },
  });

  const vrStation = await seedResource({
    data: {
      name: "Spatial Testing Rig (Vision Pro Lab)",
      description: "Dedicated spatial computing test station with tracking grid.",
      categoryId: catLabEquipment.id,
      location: "Lab Annex 3",
      capacity: 2,
      isActive: true,
    },
  });

  console.log(`🏢 Seeded 5 resources.`);

  // Seed sample times in the Sri Lanka business timezone; Date values remain UTC instants.
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Colombo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  const businessDay = `${parts.year}-${parts.month}-${parts.day}`;
  const colomboTime = (dayOffset: number, hour: number, minute = 0) => {
    const day = new Date(`${businessDay}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() + dayOffset);
    const date = day.toISOString().slice(0, 10);
    return new Date(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+05:30`);
  };
  const res1Start = colomboTime(0, 9);
  const res1End = colomboTime(0, 10, 30);
  const res2Start = colomboTime(0, 11);
  const res2End = colomboTime(0, 12);
  const res3Start = colomboTime(0, 14);
  const res3End = colomboTime(0, 15, 30);
  const res4Start = colomboTime(1, 10);
  const res4End = colomboTime(1, 18);

  const samples = [
      {
        resourceId: boardroom.id,
        userId: alexAdmin.id,
        title: "Sprint Planning & Architectural Review",
        startTime: res1Start,
        endTime: res1End,
        status: ReservationStatus.APPROVED,
      },
      {
        resourceId: boardroom.id,
        userId: sarahMember.id,
        title: "Client Technical Demo",
        startTime: res2Start,
        endTime: res2End,
        status: ReservationStatus.APPROVED,
      },
      {
        resourceId: devDesk.id,
        userId: davidMember.id,
        title: "Product Design Synchronization",
        startTime: res3Start,
        endTime: res3End,
        status: ReservationStatus.APPROVED,
      },
      {
        resourceId: focusRoom.id,
        userId: alexAdmin.id,
        title: "Executive 1-on-1 Review",
        startTime: res3Start,
        endTime: res3End,
        status: ReservationStatus.APPROVED,
      },
      {
        resourceId: gpuServer.id,
        userId: emilyMember.id,
        title: "LLM Batch Inference Benchmarks",
        startTime: res4Start,
        endTime: res4End,
        status: ReservationStatus.APPROVED,
      },
      {
        resourceId: vrStation.id,
        userId: sarahMember.id,
        title: "Spatial UI Usability Testing",
        startTime: res4Start,
        endTime: res4End,
        status: ReservationStatus.APPROVED,
      },
  ];
  const demoDepartments = new Map((await prisma.user.findMany({
    where: { id: { in: [alexAdmin.id, sarahMember.id, davidMember.id, emilyMember.id] } },
    select: { id: true, departmentId: true },
  })).map((user) => [user.id, user.departmentId]));
  for (const sample of samples) {
    if (!(await prisma.reservation.findFirst({ where: { title: sample.title } }))) {
      const departmentId = demoDepartments.get(sample.userId);
      if (departmentId) await prisma.reservation.create({ data: { ...sample, departmentId } });
    }
  }

  console.log(`📅 Sample reservations present.`);
  console.log("✅ Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
