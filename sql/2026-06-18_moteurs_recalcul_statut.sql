-- ════════════════════════════════════════════════════════════════
-- Module Moteurs — Recalcul du statut depuis l'état réel des étapes
--
-- Corrige les moteurs « collés » en cours (ex. après avoir annulé/effacé
-- l'étape active, le statut restait 'en-cours'). Même logique que le code :
--   aucune étape          → en-attente
--   toutes finies/sautées → pret
--   une étape en-cours    → en-cours
--   au moins une terminée → en-cours (commencé)
--   sinon (tout planifié) → en-attente
-- ════════════════════════════════════════════════════════════════

UPDATE prod_moteurs SET statut = CASE
  WHEN COALESCE(road_map, '[]'::jsonb) = '[]'::jsonb THEN 'en-attente'
  WHEN NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(road_map) e
    WHERE e->>'statut' NOT IN ('termine','saute')
  ) THEN 'pret'
  WHEN EXISTS (
    SELECT 1 FROM jsonb_array_elements(road_map) e
    WHERE e->>'statut' = 'en-cours'
  ) THEN 'en-cours'
  WHEN EXISTS (
    SELECT 1 FROM jsonb_array_elements(road_map) e
    WHERE e->>'statut' = 'termine'
  ) THEN 'en-cours'
  ELSE 'en-attente'
END,
updated_at = now()
WHERE statut <> 'archive';
