import { requireUser } from "@/lib/authorization";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/layout/app-header";
import { UserDepartmentManager } from "@/features/departments/components/user-department-manager";

export const metadata = {
  title: "Administration | Slotify",
  description: "Manage users, department assignments, and system access roles.",
};

export default async function AdministrationPage() {
  const actor = await requireUser();
  if (actor.role !== "ADMIN") notFound();

  const [users, departments] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        departmentId: true,
        department: { select: { id: true, name: true, code: true } },
      },
    }),
    prisma.department.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
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
          <h2 className="text-lg font-bold text-slate-900">User & Department Management</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Assign organizational departments to active team members and manage access permissions.
          </p>
        </div>

        <UserDepartmentManager
          users={users}
          departments={departments}
          currentAdminId={actor.id}
        />
      </main>
    </>
  );
}
