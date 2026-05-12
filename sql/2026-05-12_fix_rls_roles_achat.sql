-- ════════════════════════════════════════════════════════════════
-- Fix RLS : permettre aux utilisateurs avec roles_achat d'écrire
-- dans toutes les tables du module achats.
--
-- Problème : les anciennes politiques vérifient uniquement profiles.role
-- IN ('gestion','planification','employe'), mais les acheteurs mobiles
-- n'ont que des entrées dans profiles.roles_achat (ex: 'acheteur-principal').
-- ════════════════════════════════════════════════════════════════

-- Helper : vrai si l'utilisateur connecté a un rôle achat OU un rôle admin
CREATE OR REPLACE FUNCTION auth_peut_ecrire_achats()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND (
        profiles.role IN ('gestion', 'planification', 'employe')
        OR array_length(profiles.roles_achat, 1) > 0
      )
  )
$$;

-- ── prod_vendeurs_externes ────────────────────────────────────────
DROP POLICY IF EXISTS "vendeurs_ext_write" ON prod_vendeurs_externes;
CREATE POLICY "vendeurs_ext_write" ON prod_vendeurs_externes
  FOR ALL TO authenticated
  USING  (auth_peut_ecrire_achats())
  WITH CHECK (auth_peut_ecrire_achats());

-- ── prod_achats ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "achats_write" ON prod_achats;
CREATE POLICY "achats_write" ON prod_achats
  FOR ALL TO authenticated
  USING  (auth_peut_ecrire_achats())
  WITH CHECK (auth_peut_ecrire_achats());

-- ── prod_achats_photos ────────────────────────────────────────────
DROP POLICY IF EXISTS "achats_photos_write" ON prod_achats_photos;
CREATE POLICY "achats_photos_write" ON prod_achats_photos
  FOR ALL TO authenticated
  USING  (auth_peut_ecrire_achats())
  WITH CHECK (auth_peut_ecrire_achats());

-- ── prod_achats_approbations ──────────────────────────────────────
DROP POLICY IF EXISTS "achats_appro_write" ON prod_achats_approbations;
CREATE POLICY "achats_appro_write" ON prod_achats_approbations
  FOR ALL TO authenticated
  USING  (auth_peut_ecrire_achats())
  WITH CHECK (auth_peut_ecrire_achats());

-- ── prod_achats_notifications ─────────────────────────────────────
DROP POLICY IF EXISTS "achats_notifs_write" ON prod_achats_notifications;
CREATE POLICY "achats_notifs_write" ON prod_achats_notifications
  FOR ALL TO authenticated
  USING  (auth_peut_ecrire_achats())
  WITH CHECK (auth_peut_ecrire_achats());
