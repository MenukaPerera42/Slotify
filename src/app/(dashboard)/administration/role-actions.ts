"use server";

import { revalidatePath } from "next/cache";
import { setUserRoleSchema } from "@/features/admin-users/schemas/admin-user-schema";
import { setUserRole } from "@/features/admin-users/services/admin-user-service";
import { requireAdmin } from "@/lib/authorization";

export async function changeRoleAction(data: FormData) {
  await requireAdmin();
  const parsed = setUserRoleSchema.parse({ userId: data.get("userId"), role: data.get("role") });
  await setUserRole(parsed.userId, parsed.role);
  revalidatePath("/administration");
}
