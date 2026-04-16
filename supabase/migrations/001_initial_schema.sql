-- MTG Commander Match Tracker — Updated Database Schema
-- This replaces the outdated 001_initial_schema.sql
-- Matches REQUIREMENTS.md and application types exactly

-- Enable UUID extension
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp" with schema extensions;
-- drop extension if exists "uuid-ossp";
create extension if not exists "uuid-ossp" with schema extensions;

-- ============================================
-- DROP OLD SCHEMA (if exists)
-- Note: Preserves auth.users (Supabase Auth)
-- ============================================

-- Drop old tables in reverse dependency order
DROP TABLE IF EXISTS guest_participants CASCADE;
DROP TABLE IF EXISTS match_participants CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS group_members CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS friendships CASCADE;
DROP TABLE IF EXISTS user_commanders CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Drop old enums
DROP TYPE IF EXISTS friendship_status CASCADE;
DROP TYPE IF EXISTS group_role CASCADE;
DROP TYPE IF EXISTS match_format CASCADE;

-- Drop new tables if re-running migration (for development)
DROP TABLE IF EXISTS rating_history CASCADE;
DROP TABLE IF EXISTS ratings CASCADE;
DROP TABLE IF EXISTS collection_matches CASCADE;
DROP TABLE IF EXISTS collection_members CASCADE;
DROP TABLE IF EXISTS collections CASCADE;
DROP TABLE IF EXISTS match_participants CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS formats CASCADE;
DROP TABLE IF EXISTS decks CASCADE;
DROP TABLE IF EXISTS friends CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Drop new enums if re-running
DROP TYPE IF EXISTS friendship_status CASCADE;
DROP TYPE IF EXISTS collection_role CASCADE;
DROP TYPE IF EXISTS match_add_permission CASCADE;
DROP TYPE IF EXISTS approval_status CASCADE;
DROP TYPE IF EXISTS claim_status CASCADE;
DROP TYPE IF EXISTS win_condition_type CASCADE;

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'blocked');
CREATE TYPE collection_role AS ENUM ('owner', 'member');
CREATE TYPE match_add_permission AS ENUM ('owner_only', 'any_member', 'any_member_approval_required');
CREATE TYPE approval_status AS ENUM ('approved', 'pending', 'rejected');
CREATE TYPE claim_status AS ENUM ('none', 'pending', 'approved', 'rejected');
CREATE TYPE win_condition_type AS ENUM ('last_standing', 'eliminate_team', 'eliminate_targets');

-- ============================================
-- TABLES
-- ============================================

-- Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Friends table (bidirectional friendship system)
CREATE TABLE IF NOT EXISTS friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status friendship_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id),
  CHECK (requester_id != addressee_id)
);

-- Decks table (commander decks with brackets)
CREATE TABLE IF NOT EXISTS decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  commander_name TEXT NOT NULL,
  partner_name TEXT,
  deck_name TEXT,
  color_identity TEXT[] NOT NULL DEFAULT '{}', -- ['W', 'U', 'B', 'R', 'G']
  bracket SMALLINT NOT NULL DEFAULT 2 CHECK (bracket >= 1 AND bracket <= 4),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Formats table (config-driven format definitions)
CREATE TABLE IF NOT EXISTS formats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL, -- '1v1', '2v2', '3v3', 'ffa', 'pentagram'
  min_players SMALLINT NOT NULL,
  max_players SMALLINT, -- NULL = no upper limit
  has_teams BOOLEAN NOT NULL DEFAULT FALSE,
  win_condition_type win_condition_type NOT NULL,
  config JSONB NOT NULL DEFAULT '{}', -- Format-specific rules
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Matches table (core match record)
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  format_id UUID NOT NULL REFERENCES formats(id) ON DELETE RESTRICT,
  played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT,
  match_data JSONB NOT NULL DEFAULT '{}', -- Format-specific match metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Match participants table (registered users and placeholders)
CREATE TABLE IF NOT EXISTS match_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- NULL for placeholder
  placeholder_name TEXT, -- Used when user_id is NULL
  deck_id UUID REFERENCES decks(id) ON DELETE SET NULL,
  team TEXT, -- Team identifier for team formats, NULL for FFA/Pentagram
  is_winner BOOLEAN NOT NULL DEFAULT FALSE,
  confirmed_at TIMESTAMPTZ, -- NULL = unconfirmed, reporter auto-confirmed on creation
  claimed_by UUID REFERENCES profiles(id) ON DELETE SET NULL, -- User requesting to claim placeholder
  claim_status claim_status NOT NULL DEFAULT 'none',
  participant_data JSONB NOT NULL DEFAULT '{}', -- Format-specific participant metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Either user_id or placeholder_name must be set
  CHECK (user_id IS NOT NULL OR placeholder_name IS NOT NULL),
  -- Only one user per match (unless placeholder)
  UNIQUE(match_id, user_id)
);

-- Collections table (named groups of matches)
CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  match_add_permission match_add_permission NOT NULL DEFAULT 'any_member',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Collection members table
CREATE TABLE IF NOT EXISTS collection_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role collection_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(collection_id, user_id)
);

-- Collection matches join table (many-to-many)
CREATE TABLE IF NOT EXISTS collection_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  approval_status approval_status NOT NULL DEFAULT 'approved',
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(collection_id, match_id)
);

-- Ratings table (current rating per user/format/collection)
CREATE TABLE IF NOT EXISTS ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  format_id UUID NOT NULL REFERENCES formats(id) ON DELETE CASCADE,
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE, -- NULL = global rating
  rating INTEGER NOT NULL DEFAULT 1000,
  matches_played INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Unique constraint: one rating per user/format/collection combo
  UNIQUE(user_id, format_id, collection_id)
);

-- Rating history table (immutable append-only audit log)
CREATE TABLE IF NOT EXISTS rating_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  format_id UUID NOT NULL REFERENCES formats(id) ON DELETE CASCADE,
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE, -- NULL = global
  rating_before INTEGER NOT NULL,
  rating_after INTEGER NOT NULL,
  delta INTEGER NOT NULL,
  player_bracket SMALLINT NOT NULL CHECK (player_bracket >= 1 AND player_bracket <= 4),
  opponent_avg_rating NUMERIC(10, 2) NOT NULL,
  opponent_avg_bracket NUMERIC(3, 2) NOT NULL,
  k_factor SMALLINT NOT NULL,
  algorithm_version SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- Friends
CREATE INDEX IF NOT EXISTS idx_friends_requester ON friends(requester_id);
CREATE INDEX IF NOT EXISTS idx_friends_addressee ON friends(addressee_id);
CREATE INDEX IF NOT EXISTS idx_friends_status ON friends(status);

-- Decks
CREATE INDEX IF NOT EXISTS idx_decks_owner ON decks(owner_id);
CREATE INDEX IF NOT EXISTS idx_decks_active ON decks(owner_id, is_active);

-- Formats
CREATE INDEX IF NOT EXISTS idx_formats_slug ON formats(slug);
CREATE INDEX IF NOT EXISTS idx_formats_active ON formats(is_active);

-- Matches
CREATE INDEX IF NOT EXISTS idx_matches_created_by ON matches(created_by);
CREATE INDEX IF NOT EXISTS idx_matches_format ON matches(format_id);
CREATE INDEX IF NOT EXISTS idx_matches_played_at ON matches(played_at DESC);

-- Match participants
CREATE INDEX IF NOT EXISTS idx_match_participants_match ON match_participants(match_id);
CREATE INDEX IF NOT EXISTS idx_match_participants_user ON match_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_match_participants_deck ON match_participants(deck_id);
CREATE INDEX IF NOT EXISTS idx_match_participants_unconfirmed ON match_participants(user_id) WHERE confirmed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_match_participants_pending_claims ON match_participants(match_id) WHERE claim_status = 'pending';

-- Collections
CREATE INDEX IF NOT EXISTS idx_collections_owner ON collections(owner_id);
CREATE INDEX IF NOT EXISTS idx_collections_public ON collections(is_public);

-- Collection members
CREATE INDEX IF NOT EXISTS idx_collection_members_collection ON collection_members(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_members_user ON collection_members(user_id);

-- Collection matches
CREATE INDEX IF NOT EXISTS idx_collection_matches_collection ON collection_matches(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_matches_match ON collection_matches(match_id);
CREATE INDEX IF NOT EXISTS idx_collection_matches_pending ON collection_matches(collection_id) WHERE approval_status = 'pending';

-- Ratings
CREATE INDEX IF NOT EXISTS idx_ratings_user ON ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_ratings_format ON ratings(format_id);
CREATE INDEX IF NOT EXISTS idx_ratings_collection ON ratings(collection_id);
CREATE INDEX IF NOT EXISTS idx_ratings_global ON ratings(user_id, format_id) WHERE collection_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_ratings_leaderboard ON ratings(format_id, rating DESC) WHERE collection_id IS NULL;

-- Rating history
CREATE INDEX IF NOT EXISTS idx_rating_history_user ON rating_history(user_id);
CREATE INDEX IF NOT EXISTS idx_rating_history_match ON rating_history(match_id);
CREATE INDEX IF NOT EXISTS idx_rating_history_user_format ON rating_history(user_id, format_id);
CREATE INDEX IF NOT EXISTS idx_rating_history_timeline ON rating_history(user_id, created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE formats ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rating_history ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES - Profiles
-- ============================================

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================
-- RLS POLICIES - Friends
-- ============================================

DROP POLICY IF EXISTS "Users can view own friendships" ON friends;
CREATE POLICY "Users can view own friendships"
  ON friends FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

DROP POLICY IF EXISTS "Users can send friend requests" ON friends;
CREATE POLICY "Users can send friend requests"
  ON friends FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "Addressee can update friendship status" ON friends;
CREATE POLICY "Addressee can update friendship status"
  ON friends FOR UPDATE
  USING (auth.uid() = addressee_id);

DROP POLICY IF EXISTS "Users can delete own friendships" ON friends;
CREATE POLICY "Users can delete own friendships"
  ON friends FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- ============================================
-- RLS POLICIES - Decks
-- ============================================

DROP POLICY IF EXISTS "Decks are viewable by everyone" ON decks;
CREATE POLICY "Decks are viewable by everyone"
  ON decks FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can create own decks" ON decks;
CREATE POLICY "Users can create own decks"
  ON decks FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update own decks" ON decks;
CREATE POLICY "Users can update own decks"
  ON decks FOR UPDATE
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can delete own decks" ON decks;
CREATE POLICY "Users can delete own decks"
  ON decks FOR DELETE
  USING (auth.uid() = owner_id);

-- ============================================
-- RLS POLICIES - Formats
-- ============================================

DROP POLICY IF EXISTS "Formats are viewable by everyone" ON formats;
CREATE POLICY "Formats are viewable by everyone"
  ON formats FOR SELECT
  USING (true);

-- Formats are admin-managed, no user writes

-- ============================================
-- RLS POLICIES - Matches
-- ============================================

DROP POLICY IF EXISTS "Matches are viewable by everyone" ON matches;
CREATE POLICY "Matches are viewable by everyone"
  ON matches FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can create matches" ON matches;
CREATE POLICY "Authenticated users can create matches"
  ON matches FOR INSERT
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Creator can update matches" ON matches;
CREATE POLICY "Creator can update matches"
  ON matches FOR UPDATE
  USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Creator can delete matches" ON matches;
CREATE POLICY "Creator can delete matches"
  ON matches FOR DELETE
  USING (auth.uid() = created_by);

-- ============================================
-- RLS POLICIES - Match Participants
-- ============================================

DROP POLICY IF EXISTS "Participants are viewable by everyone" ON match_participants;
CREATE POLICY "Participants are viewable by everyone"
  ON match_participants FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Match creator can manage participants" ON match_participants;
CREATE POLICY "Match creator can manage participants"
  ON match_participants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = match_participants.match_id
      AND matches.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Match creator can update participants" ON match_participants;
CREATE POLICY "Match creator can update participants"
  ON match_participants FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = match_participants.match_id
      AND matches.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Participant can confirm own slot" ON match_participants;
CREATE POLICY "Participant can confirm own slot"
  ON match_participants FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Match creator can delete participants" ON match_participants;
CREATE POLICY "Match creator can delete participants"
  ON match_participants FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = match_participants.match_id
      AND matches.created_by = auth.uid()
    )
  );

-- ============================================
-- RLS POLICIES - Collections
-- ============================================

DROP POLICY IF EXISTS "Public collections are viewable by everyone" ON collections;
CREATE POLICY "Public collections are viewable by everyone"
  ON collections FOR SELECT
  USING (
    is_public = true
    OR auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM collection_members
      WHERE collection_members.collection_id = collections.id
      AND collection_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated users can create collections" ON collections;
CREATE POLICY "Authenticated users can create collections"
  ON collections FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owner can update collections" ON collections;
CREATE POLICY "Owner can update collections"
  ON collections FOR UPDATE
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owner can delete collections" ON collections;
CREATE POLICY "Owner can delete collections"
  ON collections FOR DELETE
  USING (auth.uid() = owner_id);

-- ============================================
-- RLS POLICIES - Collection Members
-- ============================================

DROP POLICY IF EXISTS "Members can view collection membership" ON collection_members;
CREATE POLICY "Members can view collection membership"
  ON collection_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_members.collection_id
      AND (
        collections.is_public = true
        OR collections.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM collection_members cm
          WHERE cm.collection_id = collections.id
          AND cm.user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Owner can add members" ON collection_members;
CREATE POLICY "Owner can add members"
  ON collection_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_members.collection_id
      AND collections.owner_id = auth.uid()
    )
    OR (
      -- Owner adding themselves on collection creation
      collection_members.user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM collections
        WHERE collections.id = collection_members.collection_id
        AND collections.owner_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Owner can update member roles" ON collection_members;
CREATE POLICY "Owner can update member roles"
  ON collection_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_members.collection_id
      AND collections.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Members can leave collections" ON collection_members;
CREATE POLICY "Members can leave collections"
  ON collection_members FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_members.collection_id
      AND collections.owner_id = auth.uid()
    )
  );

-- ============================================
-- RLS POLICIES - Collection Matches
-- ============================================

DROP POLICY IF EXISTS "Collection matches follow collection visibility" ON collection_matches;
CREATE POLICY "Collection matches follow collection visibility"
  ON collection_matches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_matches.collection_id
      AND (
        collections.is_public = true
        OR collections.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM collection_members cm
          WHERE cm.collection_id = collections.id
          AND cm.user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Members can add matches based on permissions" ON collection_matches;
DROP POLICY IF EXISTS "Members can add matches based on permissions" ON collection_matches;
CREATE POLICY "Members can add matches based on permissions"
  ON collection_matches FOR INSERT
  WITH CHECK (
    auth.uid() = added_by
    AND EXISTS (
      SELECT 1 FROM collections c
      WHERE c.id = collection_matches.collection_id
      AND (
        -- Owner can always add
        c.owner_id = auth.uid()
        -- Or user is a member and permission allows
        OR (
          c.match_add_permission IN ('any_member', 'any_member_approval_required')
          AND EXISTS (
            SELECT 1 FROM collection_members cm
            WHERE cm.collection_id = c.id
            AND cm.user_id = auth.uid()
          )
        )
      )
    )
    -- Must be a participant in the match
    AND EXISTS (
      SELECT 1 FROM match_participants mp
      WHERE mp.match_id = collection_matches.match_id
      AND mp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owner can update match approval status" ON collection_matches;
CREATE POLICY "Owner can update match approval status"
  ON collection_matches FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_matches.collection_id
      AND collections.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owner can remove matches from collection" ON collection_matches;
CREATE POLICY "Owner can remove matches from collection"
  ON collection_matches FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM collections
      WHERE collections.id = collection_matches.collection_id
      AND collections.owner_id = auth.uid()
    )
  );

-- ============================================
-- RLS POLICIES - Ratings
-- ============================================

DROP POLICY IF EXISTS "Ratings are viewable by everyone" ON ratings;
CREATE POLICY "Ratings are viewable by everyone"
  ON ratings FOR SELECT
  USING (true);

-- Ratings are system-managed via triggers/functions, no direct user writes

-- ============================================
-- RLS POLICIES - Rating History
-- ============================================

DROP POLICY IF EXISTS "Rating history is viewable by everyone" ON rating_history;
CREATE POLICY "Rating history is viewable by everyone"
  ON rating_history FOR SELECT
  USING (true);

-- Rating history is system-managed, no direct user writes

-- ============================================
-- SEED DATA - Default Formats
-- ============================================

INSERT INTO formats (name, slug, min_players, max_players, has_teams, win_condition_type, config) VALUES
(
  '1v1',
  '1v1',
  2,
  2,
  TRUE,
  'eliminate_team',
  '{"format": "1v1", "teamCount": 2, "playersPerTeam": 1}'::jsonb
),
(
  '2v2',
  '2v2',
  4,
  4,
  TRUE,
  'eliminate_team',
  '{"format": "2v2", "teamCount": 2, "playersPerTeam": 2}'::jsonb
),
(
  '3v3',
  '3v3',
  6,
  6,
  TRUE,
  'eliminate_team',
  '{"format": "3v3", "teamCount": 2, "playersPerTeam": 3}'::jsonb
),
(
  'Free For All',
  'ffa',
  3,
  NULL,
  FALSE,
  'last_standing',
  '{"format": "ffa", "teamCount": null, "playersPerTeam": null}'::jsonb
),
(
  'Pentagram',
  'pentagram',
  5,
  5,
  FALSE,
  'eliminate_targets',
  '{"format": "pentagram", "playerCount": 5, "adjacencyMap": {"0": [1, 4], "1": [0, 2], "2": [1, 3], "3": [2, 4], "4": [3, 0]}}'::jsonb
);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Update timestamps automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for ratings updated_at
DROP TRIGGER IF EXISTS update_ratings_updated_at ON ratings;
CREATE TRIGGER update_ratings_updated_at
  BEFORE UPDATE ON ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: This trigger goes on auth.users which requires elevated permissions
-- Run this separately with Supabase dashboard or service role:
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Get or create rating for user/format/collection
CREATE OR REPLACE FUNCTION get_or_create_rating(
  p_user_id UUID,
  p_format_id UUID,
  p_collection_id UUID DEFAULT NULL
)
RETURNS ratings AS $$
DECLARE
  v_rating ratings;
BEGIN
  -- Try to get existing rating
  SELECT * INTO v_rating
  FROM ratings
  WHERE user_id = p_user_id
    AND format_id = p_format_id
    AND collection_id IS NOT DISTINCT FROM p_collection_id;

  -- If not found, create it
  IF v_rating IS NULL THEN
    INSERT INTO ratings (user_id, format_id, collection_id)
    VALUES (p_user_id, p_format_id, p_collection_id)
    RETURNING * INTO v_rating;
  END IF;

  RETURN v_rating;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get user stats for a format
CREATE OR REPLACE FUNCTION get_user_stats(
  p_user_id UUID,
  p_format_id UUID DEFAULT NULL
)
RETURNS TABLE (
  total_matches BIGINT,
  wins BIGINT,
  losses BIGINT,
  win_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_matches,
    COUNT(*) FILTER (WHERE mp.is_winner)::BIGINT AS wins,
    COUNT(*) FILTER (WHERE NOT mp.is_winner)::BIGINT AS losses,
    CASE
      WHEN COUNT(*) > 0
      THEN ROUND((COUNT(*) FILTER (WHERE mp.is_winner)::NUMERIC / COUNT(*)::NUMERIC) * 100, 1)
      ELSE 0
    END AS win_rate
  FROM match_participants mp
  JOIN matches m ON m.id = mp.match_id
  WHERE mp.user_id = p_user_id
    AND mp.confirmed_at IS NOT NULL
    AND (p_format_id IS NULL OR m.format_id = p_format_id);
END;
$$ LANGUAGE plpgsql;

-- Get leaderboard for a format
CREATE OR REPLACE FUNCTION get_leaderboard(
  p_format_id UUID,
  p_collection_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  rating INTEGER,
  matches_played INTEGER,
  wins BIGINT,
  win_rate NUMERIC,
  rank BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH ranked_ratings AS (
    SELECT
      r.user_id,
      p.username,
      p.display_name,
      p.avatar_url,
      r.rating,
      r.matches_played,
      RANK() OVER (ORDER BY r.rating DESC) AS rank
    FROM ratings r
    JOIN profiles p ON p.id = r.user_id
    WHERE r.format_id = p_format_id
      AND r.collection_id IS NOT DISTINCT FROM p_collection_id
      AND r.matches_played > 0
  ),
  user_wins AS (
    SELECT
      mp.user_id,
      COUNT(*) FILTER (WHERE mp.is_winner) AS wins,
      COUNT(*) AS total
    FROM match_participants mp
    JOIN matches m ON m.id = mp.match_id
    WHERE m.format_id = p_format_id
      AND mp.confirmed_at IS NOT NULL
      AND (
        p_collection_id IS NULL
        OR EXISTS (
          SELECT 1 FROM collection_matches cm
          WHERE cm.match_id = m.id
          AND cm.collection_id = p_collection_id
          AND cm.approval_status = 'approved'
        )
      )
    GROUP BY mp.user_id
  )
  SELECT
    rr.user_id,
    rr.username,
    rr.display_name,
    rr.avatar_url,
    rr.rating,
    rr.matches_played,
    COALESCE(uw.wins, 0)::BIGINT,
    CASE
      WHEN COALESCE(uw.total, 0) > 0
      THEN ROUND((uw.wins::NUMERIC / uw.total::NUMERIC) * 100, 1)
      ELSE 0
    END AS win_rate,
    rr.rank
  FROM ranked_ratings rr
  LEFT JOIN user_wins uw ON uw.user_id = rr.user_id
  ORDER BY rr.rank
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Get deck stats
CREATE OR REPLACE FUNCTION get_deck_stats(p_deck_id UUID)
RETURNS TABLE (
  games_played BIGINT,
  wins BIGINT,
  losses BIGINT,
  win_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS games_played,
    COUNT(*) FILTER (WHERE mp.is_winner)::BIGINT AS wins,
    COUNT(*) FILTER (WHERE NOT mp.is_winner)::BIGINT AS losses,
    CASE
      WHEN COUNT(*) > 0
      THEN ROUND((COUNT(*) FILTER (WHERE mp.is_winner)::NUMERIC / COUNT(*)::NUMERIC) * 100, 1)
      ELSE 0
    END AS win_rate
  FROM match_participants mp
  WHERE mp.deck_id = p_deck_id
    AND mp.confirmed_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
