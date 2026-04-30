-- Create index for looking up pending join requests
-- This is in a separate migration because PostgreSQL doesn't allow using
-- a newly added enum value in the same transaction it was added.

CREATE INDEX IF NOT EXISTS idx_notifications_join_requests
  ON notifications(entity_id, triggered_by)
  WHERE type = 'collection_join_request' AND dismissed_at IS NULL;

-- Allow users to insert collection_join_request notifications where they are the actor
-- This is safe because they can only request to join, not grant membership
DROP POLICY IF EXISTS "Users can create collection join request notifications" ON notifications;
CREATE POLICY "Users can create collection join request notifications"
  ON notifications FOR INSERT
  WITH CHECK (
    auth.uid() = actor_id 
    AND auth.uid() = triggered_by
    AND type = 'collection_join_request'
  );
