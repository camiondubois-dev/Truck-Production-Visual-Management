-- ════════════════════════════════════════════════════════════════════
-- PHASE 1 : Unifier prod_ventes comme table unique (vendus + inventaire)
-- Date : 2026-05-07
--
-- RÈGLE : prod_ventes priorise toujours. Si un stock_numero est déjà
-- dans prod_ventes (vendu), il ne sera jamais écrasé par l'inventaire.
--
-- EXÉCUTER DANS L'ORDRE — vérifier les counts à chaque étape
-- NE PAS supprimer prod_inventaire/prod_couts_vehicule avant validation
-- ════════════════════════════════════════════════════════════════════


-- ═══ ÉTAPE 1 : Nouvelles colonnes dans prod_ventes ════════════════

ALTER TABLE prod_ventes
  ADD COLUMN IF NOT EXISTS statut         text    NOT NULL DEFAULT 'vendu'
                            CHECK (statut IN ('vendu', 'inventaire')),
  ADD COLUMN IF NOT EXISTS prix_demande   decimal(12,2),
  ADD COLUMN IF NOT EXISTS budget_restant decimal(12,2),
  ADD COLUMN IF NOT EXISTS cout_pieces    decimal(12,2);

-- prix_vente et annee_fiscale peuvent être NULL pour un camion en inventaire
ALTER TABLE prod_ventes
  ALTER COLUMN prix_vente    DROP NOT NULL,
  ALTER COLUMN annee_fiscale DROP NOT NULL;

-- Index sur statut pour les filtres
CREATE INDEX IF NOT EXISTS idx_ventes_statut ON prod_ventes (statut);

-- Vérification
SELECT 'Colonnes ajoutées — tous les enregistrements existants = vendus' AS info;
SELECT COUNT(*) AS total_actuels FROM prod_ventes;


-- ═══ ÉTAPE 2 : Marquer tous les enregistrements actuels comme vendus ═══

UPDATE prod_ventes SET statut = 'vendu';

SELECT statut, COUNT(*) AS nb FROM prod_ventes GROUP BY statut;


-- ═══ ÉTAPE 3 : Migrer les camions d'inventaire ════════════════════
-- Source : prod_inventaire (marque/modele/annee/type) + prod_couts_vehicule (coûts)
-- Règle  : stock_numero déjà dans prod_ventes → ON CONFLICT DO NOTHING

INSERT INTO prod_ventes (
  stock_numero,
  statut,
  source,
  source_priorite,
  annee_fiscale,
  date_vente,
  prix_vente,
  vehicule,
  marque,
  modele,
  annee,
  prix_achat_reel,
  cout_mo,
  budget_restant,
  date_achat
)
SELECT
  inv.numero,
  'inventaire',
  CASE WHEN inv.type = 'eau' THEN 'eau' ELSE 'detail' END,
  3,
  NULL,   -- pas encore vendu, pas d'année fiscale
  NULL,   -- pas de date de vente
  NULL,   -- pas de prix de vente
  TRIM(CONCAT_WS(' ',
    CASE WHEN inv.annee IS NOT NULL THEN inv.annee::text END,
    inv.marque,
    inv.modele
  )),
  inv.marque,
  inv.modele,
  inv.annee,
  cv.cost_purchased,   -- prix d'achat (immuable)
  cv.cost_consumed,    -- M.O. + pièces accumulés à ce jour
  cv.cost_remaining,   -- budget restant selon iTrack
  cv.date_achat
FROM prod_inventaire inv
LEFT JOIN prod_couts_vehicule cv ON cv.stock_numero = inv.numero
WHERE inv.numero NOT IN (SELECT stock_numero FROM prod_ventes)
ON CONFLICT (stock_numero) DO NOTHING;

-- Vérification
SELECT statut, COUNT(*) AS nb FROM prod_ventes GROUP BY statut ORDER BY statut;


-- ═══ ÉTAPE 4 : Recréer la vue Rapport de vente ════════════════════
-- Filtre : statut = 'vendu' seulement

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

  v.updated_at
FROM prod_ventes v
WHERE v.statut = 'vendu';


-- ═══ ÉTAPE 5 : Recréer la vue Inventaire & Projection ═════════════
-- Filtre : statut = 'inventaire' seulement
-- Compatible avec le composant React existant (mêmes noms de colonnes)

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
  v.budget_restant,
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


-- ═══ ÉTAPE 6 : Vérification finale ════════════════════════════════

SELECT
  statut,
  COUNT(*)                                       AS nb_camions,
  COUNT(*) FILTER (WHERE prix_achat_reel IS NOT NULL) AS avec_prix_achat,
  ROUND(SUM(prix_achat_reel) / 1000000, 2)      AS total_achat_M$,
  ROUND(SUM(prix_vente) / 1000000, 2)           AS total_vente_M$
FROM prod_ventes
GROUP BY statut
ORDER BY statut;

-- ════════════════════════════════════════════════════════════════════
-- APRÈS VALIDATION : supprimer les anciennes tables (à rouler séparément)
-- ════════════════════════════════════════════════════════════════════
--
-- DROP TABLE IF EXISTS prod_inventaire CASCADE;
-- DROP TABLE IF EXISTS prod_couts_vehicule CASCADE;
--
-- ════════════════════════════════════════════════════════════════════
