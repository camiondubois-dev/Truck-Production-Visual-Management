-- ════════════════════════════════════════════════════════════════════
-- Mise à jour prod_ventes depuis prod_ventes_rows final.csv
-- Date : 2026-05-08
-- Champs : prix_achat_reel, cout_mo, budget_restant
-- Règle  : prix_achat_reel = immuable (pas d'écrasement si déjà > 0)
--          cout_mo + budget_restant = toujours mis à jour
-- ════════════════════════════════════════════════════════════════════

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 39615.00 ELSE prix_achat_reel END,
       cout_mo = 31458.72,
       budget_restant = 71073.72
  WHERE stock_numero = '34744' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 90865.00 ELSE prix_achat_reel END,
       cout_mo = 41090.73,
       budget_restant = 131955.73
  WHERE stock_numero = '35107' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 177000.00 ELSE prix_achat_reel END,
       cout_mo = 15025.84,
       budget_restant = 192025.84
  WHERE stock_numero = '33330' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 1.00 ELSE prix_achat_reel END,
       cout_mo = 65938.86,
       budget_restant = 65939.86
  WHERE stock_numero = '35407' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 36000.00 ELSE prix_achat_reel END,
       cout_mo = 5530.38,
       budget_restant = 41530.38
  WHERE stock_numero = '33280' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 92539.00 ELSE prix_achat_reel END,
       cout_mo = 23777.06,
       budget_restant = 116316.06
  WHERE stock_numero = '35282' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 21520.00 ELSE prix_achat_reel END,
       cout_mo = 12877.17,
       budget_restant = 34397.17
  WHERE stock_numero = '35535' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 21520.00 ELSE prix_achat_reel END,
       cout_mo = 4953.59,
       budget_restant = 26473.59
  WHERE stock_numero = '35536' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 150000.00 ELSE prix_achat_reel END,
       cout_mo = 22981.53,
       budget_restant = 172981.53
  WHERE stock_numero = '32365' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 23315.00 ELSE prix_achat_reel END,
       cout_mo = 3837.84,
       budget_restant = 27152.84
  WHERE stock_numero = '32329' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 34715.50 ELSE prix_achat_reel END,
       cout_mo = 11976.86,
       budget_restant = 46692.36
  WHERE stock_numero = '34262' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 81468.00 ELSE prix_achat_reel END,
       cout_mo = 13127.23,
       budget_restant = 94595.23
  WHERE stock_numero = '34537' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 51115.00 ELSE prix_achat_reel END,
       cout_mo = 12812.96,
       budget_restant = 63927.96
  WHERE stock_numero = '34639' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 30615.00 ELSE prix_achat_reel END,
       cout_mo = 14484.61,
       budget_restant = 45099.61
  WHERE stock_numero = '34815' AND statut = 'inventaire';

UPDATE prod_ventes
   SET cout_mo = 41.60,
       budget_restant = 41.60
  WHERE stock_numero = '31198' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 29615.00 ELSE prix_achat_reel END,
       cout_mo = 102287.72,
       budget_restant = 131902.72
  WHERE stock_numero = '34981' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 85865.00 ELSE prix_achat_reel END,
       cout_mo = 15109.58,
       budget_restant = 100974.58
  WHERE stock_numero = '35374' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 47500.00 ELSE prix_achat_reel END,
       cout_mo = 89069.48,
       budget_restant = 136569.48
  WHERE stock_numero = '35035' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 2500.00 ELSE prix_achat_reel END,
       budget_restant = 2500.00
  WHERE stock_numero = '34171' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 51441.50 ELSE prix_achat_reel END,
       cout_mo = 8084.18,
       budget_restant = 59525.68
  WHERE stock_numero = '31741' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 50000.00 ELSE prix_achat_reel END,
       cout_mo = 13313.63,
       budget_restant = 63313.63
  WHERE stock_numero = '32847' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 110000.00 ELSE prix_achat_reel END,
       cout_mo = 43024.83,
       budget_restant = 153024.83
  WHERE stock_numero = '35470' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 132500.00 ELSE prix_achat_reel END,
       cout_mo = 21940.73,
       budget_restant = 154440.73
  WHERE stock_numero = '34728' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 128753.00 ELSE prix_achat_reel END,
       cout_mo = 38567.90,
       budget_restant = 167320.90
  WHERE stock_numero = '33464' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 6440.00 ELSE prix_achat_reel END,
       cout_mo = 641.89,
       budget_restant = 7081.89
  WHERE stock_numero = '35490' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 39615.00 ELSE prix_achat_reel END,
       cout_mo = 7803.54,
       budget_restant = 47418.54
  WHERE stock_numero = '34851' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 31615.00 ELSE prix_achat_reel END,
       cout_mo = 43471.85,
       budget_restant = 75086.85
  WHERE stock_numero = '34548' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 21520.00 ELSE prix_achat_reel END,
       cout_mo = 5834.88,
       budget_restant = 27354.88
  WHERE stock_numero = '35532' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 174234.00 ELSE prix_achat_reel END,
       cout_mo = 62373.10,
       budget_restant = 236607.10
  WHERE stock_numero = '35398' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 95753.00 ELSE prix_achat_reel END,
       cout_mo = 30919.06,
       budget_restant = 126672.06
  WHERE stock_numero = '32333' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 65000.00 ELSE prix_achat_reel END,
       cout_mo = 16184.66,
       budget_restant = 81184.66
  WHERE stock_numero = '35192' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 27000.00 ELSE prix_achat_reel END,
       cout_mo = 9479.42,
       budget_restant = 36479.42
  WHERE stock_numero = '35526' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 22308.79 ELSE prix_achat_reel END,
       cout_mo = 9321.37,
       budget_restant = 31630.16
  WHERE stock_numero = '35330' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 81468.00 ELSE prix_achat_reel END,
       cout_mo = 80569.20,
       budget_restant = 162037.20
  WHERE stock_numero = '34538' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 156253.00 ELSE prix_achat_reel END,
       cout_mo = 6913.75,
       budget_restant = 163166.75
  WHERE stock_numero = '33977' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 210000.00 ELSE prix_achat_reel END,
       cout_mo = 8308.60,
       budget_restant = 218308.60
  WHERE stock_numero = '32864' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 73615.00 ELSE prix_achat_reel END,
       cout_mo = 5623.63,
       budget_restant = 79238.63
  WHERE stock_numero = '34823' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 1.00 ELSE prix_achat_reel END,
       cout_mo = 66844.03,
       budget_restant = 66845.03
  WHERE stock_numero = '35443' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 3000.00 ELSE prix_achat_reel END,
       cout_mo = 854.57,
       budget_restant = 3854.57
  WHERE stock_numero = '34180' AND statut = 'inventaire';

UPDATE prod_ventes
   SET cout_mo = 72958.14,
       budget_restant = 72958.14
  WHERE stock_numero = '34750' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 1.00 ELSE prix_achat_reel END,
       cout_mo = 62147.97,
       budget_restant = 62148.97
  WHERE stock_numero = '35405' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 50000.00 ELSE prix_achat_reel END,
       cout_mo = 4526.21,
       budget_restant = 54526.21
  WHERE stock_numero = '35274' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 1.00 ELSE prix_achat_reel END,
       cout_mo = 65862.11,
       budget_restant = 65863.11
  WHERE stock_numero = '35391' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 170000.00 ELSE prix_achat_reel END,
       cout_mo = 8741.34,
       budget_restant = 178741.34
  WHERE stock_numero = '35541' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 225113.00 ELSE prix_achat_reel END,
       cout_mo = 84120.30,
       budget_restant = 309233.30
  WHERE stock_numero = '34569' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 50491.00 ELSE prix_achat_reel END,
       cout_mo = 15412.58,
       budget_restant = 65903.58
  WHERE stock_numero = '35559' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 23315.00 ELSE prix_achat_reel END,
       budget_restant = 23315.00
  WHERE stock_numero = '34402' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 86017.79 ELSE prix_achat_reel END,
       cout_mo = 14566.30,
       budget_restant = 100584.09
  WHERE stock_numero = '34575' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 47124.81 ELSE prix_achat_reel END,
       cout_mo = 11680.03,
       budget_restant = 58804.84
  WHERE stock_numero = '35578' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 8000.00 ELSE prix_achat_reel END,
       cout_mo = 21893.78,
       budget_restant = 29893.78
  WHERE stock_numero = '31617' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 50000.00 ELSE prix_achat_reel END,
       cout_mo = 17698.48,
       budget_restant = 67698.48
  WHERE stock_numero = '35469' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 42615.00 ELSE prix_achat_reel END,
       cout_mo = 8423.95,
       budget_restant = 51038.95
  WHERE stock_numero = '35583' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 165000.00 ELSE prix_achat_reel END,
       cout_mo = 24216.62,
       budget_restant = 189216.62
  WHERE stock_numero = '34282' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 38909.50 ELSE prix_achat_reel END,
       cout_mo = 10747.15,
       budget_restant = 49656.65
  WHERE stock_numero = '33491' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 23215.00 ELSE prix_achat_reel END,
       cout_mo = 9365.89,
       budget_restant = 32580.89
  WHERE stock_numero = '34965' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 50000.00 ELSE prix_achat_reel END,
       cout_mo = 24075.45,
       budget_restant = 74075.45
  WHERE stock_numero = '35468' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 32650.00 ELSE prix_achat_reel END,
       cout_mo = 20069.12,
       budget_restant = 52719.12
  WHERE stock_numero = '34019' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 21000.00 ELSE prix_achat_reel END,
       budget_restant = 21000.00
  WHERE stock_numero = '35585' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 1.00 ELSE prix_achat_reel END,
       cout_mo = 152.10,
       budget_restant = 153.10
  WHERE stock_numero = '34848' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 76765.00 ELSE prix_achat_reel END,
       cout_mo = 142827.24,
       budget_restant = 219592.24
  WHERE stock_numero = '35372' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 178928.00 ELSE prix_achat_reel END,
       cout_mo = 67448.78,
       budget_restant = 246376.78
  WHERE stock_numero = '32534' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 31250.00 ELSE prix_achat_reel END,
       cout_mo = 31046.60,
       budget_restant = 62296.60
  WHERE stock_numero = '34818' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 61015.00 ELSE prix_achat_reel END,
       cout_mo = 9165.42,
       budget_restant = 70180.42
  WHERE stock_numero = '35557' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 19315.00 ELSE prix_achat_reel END,
       cout_mo = 11209.79,
       budget_restant = 30524.79
  WHERE stock_numero = '33256' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 6440.00 ELSE prix_achat_reel END,
       cout_mo = 33769.15,
       budget_restant = 40209.15
  WHERE stock_numero = '33239' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 125000.00 ELSE prix_achat_reel END,
       cout_mo = 10323.02,
       budget_restant = 135323.02
  WHERE stock_numero = '33683' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 4000.00 ELSE prix_achat_reel END,
       cout_mo = 4246.65,
       budget_restant = 8246.65
  WHERE stock_numero = '34189' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 140703.00 ELSE prix_achat_reel END,
       cout_mo = 62671.97,
       budget_restant = 203374.97
  WHERE stock_numero = '31480' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 31615.00 ELSE prix_achat_reel END,
       cout_mo = 11412.31,
       budget_restant = 43027.31
  WHERE stock_numero = '34816' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 30526.00 ELSE prix_achat_reel END,
       cout_mo = 58367.59,
       budget_restant = 88893.59
  WHERE stock_numero = '34790' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 132500.00 ELSE prix_achat_reel END,
       cout_mo = 22073.40,
       budget_restant = 154573.40
  WHERE stock_numero = '34734' AND statut = 'inventaire';

UPDATE prod_ventes
   SET cout_mo = 3134.71,
       budget_restant = 3134.71
  WHERE stock_numero = '22861' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 25965.00 ELSE prix_achat_reel END,
       cout_mo = 77158.20,
       budget_restant = 103123.20
  WHERE stock_numero = '34964' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 13019.00 ELSE prix_achat_reel END,
       cout_mo = 23286.93,
       budget_restant = 36305.93
  WHERE stock_numero = '35435' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 30000.00 ELSE prix_achat_reel END,
       cout_mo = 78835.27,
       budget_restant = 108835.27
  WHERE stock_numero = '34995' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 25000.00 ELSE prix_achat_reel END,
       cout_mo = 14633.70,
       budget_restant = 39633.70
  WHERE stock_numero = '35144' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 56000.00 ELSE prix_achat_reel END,
       cout_mo = 6330.10,
       budget_restant = 62330.10
  WHERE stock_numero = '34955' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 47500.00 ELSE prix_achat_reel END,
       cout_mo = 81725.06,
       budget_restant = 129225.06
  WHERE stock_numero = '35040' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 6000.00 ELSE prix_achat_reel END,
       cout_mo = 102906.13,
       budget_restant = 108906.13
  WHERE stock_numero = '35117' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 12000.00 ELSE prix_achat_reel END,
       cout_mo = 6497.97,
       budget_restant = 18497.97
  WHERE stock_numero = '33989' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 30000.00 ELSE prix_achat_reel END,
       cout_mo = 18187.93,
       budget_restant = 48187.93
  WHERE stock_numero = '31236' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 180687.00 ELSE prix_achat_reel END,
       cout_mo = 64957.68,
       budget_restant = 245644.68
  WHERE stock_numero = '34585' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 59965.00 ELSE prix_achat_reel END,
       cout_mo = 26225.23,
       budget_restant = 86190.23
  WHERE stock_numero = '35003' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 20000.00 ELSE prix_achat_reel END,
       cout_mo = 23994.18,
       budget_restant = 43994.18
  WHERE stock_numero = '35517' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 1.00 ELSE prix_achat_reel END,
       cout_mo = 62271.83,
       budget_restant = 62272.83
  WHERE stock_numero = '35406' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 52615.00 ELSE prix_achat_reel END,
       cout_mo = 25912.47,
       budget_restant = 78527.47
  WHERE stock_numero = '34832' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 60000.00 ELSE prix_achat_reel END,
       budget_restant = 60000.00
  WHERE stock_numero = '35622' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 90000.00 ELSE prix_achat_reel END,
       cout_mo = 24641.01,
       budget_restant = 114641.01
  WHERE stock_numero = '34112' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 1.00 ELSE prix_achat_reel END,
       cout_mo = 560.55,
       budget_restant = 561.55
  WHERE stock_numero = '34753' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 80865.00 ELSE prix_achat_reel END,
       cout_mo = 3791.61,
       budget_restant = 84656.61
  WHERE stock_numero = '35558' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 30000.00 ELSE prix_achat_reel END,
       cout_mo = 13536.41,
       budget_restant = 43536.41
  WHERE stock_numero = '35131' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 12000.00 ELSE prix_achat_reel END,
       cout_mo = 94467.28,
       budget_restant = 106467.28
  WHERE stock_numero = '34302' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 31250.00 ELSE prix_achat_reel END,
       cout_mo = 19779.78,
       budget_restant = 51029.78
  WHERE stock_numero = '34810' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 200000.00 ELSE prix_achat_reel END,
       cout_mo = 1357.62,
       budget_restant = 201357.62
  WHERE stock_numero = '35613' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 20815.00 ELSE prix_achat_reel END,
       cout_mo = 4356.70,
       budget_restant = 25171.70
  WHERE stock_numero = '32245' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 5550.00 ELSE prix_achat_reel END,
       cout_mo = 36127.05,
       budget_restant = 41677.05
  WHERE stock_numero = '35518' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 7000.00 ELSE prix_achat_reel END,
       budget_restant = 7000.00
  WHERE stock_numero = '33334' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 11665.00 ELSE prix_achat_reel END,
       cout_mo = 5012.24,
       budget_restant = 16677.24
  WHERE stock_numero = '35373' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 50000.00 ELSE prix_achat_reel END,
       budget_restant = 50000.00
  WHERE stock_numero = '35615' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 180687.00 ELSE prix_achat_reel END,
       cout_mo = 77599.50,
       budget_restant = 258286.50
  WHERE stock_numero = '34584' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 180000.00 ELSE prix_achat_reel END,
       cout_mo = 10546.62,
       budget_restant = 190546.62
  WHERE stock_numero = '34738' AND statut = 'inventaire';

UPDATE prod_ventes
   SET prix_achat_reel = CASE WHEN (prix_achat_reel IS NULL OR prix_achat_reel = 0) THEN 7921.55 ELSE prix_achat_reel END,
       cout_mo = 37803.53,
       budget_restant = 45725.08
  WHERE stock_numero = '35519' AND statut = 'inventaire';

-- 102 lignes générées
