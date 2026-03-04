-- MTG Commander Match Tracker Database Schema
-- Run this in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'declined', 'blocked');
CREATE TYPE group_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE match_format AS ENUM ('1v1', '2v2', 'multiplayer');

-- ============================================
-- TABLES
-- ============================================

-- Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User commanders collection
CREATE TABLE IF NOT EXISTS user_commanders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scryfall_id TEXT NOT NULL,
  card_name TEXT NOT NULL,
  card_image_uri TEXT,
  is_favorite BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, scryfall_id)
);

-- Friendships table (bidirectional)
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status friendship_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id)
);

-- Groups (tournaments/match folders)
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Group members (composite primary key)
CREATE TABLE IF NOT EXISTS group_members (
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role group_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

-- Matches
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  format match_format NOT NULL,
  date_played TIMESTAMPTZ DEFAULT NOW(),
  duration_minutes INTEGER,
  notes TEXT,
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Match participants (registered users)
CREATE TABLE IF NOT EXISTS match_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  commander_id TEXT,
  commander_name TEXT,
  commander_image_uri TEXT,
  team INTEGER, -- For 2v2 matches
  placement INTEGER, -- Final position (1 = winner, null for multiplayer)
  is_winner BOOLEAN DEFAULT FALSE,
  UNIQUE(match_id, user_id)
);

-- Guest participants (non-registered players)
CREATE TABLE IF NOT EXISTS guest_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  commander_name TEXT,
  commander_image_uri TEXT,
  team INTEGER,
  placement INTEGER,
  is_winner BOOLEAN DEFAULT FALSE
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_user_commanders_user_id ON user_commanders(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_matches_created_by ON matches(created_by);
CREATE INDEX IF NOT EXISTS idx_matches_date_played ON matches(date_played);
CREATE INDEX IF NOT EXISTS idx_matches_group ON matches(group_id);
CREATE INDEX IF NOT EXISTS idx_match_participants_match ON match_participants(match_id);
CREATE INDEX IF NOT EXISTS idx_match_participants_user ON match_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_guest_participants_match ON guest_participants(match_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_commanders ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_participants ENABLE ROW LEVEL SECURITY;

-- Profiles: Public read, own write
CREATE POLICY "Profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- User commanders: Public read, own write
CREATE POLICY "Commanders are viewable by everyone" ON user_commanders
  FOR SELECT USING (true);

CREATE POLICY "Users can manage own commanders" ON user_commanders
  FOR ALL USING (auth.uid() = user_id);

-- Friendships: Involved parties can view, requester can insert
CREATE POLICY "Users can view own friendships" ON friendships
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Users can create friend requests" ON friendships
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Addressee can update friendship status" ON friendships
  FOR UPDATE USING (auth.uid() = addressee_id);

CREATE POLICY "Users can delete own requests" ON friendships
  FOR DELETE USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Groups: Members can view, creator can manage
CREATE POLICY "Group members can view groups" ON groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members 
      WHERE group_members.group_id = groups.id 
      AND group_members.user_id = auth.uid()
    )
    OR is_public = true
  );

CREATE POLICY "Users can create groups" ON groups
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Admins can update groups" ON groups
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM group_members 
      WHERE group_members.group_id = groups.id 
      AND group_members.user_id = auth.uid()
      AND (group_members.role = 'admin' OR group_members.role = 'owner')
    )
  );

CREATE POLICY "Creator can delete groups" ON groups
  FOR DELETE USING (auth.uid() = creator_id);

-- Group members: Members can view, admins can manage
CREATE POLICY "Group members can view members" ON group_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_members.group_id 
      AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can add members" ON group_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = group_members.group_id 
      AND gm.user_id = auth.uid()
      AND (gm.role = 'admin' OR gm.role = 'owner')
    )
    OR (
      -- Creator adding themselves as first member
      EXISTS (
        SELECT 1 FROM groups 
        WHERE groups.id = group_members.group_id 
        AND groups.creator_id = auth.uid()
      )
      AND group_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can leave groups" ON group_members
  FOR DELETE USING (auth.uid() = user_id);

-- Matches: Public read, creator can manage
CREATE POLICY "Matches are viewable by everyone" ON matches
  FOR SELECT USING (true);

CREATE POLICY "Users can create matches" ON matches
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator can update matches" ON matches
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Creator can delete matches" ON matches
  FOR DELETE USING (auth.uid() = created_by);

-- Match participants: Public read, match creator can manage
CREATE POLICY "Participants are viewable by everyone" ON match_participants
  FOR SELECT USING (true);

CREATE POLICY "Match creator can manage participants" ON match_participants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM matches 
      WHERE matches.id = match_participants.match_id 
      AND matches.created_by = auth.uid()
    )
  );

-- Guest participants: Same as match participants
CREATE POLICY "Guest participants are viewable by everyone" ON guest_participants
  FOR SELECT USING (true);

CREATE POLICY "Match creator can manage guest participants" ON guest_participants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM matches 
      WHERE matches.id = guest_participants.match_id 
      AND matches.created_by = auth.uid()
    )
  );

-- ============================================
-- FUNCTIONS
-- ============================================

-- Get user stats
CREATE OR REPLACE FUNCTION get_user_stats(user_uuid UUID)
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
    COUNT(*) FILTER (WHERE is_winner)::BIGINT AS wins,
    COUNT(*) FILTER (WHERE NOT is_winner)::BIGINT AS losses,
    CASE 
      WHEN COUNT(*) > 0 
      THEN ROUND((COUNT(*) FILTER (WHERE is_winner)::NUMERIC / COUNT(*)::NUMERIC) * 100, 1)
      ELSE 0
    END AS win_rate
  FROM match_participants
  WHERE user_id = user_uuid;
END;
$$ LANGUAGE plpgsql;

-- Get leaderboard
CREATE OR REPLACE FUNCTION get_leaderboard(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  total_matches BIGINT,
  wins BIGINT,
  win_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    COUNT(mp.id)::BIGINT AS total_matches,
    COUNT(mp.id) FILTER (WHERE mp.is_winner)::BIGINT AS wins,
    CASE 
      WHEN COUNT(mp.id) > 0 
      THEN ROUND((COUNT(mp.id) FILTER (WHERE mp.is_winner)::NUMERIC / COUNT(mp.id)::NUMERIC) * 100, 1)
      ELSE 0
    END AS win_rate
  FROM profiles p
  LEFT JOIN match_participants mp ON p.id = mp.user_id
  GROUP BY p.id, p.username, p.display_name, p.avatar_url
  HAVING COUNT(mp.id) > 0
  ORDER BY wins DESC, win_rate DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Get top commanders
CREATE OR REPLACE FUNCTION get_top_commanders(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  commander_name TEXT,
  commander_image_uri TEXT,
  times_played BIGINT,
  wins BIGINT,
  win_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mp.commander_name,
    mp.commander_image_uri,
    COUNT(*)::BIGINT AS times_played,
    COUNT(*) FILTER (WHERE mp.is_winner)::BIGINT AS wins,
    CASE 
      WHEN COUNT(*) > 0 
      THEN ROUND((COUNT(*) FILTER (WHERE mp.is_winner)::NUMERIC / COUNT(*)::NUMERIC) * 100, 1)
      ELSE 0
    END AS win_rate
  FROM match_participants mp
  WHERE mp.commander_name IS NOT NULL
  GROUP BY mp.commander_name, mp.commander_image_uri
  ORDER BY times_played DESC, win_rate DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

-- Update profile updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: This trigger goes on auth.users which requires elevated permissions
-- Run this separately if you have access:
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW
--   EXECUTE FUNCTION handle_new_user();

-- ============================================
-- STORAGE BUCKETS
-- ============================================

-- Create avatars bucket for profile pictures
-- Run in Supabase Storage settings or via API:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Storage policies
-- CREATE POLICY "Avatar images are publicly accessible" ON storage.objects
--   FOR SELECT USING (bucket_id = 'avatars');

-- CREATE POLICY "Users can upload their own avatar" ON storage.objects
--   FOR INSERT WITH CHECK (
--     bucket_id = 'avatars' AND 
--     auth.uid()::text = (storage.foldername(name))[1]
--   );

-- CREATE POLICY "Users can update their own avatar" ON storage.objects
--   FOR UPDATE USING (
--     bucket_id = 'avatars' AND 
--     auth.uid()::text = (storage.foldername(name))[1]
--   );

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant usage on all tables to authenticated and anon roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
