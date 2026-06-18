-- ════════════════════════════════════════════════════════════════
-- Module Moteurs — Appliquer les 8 étapes à TOUS les moteurs en inventaire
--
-- Donne à chaque moteur existant le plan de production complet (8 étapes,
-- toutes « planifie »), avec des UUID uniques par étape et par moteur.
-- Remet le moteur à « en-attente » (rien commencé) et efface l'ancien
-- suivi (employé/dates) car les anciennes étapes ne correspondent plus.
--
-- ✓ Sécurité : ne touche PAS les moteurs qui ont déjà les nouvelles étapes
--   (clause WHERE) → relançable sans écraser un travail déjà en cours.
-- ✓ N'affecte pas les moteurs archivés.
-- ════════════════════════════════════════════════════════════════

UPDATE prod_moteurs
SET road_map = jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'etape_id', 'a-faire',         'ordre', 1, 'statut', 'planifie'),
      jsonb_build_object('id', gen_random_uuid(), 'etape_id', 'accessoires',     'ordre', 2, 'statut', 'planifie'),
      jsonb_build_object('id', gen_random_uuid(), 'etape_id', 'demarrage',       'ordre', 3, 'statut', 'planifie'),
      jsonb_build_object('id', gen_random_uuid(), 'etape_id', 'reparation',      'ordre', 4, 'statut', 'planifie'),
      jsonb_build_object('id', gen_random_uuid(), 'etape_id', 'redemarrage',     'ordre', 5, 'statut', 'planifie'),
      jsonb_build_object('id', gen_random_uuid(), 'etape_id', 'lavage-peinture', 'ordre', 6, 'statut', 'planifie'),
      jsonb_build_object('id', gen_random_uuid(), 'etape_id', 'prep-web',        'ordre', 7, 'statut', 'planifie'),
      jsonb_build_object('id', gen_random_uuid(), 'etape_id', 'validation-web',  'ordre', 8, 'statut', 'planifie')
    ),
    statut          = 'en-attente',
    employe_courant = NULL,
    date_entree     = NULL,
    date_sortie     = NULL,
    updated_at      = now()
WHERE statut <> 'archive'
  AND NOT (road_map @> '[{"etape_id":"a-faire"}]'::jsonb);

-- Contrôle (lecture seule) — voir le résultat :
-- SELECT stk_numero, statut, jsonb_array_length(road_map) AS nb_etapes
-- FROM prod_moteurs WHERE statut <> 'archive' ORDER BY stk_numero;
