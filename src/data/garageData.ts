import type { Item, GarageColonne, TypeItem } from '../types/item.types';

// ── GARAGES / COLONNES ────────────────────────────────────────

export const GARAGES_COLONNES: GarageColonne[] = [
  { id: 'soudure-generale',     label: 'Soudure générale',      labelCourt: 'Soud. Gén.',  color: '#f97316' },
  { id: 'sous-traitants',       label: 'Sous-traitants',        labelCourt: 'S-Trait.',    color: '#a855f7' },
  { id: 'mecanique-moteur',     label: 'Mécanique moteur',      labelCourt: 'Méc. Mot.',   color: '#3b82f6' },
  { id: 'mecanique-generale',   label: 'Mécanique générale',    labelCourt: 'Méc. Gén.',   color: '#3b82f6' },
  { id: 'soudure-specialisee',  label: 'Soudure camions à eau', labelCourt: 'Soud. Eau',   color: '#f97316' },
  { id: 'peinture',             label: 'Peinture',              labelCourt: 'Peinture',    color: '#6b7280' },
  { id: 'mecanique-electrique', label: 'Mécanique électrique',  labelCourt: 'Méc. Élec.',  color: '#3b82f6' },
];

export const GARAGES_DEFAUT: Record<TypeItem, string[]> = {
  'eau':    [],
  'detail': ['mecanique-moteur', 'mecanique-generale', 'soudure-specialisee', 'mecanique-electrique'],
  'client': ['mecanique-moteur', 'mecanique-electrique'],
};

// Stations road_map correspondant à chaque garage physique (PlancherView)
// mecanique-moteur inclut mecanique-electrique (même espace physique)
export const GARAGE_TO_ROAD_MAP_STATIONS: Record<string, string[]> = {
  'soudure-generale':    ['soudure-generale'],
  'point-s':             [],
  'mecanique-generale':  ['mecanique-generale'],
  'mecanique-moteur':    ['mecanique-moteur', 'mecanique-electrique'],
  'mecanique-electrique':['mecanique-electrique'],
  'sous-traitants':      ['sous-traitants'],
  'soudure-specialisee': ['soudure-specialisee'],
  'peinture':            ['peinture'],
};

// ── MAPPING GARAGE ↔ SLOTS ────────────────────────────────────

export const GARAGE_TO_SLOTS: Record<string, string[]> = {
  'soudure-generale':    ['17'],
  'point-s':             ['18'],
  'mecanique-generale':  ['9A', '9B', '10A', '10B'],
  'mecanique-moteur':    ['11', '12', '13', '14', '15', '16'],
  'mecanique-electrique':['11', '12', '13', '14', '15', '16'],
  'sous-traitants':      ['S-01', 'S-02', 'S-03', 'S-04', 'S-05', 'S-06'],
  'soudure-specialisee': ['3', '4', '5', '6'],
  'peinture':            ['1', '2', '7', '8'],
};

export const SLOT_TO_GARAGE: Record<string, string> = {
  '17':   'soudure-generale',
  '18':   'point-s',
  '9A':   'mecanique-generale',
  '9B':   'mecanique-generale',
  '10A':  'mecanique-generale',
  '10B':  'mecanique-generale',
  '11':   'mecanique-moteur',
  '12':   'mecanique-moteur',
  '13':   'mecanique-moteur',
  '14':   'mecanique-moteur',
  '15':   'mecanique-moteur',
  '16':   'mecanique-moteur',
  'S-01': 'sous-traitants',
  'S-02': 'sous-traitants',
  'S-03': 'sous-traitants',
  'S-04': 'sous-traitants',
  'S-05': 'sous-traitants',
  'S-06': 'sous-traitants',
  '3':    'soudure-specialisee',
  '4':    'soudure-specialisee',
  '5':    'soudure-specialisee',
  '6':    'soudure-specialisee',
  '1':    'peinture',
  '2':    'peinture',
  '7':    'peinture',
  '8':    'peinture',
};

// ── MAPPING STATION → GARAGE ──────────────────────────────────
// Quelle station physique correspond à quel garage

export const STATION_TO_GARAGE: Record<string, string> = {
  'soudure-generale':     'soudure-generale',
  'sous-traitants':       'sous-traitants',
  'mecanique-moteur':     'mecanique-moteur',
  'mecanique-electrique': 'mecanique-moteur',
  'mecanique-generale':   'mecanique-generale',
  'soudure-specialisee':  'soudure-specialisee',
  'soudure-eau':          'soudure-specialisee',
  'peinture':             'peinture',
  'livraison':            'peinture',
  'test-final':           'peinture',
};

export const STATION_TO_SLOTS: Record<string, string[]> = {
  'soudure-generale':     ['17'],
  'sous-traitants':       ['S-01', 'S-02', 'S-03', 'S-04', 'S-05', 'S-06'],
  'mecanique-moteur':     ['11', '12', '13', '14', '15', '16'],
  'mecanique-electrique': ['11', '12', '13', '14', '15', '16'],
  'mecanique-generale':   ['9A', '9B', '10A', '10B'],
  'soudure-specialisee':  ['3', '4', '5', '6'],
  'soudure-eau':          ['3', '4', '5', '6'],
  'peinture':             ['1', '2', '7', '8'],
  'livraison':            [],
  'test-final':           ['1', '2', '7', '8'],
};

export const STATION_LABEL: Record<string, string> = {
  'soudure-generale':     'Soudure générale',
  'sous-traitants':       'Sous-traitants',
  'mecanique-moteur':     'Mécanique moteur',
  'mecanique-electrique': 'Mécanique électrique',
  'mecanique-generale':   'Mécanique générale',
  'soudure-specialisee':  'Soudure camions à eau',
  'soudure-eau':          'Soudure camions à eau',
  'peinture':             'Peinture',
  'livraison':            'Livraison',
  'test-final':           'Test final',
};

// ── STRUCTURE PHYSIQUE DES GARAGES (pour PlancherView) ────────

export const STATIONS: {
  id: string;
  label: string;
  color: string;
  gridCols: number;
  optional?: boolean;
  slots: { id: string; futur?: boolean }[];
}[] = [
  {
    id: 'soudure-generale',
    label: 'Soudure Générale',
    color: '#f97316',
    gridCols: 1,
    slots: [{ id: '17' }],
  },
  {
    id: 'point-s',
    label: 'Point S',
    color: '#888888',
    gridCols: 1,
    optional: true,
    slots: [{ id: '18' }],
  },
  {
    id: 'mecanique-generale',
    label: 'Mécanique Générale',
    color: '#3b82f6',
    gridCols: 2,
    slots: [
      { id: '9A' }, { id: '10A' },
      { id: '9B' }, { id: '10B' },
    ],
  },
  {
    id: 'mecanique-moteur',
    label: 'Mécanique Moteur / Électrique',
    color: '#3b82f6',
    gridCols: 3,
    slots: [
      { id: '11' }, { id: '12' }, { id: '13' },
      { id: '16' }, { id: '15' }, { id: '14' },
    ],
  },
  {
    id: 'sous-traitants',
    label: 'Sous-traitants',
    color: '#a855f7',
    gridCols: 2,
    slots: [
      { id: 'S-01' }, { id: 'S-02' },
      { id: 'S-03' }, { id: 'S-04' },
      { id: 'S-05' }, { id: 'S-06' },
    ],
  },
  {
    id: 'soudure-specialisee',
    label: 'Soudure Spécialisée Camions à Eau',
    color: '#f97316',
    gridCols: 2,
    slots: [
      { id: '5' }, { id: '6' },
      { id: '4' }, { id: '3' },
    ],
  },
  {
    id: 'peinture',
    label: 'Peinture',
    color: '#6b7280',
    gridCols: 2,
    slots: [
      { id: '7', futur: true }, { id: '8', futur: true },
      { id: '2' }, { id: '1' },
    ],
  },
];