-- Add collection_join_request notification type
-- Used when a user requests to join a collection via the post-claim modal

-- Add new value to notification_type enum
-- Note: This must be committed before it can be used in indexes/queries
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'collection_join_request';

-- Add triggered_by column to notifications table for tracking who triggered the notification
-- This is useful for join requests where actor_id is the requester
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'triggered_by'
  ) THEN
    ALTER TABLE notifications ADD COLUMN triggered_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN notifications.triggered_by IS 'User who triggered this notification (e.g., user requesting to join a collection)';

-- Update TTL function to include collection_join_request
CREATE OR REPLACE FUNCTION get_notification_ttl(p_type notification_type)
RETURNS INTERVAL AS $$
BEGIN
  RETURN CASE p_type
    WHEN 'match_pending_confirmation' THEN INTERVAL '7 days'
    WHEN 'match_confirmed' THEN INTERVAL '90 days'
    WHEN 'match_disputed' THEN NULL -- never expires
    WHEN 'match_result_edited' THEN INTERVAL '90 days'
    WHEN 'elo_milestone' THEN NULL -- never expires
    WHEN 'rank_changed' THEN INTERVAL '90 days'
    WHEN 'collection_invite' THEN INTERVAL '14 days'
    WHEN 'collection_match_added' THEN INTERVAL '90 days'
    WHEN 'collection_join_request' THEN INTERVAL '30 days'
    WHEN 'claim_available' THEN INTERVAL '30 days'
    WHEN 'claim_accepted' THEN NULL -- never expires
    WHEN 'deck_retroactively_updated' THEN INTERVAL '90 days'
    WHEN 'friend_request' THEN INTERVAL '30 days'
    WHEN 'friend_accepted' THEN INTERVAL '90 days'
    ELSE INTERVAL '30 days' -- default fallback
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
