export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_commanders: {
        Row: {
          id: string;
          user_id: string;
          scryfall_id: string;
          card_name: string;
          card_image_uri: string | null;
          is_favorite: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          scryfall_id: string;
          card_name: string;
          card_image_uri?: string | null;
          is_favorite?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          scryfall_id?: string;
          card_name?: string;
          card_image_uri?: string | null;
          is_favorite?: boolean;
          created_at?: string;
        };
      };
      friendships: {
        Row: {
          id: string;
          requester_id: string;
          addressee_id: string;
          status: "pending" | "accepted" | "declined" | "blocked";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          requester_id: string;
          addressee_id: string;
          status?: "pending" | "accepted" | "declined" | "blocked";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          requester_id?: string;
          addressee_id?: string;
          status?: "pending" | "accepted" | "declined" | "blocked";
          created_at?: string;
          updated_at?: string;
        };
      };
      groups: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          creator_id: string;
          is_public: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          creator_id: string;
          is_public?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          creator_id?: string;
          is_public?: boolean;
          created_at?: string;
        };
      };
      group_members: {
        Row: {
          group_id: string;
          user_id: string;
          role: "owner" | "admin" | "member";
          joined_at: string;
        };
        Insert: {
          group_id: string;
          user_id: string;
          role?: "owner" | "admin" | "member";
          joined_at?: string;
        };
        Update: {
          group_id?: string;
          user_id?: string;
          role?: "owner" | "admin" | "member";
          joined_at?: string;
        };
      };
      matches: {
        Row: {
          id: string;
          format: "1v1" | "2v2" | "multiplayer";
          date_played: string;
          duration_minutes: number | null;
          group_id: string | null;
          notes: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          format: "1v1" | "2v2" | "multiplayer";
          date_played?: string;
          duration_minutes?: number | null;
          group_id?: string | null;
          notes?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          format?: "1v1" | "2v2" | "multiplayer";
          date_played?: string;
          duration_minutes?: number | null;
          group_id?: string | null;
          notes?: string | null;
          created_by?: string;
          created_at?: string;
        };
      };
      match_participants: {
        Row: {
          id: string;
          match_id: string;
          user_id: string;
          commander_id: string | null;
          commander_name: string | null;
          commander_image_uri: string | null;
          team: number | null;
          placement: number | null;
          is_winner: boolean;
        };
        Insert: {
          id?: string;
          match_id: string;
          user_id: string;
          commander_id?: string | null;
          commander_name?: string | null;
          commander_image_uri?: string | null;
          team?: number | null;
          placement?: number | null;
          is_winner?: boolean;
        };
        Update: {
          id?: string;
          match_id?: string;
          user_id?: string;
          commander_id?: string | null;
          commander_name?: string | null;
          commander_image_uri?: string | null;
          team?: number | null;
          placement?: number | null;
          is_winner?: boolean;
        };
      };
      guest_participants: {
        Row: {
          id: string;
          match_id: string;
          guest_name: string;
          commander_name: string | null;
          commander_image_uri: string | null;
          team: number | null;
          placement: number | null;
          is_winner: boolean;
        };
        Insert: {
          id?: string;
          match_id: string;
          guest_name: string;
          commander_name?: string | null;
          commander_image_uri?: string | null;
          team?: number | null;
          placement?: number | null;
          is_winner?: boolean;
        };
        Update: {
          id?: string;
          match_id?: string;
          guest_name?: string;
          commander_name?: string | null;
          commander_image_uri?: string | null;
          team?: number | null;
          placement?: number | null;
          is_winner?: boolean;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_user_stats: {
        Args: { user_id: string };
        Returns: {
          total_matches: number;
          wins: number;
          losses: number;
          win_rate: number;
          current_streak: number;
          streak_type: string;
        };
      };
      get_top_commanders: {
        Args: { limit_count?: number };
        Returns: {
          commander_name: string;
          commander_image_uri: string;
          match_count: number;
        }[];
      };
      get_leaderboard: {
        Args: { limit_count?: number };
        Returns: {
          user_id: string;
          username: string;
          avatar_url: string;
          win_rate: number;
          total_matches: number;
        }[];
      };
    };
    Enums: {
      friendship_status: "pending" | "accepted" | "declined" | "blocked";
      group_role: "owner" | "admin" | "member";
      match_format: "1v1" | "2v2" | "multiplayer";
    };
  };
};

// Helper types
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type UserCommander = Database["public"]["Tables"]["user_commanders"]["Row"];
export type Friendship = Database["public"]["Tables"]["friendships"]["Row"];
export type Group = Database["public"]["Tables"]["groups"]["Row"];
export type GroupMember = Database["public"]["Tables"]["group_members"]["Row"];
export type Match = Database["public"]["Tables"]["matches"]["Row"];
export type MatchParticipant = Database["public"]["Tables"]["match_participants"]["Row"];
export type GuestParticipant = Database["public"]["Tables"]["guest_participants"]["Row"];
export type MatchFormat = Database["public"]["Enums"]["match_format"];
export type FriendshipStatus = Database["public"]["Enums"]["friendship_status"];
export type GroupRole = Database["public"]["Enums"]["group_role"];
