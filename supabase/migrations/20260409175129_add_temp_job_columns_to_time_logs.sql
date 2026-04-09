/*
  # Add temporary job columns to prod_time_logs

  ## Summary
  Extends prod_time_logs to support "temporary jobs" that occupy a garage slot
  without being linked to a prod_items record. Also makes item_id nullable.

  ## Changes
  - `item_id` column becomes nullable (was NOT NULL) to allow NULL for temp jobs
  - Added `type_job` (text, nullable) — job type: 'export', 'demantelement', 'autres'
  - Added `titre` (text, nullable) — short label for the temp job

  ## Notes
  - Temp job logs are inserted complete (heure_entree + heure_sortie + duree) in one shot
  - Regular item logs still work as before (item_id filled, heure_sortie updated on exit)
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prod_time_logs' AND column_name = 'item_id'
  ) THEN
    ALTER TABLE prod_time_logs ALTER COLUMN item_id DROP NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prod_time_logs' AND column_name = 'type_job'
  ) THEN
    ALTER TABLE prod_time_logs ADD COLUMN type_job text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prod_time_logs' AND column_name = 'titre'
  ) THEN
    ALTER TABLE prod_time_logs ADD COLUMN titre text;
  END IF;
END $$;
