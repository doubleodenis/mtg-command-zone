"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";

interface ProfileFormProps {
  initialUsername: string;
  initialDisplayName: string | null;
  initialAvatarUrl: string | null;
  userId: string;
}

function ProfileForm({ initialUsername, initialDisplayName, initialAvatarUrl, userId }: ProfileFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const [username, setUsername] = React.useState(initialUsername);
  const [displayName, setDisplayName] = React.useState(initialDisplayName || "");
  const [avatarUrl, setAvatarUrl] = React.useState(initialAvatarUrl || "");

  const hasChanges = username !== initialUsername || displayName !== (initialDisplayName || "") || avatarUrl !== (initialAvatarUrl || "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasChanges) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const supabase = createClient();

      // Validate username
      const trimmedUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
      if (trimmedUsername.length < 3) {
        setError("Username must be at least 3 characters");
        setIsSubmitting(false);
        return;
      }

      if (trimmedUsername.length > 20) {
        setError("Username must be 20 characters or less");
        setIsSubmitting(false);
        return;
      }

      // Check if username is taken (if changed)
      if (trimmedUsername !== initialUsername) {
        const { data: existingUser } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", trimmedUsername)
          .neq("id", userId)
          .single();

        if (existingUser) {
          setError("Username is already taken");
          setIsSubmitting(false);
          return;
        }
      }

      // Update profile
      const updates: { username?: string; display_name?: string | null; avatar_url?: string | null } = {};
      if (trimmedUsername !== initialUsername) {
        updates.username = trimmedUsername;
      }
      if (displayName !== (initialDisplayName || "")) {
        updates.display_name = displayName.trim() || null;
      }
      if (avatarUrl !== (initialAvatarUrl || "")) {
        updates.avatar_url = avatarUrl || null;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId);

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);
      router.refresh();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Profile update error:", err);
      setError("Failed to update profile. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Current avatar preview */}
      <div className="flex items-center gap-4">
        <Avatar
          src={avatarUrl || undefined}
          fallback={username}
          size="xl"
        />
        <div>
          <p className="text-ui text-text-2">
            Your avatar is synced from your OAuth provider (Google or Discord).
          </p>
          <p className="text-ui text-text-3 mt-1">
            To change it, update your avatar on the respective platform.
          </p>
        </div>
      </div>

      {/* Username field */}
      <div className="space-y-2">
        <label htmlFor="username" className="block text-ui font-medium text-text-1">
          Username
        </label>
        <Input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="your_username"
          className="max-w-sm"
        />
        <p className="text-ui text-text-3">
          Your unique identifier on the platform. Only lowercase letters, numbers, and underscores.
        </p>
      </div>

      {/* Display Name field */}
      <div className="space-y-2">
        <label htmlFor="displayName" className="block text-ui font-medium text-text-1">
          Display Name
          <span className="ml-2 text-ui text-text-3 font-normal">(optional)</span>
        </label>
        <Input
          id="displayName"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your Name"
          className="max-w-sm"
        />
        <p className="text-ui text-text-3">
          How you want to be shown to others. Can include spaces and special characters.
        </p>
      </div>

      {/* Avatar URL field (hidden for now since OAuth provides it) */}
      <div className="space-y-2">
        <label htmlFor="avatarUrl" className="block text-ui font-medium text-text-1">
          Custom Avatar URL
          <span className="ml-2 text-ui text-text-3 font-normal">(optional)</span>
        </label>
        <Input
          id="avatarUrl"
          type="url"
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="https://example.com/avatar.png"
          className="max-w-md"
        />
        <p className="text-ui text-text-3">
          Override your OAuth avatar with a custom image URL.
        </p>
      </div>

      {/* Error / Success messages */}
      {error && (
        <div className="p-3 rounded-lg bg-negative-dim border border-negative text-negative text-ui">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-positive-dim border border-positive text-positive text-ui">
          Profile updated successfully!
        </div>
      )}

      {/* Submit button */}
      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={!hasChanges || isSubmitting}
        >
          {isSubmitting ? "Saving..." : "Save Changes"}
        </Button>
        {hasChanges && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setUsername(initialUsername);
              setDisplayName(initialDisplayName || "");
              setAvatarUrl(initialAvatarUrl || "");
            }}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

export default function ProfileSettingsContent({
  profile,
  userId,
}: {
  profile: { username: string; displayName: string | null; avatarUrl: string | null } | null;
  userId: string;
}) {
  if (!profile) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Profile Settings"
          description="Update your public profile information"
        />
        <Card>
          <CardContent className="p-6">
            <p className="text-text-2">Unable to load profile. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile Settings"
        description="Update your public profile information"
      />
      <Card>
        <CardContent className="p-6">
          <ProfileForm
            initialUsername={profile.username}
            initialDisplayName={profile.displayName}
            initialAvatarUrl={profile.avatarUrl}
            userId={userId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
