-- ════════════════════════════════════════════════════════════════════
-- Renommer budget_restant → cout_total_investi dans prod_ventes
-- Date : 2026-05-08
--
-- Raison : "budget_restant" venait de iTrack et prêtait à confusion.
-- Ce champ contient le coût total investi (prix_achat_reel + cout_mo),
-- pas un budget restant à dépenser.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE prod_ventes
  RENAME COLUMN budget_restant TO cout_total_investi;

-- Recréer la vue prod_inventaire_couts avec le nouveau nom
-- (la vue référençait budget_restant)
DROP VIEW IF EXISTS prod_inventaire_couts;
CREATE VIEW prod_inventaire_couts AS
SELECT
  v.stock_numero,
  'inventaire'                                                   AS statut,
  CASE WHEN v.source = 'eau' THEN 'eau' ELSE 'detail' END       AS type_vehicule,
  v.date_achat,
  CASE WHEN v.date_achat IS NOT NULL
    THEN EXTRACT(DAY FROM now() - v.date_achat)::int
    ELSE NULL
  END                                                            AS age_jours,
  v.prix_achat_reel                                              AS cout_achat,
  COALESCE(v.cout_mo, 0)                                        AS cout_total_depense,
  -- cout_total_investi = prix_achat_reel + cout_mo (calculé, stocké pour perf)
  v.cout_total_investi,
  NULL::decimal                                                  AS projected_deficit,
  NULL::decimal                                                  AS remaining_market,
  v.prix_achat_reel,
  v.prix_demande,
  v.marque,
  v.modele,
  v.annee
FROM prod_ventes v
WHERE v.statut = 'inventaire'
ORDER BY v.prix_achat_reel DESC NULLS LAST;

-- Vérification
SELECT COUNT(*) AS nb_inventaire,
       ROUND(SUM(cout_total_investi) / 1000000, 2) AS total_investi_M$
FROM prod_ventes
WHERE statut = 'inventaire';
