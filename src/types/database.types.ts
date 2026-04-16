export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          backdate_limit_days: number
          created_at: string | null
          key: string
          lock_window_hours: number
          updated_at: string | null
        }
        Insert: {
          backdate_limit_days?: number
          created_at?: string | null
          key: string
          lock_window_hours?: number
          updated_at?: string | null
        }
        Update: {
          backdate_limit_days?: number
          created_at?: string | null
          key?: string
          lock_window_hours?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      collection_matches: {
        Row: {
          added_at: string | null
          added_by: string
          approval_status: Database["public"]["Enums"]["approval_status"]
          collection_id: string
          id: string
          match_id: string
        }
        Insert: {
          added_at?: string | null
          added_by: string
          approval_status?: Database["public"]["Enums"]["approval_status"]
          collection_id: string
          id?: string
          match_id: string
        }
        Update: {
          added_at?: string | null
          added_by?: string
          approval_status?: Database["public"]["Enums"]["approval_status"]
          collection_id?: string
          id?: string
          match_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_matches_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_matches_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_matches_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_members: {
        Row: {
          collection_id: string
          id: string
          joined_at: string | null
          role: Database["public"]["Enums"]["collection_role"]
          user_id: string
        }
        Insert: {
          collection_id: string
          id?: string
          joined_at?: string | null
          role?: Database["public"]["Enums"]["collection_role"]
          user_id: string
        }
        Update: {
          collection_id?: string
          id?: string
          joined_at?: string | null
          role?: Database["public"]["Enums"]["collection_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_members_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          auto_approve_members: boolean
          created_at: string | null
          description: string | null
          id: string
          is_public: boolean
          match_add_permission: Database["public"]["Enums"]["match_add_permission"]
          name: string
          owner_id: string
        }
        Insert: {
          auto_approve_members?: boolean
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean
          match_add_permission?: Database["public"]["Enums"]["match_add_permission"]
          name: string
          owner_id: string
        }
        Update: {
          auto_approve_members?: boolean
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean
          match_add_permission?: Database["public"]["Enums"]["match_add_permission"]
          name?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      decks: {
        Row: {
          bracket: number
          color_identity: string[]
          commander_image_uri: string | null
          commander_name: string
          commander_scryfall_id: string | null
          created_at: string | null
          deck_name: string | null
          id: string
          is_active: boolean
          owner_id: string
          partner_image_uri: string | null
          partner_name: string | null
          partner_scryfall_id: string | null
        }
        Insert: {
          bracket?: number
          color_identity?: string[]
          commander_image_uri?: string | null
          commander_name: string
          commander_scryfall_id?: string | null
          created_at?: string | null
          deck_name?: string | null
          id?: string
          is_active?: boolean
          owner_id: string
          partner_image_uri?: string | null
          partner_name?: string | null
          partner_scryfall_id?: string | null
        }
        Update: {
          bracket?: number
          color_identity?: string[]
          commander_image_uri?: string | null
          commander_name?: string
          commander_scryfall_id?: string | null
          created_at?: string | null
          deck_name?: string | null
          id?: string
          is_active?: boolean
          owner_id?: string
          partner_image_uri?: string | null
          partner_name?: string | null
          partner_scryfall_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      formats: {
        Row: {
          config: Json
          has_teams: boolean
          id: string
          is_active: boolean
          max_players: number | null
          min_players: number
          name: string
          slug: string
          win_condition_type: Database["public"]["Enums"]["win_condition_type"]
        }
        Insert: {
          config?: Json
          has_teams?: boolean
          id?: string
          is_active?: boolean
          max_players?: number | null
          min_players: number
          name: string
          slug: string
          win_condition_type: Database["public"]["Enums"]["win_condition_type"]
        }
        Update: {
          config?: Json
          has_teams?: boolean
          id?: string
          is_active?: boolean
          max_players?: number | null
          min_players?: number
          name?: string
          slug?: string
          win_condition_type?: Database["public"]["Enums"]["win_condition_type"]
        }
        Relationships: []
      }
      friends: {
        Row: {
          addressee_id: string
          created_at: string | null
          id: string
          requester_id: string
          status: Database["public"]["Enums"]["friendship_status"]
        }
        Insert: {
          addressee_id: string
          created_at?: string | null
          id?: string
          requester_id: string
          status?: Database["public"]["Enums"]["friendship_status"]
        }
        Update: {
          addressee_id?: string
          created_at?: string | null
          id?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["friendship_status"]
        }
        Relationships: [
          {
            foreignKeyName: "friends_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friends_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_matches: {
        Row: {
          added_at: string | null
          added_by: string
          group_id: string
          id: string
          match_id: string
          notes: string | null
        }
        Insert: {
          added_at?: string | null
          added_by: string
          group_id: string
          id?: string
          match_id: string
          notes?: string | null
        }
        Update: {
          added_at?: string | null
          added_by?: string
          group_id?: string
          id?: string
          match_id?: string
          notes?: string | null
        }
        Relationships: []
      }
      match_invite_tokens: {
        Row: {
          id: string
          match_id: string
          participant_id: string | null
          token: string
          created_by: string
          created_at: string
          expires_at: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          id?: string
          match_id: string
          participant_id?: string | null
          token: string
          created_by: string
          created_at?: string
          expires_at?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          id?: string
          match_id?: string
          participant_id?: string | null
          token?: string
          created_by?: string
          created_at?: string
          expires_at?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_invite_tokens_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_invite_tokens_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "match_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_invite_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_invite_tokens_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_participants: {
        Row: {
          claim_status: Database["public"]["Enums"]["claim_status"]
          claimed_by: string | null
          confirmed_at: string | null
          created_at: string | null
          deck_id: string | null
          id: string
          is_winner: boolean
          match_id: string
          participant_data: Json
          participant_status: Database["public"]["Enums"]["participant_status"]
          placeholder_name: string | null
          team: string | null
          user_id: string | null
        }
        Insert: {
          claim_status?: Database["public"]["Enums"]["claim_status"]
          claimed_by?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          deck_id?: string | null
          id?: string
          is_winner?: boolean
          match_id: string
          participant_data?: Json
          participant_status?: Database["public"]["Enums"]["participant_status"]
          placeholder_name?: string | null
          team?: string | null
          user_id?: string | null
        }
        Update: {
          claim_status?: Database["public"]["Enums"]["claim_status"]
          claimed_by?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          deck_id?: string | null
          id?: string
          is_winner?: boolean
          match_id?: string
          participant_data?: Json
          participant_status?: Database["public"]["Enums"]["participant_status"]
          placeholder_name?: string | null
          team?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_participants_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_participants_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_participants_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          created_at: string | null
          created_by: string
          format_id: string
          id: string
          is_dirty: boolean
          last_recalculated_at: string | null
          locks_at: string
          match_data: Json
          notes: string | null
          played_at: string
          ratings_applied_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          format_id: string
          id?: string
          is_dirty?: boolean
          last_recalculated_at?: string | null
          locks_at?: string
          match_data?: Json
          notes?: string | null
          played_at?: string
          ratings_applied_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          format_id?: string
          id?: string
          is_dirty?: boolean
          last_recalculated_at?: string | null
          locks_at?: string
          match_data?: Json
          notes?: string | null
          played_at?: string
          ratings_applied_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_format_id_fkey"
            columns: ["format_id"]
            isOneToOne: false
            referencedRelation: "formats"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string | null
          data: Json
          dismissed_at: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["notification_entity_type"]
          expires_at: string | null
          id: string
          read_at: string | null
          recipient_id: string
          seen_at: string | null
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string | null
          data?: Json
          dismissed_at?: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["notification_entity_type"]
          expires_at?: string | null
          id?: string
          read_at?: string | null
          recipient_id: string
          seen_at?: string | null
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string | null
          data?: Json
          dismissed_at?: string | null
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["notification_entity_type"]
          expires_at?: string | null
          id?: string
          read_at?: string | null
          recipient_id?: string
          seen_at?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          username?: string
        }
        Relationships: []
      }
      rating_history: {
        Row: {
          algorithm_version: number
          collection_id: string | null
          created_at: string | null
          delta: number
          format_id: string
          id: string
          is_win: boolean
          k_factor: number
          match_id: string
          opponent_avg_bracket: number
          opponent_avg_rating: number
          player_bracket: number
          rating_after: number
          rating_before: number
          user_id: string
        }
        Insert: {
          algorithm_version?: number
          collection_id?: string | null
          created_at?: string | null
          delta: number
          format_id: string
          id?: string
          is_win?: boolean
          k_factor: number
          match_id: string
          opponent_avg_bracket: number
          opponent_avg_rating: number
          player_bracket: number
          rating_after: number
          rating_before: number
          user_id: string
        }
        Update: {
          algorithm_version?: number
          collection_id?: string | null
          created_at?: string | null
          delta?: number
          format_id?: string
          id?: string
          is_win?: boolean
          k_factor?: number
          match_id?: string
          opponent_avg_bracket?: number
          opponent_avg_rating?: number
          player_bracket?: number
          rating_after?: number
          rating_before?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rating_history_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rating_history_format_id_fkey"
            columns: ["format_id"]
            isOneToOne: false
            referencedRelation: "formats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rating_history_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rating_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          collection_id: string | null
          format_id: string
          id: string
          matches_played: number
          rating: number
          updated_at: string | null
          user_id: string
          wins: number
        }
        Insert: {
          collection_id?: string | null
          format_id: string
          id?: string
          matches_played?: number
          rating?: number
          updated_at?: string | null
          user_id: string
          wins?: number
        }
        Update: {
          collection_id?: string | null
          format_id?: string
          id?: string
          matches_played?: number
          rating?: number
          updated_at?: string | null
          user_id?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "ratings_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_format_id_fkey"
            columns: ["format_id"]
            isOneToOne: false
            referencedRelation: "formats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_notifications: { Args: never; Returns: number }
      create_notification: {
        Args: {
          p_actor_id: string
          p_data?: Json
          p_entity_id: string
          p_entity_type: Database["public"]["Enums"]["notification_entity_type"]
          p_recipient_id: string
          p_type: Database["public"]["Enums"]["notification_type"]
        }
        Returns: {
          actor_id: string | null
          created_at: string | null
          data: Json
          dismissed_at: string | null
          entity_id: string
          entity_type: Database["public"]["Enums"]["notification_entity_type"]
          expires_at: string | null
          id: string
          read_at: string | null
          recipient_id: string
          seen_at: string | null
          type: Database["public"]["Enums"]["notification_type"]
        }
        SetofOptions: {
          from: "*"
          to: "notifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      dismiss_notifications: {
        Args: { p_notification_ids?: string[]; p_recipient_id: string }
        Returns: number
      }
      get_deck_stats: {
        Args: { p_deck_id: string }
        Returns: {
          games_played: number
          losses: number
          win_rate: number
          wins: number
        }[]
      }
      get_group_match_count: { Args: { group_uuid: string }; Returns: number }
      get_group_matches: {
        Args: { group_uuid: string; limit_count?: number }
        Returns: {
          added_at: string
          added_by_username: string
          date_played: string
          format: string
          match_id: string
        }[]
      }
      get_group_participants: {
        Args: { group_uuid: string }
        Returns: {
          avatar_url: string
          display_name: string
          matches_in_group: number
          user_id: string
          username: string
          wins_in_group: number
        }[]
      }
      get_group_stats: {
        Args: { group_uuid: string }
        Returns: {
          date_range_end: string
          date_range_start: string
          total_matches: number
          total_participants: number
        }[]
      }
      get_leaderboard:
        | {
            Args: { limit_count?: number }
            Returns: {
              avatar_url: string
              display_name: string
              total_matches: number
              user_id: string
              username: string
              win_rate: number
              wins: number
            }[]
          }
        | {
            Args: {
              p_collection_id?: string
              p_format_id: string
              p_limit?: number
            }
            Returns: {
              avatar_url: string
              matches_played: number
              rank: number
              rating: number
              user_id: string
              username: string
              win_rate: number
              wins: number
            }[]
          }
      get_match_groups: {
        Args: { match_uuid: string }
        Returns: {
          added_at: string
          color: string
          group_id: string
          group_name: string
        }[]
      }
      get_notification_ttl: {
        Args: { p_type: Database["public"]["Enums"]["notification_type"] }
        Returns: string
      }
      get_or_create_rating: {
        Args: {
          p_collection_id?: string
          p_format_id: string
          p_user_id: string
        }
        Returns: {
          collection_id: string | null
          format_id: string
          id: string
          matches_played: number
          rating: number
          updated_at: string | null
          user_id: string
          wins: number
        }
        SetofOptions: {
          from: "*"
          to: "ratings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_top_commanders: {
        Args: { limit_count?: number }
        Returns: {
          commander_image_uri: string
          commander_name: string
          times_played: number
          win_rate: number
          wins: number
        }[]
      }
      get_unread_notification_count: {
        Args: { p_recipient_id: string }
        Returns: number
      }
      get_unseen_notification_count: {
        Args: { p_recipient_id: string }
        Returns: number
      }
      get_user_stats:
        | {
            Args: { p_format_id?: string; p_user_id: string }
            Returns: {
              losses: number
              total_matches: number
              win_rate: number
              wins: number
            }[]
          }
        | {
            Args: { user_uuid: string }
            Returns: {
              losses: number
              total_matches: number
              win_rate: number
              wins: number
            }[]
          }
      mark_notifications_read: {
        Args: { p_notification_ids?: string[]; p_recipient_id: string }
        Returns: number
      }
      mark_notifications_seen: {
        Args: { p_recipient_id: string }
        Returns: number
      }
    }
    Enums: {
      approval_status: "approved" | "pending" | "rejected"
      claim_status: "none" | "pending" | "approved" | "rejected"
      collection_role: "owner" | "member"
      friendship_status: "pending" | "accepted" | "blocked"
      match_add_permission:
        | "owner_only"
        | "any_member"
        | "any_member_approval_required"
      notification_entity_type: "match" | "collection" | "player" | "deck"
      notification_type:
        | "match_pending_confirmation"
        | "match_confirmed"
        | "match_disputed"
        | "match_result_edited"
        | "elo_milestone"
        | "rank_changed"
        | "collection_invite"
        | "collection_match_added"
        | "claim_available"
        | "claim_accepted"
        | "deck_retroactively_updated"
        | "friend_request"
        | "friend_accepted"
      participant_status: "pending" | "confirmed" | "auto_confirmed"
      win_condition_type:
        | "last_standing"
        | "eliminate_team"
        | "eliminate_targets"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      approval_status: ["approved", "pending", "rejected"],
      claim_status: ["none", "pending", "approved", "rejected"],
      collection_role: ["owner", "member"],
      friendship_status: ["pending", "accepted", "blocked"],
      match_add_permission: [
        "owner_only",
        "any_member",
        "any_member_approval_required",
      ],
      notification_entity_type: ["match", "collection", "player", "deck"],
      notification_type: [
        "match_pending_confirmation",
        "match_confirmed",
        "match_disputed",
        "match_result_edited",
        "elo_milestone",
        "rank_changed",
        "collection_invite",
        "collection_match_added",
        "claim_available",
        "claim_accepted",
        "deck_retroactively_updated",
        "friend_request",
        "friend_accepted",
      ],
      win_condition_type: [
        "last_standing",
        "eliminate_team",
        "eliminate_targets",
      ],
    },
  },
} as const
