-- Seed: Sample Decks

-- ============================================
-- SAMPLE DECKS
-- ============================================

INSERT INTO decks (id, owner_id, commander_name, partner_name, deck_name, color_identity, bracket, is_active) VALUES
-- Player One's decks
('aaaa1111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 
 'Atraxa, Praetors'' Voice', NULL, 'Superfriends', ARRAY['W', 'U', 'B', 'G'], 3, TRUE),
('aaaa1111-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 
 'Yuriko, the Tiger''s Shadow', NULL, 'Ninja Tribal', ARRAY['U', 'B'], 3, TRUE),

-- Player Two's decks
('bbbb2222-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 
 'Krenko, Mob Boss', NULL, 'Goblin Horde', ARRAY['R'], 2, TRUE),
('bbbb2222-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 
 'Tymna the Weaver', 'Thrasios, Triton Hero', 'Value Town', ARRAY['W', 'U', 'B', 'G'], 4, TRUE)
ON CONFLICT (id) DO NOTHING;
