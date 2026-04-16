-- Add auto_approve_members to collections
-- When enabled (default), collection members who are participants in a match
-- are automatically confirmed when the match is added to the collection.
-- They can still update their deck afterward to keep commander stats accurate.

ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS auto_approve_members BOOLEAN NOT NULL DEFAULT TRUE;
