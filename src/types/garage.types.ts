export type TruckStatus = 'en-cours' | 'en-attente' | 'bloque' | 'termine' | 'vide';

export interface StatusConfig {
  color: string;
  label: string;
  dot: string;
}

export interface SlotData {
  id: string;
  label: string;
  futur?: boolean;
}

export interface QueueTruck {
  id: string;
  marque: string;
  annee: string;
  modele: string;
  variant: 'Neuf' | 'Usagé';
  priorite: number;
}

export interface GarageData {
  id: string;
  label: string;
  color: string;
  slots: SlotData[];
  gridCols: number;
  position: {
    top: string;
    left: string;
  };
  optional?: boolean;
  queue: QueueTruck[];
}

export interface TruckData {
  id: string;
  slotId: string;
  type: string;
  variant: string;
  status: TruckStatus;
  etape: string;
  jours: number;
}
