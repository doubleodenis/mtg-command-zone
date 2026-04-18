// import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/features/navbar";
import { TabNav, type NavItem } from "@/components/layout";
import { createClient } from "@/lib/supabase/client";

// Nav items shown when logged in (personal dashboard)
const authenticatedNav: NavItem[] = [
  { label: "Overview", href: "/dashboard" },
  { label: "Matches", href: "/matches" },
  { label: "Decks", href: "/decks" },
  { label: "Collections", href: "/collections" },
  { label: "Friends", href: "/friends" },
];

// Nav items shown when logged out (global dashboard)
const publicNav: NavItem[] = [
  { label: "Overview", href: "/dashboard" },
  { label: "Leaderboards", href: "/leaderboards" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const navItems = user ? authenticatedNav : publicNav;

  return (
    <div className="min-h-screen bg-bg-base">
      <Navbar />
      <TabNav items={navItems} />
      <main className="max-w-6xl md:min-w-3xl lg:min-w-4xl md:mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
