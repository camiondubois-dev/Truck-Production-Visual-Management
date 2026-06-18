-- ════════════════════════════════════════════════════════════════
-- Migration : anciens documents PDF (prod_items.documents, base64)
--            → prod_inventaire.documents (source UNIQUE)
--
-- Contexte : avant, certains écrans (suivi vente, livraison, plancher,
-- département, terrain) stockaient/affichaient les PDF sur prod_items en
-- base64. L'app lit désormais TOUT depuis prod_inventaire.documents.
-- Ce script déplace les anciens documents pour qu'ils réapparaissent
-- partout et soient éditables.
--
-- Stratégie :
--   • Pour chaque prod_items.documents non vide, on fusionne ses docs
--     dans prod_inventaire.documents du véhicule lié (inventaire_id),
--     SANS écraser ceux déjà présents (dédup par id).
--   • Les anciens docs gardent leur champ base64 → l'éditeur sait les lire.
--   • Idempotent : relançable sans créer de doublons (dédup par id).
--
-- ⚠️  Faire un backup / exécuter d'abord le SELECT de contrôle.
-- ════════════════════════════════════════════════════════════════

-- ── 1. CONTRÔLE (lecture seule) — voir ce qui sera migré ──
-- Décommente pour inspecter avant d'exécuter la migration :
--
-- SELECT i.numero,
--        jsonb_array_length(COALESCE(it.documents, '[]'::jsonb)) AS docs_items,
--        jsonb_array_length(COALESCE(i.documents,  '[]'::jsonb)) AS docs_inventaire
-- FROM prod_items it
-- JOIN prod_inventaire i ON i.id = it.inventaire_id
-- WHERE COALESCE(it.documents, '[]'::jsonb) <> '[]'::jsonb
-- ORDER BY i.numero;

-- ── 2. MIGRATION ──
WITH items_docs AS (
  -- Un document par ligne, avec le véhicule cible
  SELECT it.inventaire_id,
         d AS doc,
         (d->>'id') AS doc_id
  FROM prod_items it
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(it.documents, '[]'::jsonb)) AS d
  WHERE it.inventaire_id IS NOT NULL
),
a_ajouter AS (
  -- Garde seulement les docs PAS déjà présents dans prod_inventaire (dédup par id)
  SELECT id.inventaire_id,
         jsonb_agg(id.doc) AS nouveaux
  FROM items_docs id
  JOIN prod_inventaire inv ON inv.id = id.inventaire_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(inv.documents, '[]'::jsonb)) AS existant
    WHERE existant->>'id' = id.doc_id
  )
  GROUP BY id.inventaire_id
)
UPDATE prod_inventaire inv
SET documents = COALESCE(inv.documents, '[]'::jsonb) || a.nouveaux,
    updated_at = now()
FROM a_ajouter a
WHERE inv.id = a.inventaire_id;

-- ── 3. (Optionnel) Vider les documents migrés de prod_items ──
-- À n'exécuter qu'APRÈS avoir vérifié que tout s'affiche bien dans l'app.
-- Décommente pour nettoyer l'ancien emplacement :
--
-- UPDATE prod_items SET documents = '[]'::jsonb, updated_at = now()
-- WHERE COALESCE(documents, '[]'::jsonb) <> '[]'::jsonb
--   AND inventaire_id IS NOT NULL;
