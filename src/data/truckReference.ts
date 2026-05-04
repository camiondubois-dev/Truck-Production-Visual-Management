// ════════════════════════════════════════════════════════════════
// Référence trucks Nord-Américains
// Source : modèles courants encans / concessionnaires Canada/US
// Liste exhaustive — peut être étendue dynamiquement par un admin
// ════════════════════════════════════════════════════════════════

export interface TruckModele {
  modele: string;
  anneeMin: number;
  anneeMax?: number;       // undefined = encore en production
  type?: 'tracteur' | 'vocational' | 'medium' | 'light' | 'cabover' | 'yard-tractor' | 'specialise';
  notes?: string;
}

export const TRUCK_MARQUES = [
  'AUTOCAR',
  'CAPACITY',
  'CHEVROLET',
  'FORD',
  'FREIGHTLINER',
  'GMC',
  'HINO',
  'INTERNATIONAL',
  'ISUZU',
  'KENWORTH',
  'MACK',
  'MITSUBISHI FUSO',
  'OTTAWA',
  'PETERBILT',
  'STERLING',
  'VOLVO',
  'WESTERN STAR',
  'WHITE',
] as const;

export type TruckMarque = typeof TRUCK_MARQUES[number];

export const TRUCK_MODELES_BY_MARQUE: Record<TruckMarque, TruckModele[]> = {
  'KENWORTH': [
    { modele: 'T180',     anneeMin: 2021,                    type: 'medium' },
    { modele: 'T270',     anneeMin: 2008,                    type: 'medium' },
    { modele: 'T280',     anneeMin: 2021,                    type: 'medium' },
    { modele: 'T370',     anneeMin: 2008,                    type: 'medium' },
    { modele: 'T440',     anneeMin: 2008,                    type: 'medium' },
    { modele: 'T470',     anneeMin: 2010,                    type: 'medium' },
    { modele: 'T480',     anneeMin: 2010,                    type: 'medium' },
    { modele: 'T660',     anneeMin: 2007, anneeMax: 2014,    type: 'tracteur' },
    { modele: 'T680',     anneeMin: 2012,                    type: 'tracteur' },
    { modele: 'T800',     anneeMin: 1986, anneeMax: 2018,    type: 'tracteur' },
    { modele: 'T800 Heavy Hauler', anneeMin: 2000, anneeMax: 2015, type: 'vocational' },
    { modele: 'T880',     anneeMin: 2014,                    type: 'vocational' },
    { modele: 'T880S',    anneeMin: 2018,                    type: 'vocational' },
    { modele: 'W900',     anneeMin: 1961,                    type: 'tracteur', notes: 'Modèle iconique, plusieurs sous-variantes (S, B, L)' },
    { modele: 'W900B',    anneeMin: 1982,                    type: 'tracteur' },
    { modele: 'W900L',    anneeMin: 1991,                    type: 'tracteur' },
    { modele: 'W990',     anneeMin: 2018,                    type: 'tracteur' },
    { modele: 'C500',     anneeMin: 1974,                    type: 'vocational' },
    { modele: 'C520',     anneeMin: 2010,                    type: 'vocational' },
    { modele: 'K100',     anneeMin: 1963, anneeMax: 2003,    type: 'cabover' },
    { modele: 'K200',     anneeMin: 2008,                    type: 'cabover' },
  ],

  'PETERBILT': [
    { modele: '210',      anneeMin: 2021,                    type: 'medium' },
    { modele: '220',      anneeMin: 2009,                    type: 'cabover' },
    { modele: '337',      anneeMin: 2008,                    type: 'medium' },
    { modele: '348',      anneeMin: 2008,                    type: 'medium' },
    { modele: '357',      anneeMin: 1998, anneeMax: 2010,    type: 'vocational' },
    { modele: '365',      anneeMin: 2005,                    type: 'vocational' },
    { modele: '367',      anneeMin: 2007,                    type: 'vocational' },
    { modele: '378',      anneeMin: 1986, anneeMax: 2007,    type: 'tracteur' },
    { modele: '379',      anneeMin: 1987, anneeMax: 2007,    type: 'tracteur', notes: 'Modèle iconique, plusieurs configurations' },
    { modele: '386',      anneeMin: 2005, anneeMax: 2014,    type: 'tracteur' },
    { modele: '387',      anneeMin: 2000, anneeMax: 2010,    type: 'tracteur' },
    { modele: '388',      anneeMin: 2007,                    type: 'tracteur' },
    { modele: '389',      anneeMin: 2007,                    type: 'tracteur' },
    { modele: '520',      anneeMin: 2015,                    type: 'cabover',     notes: 'Refuse / vocational' },
    { modele: '535',      anneeMin: 2018,                    type: 'specialise' },
    { modele: '567',      anneeMin: 2014,                    type: 'vocational' },
    { modele: '579',      anneeMin: 2012,                    type: 'tracteur' },
    { modele: '589',      anneeMin: 2024,                    type: 'tracteur',    notes: 'Successeur du 389' },
  ],

  'FREIGHTLINER': [
    { modele: 'Cascadia',      anneeMin: 2007,                type: 'tracteur', notes: 'Plusieurs générations (Cascadia, New Cascadia 2018+)' },
    { modele: 'Cascadia 113',  anneeMin: 2008,                type: 'tracteur' },
    { modele: 'Cascadia 116',  anneeMin: 2008,                type: 'tracteur' },
    { modele: 'Cascadia 125',  anneeMin: 2008,                type: 'tracteur' },
    { modele: 'Cascadia 126',  anneeMin: 2018,                type: 'tracteur' },
    { modele: 'Columbia',      anneeMin: 2001, anneeMax: 2014, type: 'tracteur' },
    { modele: 'Coronado',      anneeMin: 2001, anneeMax: 2018, type: 'tracteur' },
    { modele: 'Argosy',        anneeMin: 1998, anneeMax: 2006, type: 'cabover' },
    { modele: 'Century Class', anneeMin: 1996, anneeMax: 2007, type: 'tracteur' },
    { modele: 'Century Class S/T', anneeMin: 1996, anneeMax: 2007, type: 'tracteur' },
    { modele: 'Classic',       anneeMin: 1991, anneeMax: 2008, type: 'tracteur' },
    { modele: 'Classic XL',    anneeMin: 1995, anneeMax: 2009, type: 'tracteur' },
    { modele: 'M2 100',        anneeMin: 2003,                type: 'medium' },
    { modele: 'M2 106',        anneeMin: 2003,                type: 'medium' },
    { modele: 'M2 106 Plus',   anneeMin: 2020,                type: 'medium' },
    { modele: 'M2 112',        anneeMin: 2003,                type: 'medium' },
    { modele: 'M2 132 (XBR)',  anneeMin: 2020,                type: 'medium' },
    { modele: 'M2 132 (XBS)',  anneeMin: 2020,                type: 'medium' },
    { modele: '108SD',         anneeMin: 2010,                type: 'vocational' },
    { modele: '114SD',         anneeMin: 2010,                type: 'vocational' },
    { modele: '122SD',         anneeMin: 2010,                type: 'vocational' },
    { modele: 'FL50',          anneeMin: 1992, anneeMax: 2003, type: 'medium' },
    { modele: 'FL60',          anneeMin: 1992, anneeMax: 2003, type: 'medium' },
    { modele: 'FL70',          anneeMin: 1989, anneeMax: 2003, type: 'medium' },
    { modele: 'FL80',          anneeMin: 1989, anneeMax: 2003, type: 'medium' },
    { modele: 'FL106',         anneeMin: 1990, anneeMax: 2003, type: 'medium' },
    { modele: 'FL112',         anneeMin: 1990, anneeMax: 2003, type: 'medium' },
    { modele: 'FL120',         anneeMin: 1989, anneeMax: 2002, type: 'tracteur' },
    { modele: 'FLD112',        anneeMin: 1988, anneeMax: 2001, type: 'tracteur' },
    { modele: 'FLD120',        anneeMin: 1988, anneeMax: 2001, type: 'tracteur' },
    { modele: 'eCascadia',     anneeMin: 2022,                type: 'tracteur', notes: 'Électrique' },
    { modele: 'eM2 106',       anneeMin: 2022,                type: 'medium',   notes: 'Électrique' },
  ],

  'WESTERN STAR': [
    { modele: '4700SF',  anneeMin: 2010,                type: 'tracteur' },
    { modele: '4700SB',  anneeMin: 2010,                type: 'vocational' },
    { modele: '4800',    anneeMin: 2003, anneeMax: 2010, type: 'tracteur' },
    { modele: '4900',    anneeMin: 1991,                type: 'tracteur' },
    { modele: '4900EX',  anneeMin: 2007,                type: 'tracteur' },
    { modele: '4900FA',  anneeMin: 2007,                type: 'tracteur' },
    { modele: '4900SA',  anneeMin: 2007,                type: 'tracteur' },
    { modele: '4900SB',  anneeMin: 2007,                type: 'vocational' },
    { modele: '4900EX Constellation', anneeMin: 2010,   type: 'tracteur' },
    { modele: '5700XE',  anneeMin: 2014, anneeMax: 2020, type: 'tracteur' },
    { modele: '6900XD',  anneeMin: 2008,                type: 'specialise' },
    { modele: '47X',     anneeMin: 2020,                type: 'tracteur',  notes: 'Nouvelle génération' },
    { modele: '49X',     anneeMin: 2020,                type: 'vocational' },
    { modele: '57X',     anneeMin: 2021,                type: 'tracteur' },
    { modele: 'Legacy',  anneeMin: 2024,                type: 'tracteur',  notes: 'Héritier du 4900' },
  ],

  'MACK': [
    { modele: 'Anthem',        anneeMin: 2017,                type: 'tracteur' },
    { modele: 'Pinnacle',      anneeMin: 2006,                type: 'tracteur' },
    { modele: 'Pinnacle CHU',  anneeMin: 2008,                type: 'tracteur' },
    { modele: 'Pinnacle CXU',  anneeMin: 2008,                type: 'tracteur' },
    { modele: 'Granite',       anneeMin: 2002,                type: 'vocational' },
    { modele: 'Granite GU',    anneeMin: 2008,                type: 'vocational' },
    { modele: 'TerraPro',      anneeMin: 2005,                type: 'vocational' },
    { modele: 'LR',            anneeMin: 2015,                type: 'vocational',  notes: 'Refuse' },
    { modele: 'MRU',           anneeMin: 2005, anneeMax: 2018, type: 'vocational',  notes: 'Cabover refuse' },
    { modele: 'MR',            anneeMin: 1986, anneeMax: 2014, type: 'cabover',     notes: 'Refuse' },
    { modele: 'CHN',           anneeMin: 2008, anneeMax: 2017, type: 'vocational' },
    { modele: 'CHU',           anneeMin: 2008,                type: 'tracteur' },
    { modele: 'CXU',           anneeMin: 2008,                type: 'tracteur' },
    { modele: 'CV713',         anneeMin: 2002, anneeMax: 2008, type: 'vocational' },
    { modele: 'CL713',         anneeMin: 1996, anneeMax: 2009, type: 'vocational' },
    { modele: 'CL733',         anneeMin: 1996, anneeMax: 2009, type: 'vocational' },
    { modele: 'Vision',        anneeMin: 1996, anneeMax: 2005, type: 'tracteur' },
    { modele: 'CH',            anneeMin: 1988, anneeMax: 2002, type: 'tracteur' },
    { modele: 'MD6',           anneeMin: 2020,                type: 'medium' },
    { modele: 'MD7',           anneeMin: 2020,                type: 'medium' },
    { modele: 'TD',            anneeMin: 2024,                type: 'medium',     notes: 'Successeur MD' },
  ],

  'VOLVO': [
    { modele: 'VNL 300',       anneeMin: 1996,                type: 'tracteur' },
    { modele: 'VNL 400',       anneeMin: 1998, anneeMax: 2014, type: 'tracteur' },
    { modele: 'VNL 430',       anneeMin: 2014,                type: 'tracteur' },
    { modele: 'VNL 630',       anneeMin: 1996,                type: 'tracteur' },
    { modele: 'VNL 670',       anneeMin: 1996,                type: 'tracteur' },
    { modele: 'VNL 730',       anneeMin: 2014, anneeMax: 2018, type: 'tracteur' },
    { modele: 'VNL 740',       anneeMin: 2018,                type: 'tracteur' },
    { modele: 'VNL 760',       anneeMin: 2018,                type: 'tracteur' },
    { modele: 'VNL 780',       anneeMin: 1996,                type: 'tracteur' },
    { modele: 'VNL 860',       anneeMin: 2018,                type: 'tracteur' },
    { modele: 'VNR 300',       anneeMin: 2017,                type: 'tracteur' },
    { modele: 'VNR 400',       anneeMin: 2017,                type: 'tracteur' },
    { modele: 'VNR 640',       anneeMin: 2017,                type: 'tracteur' },
    { modele: 'VNR Electric',  anneeMin: 2020,                type: 'tracteur',  notes: 'Électrique' },
    { modele: 'VNX 300',       anneeMin: 2018,                type: 'tracteur',  notes: 'Heavy haul' },
    { modele: 'VNX 400',       anneeMin: 2018,                type: 'tracteur' },
    { modele: 'VNX 740',       anneeMin: 2018,                type: 'tracteur' },
    { modele: 'VHD',           anneeMin: 2003,                type: 'vocational' },
    { modele: 'VHD 200',       anneeMin: 2003,                type: 'vocational' },
    { modele: 'VHD 300',       anneeMin: 2003,                type: 'vocational' },
    { modele: 'VHD 400',       anneeMin: 2003,                type: 'vocational' },
    { modele: 'VHD 600',       anneeMin: 2003,                type: 'vocational' },
    { modele: 'VAH 200',       anneeMin: 2018,                type: 'specialise', notes: 'Auto Hauler' },
    { modele: 'VAH 300',       anneeMin: 2018,                type: 'specialise' },
    { modele: 'VT800',         anneeMin: 2003, anneeMax: 2008, type: 'tracteur' },
    { modele: 'VT880',         anneeMin: 2007, anneeMax: 2010, type: 'tracteur' },
  ],

  'INTERNATIONAL': [
    { modele: 'LT',            anneeMin: 2018,                type: 'tracteur' },
    { modele: 'LT625',         anneeMin: 2018,                type: 'tracteur' },
    { modele: 'LoneStar',      anneeMin: 2008,                type: 'tracteur' },
    { modele: 'ProStar',       anneeMin: 2007, anneeMax: 2017, type: 'tracteur' },
    { modele: 'ProStar+ 122',  anneeMin: 2010, anneeMax: 2017, type: 'tracteur' },
    { modele: 'ProStar+ ES',   anneeMin: 2010, anneeMax: 2017, type: 'tracteur' },
    { modele: '9200i',         anneeMin: 2002, anneeMax: 2014, type: 'tracteur' },
    { modele: '9400i',         anneeMin: 2002, anneeMax: 2010, type: 'tracteur' },
    { modele: '9900i',         anneeMin: 2002, anneeMax: 2014, type: 'tracteur' },
    { modele: '9900ix',        anneeMin: 2007, anneeMax: 2014, type: 'tracteur' },
    { modele: 'HX 515',        anneeMin: 2016,                type: 'vocational' },
    { modele: 'HX 520',        anneeMin: 2016,                type: 'vocational' },
    { modele: 'HX 615',        anneeMin: 2016,                type: 'vocational' },
    { modele: 'HX 620',        anneeMin: 2016,                type: 'vocational' },
    { modele: 'HV 507',        anneeMin: 2018,                type: 'vocational' },
    { modele: 'HV 513',        anneeMin: 2018,                type: 'vocational' },
    { modele: 'HV 607',        anneeMin: 2018,                type: 'vocational' },
    { modele: 'HV 613',        anneeMin: 2018,                type: 'vocational' },
    { modele: 'WorkStar',      anneeMin: 2008, anneeMax: 2018, type: 'vocational' },
    { modele: 'WorkStar 7300', anneeMin: 2008, anneeMax: 2018, type: 'vocational' },
    { modele: 'WorkStar 7400', anneeMin: 2008, anneeMax: 2018, type: 'vocational' },
    { modele: 'WorkStar 7500', anneeMin: 2008, anneeMax: 2018, type: 'vocational' },
    { modele: 'WorkStar 7600', anneeMin: 2008, anneeMax: 2018, type: 'vocational' },
    { modele: 'WorkStar 7700', anneeMin: 2008, anneeMax: 2018, type: 'vocational' },
    { modele: 'DuraStar 4200', anneeMin: 2002, anneeMax: 2018, type: 'medium' },
    { modele: 'DuraStar 4300', anneeMin: 2002, anneeMax: 2018, type: 'medium' },
    { modele: 'DuraStar 4400', anneeMin: 2002, anneeMax: 2018, type: 'medium' },
    { modele: 'TerraStar',     anneeMin: 2010, anneeMax: 2017, type: 'light' },
    { modele: 'CV515',         anneeMin: 2018,                type: 'medium' },
    { modele: 'MV607',         anneeMin: 2018,                type: 'medium' },
    { modele: 'MV613',         anneeMin: 2018,                type: 'medium' },
    { modele: 'MV607 SBA',     anneeMin: 2018,                type: 'medium' },
    { modele: 'RH 613',        anneeMin: 2018,                type: 'tracteur' },
    { modele: 'CXT',           anneeMin: 2004, anneeMax: 2008, type: 'specialise' },
    { modele: 'TranStar 8500', anneeMin: 2002, anneeMax: 2014, type: 'tracteur' },
    { modele: 'TranStar 8600', anneeMin: 2002, anneeMax: 2014, type: 'tracteur' },
    { modele: 'DT530',         anneeMin: 1995, anneeMax: 2007, type: 'medium',     notes: 'Modèle motorisé sous nom commun' },
    { modele: 'eMV',           anneeMin: 2022,                type: 'medium',     notes: 'Électrique' },
  ],

  'FORD': [
    { modele: 'F-350 Super Duty', anneeMin: 1999,             type: 'light' },
    { modele: 'F-450 Super Duty', anneeMin: 1999,             type: 'light' },
    { modele: 'F-550 Super Duty', anneeMin: 2000,             type: 'medium' },
    { modele: 'F-600',         anneeMin: 2020,                type: 'medium' },
    { modele: 'F-650',         anneeMin: 2000,                type: 'medium' },
    { modele: 'F-750',         anneeMin: 2000,                type: 'medium' },
    { modele: 'L-Series (LT/LTL/LN)', anneeMin: 1970, anneeMax: 1998, type: 'tracteur' },
    { modele: 'LT9000',        anneeMin: 1990, anneeMax: 1998, type: 'tracteur' },
    { modele: 'LT9500',        anneeMin: 1990, anneeMax: 1998, type: 'tracteur' },
    { modele: 'LT8000',        anneeMin: 1990, anneeMax: 1998, type: 'medium' },
    { modele: 'LN8000',        anneeMin: 1990, anneeMax: 1998, type: 'medium' },
    { modele: 'Cargo',         anneeMin: 1986, anneeMax: 1998, type: 'cabover' },
    { modele: 'Aeromax',       anneeMin: 1988, anneeMax: 1998, type: 'tracteur' },
    { modele: 'LCF',           anneeMin: 2006, anneeMax: 2009, type: 'cabover' },
  ],

  'GMC': [
    { modele: 'C4500 TopKick', anneeMin: 2003, anneeMax: 2009, type: 'medium' },
    { modele: 'C5500 TopKick', anneeMin: 2003, anneeMax: 2009, type: 'medium' },
    { modele: 'C6500 TopKick', anneeMin: 2003, anneeMax: 2009, type: 'medium' },
    { modele: 'C7500 TopKick', anneeMin: 2003, anneeMax: 2009, type: 'medium' },
    { modele: 'C8500 TopKick', anneeMin: 2003, anneeMax: 2009, type: 'medium' },
    { modele: 'W3500',         anneeMin: 1991, anneeMax: 2009, type: 'cabover' },
    { modele: 'W4500',         anneeMin: 1991, anneeMax: 2009, type: 'cabover' },
    { modele: 'W5500',         anneeMin: 1991, anneeMax: 2009, type: 'cabover' },
    { modele: 'Sierra 3500HD', anneeMin: 2007,                type: 'light' },
    { modele: 'Sierra 4500HD', anneeMin: 2024,                type: 'medium' },
    { modele: 'Sierra 5500HD', anneeMin: 2024,                type: 'medium' },
    { modele: 'Sierra 6500HD', anneeMin: 2024,                type: 'medium' },
  ],

  'CHEVROLET': [
    { modele: 'Kodiak C4500',  anneeMin: 2003, anneeMax: 2009, type: 'medium' },
    { modele: 'Kodiak C5500',  anneeMin: 2003, anneeMax: 2009, type: 'medium' },
    { modele: 'Kodiak C6500',  anneeMin: 2003, anneeMax: 2009, type: 'medium' },
    { modele: 'Kodiak C7500',  anneeMin: 2003, anneeMax: 2009, type: 'medium' },
    { modele: 'Kodiak C8500',  anneeMin: 2003, anneeMax: 2009, type: 'medium' },
    { modele: 'Silverado 3500HD', anneeMin: 2007,             type: 'light' },
    { modele: 'Silverado 4500HD', anneeMin: 2019,             type: 'medium' },
    { modele: 'Silverado 5500HD', anneeMin: 2019,             type: 'medium' },
    { modele: 'Silverado 6500HD', anneeMin: 2019,             type: 'medium' },
    { modele: 'W3500',         anneeMin: 1991, anneeMax: 2009, type: 'cabover' },
    { modele: 'W4500',         anneeMin: 1991, anneeMax: 2009, type: 'cabover' },
    { modele: 'W5500',         anneeMin: 1991, anneeMax: 2009, type: 'cabover' },
  ],

  'HINO': [
    { modele: '155',           anneeMin: 2014, anneeMax: 2022, type: 'light' },
    { modele: '195',           anneeMin: 2014, anneeMax: 2022, type: 'light' },
    { modele: '238',           anneeMin: 2005, anneeMax: 2010, type: 'medium' },
    { modele: '258',           anneeMin: 2005, anneeMax: 2010, type: 'medium' },
    { modele: '268',           anneeMin: 2005, anneeMax: 2022, type: 'medium' },
    { modele: '268A',          anneeMin: 2014, anneeMax: 2022, type: 'medium' },
    { modele: '338',           anneeMin: 2010, anneeMax: 2022, type: 'medium' },
    { modele: '358',           anneeMin: 2010, anneeMax: 2022, type: 'medium' },
    { modele: '195h',          anneeMin: 2010, anneeMax: 2022, type: 'light',     notes: 'Hybride' },
    { modele: 'L6',            anneeMin: 2020,                type: 'medium' },
    { modele: 'L7',            anneeMin: 2020,                type: 'medium' },
    { modele: 'XL7',           anneeMin: 2019,                type: 'medium' },
    { modele: 'XL8',           anneeMin: 2019,                type: 'medium' },
  ],

  'ISUZU': [
    { modele: 'NPR',           anneeMin: 1984,                type: 'cabover' },
    { modele: 'NPR-HD',        anneeMin: 2005,                type: 'cabover' },
    { modele: 'NPR-XD',        anneeMin: 2010,                type: 'cabover' },
    { modele: 'NQR',           anneeMin: 2005,                type: 'cabover' },
    { modele: 'NRR',           anneeMin: 2008,                type: 'cabover' },
    { modele: 'FTR',           anneeMin: 1999,                type: 'medium' },
    { modele: 'FVR',           anneeMin: 1999,                type: 'medium' },
    { modele: 'FXR',           anneeMin: 2014,                type: 'medium' },
    { modele: 'NPS (4x4)',     anneeMin: 2010,                type: 'specialise' },
  ],

  'MITSUBISHI FUSO': [
    { modele: 'FE',            anneeMin: 1985,                type: 'cabover' },
    { modele: 'FE125',         anneeMin: 2008,                type: 'cabover' },
    { modele: 'FE140',         anneeMin: 2008,                type: 'cabover' },
    { modele: 'FE160',         anneeMin: 2012,                type: 'cabover' },
    { modele: 'FE180',         anneeMin: 2012,                type: 'cabover' },
    { modele: 'FG (4x4)',      anneeMin: 1990,                type: 'specialise' },
    { modele: 'FK',            anneeMin: 1985, anneeMax: 2014, type: 'medium' },
    { modele: 'FM',            anneeMin: 1985, anneeMax: 2014, type: 'medium' },
    { modele: 'Canter',        anneeMin: 1985,                type: 'cabover' },
    { modele: 'eCanter',       anneeMin: 2020,                type: 'cabover',    notes: 'Électrique' },
  ],

  'CAPACITY': [
    { modele: 'TJ5000',        anneeMin: 1995,                type: 'yard-tractor' },
    { modele: 'TJ6000',        anneeMin: 1995,                type: 'yard-tractor' },
    { modele: 'TJ6500',        anneeMin: 2010,                type: 'yard-tractor' },
    { modele: 'TJ7000',        anneeMin: 1995,                type: 'yard-tractor' },
    { modele: 'TJ7500',        anneeMin: 2010,                type: 'yard-tractor' },
    { modele: 'TJ9000',        anneeMin: 2010,                type: 'yard-tractor' },
    { modele: 'TJ9500',        anneeMin: 2015,                type: 'yard-tractor' },
    { modele: 'Sabre 5',       anneeMin: 2018,                type: 'yard-tractor' },
  ],

  'OTTAWA': [
    { modele: 'T2',            anneeMin: 1985,                type: 'yard-tractor' },
    { modele: 'Commando',      anneeMin: 2010,                type: 'yard-tractor' },
    { modele: 'Yardmaster',    anneeMin: 1990, anneeMax: 2010, type: 'yard-tractor' },
    { modele: 'Tow Tractor',   anneeMin: 2018,                type: 'yard-tractor' },
  ],

  'AUTOCAR': [
    { modele: 'ACX',           anneeMin: 2003,                type: 'cabover',    notes: 'Refuse / vocational' },
    { modele: 'ACMD',          anneeMin: 2018,                type: 'medium' },
    { modele: 'ACTT',          anneeMin: 2020,                type: 'yard-tractor' },
    { modele: 'WX',            anneeMin: 2020,                type: 'cabover' },
    { modele: 'DC',            anneeMin: 2020,                type: 'cabover',    notes: 'Vocational classique' },
    { modele: 'AT',            anneeMin: 2003, anneeMax: 2018, type: 'tracteur',   notes: 'Tracteur conventionnel' },
    { modele: 'Xpeditor',      anneeMin: 1990, anneeMax: 2018, type: 'cabover',    notes: 'Refuse / vocational' },
  ],

  'STERLING': [
    { modele: 'A9500',         anneeMin: 1998, anneeMax: 2009, type: 'tracteur' },
    { modele: 'A9522',         anneeMin: 2003, anneeMax: 2009, type: 'tracteur' },
    { modele: 'L7500',         anneeMin: 1998, anneeMax: 2009, type: 'medium' },
    { modele: 'L8500',         anneeMin: 1998, anneeMax: 2009, type: 'medium' },
    { modele: 'L9500',         anneeMin: 1998, anneeMax: 2009, type: 'medium' },
    { modele: 'LT7500',        anneeMin: 2002, anneeMax: 2009, type: 'tracteur' },
    { modele: 'LT8500',        anneeMin: 2002, anneeMax: 2009, type: 'tracteur' },
    { modele: 'LT9500',        anneeMin: 2002, anneeMax: 2009, type: 'tracteur' },
    { modele: 'LT9513',        anneeMin: 2002, anneeMax: 2009, type: 'tracteur' },
    { modele: 'Acterra',       anneeMin: 1998, anneeMax: 2009, type: 'medium' },
    { modele: 'Bullet',        anneeMin: 2008, anneeMax: 2009, type: 'medium' },
    { modele: 'Set-Back / Set-Forward Heritage', anneeMin: 1998, anneeMax: 2009, type: 'tracteur' },
  ],

  'WHITE': [
    { modele: 'Road Boss',     anneeMin: 1980, anneeMax: 1990, type: 'tracteur' },
    { modele: 'Western Star (avant 1991)', anneeMin: 1980, anneeMax: 1990, type: 'tracteur' },
    { modele: 'GMC Road Boss', anneeMin: 1980, anneeMax: 1995, type: 'tracteur' },
    { modele: 'WG Series',     anneeMin: 1985, anneeMax: 1995, type: 'cabover' },
    { modele: 'WX Series',     anneeMin: 1985, anneeMax: 1995, type: 'tracteur' },
  ],
};

// ── Helpers ─────────────────────────────────────────────────

/** Retourne les modèles disponibles pour une marque et une année donnée. */
export function getModelesPour(marque: string, annee?: number): TruckModele[] {
  const models = TRUCK_MODELES_BY_MARQUE[marque as TruckMarque] ?? [];
  if (!annee) return models;
  return models.filter(m => annee >= m.anneeMin && (m.anneeMax === undefined || annee <= m.anneeMax));
}

/** Liste des années valides pour une marque (toutes les années où au moins un modèle existe). */
export function getAnneesPour(marque: string): number[] {
  const models = TRUCK_MODELES_BY_MARQUE[marque as TruckMarque] ?? [];
  if (models.length === 0) return [];
  const minYear = Math.min(...models.map(m => m.anneeMin));
  const maxYear = Math.max(...models.map(m => m.anneeMax ?? new Date().getFullYear() + 1));
  const years: number[] = [];
  for (let y = maxYear; y >= minYear; y--) years.push(y);
  return years;
}

// ── Specs techniques (dropdowns prédéfinis) ────────────────

export const ENGINE_MARQUES = ['CAT', 'CUMMINS', 'DETROIT', 'PACCAR', 'MACK', 'VOLVO', 'INTERNATIONAL', 'ISUZU', 'HINO', 'FORD', 'GM', 'AUTRE'] as const;

export const ENGINE_MODELES_BY_MARQUE: Record<string, string[]> = {
  'CAT':         ['3126', '3126E', '3306', '3406', '3406E', 'C7', 'C9', 'C10', 'C11', 'C12', 'C13', 'C15', 'C15 ACERT', 'C16', 'C18'],
  'CUMMINS':     ['B6.7', 'L9', 'L9N', 'X12', 'X15', 'ISB', 'ISC', 'ISL', 'ISL9', 'ISM', 'ISX', 'M11', 'N14', 'N14 CELECT', 'NTC400', 'Signature 600'],
  'DETROIT':     ['DD13', 'DD15', 'DD16', 'DD8', 'DD5', 'Series 60', 'Series 50', '6V92', '8V92', '8V71'],
  'PACCAR':      ['PX-6', 'PX-7', 'PX-8', 'PX-9', 'MX-11', 'MX-13'],
  'MACK':        ['MP7', 'MP8', 'MP10', 'E7', 'E-Tech', 'AC', 'CY'],
  'VOLVO':       ['D11', 'D13', 'D16', 'VED12', 'VED7', 'VEB7'],
  'INTERNATIONAL': ['DT360', 'DT466', 'DT530', 'DT570', 'A26', 'N9', 'N10', 'N13', 'MaxxForce 7', 'MaxxForce 11', 'MaxxForce 13', 'MaxxForce DT'],
  'ISUZU':       ['4HK1', '6HK1', '6HE1'],
  'HINO':        ['J05', 'J08', 'J05E', 'J08E', 'A09'],
  'FORD':        ['Power Stroke 6.7L', 'Power Stroke 6.0L', 'Power Stroke 7.3L', '7.8L', '6.8L V10', '7.5L V8'],
  'GM':          ['Duramax 6.6L', '8.1L Vortec', '6.0L Vortec', '4.3L V6'],
  'AUTRE':       [],
};

/** EPA / Tier — disponibles selon l'année. */
export const EPA_VALUES = ['EPA98', 'EPA02', 'EPA04', 'EPA07', 'EPA10', 'EPA13', 'EPA17', 'EPA21', 'EPA24', 'GHG14', 'GHG17', 'GHG21'] as const;

/** Transmissions — marques + modèles. */
export const TRANSMISSION_MARQUES = ['EATON', 'EATON-FULLER', 'ALLISON', 'VOLVO', 'MACK', 'PACCAR', 'INTERNATIONAL', 'AISIN', 'ZF', 'AUTRE'] as const;

export const TRANSMISSION_MODELES: Record<string, string[]> = {
  'EATON':         ['8-speed manual', '9-speed manual', '10-speed manual', 'RT-7608LL', 'RT-13609A', 'RT-14609B', 'UltraShift', 'UltraShift PLUS', 'UltraShift LSE', 'Endurant HD'],
  'EATON-FULLER':  ['RT-8908LL', 'RTLO-13610B', 'RTLO-14610B', 'RTLO-16713A', 'RTLO-18913B', 'RTLO-20918B', 'RTO-14908LL', 'FRO-16210B', 'RT-11609A'],
  'ALLISON':       ['1000 Series', '2000 Series', '2100/2200', '2500', '3000 Series', '3500', '4000 Series', '4500', 'B Series', 'M Series', 'TC10'],
  'VOLVO':         ['I-Shift', 'I-Shift Dual Clutch', 'AT-2412', 'AT-2612', 'AT-2712'],
  'MACK':          ['mDrive', 'mDrive HD', 'T2050', 'T2070', 'T2080', 'T310', 'T313', 'T318'],
  'PACCAR':        ['TX-12', 'TX-18', 'TX-8', 'TR-9', 'PACCAR Automated'],
  'INTERNATIONAL': ['Eaton Procision', 'Manual', 'Automatic'],
  'AISIN':         ['A465', 'A460'],
  'ZF':            ['Powerline 8AP', 'TraXon', 'EcoSplit'],
  'AUTRE':         [],
};

export const TRANSMISSION_TYPES = ['Manuelle', 'Automatique', 'AMT (Automatisée)', 'Inconnu'] as const;

/** Différentiel / Ratio (les plus communs). */
export const DIFFERENTIEL_RATIOS = [
  '2.47', '2.64', '2.79', '2.93', '3.08', '3.21',
  '3.36', '3.42', '3.55', '3.58', '3.70', '3.73', '3.91',
  '4.10', '4.11', '4.30', '4.33', '4.56', '4.63', '4.78',
  '4.88', '5.13', '5.29', '5.38', '5.63', '5.86', '6.14', 'Autre',
] as const;

/** Suspensions arrière (les plus communes). */
export const SUSPENSIONS = [
  'Air ride',
  'Spring (lames)',
  'Walking beam',
  'Camelback',
  'Hendrickson Air',
  'Mack Camelback',
  'Reyco',
  'Neway',
  'Chalmers',
  'Autre',
] as const;

/** Configurations d'essieux. */
export const CONFIGS_ESSIEUX = [
  '4x2 (single)',
  '4x4 (single 4x4)',
  '6x2 (tandem, 1 motorisé)',
  '6x4 (tandem complet)',
  '6x6',
  '8x4 (tridem)',
  '8x6',
  '10x4',
  '10x6',
  'Tridem suiveur',
  'Tridem complet',
  'Autre',
] as const;

/** Types de cabine. */
export const TYPES_CABINE = [
  'Day cab',
  'Sleeper 36"',
  'Sleeper 48"',
  'Sleeper 60"',
  'Sleeper 72"',
  'Sleeper 86"',
  'Mid-roof',
  'High-roof',
  'Crew cab',
  'Cabover',
  'Autre',
] as const;

/** GVWR communs (en livres). */
export const GVWR_OPTIONS = [
  '< 14,000 lbs',
  '14,001 - 19,500 lbs (Class 4-5)',
  '19,501 - 26,000 lbs (Class 6)',
  '26,001 - 33,000 lbs (Class 7)',
  '33,001 - 60,000 lbs (Class 8)',
  '60,001 - 80,000 lbs (Class 8 Heavy)',
  '> 80,000 lbs',
  'Inconnu',
] as const;
