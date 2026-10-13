import { PrismaClient, UserRole, ReservationStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  // 1. Clean existing records in reverse dependency order for idempotency
  await prisma.reservation.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.resourceCategory.deleteMany();
  await prisma.user.deleteMany();

  console.log("🧹 Cleaned existing records.");

  // 2. Seed Users (Demo users for MVP assessment, clearly documented)
  const alexAdmin = await prisma.user.create({
    data: {
      name: "Alex Vance",
      email: "alex.admin@primewave.local",
      role: UserRole.ADMIN,
    },
  });

  const sarahMember = await prisma.user.create({
    data: {
      name: "Sarah Chen",
      email: "sarah.chen@primewave.local",
      role: UserRole.MEMBER,
    },
  });

  const davidMember = await prisma.user.create({
    data: {
      name: "David Kim",
      email: "david.kim@primewave.local",
      role: UserRole.MEMBER,
    },
  });

  const emilyMember = await prisma.user.create({
    data: {
      name: "Emily Watson",
      email: "emily.watson@primewave.local",
      role: UserRole.MEMBER,
    },
  });

  console.log(`👤 Seeded 4 users (1 Admin, 3 Members).`);

  // 3. Seed Resource Categories
  const catMeetingRooms = await prisma.resourceCategory.create({
    data: {
      name: "Meeting Rooms",
      description: "Collaborative team spaces equipped with audio-visual setups.",
    },
  });

  const catWorkstations = await prisma.resourceCategory.create({
    data: {
      name: "Workstations & Pods",
      description: "Dedicated quiet focus desks and individual developer pods.",
    },
  });

  const catLabEquipment = await prisma.resourceCategory.create({
    data: {
      name: "Lab & Hardware Equipment",
      description: "High-performance testing hardware, oscilloscopes, and GPU clusters.",
    },
  });

  console.log(`📁 Seeded 3 resource categories.`);

  // 4. Seed Resources
  const boardroom = await prisma.resource.create({
    data: {
      name: "Grand Horizon Boardroom (A-101)",
      description: "Executive conference room with 4K telepresence display and whiteboards.",
      categoryId: catMeetingRooms.id,
      location: "Building A, 1st Floor",
      capacity: 16,
      isActive: true,
    },
  });

  const focusRoom = await prisma.resource.create({
    data: {
      name: "Innovation Pod Alpha",
      description: "Acoustic focus booth for 1-on-1 sprint reviews or client calls.",
      categoryId: catMeetingRooms.id,
      location: "Building A, 2nd Floor",
      capacity: 4,
      isActive: true,
    },
  });

  const devDesk = await prisma.resource.create({
    data: {
      name: "Dual-Monitor Standing Desk #12",
      description: "Ergonomic motorized standing desk with dual 27-inch 4K USB-C monitors.",
      categoryId: catWorkstations.id,
      location: "Building B, Open Space West",
      capacity: 1,
      isActive: true,
    },
  });

  const gpuServer = await prisma.resource.create({
    data: {
      name: "AI Training Rig — H100 Node 01",
      description: "Dedicated 8x NVIDIA H100 SXM5 server node for model fine-tuning.",
      categoryId: catLabEquipment.id,
      location: "Server Room B-02 (Remote SSH)",
      capacity: 1,
      isActive: true,
    },
  });

  const vrStation = await prisma.resource.create({
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

  // 5. Seed Sample Reservations (Relative to today's date for relevant demonstration)
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Meeting 1: Today 09:00 - 10:30
  const res1Start = new Date(today);
  res1Start.setHours(9, 0, 0, 0);
  const res1End = new Date(today);
  res1End.setHours(10, 30, 0, 0);

  // Meeting 2: Today 11:00 - 12:00 (Adjacent/Non-overlapping on same room)
  const res2Start = new Date(today);
  res2Start.setHours(11, 0, 0, 0);
  const res2End = new Date(today);
  res2End.setHours(12, 0, 0, 0);

  // Focus Pod: Today 14:00 - 15:30
  const res3Start = new Date(today);
  res3Start.setHours(14, 0, 0, 0);
  const res3End = new Date(today);
  res3End.setHours(15, 30, 0, 0);

  // GPU Node: Tomorrow 10:00 - 18:00
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const res4Start = new Date(tomorrow);
  res4Start.setHours(10, 0, 0, 0);
  const res4End = new Date(tomorrow);
  res4End.setHours(18, 0, 0, 0);

  await prisma.reservation.createMany({
    data: [
      {
        resourceId: boardroom.id,
        userId: alexAdmin.id,
        title: "Sprint Planning & Architectural Review",
        startTime: res1Start,
        endTime: res1End,
        status: ReservationStatus.CONFIRMED,
      },
      {
        resourceId: boardroom.id,
        userId: sarahMember.id,
        title: "Client Technical Demo",
        startTime: res2Start,
        endTime: res2End,
        status: ReservationStatus.CONFIRMED,
      },
      {
        resourceId: devDesk.id,
        userId: davidMember.id,
        title: "Product Design Synchronization",
        startTime: res3Start,
        endTime: res3End,
        status: ReservationStatus.CONFIRMED,
      },
      {
        resourceId: focusRoom.id,
        userId: alexAdmin.id,
        title: "Executive 1-on-1 Review",
        startTime: res3Start,
        endTime: res3End,
        status: ReservationStatus.CONFIRMED,
      },
      {
        resourceId: gpuServer.id,
        userId: emilyMember.id,
        title: "LLM Batch Inference Benchmarks",
        startTime: res4Start,
        endTime: res4End,
        status: ReservationStatus.CONFIRMED,
      },
      {
        resourceId: vrStation.id,
        userId: sarahMember.id,
        title: "Spatial UI Usability Testing",
        startTime: res4Start,
        endTime: res4End,
        status: ReservationStatus.CONFIRMED,
      },
    ],
  });

  console.log(`📅 Seeded 5 sample reservations.`);
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
