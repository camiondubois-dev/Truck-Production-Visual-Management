-- ════════════════════════════════════════════════════════════════
-- prod_agendrix_heures — Heures pointées Agendrix par employé/jour
-- Import hebdomadaire : lundi→dimanche (rapport "Entrées de temps")
--
-- Liens :
--   employe_id       → prod_employes.id  (via no_employe_acomba)
--   no_employe_acomba = clé Acomba (ex: '82-1558', '1387')
--
-- Types d'entrée :
--   quart            — heures travaillées normales
--   conge_paye       — férié / vacances payées / maladie payée
--   conge_non_paye   — absentéisme (absence sans solde, maladie non payée, CNESST, vacances non payées)
--   banque_heures    — heures accumulées utilisées
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS prod_agendrix_heures (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Lien employé (NULL si no_employe_acomba inconnu dans prod_employes)
  employe_id        UUID REFERENCES prod_employes(id) ON DELETE SET NULL,
  no_employe_acomba TEXT NOT NULL DEFAULT '',   -- clé de recherche (même si employe_id null)

  -- Identité Agendrix (telle que dans le fichier)
  prenom            TEXT,
  nom_agendrix      TEXT,

  -- Période
  semaine_debut     DATE NOT NULL,              -- premier jour du fichier (ex: 2026-05-17)
  date_entree       DATE NOT NULL,

  -- Type d'heure
  type              TEXT NOT NULL CHECK (type IN (
    'quart', 'conge_paye', 'conge_non_paye', 'banque_heures'
  )),
  type_conge        TEXT CHECK (type_conge IN (
    'ferie', 'vacances', 'maladie', 'absence_solde', 'cnesst', 'temps_accumule'
  ) OR type_conge IS NULL),

  heures            NUMERIC(5,2) NOT NULL DEFAULT 0,
  succursale        TEXT,
  position_employe  TEXT,

  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Index analytiques
CREATE INDEX IF NOT EXISTS idx_agendrix_semaine      ON prod_agendrix_heures(semaine_debut);
CREATE INDEX IF NOT EXISTS idx_agendrix_employe_id   ON prod_agendrix_heures(employe_id);
CREATE INDEX IF NOT EXISTS idx_agendrix_no_acomba    ON prod_agendrix_heures(no_employe_acomba);
CREATE INDEX IF NOT EXISTS idx_agendrix_type         ON prod_agendrix_heures(type);

-- RLS : accès authentifié uniquement
ALTER TABLE prod_agendrix_heures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agendrix_auth_all" ON prod_agendrix_heures;
CREATE POLICY "agendrix_auth_all" ON prod_agendrix_heures
  FOR ALL TO authenticated USING (true);

-- ── Vue agrégée utile pour les analytics ──────────────────────────
-- Somme des heures par employé × semaine × type
CREATE OR REPLACE VIEW prod_agendrix_resume AS
SELECT
  semaine_debut,
  no_employe_acomba,
  employe_id,
  prenom,
  nom_agendrix,
  -- Heures travaillées normales
  SUM(heures) FILTER (WHERE type = 'quart')                                         AS h_quart,
  -- Congés payés (par sous-type)
  SUM(heures) FILTER (WHERE type = 'conge_paye' AND type_conge = 'ferie')           AS h_ferie,
  SUM(heures) FILTER (WHERE type = 'conge_paye' AND type_conge = 'vacances')        AS h_vacances_paye,
  SUM(heures) FILTER (WHERE type = 'conge_paye' AND type_conge = 'maladie')         AS h_maladie_paye,
  SUM(heures) FILTER (WHERE type = 'conge_paye'
    AND type_conge NOT IN ('ferie','vacances','maladie'))                            AS h_conge_paye_autre,
  -- Total congés payés
  SUM(heures) FILTER (WHERE type = 'conge_paye')                                    AS h_conge_paye_total,
  -- Absentéisme = congés NON payés
  SUM(heures) FILTER (WHERE type = 'conge_non_paye' AND type_conge = 'vacances')    AS h_vacances_non_paye,
  SUM(heures) FILTER (WHERE type = 'conge_non_paye' AND type_conge = 'maladie')     AS h_maladie_non_paye,
  SUM(heures) FILTER (WHERE type = 'conge_non_paye' AND type_conge = 'cnesst')      AS h_cnesst,
  SUM(heures) FILTER (WHERE type = 'conge_non_paye' AND type_conge = 'absence_solde') AS h_absence_solde,
  SUM(heures) FILTER (WHERE type = 'conge_non_paye')                                AS h_absent_total,
  -- Banque d'heures
  SUM(heures) FILTER (WHERE type = 'banque_heures')                                 AS h_banque,
  -- Total toutes catégories
  SUM(heures)                                                                        AS h_total,
  -- Heures pour lesquelles l'employé est payé (quart + tous congés payés)
  SUM(heures) FILTER (WHERE type IN ('quart','conge_paye'))                         AS h_total_paye,
  -- Département principal (le plus fréquent)
  MODE() WITHIN GROUP (ORDER BY succursale)                                          AS succursale_principale
FROM prod_agendrix_heures
GROUP BY semaine_debut, no_employe_acomba, employe_id, prenom, nom_agendrix;
