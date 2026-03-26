-- Create a profile for an existing auth user who doesn't have one
-- Run this in the Supabase SQL Editor

-- Option 1: Create profile for a specific user by email
INSERT INTO public.profiles (id, username, avatar_url)
SELECT 
  id,
  COALESCE(raw_user_meta_data->>'username', SPLIT_PART(email, '@', 1)),
  raw_user_meta_data->>'avatar_url'
FROM auth.users
WHERE email = 'YOUR_EMAIL_HERE'  -- Replace with actual email
ON CONFLICT (id) DO NOTHING;

-- Option 2: Create profiles for ALL users who don't have one yet
-- INSERT INTO public.profiles (id, username, avatar_url)
-- SELECT 
--   u.id,
--   COALESCE(u.raw_user_meta_data->>'username', SPLIT_PART(u.email, '@', 1)),
--   u.raw_user_meta_data->>'avatar_url'
-- FROM auth.users u
-- LEFT JOIN public.profiles p ON p.id = u.id
-- WHERE p.id IS NULL;

-- Option 3: Enable the trigger so new users get profiles automatically
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW
--   EXECUTE FUNCTION handle_new_user();
