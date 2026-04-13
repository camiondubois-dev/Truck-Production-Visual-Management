import type { Station } from '../types/item.types';

export const STATIONS: Station[] = [
  {
    id: 'soudure-generale',
    label: 'Soudure Générale',
    color: '#ff6b35',
    slots: [{ id: '17', label: '17' }],
    gridCols: 1,
  },
  {
    id: 'point-s',
    label: 'Point S',
    color: '#888888',
    slots: [{ id: '18', label: '18' }],
    gridCols: 1,
    optional: true,
  },
  {
    id: 'mecanique-generale',
    label: 'Mécanique Générale',
    color: '#4a9eff',
    slots: [
      { id: '9A', label: '9A' },
      { id: '10A', label: '10A' },
      { id: '9B', label: '9B' },
      { id: '10B', label: '10B' },
    ],
    gridCols: 2,
  },
  {
    id: 'mecanique-moteur',
    label: 'Mécanique Moteur / Électrique',
    color: '#4a9eff',
    slots: [
      { id: '11', label: '11' },
      { id: '12', label: '12' },
      { id: '13', label: '13' },
      { id: '16', label: '16' },
      { id: '15', label: '15' },
      { id: '14', label: '14' },
    ],
    gridCols: 3,
  },
  {
    id: 'sous-traitants',
    label: 'Sous-traitants',
    color: '#a855f7',
    slots: [
      { id: 'S-01', label: 'S-01' },
      { id: 'S-02', label: 'S-02' },
      { id: 'S-03', label: 'S-03' },
      { id: 'S-04', label: 'S-04' },
      { id: 'S-05', label: 'S-05' },
      { id: 'S-06', label: 'S-06' },
    ],
    gridCols: 2,
  },
  {
    id: 'soudure-specialisee',
    label: 'Soudure spécialisée',
    color: '#ff6b35',
    slots: [
      { id: '5', label: '5' },
      { id: '6', label: '6' },
      { id: '4', label: '4' },
      { id: '3', label: '3' },
    ],
    gridCols: 2,
  },
  {
    id: 'peinture',
    label: 'Peinture',
    color: '#94a3b8',
    slots: [
      { id: '7', label: '7 (futur)', futur: true },
      { id: '8', label: '8 (futur)', futur: true },
      { id: '2', label: '2' },
      { id: '1', label: '1' },
    ],
    gridCols: 2,
  },
];
