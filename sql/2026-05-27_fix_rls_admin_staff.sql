-- ════════════════════════════════════════════════════════════════
-- Fix RLS : inclure 'admin' dans auth_est_staff()
--
-- Problème : auth_est_staff() vérifie role IN ('gestion','planification','employe')
-- Le rôle 'admin' (ajouté le 2026-05-26) n'était pas inclus.
-- Résultat : les admins ne pouvaient pas faire d'INSERT/UPDATE/DELETE
-- sur les tables opérationnelles (prod_reservoirs, prod_inventaire, etc.)
-- ════════════════════════════════════════════════════════════════

-- Mettre à jour auth_est_staff() pour inclure 'admin'
CREATE OR REPLACE FUNCTION auth_est_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'gestion', 'planification', 'employe')
  )
$$;

-- Vérification : affiche le résultat pour l'utilisateur courant
-- (optionnel, à commenter si pas nécessaire)
SELECT auth_est_staff() AS peut_ecrire_tables_operationnelles;
