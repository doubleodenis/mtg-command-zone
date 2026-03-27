import { createClient } from "@/lib/supabase/server";
import { getProfileById } from "@/lib/supabase/profiles";
import ProfileSettingsContent from "./profile-settings-content";

export default async function ProfileSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const profileResult = await getProfileById(supabase, user.id);
  const profile = profileResult.success ? profileResult.data : null;

  return (
    <ProfileSettingsContent
      profile={profile ? { username: profile.username, avatarUrl: profile.avatarUrl } : null}
      userId={user.id}
    />
  );
}
