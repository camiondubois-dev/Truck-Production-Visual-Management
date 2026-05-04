-- ════════════════════════════════════════════════════════════════════
-- Suivi Vente : table prod_vendeurs + colonne vendeur_id sur inventaire
-- ════════════════════════════════════════════════════════════════════
-- Date : 2026-05-04
-- À rouler dans Supabase SQL Editor

-- ── 1. Table des vendeurs ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prod_vendeurs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom         text NOT NULL UNIQUE,
  actif       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Vendeurs initiaux ──────────────────────────────────────────
INSERT INTO prod_vendeurs (nom, actif) VALUES
  ('JASON', true),
  ('DANY',  true),
  ('RÉGIS', true),
  ('DAVID', true)
ON CONFLICT (nom) DO NOTHING;

-- ── 3. RLS ────────────────────────────────────────────────────────
ALTER TABLE prod_vendeurs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendeurs_select_authenticated" ON prod_vendeurs;
CREATE POLICY "vendeurs_select_authenticated"
  ON prod_vendeurs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "vendeurs_write_staff" ON prod_vendeurs;
CREATE POLICY "vendeurs_write_staff"
  ON prod_vendeurs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('gestion', 'planification')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('gestion', 'planification')));

-- ── 4. Realtime ───────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE prod_vendeurs;

-- ── 5. Colonne vendeur_id sur prod_inventaire ─────────────────────
ALTER TABLE prod_inventaire
  ADD COLUMN IF NOT EXISTS vendeur_id uuid REFERENCES prod_vendeurs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventaire_vendeur ON prod_inventaire (vendeur_id);

-- ── Vérification ──────────────────────────────────────────────────
SELECT * FROM prod_vendeurs ORDER BY nom;
