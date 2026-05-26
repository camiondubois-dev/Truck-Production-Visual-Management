-- ════════════════════════════════════════════════════════════════
-- Ajout de taux_horaire_applique dans prod_heures_employes
-- Objectif : le taux est capturé AU MOMENT de l'import iTrack.
-- Modifier le taux dans Admin → Employés ne touche plus au passé.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE prod_heures_employes
  ADD COLUMN IF NOT EXISTS taux_horaire_applique NUMERIC(8,2);

-- Backfill des entrées existantes : taux actuel de l'employé
UPDATE prod_heures_employes h
SET    taux_horaire_applique = e.taux_horaire
FROM   prod_employes e
WHERE  h.employe_id = e.id
  AND  h.taux_horaire_applique IS NULL
  AND  e.taux_horaire > 0;

-- Index utile pour les calculs coût par période
CREATE INDEX IF NOT EXISTS idx_heures_employes_taux
  ON prod_heures_employes (employe_id, taux_horaire_applique);
