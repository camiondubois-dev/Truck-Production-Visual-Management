/*
  # Garage Management System - Gestion des camions à l'eau

  1. New Tables
    - `stations`
      - `id` (uuid, primary key)
      - `name` (text) - Nom de la station
      - `display_order` (integer) - Ordre d'affichage
      - `capacity` (integer) - Capacité maximale
      - `type` (text) - Type: physical, external, checkpoint, external_optional
      - `created_at` (timestamptz)
    
    - `slots`
      - `id` (uuid, primary key)
      - `station_id` (uuid, foreign key)
      - `slot_number` (text) - Numéro du slot (ex: "17", "S-01", "9A")
      - `display_order` (integer) - Ordre d'affichage dans la station
      - `created_at` (timestamptz)
    
    - `trucks`
      - `id` (uuid, primary key)
      - `numero` (text, unique) - Numéro du camion
      - `project_type` (text) - Type de projet: camion_eau, vente, externe
      - `variant` (text) - Variante: neuf, usage (si camion_eau)
      - `current_station_id` (uuid, foreign key, nullable)
      - `current_slot_id` (uuid, foreign key, nullable)
      - `status` (text) - waiting, in_progress, blocked, done
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `truck_history`
      - `id` (uuid, primary key)
      - `truck_id` (uuid, foreign key)
      - `from_station_id` (uuid, foreign key, nullable)
      - `from_slot_id` (uuid, foreign key, nullable)
      - `to_station_id` (uuid, foreign key, nullable)
      - `to_slot_id` (uuid, foreign key, nullable)
      - `action` (text) - created, moved, completed
      - `notes` (text, nullable)
      - `created_at` (timestamptz)
    
    - `station_flow`
      - `id` (uuid, primary key)
      - `from_station_id` (uuid, foreign key)
      - `to_station_id` (uuid, foreign key)
      - `variant` (text) - neuf, usage, both
      - `order` (integer) - Ordre dans le flow

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage data
*/

-- Create stations table
CREATE TABLE IF NOT EXISTS stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  display_order integer NOT NULL,
  capacity integer NOT NULL DEFAULT 1,
  type text NOT NULL DEFAULT 'physical',
  created_at timestamptz DEFAULT now()
);

-- Create slots table
CREATE TABLE IF NOT EXISTS slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  slot_number text NOT NULL,
  display_order integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(station_id, slot_number)
);

-- Create trucks table
CREATE TABLE IF NOT EXISTS trucks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text UNIQUE NOT NULL,
  project_type text NOT NULL DEFAULT 'camion_eau',
  variant text,
  current_station_id uuid REFERENCES stations(id) ON DELETE SET NULL,
  current_slot_id uuid REFERENCES slots(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'waiting',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create truck history table
CREATE TABLE IF NOT EXISTS truck_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  truck_id uuid NOT NULL REFERENCES trucks(id) ON DELETE CASCADE,
  from_station_id uuid REFERENCES stations(id) ON DELETE SET NULL,
  from_slot_id uuid REFERENCES slots(id) ON DELETE SET NULL,
  to_station_id uuid REFERENCES stations(id) ON DELETE SET NULL,
  to_slot_id uuid REFERENCES slots(id) ON DELETE SET NULL,
  action text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create station flow table
CREATE TABLE IF NOT EXISTS station_flow (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_station_id uuid NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  to_station_id uuid NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  variant text NOT NULL,
  display_order integer NOT NULL
);

-- Enable RLS
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE trucks ENABLE ROW LEVEL SECURITY;
ALTER TABLE truck_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_flow ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stations
CREATE POLICY "Allow public read access to stations"
  ON stations FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to stations"
  ON stations FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update to stations"
  ON stations FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- RLS Policies for slots
CREATE POLICY "Allow public read access to slots"
  ON slots FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to slots"
  ON slots FOR INSERT
  TO public
  WITH CHECK (true);

-- RLS Policies for trucks
CREATE POLICY "Allow public read access to trucks"
  ON trucks FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to trucks"
  ON trucks FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update to trucks"
  ON trucks FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete to trucks"
  ON trucks FOR DELETE
  TO public
  USING (true);

-- RLS Policies for truck_history
CREATE POLICY "Allow public read access to truck_history"
  ON truck_history FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to truck_history"
  ON truck_history FOR INSERT
  TO public
  WITH CHECK (true);

-- RLS Policies for station_flow
CREATE POLICY "Allow public read access to station_flow"
  ON station_flow FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert to station_flow"
  ON station_flow FOR INSERT
  TO public
  WITH CHECK (true);

-- Insert stations data
INSERT INTO stations (name, display_order, capacity, type) VALUES
  ('Soudure générale', 1, 1, 'physical'),
  ('Sous-traitants', 2, 6, 'external'),
  ('Mécanique moteur / électrique', 3, 6, 'physical'),
  ('Mécanique générale', 4, 4, 'physical'),
  ('Checkpoint - Prêt camion eau', 5, 999, 'checkpoint'),
  ('Soudure spécialisée camion à eau', 6, 4, 'physical'),
  ('Peinture', 7, 2, 'physical'),
  ('Mécanique électrique finale', 8, 6, 'physical'),
  ('Test final', 9, 999, 'checkpoint'),
  ('Vente', 10, 999, 'checkpoint'),
  ('POINT S - Pose de pneus', 99, 1, 'external_optional')
ON CONFLICT DO NOTHING;

-- Insert slots data
DO $$
DECLARE
  v_station_id uuid;
BEGIN
  -- Soudure générale - Slot 17
  SELECT id INTO v_station_id FROM stations WHERE name = 'Soudure générale' LIMIT 1;
  INSERT INTO slots (station_id, slot_number, display_order) VALUES
    (v_station_id, '17', 1)
  ON CONFLICT DO NOTHING;

  -- Sous-traitants - S-01 à S-06
  SELECT id INTO v_station_id FROM stations WHERE name = 'Sous-traitants' LIMIT 1;
  INSERT INTO slots (station_id, slot_number, display_order) VALUES
    (v_station_id, 'S-01', 1),
    (v_station_id, 'S-02', 2),
    (v_station_id, 'S-03', 3),
    (v_station_id, 'S-04', 4),
    (v_station_id, 'S-05', 5),
    (v_station_id, 'S-06', 6)
  ON CONFLICT DO NOTHING;

  -- Mécanique moteur - 11 à 16
  SELECT id INTO v_station_id FROM stations WHERE name = 'Mécanique moteur / électrique' LIMIT 1;
  INSERT INTO slots (station_id, slot_number, display_order) VALUES
    (v_station_id, '11', 1),
    (v_station_id, '12', 2),
    (v_station_id, '13', 3),
    (v_station_id, '14', 4),
    (v_station_id, '15', 5),
    (v_station_id, '16', 6)
  ON CONFLICT DO NOTHING;

  -- Mécanique générale - 9A, 9B, 10A, 10B
  SELECT id INTO v_station_id FROM stations WHERE name = 'Mécanique générale' LIMIT 1;
  INSERT INTO slots (station_id, slot_number, display_order) VALUES
    (v_station_id, '9A', 1),
    (v_station_id, '9B', 2),
    (v_station_id, '10A', 3),
    (v_station_id, '10B', 4)
  ON CONFLICT DO NOTHING;

  -- Soudure spécialisée - 3, 4, 5, 6
  SELECT id INTO v_station_id FROM stations WHERE name = 'Soudure spécialisée camion à eau' LIMIT 1;
  INSERT INTO slots (station_id, slot_number, display_order) VALUES
    (v_station_id, '3', 1),
    (v_station_id, '4', 2),
    (v_station_id, '5', 3),
    (v_station_id, '6', 4)
  ON CONFLICT DO NOTHING;

  -- Peinture - 1, 2
  SELECT id INTO v_station_id FROM stations WHERE name = 'Peinture' LIMIT 1;
  INSERT INTO slots (station_id, slot_number, display_order) VALUES
    (v_station_id, '1', 1),
    (v_station_id, '2', 2)
  ON CONFLICT DO NOTHING;

  -- Mécanique électrique finale - 11 à 16 (shared with earlier station)
  SELECT id INTO v_station_id FROM stations WHERE name = 'Mécanique électrique finale' LIMIT 1;
  INSERT INTO slots (station_id, slot_number, display_order) VALUES
    (v_station_id, '11', 1),
    (v_station_id, '12', 2),
    (v_station_id, '13', 3),
    (v_station_id, '14', 4),
    (v_station_id, '15', 5),
    (v_station_id, '16', 6)
  ON CONFLICT DO NOTHING;

  -- POINT S - Slot 18
  SELECT id INTO v_station_id FROM stations WHERE name = 'POINT S - Pose de pneus' LIMIT 1;
  INSERT INTO slots (station_id, slot_number, display_order) VALUES
    (v_station_id, '18', 1)
  ON CONFLICT DO NOTHING;
END $$;

-- Insert station flow for USAGE variant
DO $$
DECLARE
  v_soudure_gen uuid;
  v_sous_trait uuid;
  v_meca_moteur uuid;
  v_meca_gen uuid;
  v_checkpoint uuid;
  v_soudure_spec uuid;
  v_peinture uuid;
  v_meca_elec uuid;
  v_test uuid;
  v_vente uuid;
BEGIN
  SELECT id INTO v_soudure_gen FROM stations WHERE name = 'Soudure générale' LIMIT 1;
  SELECT id INTO v_sous_trait FROM stations WHERE name = 'Sous-traitants' LIMIT 1;
  SELECT id INTO v_meca_moteur FROM stations WHERE name = 'Mécanique moteur / électrique' LIMIT 1;
  SELECT id INTO v_meca_gen FROM stations WHERE name = 'Mécanique générale' LIMIT 1;
  SELECT id INTO v_checkpoint FROM stations WHERE name = 'Checkpoint - Prêt camion eau' LIMIT 1;
  SELECT id INTO v_soudure_spec FROM stations WHERE name = 'Soudure spécialisée camion à eau' LIMIT 1;
  SELECT id INTO v_peinture FROM stations WHERE name = 'Peinture' LIMIT 1;
  SELECT id INTO v_meca_elec FROM stations WHERE name = 'Mécanique électrique finale' LIMIT 1;
  SELECT id INTO v_test FROM stations WHERE name = 'Test final' LIMIT 1;
  SELECT id INTO v_vente FROM stations WHERE name = 'Vente' LIMIT 1;

  -- Flow for USAGE
  INSERT INTO station_flow (from_station_id, to_station_id, variant, display_order) VALUES
    (v_soudure_gen, v_sous_trait, 'usage', 1),
    (v_sous_trait, v_meca_moteur, 'usage', 2),
    (v_meca_moteur, v_meca_gen, 'usage', 3),
    (v_meca_gen, v_checkpoint, 'usage', 4),
    (v_checkpoint, v_soudure_spec, 'usage', 5),
    (v_soudure_spec, v_peinture, 'both', 6),
    (v_peinture, v_meca_elec, 'both', 7),
    (v_meca_elec, v_test, 'both', 8),
    (v_test, v_vente, 'both', 9)
  ON CONFLICT DO NOTHING;

  -- Flow for NEUF (starts at soudure_spec)
  INSERT INTO station_flow (from_station_id, to_station_id, variant, display_order) VALUES
    (v_soudure_spec, v_peinture, 'neuf', 1),
    (v_peinture, v_meca_elec, 'neuf', 2),
    (v_meca_elec, v_test, 'neuf', 3),
    (v_test, v_vente, 'neuf', 4)
  ON CONFLICT DO NOTHING;
END $$;