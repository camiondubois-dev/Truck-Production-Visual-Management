/*
  # Add missing columns to prod_items

  Ensures prod_items has:
  - date_livraison_planifiee (used by fromDB/mettreAJour)
  - date_livraison_reelle (used by fromDB/mettreAJour)

  Also drops any CHECK constraint on "type" column to allow
  temp job types: 'export', 'demantelement', 'autres'.
*/

-- Add date_livraison_planifiee if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prod_items' AND column_name = 'date_livraison_planifiee'
  ) THEN
    ALTER TABLE prod_items ADD COLUMN date_livraison_planifiee text;
  END IF;
END $$;

-- Add date_livraison_reelle if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prod_items' AND column_name = 'date_livraison_reelle'
  ) THEN
    ALTER TABLE prod_items ADD COLUMN date_livraison_reelle text;
  END IF;
END $$;

-- Remove any CHECK constraint on the "type" column that might block
-- temp job types (export, demantelement, autres)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
    WHERE c.conrelid = 'prod_items'::regclass
      AND c.contype = 'c'
      AND a.attname = 'type'
  LOOP
    EXECUTE format('ALTER TABLE prod_items DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;
