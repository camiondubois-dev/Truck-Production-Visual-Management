import type { StationProgress } from './progression.types';

export type TypeOccupant = 'eau' | 'client' | 'detail';

export type StatutSimple = 'en-travail' | 'attente' | 'pret' | 'bloque';

export interface OccupantSlot {
  id: string;
  type: TypeOccupant;
  slotId: string;
  numero: string;
  label: string;
  statut: StatutSimple;
  depuis: string;
  notes?: string;
}

export interface CamionEau extends OccupantSlot {
  type: 'eau';
  variante: 'Neuf' | 'Usagé';
  annee: number;
  marque: string;
  modele: string;
  stationActuelle: string;
  progression: StationProgress[];
}

export interface JobClient extends OccupantSlot {
  type: 'client';
  nomClient: string;
  telephone?: string;
  travailDescription: string;
  technicien?: string;
}

export interface CamionDetail extends OccupantSlot {
  type: 'detail';
  annee: number;
  marque: string;
  modele: string;
  prixVente?: number;
  travailDescription: string;
}

export type Occupant = CamionEau | JobClient | CamionDetail;
