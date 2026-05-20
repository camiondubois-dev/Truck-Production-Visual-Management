-- ════════════════════════════════════════════════════════════════════
-- Fix : entrées "WO 1-XXXX" dans prod_ventes statut=inventaire
-- Date : 2026-05-20
--
-- PROBLÈME : des numéros de work order (WO 1-XXXX) sont apparus dans
-- prod_ventes avec statut='inventaire', ce qui les affiche dans la vue
-- Inventaire & Projections alors qu'ils ne sont pas de vrais camions.
--
-- EXÉCUTER ÉTAPE PAR ÉTAPE — lire les résultats avant de continuer
-- ════════════════════════════════════════════════════════════════════


-- ═══ ÉTAPE 1 — Diagnostique : voir toutes les entrées WO ═══════════

SELECT
  v.stock_numero,
  v.statut,
  v.source,
  v.marque,
  v.modele,
  v.annee,
  v.prix_achat_reel,
  v.cout_mo,
  v.date_achat,
  v.updated_at,
  -- Est-ce qu'il existe un vrai camion dans prod_inventaire avec ce numéro ?
  CASE WHEN i.numero IS NOT NULL THEN 'OUI' ELSE 'non' END AS existe_dans_inventaire
FROM prod_ventes v
LEFT JOIN prod_inventaire i ON i.numero = v.stock_numero
WHERE v.statut = 'inventaire'
  AND (
    v.stock_numero ~* '^WO'          -- commence par WO
    OR v.stock_numero ~* '^WO\s*\d'  -- WO suivi de chiffres
    OR v.stock_numero !~ '^\d'        -- ne commence PAS par un chiffre (= pas un vrai stock #)
  )
ORDER BY v.updated_at DESC;


-- ═══ ÉTAPE 2 — Voir le backup de l'import qui a créé ces entrées ════
-- (pour comprendre d'où ils viennent)

SELECT
  il.id            AS import_id,
  il.created_at,
  il.type_import,
  il.filename,
  il.user_nom,
  il.status,
  vb.stock_numero,
  vb.prix_achat_reel AS prix_avant,
  vb.cout_mo         AS mo_avant
FROM prod_imports_log il
JOIN prod_ventes_backup vb ON vb.import_id = il.id
WHERE vb.stock_numero ~* '^WO'
   OR vb.stock_numero !~ '^\d'
ORDER BY il.created_at DESC
LIMIT 50;


-- ═══ ÉTAPE 3 — SUPPRESSION des entrées WO (exécuter après avoir
--               vérifié l'étape 1 que ces lignes sont bien des WO) ════

-- !! VÉRIFIER L'ÉTAPE 1 D'ABORD avant de supprimer !!

DELETE FROM prod_ventes
WHERE statut = 'inventaire'
  AND (
    stock_numero ~* '^WO'
    OR stock_numero !~ '^\d'
  )
  -- Sécurité : ne pas supprimer si un vrai camion existe dans prod_inventaire
  AND stock_numero NOT IN (
    SELECT numero FROM prod_inventaire WHERE statut <> 'archive'
  );

-- Voir combien ont été supprimés
-- (PostgreSQL retourne le count après DELETE)


-- ═══ ÉTAPE 4 — Vérification finale ════════════════════════════════

SELECT
  statut,
  COUNT(*) AS nb,
  COUNT(*) FILTER (WHERE stock_numero !~ '^\d') AS nb_non_numeriques
FROM prod_ventes
GROUP BY statut;

SELECT 'Nettoyage terminé.' AS info;
