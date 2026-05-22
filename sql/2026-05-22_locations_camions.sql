-- ════════════════════════════════════════════════════════════════════
-- MODULE LOCATIONS CAMIONS
-- Date : 2026-05-22
-- But  : Suivre les contrats de location (paiement mensuel),
--        afficher le revenu cumulé par camion (auto-calculé),
--        et le combiner au prix de vente dans la profitabilité finale.
-- Règles métier :
--   • Un seul contrat actif par camion à la fois (date_fin IS NULL)
--   • Historique conservé : un camion peut avoir plusieurs lignes
--     (loué → retourné → reloué à un autre client)
--   • Cumul auto : (mois écoulés depuis date_debut) × montant_mensuel
-- ════════════════════════════════════════════════════════════════════

-- ─── 1. Table principale ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prod_locations (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_numero     text        NOT NULL,
  client           text,
  vendeur_id       uuid,                       -- FK prod_vendeurs (souple)
  date_debut       date        NOT NULL,
  date_fin         date,                       -- NULL = location en cours
  montant_mensuel  decimal(12,2) NOT NULL,
  notes            text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_locations_stock     ON prod_locations (stock_numero);
CREATE INDEX IF NOT EXISTS idx_locations_actif     ON prod_locations (stock_numero) WHERE date_fin IS NULL;
CREATE INDEX IF NOT EXISTS idx_locations_vendeur   ON prod_locations (vendeur_id);

-- Contrainte : un seul contrat actif par camion à la fois
-- (deux lignes avec même stock_numero ET date_fin IS NULL = interdit)
CREATE UNIQUE INDEX IF NOT EXISTS uq_locations_actif_unique
  ON prod_locations (stock_numero) WHERE date_fin IS NULL;

-- ─── 2. Trigger updated_at ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS locations_updated_at ON prod_locations;
CREATE TRIGGER locations_updated_at
  BEFORE UPDATE ON prod_locations
  FOR EACH ROW EXECUTE FUNCTION trg_locations_updated_at();

-- ─── 3. Vue : cumul automatique par contrat ─────────────────────────
-- mois_ecoules = nombre de mois civils complets entre date_debut et
-- (date_fin OU aujourd'hui), arrondi vers le haut sur la fraction.
-- Logique simple : on fait ((date_reference - date_debut) / 30) + arrondi.
-- Pour rester juste, on utilise EXTRACT (year/month) sur l'écart.
CREATE OR REPLACE VIEW prod_locations_avec_cumul AS
SELECT
  l.*,
  CASE WHEN l.date_fin IS NULL THEN true ELSE false END AS actif,
  -- Nombre de mois écoulés (entiers, plancher) entre date_debut et la date de référence
  GREATEST(
    0,
    (EXTRACT(YEAR  FROM age(COALESCE(l.date_fin, CURRENT_DATE), l.date_debut))::int * 12)
    + EXTRACT(MONTH FROM age(COALESCE(l.date_fin, CURRENT_DATE), l.date_debut))::int
  ) AS mois_ecoules,
  -- Revenu cumulé = mois écoulés × montant mensuel
  (
    GREATEST(
      0,
      (EXTRACT(YEAR  FROM age(COALESCE(l.date_fin, CURRENT_DATE), l.date_debut))::int * 12)
      + EXTRACT(MONTH FROM age(COALESCE(l.date_fin, CURRENT_DATE), l.date_debut))::int
    ) * l.montant_mensuel
  ) AS revenu_cumule
FROM prod_locations l;

-- ─── 4. Vue agrégée par camion : total revenu location de tous les contrats ──
-- Pour la profitabilité finale d'un camion vendu après plusieurs locations.
CREATE OR REPLACE VIEW prod_locations_total_par_camion AS
SELECT
  stock_numero,
  SUM(revenu_cumule)               AS revenu_location_total,
  COUNT(*)                         AS nb_contrats,
  COUNT(*) FILTER (WHERE actif)    AS nb_contrats_actifs,
  MIN(date_debut)                  AS premiere_location,
  MAX(COALESCE(date_fin, CURRENT_DATE)) AS derniere_activite
FROM prod_locations_avec_cumul
GROUP BY stock_numero;

-- ─── 5. RLS ─────────────────────────────────────────────────────────
ALTER TABLE prod_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "locations_select" ON prod_locations;
CREATE POLICY "locations_select" ON prod_locations
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "locations_insert" ON prod_locations;
CREATE POLICY "locations_insert" ON prod_locations
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "locations_update" ON prod_locations;
CREATE POLICY "locations_update" ON prod_locations
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "locations_delete" ON prod_locations;
CREATE POLICY "locations_delete" ON prod_locations
  FOR DELETE USING (true);

-- ─── 6. Vérifications ───────────────────────────────────────────────
SELECT 'Table prod_locations créée.' AS info;
SELECT 'Vue prod_locations_avec_cumul créée.' AS info;
SELECT 'Vue prod_locations_total_par_camion créée.' AS info;
