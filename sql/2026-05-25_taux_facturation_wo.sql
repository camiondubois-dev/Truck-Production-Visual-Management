-- ════════════════════════════════════════════════════════════════════
-- Ajout du taux horaire FACTURÉ par work order (défaut 140 $/h)
-- Date : 2026-05-25
--
-- Camions Dubois facture 140 $/h pour la main-d'œuvre (interne + externe).
-- Ce taux peut être ajusté par WO ou lors d'un import.
--
-- Permet de calculer :
--   revenu_mo_calcule  = total_heures × taux_facturation
--   profit_mo          = revenu_mo_calcule − cout_mo_reel
-- ════════════════════════════════════════════════════════════════════

-- 1. Ajout colonne (défaut 140 $/h)
ALTER TABLE prod_work_orders
  ADD COLUMN IF NOT EXISTS taux_facturation decimal(10,2) DEFAULT 140;

COMMENT ON COLUMN prod_work_orders.taux_facturation IS
  'Taux horaire facturé au client ($/h). Défaut 140. Modifiable par WO ou à l''import.';

-- Initialiser les WO existants à 140 si NULL (cas de la colonne existante sans défaut)
UPDATE prod_work_orders SET taux_facturation = 140 WHERE taux_facturation IS NULL;

-- 2. Recréer la vue prod_wo_cout_mo avec :
--    + revenu_mo_calcule = heures × taux_facturation
--    + profit_mo         = revenu_mo_calcule − cout_mo_reel
--    + profit_total_brut = montant_facture + revenu_mo_calcule − cout_pieces − cout_mo_reel
--      (cas externe : ce que le WO rapporte au total)
DROP VIEW IF EXISTS prod_wo_cout_mo;
CREATE VIEW prod_wo_cout_mo AS
SELECT
  wo.wo_numero,
  wo.type,
  wo.stock_numero,
  wo.client,
  wo.montant_facture,
  wo.cout_pieces,
  wo.taux_facturation,
  COALESCE(SUM(he.heures), 0)                                     AS total_heures,
  COALESCE(SUM(he.heures * e.taux_horaire), 0)                    AS cout_mo_reel,
  -- Revenu théorique de la M.O. (peut servir interne ou externe)
  COALESCE(SUM(he.heures), 0) * COALESCE(wo.taux_facturation, 140) AS revenu_mo_calcule,
  -- Profit sur la M.O. (revenu facturable − coût réel)
  (COALESCE(SUM(he.heures), 0) * COALESCE(wo.taux_facturation, 140))
    - COALESCE(SUM(he.heures * e.taux_horaire), 0)                AS profit_mo,
  -- Profit total (pour les WO externes : revenu facturé + revenu M.O. − pièces − coût M.O.)
  -- Anciennement appelé "profit_brut", on garde le même nom pour compat
  COALESCE(wo.montant_facture, 0) - COALESCE(wo.cout_pieces, 0)
    - COALESCE(SUM(he.heures * e.taux_horaire), 0)                AS profit_brut
FROM prod_work_orders wo
LEFT JOIN prod_heures_employes he ON he.wo_numero  = wo.wo_numero
LEFT JOIN prod_employes        e  ON e.id          = he.employe_id
GROUP BY wo.wo_numero, wo.type, wo.stock_numero, wo.client,
         wo.montant_facture, wo.cout_pieces, wo.taux_facturation;

-- Recréer la vue agrégée (pas de changement structurel mais dépend de la vue ci-dessus)
DROP VIEW IF EXISTS prod_camion_cout_mo_reel;
CREATE VIEW prod_camion_cout_mo_reel AS
SELECT
  stock_numero,
  COUNT(*)            AS nb_wo,
  SUM(total_heures)   AS total_heures,
  SUM(cout_mo_reel)   AS cout_mo_reel_total,
  SUM(revenu_mo_calcule) AS revenu_mo_calcule_total,
  SUM(profit_mo)         AS profit_mo_total
FROM prod_wo_cout_mo
WHERE type = 'interne' AND stock_numero IS NOT NULL
GROUP BY stock_numero;

-- 3. Vérifications
SELECT 'Colonne taux_facturation ajoutée (défaut 140 $/h).' AS info;
SELECT 'Vues prod_wo_cout_mo + prod_camion_cout_mo_reel mises à jour.' AS info;

-- Quick check : résumé des WO existants
SELECT
  type,
  COUNT(*) AS nb,
  AVG(taux_facturation)  AS taux_moyen,
  SUM(total_heures)      AS h_totales,
  SUM(cout_mo_reel)      AS cout_total,
  SUM(revenu_mo_calcule) AS revenu_mo_total,
  SUM(profit_mo)         AS profit_mo_total
FROM prod_wo_cout_mo
GROUP BY type;
