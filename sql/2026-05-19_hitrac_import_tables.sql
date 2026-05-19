-- ════════════════════════════════════════════════════════════════════
-- Tables pour l'import HITRAC : journal + sauvegarde restaurable
-- Date : 2026-05-19
--
-- Permet à l'app d'exécuter un import HITRAC avec :
--   1. Backup automatique des lignes avant modification
--   2. Journal des imports (qui, quand, combien)
--   3. Restauration 1-clic depuis le backup (admin seulement)
-- ════════════════════════════════════════════════════════════════════

-- ── Journal des imports ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prod_imports_log (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  user_email           text,
  user_nom             text,
  type_import          text NOT NULL,            -- 'hitrac_couts' | 'hitrac_ventes' | autre
  filename             text,
  nb_camions_analyses  int  NOT NULL DEFAULT 0,
  nb_achats_modifies   int  NOT NULL DEFAULT 0,
  nb_mo_modifies       int  NOT NULL DEFAULT 0,
  nb_achats_proteges   int  NOT NULL DEFAULT 0,  -- DB déjà rempli, on a gardé
  status               text NOT NULL DEFAULT 'completed', -- 'completed' | 'restored'
  restored_at          timestamptz,
  restored_by          text,
  notes                text
);

CREATE INDEX IF NOT EXISTS idx_imports_log_created ON prod_imports_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_imports_log_status  ON prod_imports_log(status);


-- ── Backup des lignes modifiées ─────────────────────────────────────
-- Snapshot AVANT modification, pour restauration possible
CREATE TABLE IF NOT EXISTS prod_ventes_backup (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id           uuid NOT NULL REFERENCES prod_imports_log(id) ON DELETE CASCADE,
  stock_numero        text NOT NULL,
  -- Snapshot complet des champs financiers AVANT l'UPDATE
  prix_achat_reel     decimal(12,2),
  cout_mo             decimal(12,2),
  prix_demande        decimal(12,2),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_backup_import ON prod_ventes_backup(import_id);
CREATE INDEX IF NOT EXISTS idx_backup_stock  ON prod_ventes_backup(stock_numero);


-- ── RLS (Row Level Security) ────────────────────────────────────────
-- Lecture : tous les utilisateurs authentifiés
-- Écriture : gestion seulement (l'app vérifie en plus côté front)
ALTER TABLE prod_imports_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE prod_ventes_backup   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tout le monde peut lire les imports" ON prod_imports_log;
CREATE POLICY "Tout le monde peut lire les imports"
  ON prod_imports_log FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "Authentifiés peuvent insérer un import" ON prod_imports_log;
CREATE POLICY "Authentifiés peuvent insérer un import"
  ON prod_imports_log FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authentifiés peuvent mettre à jour un import" ON prod_imports_log;
CREATE POLICY "Authentifiés peuvent mettre à jour un import"
  ON prod_imports_log FOR UPDATE
  TO authenticated USING (true);

DROP POLICY IF EXISTS "Tout le monde peut lire les backups" ON prod_ventes_backup;
CREATE POLICY "Tout le monde peut lire les backups"
  ON prod_ventes_backup FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "Authentifiés peuvent insérer un backup" ON prod_ventes_backup;
CREATE POLICY "Authentifiés peuvent insérer un backup"
  ON prod_ventes_backup FOR INSERT
  TO authenticated WITH CHECK (true);


-- Vérification rapide
SELECT 'prod_imports_log'   AS table_name, COUNT(*) FROM prod_imports_log
UNION ALL
SELECT 'prod_ventes_backup' AS table_name, COUNT(*) FROM prod_ventes_backup;
