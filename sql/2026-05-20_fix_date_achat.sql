-- ════════════════════════════════════════════════════════════════════
-- Fix : date_achat manquante dans prod_ventes (camions en inventaire)
-- Date : 2026-05-20
--
-- PROBLÈME : age_jours = 0 / NULL pour tous les camions en inventaire.
--
-- CAUSE : la migration 2026-05-07 a copié date_achat depuis
--         prod_couts_vehicule.date_achat, qui était déjà NULL.
--         HITRAC cost import ne remplit jamais date_achat.
--
-- SOLUTION : utiliser prod_inventaire.date_import comme proxy fiable
--            (= date à laquelle le camion est entré dans le système).
--
-- ÉTAPE 1 — Diagnostiquer
-- ════════════════════════════════════════════════════════════════════

SELECT
  COUNT(*)                                                     AS total_inventaire,
  COUNT(*) FILTER (WHERE date_achat IS NOT NULL)               AS avec_date_achat,
  COUNT(*) FILTER (WHERE date_achat IS NULL)                   AS sans_date_achat
FROM prod_ventes
WHERE statut = 'inventaire';

-- Voir les camions concernés
SELECT v.stock_numero, v.marque, v.modele, v.annee, v.date_achat, i.date_import
FROM prod_ventes v
LEFT JOIN prod_inventaire i ON i.numero = v.stock_numero
WHERE v.statut = 'inventaire'
  AND v.date_achat IS NULL
ORDER BY i.date_import DESC NULLS LAST
LIMIT 30;


-- ════════════════════════════════════════════════════════════════════
-- ÉTAPE 2 — Backfill date_achat depuis prod_inventaire.date_import
-- ════════════════════════════════════════════════════════════════════

UPDATE prod_ventes v
SET date_achat = i.date_import
FROM prod_inventaire i
WHERE i.numero   = v.stock_numero
  AND v.statut   = 'inventaire'
  AND v.date_achat IS NULL
  AND i.date_import IS NOT NULL;

SELECT CONCAT('Mis à jour : ', COUNT(*), ' camions avec date_achat.') AS resultat
FROM prod_ventes
WHERE statut = 'inventaire'
  AND date_achat IS NOT NULL;


-- ════════════════════════════════════════════════════════════════════
-- ÉTAPE 3 — Synchroniser les camions d'inventaire manquants dans prod_ventes
--            (camions ajoutés APRÈS la migration du 2026-05-07)
-- ════════════════════════════════════════════════════════════════════

INSERT INTO prod_ventes (
  stock_numero,
  statut,
  source,
  source_priorite,
  vehicule,
  marque,
  modele,
  annee,
  date_achat
)
SELECT
  inv.numero,
  'inventaire',
  CASE WHEN inv.type = 'eau' THEN 'eau' ELSE 'detail' END,
  3,
  TRIM(CONCAT_WS(' ',
    CASE WHEN inv.annee IS NOT NULL THEN inv.annee::text END,
    inv.marque,
    inv.modele
  )),
  inv.marque,
  inv.modele,
  inv.annee,
  inv.date_import
FROM prod_inventaire inv
WHERE inv.numero NOT IN (SELECT stock_numero FROM prod_ventes)
  AND inv.statut <> 'archive'
ON CONFLICT (stock_numero) DO NOTHING;

SELECT CONCAT('Insérés dans prod_ventes : ', COUNT(*), ' camions manquants.') AS resultat
FROM prod_ventes
WHERE statut = 'inventaire';


-- ════════════════════════════════════════════════════════════════════
-- ÉTAPE 4 — Vérifier la vue prod_inventaire_couts
--            age_jours devrait maintenant être > 0
-- ════════════════════════════════════════════════════════════════════

SELECT stock_numero, marque, modele, annee, date_achat,
       age_jours, cout_achat, prix_demande
FROM prod_inventaire_couts
ORDER BY age_jours DESC NULLS LAST
LIMIT 20;
