/*
  # Create prod_reservoirs table and add reservoir tracking columns

  ## Summary
  Creates the prod_reservoirs table to track water tanks inventory, and adds
  reservoir tracking columns to prod_items (creating it if needed) and prod_inventaire.

  ## New Tables
  - `prod_reservoirs`: tracks individual reservoirs with type, state, linked camion
  - `prod_items`: created if not exists (app-managed items/jobs table)

  ## Modified Tables
  - `prod_items`: adds a_un_reservoir and reservoir_id columns
  - `prod_inventaire`: adds a_un_reservoir and reservoir_id columns

  ## Security
  - RLS enabled on prod_reservoirs with authenticated-only policies
*/

CREATE TABLE IF NOT EXISTS prod_reservoirs (
  id text PRIMARY KEY,
  numero text NOT NULL,
  type text NOT NULL DEFAULT '4000g',
  etat text NOT NULL DEFAULT 'disponible',
  camion_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE prod_reservoirs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'prod_reservoirs' AND policyname = 'Authenticated users can read reservoirs'
  ) THEN
    CREATE POLICY "Authenticated users can read reservoirs"
      ON prod_reservoirs FOR SELECT
      TO authenticated
      USING (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'prod_reservoirs' AND policyname = 'Authenticated users can insert reservoirs'
  ) THEN
    CREATE POLICY "Authenticated users can insert reservoirs"
      ON prod_reservoirs FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'prod_reservoirs' AND policyname = 'Authenticated users can update reservoirs'
  ) THEN
    CREATE POLICY "Authenticated users can update reservoirs"
      ON prod_reservoirs FOR UPDATE
      TO authenticated
      USING (auth.uid() IS NOT NULL)
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'prod_reservoirs' AND policyname = 'Authenticated users can delete reservoirs'
  ) THEN
    CREATE POLICY "Authenticated users can delete reservoirs"
      ON prod_reservoirs FOR DELETE
      TO authenticated
      USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS prod_items (
  id text PRIMARY KEY,
  type text NOT NULL DEFAULT 'eau',
  etat text NOT NULL DEFAULT 'en-attente',
  numero text NOT NULL,
  label text NOT NULL DEFAULT '',
  slot_id text,
  date_creation timestamptz NOT NULL DEFAULT now(),
  date_entree_slot timestamptz,
  date_archive timestamptz,
  station_actuelle text,
  dernier_garage_id text,
  dernier_slot_id text,
  urgence boolean NOT NULL DEFAULT false,
  notes text,
  etat_commercial text,
  client_acheteur text,
  variante text,
  annee integer,
  marque text,
  modele text,
  nom_client text,
  telephone text,
  description_travail text,
  vehicule text,
  description_travaux text,
  stations_actives jsonb NOT NULL DEFAULT '[]'::jsonb,
  progression jsonb NOT NULL DEFAULT '[]'::jsonb,
  documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  inventaire_id text,
  photo_url text,
  client_id text,
  a_un_reservoir boolean NOT NULL DEFAULT false,
  reservoir_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE prod_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'prod_items' AND policyname = 'Authenticated users can read items'
  ) THEN
    CREATE POLICY "Authenticated users can read items"
      ON prod_items FOR SELECT
      TO authenticated
      USING (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'prod_items' AND policyname = 'Authenticated users can insert items'
  ) THEN
    CREATE POLICY "Authenticated users can insert items"
      ON prod_items FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'prod_items' AND policyname = 'Authenticated users can update items'
  ) THEN
    CREATE POLICY "Authenticated users can update items"
      ON prod_items FOR UPDATE
      TO authenticated
      USING (auth.uid() IS NOT NULL)
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'prod_items' AND policyname = 'Authenticated users can delete items'
  ) THEN
    CREATE POLICY "Authenticated users can delete items"
      ON prod_items FOR DELETE
      TO authenticated
      USING (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prod_items' AND column_name = 'a_un_reservoir'
  ) THEN
    ALTER TABLE prod_items ADD COLUMN a_un_reservoir boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prod_items' AND column_name = 'reservoir_id'
  ) THEN
    ALTER TABLE prod_items ADD COLUMN reservoir_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prod_inventaire' AND column_name = 'a_un_reservoir'
  ) THEN
    ALTER TABLE prod_inventaire ADD COLUMN a_un_reservoir boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prod_inventaire' AND column_name = 'reservoir_id'
  ) THEN
    ALTER TABLE prod_inventaire ADD COLUMN reservoir_id text;
  END IF;
END $$;
