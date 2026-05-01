-- ════════════════════════════════════════════════════════════════════════════
-- Module Moteurs — Schema initial (MVP)
-- Date : 2026-05-01
-- ════════════════════════════════════════════════════════════════════════════
-- À rouler dans Supabase SQL Editor

-- ── 1. Table principale ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prod_moteurs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identification
  stk_numero          text NOT NULL UNIQUE,         -- ex. '35030'
  work_order          text UNIQUE,                  -- W/O Itrack ex. '1-32491' (peut être null avant émission)

  -- Description
  description_moteur  text,                         -- 'PACCAR MX-13 EPA17 510 HP'
  proprietaire        text NOT NULL DEFAULT 'interne'
                      CHECK (proprietaire IN ('interne', 'client', 'exportation', 'inventaire')),
  nom_client          text,                         -- si proprietaire = 'client'
  etat_commercial     text,                         -- libre : 'VENDU URGENT', 'À VENDRE', etc.
  notes               text,                         -- DESCRIPTION column du tableau (ex. 'TROUBLE POMPE A FUEL')

  -- Média
  photo_url           text,

  -- Statut global
  statut              text NOT NULL DEFAULT 'en-attente'
                      CHECK (statut IN ('en-attente', 'en-cours', 'pret', 'archive')),

  -- Position physique
  poste_courant       text,                         -- ID slot ('demarrage', 'table-a', 'stockage-p1', etc.)
  employe_courant     uuid REFERENCES profiles(id) ON DELETE SET NULL,

  -- Tracking temps
  date_entree         timestamptz,                  -- 1re étape démarrée
  date_sortie         timestamptz,                  -- toutes les étapes terminées

  -- Plan de production (étapes à faire)
  -- Format : [{ id, etape_id, ordre, statut, employe_id, debut, fin, duree_minutes, note }]
  road_map            jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Métadonnées
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Indexes ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_moteurs_statut         ON prod_moteurs (statut);
CREATE INDEX IF NOT EXISTS idx_moteurs_poste          ON prod_moteurs (poste_courant);
CREATE INDEX IF NOT EXISTS idx_moteurs_employe        ON prod_moteurs (employe_courant);
CREATE INDEX IF NOT EXISTS idx_moteurs_proprietaire   ON prod_moteurs (proprietaire);
CREATE INDEX IF NOT EXISTS idx_moteurs_road_map_gin   ON prod_moteurs USING GIN (road_map);

-- ── 3. Trigger updated_at ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_moteurs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_moteurs_updated_at ON prod_moteurs;
CREATE TRIGGER trg_moteurs_updated_at
BEFORE UPDATE ON prod_moteurs
FOR EACH ROW EXECUTE FUNCTION set_moteurs_updated_at();

-- ── 4. RLS (Row Level Security) ────────────────────────────────────────────
ALTER TABLE prod_moteurs ENABLE ROW LEVEL SECURITY;

-- Lecture : tout user authentifié
DROP POLICY IF EXISTS "moteurs_select_authenticated" ON prod_moteurs;
CREATE POLICY "moteurs_select_authenticated"
  ON prod_moteurs FOR SELECT
  TO authenticated
  USING (true);

-- Écriture : gestion + planification + employe (mécanos peuvent toucher leurs étapes)
DROP POLICY IF EXISTS "moteurs_write_staff" ON prod_moteurs;
CREATE POLICY "moteurs_write_staff"
  ON prod_moteurs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('gestion', 'planification', 'employe')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('gestion', 'planification', 'employe')
    )
  );

-- ── 5. Realtime ────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE prod_moteurs;

-- ── 6. Storage bucket pour photos moteur ──────────────────────────────────
-- (À créer manuellement via Supabase Dashboard > Storage > Create bucket
--  Nom: 'moteurs', Public: true)

-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (si besoin)
-- ════════════════════════════════════════════════════════════════════════════
-- DROP TRIGGER IF EXISTS trg_moteurs_updated_at ON prod_moteurs;
-- DROP FUNCTION IF EXISTS set_moteurs_updated_at();
-- DROP TABLE IF EXISTS prod_moteurs;
