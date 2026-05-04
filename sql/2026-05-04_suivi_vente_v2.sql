-- ════════════════════════════════════════════════════════════════════
-- Suivi Vente v2 : ASAP, lavage, retouche, paiement
-- ════════════════════════════════════════════════════════════════════
-- Date : 2026-05-04
-- À rouler dans Supabase SQL Editor

-- ── Nouvelles colonnes sur prod_inventaire ────────────────────────

-- Lavage & retouche finale (3 états)
ALTER TABLE prod_inventaire
  ADD COLUMN IF NOT EXISTS lavage_etat   text NOT NULL DEFAULT 'a-faire'
    CHECK (lavage_etat   IN ('pas-requis', 'a-faire', 'fait')),
  ADD COLUMN IF NOT EXISTS retouche_etat text NOT NULL DEFAULT 'a-faire'
    CHECK (retouche_etat IN ('pas-requis', 'a-faire', 'fait'));

-- Livraison dès que possible (priorité 1)
ALTER TABLE prod_inventaire
  ADD COLUMN IF NOT EXISTS livraison_asap boolean NOT NULL DEFAULT false;

-- État paiement (3 booléens indépendants — multi-sélection possible)
ALTER TABLE prod_inventaire
  ADD COLUMN IF NOT EXISTS paiement_depot   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paiement_complet boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paiement_po      boolean NOT NULL DEFAULT false;

-- ── Index pour le tri ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_inventaire_asap ON prod_inventaire (livraison_asap)
  WHERE livraison_asap = true;

-- ── Vérification ──────────────────────────────────────────────────
SELECT
  column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'prod_inventaire'
  AND column_name IN ('lavage_etat', 'retouche_etat', 'livraison_asap', 'paiement_depot', 'paiement_complet', 'paiement_po')
ORDER BY column_name;
