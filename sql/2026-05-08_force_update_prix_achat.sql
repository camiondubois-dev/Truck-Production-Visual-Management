-- ════════════════════════════════════════════════════════════════════
-- FORCE mise à jour prix_achat_reel + cout_mo depuis CSV final
-- Date : 2026-05-08
--
-- IMPORTANT : ce script ÉCRASE prix_achat_reel même s'il était déjà
-- rempli (l'ancien fichier CSV avait un CASE WHEN qui empêchait
-- l'écrasement, donc les vieilles valeurs erronées (= total) sont
-- restées en DB).
--
-- Définitions :
--   prix_achat_reel = prix payé pour acheter le camion
--   cout_mo         = main-d'œuvre + pièces accumulées
--   total investi   = prix_achat_reel + cout_mo (calculé côté front)
--
-- Cible : statut = 'inventaire' uniquement
-- ════════════════════════════════════════════════════════════════════

UPDATE prod_ventes SET prix_achat_reel = 30000.00,    cout_mo = 18187.93  WHERE stock_numero = '31236' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 140703.00,   cout_mo = 62671.97  WHERE stock_numero = '31480' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 8000.00,     cout_mo = 21893.78  WHERE stock_numero = '31617' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 51441.50,    cout_mo = 8084.18   WHERE stock_numero = '31741' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 20815.00,    cout_mo = 4356.70   WHERE stock_numero = '32245' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 23315.00,    cout_mo = 3837.84   WHERE stock_numero = '32329' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 95753.00,    cout_mo = 30919.06  WHERE stock_numero = '32333' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 150000.00,   cout_mo = 22981.53  WHERE stock_numero = '32365' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 178928.00,   cout_mo = 67448.78  WHERE stock_numero = '32534' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 50000.00,    cout_mo = 13313.63  WHERE stock_numero = '32847' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 210000.00,   cout_mo = 8308.60   WHERE stock_numero = '32864' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 6440.00,     cout_mo = 33769.15  WHERE stock_numero = '33239' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 19315.00,    cout_mo = 11209.79  WHERE stock_numero = '33256' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 36000.00,    cout_mo = 5530.38   WHERE stock_numero = '33280' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 177000.00,   cout_mo = 15025.84  WHERE stock_numero = '33330' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 7000.00,     cout_mo = NULL      WHERE stock_numero = '33334' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 128753.00,   cout_mo = 38567.90  WHERE stock_numero = '33464' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 38909.50,    cout_mo = 10747.15  WHERE stock_numero = '33491' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 125000.00,   cout_mo = 10323.02  WHERE stock_numero = '33683' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 156253.00,   cout_mo = 6913.75   WHERE stock_numero = '33977' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 12000.00,    cout_mo = 6497.97   WHERE stock_numero = '33989' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 32650.00,    cout_mo = 20069.12  WHERE stock_numero = '34019' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 90000.00,    cout_mo = 24641.01  WHERE stock_numero = '34112' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 2500.00,     cout_mo = NULL      WHERE stock_numero = '34171' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 3000.00,     cout_mo = 854.57    WHERE stock_numero = '34180' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 4000.00,     cout_mo = 4246.65   WHERE stock_numero = '34189' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 34715.50,    cout_mo = 11976.86  WHERE stock_numero = '34262' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 165000.00,   cout_mo = 24216.62  WHERE stock_numero = '34282' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 12000.00,    cout_mo = 94467.28  WHERE stock_numero = '34302' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 23315.00,    cout_mo = NULL      WHERE stock_numero = '34402' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 81468.00,    cout_mo = 13127.23  WHERE stock_numero = '34537' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 81468.00,    cout_mo = 80569.20  WHERE stock_numero = '34538' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 31615.00,    cout_mo = 43471.85  WHERE stock_numero = '34548' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 225113.00,   cout_mo = 84120.30  WHERE stock_numero = '34569' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 86017.79,    cout_mo = 14566.30  WHERE stock_numero = '34575' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 180687.00,   cout_mo = 77599.50  WHERE stock_numero = '34584' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 180687.00,   cout_mo = 64957.68  WHERE stock_numero = '34585' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 51115.00,    cout_mo = 12812.96  WHERE stock_numero = '34639' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 132500.00,   cout_mo = 21940.73  WHERE stock_numero = '34728' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 132500.00,   cout_mo = 22073.40  WHERE stock_numero = '34734' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 180000.00,   cout_mo = 10546.62  WHERE stock_numero = '34738' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 39615.00,    cout_mo = 31458.72  WHERE stock_numero = '34744' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = NULL,        cout_mo = 72958.14  WHERE stock_numero = '34750' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 1.00,        cout_mo = 560.55    WHERE stock_numero = '34753' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 30526.00,    cout_mo = 58367.59  WHERE stock_numero = '34790' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 31250.00,    cout_mo = 19779.78  WHERE stock_numero = '34810' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 30615.00,    cout_mo = 14484.61  WHERE stock_numero = '34815' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 31615.00,    cout_mo = 11412.31  WHERE stock_numero = '34816' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 31250.00,    cout_mo = 31046.60  WHERE stock_numero = '34818' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 73615.00,    cout_mo = 5623.63   WHERE stock_numero = '34823' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = NULL,        cout_mo = NULL      WHERE stock_numero = '34828' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 52615.00,    cout_mo = 25912.47  WHERE stock_numero = '34832' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 1.00,        cout_mo = 152.10    WHERE stock_numero = '34848' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 39615.00,    cout_mo = 7803.54   WHERE stock_numero = '34851' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 56000.00,    cout_mo = 6330.10   WHERE stock_numero = '34955' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 25965.00,    cout_mo = 77158.20  WHERE stock_numero = '34964' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 23215.00,    cout_mo = 9365.89   WHERE stock_numero = '34965' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 29615.00,    cout_mo = 102287.72 WHERE stock_numero = '34981' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 30000.00,    cout_mo = 78835.27  WHERE stock_numero = '34995' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 59965.00,    cout_mo = 26225.23  WHERE stock_numero = '35003' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 47500.00,    cout_mo = 89069.48  WHERE stock_numero = '35035' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 47500.00,    cout_mo = 81725.06  WHERE stock_numero = '35040' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 90865.00,    cout_mo = 41090.73  WHERE stock_numero = '35107' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 6000.00,     cout_mo = 102906.13 WHERE stock_numero = '35117' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 30000.00,    cout_mo = 13536.41  WHERE stock_numero = '35131' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 25000.00,    cout_mo = 14633.70  WHERE stock_numero = '35144' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 65000.00,    cout_mo = 16184.66  WHERE stock_numero = '35192' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 50000.00,    cout_mo = 4526.21   WHERE stock_numero = '35274' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 92539.00,    cout_mo = 23777.06  WHERE stock_numero = '35282' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 22308.79,    cout_mo = 9321.37   WHERE stock_numero = '35330' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 76765.00,    cout_mo = 142827.24 WHERE stock_numero = '35372' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 11665.00,    cout_mo = 5012.24   WHERE stock_numero = '35373' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 85865.00,    cout_mo = 15109.58  WHERE stock_numero = '35374' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 1.00,        cout_mo = 65862.11  WHERE stock_numero = '35391' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 174234.00,   cout_mo = 62373.10  WHERE stock_numero = '35398' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 1.00,        cout_mo = 62147.97  WHERE stock_numero = '35405' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 1.00,        cout_mo = 62271.83  WHERE stock_numero = '35406' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 1.00,        cout_mo = 65938.86  WHERE stock_numero = '35407' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 13019.00,    cout_mo = 23286.93  WHERE stock_numero = '35435' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 1.00,        cout_mo = 66844.03  WHERE stock_numero = '35443' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 50000.00,    cout_mo = 24075.45  WHERE stock_numero = '35468' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 50000.00,    cout_mo = 17698.48  WHERE stock_numero = '35469' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 110000.00,   cout_mo = 43024.83  WHERE stock_numero = '35470' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 6440.00,     cout_mo = 641.89    WHERE stock_numero = '35490' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 20000.00,    cout_mo = 23994.18  WHERE stock_numero = '35517' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 5550.00,     cout_mo = 36127.05  WHERE stock_numero = '35518' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 7921.55,     cout_mo = 37803.53  WHERE stock_numero = '35519' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 27000.00,    cout_mo = 9479.42   WHERE stock_numero = '35526' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 21520.00,    cout_mo = 5834.88   WHERE stock_numero = '35532' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 21520.00,    cout_mo = 12877.17  WHERE stock_numero = '35535' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 21520.00,    cout_mo = 4953.59   WHERE stock_numero = '35536' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 170000.00,   cout_mo = 8741.34   WHERE stock_numero = '35541' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 61015.00,    cout_mo = 9165.42   WHERE stock_numero = '35557' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 80865.00,    cout_mo = 3791.61   WHERE stock_numero = '35558' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 50491.00,    cout_mo = 15412.58  WHERE stock_numero = '35559' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 47124.81,    cout_mo = 11680.03  WHERE stock_numero = '35578' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 42615.00,    cout_mo = 8423.95   WHERE stock_numero = '35583' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 21000.00,    cout_mo = NULL      WHERE stock_numero = '35585' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 200000.00,   cout_mo = 1357.62   WHERE stock_numero = '35613' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 50000.00,    cout_mo = NULL      WHERE stock_numero = '35615' AND statut = 'inventaire';
UPDATE prod_ventes SET prix_achat_reel = 60000.00,    cout_mo = NULL      WHERE stock_numero = '35622' AND statut = 'inventaire';

-- Vérification
SELECT stock_numero,
       prix_achat_reel,
       cout_mo,
       (COALESCE(prix_achat_reel, 0) + COALESCE(cout_mo, 0)) AS total_calcule
  FROM prod_ventes
 WHERE statut = 'inventaire'
 ORDER BY stock_numero;
