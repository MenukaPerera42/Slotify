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
    <>
      <AppHeader
        title="Administration"
        description="Manage organizational users, department assignments, and access roles."
      />
      <main className="w-full max-w-5xl mx-auto p-6 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">User & Department Governance</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage organizational team members, department allocations, and access privileges.
          </p>
        </div>

        <AdminUserManager
          users={users}
          departments={departments}
          currentAdminId={actor.id}
          initialUnassignedCount={unassignedCount}
        />
      </main>
    </>
  );
}
