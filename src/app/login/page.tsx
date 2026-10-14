import { redirect } from "next/navigation";
import { currentUser } from "@/lib/authorization";
import { LoginForm } from "./login-form";
import { AuthLayout } from "@/components/auth/auth-layout";
import { CheckCircle2 } from "lucide-react";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; verified?: string }>;
}) {
  if (await currentUser()) redirect("/dashboard");
  const { created, verified } = await searchParams;

  return (
    <AuthLayout>
      <div className="space-y-7">
        <div className="space-y-3">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Welcome Back
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Enter your credentials to access your organization&apos;s workspace.
          </p>
        </div>

        {(created === "1" || verified === "1") && (
          <div
            role="status"
            className="rounded-xl bg-emerald-50 border border-emerald-200/80 p-3.5 text-xs text-emerald-800 flex items-start gap-2.5 shadow-2xs"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-emerald-900">
                {verified === "1"
                  ? "Email Verified Successfully"
                  : "Account Created Successfully"}
              </p>
              <p className="mt-0.5 text-emerald-700">
                {verified === "1"
                  ? "Your email has been verified. Please sign in below to continue."
                  : "Your member credentials are ready. Please sign in below to continue."}
              </p>
            </div>
          </div>
        )}

        <LoginForm />
      </div>
    </AuthLayout>
  );
}
