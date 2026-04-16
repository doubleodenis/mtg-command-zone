-- Seed: Test Users
-- Based on src/lib/mock/users.json
-- Password for all users: "password123"

-- ============================================
-- TEST USERS
-- ============================================

INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at,
  role,
  aud,
  confirmation_token,
  recovery_token,
  reauthentication_token,
  email_change,
  email_change_token_new,
  email_change_token_current,
  email_change_confirm_status,
  phone,
  phone_change,
  phone_change_token,
  raw_app_meta_data,
  is_sso_user,
  is_anonymous
) VALUES
(
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'player1@gmail.com',
  '$2a$10$QmPvY4.P5FP0tVu6/tLyrO27DobxFgiZD7seccXhTgcwCUG0oPHiO', -- password123
  NOW(),
  '{"username": "player1", "display_name": "Player One"}'::jsonb,
  NOW(),
  NOW(),
  'authenticated',
  'authenticated',
  '',
  '',
  '',
  '',
  '',
  '',
  0,
  NULL,
  '',
  '',
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  false,
  false
),
(
  '22222222-2222-2222-2222-222222222222',
  '00000000-0000-0000-0000-000000000000',
  'player2@gmail.com',
  '$2a$10$QmPvY4.P5FP0tVu6/tLyrO27DobxFgiZD7seccXhTgcwCUG0oPHiO', -- password123
  NOW(),
  '{"username": "player2", "display_name": "Player Two"}'::jsonb,
  NOW(),
  NOW(),
  'authenticated',
  'authenticated',
  '',
  '',
  '',
  '',
  '',
  '',
  0,
  NULL,
  '',
  '',
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  false,
  false
)
ON CONFLICT (id) DO NOTHING;

-- Profiles (in case trigger doesn't fire)
INSERT INTO profiles (id, username, display_name, avatar_url)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'player1', 'Player One', NULL),
  ('22222222-2222-2222-2222-222222222222', 'player2', 'Player Two', NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- FRIENDSHIPS
-- ============================================

INSERT INTO friends (requester_id, addressee_id, status) VALUES
('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'accepted')
ON CONFLICT DO NOTHING;
