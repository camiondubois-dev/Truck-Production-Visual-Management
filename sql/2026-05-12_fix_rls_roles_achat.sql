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

-- ── prod_achats (politique originale = "achats_write_staff") ─────
DROP POLICY IF EXISTS "achats_write_staff" ON prod_achats;
DROP POLICY IF EXISTS "achats_write"       ON prod_achats;
CREATE POLICY "achats_write" ON prod_achats
  FOR ALL TO authenticated
  USING  (auth_peut_ecrire_achats())
  WITH CHECK (auth_peut_ecrire_achats());

-- ── prod_achats_photos (politique originale = "achats_photos_write")
DROP POLICY IF EXISTS "achats_photos_write" ON prod_achats_photos;
CREATE POLICY "achats_photos_write" ON prod_achats_photos
  FOR ALL TO authenticated
  USING  (auth_peut_ecrire_achats())
  WITH CHECK (auth_peut_ecrire_achats());

-- ── prod_achats_decisions (politique originale = "decisions_insert")
DROP POLICY IF EXISTS "decisions_insert"       ON prod_achats_decisions;
DROP POLICY IF EXISTS "achats_decisions_write" ON prod_achats_decisions;
CREATE POLICY "achats_decisions_write" ON prod_achats_decisions
  FOR ALL TO authenticated
  USING  (auth_peut_ecrire_achats())
  WITH CHECK (auth_peut_ecrire_achats());

-- ── prod_achats_evaluations_initiales (originale = "eval_init_write")
DROP POLICY IF EXISTS "eval_init_write"       ON prod_achats_evaluations_initiales;
DROP POLICY IF EXISTS "achats_eval_init_write" ON prod_achats_evaluations_initiales;
CREATE POLICY "achats_eval_init_write" ON prod_achats_evaluations_initiales
  FOR ALL TO authenticated
  USING  (auth_peut_ecrire_achats())
  WITH CHECK (auth_peut_ecrire_achats());

-- ── prod_achats_evaluations_finales (originale = "eval_finale_write")
DROP POLICY IF EXISTS "eval_finale_write"     ON prod_achats_evaluations_finales;
DROP POLICY IF EXISTS "achats_eval_fin_write" ON prod_achats_evaluations_finales;
CREATE POLICY "achats_eval_fin_write" ON prod_achats_evaluations_finales
  FOR ALL TO authenticated
  USING  (auth_peut_ecrire_achats())
  WITH CHECK (auth_peut_ecrire_achats());

-- ── prod_achats_notifications (déjà permissive, on garde)
-- INSERT est déjà WITH CHECK (true) dans le SQL original.
-- On s'assure juste que UPDATE reste accessible.
DROP POLICY IF EXISTS "achats_notifs_write" ON prod_achats_notifications;
CREATE POLICY "achats_notifs_write" ON prod_achats_notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ── prod_conducteurs (pour compléter) ────────────────────────────
DROP POLICY IF EXISTS "conducteurs_write" ON prod_conducteurs;
CREATE POLICY "conducteurs_write" ON prod_conducteurs
  FOR ALL TO authenticated
  USING  (auth_peut_ecrire_achats())
  WITH CHECK (auth_peut_ecrire_achats());
