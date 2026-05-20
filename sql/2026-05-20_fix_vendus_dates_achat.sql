-- ════════════════════════════════════════════════════════════════════
-- Remplacement des date_achat pour les camions VENDUS
-- Date : 2026-05-20 — 76 camions traités / 302 vendus
--
-- Les 226 autres vendus ne sont plus dans vehiclecostdetail.csv
-- (camions déjà vendus ne sont plus dans le rapport actif HITRAC).
-- Pour ceux-là, il faudra un rapport HITRAC historique.
-- ════════════════════════════════════════════════════════════════════

UPDATE prod_ventes v
SET date_achat = c.date_achat::date
FROM (VALUES
  -- 32321 | 2018 KENWORTH T680 | vendu: 2024-07-25 | achat: 2023-03-23
  ('32321', '2023-03-23'),
  -- 34401 | 2017 FREIGHTLINER 122SD | vendu: 2025-02-07 | achat: 2024-12-16
  ('34401', '2024-12-16'),
  -- 33471 | 2020 KENWORTH T880 | vendu: 2024-10-16 | achat: 2024-03-27
  ('33471', '2024-03-27'),
  -- 33071 | 2020 KENWORTH T880 | vendu: 2026-02-27 | achat: 2023-11-01
  ('33071', '2023-11-01'),
  -- 32243 | 2004 VOLVO L90E | vendu: 2024-09-27 | achat: 2023-02-14
  ('32243', '2023-02-14'),
  -- 32378 | 2019 WESTERN STAR TR 4900 FA | vendu: 2025-02-20 | achat: 2023-08-04
  ('32378', '2023-08-04'),
  -- 33754 | 2019 WESTERN STAR TR 4700 | vendu: 2024-08-28 | achat: 2024-06-04
  ('33754', '2024-06-04'),
  -- 34811 | 2018 CAPACITY TJ7000 | vendu: 2026-04-23 | achat: 2025-05-29
  ('34811', '2025-05-29'),
  -- 33636 | 2025 WESTERN STAR TR 47 X | vendu: 2025-01-22 | achat: 2025-01-22
  ('33636', '2025-01-22'),
  -- 33755 | 2018 WESTERN STAR TR 4700 | vendu: 2025-03-26 | achat: 2024-06-04
  ('33755', '2024-06-04'),
  -- 34573 | 2013 FREIGHTLINER CORONADO | vendu: 2025-09-09 | achat: 2025-03-06
  ('34573', '2025-03-06'),
  -- 34162 | 2016 INTERNATIONAL Prostar | vendu: 2025-03-03 | achat: 2024-09-26
  ('34162', '2024-09-26'),
  -- 34822 | 2020 INTERNATIONAL LT625 | vendu: 2025-10-03 | achat: 2025-06-02
  ('34822', '2025-06-02'),
  -- 25966 | 2011 INTERNATIONAL WorkStar 7500 | vendu: 2025-10-14 | achat: 2018-04-20
  ('25966', '2018-04-20'),
  -- 34829 | 2020 INTERNATIONAL LT625 | vendu: 2025-09-19 | achat: 2025-06-04
  ('34829', '2025-06-04'),
  -- 35063 | 2016 PETERBILT 567 | vendu: 2025-11-03 | achat: 2025-09-10
  ('35063', '2025-09-10'),
  -- 33812 | 2008 KENWORTH T300 | vendu: 2025-05-02 | achat: 2024-06-12
  ('33812', '2024-06-12'),
  -- 33424 | 2019 KENWORTH T370 | vendu: 2024-07-08 | achat: 2024-03-15
  ('33424', '2024-03-15'),
  -- 34974 | 2016 FREIGHTLINER M2 106 | vendu: 2026-02-27 | achat: 2025-07-18
  ('34974', '2025-07-18'),
  -- 33474 | 2021 FREIGHTLINER 122SD | vendu: 2024-07-24 | achat: 2024-03-27
  ('33474', '2024-03-27'),
  -- 33669 | 2022 KENWORTH W990 | vendu: 2024-07-08 | achat: 2024-05-13
  ('33669', '2024-05-13'),
  -- 34645 | 2018 FREIGHTLINER M2 106 | vendu: 2025-07-02 | achat: 2025-04-07
  ('34645', '2025-04-07'),
  -- 34192 | 2013 KENWORTH T370 | vendu: 2024-11-27 | achat: 2024-10-09
  ('34192', '2024-10-09'),
  -- 34156 | 2005 INTERNATIONAL 7600 | vendu: 2025-03-24 | achat: 2024-09-25
  ('34156', '2024-09-25'),
  -- 33373 | 2015 KENWORTH T800 | vendu: 2024-09-06 | achat: 2024-03-01
  ('33373', '2024-03-01'),
  -- 33753 | 2015 MACK GU813 | vendu: 2024-11-08 | achat: 2024-05-31
  ('33753', '2024-05-31'),
  -- 33363 | 2018 VOLVO VNR | vendu: 2024-08-12 | achat: 2024-02-29
  ('33363', '2024-02-29'),
  -- 33501 | 2022 KENWORTH T880 | vendu: 2025-05-02 | achat: 2024-04-05
  ('33501', '2024-04-05'),
  -- 33432 | 2017 FREIGHTLINER M2 106 | vendu: 2024-10-08 | achat: 2024-03-19
  ('33432', '2024-03-19'),
  -- 33892 | 2011 FREIGHTLINER M2 112 | vendu: 2025-04-28 | achat: 2024-06-28
  ('33892', '2024-06-28'),
  -- 34411 | 2002 INTERNATIONAL 4300 | vendu: 2025-08-21 | achat: 2024-12-18
  ('34411', '2024-12-18'),
  -- 34322 | 2018 INTERNATIONAL LT625 | vendu: 2025-03-07 | achat: 2024-11-21
  ('34322', '2024-11-21'),
  -- 34011 | 2020 WESTERN STAR TR 4700 | vendu: 2025-02-14 | achat: 2024-07-26
  ('34011', '2024-07-26'),
  -- 31349 | 2018 PETERBILT 567 | vendu: 2024-10-11 | achat: 2022-04-21
  ('31349', '2022-04-21'),
  -- 34405 | 2015 FREIGHTLINER CASCADIA 113BBC | vendu: 2025-05-02 | achat: 2024-12-17
  ('34405', '2024-12-17'),
  -- 32048 | 2010 SHUNTER CAPACITY | vendu: 2025-04-10 | achat: 2023-03-23
  ('32048', '2023-03-23'),
  -- 34142 | 2008 FREIGHTLINER M2 112 | vendu: 2025-01-15 | achat: 2024-09-17
  ('34142', '2024-09-17'),
  -- 35277 | 2023 FREIGHTLINER M2 106 | vendu: 2026-01-08 | achat: 2025-11-20
  ('35277', '2025-11-20'),
  -- 34952 | 2007 STERLING L7500 SERIES | vendu: 2025-07-17 | achat: 2025-07-11
  ('34952', '2025-07-11'),
  -- 34279 | 2017 KALMAR SHUNTER | vendu: 2025-03-06 | achat: 2024-11-07
  ('34279', '2024-11-07'),
  -- 34294 | 2016 MACK GU813 | vendu: 2025-04-28 | achat: 2024-11-13
  ('34294', '2024-11-13'),
  -- 34883 | 2023 KENWORTH T-480 | vendu: 2025-12-23 | achat: 2025-06-20
  ('34883', '2025-06-20'),
  -- 35038 | 2023 KENWORTH W990 | vendu: 2025-08-26 | achat: 2025-08-21
  ('35038', '2025-08-21'),
  -- 33995 | 2016 KENWORTH T680 | vendu: 2025-01-28 | achat: 2024-07-24
  ('33995', '2024-07-24'),
  -- 35231 | 2024 FREIGHTLINER M2 106 | vendu: 2026-02-05 | achat: 2025-11-07
  ('35231', '2025-11-07'),
  -- 34841 | 2020 INTERNATIONAL LT625 | vendu: 2025-10-03 | achat: 2025-06-09
  ('34841', '2025-06-09'),
  -- 34210 | 2017 KENWORTH W900 | vendu: 2025-02-26 | achat: 2024-10-17
  ('34210', '2024-10-17'),
  -- 35478 | 2009 FREIGHTLINER M2 106 | vendu: 2026-04-13 | achat: 2026-02-16
  ('35478', '2026-02-16'),
  -- 33660 | 2016 FREIGHTLINER M2 106 | vendu: 2025-03-26 | achat: 2024-05-10
  ('33660', '2024-05-10'),
  -- 34413 | 1992 INTERNATIONAL 4900 | vendu: 2025-07-03 | achat: 2024-12-18
  ('34413', '2024-12-18'),
  -- 32343 | 2019 PETERBILT 367 | vendu: 2025-05-23 | achat: 2023-04-12
  ('32343', '2023-04-12'),
  -- 32836 | 2023 KENWORTH T880 | vendu: 2025-07-17 | achat: 2023-08-24
  ('32836', '2023-08-24'),
  -- 31442 | 2016 INTERNATIONAL 5900i PAYSTAR | vendu: 2024-10-25 | achat: 2022-05-27
  ('31442', '2022-05-27'),
  -- 31043 | 2005 WESTERN STAR TR 4900 SE | vendu: 2025-09-17 | achat: 2021-12-02
  ('31043', '2021-12-02'),
  -- 34946 | 2019 PETERBILT 579 | vendu: 2025-11-03 | achat: 2025-07-08
  ('34946', '2025-07-08'),
  -- 34622 | 2016 FREIGHTLINER M2 106 | vendu: 2025-10-01 | achat: 2025-04-02
  ('34622', '2025-04-02'),
  -- 34783 | 2018 WESTERN STAR TR 4700 | vendu: 2025-06-24 | achat: 2025-05-16
  ('34783', '2025-05-16'),
  -- 33503 | 2008 KENWORTH T300 | vendu: 2024-08-29 | achat: 2024-04-05
  ('33503', '2024-04-05'),
  -- 34820 | 2020 INTERNATIONAL LT625 | vendu: 2025-09-19 | achat: 2025-06-02
  ('34820', '2025-06-02'),
  -- 35198 | 2012 PETERBILT 386 | vendu: 2025-11-04 | achat: 2025-10-31
  ('35198', '2025-10-31'),
  -- 33854 | 2014 FREIGHTLINER ARGOSY | vendu: 2025-09-12 | achat: 2024-06-19
  ('33854', '2024-06-19'),
  -- 34388 | 2018 FREIGHTLINER M2 106 | vendu: 2025-04-23 | achat: 2024-12-11
  ('34388', '2024-12-11'),
  -- 34831 | 2020 INTERNATIONAL LT625 | vendu: 2025-09-19 | achat: 2025-06-04
  ('34831', '2025-06-04'),
  -- 34026 | 2016 MACK GU813 | vendu: 2025-05-01 | achat: 2024-07-31
  ('34026', '2024-07-31'),
  -- 32839 | 2024 KENWORTH T-480 | vendu: 2025-05-13 | achat: 2023-08-29
  ('32839', '2023-08-29'),
  -- 34371 | 2015 FREIGHTLINER M2 106 | vendu: 2025-02-21 | achat: 2024-12-09
  ('34371', '2024-12-09'),
  -- 34018 | 2006 INTERNATIONAL 7400 | vendu: 2024-09-05 | achat: 2024-07-30
  ('34018', '2024-07-30'),
  -- 34735 | 2021 KENWORTH T800 | vendu: 2026-04-07 | achat: 2025-05-01
  ('34735', '2025-05-01'),
  -- 35148 | 2017 KENWORTH T370 | vendu: 2025-12-22 | achat: 2025-10-10
  ('35148', '2025-10-10'),
  -- 35022 | 2023 KENWORTH W990 | vendu: 2025-08-27 | achat: 2025-08-20
  ('35022', '2025-08-20'),
  -- 34830 | 2020 INTERNATIONAL LT625 | vendu: 2025-09-12 | achat: 2025-06-04
  ('34830', '2025-06-04'),
  -- 35436 | 2001 FREIGHTLINER FL112 | vendu: 2026-02-16 | achat: 2026-02-05
  ('35436', '2026-02-05'),
  -- 35086 | 2015 KENWORTH T800 | vendu: 2025-11-03 | achat: 2025-09-25
  ('35086', '2025-09-25'),
  -- 34390 | 2016 MACK CXU613 | vendu: 2025-05-02 | achat: 2024-12-12
  ('34390', '2024-12-12'),
  -- 34687 | 2026 FREIGHTLINER M2 106 | vendu: 2026-04-28 | achat: 2026-04-23
  ('34687', '2026-04-23'),
  -- 32469 | 2022 KENWORTH T880 | vendu: 2026-01-27 | achat: 2023-05-23
  ('32469', '2023-05-23')
) AS c(stock_numero, date_achat)
WHERE v.stock_numero = c.stock_numero
  AND v.statut = 'vendu';

-- Résultat attendu : 76 lignes mises à jour

-- ── Vérification : camions vendus avec jours_inventaire ──────────
SELECT
  stock_numero,
  marque,
  modele,
  annee,
  date_achat,
  date_vente,
  (date_vente::date - date_achat::date) AS jours_inventaire
FROM prod_ventes
WHERE statut = 'vendu'
  AND date_achat IS NOT NULL
ORDER BY date_vente DESC
LIMIT 30;
