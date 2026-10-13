import { requireUser } from "@/lib/authorization";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/layout/app-header";
import { changeRoleAction } from "./role-actions";

export default async function AdministrationPage() {
  const actor = await requireUser();
  if (actor.role !== "ADMIN") notFound();
  const users = await prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true, role: true, isActive: true } });
  return <>
    <AppHeader title="Administration" description="Organization users and access roles." />
    <main className="w-full max-w-5xl mx-auto p-6 space-y-4">
      <h2 className="text-lg font-bold text-slate-900">Users</h2>
      <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
        {users.map((user) => <div key={user.id} className="flex items-center justify-between gap-4 p-4">
          <div className="min-w-0"><p className="text-sm font-semibold text-slate-900">{user.name}</p><p className="text-xs text-slate-500 truncate">{user.email} · {user.isActive ? "Active" : "Inactive"}</p></div>
          <form action={changeRoleAction} className="flex items-center gap-2">
            <input type="hidden" name="userId" value={user.id} />
            <span className="text-xs font-medium text-slate-600">{user.role}</span>
            {user.id !== actor.id && <button name="role" value={user.role === "ADMIN" ? "MEMBER" : "ADMIN"} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50">Make {user.role === "ADMIN" ? "member" : "admin"}</button>}
          </form>
        </div>)}
      </div>
    </main>
  </>;
}
