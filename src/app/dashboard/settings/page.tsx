"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

type ProfileRow = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadProfile = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single() as { data: ProfileRow | null };

      if (data) {
        setProfile(data as Profile);
        setUsername(data.username);
        setDisplayName(data.display_name || "");
        setAvatarUrl(data.avatar_url || "");
      }

      setIsLoading(false);
    };

    loadProfile();
  }, [router]);

  const saveProfile = async () => {
    if (!profile) return;

    // Validate username
    if (!username.trim()) {
      setError("Username is required");
      return;
    }

    if (username.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      setError("Username can only contain letters, numbers, underscores, and hyphens");
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    const supabase = createClient();

    // Check if username is taken (if changed)
    if (username !== profile.username) {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", username)
        .neq("id", profile.id)
        .single();

      if (existing) {
        setError("Username is already taken");
        setIsSaving(false);
        return;
      }
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        username: username.trim(),
        display_name: displayName.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", profile.id);

    if (updateError) {
      setError("Failed to update profile");
    } else {
      setSuccess("Profile updated successfully");
      setProfile({
        ...profile,
        username,
        display_name: displayName || null,
        avatar_url: avatarUrl || null,
      });
    }

    setIsSaving(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be less than 2MB");
      return;
    }

    const supabase = createClient();
    const fileExt = file.name.split(".").pop();
    const fileName = `${profile.id}-${Date.now()}.${fileExt}`;

    const { data, error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      setError("Failed to upload avatar");
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("avatars")
      .getPublicUrl(data.path);

    setAvatarUrl(publicUrl);
    setSuccess("Avatar uploaded. Click Save to apply changes.");
  };

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-foreground-muted">
          Manage your profile and account settings.
        </p>
      </div>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <Avatar
              src={avatarUrl || profile?.avatar_url}
              fallback={displayName || username}
              size="lg"
            />
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Upload Avatar
              </Button>
              <p className="text-xs text-foreground-muted mt-1">
                JPG, PNG, or GIF. Max 2MB.
              </p>
            </div>
          </div>

          {/* Avatar URL */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Avatar URL (or use upload)
            </label>
            <Input
              placeholder="https://example.com/avatar.jpg"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
            />
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Username *
            </label>
            <Input
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
            />
            <p className="text-xs text-foreground-muted mt-1">
              Your profile URL: /player/{username}
            </p>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Display Name
            </label>
            <Input
              placeholder="John Doe"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <p className="text-xs text-foreground-muted mt-1">
              How you appear to other players.
            </p>
          </div>

          {/* Messages */}
          {error && (
            <div className="p-3 rounded-lg bg-loss/10 text-loss text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 rounded-lg bg-win/10 text-win text-sm">
              {success}
            </div>
          )}

          {/* Save Button */}
          <Button onClick={saveProfile} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      {/* Account Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-surface">
            <div>
              <div className="font-medium">Sign Out</div>
              <div className="text-sm text-foreground-muted">
                Sign out of your account on this device.
              </div>
            </div>
            <Button variant="outline" onClick={signOut}>
              Sign Out
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-surface border border-loss/20">
            <div>
              <div className="font-medium text-loss">Delete Account</div>
              <div className="text-sm text-foreground-muted">
                Permanently delete your account and all data.
              </div>
            </div>
            <Button variant="destructive" disabled>
              Delete
            </Button>
          </div>
          <p className="text-xs text-foreground-muted">
            Account deletion is not yet available. Contact support to request deletion.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
