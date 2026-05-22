-- ════════════════════════════════════════════════════════════════════
-- Marquer tous les vendus du rapport profitabilité comme PAYÉS
-- Date : 2026-05-22
--
-- Règle métier : tout camion qui apparaît dans prod_rapport_profitabilite
-- a été vendu pour de bon (la vente est dans le rapport officiel) →
-- on assume qu'il est PAYÉ par défaut. Les exceptions seront marquées
-- manuellement dans l'UI 'Suivi des paiements'.
-- ════════════════════════════════════════════════════════════════════

-- 1. Vérification AVANT
SELECT
  pv.statut_paiement,
  COUNT(*) AS nb,
  SUM(pv.prix_vente)    AS total_prix,
  SUM(pv.montant_recu)  AS total_recu
FROM prod_ventes pv
WHERE pv.statut = 'vendu'
GROUP BY pv.statut_paiement
ORDER BY pv.statut_paiement;

-- 2. Marquer comme PAYÉ tous les vendus présents dans le rapport profitabilité
UPDATE prod_ventes pv
SET
  statut_paiement       = 'paye',
  montant_recu          = COALESCE(pv.prix_vente, 0),
  date_paiement_complet = COALESCE(
    -- 1er choix : la date de vente du rapport profitabilité
    (SELECT date_vente FROM prod_rapport_profitabilite rp
       WHERE rp.stock_numero = pv.stock_numero LIMIT 1),
    -- 2e choix : updated_at de prod_inventaire
    (SELECT updated_at::date FROM prod_inventaire pi
       WHERE pi.numero = pv.stock_numero LIMIT 1),
    -- 3e choix : aujourd'hui
    CURRENT_DATE
  )
WHERE pv.statut = 'vendu'
  AND pv.stock_numero IN (
    SELECT stock_numero FROM prod_rapport_profitabilite
  );

-- 3. Vérification APRÈS — résumé par statut
SELECT
  pv.statut_paiement,
  COUNT(*) AS nb,
  SUM(pv.prix_vente)             AS total_prix,
  SUM(pv.montant_recu)           AS total_recu,
  SUM(COALESCE(pv.prix_vente, 0) - COALESCE(pv.montant_recu, 0)) AS reste_a_recevoir
FROM prod_ventes pv
WHERE pv.statut = 'vendu'
GROUP BY pv.statut_paiement
ORDER BY pv.statut_paiement;

-- 4. Si tu veux voir la liste des vendus qui restent NON PAYÉS (pour vérifier)
-- Ces lignes vont rester en 'non-paye' / 'depot' / 'po' / 'partiel' jusqu'à ce
-- que tu les ajustes manuellement dans l'UI.
SELECT
  stock_numero, marque, modele, annee, prix_vente, statut_paiement, montant_recu,
  (COALESCE(prix_vente, 0) - COALESCE(montant_recu, 0)) AS solde
FROM prod_ventes
WHERE statut = 'vendu' AND statut_paiement != 'paye'
ORDER BY stock_numero;
