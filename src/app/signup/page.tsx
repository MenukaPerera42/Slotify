import { redirect } from "next/navigation";
import { currentUser } from "@/lib/authorization";
import { SignupForm } from "./signup-form";
import { publicActiveDepartments } from "@/features/departments/services/department-service";
import { AuthLayout } from "@/components/auth/auth-layout";

export default async function SignupPage() {
  if (await currentUser()) redirect("/dashboard");
  const departments = await publicActiveDepartments();

  return (
    <AuthLayout>
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Create an account
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Join your team to access resource schedules and booking timelines.
          </p>
        </div>

        <SignupForm departments={departments} />
      </div>
    </AuthLayout>
  );
}
