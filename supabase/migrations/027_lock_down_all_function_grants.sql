-- ============================================
-- Lock down EXECUTE on every public function (deny-by-default + allowlist)
-- ============================================
--
-- Migrations 025/026 fixed 11 named rating functions. An audit of all 48
-- functions in `public` found the same class of hole everywhere else:
-- 21 SECURITY DEFINER functions were still executable by `anon` (confirmed
-- by the Supabase linter, 0028_anon_security_definer_function_executable),
-- including create_notification, mark_notifications_read/seen,
-- dismiss_notifications, mark_ratings_applied and get_or_create_rating.
-- SECURITY DEFINER means these run as the owner and bypass RLS, so an
-- unauthenticated caller could hit /rest/v1/rpc/<fn> and write rows for
-- any user.
--
-- 026 enumerated signatures by hand, which is how the other 37 functions
-- were missed. This migration instead iterates pg_proc: it revokes from
-- PUBLIC/anon/authenticated across the board and then re-grants only what
-- an allowlist names. Anything added later is therefore locked by default
-- and has to be granted deliberately.
--
-- Why the blanket REVOKE ... FROM PUBLIC matters beyond the current state:
-- Postgres grants EXECUTE to PUBLIC on every CREATE FUNCTION, and Supabase
-- projects additionally carry ALTER DEFAULT PRIVILEGES granting EXECUTE to
-- `anon`. A restore of a pg_dump into a fresh Supabase project re-creates
-- the functions and so re-opens both -- the dump's own REVOKE ... FROM
-- PUBLIC does not remove the direct `anon` grant that default privileges
-- hand out at creation time. Verified by restoring a production backup into
-- a scratch Supabase instance: apply_rating_change came back anon=true
-- despite 026. This migration must therefore be re-applied after any
-- restore; it is written to be idempotent so that is always safe.

DO $$
DECLARE
  fn RECORD;

  -- Callable without signing in: backs the public /leaderboards,
  -- /player/[username] and /collections/[id] pages. The is_collection_*
  -- helpers are referenced by RLS policies on collections and
  -- collection_members -- policy expressions are evaluated as the *calling*
  -- role, so revoking these from anon would break public collection reads.
  anon_allow TEXT[] := ARRAY[
    'get_leaderboard',
    'get_user_stats',
    'get_deck_stats',
    'is_collection_member',
    'is_collection_owner',
    'is_collection_public'
  ];

  -- Additionally callable when signed in. Each one has a real caller in
  -- src/ reachable in production, verified by tracing .rpc() call sites --
  -- including the multi-line typed-shim calls in src/lib/supabase/ratings.ts,
  -- which a single-line grep misses.
  --
  -- Deliberately NOT listed: upsert_rating_history, update_user_rating,
  -- clear_match_dirty_flag and get_match_participants_for_recalc. Their only
  -- non-script caller is /api/debug/recalculate, which returns 403 unless
  -- NODE_ENV=development, so in production no signed-in user has any reason
  -- to reach them. They stay service_role-only (the maintenance scripts run
  -- with SUPABASE_SECRET_KEY). update_user_rating in particular takes a
  -- target user_id and a new rating with no match context, so there is no
  -- ownership check that could make it safe to expose to end users.
  auth_allow TEXT[] := anon_allow || ARRAY[
    -- notifications (src/lib/supabase/notifications.ts, notification-*.tsx)
    'mark_notifications_read',
    'mark_notifications_seen',
    'dismiss_notifications',
    'get_unread_notification_count',
    'get_unseen_notification_count',
    -- match confirmation / rating write path (src/lib/supabase/ratings.ts)
    'get_or_create_rating',
    'get_rating_before_match',
    'apply_rating_change',
    'mark_ratings_applied',
    'mark_match_dirty'
  ];
BEGIN
  FOR fn IN
    SELECT p.oid,
           p.proname,
           p.prorettype = 'pg_catalog.trigger'::regtype AS is_trigger,
           pg_catalog.format('%I.%I(%s)',
             n.nspname, p.proname,
             pg_catalog.pg_get_function_identity_arguments(p.oid)) AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      -- 'p' (procedure) matters: recalculate_dirty_matches, the nightly
      -- dirty-match recalc invoked by pg_cron, is a PROCEDURE. Filtering on
      -- 'f' alone silently leaves it executable by anon.
      AND p.prokind IN ('f', 'p')
  LOOP
    -- Deny by default. PUBLIC must be revoked explicitly: a role-specific
    -- REVOKE does not remove privileges inherited via PUBLIC, which is the
    -- exact bug that made migration 025 a no-op.
    EXECUTE format('REVOKE ALL ON ROUTINE %s FROM PUBLIC, anon, authenticated', fn.sig);

    IF fn.is_trigger THEN
      -- Trigger functions are fired by the engine as the table owner and are
      -- never legitimately callable over PostgREST. Granting nothing here
      -- also removes them from the exposed RPC surface.
      CONTINUE;
    END IF;

    -- service_role (maintenance scripts, run with SUPABASE_SECRET_KEY) keeps
    -- access to every non-trigger function.
    EXECUTE format('GRANT EXECUTE ON ROUTINE %s TO service_role', fn.sig);

    IF fn.proname = ANY (anon_allow) THEN
      EXECUTE format('GRANT EXECUTE ON ROUTINE %s TO anon, authenticated', fn.sig);
    ELSIF fn.proname = ANY (auth_allow) THEN
      EXECUTE format('GRANT EXECUTE ON ROUTINE %s TO authenticated', fn.sig);
    END IF;
  END LOOP;
END
$$;

-- ----------------------------------------
-- Verification: fails the migration if anything is still reachable by anon
-- that the allowlist does not name.
-- ----------------------------------------

DO $$
DECLARE
  leaked TEXT;
BEGIN
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO leaked
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND has_function_privilege('anon', p.oid, 'EXECUTE')
    AND p.proname NOT IN (
      'get_leaderboard', 'get_user_stats', 'get_deck_stats',
      'is_collection_member', 'is_collection_owner', 'is_collection_public'
    );

  IF leaked IS NOT NULL THEN
    RAISE EXCEPTION 'anon can still execute unexpected functions: %', leaked;
  END IF;
END
$$;
