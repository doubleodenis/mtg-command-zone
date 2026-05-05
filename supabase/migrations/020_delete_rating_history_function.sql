-- Migration: Add function to delete rating history for recalculation
-- This is needed because rating_history has no direct user write policies
-- (it's system-managed). The recalculation logic needs to delete old entries
-- before re-applying corrected ratings.

-- Create a SECURITY DEFINER function that can delete rating_history entries
-- Validates that the caller is a participant in the match
CREATE OR REPLACE FUNCTION delete_match_rating_history(p_match_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_is_participant BOOLEAN;
  v_deleted_count INTEGER;
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
  
  -- Delete all rating_history entries for this match
  DELETE FROM rating_history
  WHERE match_id = p_match_id;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_match_rating_history(UUID) TO authenticated;

COMMENT ON FUNCTION delete_match_rating_history IS 
'Deletes all rating_history entries for a match to allow recalculation.
Can be called by any participant to support claim recalculation.
Uses SECURITY DEFINER to bypass RLS on rating_history table.';
