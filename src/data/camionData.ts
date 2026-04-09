export const MARQUES_CAMIONS: Record<string, string[]> = {
  'Kenworth': [
    'T170', 'T270', 'T370', 'T440', 'T470', 'T480', 'T540',
    'T680', 'T800', 'T880', 'W900', 'W990', 'C500', 'K100',
  ],
  'Peterbilt': [
    '220', '320', '325', '337', '348', '365', '367', '379',
    '384', '386', '389', '520', '536', '537', '548', '567', '579', '589',
  ],
  'Freightliner': [
    '108SD', '114SD', '122SD', 'Cascadia', 'Columbia', 'Classic XL',
    'Coronado', 'M2 106', 'M2 112', 'MT45', 'MT55', 'Severe Duty',
  ],
  'Mack': [
    'Anthem', 'Granite', 'LR', 'MD6', 'MD7', 'Pinnacle',
    'TerraPro', 'Titan', 'Ultra-Liner',
  ],
  'International': [
    'HV', 'HX', 'LT', 'MV', 'RH', 'CV',
    'Durastar', 'Lonestar', 'Prostar', 'Transtar', 'Workstar',
  ],
  'Volvo': [
    'FH', 'FM', 'FMX', 'VHD', 'VNL 300', 'VNL 400',
    'VNL 600', 'VNL 760', 'VNL 860', 'VNR 300', 'VNR 400',
  ],
  'Western Star': [
    '4700', '4800', '4900', '5700XE', '6900',
    '47X', '49X', '57X', '6900XD',
  ],
  'Ford': [
    'F-650', 'F-750', 'F-800', 'LN', 'LT', 'Louisville',
  ],
  'GMC': [
    'C4500', 'C5500', 'C6500', 'C7500', 'C8500', 'TopKick',
  ],
  'RAM': [
    '3500', '4500', '5500', 'ProMaster',
  ],
  'Sterling': [
    'A9500', 'A9513', 'AT9522', 'L7500', 'L8500', 'L9500', 'LT9500',
  ],
  'Hino': [
    '145', '155', '155h', '165', '185', '195',
    '258', '268', '268A', '338',
  ],
  'Isuzu': [
    'NQR', 'NPR', 'NPR-HD', 'NRR', 'FTR', 'FVR', 'FXR',
  ],
  'UD Trucks': [
    'Condor', 'Quon', 'Croner',
  ],
};

export const MARQUES_LISTE = Object.keys(MARQUES_CAMIONS).sort();

const anneeActuelle = new Date().getFullYear();
export const ANNEES_LISTE: number[] = Array.from(
  { length: anneeActuelle - 1990 + 2 },
  (_, i) => anneeActuelle + 1 - i
);
