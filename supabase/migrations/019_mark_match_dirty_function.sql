-- Migration: Add function to mark a match as dirty (bypasses RLS)
-- This is needed because participants (not creators) need to mark matches dirty
-- when they update their deck post-rating.

-- Drop existing function if it exists (may have different return type)
DROP FUNCTION IF EXISTS mark_match_dirty(UUID);

-- Create a SECURITY DEFINER function that can update matches.is_dirty
-- Validates that the caller is a participant in the match
CREATE OR REPLACE FUNCTION mark_match_dirty(p_match_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_is_participant BOOLEAN;
BEGIN
  -- Get the current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Verify the user is a participant in this match
  SELECT EXISTS (
    SELECT 1 FROM match_participants
    WHERE match_id = p_match_id
      AND user_id = v_user_id
  ) INTO v_is_participant;
  
  IF NOT v_is_participant THEN
    RAISE EXCEPTION 'User is not a participant in this match';
  END IF;
  
  -- Update the match to mark it as dirty
  UPDATE matches
  SET is_dirty = true
  WHERE id = p_match_id
    AND ratings_applied_at IS NOT NULL;  -- Only mark dirty if ratings were already applied
  
  RETURN FOUND;  -- Returns true if a row was updated
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION mark_match_dirty(UUID) TO authenticated;

COMMENT ON FUNCTION mark_match_dirty IS 
'Marks a match as dirty for rating recalculation. 
Can be called by any participant (not just creator) to support deck updates post-rating.
Uses SECURITY DEFINER to bypass RLS on matches table.';
