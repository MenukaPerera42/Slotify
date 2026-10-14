import { PrismaClient, UserRole } from "@prisma/client";
import { hash } from "argon2";

async function updateAdminAccount() {
  const prisma = new PrismaClient();
  try {
    const targetEmail = "adminslotify@gmail.com";
    const legacyEmail = "alex.admin@primewave.local";
    const password = process.env.SLOTIFY_DEMO_ADMIN_PASSWORD;

    if (!password || password.length < 6) {
      throw new Error("SLOTIFY_DEMO_ADMIN_PASSWORD must be set to at least 6 characters in .env");
    }

    // 1. Conflict check
    const existingTarget = await prisma.user.findUnique({ where: { email: targetEmail } });
    const legacyAdmin = await prisma.user.findUnique({ where: { email: legacyEmail } });

    if (existingTarget && legacyAdmin && existingTarget.id !== legacyAdmin.id) {
      throw new Error(`Conflict: An account with email ${targetEmail} already exists with a different ID.`);
    }

    const adminToUpdate = existingTarget || legacyAdmin;
    if (!adminToUpdate) {
      throw new Error(`Neither ${legacyEmail} nor ${targetEmail} was found in the database.`);
    }

    if (adminToUpdate.role !== UserRole.ADMIN) {
      throw new Error(`Target account ${adminToUpdate.email} does not have the ADMIN role.`);
    }

    const originalId = adminToUpdate.id;
    const preReservationCount = await prisma.reservation.count({ where: { userId: originalId } });

    // 2. Hash password with Argon2id
    const passwordHash = await hash(password);

    // 3. Update account preserving ID and role
    const updatedUser = await prisma.user.update({
      where: { id: originalId },
      data: {
        email: targetEmail,
        passwordHash,
      },
    });

    const postReservationCount = await prisma.reservation.count({ where: { userId: originalId } });

    console.log(JSON.stringify({
      success: true,
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      idPreserved: originalId === updatedUser.id,
      reservationsPreserved: preReservationCount === postReservationCount,
      reservationCount: postReservationCount,
    }));
  } finally {
    await prisma.$disconnect();
  }
}

updateAdminAccount().catch((err) => {
  console.error("Failed to update admin account:", err.message);
  process.exit(1);
});

