import { PrismaClient } from "@prisma/client";
import { hash } from "argon2";

const accounts: Record<string, string> = {
  "alex.admin@primewave.local": "SLOTIFY_DEMO_ADMIN_PASSWORD",
  "sarah.chen@primewave.local": "SLOTIFY_DEMO_MEMBER_PASSWORD",
  "david.kim@primewave.local": "SLOTIFY_DEMO_MEMBER_PASSWORD",
  "emily.watson@primewave.local": "SLOTIFY_DEMO_MEMBER_PASSWORD",
};

async function main() {
  const email = process.argv[2];
  const variable = accounts[email];
  if (!variable) throw new Error("Specify one of the documented local demo account emails.");
  const password = process.env[variable];
  if (!password || password.length < 12) throw new Error(`Set ${variable} to a 12+ character value in .env.`);
  const prisma = new PrismaClient();
  try {
    await prisma.user.update({
      where: { email },
      data: { passwordHash: await hash(password) },
    });
    console.log(`Password reset for ${email}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Password reset failed.");
  process.exitCode = 1;
});
