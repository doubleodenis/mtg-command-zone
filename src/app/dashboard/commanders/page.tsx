"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CommanderPicker } from "@/components/features/commander-picker";
import type { UserCommander } from "@/types/database.types";

export default function CommandersPage() {
  const [commanders, setCommanders] = useState<UserCommander[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedCommander, setSelectedCommander] = useState<{
    scryfall_id: string;
    name: string;
    image_uri: string;
  } | null>(null);

  const loadCommanders = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    const { data } = await supabase
      .from("user_commanders")
      .select("*")
      .eq("user_id", user.id)
      .order("is_favorite", { ascending: false })
      .order("created_at", { ascending: false });

    setCommanders(data || []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadCommanders();
  }, [loadCommanders]);

  const addCommander = async () => {
    if (!selectedCommander) return;

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    const { error } = await supabase.from("user_commanders").insert({
      user_id: user.id,
      scryfall_id: selectedCommander.scryfall_id,
      card_name: selectedCommander.name,
      card_image_uri: selectedCommander.image_uri,
    } as never);

    if (!error) {
      setSelectedCommander(null);
      setShowPicker(false);
      loadCommanders();
    }
  };

  const toggleFavorite = async (commander: UserCommander) => {
    const supabase = createClient();

    const { error } = await supabase
      .from("user_commanders")
      .update({ is_favorite: !commander.is_favorite } as never)
      .eq("id", commander.id);

    if (!error) {
      loadCommanders();
    }
  };

  const removeCommander = async (id: string) => {
    const supabase = createClient();

    const { error } = await supabase
      .from("user_commanders")
      .delete()
      .eq("id", id);

    if (!error) {
      loadCommanders();
    }
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
          <h1 className="text-2xl font-bold">My Commanders</h1>
          <p className="text-foreground-muted">
            Manage your commander collection for quick selection in matches.
          </p>
        </div>
        <Button onClick={() => setShowPicker(true)}>+ Add Commander</Button>
      </div>

      {/* Add Commander Modal */}
      {showPicker && (
        <Card>
          <CardHeader>
            <CardTitle>Add Commander</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CommanderPicker
              value={selectedCommander}
              onChange={setSelectedCommander}
              placeholder="Search for a commander..."
            />
            <div className="flex gap-2">
              <Button onClick={addCommander} disabled={!selectedCommander}>
                Add to Collection
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowPicker(false);
                  setSelectedCommander(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Commander Grid */}
      {commanders.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {commanders.map((commander) => (
            <div
              key={commander.id}
              className="relative aspect-[3/4] rounded-lg overflow-hidden bg-surface group"
            >
              {commander.card_image_uri && (
                <Image
                  src={commander.card_image_uri}
                  alt={commander.card_name}
                  fill
                  className="object-cover"
                />
              )}
              
              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              
              {/* Favorite star */}
              <button
                onClick={() => toggleFavorite(commander)}
                className="absolute top-2 right-2 text-xl transition-transform hover:scale-110"
              >
                {commander.is_favorite ? "⭐" : "☆"}
              </button>

              {/* Info overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="text-sm font-medium truncate mb-2">
                  {commander.card_name}
                </div>
                <button
                  onClick={() => removeCommander(commander.id)}
                  className="text-xs text-loss hover:underline"
                >
                  Remove
                </button>
              </div>

              {/* Favorite badge */}
              {commander.is_favorite && (
                <Badge className="absolute top-2 left-2">Favorite</Badge>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-4xl mb-4">👑</div>
            <h3 className="text-lg font-medium mb-2">No commanders yet</h3>
            <p className="text-foreground-muted mb-4">
              Add commanders to your collection for quick selection when recording matches.
            </p>
            <Button onClick={() => setShowPicker(true)}>Add Your First Commander</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
