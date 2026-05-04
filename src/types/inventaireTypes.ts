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
  typeReservoirRequis?: '2500g' | '3750g' | '4000g' | '5000g';
  estPret?: boolean;
  etatCommercial?: 'non-vendu' | 'reserve' | 'vendu' | 'location';
  vendeurId?: string;          // ref prod_vendeurs.id
  dateLivraisonPlanifiee?: string;
  livraisonAsap?: boolean;     // Dès que possible → priorité 1
  // Étapes Suivi Vente (hors road_map)
  lavageEtat?: 'pas-requis' | 'a-faire' | 'fait';
  retoucheEtat?: 'pas-requis' | 'a-faire' | 'fait';
  // Paiement (multi-cochable)
  paiementDepot?: boolean;
  paiementComplet?: boolean;
  paiementPo?: boolean;
  roadMap?: RoadMapEtape[];
}

/**
 * Vrai uniquement si le camion est marqué prêt ET satisfait toutes les conditions :
 * - Toutes les étapes road map sont 'termine' ou 'saute'
 * - Si type 'eau', un réservoir est installé
 *
 * Évite les faux "prêts" laissés par d'anciens bugs ou des modifications manuelles.
 */
export function estVehiculePret(v: VehiculeInventaire): boolean {
  if (!v.estPret) return false;
  const etapesRestantes = (v.roadMap ?? []).filter(s => s.statut !== 'termine' && s.statut !== 'saute');
  if (etapesRestantes.length > 0) return false;
  if (v.type === 'eau' && !v.aUnReservoir) return false;
  return true;
}
