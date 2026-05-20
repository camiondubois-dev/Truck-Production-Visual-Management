-- ════════════════════════════════════════════════════════════════════
-- MODULE VENTES PIÈCES
-- Date : 2026-05-20
-- Source : exports CSV Hightrack (Sales Orders par vendeur)
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS prod_ventes_pieces (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_numero text        UNIQUE NOT NULL,
  date_vente      date        NOT NULL,
  client          text,
  client_numero   text,
  vendeur         text,         -- code Hightrack (ex: avaliquette, brainville)
  sous_total      decimal(12,2),
  annee_fiscale   integer,
  source_fichier  text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pieces_date    ON prod_ventes_pieces (date_vente);
CREATE INDEX IF NOT EXISTS idx_pieces_vendeur ON prod_ventes_pieces (vendeur);
CREATE INDEX IF NOT EXISTS idx_pieces_af      ON prod_ventes_pieces (annee_fiscale);

-- RLS
ALTER TABLE prod_ventes_pieces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pieces_select" ON prod_ventes_pieces
  FOR SELECT USING (true);

CREATE POLICY "pieces_insert" ON prod_ventes_pieces
  FOR INSERT WITH CHECK (true);

CREATE POLICY "pieces_update" ON prod_ventes_pieces
  FOR UPDATE USING (true);

-- Vérification
SELECT 'Table prod_ventes_pieces créée.' AS info;
