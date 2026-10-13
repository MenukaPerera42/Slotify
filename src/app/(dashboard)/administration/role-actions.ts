"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

export async function changeRoleAction(data: FormData) {
  const actor = await requireAdmin();
  const userId = data.get("userId");
  const role = data.get("role");
  if (typeof userId !== "string" || (role !== "ADMIN" && role !== "MEMBER")) throw new Error("Invalid role change");
  if (actor.id === userId) throw new Error("Change your role from another admin account");
  await prisma.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/administration");
}
