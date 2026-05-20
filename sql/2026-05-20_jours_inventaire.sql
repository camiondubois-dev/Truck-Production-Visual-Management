-- ════════════════════════════════════════════════════════════════════
-- Ajout : jours_inventaire dans prod_rapport_profitabilite
-- Date : 2026-05-20
--
-- Calcule le nombre de jours entre la date d'achat et la date de vente.
-- Utile pour calculer les coûts d'intérêt sur le capital immobilisé.
-- ════════════════════════════════════════════════════════════════════

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

  -- M.O. = cout_vente - prix_achat_reel
  CASE
    WHEN v.prix_achat_reel IS NOT NULL AND v.cout_vente IS NOT NULL
    THEN ROUND(v.cout_vente - v.prix_achat_reel, 2)
    ELSE NULL
  END                                                            AS cout_mo,

  v.cout_vente                                                   AS cout_total,
  v.prix_vente,

  -- Profit et % viennent de la source (Pedigris/iTrack)
  CASE WHEN v.prix_achat_reel IS NOT NULL
    THEN v.profit_source ELSE NULL END                           AS marge_profit,
  CASE WHEN v.prix_achat_reel IS NOT NULL
    THEN v.pct_profit_source ELSE NULL END                       AS pct_profit,

  -- Jours en inventaire (achat → vente)
  CASE
    WHEN v.date_achat IS NOT NULL AND v.date_vente IS NOT NULL
    THEN (v.date_vente::date - v.date_achat::date)
    ELSE NULL
  END                                                            AS jours_inventaire,

  v.updated_at
FROM prod_ventes v
WHERE v.statut = 'vendu';

SELECT 'Vue prod_rapport_profitabilite mise à jour avec jours_inventaire.' AS info;
