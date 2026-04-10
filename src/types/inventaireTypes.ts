export type StatutInventaire = 'disponible' | 'en-production' | 'archive';

export interface EtapeFaite {
  stationId: string;
  fait: boolean;
  date: string;
  commentaire?: string;
}

export interface RoadMapEtape {
  stationId: string;
  ordre: number;
  statut: 'planifie' | 'en-attente' | 'en-cours' | 'termine' | 'saute';
  priorite?: 1 | 2 | 3;        // 1=urgent, 2=normal, 3=faible
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
