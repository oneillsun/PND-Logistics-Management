-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill terminal_id into road_tests.data
--
-- Matches road_tests.data->>'terminal' against terminals using two strategies:
--   1. data->>'name' directly     (seeded / legacy terminals)
--   2. data->>'name' || ' - ' || data->>'code'  (terminals created via the UI)
--
-- Run the PREVIEW first, verify the results, then run the UPDATE.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── STEP 1: Preview — what will be updated ───────────────────────────────────
SELECT
  rt.id                          AS road_test_id,
  rt.data->>'terminal'           AS terminal_label,
  t.id                           AS matched_terminal_id,
  t.data->>'name'                AS terminal_name
FROM road_tests rt
JOIN terminals t
  ON rt.data->>'terminal' = t.data->>'name'
  OR rt.data->>'terminal' = (t.data->>'name') || ' - ' || (t.data->>'code')
ORDER BY rt.data->>'terminal';


-- ── STEP 2: Preview — unmatched records (will NOT be updated) ────────────────
SELECT
  rt.id                AS road_test_id,
  rt.data->>'terminal' AS terminal_label,
  rt.data->>'status'   AS status
FROM road_tests rt
WHERE NOT EXISTS (
  SELECT 1 FROM terminals t
  WHERE rt.data->>'terminal' = t.data->>'name'
     OR rt.data->>'terminal' = (t.data->>'name') || ' - ' || (t.data->>'code')
)
ORDER BY rt.data->>'terminal';


-- ── STEP 3: Run the update ────────────────────────────────────────────────────
-- Only run this after verifying Steps 1 & 2 above look correct.

UPDATE road_tests rt
SET data = rt.data || jsonb_build_object('terminal_id', t.id)
FROM terminals t
WHERE rt.data->>'terminal' = t.data->>'name'
   OR rt.data->>'terminal' = (t.data->>'name') || ' - ' || (t.data->>'code');


-- ── STEP 4: Verify ────────────────────────────────────────────────────────────
SELECT
  rt.id                          AS road_test_id,
  rt.data->>'terminal'           AS terminal_label,
  rt.data->>'terminal_id'        AS terminal_id,
  CASE WHEN rt.data->>'terminal_id' IS NOT NULL THEN '✓ OK' ELSE '✗ MISSING' END AS status
FROM road_tests rt
ORDER BY status, terminal_label;
