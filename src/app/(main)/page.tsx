import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PageHeader, Section } from "@/components/layout";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    return <PersonalDashboard userId={user.id} />;
  }

  return <GlobalDashboard />;
}

// ============================================
// Global Dashboard (Logged Out)
// ============================================

function GlobalDashboard() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Welcome to CommandZone"
        description="Track your Commander matches, compete with friends, and climb the leaderboards"
        actions={
          <Button asChild>
            <Link href="/login">Get Started</Link>
          </Button>
        }
      />

      {/* Platform Stats */}
      <Section title="PLATFORM STATS">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Matches" value="—" />
          <StatCard label="Active Players" value="—" />
          <StatCard label="Commanders Played" value="—" />
          <StatCard label="Collections" value="—" />
        </div>
      </Section>

      {/* Leaderboards Preview */}
      <Section title="TOP PLAYERS">
        <Card>
          <CardContent className="p-6">
            <p className="text-text-2 text-center py-8">
              Leaderboard data will appear here once matches are recorded.
            </p>
            <div className="flex justify-center">
              <Button variant="secondary" asChild>
                <Link href="/leaderboards">View All Leaderboards</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* Recent Matches */}
      <Section title="RECENT MATCHES">
        <Card>
          <CardContent className="p-6">
            <p className="text-text-2 text-center py-8">
              Recent platform activity will appear here.
            </p>
          </CardContent>
        </Card>
      </Section>

      {/* CTA */}
      <Card className="border-accent-ring bg-accent-dim/50">
        <CardContent className="p-8 text-center">
          <h2 className="font-display text-2xl font-bold text-text-1 mb-2">
            Ready to track your games?
          </h2>
          <p className="text-text-2 mb-6">
            Sign up to record matches, track your rating, and compete with friends.
          </p>
          <Button asChild size="lg">
            <Link href="/login">Create Account</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// Personal Dashboard (Logged In)
// ============================================

async function PersonalDashboard({ userId }: { userId: string }) {
  const supabase = await createClient();
  
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name")
    .eq("id", userId)
    .single() as { data: { username: string; display_name: string | null } | null };

  const displayName = profile?.display_name ?? profile?.username ?? "Commander";

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back, ${displayName}!`}
        description="Here's what's happening with your matches"
        actions={
          <Button asChild>
            <Link href="/matches/new">New Match</Link>
          </Button>
        }
      />

      {/* Quick Stats */}
      <Section title="YOUR STATS">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Rating" value="1000" sublabel="FFA" />
          <StatCard label="Win Rate" value="—%" />
          <StatCard label="Matches" value="0" />
          <StatCard label="Decks" value="0" />
        </div>
      </Section>

      {/* Pending Confirmations */}
      <Section title="PENDING CONFIRMATIONS">
        <Card>
          <CardContent className="p-6">
            <p className="text-text-2 text-center py-4">
              No pending match confirmations.
            </p>
          </CardContent>
        </Card>
      </Section>

      {/* Recent Matches */}
      <Section title="RECENT MATCHES">
        <Card>
          <CardContent className="p-6">
            <p className="text-text-2 text-center py-4">
              You haven't recorded any matches yet.
            </p>
            <div className="flex justify-center">
              <Button variant="secondary" asChild>
                <Link href="/matches/new">Record Your First Match</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* Collections Activity */}
      <Section title="COLLECTION ACTIVITY">
        <Card>
          <CardContent className="p-6">
            <p className="text-text-2 text-center py-4">
              Join or create a collection to see activity here.
            </p>
            <div className="flex justify-center">
              <Button variant="secondary" asChild>
                <Link href="/collections">Browse Collections</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </Section>
    </div>
  );
}

// ============================================
// Shared Components
// ============================================

function StatCard({ 
  label, 
  value, 
  sublabel 
}: { 
  label: string; 
  value: string; 
  sublabel?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sublabel text-text-2 mb-1">{label}</p>
        <p className="text-stat text-text-1">{value}</p>
        {sublabel && (
          <p className="text-mono-xs text-text-2 mt-1">{sublabel}</p>
        )}
      </CardContent>
    </Card>
  );
}
