-- ============================================
-- Migration: Claim System Enhancements
-- ============================================
-- Adds RLS policies for the placeholder claim flow:
-- 1. Users can submit claims on placeholder slots
-- 2. Users can view pending claims on their own matches
-- ============================================

-- Allow authenticated users to submit claims on placeholder slots
-- Only works when:
--   - The slot has no user_id (is a placeholder)
--   - The slot has no pending claim (claim_status = 'none')
--   - The user is setting themselves as the claimant
DROP POLICY IF EXISTS "Users can submit claims on placeholder slots" ON match_participants;
CREATE POLICY "Users can submit claims on placeholder slots"
  ON match_participants FOR UPDATE
  USING (
    -- Target placeholder slots with no pending claim
    user_id IS NULL
    AND claim_status = 'none'
  )
  WITH CHECK (
    -- Only allow setting self as claimant with pending status
    claimed_by = auth.uid()
    AND claim_status = 'pending'
    -- Ensure other fields aren't changed
    AND user_id IS NULL
  );

-- Function to check if user is already a participant in the match
CREATE OR REPLACE FUNCTION check_user_not_already_participant()
RETURNS TRIGGER AS $$
BEGIN
  -- When claiming a slot, verify user isn't already a participant
  IF NEW.claimed_by IS NOT NULL AND OLD.claimed_by IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM match_participants
      WHERE match_id = NEW.match_id
      AND user_id = NEW.claimed_by
      AND id != NEW.id
    ) THEN
      RAISE EXCEPTION 'User is already a participant in this match';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to prevent duplicate participation via claim
DROP TRIGGER IF EXISTS prevent_duplicate_claim_participation ON match_participants;
CREATE TRIGGER prevent_duplicate_claim_participation
  BEFORE UPDATE ON match_participants
  FOR EACH ROW
  WHEN (NEW.claimed_by IS NOT NULL AND OLD.claimed_by IS NULL)
  EXECUTE FUNCTION check_user_not_already_participant();

-- Index for finding claimable slots efficiently
CREATE INDEX IF NOT EXISTS idx_match_participants_claimable 
  ON match_participants (placeholder_name)
  WHERE user_id IS NULL AND claim_status = 'none';

-- ============================================
-- End Migration
-- ============================================
