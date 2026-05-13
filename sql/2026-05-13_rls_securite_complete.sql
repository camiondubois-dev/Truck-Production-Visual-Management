-- ════════════════════════════════════════════════════════════════
-- RLS complet — toutes les tables
--
-- Règles appliquées :
--   • Non-connecté (public/anon)  → 0 accès, partout
--   • Connecté (email ou PIN TV)  → lecture de toutes les tables
--                                    opérationnelles
--   • role = 'gestion' seulement  → lecture + écriture des tables
--                                    financières (ventes, coûts,
--                                    profitabilité)
--   • Écriture opérationnelle     → role IN (gestion/planification/
--                                    employe) OU roles_achat non vide
--                                    OU compte TV (acheteurs PIN)
--
-- À exécuter dans l'ordre dans le SQL Editor de Supabase.
-- ════════════════════════════════════════════════════════════════


-- ── Fonctions helper ─────────────────────────────────────────────

-- Écriture module achats : staff classique OU acheteurs PIN (compte TV)
CREATE OR REPLACE FUNCTION auth_peut_ecrire_achats()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND (
        role IN ('gestion', 'planification', 'employe', 'tv')
        OR (roles_achat IS NOT NULL AND array_length(roles_achat, 1) > 0)
      )
  )
$$;

-- Écriture/lecture staff classique (pas PIN)
CREATE OR REPLACE FUNCTION auth_est_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('gestion', 'planification', 'employe')
  )
$$;

-- Lecture financière : gestion seulement
CREATE OR REPLACE FUNCTION auth_peut_lire_finance()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'gestion'
  )
$$;


-- ════════════════════════════════════════════════════════════════
-- TABLES OPÉRATIONNELLES
-- lecture : tout utilisateur authentifié
-- écriture : staff classique (gestion / planification / employe)
-- ════════════════════════════════════════════════════════════════

-- ── profiles ─────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select"       ON profiles;
DROP POLICY IF EXISTS "profiles_write"        ON profiles;
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_write" ON profiles
  FOR ALL TO authenticated
  USING  (auth_peut_lire_finance())   -- seul gestion peut modifier les profils
  WITH CHECK (auth_peut_lire_finance());

-- ── prod_inventaire ───────────────────────────────────────────────
ALTER TABLE prod_inventaire ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inventaire_select"     ON prod_inventaire;
DROP POLICY IF EXISTS "inventaire_write"      ON prod_inventaire;
CREATE POLICY "inventaire_select" ON prod_inventaire
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventaire_write" ON prod_inventaire
  FOR ALL TO authenticated
  USING  (auth_est_staff()) WITH CHECK (auth_est_staff());

-- ── prod_items ────────────────────────────────────────────────────
ALTER TABLE prod_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "items_select"          ON prod_items;
DROP POLICY IF EXISTS "items_write"           ON prod_items;
CREATE POLICY "items_select" ON prod_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "items_write" ON prod_items
  FOR ALL TO authenticated
  USING  (auth_est_staff()) WITH CHECK (auth_est_staff());

-- ── prod_moteurs ──────────────────────────────────────────────────
ALTER TABLE prod_moteurs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "moteurs_select"        ON prod_moteurs;
DROP POLICY IF EXISTS "moteurs_write"         ON prod_moteurs;
CREATE POLICY "moteurs_select" ON prod_moteurs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "moteurs_write" ON prod_moteurs
  FOR ALL TO authenticated
  USING  (auth_est_staff()) WITH CHECK (auth_est_staff());

-- ── prod_reservoirs ───────────────────────────────────────────────
ALTER TABLE prod_reservoirs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reservoirs_select"     ON prod_reservoirs;
DROP POLICY IF EXISTS "reservoirs_write"      ON prod_reservoirs;
CREATE POLICY "reservoirs_select" ON prod_reservoirs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "reservoirs_write" ON prod_reservoirs
  FOR ALL TO authenticated
  USING  (auth_est_staff()) WITH CHECK (auth_est_staff());

-- ── prod_clients ──────────────────────────────────────────────────
ALTER TABLE prod_clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clients_select"        ON prod_clients;
DROP POLICY IF EXISTS "clients_write"         ON prod_clients;
CREATE POLICY "clients_select" ON prod_clients
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "clients_write" ON prod_clients
  FOR ALL TO authenticated
  USING  (auth_est_staff()) WITH CHECK (auth_est_staff());

-- ── prod_vendeurs ─────────────────────────────────────────────────
ALTER TABLE prod_vendeurs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vendeurs_select"       ON prod_vendeurs;
DROP POLICY IF EXISTS "vendeurs_write"        ON prod_vendeurs;
CREATE POLICY "vendeurs_select" ON prod_vendeurs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "vendeurs_write" ON prod_vendeurs
  FOR ALL TO authenticated
  USING  (auth_est_staff()) WITH CHECK (auth_est_staff());

-- ── prod_conducteurs ──────────────────────────────────────────────
ALTER TABLE prod_conducteurs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "conducteurs_select"    ON prod_conducteurs;
DROP POLICY IF EXISTS "conducteurs_write"     ON prod_conducteurs;
CREATE POLICY "conducteurs_select" ON prod_conducteurs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "conducteurs_write" ON prod_conducteurs
  FOR ALL TO authenticated
  USING  (auth_peut_ecrire_achats()) WITH CHECK (auth_peut_ecrire_achats());

-- ── prod_time_logs ────────────────────────────────────────────────
ALTER TABLE prod_time_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "time_logs_select"      ON prod_time_logs;
DROP POLICY IF EXISTS "time_logs_write"       ON prod_time_logs;
CREATE POLICY "time_logs_select" ON prod_time_logs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "time_logs_write" ON prod_time_logs
  FOR ALL TO authenticated
  USING  (auth_est_staff()) WITH CHECK (auth_est_staff());

-- ── prod_imports_historique ───────────────────────────────────────
ALTER TABLE prod_imports_historique ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "imports_select"        ON prod_imports_historique;
DROP POLICY IF EXISTS "imports_write"         ON prod_imports_historique;
CREATE POLICY "imports_select" ON prod_imports_historique
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "imports_write" ON prod_imports_historique
  FOR ALL TO authenticated
  USING  (auth_est_staff()) WITH CHECK (auth_est_staff());

-- ── prod_conflits_import ──────────────────────────────────────────
ALTER TABLE prod_conflits_import ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "conflits_select"       ON prod_conflits_import;
DROP POLICY IF EXISTS "conflits_write"        ON prod_conflits_import;
CREATE POLICY "conflits_select" ON prod_conflits_import
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "conflits_write" ON prod_conflits_import
  FOR ALL TO authenticated
  USING  (auth_est_staff()) WITH CHECK (auth_est_staff());

-- ── tv_acces ──────────────────────────────────────────────────────
ALTER TABLE tv_acces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tv_acces_select"       ON tv_acces;
DROP POLICY IF EXISTS "tv_acces_write"        ON tv_acces;
CREATE POLICY "tv_acces_select" ON tv_acces
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "tv_acces_write" ON tv_acces
  FOR ALL TO authenticated
  USING  (auth_peut_lire_finance()) WITH CHECK (auth_peut_lire_finance());


-- ════════════════════════════════════════════════════════════════
-- MODULE ACHATS
-- lecture + écriture : acheteurs PIN (TV) + staff classique
-- Les politiques write du fichier fix_rls_roles_achat.sql
-- sont remplacées ici (DROP IF EXISTS protège contre les doublons).
-- ════════════════════════════════════════════════════════════════

-- ── prod_vendeurs_externes ────────────────────────────────────────
ALTER TABLE prod_vendeurs_externes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vendeurs_ext_select"   ON prod_vendeurs_externes;
DROP POLICY IF EXISTS "vendeurs_ext_write"    ON prod_vendeurs_externes;
CREATE POLICY "vendeurs_ext_select" ON prod_vendeurs_externes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "vendeurs_ext_write" ON prod_vendeurs_externes
  FOR ALL TO authenticated
  USING  (auth_peut_ecrire_achats()) WITH CHECK (auth_peut_ecrire_achats());

-- ── prod_achats ───────────────────────────────────────────────────
ALTER TABLE prod_achats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "achats_select"         ON prod_achats;
DROP POLICY IF EXISTS "achats_write"          ON prod_achats;
DROP POLICY IF EXISTS "achats_write_staff"    ON prod_achats;
CREATE POLICY "achats_select" ON prod_achats
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "achats_write" ON prod_achats
  FOR ALL TO authenticated
  USING  (auth_peut_ecrire_achats()) WITH CHECK (auth_peut_ecrire_achats());

-- ── prod_achats_photos ────────────────────────────────────────────
ALTER TABLE prod_achats_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "achats_photos_select"  ON prod_achats_photos;
DROP POLICY IF EXISTS "achats_photos_write"   ON prod_achats_photos;
CREATE POLICY "achats_photos_select" ON prod_achats_photos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "achats_photos_write" ON prod_achats_photos
  FOR ALL TO authenticated
  USING  (auth_peut_ecrire_achats()) WITH CHECK (auth_peut_ecrire_achats());

-- ── prod_achats_evaluations_initiales ─────────────────────────────
ALTER TABLE prod_achats_evaluations_initiales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "eval_init_select"      ON prod_achats_evaluations_initiales;
DROP POLICY IF EXISTS "achats_eval_init_write" ON prod_achats_evaluations_initiales;
DROP POLICY IF EXISTS "eval_init_write"       ON prod_achats_evaluations_initiales;
CREATE POLICY "eval_init_select" ON prod_achats_evaluations_initiales
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "eval_init_write" ON prod_achats_evaluations_initiales
  FOR ALL TO authenticated
  USING  (auth_peut_ecrire_achats()) WITH CHECK (auth_peut_ecrire_achats());

-- ── prod_achats_evaluations_finales ───────────────────────────────
ALTER TABLE prod_achats_evaluations_finales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "eval_fin_select"       ON prod_achats_evaluations_finales;
DROP POLICY IF EXISTS "achats_eval_fin_write" ON prod_achats_evaluations_finales;
DROP POLICY IF EXISTS "eval_finale_write"     ON prod_achats_evaluations_finales;
CREATE POLICY "eval_fin_select" ON prod_achats_evaluations_finales
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "eval_fin_write" ON prod_achats_evaluations_finales
  FOR ALL TO authenticated
  USING  (auth_peut_ecrire_achats()) WITH CHECK (auth_peut_ecrire_achats());

-- ── prod_achats_decisions ─────────────────────────────────────────
ALTER TABLE prod_achats_decisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "decisions_select"          ON prod_achats_decisions;
DROP POLICY IF EXISTS "achats_decisions_write"    ON prod_achats_decisions;
DROP POLICY IF EXISTS "decisions_insert"          ON prod_achats_decisions;
CREATE POLICY "decisions_select" ON prod_achats_decisions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "decisions_write" ON prod_achats_decisions
  FOR ALL TO authenticated
  USING  (auth_peut_ecrire_achats()) WITH CHECK (auth_peut_ecrire_achats());

-- ── prod_achats_notifications ─────────────────────────────────────
ALTER TABLE prod_achats_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifs_select"             ON prod_achats_notifications;
DROP POLICY IF EXISTS "achats_notifs_write"       ON prod_achats_notifications;
CREATE POLICY "notifs_select" ON prod_achats_notifications
  FOR SELECT TO authenticated USING (true);
-- Tout utilisateur connecté peut créer/modifier des notifications (in-app)
CREATE POLICY "notifs_write" ON prod_achats_notifications
  FOR ALL TO authenticated
  USING  (true) WITH CHECK (true);

-- ── prod_achats_towing ────────────────────────────────────────────
ALTER TABLE prod_achats_towing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "towing_select"         ON prod_achats_towing;
DROP POLICY IF EXISTS "towing_write"          ON prod_achats_towing;
CREATE POLICY "towing_select" ON prod_achats_towing
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "towing_write" ON prod_achats_towing
  FOR ALL TO authenticated
  USING  (auth_peut_ecrire_achats()) WITH CHECK (auth_peut_ecrire_achats());


-- ════════════════════════════════════════════════════════════════
-- TABLES FINANCIÈRES — lecture + écriture : gestion seulement
-- ════════════════════════════════════════════════════════════════

-- ── prod_ventes ───────────────────────────────────────────────────
ALTER TABLE prod_ventes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ventes_select"             ON prod_ventes;
DROP POLICY IF EXISTS "ventes_write"              ON prod_ventes;
CREATE POLICY "ventes_select" ON prod_ventes
  FOR SELECT TO authenticated USING (auth_peut_lire_finance());
CREATE POLICY "ventes_write" ON prod_ventes
  FOR ALL TO authenticated
  USING  (auth_peut_lire_finance()) WITH CHECK (auth_peut_lire_finance());

-- ── prod_couts_vehicule ───────────────────────────────────────────
ALTER TABLE prod_couts_vehicule ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "couts_veh_select"          ON prod_couts_vehicule;
DROP POLICY IF EXISTS "couts_veh_write"           ON prod_couts_vehicule;
CREATE POLICY "couts_veh_select" ON prod_couts_vehicule
  FOR SELECT TO authenticated USING (auth_peut_lire_finance());
CREATE POLICY "couts_veh_write" ON prod_couts_vehicule
  FOR ALL TO authenticated
  USING  (auth_peut_lire_finance()) WITH CHECK (auth_peut_lire_finance());

-- ── prod_inventaire_couts ─────────────────────────────────────────
ALTER TABLE prod_inventaire_couts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inv_couts_select"          ON prod_inventaire_couts;
DROP POLICY IF EXISTS "inv_couts_write"           ON prod_inventaire_couts;
CREATE POLICY "inv_couts_select" ON prod_inventaire_couts
  FOR SELECT TO authenticated USING (auth_peut_lire_finance());
CREATE POLICY "inv_couts_write" ON prod_inventaire_couts
  FOR ALL TO authenticated
  USING  (auth_peut_lire_finance()) WITH CHECK (auth_peut_lire_finance());

-- ── prod_plans_vente ──────────────────────────────────────────────
ALTER TABLE prod_plans_vente ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plans_vente_select"        ON prod_plans_vente;
DROP POLICY IF EXISTS "plans_vente_write"         ON prod_plans_vente;
CREATE POLICY "plans_vente_select" ON prod_plans_vente
  FOR SELECT TO authenticated USING (auth_peut_lire_finance());
CREATE POLICY "plans_vente_write" ON prod_plans_vente
  FOR ALL TO authenticated
  USING  (auth_peut_lire_finance()) WITH CHECK (auth_peut_lire_finance());

-- ── prod_plans_vente_vehicules ────────────────────────────────────
ALTER TABLE prod_plans_vente_vehicules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plans_veh_select"          ON prod_plans_vente_vehicules;
DROP POLICY IF EXISTS "plans_veh_write"           ON prod_plans_vente_vehicules;
CREATE POLICY "plans_veh_select" ON prod_plans_vente_vehicules
  FOR SELECT TO authenticated USING (auth_peut_lire_finance());
CREATE POLICY "plans_veh_write" ON prod_plans_vente_vehicules
  FOR ALL TO authenticated
  USING  (auth_peut_lire_finance()) WITH CHECK (auth_peut_lire_finance());

-- ── prod_rapport_profitabilite ────────────────────────────────────
ALTER TABLE prod_rapport_profitabilite ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rapport_prof_select"       ON prod_rapport_profitabilite;
DROP POLICY IF EXISTS "rapport_prof_write"        ON prod_rapport_profitabilite;
CREATE POLICY "rapport_prof_select" ON prod_rapport_profitabilite
  FOR SELECT TO authenticated USING (auth_peut_lire_finance());
CREATE POLICY "rapport_prof_write" ON prod_rapport_profitabilite
  FOR ALL TO authenticated
  USING  (auth_peut_lire_finance()) WITH CHECK (auth_peut_lire_finance());
