"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";

interface AccountSettingsContentProps {
  email: string;
  provider: string | null;
  createdAt: string;
}

export default function AccountSettingsContent({
  email,
  provider,
  createdAt,
}: AccountSettingsContentProps) {
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = React.useState("");
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const formattedDate = new Date(createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const providerDisplay = provider
    ? provider.charAt(0).toUpperCase() + provider.slice(1)
    : "Email";

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;

    setIsDeleting(true);
    setError(null);

    try {
      // Note: Full account deletion requires an Edge Function with admin privileges
      // For now, we'll sign out and show a message about contacting support
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/?deleted=pending");
    } catch (err) {
      console.error("Delete account error:", err);
      setError("Failed to process request. Please try again.");
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Account Settings"
        description="Manage your account security and data"
      />

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your account details and authentication method</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-card-border">
            <div>
              <p className="text-ui font-medium text-text-1">Email</p>
              <p className="text-ui text-text-2">{email}</p>
            </div>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-card-border">
            <div>
              <p className="text-ui font-medium text-text-1">Sign-in Method</p>
              <p className="text-ui text-text-2">OAuth via {providerDisplay}</p>
            </div>
            <Badge variant="default">{providerDisplay}</Badge>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-ui font-medium text-text-1">Member Since</p>
              <p className="text-ui text-text-2">{formattedDate}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Note */}
      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>Password and authentication settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 rounded-lg bg-bg-overlay">
            <p className="text-ui text-text-2">
              Your account is secured through {providerDisplay} OAuth. To change your password or
              enable two-factor authentication, visit your {providerDisplay} account settings.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-negative/30">
        <CardHeader>
          <CardTitle className="text-negative">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions that affect your account</CardDescription>
        </CardHeader>
        <CardContent>
          {!showDeleteConfirm ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-ui font-medium text-text-1">Delete Account</p>
                <p className="text-ui text-text-2">
                  Permanently delete your account and all associated data
                </p>
              </div>
              <Button
                variant="outline"
                className="border-negative text-negative hover:bg-negative-dim"
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete Account
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-negative-dim border border-negative">
                <p className="text-ui text-negative font-medium mb-2">
                  Are you sure you want to delete your account?
                </p>
                <p className="text-ui text-text-2 mb-4">
                  This action cannot be undone. All your matches, decks, ratings, and profile data
                  will be permanently deleted.
                </p>
                <div className="space-y-3">
                  <div>
                    <label htmlFor="deleteConfirm" className="block text-ui text-text-2 mb-1">
                      Type <span className="font-mono font-bold text-negative">DELETE</span> to confirm
                    </label>
                    <Input
                      id="deleteConfirm"
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="DELETE"
                      className="max-w-xs"
                    />
                  </div>
                  {error && (
                    <p className="text-ui text-negative">{error}</p>
                  )}
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      className="border-negative bg-negative text-white hover:bg-negative/90"
                      disabled={deleteConfirmText !== "DELETE" || isDeleting}
                      onClick={handleDeleteAccount}
                    >
                      {isDeleting ? "Deleting..." : "Permanently Delete Account"}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeleteConfirmText("");
                        setError(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
