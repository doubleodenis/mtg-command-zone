import Link from "next/link";
import { User, ShieldCheck, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfileById } from "@/lib/supabase/profiles";
import { PageHeader } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";

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
          icon={<User className="w-5 h-5" />}
          title="Profile"
          description="Update your username and avatar"
        />
        <SettingsLink
          href="/settings/account"
          icon={<ShieldCheck className="w-5 h-5" />}
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
            <ChevronRight className="w-5 h-5 text-text-3 group-hover:text-text-2 transition-colors" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
