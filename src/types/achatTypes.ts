// ════════════════════════════════════════════════════════════════
// Module Achats — Types TypeScript
// ════════════════════════════════════════════════════════════════

export type RoleAchat =
  | 'acheteur-principal'
  | 'acheteur-secondaire'
  | 'evaluateur-final'
  | 'approbateur-pieces'
  | 'approbateur-vente'
  | 'paiement-admin'
  | 'inventaire-admin'
  | 'conducteur';

export type StatutAchat =
  | 'evaluation-initiale'
  | 'evaluation-finale'
  | 'a-approuver'
  | 'approuve-a-offrir'
  | 'offre-faite'
  | 'contre-offre'
  | 'acceptee'
  | 'refusee'
  | 'achete-a-payer-a-ramasser'
  | 'paye-a-ramasser'
  | 'en-towing'
  | 'arrive'
  | 'transferee-inventaire'
  | 'annulee'
  | 'archivee';

export type DestinationAchat = 'pieces' | 'vente-detail';
export type ModeTransport = 'roule' | 'towing';
export type EtatGeneral = 'excellent' | 'bon' | 'moyen' | 'projet' | 'pieces';
export type TypeVendeur = 'particulier' | 'concessionnaire' | 'encan' | 'flotte' | 'autre';
export type Recommandation = 'acheter' | 'negocier' | 'passer';

// ── Entités ─────────────────────────────────────────────────────

export interface VendeurExterne {
  id: string;
  nom: string;
  type: TypeVendeur;
  telephonePrincipal?: string;
  email?: string;
  adresse?: string;
  note?: string;
  foisUtilise: number;
  derniereUtilisation?: string;
  actif: boolean;
  createdAt: string;
}

export interface Conducteur {
  id: string;
  nom: string;
  telephone?: string;
  email?: string;
  peutTowing: boolean;
  peutChauffeur: boolean;
  classePermis?: string;
  notes?: string;
  actif: boolean;
  createdAt: string;
}

export interface Achat {
  id: string;

  // Identification camion
  marque?: string;
  modele?: string;
  annee?: number;
  vin?: string;
  kilometrage?: number;
  specs?: Record<string, any>;
  etatGeneral?: EtatGeneral;
  defautsConnus?: string;

  // Vendeur (snapshot)
  vendeurExterneId?: string;
  vendeurNom: string;
  vendeurTelephone: string;
  vendeurEmail: string;
  vendeurType: TypeVendeur;
  vendeurAdresse: string;
  vendeurNote: string;

  source?: string;

  // Prix
  prixDemandeInitial?: number;
  prixApprouve?: number;
  prixContreOffre?: number;
  prixPaye?: number;

  // Décision
  destination?: DestinationAchat;
  approbateurId?: string;

  // Achat conclu
  ententesVendeur?: string;
  modeTransport?: ModeTransport;
  adressePickup?: string;
  contactPickup?: string;
  horairesPickup?: string;

  // Paiement
  paye: boolean;
  datePaiement?: string;
  paiementParId?: string;

  // Annulation
  annulationMotif?: string;

  // Statut + liens
  statut: StatutAchat;
  acheteurId: string;
  inventaireId?: string;

  // Méta
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface AchatPhoto {
  id: string;
  achatId: string;
  url: string;
  tag?: string;            // exterieur / interieur / moteur / chassis / defaut / documents / pickup
  ordre: number;
  uploadedBy?: string;
  uploadedAt: string;
}

export interface EvaluationInitiale {
  id: string;
  achatId: string;
  evaluateurId: string;
  monEstimation: number;
  prixAttenduVendeur: number;
  commentaire?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EvaluationFinale {
  id: string;
  achatId: string;
  evaluateurId: string;
  prixPropose: number;
  recommandation: Recommandation;
  destinationSuggeree?: DestinationAchat | 'indetermine';
  commentaire?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DecisionAchat {
  id: string;
  achatId: string;
  decideurId: string;
  type: 'approbation' | 'refus' | 'contre-offre-acceptee' | 'contre-offre-refusee' | 'transfert' | 'annulation' | 're-ouverture';
  montant?: number;
  destination?: string;
  note?: string;
  createdAt: string;
}

export interface NotificationAchat {
  id: string;
  destinataireId: string;
  achatId: string;
  type: string;
  message?: string;
  lu: boolean;
  emailEnvoye: boolean;
  createdAt: string;
  luAt?: string;
}

export interface AchatTowing {
  id: string;
  achatId: string;
  conducteurId?: string;
  vehiculeRemorque?: string;
  datePrevue?: string;
  dateDepart?: string;
  dateArrivee?: string;
  kmAller?: number;
  notes?: string;
  statut: 'a-ramasser' | 'en-route' | 'arrive' | 'annule';
  createdAt: string;
  updatedAt: string;
}

// ── Helpers ─────────────────────────────────────────────────────

/** Vrai si l'utilisateur a au moins un de ces rôles */
export function hasAnyRoleAchat(rolesAchat: string[] | undefined, ...roles: RoleAchat[]): boolean {
  if (!rolesAchat) return false;
  return roles.some(r => rolesAchat.includes(r));
}

/** Est-ce que l'achat peut passer à l'étape suivante ? */
export function peutAvancer(achat: Achat): boolean {
  // À utiliser pour valider les transitions d'état
  return achat.statut !== 'archivee' && achat.statut !== 'annulee';
}

/** Label utilisateur pour un statut */
export const LABELS_STATUT: Record<StatutAchat, string> = {
  'evaluation-initiale':       '⏳ Évaluation initiale',
  'evaluation-finale':         '📊 Évaluation finale',
  'a-approuver':               '⚖ À approuver',
  'approuve-a-offrir':         '💡 Approuvé — à offrir',
  'offre-faite':               '📤 Offre faite',
  'contre-offre':              '🔄 Contre-offre',
  'acceptee':                  '✅ Acceptée',
  'refusee':                   '❌ Refusée',
  'achete-a-payer-a-ramasser': '🛒 Acheté · À payer + ramasser',
  'paye-a-ramasser':           '💰 Payé · À ramasser',
  'en-towing':                 '🚛 En towing',
  'arrive':                    '📍 Arrivé',
  'transferee-inventaire':     '🏭 Transféré inventaire',
  'annulee':                   '🚫 Annulée',
  'archivee':                  '📦 Archivée',
};

export const COULEURS_STATUT: Record<StatutAchat, string> = {
  'evaluation-initiale':       '#f59e0b',
  'evaluation-finale':         '#3b82f6',
  'a-approuver':               '#8b5cf6',
  'approuve-a-offrir':         '#06b6d4',
  'offre-faite':               '#0ea5e9',
  'contre-offre':              '#f97316',
  'acceptee':                  '#22c55e',
  'refusee':                   '#dc2626',
  'achete-a-payer-a-ramasser': '#a855f7',
  'paye-a-ramasser':           '#10b981',
  'en-towing':                 '#0d9488',
  'arrive':                    '#14b8a6',
  'transferee-inventaire':     '#16a34a',
  'annulee':                   '#6b7280',
  'archivee':                  '#9ca3af',
};
