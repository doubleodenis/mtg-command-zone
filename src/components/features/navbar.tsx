import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/avatar";
import { NavbarSearch } from "./navbar-search";

type NavbarProfile = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

interface NavbarProps {
  hideSearch?: boolean;
}

export async function Navbar({ hideSearch = false }: NavbarProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: NavbarProfile | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("username, display_name, avatar_url")
      .eq("id", user.id)
      .single();
    profile = data as NavbarProfile | null;
  }

  return (
    <header
      className="sticky top-0 z-50 w-full backdrop-blur-md"
      style={{
        backgroundColor: "rgba(10, 10, 15, 0.9)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
      }}
    >
      <div
        style={{
          maxWidth: "72rem",
          marginLeft: "auto",
          marginRight: "auto",
          paddingLeft: "1rem",
          paddingRight: "1rem",
          height: "4rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontWeight: 700,
            fontSize: "1.25rem",
            color: "#ffffff",
            textDecoration: "none",
          }}
        >
          <span style={{ color: "#a855f7" }}>⚔️</span>
          <span>MTG Tracker</span>
        </Link>

        {/* Search Bar */}
        {!hideSearch && (
          <div style={{ flex: 1, maxWidth: "24rem", marginLeft: "2rem", marginRight: "2rem" }}>
            <NavbarSearch />
          </div>
        )}

        {/* Navigation */}
        <nav style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {user && profile ? (
            <>
              <Link
                href="/dashboard"
                style={{ color: "#a1a1aa", fontSize: "0.875rem", fontWeight: 500, textDecoration: "none" }}
              >
                Dashboard
              </Link>
              <Link
                href="/dashboard/matches/new"
                style={{ color: "#a1a1aa", fontSize: "0.875rem", fontWeight: 500, textDecoration: "none" }}
              >
                New Match
              </Link>
              <Link href={`/player/${profile.username}`}>
                <Avatar
                  src={profile.avatar_url}
                  fallback={profile.display_name || profile.username}
                  size="sm"
                />
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                style={{
                  color: "#a1a1aa",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  padding: "0.5rem 1rem",
                  textDecoration: "none",
                }}
              >
                Log in
              </Link>
              <Link
                href="/login"
                style={{
                  backgroundColor: "#a855f7",
                  color: "#fff",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  padding: "0.5rem 1rem",
                  borderRadius: "0.5rem",
                  textDecoration: "none",
                }}
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
