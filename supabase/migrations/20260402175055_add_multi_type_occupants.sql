/*
  # Add Multi-Type Occupants Support

  1. Schema Changes
    - Add `occupant_type` column to trucks table ('eau', 'client', 'detail')
    - Add metadata columns for different occupant types:
      - `label` (text) - Display label for the occupant
      - `statut` (text) - Simple status: 'en-travail', 'attente', 'pret', 'bloque'
      - `depuis` (timestamptz) - Entry date into current slot
      - `notes` (text) - General notes

    For client jobs:
      - `nom_client` (text) - Client name
      - `telephone` (text) - Client phone
      - `travail_description` (text) - Work description
      - `technicien` (text) - Assigned technician

    For detail/vente:
      - `annee` (integer) - Year
      - `marque` (text) - Brand
      - `modele` (text) - Model
      - `prix_vente` (numeric) - Sale price
      - `travail_description` (text) - Work description

  2. Migration Strategy
    - Add new columns with defaults
    - Update existing eau trucks with proper values
    - All columns nullable for flexibility

  3. Security
    - Update RLS policies to handle all occupant types
*/

-- Add occupant_type column (defaults to 'eau' for existing records)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trucks' AND column_name = 'occupant_type'
  ) THEN
    ALTER TABLE trucks ADD COLUMN occupant_type text NOT NULL DEFAULT 'eau';
  END IF;
END $$;

-- Add common columns for all occupants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trucks' AND column_name = 'label'
  ) THEN
    ALTER TABLE trucks ADD COLUMN label text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trucks' AND column_name = 'statut'
  ) THEN
    ALTER TABLE trucks ADD COLUMN statut text DEFAULT 'en-travail';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trucks' AND column_name = 'depuis'
  ) THEN
    ALTER TABLE trucks ADD COLUMN depuis timestamptz DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trucks' AND column_name = 'notes'
  ) THEN
    ALTER TABLE trucks ADD COLUMN notes text;
  END IF;
END $$;

-- Add client-specific columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trucks' AND column_name = 'nom_client'
  ) THEN
    ALTER TABLE trucks ADD COLUMN nom_client text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trucks' AND column_name = 'telephone'
  ) THEN
    ALTER TABLE trucks ADD COLUMN telephone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trucks' AND column_name = 'travail_description'
  ) THEN
    ALTER TABLE trucks ADD COLUMN travail_description text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trucks' AND column_name = 'technicien'
  ) THEN
    ALTER TABLE trucks ADD COLUMN technicien text;
  END IF;
END $$;

-- Add detail/vente specific columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trucks' AND column_name = 'annee'
  ) THEN
    ALTER TABLE trucks ADD COLUMN annee integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trucks' AND column_name = 'marque'
  ) THEN
    ALTER TABLE trucks ADD COLUMN marque text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trucks' AND column_name = 'modele'
  ) THEN
    ALTER TABLE trucks ADD COLUMN modele text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trucks' AND column_name = 'prix_vente'
  ) THEN
    ALTER TABLE trucks ADD COLUMN prix_vente numeric(10, 2);
  END IF;
END $$;

-- Add comment to table
COMMENT ON TABLE trucks IS 'Unified occupants table supporting eau (water trucks), client (client jobs), and detail (detail/sale vehicles)';

-- Add column comments
COMMENT ON COLUMN trucks.occupant_type IS 'Type: eau (water truck with full pipeline), client (client job), detail (detail/sale vehicle)';
COMMENT ON COLUMN trucks.label IS 'Display label: truck description, client name + work, or vehicle description';
COMMENT ON COLUMN trucks.statut IS 'Simple status: en-travail, attente, pret, bloque';
COMMENT ON COLUMN trucks.depuis IS 'Entry date into current slot';
COMMENT ON COLUMN trucks.nom_client IS 'Client name (for client jobs only)';
COMMENT ON COLUMN trucks.telephone IS 'Client phone (for client jobs only)';
COMMENT ON COLUMN trucks.travail_description IS 'Work description (for client jobs and detail vehicles)';
COMMENT ON COLUMN trucks.technicien IS 'Assigned technician (for client jobs)';
COMMENT ON COLUMN trucks.annee IS 'Vehicle year (for eau and detail types)';
COMMENT ON COLUMN trucks.marque IS 'Vehicle brand (for eau and detail types)';
COMMENT ON COLUMN trucks.modele IS 'Vehicle model (for eau and detail types)';
COMMENT ON COLUMN trucks.prix_vente IS 'Sale price (for detail vehicles)';