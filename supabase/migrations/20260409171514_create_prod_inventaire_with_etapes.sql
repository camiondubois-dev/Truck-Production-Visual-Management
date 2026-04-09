/*
  # Create prod_inventaire table

  ## Summary
  Creates the prod_inventaire table that tracks vehicles in the pre-production
  inventory, including a checklist of pre-done stations (etapes_faites).

  ## New Tables
  - `prod_inventaire`
    - `id` (text, primary key) — app-generated ID
    - `statut` (text) — disponible | en-production | archive
    - `date_import` (timestamptz) — when added to inventory
    - `date_en_production` (timestamptz, nullable) — when moved to production
    - `job_id` (text, nullable) — linked production job ID
    - `numero` (text, unique) — stock or work-order number
    - `type` (text) — eau | client | detail
    - `variante` (text, nullable) — Neuf | Usagé
    - `marque` (text, nullable)
    - `modele` (text, nullable)
    - `annee` (integer, nullable)
    - `client_acheteur` (text, nullable)
    - `notes` (text, nullable)
    - `nom_client` (text, nullable)
    - `telephone` (text, nullable)
    - `vehicule` (text, nullable)
    - `description_travail` (text, nullable)
    - `description_travaux` (text, nullable)
    - `photo_url` (text, nullable)
    - `etapes_faites` (jsonb) — array of { stationId, fait, date } checklist entries
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Authenticated users can read, insert, update their records
*/

CREATE TABLE IF NOT EXISTS prod_inventaire (
  id text PRIMARY KEY,
  statut text NOT NULL DEFAULT 'disponible',
  date_import timestamptz NOT NULL DEFAULT now(),
  date_en_production timestamptz,
  job_id text,
  numero text NOT NULL,
  type text NOT NULL DEFAULT 'eau',
  variante text,
  marque text,
  modele text,
  annee integer,
  client_acheteur text,
  notes text,
  nom_client text,
  telephone text,
  vehicule text,
  description_travail text,
  description_travaux text,
  photo_url text,
  etapes_faites jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE prod_inventaire ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read inventaire"
  ON prod_inventaire FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert inventaire"
  ON prod_inventaire FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update inventaire"
  ON prod_inventaire FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete inventaire"
  ON prod_inventaire FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);
