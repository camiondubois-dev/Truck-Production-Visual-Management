export type StatutInventaire = 'disponible' | 'en-production' | 'archive';

export interface EtapeFaite {
  stationId: string;
  fait: boolean;
  date: string;
  commentaire?: string;
}

export interface RoadMapEtape {
  id?: string;                   // UUID — permet d'avoir deux fois la même stationId (ex: 2x sous-traitants)
  stationId: string;
  ordre: number;
  statut: 'planifie' | 'en-attente' | 'en-cours' | 'termine' | 'saute';
  priorite?: number;             // position dans la file d'attente (1=premier)
  description?: string;          // Used for sous-traitants
}

export interface VehiculeInventaire {
  id: string;
  statut: StatutInventaire;
  dateImport: string;
  dateEnProduction?: string;
  jobId?: string;
  numero: string;
  type: 'eau' | 'client' | 'detail';
  variante?: 'Neuf' | 'Usagé';
  marque?: string;
  modele?: string;
  annee?: number;
  clientAcheteur?: string;
  notes?: string;
  nomClient?: string;
  telephone?: string;
  vehicule?: string;
  descriptionTravail?: string;
  descriptionTravaux?: string;
  photoUrl?: string;
  clientId?: string;
  email?: string;
  etapesFaites?: EtapeFaite[];
  aUnReservoir?: boolean;
  reservoirId?: string;
  estPret?: boolean;
  etatCommercial?: 'non-vendu' | 'reserve' | 'vendu' | 'location';
  dateLivraisonPlanifiee?: string;
  roadMap?: RoadMapEtape[];
}
