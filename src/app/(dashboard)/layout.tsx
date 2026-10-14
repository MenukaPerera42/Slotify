import { AppSidebar } from "@/components/layout/app-sidebar";
import { requireUser } from "@/lib/authorization";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <div className="h-screen bg-[#f6f7fb] flex flex-col lg:flex-row text-[#111827] antialiased overflow-hidden">
      <AppSidebar user={{ name: user.name, email: user.email, role: user.role }} />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

