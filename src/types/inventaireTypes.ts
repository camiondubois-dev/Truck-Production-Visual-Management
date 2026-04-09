export type StatutInventaire = 'disponible' | 'en-production' | 'archive';

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
  photoUrl?: string;  // ← AJOUT
  clientId?: string;
  email?: string;
}