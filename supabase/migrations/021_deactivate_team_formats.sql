-- Temporarily deactivate 2v2 and 3v3 formats to focus on traditional Commander play patterns.
-- Reversible: flip is_active back to true on these rows to restore them.

UPDATE formats SET is_active = false WHERE slug IN ('2v2', '3v3');
