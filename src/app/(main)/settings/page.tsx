import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfileById } from "@/lib/supabase/profiles";
import { PageHeader } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";

// Icons as simple SVG components
function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  );
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const profileResult = await getProfileById(supabase, user.id);
  const profile = profileResult.success ? profileResult.data : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your account and preferences"
      />

      {/* Current account summary */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Avatar
              src={profile?.avatarUrl}
              fallback={profile?.username || user.email?.split("@")[0] || "U"}
              size="lg"
            />
            <div className="flex-1 min-w-0">
              <p className="font-display text-lg text-text-1 truncate">
                @{profile?.username || user.email?.split("@")[0]}
              </p>
              <p className="text-ui text-text-2 truncate">{user.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settings sections */}
      <div className="grid gap-4">
        <SettingsLink
          href="/settings/profile"
          icon={<UserIcon className="w-5 h-5" />}
          title="Profile"
          description="Update your username and avatar"
        />
        <SettingsLink
          href="/settings/account"
          icon={<ShieldIcon className="w-5 h-5" />}
          title="Account"
          description="Email, security, and account management"
        />
      </div>
    </div>
  );
}

interface SettingsLinkProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}

function SettingsLink({ href, icon, title, description }: SettingsLinkProps) {
  return (
    <Link href={href} className="block group">
      <Card className="transition-colors hover:border-card-border-hi">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-bg-overlay flex items-center justify-center text-text-2 group-hover:text-accent group-hover:bg-accent-dim transition-colors">
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-text-1 group-hover:text-accent transition-colors">
                {title}
              </p>
              <p className="text-ui text-text-2">{description}</p>
            </div>
            <ChevronRightIcon className="w-5 h-5 text-text-3 group-hover:text-text-2 transition-colors" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
