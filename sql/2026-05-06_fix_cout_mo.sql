-- ════════════════════════════════════════════════════════════════════
-- Fix : cout_mo = cout_vente - prix_achat_reel
-- Formule correcte : M.O. + pièces = coût total de vente moins le prix d'achat du camion
-- Équivalent à : prix_vente - prix_achat_reel - profit_source
-- Date : 2026-05-06
-- ════════════════════════════════════════════════════════════════════

-- Vérification avant (combien seront affectés)
SELECT
  COUNT(*)                                                        AS total_avec_achat,
  COUNT(*) FILTER (WHERE cout_mo = ROUND(cout_vente - prix_achat_reel, 2)) AS deja_corrects,
  COUNT(*) FILTER (WHERE cout_mo != ROUND(cout_vente - prix_achat_reel, 2)
                      OR cout_mo IS NULL)                        AS a_corriger
FROM prod_ventes
WHERE prix_achat_reel IS NOT NULL
  AND cout_vente IS NOT NULL;

-- Correction
UPDATE prod_ventes
SET cout_mo = ROUND(cout_vente - prix_achat_reel, 2)
WHERE prix_achat_reel IS NOT NULL
  AND cout_vente IS NOT NULL;

-- Recréer la vue pour utiliser profit_source et pct_profit_source directement
-- (plus fiable que de recalculer)
DROP VIEW IF EXISTS prod_rapport_profitabilite;
CREATE VIEW prod_rapport_profitabilite AS
SELECT
  v.id,
  v.source,
  v.source_priorite,
  v.annee_fiscale,
  v.date_vente,
  v.so_numero,
  CASE v.source
    WHEN 'encan' THEN 'RITCHIE BROS'
    ELSE v.client
  END                                                            AS client,
  v.stock_numero,
  v.vehicule,
  v.annee,
  v.marque,
  v.modele,
  CASE
    WHEN v.source = 'encan'       THEN 'Encan'
    WHEN v.source = 'exportation' THEN 'Exportation'
    WHEN v.source = 'eau'         THEN 'Camion a eau'
    ELSE                               'Vente detail'
  END                                                            AS type_vente_label,
  v.date_achat,
  v.prix_achat_reel,

  -- M.O. + pièces = ce qui reste entre le prix d'achat et le coût total de vente
  CASE
    WHEN v.prix_achat_reel IS NOT NULL AND v.cout_vente IS NOT NULL
    THEN ROUND(v.cout_vente - v.prix_achat_reel, 2)
    ELSE NULL
  END                                                            AS cout_mo,

  -- Coût total = cout_vente (déjà calculé par la source, prix_achat + M.O.)
  CASE
    WHEN v.prix_achat_reel IS NOT NULL
    THEN v.cout_vente
    ELSE NULL
  END                                                            AS cout_total,

  v.prix_vente,

  -- Profit et % viennent directement de la source (Pedigris) — pas recalculés
  CASE
    WHEN v.prix_achat_reel IS NOT NULL
    THEN v.profit_source
    ELSE NULL
  END                                                            AS marge_profit,

  CASE
    WHEN v.prix_achat_reel IS NOT NULL
    THEN v.pct_profit_source
    ELSE NULL
  END                                                            AS pct_profit,

  v.updated_at
FROM prod_ventes v;

-- Vérification finale : exemple stock 34735
SELECT
  stock_numero,
  prix_achat_reel,
  cout_mo,
  cout_vente                                                     AS cout_total,
  prix_vente,
  profit_source                                                  AS marge_profit,
  pct_profit_source                                              AS pct_profit
FROM prod_ventes
WHERE stock_numero = '34735';

-- Vérification globale
SELECT
  COUNT(*)                                              AS total,
  COUNT(*) FILTER (WHERE prix_achat_reel IS NOT NULL)  AS avec_prix_achat,
  COUNT(*) FILTER (WHERE cout_mo IS NOT NULL)           AS avec_cout_mo,
  COUNT(*) FILTER (WHERE profit_source IS NOT NULL)     AS avec_profit
FROM prod_ventes;
