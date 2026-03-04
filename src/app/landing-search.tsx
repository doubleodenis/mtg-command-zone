"use client";

import { useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { PlayerSearchInput } from "@/components/ui/player-search-input";

export function LandingSearch() {
  const handleSearch = useCallback(async (query: string) => {
    const supabase = createClient();

    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .limit(5);

    return data || [];
  }, []);

  return (
    <div className="flex justify-center">
      <PlayerSearchInput
        onSearch={handleSearch}
        placeholder="Search for a player..."
        className="w-full max-w-xl"
      />
    </div>
  );
}
