-- MTG Commander Match Tracker — Schema Additions
-- Adds missing tables and columns identified during UI audit

-- ============================================
-- NOTIFICATIONS TABLE
-- Fan-out on write model with denormalized data snapshot
-- ============================================

CREATE TYPE notification_type AS ENUM (
  -- Match notifications
  'match_pending_confirmation',
  'match_confirmed',
  'match_disputed',
  'match_result_edited',
  -- Rating notifications
  'elo_milestone',
  'rank_changed',
  -- Collection notifications
  'collection_invite',
  'collection_match_added',
  -- Claim notifications
  'claim_available',
  'claim_accepted',
  -- Deck notifications
  'deck_retroactively_updated',
  -- Friend notifications
  'friend_request',
  'friend_accepted'
);

CREATE TYPE notification_entity_type AS ENUM (
  'match',
  'collection',
  'player',
  'deck'
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- User who triggered the notification
  type notification_type NOT NULL,
  entity_type notification_entity_type NOT NULL,
  entity_id UUID NOT NULL, -- Polymorphic reference to match/collection/player/deck
  data JSONB NOT NULL DEFAULT '{}', -- Denormalized snapshot for display (no joins at read time)
  read_at TIMESTAMPTZ, -- NULL = unread, set when user clicks through to entity
  seen_at TIMESTAMPTZ, -- NULL = unseen, set when user opens notification dropdown
  dismissed_at TIMESTAMPTZ, -- NULL = active, set when user dismisses
  expires_at TIMESTAMPTZ, -- NULL = never expires, otherwise auto-deleted by pg_cron
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Primary query: user's active notifications sorted by date
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_active 
  ON notifications(recipient_id, created_at DESC) 
  WHERE dismissed_at IS NULL;

-- Unread count badge
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread 
  ON notifications(recipient_id) 
  WHERE read_at IS NULL AND dismissed_at IS NULL;

-- Unseen count (notification dot)
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unseen 
  ON notifications(recipient_id) 
  WHERE seen_at IS NULL AND dismissed_at IS NULL;

-- TTL cleanup job index
CREATE INDEX IF NOT EXISTS idx_notifications_expired 
  ON notifications(expires_at) 
  WHERE expires_at IS NOT NULL;

-- ============================================
-- ADD MISSING COLUMNS
-- ============================================

-- Decks: Add scryfall IDs for commander images
ALTER TABLE decks 
  ADD COLUMN IF NOT EXISTS commander_scryfall_id TEXT,
  ADD COLUMN IF NOT EXISTS partner_scryfall_id TEXT,
  ADD COLUMN IF NOT EXISTS commander_image_uri TEXT,
  ADD COLUMN IF NOT EXISTS partner_image_uri TEXT;

-- Ratings: Add wins column for quick stats access
ALTER TABLE ratings
  ADD COLUMN IF NOT EXISTS wins INTEGER NOT NULL DEFAULT 0;

-- Rating history: Add is_win for chart convenience
ALTER TABLE rating_history
  ADD COLUMN IF NOT EXISTS is_win BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================
-- RLS POLICIES - Notifications
-- Users can only read their own; inserts via service role only
-- ============================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = recipient_id);

-- No INSERT policy for anon/authenticated - service role only
-- This ensures notifications are only created by trusted server-side code

CREATE POLICY "Users can update own notifications (mark seen/read/dismissed)"
  ON notifications FOR UPDATE
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- Users cannot delete notifications directly, they dismiss them instead
-- Deletion happens via TTL cleanup job

-- ============================================
-- NOTIFICATION TTL CONFIGURATION
-- ============================================

-- TTL values in days for each notification type
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
    WHEN 'claim_available' THEN INTERVAL '30 days'
    WHEN 'claim_accepted' THEN NULL -- never expires
    WHEN 'deck_retroactively_updated' THEN INTERVAL '90 days'
    WHEN 'friend_request' THEN INTERVAL '30 days'
    WHEN 'friend_accepted' THEN INTERVAL '90 days'
    ELSE INTERVAL '30 days' -- default fallback
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- NOTIFICATION HELPER FUNCTIONS
-- ============================================

-- Create a notification for a user (service role only)
CREATE OR REPLACE FUNCTION create_notification(
  p_recipient_id UUID,
  p_actor_id UUID,
  p_type notification_type,
  p_entity_type notification_entity_type,
  p_entity_id UUID,
  p_data JSONB DEFAULT '{}'
)
RETURNS notifications AS $$
DECLARE
  v_notification notifications;
  v_ttl INTERVAL;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Calculate expiration based on notification type
  v_ttl := get_notification_ttl(p_type);
  v_expires_at := CASE WHEN v_ttl IS NOT NULL THEN NOW() + v_ttl ELSE NULL END;

  INSERT INTO notifications (
    recipient_id, 
    actor_id, 
    type, 
    entity_type, 
    entity_id, 
    data, 
    expires_at
  )
  VALUES (
    p_recipient_id, 
    p_actor_id, 
    p_type, 
    p_entity_type, 
    p_entity_id, 
    p_data, 
    v_expires_at
  )
  RETURNING * INTO v_notification;
  
  RETURN v_notification;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark notifications as seen (user opened dropdown)
CREATE OR REPLACE FUNCTION mark_notifications_seen(p_recipient_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE notifications
  SET seen_at = NOW()
  WHERE recipient_id = p_recipient_id
    AND seen_at IS NULL
    AND dismissed_at IS NULL;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark notifications as read (user clicked through)
CREATE OR REPLACE FUNCTION mark_notifications_read(
  p_recipient_id UUID,
  p_notification_ids UUID[] DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_notification_ids IS NULL THEN
    -- Mark all as read
    UPDATE notifications
    SET read_at = NOW(),
        seen_at = COALESCE(seen_at, NOW()) -- also mark seen if not already
    WHERE recipient_id = p_recipient_id
      AND read_at IS NULL
      AND dismissed_at IS NULL;
  ELSE
    -- Mark specific notifications as read
    UPDATE notifications
    SET read_at = NOW(),
        seen_at = COALESCE(seen_at, NOW())
    WHERE recipient_id = p_recipient_id
      AND id = ANY(p_notification_ids)
      AND read_at IS NULL
      AND dismissed_at IS NULL;
  END IF;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dismiss notifications (soft delete)
CREATE OR REPLACE FUNCTION dismiss_notifications(
  p_recipient_id UUID,
  p_notification_ids UUID[] DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF p_notification_ids IS NULL THEN
    -- Dismiss all
    UPDATE notifications
    SET dismissed_at = NOW()
    WHERE recipient_id = p_recipient_id
      AND dismissed_at IS NULL;
  ELSE
    -- Dismiss specific notifications
    UPDATE notifications
    SET dismissed_at = NOW()
    WHERE recipient_id = p_recipient_id
      AND id = ANY(p_notification_ids)
      AND dismissed_at IS NULL;
  END IF;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get unread notification count (for badge)
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_recipient_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM notifications
    WHERE recipient_id = p_recipient_id
      AND read_at IS NULL
      AND dismissed_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get unseen notification count (for dot indicator)
CREATE OR REPLACE FUNCTION get_unseen_notification_count(p_recipient_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM notifications
    WHERE recipient_id = p_recipient_id
      AND seen_at IS NULL
      AND dismissed_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TTL cleanup function (called by pg_cron)
CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM notifications
  WHERE expires_at IS NOT NULL
    AND expires_at < NOW();
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- MATCH CONFIRMATION TRIGGER
-- Auto-create notifications when match is created
-- ============================================

CREATE OR REPLACE FUNCTION notify_match_participants()
RETURNS TRIGGER AS $$
DECLARE
  v_match matches;
  v_format formats;
  v_creator profiles;
  v_deck decks;
BEGIN
  -- Get match details
  SELECT * INTO v_match FROM matches WHERE id = NEW.match_id;
  SELECT * INTO v_format FROM formats WHERE id = v_match.format_id;
  SELECT * INTO v_creator FROM profiles WHERE id = v_match.created_by;
  SELECT * INTO v_deck FROM decks WHERE id = NEW.deck_id;
  
  -- Only notify if this is a registered user (not placeholder)
  -- and they are not the match creator (creator is auto-confirmed)
  IF NEW.user_id IS NOT NULL 
     AND NEW.user_id != v_match.created_by 
     AND NEW.confirmed_at IS NULL THEN
    
    PERFORM create_notification(
      NEW.user_id,                          -- recipient
      v_match.created_by,                   -- actor
      'match_pending_confirmation',         -- type
      'match',                              -- entity_type
      NEW.match_id,                         -- entity_id
      jsonb_build_object(
        'match_id', NEW.match_id,
        'participant_id', NEW.id,
        'format_name', v_format.name,
        'format_slug', v_format.slug,
        'played_at', v_match.played_at,
        'creator_username', v_creator.username,
        'creator_avatar_url', v_creator.avatar_url,
        'deck_name', COALESCE(v_deck.deck_name, v_deck.commander_name),
        'is_winner', NEW.is_winner
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger after participant is inserted
DROP TRIGGER IF EXISTS on_match_participant_created ON match_participants;
CREATE TRIGGER on_match_participant_created
  AFTER INSERT ON match_participants
  FOR EACH ROW
  EXECUTE FUNCTION notify_match_participants();

-- ============================================
-- FRIEND REQUEST TRIGGER
-- Auto-create notification when friend request is sent
-- ============================================

CREATE OR REPLACE FUNCTION notify_friend_request()
RETURNS TRIGGER AS $$
DECLARE
  v_requester profiles;
BEGIN
  SELECT * INTO v_requester FROM profiles WHERE id = NEW.requester_id;
  
  PERFORM create_notification(
    NEW.addressee_id,                       -- recipient
    NEW.requester_id,                       -- actor
    'friend_request',                       -- type
    'player',                               -- entity_type
    NEW.requester_id,                       -- entity_id (the requester's profile)
    jsonb_build_object(
      'friendship_id', NEW.id,
      'requester_id', NEW.requester_id,
      'requester_username', v_requester.username,
      'requester_avatar_url', v_requester.avatar_url
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_friend_request_created ON friends;
CREATE TRIGGER on_friend_request_created
  AFTER INSERT ON friends
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION notify_friend_request();

-- ============================================
-- FRIEND ACCEPTED TRIGGER
-- Notify requester when friend request is accepted
-- ============================================

CREATE OR REPLACE FUNCTION notify_friend_accepted()
RETURNS TRIGGER AS $$
DECLARE
  v_addressee profiles;
BEGIN
  -- Only trigger when status changes to 'accepted'
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    SELECT * INTO v_addressee FROM profiles WHERE id = NEW.addressee_id;
    
    PERFORM create_notification(
      NEW.requester_id,                     -- recipient (original requester)
      NEW.addressee_id,                     -- actor (person who accepted)
      'friend_accepted',                    -- type
      'player',                             -- entity_type
      NEW.addressee_id,                     -- entity_id
      jsonb_build_object(
        'friendship_id', NEW.id,
        'addressee_id', NEW.addressee_id,
        'addressee_username', v_addressee.username,
        'addressee_avatar_url', v_addressee.avatar_url
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_friend_accepted ON friends;
CREATE TRIGGER on_friend_accepted
  AFTER UPDATE ON friends
  FOR EACH ROW
  EXECUTE FUNCTION notify_friend_accepted();

-- ============================================
-- CLAIM AVAILABLE TRIGGER
-- Notify match creator when someone claims a placeholder slot
-- ============================================

CREATE OR REPLACE FUNCTION notify_claim_request()
RETURNS TRIGGER AS $$
DECLARE
  v_match matches;
  v_claimant profiles;
  v_format formats;
BEGIN
  -- Only trigger when claim_status changes to 'pending'
  IF NEW.claim_status = 'pending' AND (OLD.claim_status IS NULL OR OLD.claim_status = 'none') THEN
    SELECT * INTO v_match FROM matches WHERE id = NEW.match_id;
    SELECT * INTO v_claimant FROM profiles WHERE id = NEW.claimed_by;
    SELECT * INTO v_format FROM formats WHERE id = v_match.format_id;
    
    PERFORM create_notification(
      v_match.created_by,                   -- recipient (match creator)
      NEW.claimed_by,                       -- actor (claimant)
      'claim_available',                    -- type
      'match',                              -- entity_type
      NEW.match_id,                         -- entity_id
      jsonb_build_object(
        'match_id', NEW.match_id,
        'participant_id', NEW.id,
        'claimant_id', NEW.claimed_by,
        'claimant_username', v_claimant.username,
        'claimant_avatar_url', v_claimant.avatar_url,
        'placeholder_name', NEW.placeholder_name,
        'format_name', v_format.name,
        'played_at', v_match.played_at
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_claim_request ON match_participants;
CREATE TRIGGER on_claim_request
  AFTER UPDATE ON match_participants
  FOR EACH ROW
  EXECUTE FUNCTION notify_claim_request();

-- ============================================
-- CLAIM ACCEPTED TRIGGER
-- Notify claimant when their claim is approved
-- ============================================

CREATE OR REPLACE FUNCTION notify_claim_accepted()
RETURNS TRIGGER AS $$
DECLARE
  v_match matches;
  v_creator profiles;
  v_format formats;
BEGIN
  -- Only trigger when claim_status changes to 'approved'
  IF NEW.claim_status = 'approved' AND OLD.claim_status = 'pending' THEN
    SELECT * INTO v_match FROM matches WHERE id = NEW.match_id;
    SELECT * INTO v_creator FROM profiles WHERE id = v_match.created_by;
    SELECT * INTO v_format FROM formats WHERE id = v_match.format_id;
    
    PERFORM create_notification(
      NEW.user_id,                          -- recipient (the claimant, now user_id)
      v_match.created_by,                   -- actor (match creator who approved)
      'claim_accepted',                     -- type
      'match',                              -- entity_type
      NEW.match_id,                         -- entity_id
      jsonb_build_object(
        'match_id', NEW.match_id,
        'participant_id', NEW.id,
        'approver_username', v_creator.username,
        'approver_avatar_url', v_creator.avatar_url,
        'format_name', v_format.name,
        'played_at', v_match.played_at,
        'is_winner', NEW.is_winner
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_claim_accepted ON match_participants;
CREATE TRIGGER on_claim_accepted
  AFTER UPDATE ON match_participants
  FOR EACH ROW
  EXECUTE FUNCTION notify_claim_accepted();

-- ============================================
-- COLLECTION INVITE TRIGGER
-- Notify user when added to a collection
-- ============================================

CREATE OR REPLACE FUNCTION notify_collection_invite()
RETURNS TRIGGER AS $$
DECLARE
  v_collection collections;
  v_owner profiles;
BEGIN
  SELECT * INTO v_collection FROM collections WHERE id = NEW.collection_id;
  SELECT * INTO v_owner FROM profiles WHERE id = v_collection.owner_id;
  
  -- Don't notify the owner when they're added as a member
  IF NEW.user_id != v_collection.owner_id THEN
    PERFORM create_notification(
      NEW.user_id,                          -- recipient
      v_collection.owner_id,                -- actor
      'collection_invite',                  -- type
      'collection',                         -- entity_type
      NEW.collection_id,                    -- entity_id
      jsonb_build_object(
        'collection_id', NEW.collection_id,
        'collection_name', v_collection.name,
        'owner_id', v_collection.owner_id,
        'owner_username', v_owner.username,
        'owner_avatar_url', v_owner.avatar_url,
        'role', NEW.role
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_collection_member_added ON collection_members;
CREATE TRIGGER on_collection_member_added
  AFTER INSERT ON collection_members
  FOR EACH ROW
  EXECUTE FUNCTION notify_collection_invite();

-- ============================================
-- pg_cron JOB SETUP (run this manually in Supabase Dashboard SQL Editor)
-- ============================================

-- Enable pg_cron extension (requires Supabase Pro plan or self-hosted)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule nightly cleanup at 3 AM UTC
-- SELECT cron.schedule(
--   'cleanup-expired-notifications',
--   '0 3 * * *',
--   $$SELECT cleanup_expired_notifications()$$
-- );

-- ============================================
-- ENABLE REALTIME FOR NOTIFICATIONS
-- Subscribe to INSERT events filtered by recipient_id
-- ============================================

-- Add notifications to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Note: INSERT not granted to authenticated - use service role for creating notifications
GRANT SELECT, UPDATE ON notifications TO authenticated;
GRANT EXECUTE ON FUNCTION mark_notifications_seen TO authenticated;
GRANT EXECUTE ON FUNCTION mark_notifications_read TO authenticated;
GRANT EXECUTE ON FUNCTION dismiss_notifications TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_notification_count TO authenticated;
GRANT EXECUTE ON FUNCTION get_unseen_notification_count TO authenticated;

-- Service role only functions
GRANT EXECUTE ON FUNCTION create_notification TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_expired_notifications TO service_role;
