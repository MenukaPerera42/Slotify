import { PrismaClient, UserRole, ReservationStatus } from "@prisma/client";
import { hash } from "argon2";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  const adminPassword = process.env.SLOTIFY_DEMO_ADMIN_PASSWORD;
  const memberPassword = process.env.SLOTIFY_DEMO_MEMBER_PASSWORD;
  if (!adminPassword || !memberPassword || adminPassword.length < 12 || memberPassword.length < 12) {
    throw new Error("Set SLOTIFY_DEMO_ADMIN_PASSWORD and SLOTIFY_DEMO_MEMBER_PASSWORD (12+ characters) before seeding.");
  }
  const adminHash = await hash(adminPassword);
  const memberHash = await hash(memberPassword);
  const upsertDemoUser = (name: string, email: string, role: UserRole, passwordHash: string) =>
    prisma.user.upsert({
      where: { email },
      create: { name, email, role, passwordHash },
      update: { passwordHash },
    });
  const alexAdmin = await upsertDemoUser("Alex Vance", "alex.admin@primewave.local", UserRole.ADMIN, adminHash);
  const sarahMember = await upsertDemoUser("Sarah Chen", "sarah.chen@primewave.local", UserRole.MEMBER, memberHash);
  const davidMember = await upsertDemoUser("David Kim", "david.kim@primewave.local", UserRole.MEMBER, memberHash);
  const emilyMember = await upsertDemoUser("Emily Watson", "emily.watson@primewave.local", UserRole.MEMBER, memberHash);

  console.log(`👤 Seeded 4 users (1 Admin, 3 Members).`);

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
  for (const sample of samples) {
    if (!(await prisma.reservation.findFirst({ where: { title: sample.title } }))) {
      await prisma.reservation.create({ data: sample });
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
