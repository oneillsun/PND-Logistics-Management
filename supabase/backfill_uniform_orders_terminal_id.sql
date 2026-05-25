-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill terminal_id into uniform_orders.data
--
-- Matches uniform_orders.data->>'terminal' against terminals using two strategies:
--   1. data->>'name' directly     (seeded / legacy terminals)
--   2. data->>'name' || ' - ' || data->>'code'  (terminals created via the UI)
--
-- Run STEP 1 & 2 first to verify, then run STEP 3, then verify with STEP 4.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── STEP 1: Preview — records that WILL be updated ───────────────────────────
SELECT
  uo.id                          AS order_id,
  uo.data->>'terminal'           AS terminal_label,
  t.id                           AS matched_terminal_id,
  t.data->>'name'                AS terminal_name
FROM uniform_orders uo
JOIN terminals t
  ON uo.data->>'terminal' = t.data->>'name'
  OR uo.data->>'terminal' = (t.data->>'name') || ' - ' || (t.data->>'code')
ORDER BY uo.data->>'terminal';


-- ── STEP 2: Preview — unmatched records (will NOT be updated) ────────────────
SELECT
  uo.id                AS order_id,
  uo.data->>'terminal' AS terminal_label,
  uo.data->>'status'   AS status
FROM uniform_orders uo
WHERE NOT EXISTS (
  SELECT 1 FROM terminals t
  WHERE uo.data->>'terminal' = t.data->>'name'
     OR uo.data->>'terminal' = (t.data->>'name') || ' - ' || (t.data->>'code')
)
ORDER BY uo.data->>'terminal';


-- ── STEP 3: Run the update ────────────────────────────────────────────────────
-- Only run this after verifying Steps 1 & 2 above look correct.

UPDATE uniform_orders uo
SET data = uo.data || jsonb_build_object('terminal_id', t.id)
FROM terminals t
WHERE uo.data->>'terminal' = t.data->>'name'
   OR uo.data->>'terminal' = (t.data->>'name') || ' - ' || (t.data->>'code');


-- ── STEP 4: Verify ────────────────────────────────────────────────────────────
SELECT
  uo.id                              AS order_id,
  uo.data->>'terminal'               AS terminal_label,
  uo.data->>'terminal_id'            AS terminal_id,
  CASE WHEN uo.data->>'terminal_id' IS NOT NULL THEN '✓ OK' ELSE '✗ MISSING' END AS status
FROM uniform_orders uo
ORDER BY status, terminal_label;
