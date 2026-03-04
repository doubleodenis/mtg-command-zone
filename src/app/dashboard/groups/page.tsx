"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { formatRelativeTime } from "@/lib/utils";

interface Group {
  id: string;
  name: string;
  description: string | null;
  creator_id: string;
  created_at: string;
  member_count: number;
  match_count: number;
}

interface GroupMember {
  user_id: string;
  role: "owner" | "admin" | "member";
  profile: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

// Type definitions for query results
type MembershipRow = {
  group_id: string;
};

type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  creator_id: string;
  created_at: string;
};

type GroupMemberRow = {
  user_id: string;
  role: "owner" | "admin" | "member";
  profile: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;
    setUserId(user.id);

    // Get groups the user is part of
    const { data: memberships } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", user.id);

    const typedMemberships = (memberships || []) as unknown as MembershipRow[];

    if (!typedMemberships.length) {
      setIsLoading(false);
      return;
    }

    const groupIds = typedMemberships.map((m) => m.group_id);

    const { data: groupsData } = await supabase
      .from("groups")
      .select("*")
      .in("id", groupIds)
      .order("created_at", { ascending: false });

    const typedGroups = (groupsData || []) as unknown as GroupRow[];

    // Get member counts
    const groupsWithCounts = await Promise.all(
      typedGroups.map(async (group) => {
        const { count: memberCount } = await supabase
          .from("group_members")
          .select("*", { count: "exact", head: true })
          .eq("group_id", group.id);

        const { count: matchCount } = await supabase
          .from("matches")
          .select("*", { count: "exact", head: true })
          .eq("group_id", group.id);

        return {
          ...group,
          member_count: memberCount || 0,
          match_count: matchCount || 0,
        };
      })
    );

    setGroups(groupsWithCounts);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const loadGroupMembers = async (groupId: string) => {
    const supabase = createClient();

    const { data } = await supabase
      .from("group_members")
      .select(`
        user_id,
        role,
        profile:user_id (username, display_name, avatar_url)
      `)
      .eq("group_id", groupId);

    const typedData = (data || []) as unknown as GroupMemberRow[];
    setGroupMembers(
      typedData.filter(m => m.profile).map((m) => ({
        user_id: m.user_id,
        role: m.role,
        profile: m.profile as GroupMember["profile"],
      }))
    );
    setSelectedGroup(groupId);
  };

  const createGroup = async () => {
    if (!newGroupName.trim() || !userId) return;

    setIsCreating(true);
    const supabase = createClient();

    // Create the group
    const { data: group, error } = await supabase
      .from("groups")
      .insert({
        name: newGroupName.trim(),
        description: newGroupDescription.trim() || null,
        creator_id: userId,
      } as never)
      .select()
      .single();

    if (!error && group) {
      const groupId = (group as { id: string }).id;
      // Add creator as owner
      await supabase.from("group_members").insert({
        group_id: groupId,
        user_id: userId,
        role: "owner",
      } as never);

      setShowCreateModal(false);
      setNewGroupName("");
      setNewGroupDescription("");
      loadGroups();
    }

    setIsCreating(false);
  };

  const leaveGroup = async (groupId: string) => {
    if (!userId) return;
    const supabase = createClient();

    await supabase
      .from("group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", userId);

    loadGroups();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Groups</h1>
          <p className="text-foreground-muted">
            Organize matches into groups or tournaments.
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>Create Group</Button>
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Create Group</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <Input
                  placeholder="Friday Night Magic"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Description (optional)
                </label>
                <Input
                  placeholder="Weekly commander games at the shop"
                  value={newGroupDescription}
                  onChange={(e) => setNewGroupDescription(e.target.value)}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button onClick={createGroup} disabled={isCreating}>
                  {isCreating ? "Creating..." : "Create"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Group Members Modal */}
      {selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Group Members</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {groupMembers.map((member) => (
                  <div
                    key={member.user_id}
                    className="flex items-center justify-between p-3 rounded-lg bg-surface"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={member.profile.avatar_url}
                        fallback={member.profile.display_name || member.profile.username}
                        size="md"
                      />
                      <div>
                        <div className="font-medium">
                          {member.profile.display_name || member.profile.username}
                        </div>
                        <div className="text-sm text-foreground-muted">
                          @{member.profile.username}
                        </div>
                      </div>
                    </div>
                    {member.role === "admin" && (
                      <Badge variant="outline">Admin</Badge>
                    )}
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setSelectedGroup(null)}
              >
                Close
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Groups List */}
      {groups.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <Card key={group.id} className="overflow-hidden">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{group.name}</span>
                  {group.creator_id === userId && (
                    <Badge variant="outline">Owner</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {group.description && (
                  <p className="text-sm text-foreground-muted">
                    {group.description}
                  </p>
                )}
                <div className="flex gap-4 text-sm">
                  <div>
                    <span className="text-foreground-muted">Members:</span>{" "}
                    <span className="font-medium">{group.member_count}</span>
                  </div>
                  <div>
                    <span className="text-foreground-muted">Matches:</span>{" "}
                    <span className="font-medium">{group.match_count}</span>
                  </div>
                </div>
                <div className="text-xs text-foreground-muted">
                  Created {formatRelativeTime(group.created_at)}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => loadGroupMembers(group.id)}
                  >
                    Members
                  </Button>
                  {group.creator_id !== userId && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => leaveGroup(group.id)}
                    >
                      Leave
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <div className="text-4xl mb-4">👥</div>
            <h3 className="font-semibold mb-2">No groups yet</h3>
            <p className="text-foreground-muted mb-4">
              Create a group to organize matches and invite friends.
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              Create Your First Group
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
