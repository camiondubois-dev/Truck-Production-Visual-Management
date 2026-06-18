export type StatutInventaire = 'disponible' | 'en-production' | 'archive';

/**
 * Annotations d'un document PDF — « couche vivante » par-dessus le PDF.
 * On stocke le JSON Fabric.js de chaque page séparément (clé = index de page 0-based).
 * Le PDF original n'est jamais modifié : on superpose, donc c'est toujours remodifiable.
 */
export interface DocumentAnnotations {
  version:    number;                  // schéma (1)
  pages:      Record<number, unknown>; // index de page → JSON Fabric.js
  updatedAt:  string;                  // ISO
  updatedBy?: string;                  // nom de l'utilisateur (optionnel)
}

/** Document PDF attaché à un véhicule — stocké dans Supabase Storage (URL, pas base64). */
export interface DocumentVehicule {
  id:           string;   // uuid
  nom:          string;   // nom original du fichier
  taille:       string;   // ex: "1.2 MB"
  dateUpload:   string;   // ISO
  url:          string;   // URL publique Supabase Storage
  storagePath:  string;   // chemin dans le bucket (pour supprimer)
  annotations?: DocumentAnnotations; // couche d'annotations remodifiable
}

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
  // Paiement — détails financiers (nouveaux champs 2026-05-20)
  enFinancement?: boolean;      // client en attente d'approbation bancaire
  montantDepot?: number;        // montant du dépôt reçu
  dateDepot?: string;           // YYYY-MM-DD
  modePaiementDepot?: string;   // 'virement' | 'cheque' | 'carte' | 'comptant' | 'po'
  roadMap?: RoadMapEtape[];
  prixAchat?: number;           // prix d'achat réel du camion → prod_ventes.prix_achat_reel
  documents?: DocumentVehicule[]; // PDFs attachés au véhicule (stockés dans Supabase Storage)
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
