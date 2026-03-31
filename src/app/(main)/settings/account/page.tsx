import { createClient } from "@/lib/supabase/server";
import AccountSettingsContent from "./account-settings-content";

export default async function AccountSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Get the provider from the user's identity
  const provider = user.app_metadata?.provider || user.identities?.[0]?.provider || null;

  return (
    <AccountSettingsContent
      email={user.email || "No email"}
      provider={provider}
      createdAt={user.created_at}
    />
  );
}
