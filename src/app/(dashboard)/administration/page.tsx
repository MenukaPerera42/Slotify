import { Suspense } from "react";
import { requireUser } from "@/lib/authorization";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/layout/app-header";
import { AdminUserManager } from "@/features/admin-users/components/admin-user-manager";

export const metadata = {
  title: "Administration | Slotify",
  description: "Manage users, department assignments, and system access roles.",
};

export default async function AdministrationPage() {
  const actor = await requireUser();
  if (actor.role !== "ADMIN") notFound();

  const [users, departments, unassignedCount] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
        departmentId: true,
        department: { select: { id: true, name: true, code: true, isActive: true } },
        createdAt: true,
      },
    }),
    prisma.department.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
    prisma.reservation.count({
      where: { departmentId: null },
    }),
  ]);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <AppHeader
        title="Administration"
        description="Manage organizational users, department assignments, access roles, and scheduling policies."
      />
      <main className="flex-1 px-8 pb-12 max-w-7xl w-full space-y-6">
        <Suspense fallback={<div className="p-8 text-center text-slate-500 font-medium text-sm">Loading administration portal...</div>}>
          <AdminUserManager
            users={users}
            departments={departments}
            currentAdminId={actor.id}
            initialUnassignedCount={unassignedCount}
          />
        </Suspense>
      </main>
    </div>
  );
}
