import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/features/navbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Dashboard Navigation */}
      <nav className="border-b border-surface-border bg-background-secondary">
        <div className="container mx-auto px-4">
          <div className="flex gap-6 overflow-x-auto">
            <NavLink href="/dashboard">Overview</NavLink>
            <NavLink href="/dashboard/matches/new">New Match</NavLink>
            <NavLink href="/dashboard/commanders">Commanders</NavLink>
            <NavLink href="/dashboard/friends">Friends</NavLink>
            <NavLink href="/dashboard/groups">Groups</NavLink>
            <NavLink href="/dashboard/settings">Settings</NavLink>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="py-3 px-1 text-sm text-foreground-muted hover:text-foreground border-b-2 border-transparent hover:border-accent transition-colors whitespace-nowrap"
    >
      {children}
    </Link>
  );
}
