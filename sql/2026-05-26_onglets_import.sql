-- ════════════════════════════════════════════════════════════════
-- Ajout de onglets_import dans profiles
-- Contrôle quels onglets d'import chaque utilisateur peut voir.
--
-- NULL          → tous les onglets (comportement admin/gestion actuel)
-- 'agendrix'    → seulement l'onglet Agendrix (ex : Véro)
-- 'itrack'      → seulement iTrack
-- 'itrack,pieces,hitrac' → plusieurs onglets spécifiques (sans agendrix)
-- ════════════════════════════════════════════════════════════════

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onglets_import TEXT DEFAULT NULL;

-- Exemples de configuration :
-- UPDATE profiles SET onglets_import = 'agendrix'
--   WHERE email = 'vero@camiondubois.com';
--
-- UPDATE profiles SET onglets_import = 'itrack,pieces,hitrac'
--   WHERE email = 'christina@camiondubois.com';
--
-- NULL = accès complet (laisser tel quel pour admin/gestion)
