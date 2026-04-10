// Checklist pré-production partagée entre VueInventaire et VueTerrain
export const CHECKLIST_STATIONS = [
  { id: 'soudure-generale',    label: 'Soudure générale',    icon: '🔧', color: '#ff6b35' },
  { id: 'mecanique-generale',  label: 'Mécanique générale',  icon: '⚙️', color: '#4a9eff' },
  { id: 'mecanique-moteur',    label: 'Mécanique moteur',    icon: '🔩', color: '#4a9eff' },
  { id: 'soudure-specialisee', label: 'Soudure spécialisée', icon: '⚡', color: '#ff6b35' },
  { id: 'mecanique-electrique', label: 'Mécanique électrique', icon: '💡', color: '#f59e0b' },
  { id: 'peinture',            label: 'Peinture',            icon: '🎨', color: '#94a3b8' },
];

export const RETOUCHE_ID    = 'besoin-retouche';
export const RETOUCHE_LABEL = 'Besoin de retouche';

export const ROAD_MAP_STATIONS = [
  { id: 'soudure-generale',    label: 'Soudure générale',    icon: '🔧', color: '#f97316' },
  { id: 'mecanique-generale',  label: 'Mécanique générale',  icon: '⚙️', color: '#3b82f6' },
  { id: 'mecanique-moteur',    label: 'Mécanique moteur',    icon: '🔩', color: '#3b82f6' },
  { id: 'mecanique-electrique',label: 'Mécanique électrique',icon: '💡', color: '#3b82f6' },
  { id: 'soudure-specialisee', label: 'Soudure spécialisée', icon: '⚡', color: '#f97316' },
  { id: 'peinture',            label: 'Peinture',            icon: '🎨', color: '#6b7280' },
  { id: 'sous-traitants',      label: 'Sous-traitants',      icon: '🏭', color: '#a855f7', hasDescription: true },
] as const;

export type RoadMapStationId = typeof ROAD_MAP_STATIONS[number]['id'];
