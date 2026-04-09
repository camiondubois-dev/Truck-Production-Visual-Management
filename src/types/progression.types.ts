export type TruckStatus = 'en-cours' | 'en-attente' | 'bloque' | 'pret' | 'livre' | 'vendu';

export interface SubTask {
  id: string;
  label: string;
  done: boolean;
}

export interface StationProgress {
  stationId: string;
  status: 'non-commence' | 'en-cours' | 'termine';
  subTasks: SubTask[];
  startedAt?: string;
  completedAt?: string;
}

export interface Truck {
  id: string;
  numero: string;
  annee: number;
  marque: string;
  modele: string;
  type: 'Camion à eau';
  variante: 'Neuf' | 'Usagé';
  status: TruckStatus;
  stationActuelle: string;
  slotActuel: string;
  progression: StationProgress[];
}

export interface Station {
  id: string;
  label: string;
  labelCourt: string;
  color: string;
  ordre: number;
}
