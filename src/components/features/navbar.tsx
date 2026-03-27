import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { NavbarSearch } from "./navbar-search";
import { ProfileDropdown } from "./profile-dropdown";

type NavbarProfile = {
  username: string;
  avatar_url: string | null;
};

export async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: NavbarProfile | null = null;
  if (user) {
    const { data, error } = await supabase
      .from("profiles")
      .select("username, avatar_url")
      .eq("id", user.id)
      .single();
    
    if (error) {
      // Profile doesn't exist yet - create a fallback from user metadata
      profile = {
        username: user.email?.split("@")[0] || "user",
        avatar_url: user.user_metadata?.avatar_url || null,
      };
    } else {
      profile = data;
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full h-topbar bg-bg-surface/90 backdrop-blur-md border-b border-card-border">
      <div className="max-w-6xl mx-auto px-4 h-full flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 text-wordmark text-text-1 hover:text-accent transition-colors">
          <span className="text-accent">⚔️</span>
          <span>CommandZone</span>
        </Link>

        {/* Search Bar — always visible */}
        <div className="flex-1 max-w-sm mx-8 hidden md:block">
          <NavbarSearch />
        </div>

        {/* Navigation */}
        <nav className="flex items-center gap-3">
          {user && profile ? (
            <>
              <Button asChild size="sm">
                <Link href="/matches/new">New Match</Link>
              </Button>
              <ProfileDropdown
                username={profile.username}
                avatarUrl={profile.avatar_url}
              />
            </>
          ) : (
            <>
              <NavLink href="/login">Log in</NavLink>
              <Button asChild size="sm">
                <Link href="/login">Sign up</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-ui text-text-2 hover:text-text-1 transition-colors px-2 py-1"
    >
      {children}
    </Link>
  );
}
