-- ============================================
-- Migration: Match Invite Tokens
-- ============================================
-- Adds a system for generating shareable registration links
-- that allow guests to sign up and claim specific match slots.
--
-- Flow:
-- 1. Match owner generates an invite token for a match
-- 2. Owner shares the link with friends
-- 3. Friend clicks link, signs up/logs in
-- 4. Friend is redirected to claim their slot in the match
-- ============================================

-- Match invite tokens table
CREATE TABLE IF NOT EXISTS match_invite_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES match_participants(id) ON DELETE CASCADE, -- Optional: link to specific placeholder
  token TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  used_at TIMESTAMPTZ, -- NULL until token is used to claim
  used_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_match_invite_tokens_token ON match_invite_tokens(token);

-- Index for finding tokens by match
CREATE INDEX IF NOT EXISTS idx_match_invite_tokens_match_id ON match_invite_tokens(match_id);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE match_invite_tokens ENABLE ROW LEVEL SECURITY;

-- Match creators can create tokens for their matches
CREATE POLICY "Match creators can create invite tokens"
  ON match_invite_tokens FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = match_invite_tokens.match_id
      AND matches.created_by = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- Anyone can read tokens (needed to validate invite links)
-- But sensitive info is controlled by the application layer
CREATE POLICY "Anyone can read invite tokens"
  ON match_invite_tokens FOR SELECT
  USING (true);

-- Match creators can update tokens (e.g., mark as used)
CREATE POLICY "Match creators can update invite tokens"
  ON match_invite_tokens FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = match_invite_tokens.match_id
      AND matches.created_by = auth.uid()
    )
  );

-- Users can mark a token as used by themselves
CREATE POLICY "Users can mark tokens as used by themselves"
  ON match_invite_tokens FOR UPDATE
  USING (
    used_by IS NULL -- Token not yet used
  )
  WITH CHECK (
    used_by = auth.uid() -- Setting themselves as the user
    AND used_at IS NOT NULL
  );

-- Match creators can delete their tokens
CREATE POLICY "Match creators can delete invite tokens"
  ON match_invite_tokens FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = match_invite_tokens.match_id
      AND matches.created_by = auth.uid()
    )
  );

-- ============================================
-- HELPER FUNCTION: Generate URL-safe token
-- ============================================

CREATE OR REPLACE FUNCTION generate_invite_token(length INT DEFAULT 12)
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INT, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- End Migration
-- ============================================
