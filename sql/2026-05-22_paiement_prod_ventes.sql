-- ════════════════════════════════════════════════════════════════════
-- Suivi des paiements sur prod_ventes
-- Date : 2026-05-22
--
-- But  : Permettre de savoir, pour chaque camion vendu, où on en est avec
--        le paiement (payé / partiel / dépôt / PO / non-payé), combien on a
--        reçu jusqu'à maintenant, et combien il reste.
--
-- Valeurs possibles pour statut_paiement :
--   'paye'      = vente complètement payée, dossier fermé
--   'partiel'   = une partie du montant a été reçue (montant_recu > 0)
--   'depot'     = seulement le dépôt a été reçu
--   'po'        = PO reçu, en attente du paiement
--   'non-paye'  = aucun paiement reçu (défaut)
-- ════════════════════════════════════════════════════════════════════

-- 1. Ajout des 4 colonnes
ALTER TABLE prod_ventes
  ADD COLUMN IF NOT EXISTS statut_paiement        text         DEFAULT 'non-paye',
  ADD COLUMN IF NOT EXISTS montant_recu           decimal(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS date_paiement_complet  date,
  ADD COLUMN IF NOT EXISTS notes_paiement         text;

-- Contrainte de validité sur statut_paiement
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'prod_ventes_statut_paiement_check'
  ) THEN
    ALTER TABLE prod_ventes
      ADD CONSTRAINT prod_ventes_statut_paiement_check
      CHECK (statut_paiement IN ('paye', 'partiel', 'depot', 'po', 'non-paye'));
  END IF;
END $$;

-- Commentaires (documentation)
COMMENT ON COLUMN prod_ventes.statut_paiement       IS 'paye | partiel | depot | po | non-paye';
COMMENT ON COLUMN prod_ventes.montant_recu          IS 'Montant total reçu jusqu''à maintenant';
COMMENT ON COLUMN prod_ventes.date_paiement_complet IS 'Date où le paiement complet a été reçu (NULL si pas encore)';
COMMENT ON COLUMN prod_ventes.notes_paiement        IS 'Notes libres sur le paiement (ex: "Chèque #1234, reste 5000$ à venir le 30 juin")';

-- 2. Initialisation intelligente : pour les vendus existants, marquer 'paye' si
--    le camion correspondant dans prod_inventaire a paiement_complet = true.
--    Pour les autres, on laisse le défaut 'non-paye'.
UPDATE prod_ventes pv
SET
  statut_paiement       = 'paye',
  montant_recu          = COALESCE(pv.prix_vente, 0),
  date_paiement_complet = COALESCE(pi.updated_at::date, CURRENT_DATE)
FROM prod_inventaire pi
WHERE pv.stock_numero = pi.numero
  AND pv.statut = 'vendu'
  AND pi.paiement_complet = true
  AND pv.statut_paiement = 'non-paye';  -- seulement si pas déjà initialisé

-- Initialiser 'depot' pour ceux qui ont un dépôt mais pas complet
UPDATE prod_ventes pv
SET
  statut_paiement = 'depot',
  montant_recu    = COALESCE(pi.montant_depot, 0)
FROM prod_inventaire pi
WHERE pv.stock_numero = pi.numero
  AND pv.statut = 'vendu'
  AND pi.paiement_depot = true
  AND pi.paiement_complet = false
  AND pv.statut_paiement = 'non-paye';

-- Initialiser 'po' pour ceux qui ont un PO mais pas de dépôt ni complet
UPDATE prod_ventes pv
SET statut_paiement = 'po'
FROM prod_inventaire pi
WHERE pv.stock_numero = pi.numero
  AND pv.statut = 'vendu'
  AND pi.paiement_po = true
  AND pi.paiement_depot = false
  AND pi.paiement_complet = false
  AND pv.statut_paiement = 'non-paye';

-- 3. Index pour requêtes rapides
CREATE INDEX IF NOT EXISTS idx_prod_ventes_statut_paiement ON prod_ventes (statut_paiement);
CREATE INDEX IF NOT EXISTS idx_prod_ventes_date_paiement   ON prod_ventes (date_paiement_complet);

-- 4. Vérification — résumé après initialisation
SELECT
  statut_paiement,
  COUNT(*) AS nb,
  SUM(prix_vente)    AS total_prix,
  SUM(montant_recu)  AS total_recu,
  SUM(prix_vente - COALESCE(montant_recu, 0)) AS total_solde_a_venir
FROM prod_ventes
WHERE statut = 'vendu'
GROUP BY statut_paiement
ORDER BY statut_paiement;
