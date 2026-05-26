-- ════════════════════════════════════════════════════════════════════
-- Setup taux horaire / salaire hebdomadaire des employés
-- Source : Acomba PP11 (2026-05-03 → 2026-05-16) + Agendrix
-- Tout est ramené sur base HEBDOMADAIRE :
--   • Heures > 0  → taux_horaire calculé (salaire / heures)
--   • Heures = 0  → salaire_hebdomadaire = montant biweekly ÷ 2
-- ════════════════════════════════════════════════════════════════════

-- ─── 1. Nouvelles colonnes ──────────────────────────────────────────
ALTER TABLE prod_employes
  ADD COLUMN IF NOT EXISTS no_employe_acomba   text,
  ADD COLUMN IF NOT EXISTS nom_complet         text,
  ADD COLUMN IF NOT EXISTS salaire_hebdomadaire decimal(10,2);

COMMENT ON COLUMN prod_employes.no_employe_acomba   IS 'Numéro Acomba (ex: 1021, 82-1558)';
COMMENT ON COLUMN prod_employes.nom_complet         IS 'Nom complet (Prénom Nom)';
COMMENT ON COLUMN prod_employes.salaire_hebdomadaire IS 'Salaire hebdomadaire pour employés payés à la semaine';

-- Contrainte UNIQUE sur no_employe_acomba (pour permettre ON CONFLICT)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_employes_no_acomba') THEN
    ALTER TABLE prod_employes ADD CONSTRAINT uq_employes_no_acomba UNIQUE (no_employe_acomba);
  END IF;
END $$;

-- ─── 2. UPSERT des employés ─────────────────────────────────────────
-- Hourly : taux_horaire renseigné, salaire_hebdomadaire NULL
-- Salaried : taux_horaire = 0, salaire_hebdomadaire = bi-weekly ÷ 2

INSERT INTO prod_employes
  (no_employe_acomba, nom, nom_complet, departement, taux_horaire, salaire_hebdomadaire, actif, notes)
VALUES
  -- ─── Hourly employees (rate from Excel "Taux horaire ($/h)") ───
  ('1021',    'PIERRE ADAM',                   'PIERRE ADAM',                    'CONTROLEUR INVENTAIRE', 22.84, NULL, true, NULL),
  ('1428',    'PATRICK DOIRON',                'PATRICK DOIRON',                 'COMMIS AU STOCK-ROOM',  39.95, NULL, true, NULL),
  ('1432',    'VALERIE LANGLOIS',              'VALERIE LANGLOIS',               'COMMIS AU STOCK-ROOM',  29.13, NULL, true, NULL),
  ('82-1563', 'RONILLO SANTOS SICAN',          'RONILLO SANTOS SICAN',           'MECANICIEN MOTEUR',     43.29, NULL, true, NULL),
  ('1232',   'GINO PARE',                      'GINO PARE',                      'COMMIS AU PIECES',      25.61, NULL, true, NULL),
  ('1338',   'FRANK SERGERIE',                 'FRANK SERGERIE',                 'HOMME DE COUR',         26.78, NULL, true, NULL),
  ('1544',   'ARTHUR CARTIER',                 'ARTHUR CARTIER',                 'JOURNALIER',            18.00, NULL, true, NULL),
  ('1604',   'FRANK-WILLIAM SERGERIE',         'FRANK-WILLIAM SERGERIE',         'JOURNALIER',            20.64, NULL, true, NULL),
  ('1622',   'PASCAL LEFEBVRE',                'PASCAL LEFEBVRE',                'COMMIS',                27.00, NULL, true, NULL),
  ('1250',   'ROGER ST-AMANT',                 'ROGER ST-AMANT',                 'ACHETEUR',              22.67, NULL, true, NULL),
  ('1446',   'STEPHANE DALPE',                 'STEPHANE DALPE',                 'ACHETEUR',              33.00, NULL, true, NULL),
  ('1343',   'DANIEL LACHANCE',                'DANIEL LACHANCE',                'MECANICIEN',            32.00, NULL, true, NULL),
  ('1351',   'DAVID DAVIAU',                   'DAVID DAVIAU',                   'MECANICIEN',            34.00, NULL, true, NULL),
  ('81-1526','MARLON DEGRACIA MENCHAVEZ',      'MARLON DEGRACIA MENCHAVEZ',      'MECANICIEN GENERAL',    38.75, NULL, true, NULL),
  ('81-1527','JOHN JOHN TOLEDO PAPAURAN',      'JOHN JOHN TOLEDO PAPAURAN',      'MECANICIEN GENERAL',    36.78, NULL, true, NULL),
  ('82-1557','GIAN CARLO TANGPUS MABILOG',     'GIAN CARLO TANGPUS MABILOG',     'MECANICIEN GENERAL',    36.26, NULL, true, NULL),
  ('82-1560','GEROME PARAGATOS DIAZ',          'GEROME PARAGATOS DIAZ',          'MECANICIEN GENERAL',    34.50, NULL, true, NULL),
  ('1051',   'CLAUDE TETREAULT',               'CLAUDE TETREAULT',               'JOURNALIER',            28.59, NULL, true, NULL),
  ('1614',   'ERIC CHAMPAGNE',                 'ERIC CHAMPAGNE',                 'DEMANTELEUR',           34.30, NULL, true, NULL),
  ('1367',   'MICHEL ROY',                     'MICHEL ROY',                     'JOURNALIER MOTEUR',     33.26, NULL, true, NULL),
  ('1387',   'DOMINIQUE BELLEFLEUR',           'DOMINIQUE BELLEFLEUR',           'MECANICIEN MOTEUR',     45.63, NULL, true, NULL),
  ('1623',   'JEREMY LAGACE',                  'JEREMY LAGACE',                  'JOURNALIER',            22.00, NULL, true, NULL),
  ('1624',   'MAXIME COME LARIVIERE',          'MAXIME COME LARIVIERE',          'MECANICIEN',            35.06, NULL, true, NULL),
  ('81-1534','RODERICK EVARISTO RENDON',       'RODERICK EVARISTO RENDON',       'MECANICIEN MOTEUR',     36.76, NULL, true, NULL),
  ('82-1558','ARJIE GIMENEZ TORMIS',           'ARJIE GIMENEZ TORMIS',           'MECANICIEN',            35.00, NULL, true, NULL),
  ('82-1559','MARVIN SISON SONZA',             'MARVIN SISON SONZA',             'MECANICIEN',            38.87, NULL, true, NULL),
  ('82-1561','DANIEL PONCE RAMOS',             'DANIEL PONCE RAMOS',             'MECANICIEN',            36.12, NULL, true, NULL),
  ('82-1562','PAULO NAVARRO BAUTISTA',         'PAULO NAVARRO BAUTISTA',         'MECANICIEN',            35.00, NULL, true, NULL),
  ('82-1564','PAUL MARTIN CAGAANAN CATAMORA',  'PAUL MARTIN CAGAANAN CATAMORA',  'MECANICIEN MOTEUR',     30.63, NULL, true, NULL),
  ('1339',   'DANIEL DORE',                    'DANIEL DORE',                    'SOUDEUR',               46.27, NULL, true, NULL),
  ('1484',   'SEBASTIEN HUNEAULT',             'SEBASTIEN HUNEAULT',             'SOUDEUR',               65.74, NULL, true, NULL),
  ('1493',   'LOUIS-PHILIPPE BARBEAU',         'LOUIS-PHILIPPE BARBEAU',         'SOUDEUR',               39.43, NULL, true, NULL),
  ('1611',   'TOMMY HUNEAULT',                 'TOMMY HUNEAULT',                 'JOURNALIER',            20.60, NULL, true, NULL),
  ('1620',   'FRANCIS LEFEBVRE',               'FRANCIS LEFEBVRE',               'SOUDEUR',               27.00, NULL, true, NULL),
  ('1389',   'CHRISTIAN RACICOT',              'CHRISTIAN RACICOT',              'LAVEUR',                30.52, NULL, true, NULL),
  ('1535',   'DANIEL MEUNIER',                 'DANIEL MEUNIER',                 'LIVREUR',               23.30, NULL, true, NULL),
  ('1552',   'MAXIME FOURNIER',                'MAXIME FOURNIER',                'CHAUFFEUR',             36.82, NULL, true, NULL),
  ('1117',   'BERNARD RAINVILLE',              'BERNARD RAINVILLE',              'VENDEUR DE PIECES',     44.51, NULL, true, NULL),
  ('1156',   'ROLANDO MARIO RAMOS ALVARADO',   'ROLANDO MARIO RAMOS ALVARADO',   'VENDEUR',               43.27, NULL, true, NULL),
  ('1359',   'DAVID MEUNIER',                  'DAVID MEUNIER',                  'CONSEILLER FINANCEMENT',54.99, NULL, true, NULL),
  ('1383',   'MARTA DOLORES IBANEZ BLANCO',    'MARTA DOLORES IBANEZ BLANCO',    'REPRESENTANTE MARKETING',37.50, NULL, true, NULL),
  ('1392',   'JIMMY CHAMPS',                   'JIMMY CHAMPS',                   'VENDEUR DE PIECES',     36.74, NULL, true, NULL),
  ('1394',   'DANY GEMME',                     'DANY GEMME',                     'VENDEUR',               84.80, NULL, true, NULL),
  ('1449',   'ALEXANDRE VALIQUETTE',           'ALEXANDRE VALIQUETTE',           'VENDEUR DE PIECES',     37.00, NULL, true, NULL),
  ('1610',   'XAVIER GEMME',                   'XAVIER GEMME',                   'VENDEUR PIECES',        28.86, NULL, true, NULL),
  ('1618',   'NELSON CARRILLO GARAY',          'NELSON CARRILLO GARAY',          'VENDEUR EXPORT',        28.85, NULL, true, NULL),
  ('1003',   'MICHELINE DUBOIS',               'MICHELINE DUBOIS',               'SECRETAIRE-RECEPTIONNISTE', 42.84, NULL, true, NULL),
  ('1040',   'ANNIE PICCOLO',                  'ANNIE PICCOLO',                  'COMPTABLE-CONTROLEUR',  64.10, NULL, true, NULL),
  ('1289',   'CHRISTINA DUBOIS',               'CHRISTINA DUBOIS',               'COMMIS BUREAU',         30.26, NULL, true, NULL),
  ('1515',   'CAROLYN WARWARUK',               'CAROLYN WARWARUK',               'COMMIS-PAYABLES',       30.23, NULL, true, NULL),
  ('1516',   'VERONIQUE GALLANT',              'VERONIQUE GALLANT',              'COMMIS COMPTABLE',      30.19, NULL, true, NULL),

  -- ─── Salaried employees (hours=0 → salaire ÷ 2 = hebdomadaire) ───
  ('1184',   'JOEL CARTIER',                   'JOEL CARTIER',                   'MECANICIEN',             0, 3846.15, true, 'Salaire fixe — biweekly 7692.30 ÷ 2'),
  ('1283',   'GAETAN BELANGER',                'GAETAN BELANGER',                'CHAUFFEUR / TOWING',     0, 936.63,  true, 'Salaire fixe — biweekly 1873.25 ÷ 2 (chauffeur+towing)'),
  ('1588',   'PIERRE PINEL',                   'PIERRE PINEL',                   'CHAUFFEUR',              0, 82.50,   true, 'Salaire fixe — biweekly 165 ÷ 2'),
  ('1140',   'JASON DUBOIS',                   'JASON DUBOIS',                   'DIRECTEUR DES VENTES',   0, 2884.62, true, 'Salaire fixe — biweekly 5769.23 ÷ 2'),
  ('1001',   'REGIS DUBOIS',                   'REGIS DUBOIS',                   'ACTIONNAIRE',            0, 2884.62, true, 'Salaire fixe — biweekly 5769.23 ÷ 2'),
  ('1027',   'FRANCINE LEFEBVRE',              'FRANCINE LEFEBVRE',              'COMMIS',                 0, 852.00,  true, 'Salaire fixe — biweekly 1704 ÷ 2'),
  ('1410',   'MICHAEL DUBOIS',                 'MICHAEL DUBOIS',                 'ADJOINT CONTROLEUR',     0, 2884.62, true, 'Salaire fixe — biweekly 5769.23 ÷ 2'),

  -- ─── Cas particuliers : présents dans Acomba mais peu d'activité ───
  ('1546',   'GLADYS ARACENA',                 'GLADYS ARACENA',                 NULL,                     0, 0,       false, 'Aucune activité pour PP11 (hours=0, salary=0)')

ON CONFLICT (no_employe_acomba) DO UPDATE SET
  nom_complet          = EXCLUDED.nom_complet,
  nom                  = EXCLUDED.nom,
  departement          = EXCLUDED.departement,
  taux_horaire         = EXCLUDED.taux_horaire,
  salaire_hebdomadaire = EXCLUDED.salaire_hebdomadaire,
  actif                = EXCLUDED.actif,
  notes                = EXCLUDED.notes,
  updated_at           = now();

-- ─── 3. Vérifications ──────────────────────────────────────────────
SELECT 'Colonnes ajoutées + employés Acomba upsertés.' AS info;

-- Résumé par type
SELECT
  CASE
    WHEN salaire_hebdomadaire IS NOT NULL AND salaire_hebdomadaire > 0 THEN '💼 Salariés (hebdo fixe)'
    WHEN taux_horaire > 0                                              THEN '⏱  Horaire'
    ELSE                                                                    '❓ Sans rémunération'
  END AS type_remuneration,
  COUNT(*) AS nb,
  ROUND(AVG(taux_horaire)::numeric, 2)         AS taux_moyen,
  ROUND(SUM(salaire_hebdomadaire)::numeric, 2) AS total_hebdo_fixe
FROM prod_employes
WHERE no_employe_acomba IS NOT NULL
GROUP BY 1
ORDER BY 1;

-- Liste complète (utile pour vérifier)
SELECT
  no_employe_acomba AS "No",
  nom_complet       AS "Nom",
  departement       AS "Département",
  taux_horaire      AS "$/h",
  salaire_hebdomadaire AS "$/sem"
FROM prod_employes
WHERE no_employe_acomba IS NOT NULL
ORDER BY no_employe_acomba;
