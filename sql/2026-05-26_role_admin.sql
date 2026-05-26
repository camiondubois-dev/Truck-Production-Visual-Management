-- ════════════════════════════════════════════════════════════════════
-- Nouveau rôle : 'admin' (super-admin, au-dessus de gestion)
-- Date : 2026-05-26
--
-- Hiérarchie :
--   admin         > gestion (peut tout faire + gérer les utilisateurs)
--   gestion       > vendeur (accès complet aux données financières)
--   vendeur       > planification (peut entrer ventes, voir prix/coûts)
--   planification > employe
--   employe       > tv
--
-- L'admin a TOUS les droits du gestion + en plus :
--   - Changer le rôle des autres utilisateurs
--   - Voir et gérer les profils
--   - (futur) Paramètres système globaux
-- ════════════════════════════════════════════════════════════════════

-- Mettre à jour la contrainte CHECK sur profiles.role
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'gestion', 'planification', 'vendeur', 'employe', 'tv'));

-- Vérification : répartition actuelle des rôles
SELECT role, COUNT(*) AS nb FROM profiles GROUP BY role ORDER BY role;

-- ─── À FAIRE MANUELLEMENT ───────────────────────────────────────────
-- Pour passer un compte au rôle 'admin', exécute :
--
--   UPDATE profiles SET role = 'admin' WHERE email = 'ton.email@...';
--
-- Remplace par ton vraie email.
-- ─────────────────────────────────────────────────────────────────────
