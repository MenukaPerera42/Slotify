import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function currentUser() {
  const session = await auth();
  if (!session?.user?.id && !session?.user?.email) return null;
  return prisma.user.findUnique({
    where: session.user.id ? { id: session.user.id } : { email: session.user.email! },
    select: { id: true, name: true, firstName: true, lastName: true, email: true, role: true, isActive: true, departmentId: true },
  }).then((user) => user?.isActive ? user : null);
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Forbidden");
  return user;
}
