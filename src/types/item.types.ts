export type TypeItem = 'eau' | 'client' | 'detail';
export type EtatItem = 'en-attente' | 'en-slot' | 'termine';
export type EtatCommercial = 'non-vendu' | 'reserve' | 'vendu';

export interface StationProgress {
  stationId: string;
  status: 'non-commence' | 'en-cours' | 'termine' | 'non-requis';
  subTasks: SubTask[];
}

export interface SubTask {
  id: string;
  label: string;
  done: boolean;
}

export interface GarageAssignment {
  garageId: string;
  statut: 'en-attente-slot' | 'en-slot' | 'termine';
  slotId?: string;
  ordre: number;
}

export interface Slot {
  id: string;
  futur?: boolean;
}

export interface Document {
  id: string;
  nom: string;
  taille: string;
  dateUpload: string;
  base64: string;
}

export interface Item {
  id: string;
  type: TypeItem;
  etat: EtatItem;
  numero: string;
  label: string;
  slotId?: string;
  dateCreation: string;
  dateEntreeSlot?: string;
  dateArchive?: string;
  stationActuelle?: string;
  dernierGarageId?: string;
  dernierSlotId?: string;
  urgence?: boolean;
  notes?: string;
  inventaireId?: string;
  clientId?: string; // ← lien vers prod_clients
  photoUrl?: string;            // ← AJOUT

  // Statut commercial (eau & détail)
  etatCommercial?: EtatCommercial;
  clientAcheteur?: string;

  // Camion eau
  variante?: 'Neuf' | 'Usagé';
  annee?: number;
  marque?: string;
  modele?: string;

  // Client externe
  nomClient?: string;
  telephone?: string;
  descriptionTravail?: string;
  vehicule?: string;

  // Camion détail
  descriptionTravaux?: string;

  // UNIFIÉ — même système pour les 3 types
  progression: StationProgress[];
  stationsActives: string[];
  documents?: Document[];
}

export interface GarageContextType {
  items: Item[];
  slotMap: Record<string, Item>;
  enAttente: {
    eau: Item[];
    client: Item[];
    detail: Item[];
  };
  ajouterItem: (item: Item) => void;
  supprimerItem: (itemId: string) => void;
  mettreAJourItem: (itemId: string, patch: Partial<Item>) => void;
  archiverItem: (itemId: string) => void;
  reouvrirItem: (itemId: string) => void;
  assignerSlot: (itemId: string, slotId: string) => void;
  retirerVersAttente: (itemId: string) => void;
  terminerEtAvancer: (itemId: string) => void;
  terminerItem: (itemId: string) => void;
  updateStationStatus: (itemId: string, stationId: string, status: 'non-commence' | 'en-cours' | 'termine' | 'non-requis') => void;
  updateStationsActives: (itemId: string, stationsActives: string[]) => void;
  ajouterDocument: (itemId: string, doc: Document) => void;
  supprimerDocument: (itemId: string, docId: string) => void;
}