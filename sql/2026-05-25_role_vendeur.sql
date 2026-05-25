-- ════════════════════════════════════════════════════════════════════
-- Nouveau rôle : 'vendeur'
-- Date : 2026-05-25
--
-- Permissions vendeur :
--   ✅ Entrer prix de vente sur camions
--   ✅ Voir prix + coûts par camion
--   ✅ Voir SA marge par camion
--   ✅ Créer/modifier des Plans de vente
--   ❌ Voir totaux marge entreprise (Profitabilité, Bilan hebdo)
--   ❌ Voir Analyse / Activité / Import / TV admin
-- ════════════════════════════════════════════════════════════════════

-- 1. Mettre à jour la contrainte CHECK sur profiles.role
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('gestion', 'planification', 'vendeur', 'employe', 'tv'));

-- 2. Vérification — répartition actuelle des rôles
SELECT role, COUNT(*) AS nb FROM profiles GROUP BY role ORDER BY role;

-- ─── À FAIRE MANUELLEMENT après ce script ───────────────────────────
-- Pour passer David Meunier et Dani Jim au rôle 'vendeur', exécute :
--
--   UPDATE profiles SET role = 'vendeur' WHERE email = 'david@...';
--   UPDATE profiles SET role = 'vendeur' WHERE email = 'dani@...';
--
-- Remplace 'david@...' et 'dani@...' par leurs vraies adresses email.
-- ─────────────────────────────────────────────────────────────────────
