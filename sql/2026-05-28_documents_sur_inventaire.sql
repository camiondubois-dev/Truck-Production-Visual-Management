-- ════════════════════════════════════════════════════════════════
-- Documents PDF : déplacer de prod_items (base64 JSON) →
-- prod_inventaire (URLs Supabase Storage)
--
-- Problème avant :
--   • La section Documents n'apparaissait que si le camion
--     avait un prod_item ACTIF (ex: camions vendus = invisible)
--   • Les PDFs étaient stockés en base64 dans le JSON →
--     échec silencieux dès ~800 KB (limite API Supabase ~1 MB)
--
-- Fix :
--   • Les documents sont maintenant attachés au véhicule (prod_inventaire)
--   • Les fichiers sont uploadés dans Supabase Storage (bucket camions-photos)
--   • Pas de limite de taille côté API
-- ════════════════════════════════════════════════════════════════

ALTER TABLE prod_inventaire
  ADD COLUMN IF NOT EXISTS documents JSONB NOT NULL DEFAULT '[]';

-- Index GIN optionnel pour requêtes sur documents (facultatif)
-- CREATE INDEX IF NOT EXISTS idx_inventaire_documents ON prod_inventaire USING gin(documents);
