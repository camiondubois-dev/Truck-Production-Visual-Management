-- ════════════════════════════════════════════════════════════════
-- Nettoyage : supprimer les ventes de camions importées par erreur
-- dans prod_ventes_pieces via l'alias 'dgemme' → 'xgemme'.
--
-- Problème : 'dgemme' (Dominic Gemme, vendeur camions) était mappé
-- à 'xgemme' (Xavier Gemme, pièces) dans piecesImportService.ts.
-- Résultat : des transactions > 100 000$ apparaissaient comme pièces
-- de Xavier Gemme (ex: K. JOLY CONTRACTING 340 910$,
-- FERME PHILIPPE HUBERT 195 060$).
--
-- Après ce nettoyage, réimporter le fichier pièces → les vrais
-- enregistrements de Xavier Gemme seront ré-insérés correctement,
-- et les 'dgemme' seront automatiquement exclus.
-- ════════════════════════════════════════════════════════════════

-- 1. VOIR ce qu'on va supprimer (exécuter d'abord en lecture seule)
SELECT
  document_numero,
  date_vente,
  client,
  vendeur,
  sous_total,
  source_fichier
FROM prod_ventes_pieces
WHERE vendeur = 'xgemme'
  AND sous_total > 50000   -- aucune vente de pièces ne dépasse 50 000$ normalement
ORDER BY sous_total DESC;

-- 2. SUPPRIMER les enregistrements identifiés (décommenter après vérification)
-- Les vrais montants de ventes de camions sont généralement > 50 000$.
-- Adapter le seuil si nécessaire.

/*
DELETE FROM prod_ventes_pieces
WHERE vendeur = 'xgemme'
  AND sous_total > 50000;
*/

-- 3. Vérification post-nettoyage : nombre de lignes restantes par vendeur
SELECT
  vendeur,
  COUNT(*)              AS nb_transactions,
  SUM(sous_total)       AS total,
  MAX(sous_total)       AS max_transaction
FROM prod_ventes_pieces
GROUP BY vendeur
ORDER BY total DESC;
