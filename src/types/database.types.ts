export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string | null
          value?: Json
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
      match_invite_tokens: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          match_id: string
          participant_id: string | null
          token: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          match_id: string
          participant_id?: string | null
          token: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          match_id?: string
          participant_id?: string | null
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_invite_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
          locks_at: string | null
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
          locks_at?: string | null
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
          locks_at?: string | null
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
          triggered_by: string | null
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
          triggered_by?: string | null
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
          triggered_by?: string | null
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
          {
            foreignKeyName: "notifications_triggered_by_fkey"
            columns: ["triggered_by"]
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
          recalculated_at: string | null
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
          recalculated_at?: string | null
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
          recalculated_at?: string | null
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
      recalculation_log: {
        Row: {
          batch_size: number
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          matches_failed: number
          matches_processed: number
          started_at: string
          triggered_by: string
        }
        Insert: {
          batch_size: number
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          matches_failed?: number
          matches_processed?: number
          started_at?: string
          triggered_by?: string
        }
        Update: {
          batch_size?: number
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          matches_failed?: number
          matches_processed?: number
          started_at?: string
          triggered_by?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_rating_change: {
        Args: {
          p_algorithm_version: number
          p_collection_id: string
          p_delta: number
          p_format_id: string
          p_is_win: boolean
          p_k_factor: number
          p_match_id: string
          p_new_rating: number
          p_opponent_avg_bracket: number
          p_opponent_avg_rating: number
          p_player_bracket: number
          p_user_id: string
        }
        Returns: undefined
      }
      auto_confirm_match_participants: {
        Args: { p_match_id: string }
        Returns: undefined
      }
      calculate_bracket_modifier: {
        Args: { p_opponent_avg_bracket: number; p_player_bracket: number }
        Returns: number
      }
      calculate_expected_score: {
        Args: { p_all_ratings: number[]; p_player_rating: number }
        Returns: number
      }
      calculate_rating_delta: {
        Args: {
          p_is_winner: boolean
          p_opponent_brackets: number[]
          p_opponent_ratings: number[]
          p_player_bracket: number
          p_player_match_count: number
          p_player_rating: number
        }
        Returns: {
          bracket_modifier: number
          delta: number
          expected_score: number
          k_factor: number
          opponent_avg_bracket: number
          opponent_avg_rating: number
        }[]
      }
      cleanup_expired_notifications: { Args: never; Returns: number }
      clear_match_dirty_flag: {
        Args: { p_match_id: string }
        Returns: undefined
      }
      complete_recalculation_log: {
        Args: {
          p_error_message?: string
          p_log_id: string
          p_matches_failed?: number
          p_matches_processed: number
        }
        Returns: undefined
      }
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
          triggered_by: string | null
          type: Database["public"]["Enums"]["notification_type"]
        }
        SetofOptions: {
          from: "*"
          to: "notifications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_match_rating_history: {
        Args: { p_match_id: string }
        Returns: number
      }
      dismiss_notifications: {
        Args: { p_notification_ids?: string[]; p_recipient_id: string }
        Returns: number
      }
      generate_invite_token: { Args: { length?: number }; Returns: string }
      get_app_setting: {
        Args: { p_key: string; p_path?: string }
        Returns: Json
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
      get_dirty_matches: {
        Args: never
        Returns: {
          format_id: string
          match_id: string
          participant_count: number
          played_at: string
        }[]
      }
      get_dirty_matches_batch: {
        Args: { p_limit?: number }
        Returns: {
          created_by: string
          format_id: string
          match_id: string
          played_at: string
        }[]
      }
      get_k_factor: { Args: { p_matches_played: number }; Returns: number }
      get_leaderboard: {
        Args: {
          p_collection_id?: string
          p_format_id: string
          p_limit?: number
        }
        Returns: {
          avatar_url: string
          display_name: string
          matches_played: number
          rank: number
          rating: number
          user_id: string
          username: string
          win_rate: number
          wins: number
        }[]
      }
      get_lock_window_hours: { Args: never; Returns: number }
      get_match_participants_for_recalc: {
        Args: { p_match_id: string }
        Returns: {
          deck_bracket: number
          deck_id: string
          is_winner: boolean
          participant_id: string
          team: string
          user_id: string
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
      get_rating_before_match: {
        Args: {
          p_collection_id: string
          p_format_id: string
          p_match_played_at: string
          p_user_id: string
        }
        Returns: number
      }
      get_unread_notification_count: {
        Args: { p_recipient_id: string }
        Returns: number
      }
      get_unseen_notification_count: {
        Args: { p_recipient_id: string }
        Returns: number
      }
      get_user_stats: {
        Args: { p_format_id?: string; p_user_id: string }
        Returns: {
          losses: number
          total_matches: number
          win_rate: number
          wins: number
        }[]
      }
      is_collection_member: {
        Args: { p_collection_id: string; p_user_id: string }
        Returns: boolean
      }
      is_collection_owner: {
        Args: { p_collection_id: string; p_user_id: string }
        Returns: boolean
      }
      is_collection_public: {
        Args: { p_collection_id: string }
        Returns: boolean
      }
      is_match_locked: { Args: { p_match_id: string }; Returns: boolean }
      mark_match_dirty: { Args: { p_match_id: string }; Returns: boolean }
      mark_notifications_read: {
        Args: { p_notification_ids?: string[]; p_recipient_id: string }
        Returns: number
      }
      mark_notifications_seen: {
        Args: { p_recipient_id: string }
        Returns: number
      }
      mark_ratings_applied: { Args: { p_match_id: string }; Returns: undefined }
      process_expired_lock_windows: {
        Args: never
        Returns: {
          match_id: string
          participant_count: number
        }[]
      }
      reset_ratings_for_recalculation: {
        Args: { confirm_reset?: boolean }
        Returns: undefined
      }
      start_recalculation_log: {
        Args: { p_batch_size: number; p_triggered_by?: string }
        Returns: string
      }
      update_rating_history: {
        Args: {
          p_algorithm_version: number
          p_collection_id: string
          p_delta: number
          p_format_id: string
          p_is_win: boolean
          p_k_factor: number
          p_match_id: string
          p_opponent_avg_bracket: number
          p_opponent_avg_rating: number
          p_player_bracket: number
          p_rating_after: number
          p_rating_before: number
          p_user_id: string
        }
        Returns: undefined
      }
      update_user_rating: {
        Args: {
          p_adjust_matches?: number
          p_adjust_wins?: number
          p_collection_id: string
          p_format_id: string
          p_new_rating: number
          p_user_id: string
        }
        Returns: undefined
      }
      upsert_rating_history: {
        Args: {
          p_algorithm_version: number
          p_collection_id: string
          p_delta: number
          p_format_id: string
          p_is_win: boolean
          p_k_factor: number
          p_match_id: string
          p_opponent_avg_bracket: number
          p_opponent_avg_rating: number
          p_player_bracket: number
          p_rating_after: number
          p_rating_before: number
          p_user_id: string
        }
        Returns: undefined
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
        | "collection_join_request"
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
  graphql_public: {
    Enums: {},
  },
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
        "collection_join_request",
      ],
      participant_status: ["pending", "confirmed", "auto_confirmed"],
      win_condition_type: [
        "last_standing",
        "eliminate_team",
        "eliminate_targets",
      ],
    },
  },
} as const

