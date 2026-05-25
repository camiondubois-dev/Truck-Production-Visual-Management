-- ════════════════════════════════════════════════════════════════════
-- MODULE MAIN-D'ŒUVRE — Phase 1 (Fondations)
-- Date : 2026-05-25
--
-- 3 tables pour suivre :
--   1. Les employés (nom, code iTrack, taux horaire, département)
--   2. Les work orders (interne lié à un camion, ou externe lié à un client)
--   3. Les heures pointées par employé sur un WO
--
-- Permet ensuite de calculer le vrai coût main-d'œuvre par camion/job
-- (heures × taux horaire) et de le comparer au cout_mo importé Hitrac.
-- ════════════════════════════════════════════════════════════════════

-- ─── 1. Employés ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prod_employes (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  nom             text          NOT NULL,
  code_hitrac     text          UNIQUE,                -- code utilisé dans exports iTrack
  departement     text,                                 -- méc, soudure, électrique, peinture, etc.
  taux_horaire    decimal(10,2) NOT NULL DEFAULT 0,   -- coût employeur réel ($/h)
  actif           boolean       NOT NULL DEFAULT true,
  notes           text,
  created_at      timestamptz   DEFAULT now(),
  updated_at      timestamptz   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employes_actif       ON prod_employes (actif);
CREATE INDEX IF NOT EXISTS idx_employes_code_hitrac ON prod_employes (code_hitrac);

-- ─── 2. Work Orders ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prod_work_orders (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_numero         text          NOT NULL UNIQUE,
  type              text          NOT NULL CHECK (type IN ('interne', 'externe')),
  date_ouverture    date,
  date_fermeture    date,
  stock_numero      text,                              -- lien prod_inventaire.numero (si interne)
  client            text,                              -- nom client (si externe)
  description       text,
  statut            text          DEFAULT 'ouvert' CHECK (statut IN ('ouvert', 'ferme', 'facture')),
  montant_facture   decimal(12,2) DEFAULT 0,           -- revenu (externe surtout)
  cout_pieces       decimal(12,2) DEFAULT 0,           -- pièces consommées (Hitrac)
  source_fichier    text,
  created_at        timestamptz   DEFAULT now(),
  updated_at        timestamptz   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wo_type         ON prod_work_orders (type);
CREATE INDEX IF NOT EXISTS idx_wo_stock        ON prod_work_orders (stock_numero) WHERE stock_numero IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wo_client       ON prod_work_orders (client)       WHERE client IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wo_statut       ON prod_work_orders (statut);
CREATE INDEX IF NOT EXISTS idx_wo_date_ouv     ON prod_work_orders (date_ouverture);

-- ─── 3. Heures pointées ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prod_heures_employes (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  employe_id      uuid          NOT NULL REFERENCES prod_employes(id) ON DELETE RESTRICT,
  wo_numero       text          REFERENCES prod_work_orders(wo_numero) ON DELETE SET NULL,
  date            date          NOT NULL,
  heures          decimal(6,2)  NOT NULL,
  notes           text,
  source_fichier  text,
  created_at      timestamptz   DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_heures_employe       ON prod_heures_employes (employe_id);
CREATE INDEX IF NOT EXISTS idx_heures_wo            ON prod_heures_employes (wo_numero);
CREATE INDEX IF NOT EXISTS idx_heures_date          ON prod_heures_employes (date);
CREATE INDEX IF NOT EXISTS idx_heures_employe_date  ON prod_heures_employes (employe_id, date);

-- ─── 4. Triggers updated_at ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_employes_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS employes_updated_at ON prod_employes;
CREATE TRIGGER employes_updated_at BEFORE UPDATE ON prod_employes
  FOR EACH ROW EXECUTE FUNCTION trg_employes_updated_at();

CREATE OR REPLACE FUNCTION trg_wo_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS wo_updated_at ON prod_work_orders;
CREATE TRIGGER wo_updated_at BEFORE UPDATE ON prod_work_orders
  FOR EACH ROW EXECUTE FUNCTION trg_wo_updated_at();

-- ─── 5. Vue d'agrégation : coût main-d'œuvre par WO ─────────────────
-- Calcule le coût total M.O. pour chaque WO :
--   somme(heures × taux_horaire de l'employé qui a pointé)
CREATE OR REPLACE VIEW prod_wo_cout_mo AS
SELECT
  wo.wo_numero,
  wo.type,
  wo.stock_numero,
  wo.client,
  wo.montant_facture,
  wo.cout_pieces,
  COALESCE(SUM(he.heures), 0)                                AS total_heures,
  COALESCE(SUM(he.heures * e.taux_horaire), 0)               AS cout_mo_reel,
  -- Profit = revenu - (pièces + M.O. calculée)
  COALESCE(wo.montant_facture, 0) - COALESCE(wo.cout_pieces, 0)
    - COALESCE(SUM(he.heures * e.taux_horaire), 0)           AS profit_brut
FROM prod_work_orders wo
LEFT JOIN prod_heures_employes he ON he.wo_numero = wo.wo_numero
LEFT JOIN prod_employes        e  ON e.id          = he.employe_id
GROUP BY wo.wo_numero, wo.type, wo.stock_numero, wo.client, wo.montant_facture, wo.cout_pieces;

-- ─── 6. Vue d'agrégation : coût M.O. par CAMION ─────────────────────
-- Cumule le coût M.O. de tous les WO internes liés à un camion
CREATE OR REPLACE VIEW prod_camion_cout_mo_reel AS
SELECT
  stock_numero,
  COUNT(*)            AS nb_wo,
  SUM(total_heures)   AS total_heures,
  SUM(cout_mo_reel)   AS cout_mo_reel_total
FROM prod_wo_cout_mo
WHERE type = 'interne' AND stock_numero IS NOT NULL
GROUP BY stock_numero;

-- ─── 7. RLS ─────────────────────────────────────────────────────────
ALTER TABLE prod_employes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE prod_work_orders     ENABLE ROW LEVEL SECURITY;
ALTER TABLE prod_heures_employes ENABLE ROW LEVEL SECURITY;

-- Politiques ouvertes (cohérent avec le reste du projet)
DROP POLICY IF EXISTS "employes_all"        ON prod_employes;
CREATE POLICY "employes_all"        ON prod_employes        FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "work_orders_all"     ON prod_work_orders;
CREATE POLICY "work_orders_all"     ON prod_work_orders     FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "heures_employes_all" ON prod_heures_employes;
CREATE POLICY "heures_employes_all" ON prod_heures_employes FOR ALL USING (true) WITH CHECK (true);

-- ─── 8. Vérifications ───────────────────────────────────────────────
SELECT 'Table prod_employes créée.'                AS info;
SELECT 'Table prod_work_orders créée.'             AS info;
SELECT 'Table prod_heures_employes créée.'         AS info;
SELECT 'Vue prod_wo_cout_mo créée.'                AS info;
SELECT 'Vue prod_camion_cout_mo_reel créée.'       AS info;
