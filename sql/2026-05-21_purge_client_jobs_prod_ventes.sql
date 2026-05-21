-- ═══════════════════════════════════════════════════════════════════════════
-- 2026-05-21 — Purge des jobs client qui ont fui dans prod_ventes
-- ───────────────────────────────────────────────────────────────────────────
-- Cause : le sync prod_inventaire → prod_ventes ne filtrait pas type='client'
-- Fix code : ajouter() et importerPlusieurs() excluent désormais type='client'
-- Ce script nettoie les lignes déjà en base.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. APERÇU : voir ce qui sera supprimé avant de lancer le DELETE
SELECT
  pv.stock_numero,
  pv.vehicule,
  pv.source,
  pv.statut,
  pi.type AS type_inventaire,
  pi.nom_client,
  pi.description_travail
FROM prod_ventes pv
JOIN prod_inventaire pi ON pi.numero = pv.stock_numero
WHERE pi.type = 'client'
  AND pv.statut = 'inventaire'
ORDER BY pv.stock_numero;


-- 2. SUPPRESSION des jobs client dans prod_ventes (statut inventaire seulement)
--    Les jobs déjà "vendus" via le wizard ventes HITRAC ne sont pas touchés.
DELETE FROM prod_ventes
WHERE stock_numero IN (
  SELECT numero FROM prod_inventaire WHERE type = 'client'
)
AND statut = 'inventaire';


-- 3. Vérification post-suppression : doit retourner 0 ligne
SELECT COUNT(*) AS restants
FROM prod_ventes pv
JOIN prod_inventaire pi ON pi.numero = pv.stock_numero
WHERE pi.type = 'client'
  AND pv.statut = 'inventaire';
