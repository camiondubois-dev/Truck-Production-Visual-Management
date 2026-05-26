-- ════════════════════════════════════════════════════════════════
-- Fix 1 : RLS profiles — autoriser admin ET gestion à écrire
-- Fix 2 : Trigger auto-création de profil à l'inscription
--
-- Problème : la policy "profiles_write" utilisait auth_peut_lire_finance()
-- qui ne vérifie que role = 'gestion'.  Depuis l'ajout du rôle 'admin'
-- (2026-05-26_role_admin.sql), l'admin ne pouvait plus modifier
-- les profils (rôles, onglets_import, actif…).
-- ════════════════════════════════════════════════════════════════


-- ── 1. Nouvelle fonction helper : admin OU gestion ───────────────
CREATE OR REPLACE FUNCTION auth_est_admin_ou_gestion()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'gestion')
  )
$$;


-- ── 2. Mettre à jour auth_peut_lire_finance pour inclure admin ───
--    (utilisée aussi pour les tables financières : ventes, coûts…)
CREATE OR REPLACE FUNCTION auth_peut_lire_finance()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'gestion')
  )
$$;


-- ── 3. Recréer la policy profiles_write avec la nouvelle fonction ─
DROP POLICY IF EXISTS "profiles_write" ON profiles;
CREATE POLICY "profiles_write" ON profiles
  FOR ALL TO authenticated
  USING  (auth_est_admin_ou_gestion())
  WITH CHECK (auth_est_admin_ou_gestion());


-- ── 4. Trigger : créer le profil automatiquement à l'inscription ──
--    Quand Supabase Auth crée un utilisateur (dashboard ou invite),
--    ce trigger insère une ligne dans profiles avec role='employe'
--    par défaut.  L'admin change ensuite le rôle via VueUtilisateurs.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nom, role, actif)
  VALUES (
    NEW.id,
    NEW.email,
    -- Essaie de récupérer le display_name si fourni (invite avec metadata)
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
    'employe',   -- rôle par défaut → à changer dans VueUtilisateurs
    true
  )
  ON CONFLICT (id) DO NOTHING;  -- idempotent si le profil existe déjà
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Supprimer l'ancien trigger s'il existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Créer le trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ── 5. Vérification ──────────────────────────────────────────────
-- Affiche les utilisateurs Auth sans profil correspondant
-- (à exécuter après pour détecter les comptes orphelins)
SELECT
  u.id,
  u.email,
  u.created_at,
  p.id AS profil_id
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ORDER BY u.created_at DESC;
