-- ════════════════════════════════════════════════════════════════════
-- Locations — Ajout du champ revenu_percu (montant manuel)
-- Date : 2026-05-22
-- But  : Permettre de saisir manuellement le revenu total reçu pour un
--        contrat (quand la location est terminée et qu'il y a eu un
--        ajustement vs le calcul automatique).
--        Si revenu_percu IS NULL → on utilise le calcul automatique
--        Sinon → on utilise revenu_percu (priorité au manuel)
-- ════════════════════════════════════════════════════════════════════

-- 1. Ajouter la colonne
ALTER TABLE prod_locations
  ADD COLUMN IF NOT EXISTS revenu_percu decimal(12,2);

COMMENT ON COLUMN prod_locations.revenu_percu IS
  'Montant total réellement reçu (manuel). Si NULL, utilise le calcul auto (mois × mensuel).';

-- 2. DROP les vues d'abord (CREATE OR REPLACE ne permet pas de réordonner les colonnes
--    quand la table sous-jacente change de structure)
--    Ordre important : prod_locations_total_par_camion dépend de prod_locations_avec_cumul
DROP VIEW IF EXISTS prod_locations_total_par_camion;
DROP VIEW IF EXISTS prod_locations_avec_cumul;

-- 3. Recréer la vue avec la logique de priorité revenu_percu > calcul auto
CREATE VIEW prod_locations_avec_cumul AS
SELECT
  l.*,
  CASE WHEN l.date_fin IS NULL THEN true ELSE false END AS actif,
  GREATEST(
    0,
    (EXTRACT(YEAR  FROM age(COALESCE(l.date_fin, CURRENT_DATE), l.date_debut))::int * 12)
    + EXTRACT(MONTH FROM age(COALESCE(l.date_fin, CURRENT_DATE), l.date_debut))::int
  ) AS mois_ecoules,
  -- Revenu cumulé = revenu_percu si défini, sinon calcul automatique
  COALESCE(
    l.revenu_percu,
    (
      GREATEST(
        0,
        (EXTRACT(YEAR  FROM age(COALESCE(l.date_fin, CURRENT_DATE), l.date_debut))::int * 12)
        + EXTRACT(MONTH FROM age(COALESCE(l.date_fin, CURRENT_DATE), l.date_debut))::int
      ) * l.montant_mensuel
    )
  ) AS revenu_cumule,
  -- Drapeau qui indique si le montant est manuel (vs calculé automatiquement)
  (l.revenu_percu IS NOT NULL) AS revenu_manuel
FROM prod_locations l;

-- 4. Recréer la vue agrégée (utilise prod_locations_avec_cumul, pas de changement)
CREATE VIEW prod_locations_total_par_camion AS
SELECT
  stock_numero,
  SUM(revenu_cumule)               AS revenu_location_total,
  COUNT(*)                         AS nb_contrats,
  COUNT(*) FILTER (WHERE actif)    AS nb_contrats_actifs,
  MIN(date_debut)                  AS premiere_location,
  MAX(COALESCE(date_fin, CURRENT_DATE)) AS derniere_activite
FROM prod_locations_avec_cumul
GROUP BY stock_numero;

SELECT 'Colonne revenu_percu ajoutée + vues mises à jour.' AS info;
