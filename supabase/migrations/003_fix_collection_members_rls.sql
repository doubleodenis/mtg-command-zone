-- ============================================
-- Fix infinite recursion in collection_members RLS policies
-- ============================================

-- The SELECT policy references collection_members to check membership,
-- which triggers the same policy again, causing infinite recursion.
-- Fix: Use a security definer function to check membership without triggering RLS.

-- Create helper function that bypasses RLS
CREATE OR REPLACE FUNCTION is_collection_member(p_collection_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM collection_members
    WHERE collection_id = p_collection_id
    AND user_id = p_user_id
  );
$$;

-- Helper to check if collection is public (bypasses RLS)
CREATE OR REPLACE FUNCTION is_collection_public(p_collection_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM collections
    WHERE id = p_collection_id
    AND is_public = true
  );
$$;

-- Helper to check if user owns the collection (bypasses RLS)
CREATE OR REPLACE FUNCTION is_collection_owner(p_collection_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM collections
    WHERE id = p_collection_id
    AND owner_id = p_user_id
  );
$$;

-- Drop existing policies
DROP POLICY IF EXISTS "Members can view collection membership" ON collection_members;
DROP POLICY IF EXISTS "Owner can add members" ON collection_members;
DROP POLICY IF EXISTS "Owner can update member roles" ON collection_members;
DROP POLICY IF EXISTS "Members can leave collections" ON collection_members;

-- Recreate SELECT policy - users can see membership for collections they belong to or public ones
CREATE POLICY "Members can view collection membership"
  ON collection_members FOR SELECT
  USING (
    -- Users can always see their own membership
    user_id = auth.uid()
    -- Or if they are a member of the same collection
    OR is_collection_member(collection_id, auth.uid())
    -- Or if the collection is public
    OR is_collection_public(collection_id)
  );

-- Recreate INSERT policy using helper function
CREATE POLICY "Owner can add members"
  ON collection_members FOR INSERT
  WITH CHECK (
    is_collection_owner(collection_id, auth.uid())
  );

-- Recreate UPDATE policy using helper function
CREATE POLICY "Owner can update member roles"
  ON collection_members FOR UPDATE
  USING (
    is_collection_owner(collection_id, auth.uid())
  );

-- Recreate DELETE policy using helper functions
CREATE POLICY "Members can leave collections"
  ON collection_members FOR DELETE
  USING (
    auth.uid() = user_id
    OR is_collection_owner(collection_id, auth.uid())
  );

-- Also fix the collections SELECT policy which has the same issue
DROP POLICY IF EXISTS "Public collections are viewable by everyone" ON collections;
DROP POLICY IF EXISTS "Users can view collections they are members of" ON collections;

CREATE POLICY "Users can view accessible collections"
  ON collections FOR SELECT
  USING (
    is_public = true
    OR owner_id = auth.uid()
    OR is_collection_member(id, auth.uid())
  );
