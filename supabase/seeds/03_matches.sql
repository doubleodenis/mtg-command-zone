-- Seed: Sample Matches and Collections

-- ============================================
-- SAMPLE COLLECTION
-- ============================================

INSERT INTO collections (id, owner_id, name, description, is_public, match_add_permission) VALUES
('c0110001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 
 'Friday Night Commander', 'Weekly games at the LGS', TRUE, 'any_member')
ON CONFLICT (id) DO NOTHING;

-- Add members to the collection
INSERT INTO collection_members (collection_id, user_id, role) VALUES
('c0110001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'owner'),
('c0110001-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'member')
ON CONFLICT DO NOTHING;

-- ============================================
-- SAMPLE MATCHES
-- ============================================

DO $$
DECLARE
  v_ffa_format_id UUID;
  v_1v1_format_id UUID;
  v_match1_id UUID := 'a0000001-0000-0000-0000-000000000001';
  v_match2_id UUID := 'a0000002-0000-0000-0000-000000000002';
BEGIN
  -- Get format IDs
  SELECT id INTO v_ffa_format_id FROM formats WHERE slug = 'ffa';
  SELECT id INTO v_1v1_format_id FROM formats WHERE slug = '1v1';

  -- Match 1: 1v1, Player One won
  INSERT INTO matches (id, created_by, format_id, played_at, notes, match_data)
  VALUES (
    v_match1_id,
    '11111111-1111-1111-1111-111111111111',
    v_1v1_format_id,
    NOW() - INTERVAL '3 days',
    'Close game decided by top deck',
    '{}'::jsonb
  ) ON CONFLICT (id) DO NOTHING;

  -- Match 1 participants
  INSERT INTO match_participants (match_id, user_id, deck_id, team, is_winner, confirmed_at)
  VALUES
    (v_match1_id, '11111111-1111-1111-1111-111111111111', 'aaaa1111-0000-0000-0000-000000000001', 'A', TRUE, NOW()),
    (v_match1_id, '22222222-2222-2222-2222-222222222222', 'bbbb2222-0000-0000-0000-000000000001', 'B', FALSE, NOW())
  ON CONFLICT DO NOTHING;

  -- Match 2: 1v1, Player Two won
  INSERT INTO matches (id, created_by, format_id, played_at, notes, match_data)
  VALUES (
    v_match2_id,
    '22222222-2222-2222-2222-222222222222',
    v_1v1_format_id,
    NOW() - INTERVAL '1 day',
    'Revenge match!',
    '{}'::jsonb
  ) ON CONFLICT (id) DO NOTHING;

  -- Match 2 participants
  INSERT INTO match_participants (match_id, user_id, deck_id, team, is_winner, confirmed_at)
  VALUES
    (v_match2_id, '11111111-1111-1111-1111-111111111111', 'aaaa1111-0000-0000-0000-000000000002', 'A', FALSE, NOW()),
    (v_match2_id, '22222222-2222-2222-2222-222222222222', 'bbbb2222-0000-0000-0000-000000000002', 'B', TRUE, NOW())
  ON CONFLICT DO NOTHING;

  -- Add matches to collection
  INSERT INTO collection_matches (collection_id, match_id, added_by, approval_status)
  VALUES
    ('c0110001-0000-0000-0000-000000000001', v_match1_id, '11111111-1111-1111-1111-111111111111', 'approved'),
    ('c0110001-0000-0000-0000-000000000001', v_match2_id, '22222222-2222-2222-2222-222222222222', 'approved')
  ON CONFLICT DO NOTHING;

END $$;
