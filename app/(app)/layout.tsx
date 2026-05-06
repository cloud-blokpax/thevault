import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DesktopNav, MobileHeader, MobileNav } from "@/components/layout/nav";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <DesktopNav email={user.email} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader email={user.email} />
        <main className="flex-1 px-4 pb-24 pt-4 md:px-8 md:pb-8">{children}</main>
        <MobileNav />
      </div>
    </div>
  );
}
