import { PrismaClient } from "@prisma/client";
import { seedDepartments } from "./departments";

const prisma = new PrismaClient();
seedDepartments(prisma)
  .then(() => console.log("Standard departments are present."))
  .catch((error) => { console.error("Department seed failed:", error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
