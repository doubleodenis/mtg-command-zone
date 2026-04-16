-- Add display_name column to profiles
-- Display names are optional and can contain spaces, unlike usernames
-- Search will prioritize display_name, then fall back to username

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Add index for searching by display_name
CREATE INDEX IF NOT EXISTS idx_profiles_display_name ON profiles (display_name);

-- Comment for documentation
COMMENT ON COLUMN profiles.display_name IS 'Optional display name shown in UI. Unlike username, can contain spaces and special characters. Search prioritizes display_name.';
