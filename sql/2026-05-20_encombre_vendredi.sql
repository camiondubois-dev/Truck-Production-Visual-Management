-- ════════════════════════════════════════════════════════════════════
-- Encombre du vendredi — Table solde compte banque
-- Date : 2026-05-20
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS prod_solde_banque (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  date_saisie date        NOT NULL,
  solde       decimal(14,2) NOT NULL,
  saisi_par   text,
  notes       text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_solde_date ON prod_solde_banque (date_saisie DESC);

-- RLS
ALTER TABLE prod_solde_banque ENABLE ROW LEVEL SECURITY;

CREATE POLICY "solde_select" ON prod_solde_banque FOR SELECT USING (true);
CREATE POLICY "solde_insert" ON prod_solde_banque FOR INSERT WITH CHECK (true);
CREATE POLICY "solde_update" ON prod_solde_banque FOR UPDATE USING (true);

SELECT 'Table prod_solde_banque créée.' AS info;
