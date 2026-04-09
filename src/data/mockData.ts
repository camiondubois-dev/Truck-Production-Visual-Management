import { Item, StationProgress } from '../types/item.types';

// Toutes les stations possibles
export const TOUTES_STATIONS_COMMUNES = [
  { id: 'soudure-generale',     label: 'Soudure générale',      labelCourt: 'Soud. Gén.',  color: '#f97316', ordre: 0 },
  { id: 'sous-traitants',       label: 'Sous-traitants',        labelCourt: 'S-Trait.',    color: '#a855f7', ordre: 1 },
  { id: 'mecanique-moteur',     label: 'Mécanique moteur',      labelCourt: 'Méc. Mot.',   color: '#3b82f6', ordre: 2 },
  { id: 'mecanique-generale',   label: 'Mécanique générale',    labelCourt: 'Méc. Gén.',   color: '#3b82f6', ordre: 3 },
  { id: 'soudure-specialisee',  label: 'Soudure camions à eau', labelCourt: 'Soud. Eau',   color: '#f97316', ordre: 4 },
  { id: 'peinture',             label: 'Peinture',              labelCourt: 'Peinture',    color: '#6b7280', ordre: 5 },
  { id: 'mecanique-electrique', label: 'Mécanique électrique',  labelCourt: 'Méc. Élec.',  color: '#3b82f6', ordre: 6 },
  { id: 'livraison',            label: 'Livraison',             labelCourt: 'Livraison',   color: '#22c55e', ordre: 7 },
];

// Pipelines prédéfinis
export const PIPELINE_EAU_USAGE = [
  'soudure-generale', 'sous-traitants', 'mecanique-moteur',
  'mecanique-generale', 'soudure-specialisee', 'peinture',
  'mecanique-electrique', 'livraison',
];

export const PIPELINE_EAU_NEUF = [
  'soudure-specialisee', 'peinture',
  'mecanique-electrique', 'livraison',
];

export const PIPELINE_CLIENT_DEFAUT = [
  'mecanique-moteur', 'mecanique-electrique',
];

export const PIPELINE_DETAIL_DEFAUT = [
  'mecanique-moteur', 'mecanique-generale',
  'soudure-specialisee', 'mecanique-electrique',
];

// Helper pour créer une progression
function makeProgression(stationIds: string[], statusMap: Record<string, 'non-commence' | 'en-cours' | 'termine'> = {}): StationProgress[] {
  return stationIds.map(id => ({
    stationId: id,
    status: statusMap[id] ?? 'non-commence',
    subTasks: [],
  }));
}

export const MOCK_ITEMS: Item[] = [

  // ── CAMIONS À EAU ─────────────────────────────────────────

  {
    id: 'e1',
    type: 'eau',
    numero: '36012',
    label: 'Western Star 4700 2016',
    variante: 'Usagé',
    annee: 2016,
    marque: 'Western Star',
    modele: '4700',
    etat: 'en-slot',
    slotId: '17',
    stationActuelle: 'soudure-generale',
    dateCreation: '2026-03-14',
    stationsActives: PIPELINE_EAU_USAGE,
    progression: makeProgression(PIPELINE_EAU_USAGE, {
      'soudure-generale': 'en-cours',
    }),
  },

  {
    id: 'e2',
    type: 'eau',
    numero: '35743',
    label: 'Kenworth T880 2024',
    variante: 'Neuf',
    annee: 2024,
    marque: 'Kenworth',
    modele: 'T880',
    etat: 'en-slot',
    slotId: '5',
    stationActuelle: 'soudure-specialisee',
    dateCreation: '2026-03-20',
    stationsActives: PIPELINE_EAU_NEUF,
    progression: makeProgression(PIPELINE_EAU_NEUF, {
      'soudure-specialisee': 'en-cours',
    }),
  },

  {
    id: 'e3',
    type: 'eau',
    numero: '35500',
    label: 'Peterbilt 567 2019',
    variante: 'Usagé',
    annee: 2019,
    marque: 'Peterbilt',
    modele: '567',
    etat: 'en-slot',
    slotId: 'S-02',
    stationActuelle: 'sous-traitants',
    dateCreation: '2026-03-17',
    stationsActives: PIPELINE_EAU_USAGE,
    progression: makeProgression(PIPELINE_EAU_USAGE, {
      'soudure-generale': 'termine',
      'sous-traitants':   'en-cours',
    }),
  },

  {
    id: 'e4',
    type: 'eau',
    numero: '36100',
    label: 'Kenworth T-480 2026',
      etatCommercial: 'vendu' as const,      // ← ajouter
  clientAcheteur: 'Transport Tremblay',  // ← ajouter
    variante: 'Neuf',
    annee: 2026,
    marque: 'Kenworth',
    modele: 'T-480',
    etat: 'en-slot',
    slotId: '1',  
    stationActuelle: 'peinture',
    dateCreation: '2026-03-11',
    stationsActives: PIPELINE_EAU_NEUF,
    progression: makeProgression(PIPELINE_EAU_NEUF, {
      'soudure-specialisee': 'termine',
      'peinture':            'en-cours',
    }),
  },

  // ── CLIENTS EXTERNES ──────────────────────────────────────

  {
    id: 'c1',
    type: 'client',
    numero: '35088',
    label: 'Excavation Côté — Réparation transmission',
    nomClient: 'Excavation Côté',
    telephone: '418-555-5678',
    descriptionTravail: 'Réparation transmission',
    urgence: true,
    etat: 'en-attente',
    stationActuelle: 'mecanique-moteur',
    dernierGarageId: 'mecanique-moteur',
    dateCreation: '2026-04-01',
    stationsActives: ['mecanique-moteur', 'mecanique-electrique'],
    progression: makeProgression(['mecanique-moteur', 'mecanique-electrique']),
  },

  {
    id: 'c2',
    type: 'client',
    numero: '35201',
    label: 'Transport Tremblay — Freins',
    nomClient: 'Transport Tremblay',
    telephone: '418-555-0198',
    descriptionTravail: 'Remplacement système de freinage complet',
    urgence: false,
    etat: 'en-slot',
    slotId: '12',
    stationActuelle: 'mecanique-generale',
    dateCreation: '2026-04-02',
    stationsActives: ['mecanique-generale'],
    progression: makeProgression(['mecanique-generale'], {
      'mecanique-generale': 'en-cours',
    }),
  },

  // ── CAMIONS DÉTAIL ────────────────────────────────────────

  {
    id: 'd1',
    type: 'detail',
    numero: '34891',
    label: 'Freightliner M2 106 2019',
    annee: 2019,
    marque: 'Freightliner',
    modele: 'M2 106',
    etat: 'en-slot',
    slotId: '9A',
    stationActuelle: 'mecanique-moteur',
    dateCreation: '2026-03-25',
    stationsActives: PIPELINE_DETAIL_DEFAUT,
    progression: makeProgression(PIPELINE_DETAIL_DEFAUT, {
      'mecanique-moteur': 'en-cours',
    }),
  },

  {
    id: 'd2',
    type: 'detail',
    numero: '36201',
    label: 'Mack Granite 2017',
    annee: 2017,
    marque: 'Mack',
    modele: 'Granite',
    etat: 'en-attente',
    stationActuelle: 'mecanique-moteur',
    dernierGarageId: 'mecanique-moteur',
    dateCreation: '2026-03-22',
    stationsActives: PIPELINE_DETAIL_DEFAUT,
    progression: makeProgression(PIPELINE_DETAIL_DEFAUT),
  },
];
