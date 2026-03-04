"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CommanderPicker } from "@/components/features/commander-picker";

type MatchFormat = "1v1" | "2v2" | "multiplayer";

interface Participant {
  id: string;
  type: "user" | "guest";
  name: string;
  username?: string;
  avatar_url?: string | null;
  commander: {
    scryfall_id: string;
    name: string;
    image_uri: string;
  } | null;
  team?: number;
  isWinner: boolean;
}

export default function NewMatchPage() {
  const router = useRouter();
  const [format, setFormat] = useState<MatchFormat>("multiplayer");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [durationMinutes, setDurationMinutes] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Friend search
  const [friendSearch, setFriendSearch] = useState("");
  const [friendResults, setFriendResults] = useState<Array<{
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  }>>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Guest input
  const [showGuestInput, setShowGuestInput] = useState(false);
  const [guestName, setGuestName] = useState("");

  const searchFriends = useCallback(async (query: string) => {
    if (query.length < 2) {
      setFriendResults([]);
      return;
    }

    setIsSearching(true);
    const supabase = createClient();

    // Search all profiles (can add friends later, but for now search all)
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .limit(5);

    setFriendResults(data || []);
    setIsSearching(false);
  }, []);

  const addParticipant = (user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  }) => {
    if (participants.some((p) => p.id === user.id)) return;

    setParticipants([
      ...participants,
      {
        id: user.id,
        type: "user",
        name: user.display_name || user.username,
        username: user.username,
        avatar_url: user.avatar_url,
        commander: null,
        team: format === "2v2" ? (participants.length < 2 ? 1 : 2) : undefined,
        isWinner: false,
      },
    ]);
    setFriendSearch("");
    setFriendResults([]);
  };

  const addGuest = () => {
    if (!guestName.trim()) return;

    setParticipants([
      ...participants,
      {
        id: `guest-${Date.now()}`,
        type: "guest",
        name: guestName.trim(),
        commander: null,
        team: format === "2v2" ? (participants.length < 2 ? 1 : 2) : undefined,
        isWinner: false,
      },
    ]);
    setGuestName("");
    setShowGuestInput(false);
  };

  const removeParticipant = (id: string) => {
    setParticipants(participants.filter((p) => p.id !== id));
  };

  const updateParticipantCommander = (
    id: string,
    commander: { scryfall_id: string; name: string; image_uri: string } | null
  ) => {
    setParticipants(
      participants.map((p) => (p.id === id ? { ...p, commander } : p))
    );
  };

  const toggleWinner = (id: string) => {
    setParticipants(
      participants.map((p) => (p.id === id ? { ...p, isWinner: !p.isWinner } : p))
    );
  };

  const updateTeam = (id: string, team: number) => {
    setParticipants(
      participants.map((p) => (p.id === id ? { ...p, team } : p))
    );
  };

  const handleSubmit = async () => {
    setError(null);

    // Validation
    if (format === "1v1" && participants.length !== 2) {
      setError("1v1 matches require exactly 2 players");
      return;
    }
    if (format === "2v2" && participants.length !== 4) {
      setError("2v2 matches require exactly 4 players");
      return;
    }
    if (format === "multiplayer" && participants.length < 2) {
      setError("Multiplayer matches require at least 2 players");
      return;
    }
    if (!participants.some((p) => p.isWinner)) {
      setError("Please select at least one winner");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setError("You must be logged in to create a match");
        return;
      }

      // Create the match
      const { data: match, error: matchError } = await supabase
        .from("matches")
        .insert({
          format,
          duration_minutes: durationMinutes ? parseInt(durationMinutes) : null,
          notes: notes || null,
          created_by: user.id,
        } as never)
        .select()
        .single();

      if (matchError) throw matchError;

      const matchId = (match as { id: string })?.id;
      if (!matchId) throw new Error("Match ID not returned");

      // Add participants
      const userParticipants = participants.filter((p) => p.type === "user");
      const guestParticipants = participants.filter((p) => p.type === "guest");

      if (userParticipants.length > 0) {
        const { error: participantError } = await supabase
          .from("match_participants")
          .insert(
            userParticipants.map((p, index) => ({
              match_id: matchId,
              user_id: p.id,
              commander_name: p.commander?.name || null,
              commander_image_uri: p.commander?.image_uri || null,
              team: p.team || null,
              placement: p.isWinner ? 1 : index + 2,
              is_winner: p.isWinner,
            })) as never
          );

        if (participantError) throw participantError;
      }

      if (guestParticipants.length > 0) {
        const { error: guestError } = await supabase
          .from("guest_participants")
          .insert(
            guestParticipants.map((p, index) => ({
              match_id: matchId,
              guest_name: p.name,
              commander_name: p.commander?.name || null,
              commander_image_uri: p.commander?.image_uri || null,
              team: p.team || null,
              placement: p.isWinner ? 1 : userParticipants.length + index + 2,
              is_winner: p.isWinner,
            })) as never
          );

        if (guestError) throw guestError;
      }

      router.push(`/match/${matchId}`);
    } catch (err) {
      console.error("Error creating match:", err);
      setError("Failed to create match. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Record New Match</h1>

      {/* Format Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Format</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {(["1v1", "2v2", "multiplayer"] as const).map((f) => (
              <button
                key={f}
                onClick={() => {
                  setFormat(f);
                  // Reset teams when changing format
                  if (f !== "2v2") {
                    setParticipants(participants.map((p) => ({ ...p, team: undefined })));
                  } else {
                    setParticipants(
                      participants.map((p, i) => ({ ...p, team: i < 2 ? 1 : 2 }))
                    );
                  }
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  format === f
                    ? "bg-accent text-white"
                    : "bg-surface hover:bg-surface-hover text-foreground-muted"
                }`}
              >
                {f === "multiplayer" ? "Multiplayer" : f}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Participants */}
      <Card>
        <CardHeader>
          <CardTitle>Players</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Participant List */}
          {participants.length > 0 && (
            <div className="space-y-3">
              {participants.map((participant) => (
                <div
                  key={participant.id}
                  className={`p-4 rounded-lg border transition-colors ${
                    participant.isWinner
                      ? "bg-win/10 border-win/30"
                      : "bg-surface border-surface-border"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{participant.name}</span>
                      {participant.type === "guest" && (
                        <Badge variant="outline">Guest</Badge>
                      )}
                      {format === "2v2" && (
                        <select
                          value={participant.team}
                          onChange={(e) =>
                            updateTeam(participant.id, parseInt(e.target.value))
                          }
                          className="bg-surface border border-surface-border rounded px-2 py-1 text-sm"
                        >
                          <option value={1}>Team 1</option>
                          <option value={2}>Team 2</option>
                        </select>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleWinner(participant.id)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                          participant.isWinner
                            ? "bg-win text-white"
                            : "bg-surface-hover text-foreground-muted hover:text-foreground"
                        }`}
                      >
                        {participant.isWinner ? "👑 Winner" : "Set Winner"}
                      </button>
                      <button
                        onClick={() => removeParticipant(participant.id)}
                        className="p-1 text-foreground-muted hover:text-loss transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Commander Picker */}
                  <CommanderPicker
                    value={participant.commander}
                    onChange={(commander) =>
                      updateParticipantCommander(participant.id, commander)
                    }
                    placeholder={`Select ${participant.name}'s commander...`}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Add Player */}
          <div className="space-y-3">
            <div className="relative">
              <Input
                placeholder="Search for a player..."
                value={friendSearch}
                onChange={(e) => {
                  setFriendSearch(e.target.value);
                  searchFriends(e.target.value);
                }}
              />
              {friendResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-background-secondary border border-surface-border rounded-lg shadow-xl z-10 overflow-hidden">
                  {friendResults.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => addParticipant(user)}
                      className="w-full px-4 py-2 flex items-center gap-3 hover:bg-surface transition-colors text-left"
                    >
                      <div className="h-8 w-8 rounded-full bg-surface flex items-center justify-center text-foreground-muted text-sm">
                        {user.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium">
                          {user.display_name || user.username}
                        </div>
                        <div className="text-xs text-foreground-muted">
                          @{user.username}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Add Guest */}
            {showGuestInput ? (
              <div className="flex gap-2">
                <Input
                  placeholder="Guest name..."
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addGuest()}
                />
                <Button onClick={addGuest}>Add</Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setShowGuestInput(false);
                    setGuestName("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="secondary"
                onClick={() => setShowGuestInput(true)}
                className="w-full"
              >
                + Add Guest Player
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Match Details */}
      <Card>
        <CardHeader>
          <CardTitle>Details (Optional)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm text-foreground-muted mb-1">
              Duration (minutes)
            </label>
            <Input
              type="number"
              placeholder="e.g., 90"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-foreground-muted mb-1">
              Notes
            </label>
            <textarea
              placeholder="Any memorable moments?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-24 px-4 py-2 bg-surface border border-surface-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="p-4 bg-loss/10 border border-loss/30 rounded-lg text-loss">
          {error}
        </div>
      )}

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={isSubmitting || participants.length < 2}
        className="w-full h-12 text-lg"
      >
        {isSubmitting ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
        ) : (
          "Record Match"
        )}
      </Button>
    </div>
  );
}
