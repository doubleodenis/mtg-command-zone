-- The 022 migration removed the trigger that auto-populated locks_at, but
-- missed the column default set in 013 (`SET DEFAULT NOW() + INTERVAL '24 hours'`),
-- so new matches were still silently getting a locks_at value despite 021's own
-- comments claiming otherwise. Nothing in the application reads matches.locks_at
-- today, but leaving a false claim in a migration comment is exactly the kind of
-- doc/code drift this branch exists to eliminate.
ALTER TABLE matches ALTER COLUMN locks_at DROP DEFAULT;
