import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar, type NavItem } from "@/components/layout";

const settingsNav: NavItem[] = [
  { label: "Overview", href: "/settings" },
  { label: "Profile", href: "/settings/profile" },
  { label: "Account", href: "/settings/account" },
];

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/settings");
  }

  return (
    <div className="max-w-6xl mx-auto px-4 flex gap-8">
      <Sidebar items={settingsNav} className="sticky top-20 h-fit hidden md:block" />
      <main className="flex-1 py-6 min-w-0">
        {children}
      </main>
    </div>
  );
}
