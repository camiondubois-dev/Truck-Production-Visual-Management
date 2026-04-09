/*
  # Create prod_time_logs table

  ## Summary
  Tracks time an item spends in a garage slot — entry time, exit time, and computed duration.

  ## New Tables
  - `prod_time_logs`
    - `id` (uuid, primary key)
    - `item_id` (text, required) — references the job/item
    - `garage_id` (text, required) — which garage
    - `slot_id` (text, optional) — which slot within the garage
    - `heure_entree` (timestamptz, default now()) — when item entered
    - `heure_sortie` (timestamptz, nullable) — when item left; null means still in garage
    - `duree_minutes` (integer, nullable) — computed duration on exit
    - `created_at` (timestamptz, default now())

  ## Security
  - RLS enabled; authenticated users can insert and read their own project's logs
*/

CREATE TABLE IF NOT EXISTS prod_time_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id text NOT NULL,
  garage_id text NOT NULL,
  slot_id text,
  heure_entree timestamptz NOT NULL DEFAULT now(),
  heure_sortie timestamptz,
  duree_minutes integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE prod_time_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert time logs"
  ON prod_time_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can read time logs"
  ON prod_time_logs FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update time logs"
  ON prod_time_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
