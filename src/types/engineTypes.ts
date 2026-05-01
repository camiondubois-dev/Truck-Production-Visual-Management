// ════════════════════════════════════════════════════════════════
// Module Moteurs — Types TypeScript
// ════════════════════════════════════════════════════════════════

export type StatutMoteur     = 'en-attente' | 'en-cours' | 'pret' | 'archive';
export type StatutEtapeMoteur = 'planifie' | 'en-cours' | 'termine' | 'saute';
export type ProprietaireMoteur = 'interne' | 'client' | 'exportation' | 'inventaire';

/** Une étape du road_map d'un moteur. */
export interface EtapeMoteur {
  id: string;             // UUID — permet plusieurs occurrences de la même étape
  etapeId: string;        // 'accessoire-demancher', 'moteur-demarrer', etc.
  ordre: number;
  statut: StatutEtapeMoteur;
  employeId?: string;     // qui l'a faite (profile id)
  debut?: string;         // ISO timestamp
  fin?: string;           // ISO timestamp
  dureeMinutes?: number;  // calculé : fin - debut
  note?: string;          // commentaire libre
}

/** Un moteur (fiche complète). */
export interface Moteur {
  id: string;

  // Identification
  stkNumero: string;          // unique, saisi (ex. '35030')
  workOrder?: string;         // unique, saisi (ex. '1-32491')

  // Description (champs structurés)
  marque?: string;            // ex 'PACCAR', 'CUMMINS', 'DETROIT'
  modele?: string;            // ex 'MX-13', 'ISX', 'DD16'
  serie?: string;             // ex 'CM2350', 'CM871' (souvent Cummins/Paccar)
  annee?: number;             // ex 2000
  epa?: string;               // ex 'EPA10', 'EPA13', 'EPA17'
  ghg?: string;               // ex 'GHG17' (surtout Detroit)
  puissanceHp?: number;       // ex 510, 300
  codeMoteur?: string;        // ex 'CMK', 'HEP', 'KBC' (codes CAT)
  descriptionMoteur?: string; // texte libre / fallback / auto-généré

  proprietaire: ProprietaireMoteur;
  nomClient?: string;
  etatCommercial?: string;    // libre 'VENDU URGENT', etc.
  notes?: string;

  // Média
  photoUrl?: string;

  // État
  statut: StatutMoteur;
  posteCourant?: string;      // slot ID
  employeCourant?: string;    // profile id

  // Tracking
  dateEntree?: string;
  dateSortie?: string;

  // Plan
  roadMap: EtapeMoteur[];

  // Méta
  createdAt: string;
  updatedAt: string;
}

/** Helper : vrai si toutes les étapes du roadMap sont terminées ou sautées. */
export function toutesEtapesFiniesMoteur(m: Moteur): boolean {
  if (m.roadMap.length === 0) return false;
  return m.roadMap.every(e => e.statut === 'termine' || e.statut === 'saute');
}

/** Helper : étape actuellement en cours (ou undefined). */
export function etapeEnCoursMoteur(m: Moteur): EtapeMoteur | undefined {
  return m.roadMap.find(e => e.statut === 'en-cours');
}

/** Helper : prochaine étape à démarrer (premier `planifie` par ordre). */
export function prochaineEtapeMoteur(m: Moteur): EtapeMoteur | undefined {
  return [...m.roadMap]
    .filter(e => e.statut === 'planifie')
    .sort((a, b) => a.ordre - b.ordre)[0];
}

/** Helper : liste des étapes restantes (planifié + en-cours). */
export function etapesRestantesMoteur(m: Moteur): EtapeMoteur[] {
  return m.roadMap.filter(e => e.statut !== 'termine' && e.statut !== 'saute');
}

/** Helper : progression % (0-100). */
export function progressionMoteur(m: Moteur): number {
  if (m.roadMap.length === 0) return 0;
  const finies = m.roadMap.filter(e => e.statut === 'termine' || e.statut === 'saute').length;
  return Math.round((finies / m.roadMap.length) * 100);
}
