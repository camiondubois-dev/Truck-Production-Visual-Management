-- ════════════════════════════════════════════════════════════════
-- Module Activité — présence temps réel + historique de navigation
-- ════════════════════════════════════════════════════════════════

-- Présence : état actuel de chaque utilisateur (upsert toutes les 30s)
CREATE TABLE IF NOT EXISTS prod_presence (
  utilisateur_nom  TEXT PRIMARY KEY,
  utilisateur_role TEXT,
  page_id          TEXT,
  page_label       TEXT,
  app              TEXT DEFAULT 'desktop',
  updated_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE prod_presence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "presence_select" ON prod_presence;
DROP POLICY IF EXISTS "presence_write"  ON prod_presence;
CREATE POLICY "presence_select" ON prod_presence FOR SELECT TO authenticated USING (true);
CREATE POLICY "presence_write"  ON prod_presence FOR ALL    TO authenticated USING (true) WITH CHECK (true);

-- Historique : insert à chaque changement de page
CREATE TABLE IF NOT EXISTS prod_activite_log (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  utilisateur_nom  TEXT NOT NULL,
  utilisateur_role TEXT,
  page_id          TEXT,
  page_label       TEXT,
  app              TEXT DEFAULT 'desktop',
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE prod_activite_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "activite_select" ON prod_activite_log;
DROP POLICY IF EXISTS "activite_write"  ON prod_activite_log;
CREATE POLICY "activite_select" ON prod_activite_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "activite_write"  ON prod_activite_log FOR INSERT TO authenticated WITH CHECK (true);

-- Index performance
CREATE INDEX IF NOT EXISTS idx_activite_log_created_at  ON prod_activite_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activite_log_utilisateur ON prod_activite_log (utilisateur_nom);
CREATE INDEX IF NOT EXISTS idx_activite_log_page        ON prod_activite_log (page_id);
