// ════════════════════════════════════════════════════════════════
// Permissions par rôle — règles centralisées pour éviter les
// "if (role === 'gestion')" éparpillés dans tout le code.
//
// Rôles (du plus puissant au moins) :
//   admin         — super-admin : tout ce que gestion peut + gérer les
//                   utilisateurs et les rôles
//   gestion       — accès complet (analytics, financier, employés)
//   planification — accès large mais pas l'admin
//   vendeur       — entrer ventes, voir prix/coûts/marge par camion,
//                   créer plans de vente. PAS de totaux entreprise.
//   employe       — seulement son département
//   tv            — affichage TV uniquement
// ════════════════════════════════════════════════════════════════

export type Role = 'admin' | 'gestion' | 'planification' | 'vendeur' | 'employe' | 'tv';

interface ProfileLike { role?: Role | string | null }

const role = (p?: ProfileLike | null): Role | undefined =>
  (p?.role as Role | undefined) ?? undefined;

/** Helper : a-t-il les droits de gestion (= admin OU gestion) ? */
const isGestionOrAdmin = (p?: ProfileLike | null): boolean => {
  const r = role(p);
  return r === 'admin' || r === 'gestion';
};

/** Helper : a-t-il les droits d'admin uniquement ? */
export function isAdmin(p?: ProfileLike | null): boolean {
  return role(p) === 'admin';
}

// ─── Capacités par feature ────────────────────────────────────────

/** Peut voir/éditer prix de vente, coûts, marge par camion (vue détail). */
export function canSeeFinancialPerTruck(p?: ProfileLike | null): boolean {
  return isGestionOrAdmin(p) || role(p) === 'vendeur';
}

/** Peut voir les totaux entreprise : Bilan hebdo, totaux YTD, marge moyenne, etc. */
export function canSeeMargeTotale(p?: ProfileLike | null): boolean {
  return isGestionOrAdmin(p);
}

/** Peut voir l'onglet Profitabilité (analytics globaux). */
export function canSeeProfitabilite(p?: ProfileLike | null): boolean {
  return isGestionOrAdmin(p);
}

/** Peut voir l'onglet Bilan hebdomadaire. */
export function canSeeBilan(p?: ProfileLike | null): boolean {
  return isGestionOrAdmin(p);
}

/** Peut voir l'onglet Plans de vente (création de projections). */
export function canSeePlansVente(p?: ProfileLike | null): boolean {
  return isGestionOrAdmin(p) || role(p) === 'vendeur';
}

/** Peut entrer des ventes / modifier les prix dans Suivi vente. */
export function canEditVentes(p?: ProfileLike | null): boolean {
  return isGestionOrAdmin(p) || role(p) === 'vendeur';
}

/** Peut voir/modifier le suivi des paiements (qui a payé combien). */
export function canSeePaiements(p?: ProfileLike | null): boolean {
  return isGestionOrAdmin(p);
}

/** Peut accéder aux outils d'admin : Analyse, Activité, TV admin. */
export function canSeeAdmin(p?: ProfileLike | null): boolean {
  return isGestionOrAdmin(p);
}

/** Peut accéder à l'import iTrack (Hitrac) : coûts + ventes + pièces. */
export function canImport(p?: ProfileLike | null): boolean {
  return isGestionOrAdmin(p) || role(p) === 'vendeur';
}

/** Peut voir l'onglet Inventaire (liste de tous les camions). */
export function canSeeInventaire(p?: ProfileLike | null): boolean {
  return isGestionOrAdmin(p) || role(p) === 'vendeur';
}

/** Peut voir Suivi vente. */
export function canSeeSuiviVente(p?: ProfileLike | null): boolean {
  return isGestionOrAdmin(p) || role(p) === 'vendeur';
}

/** Peut voir les onglets Camions Eau / Détail / Clients. */
export function canSeeCamionsParType(p?: ProfileLike | null): boolean {
  return isGestionOrAdmin(p) || role(p) === 'vendeur';
}

/** Peut voir Archive. */
export function canSeeArchive(p?: ProfileLike | null): boolean {
  return isGestionOrAdmin(p);
}

/** Peut voir Réservoirs. */
export function canSeeReservoirs(p?: ProfileLike | null): boolean {
  return isGestionOrAdmin(p);
}

/** ★ EXCLUSIF ADMIN : peut gérer les utilisateurs et leurs rôles. */
export function canManageUsers(p?: ProfileLike | null): boolean {
  return role(p) === 'admin';
}

/** ★ EXCLUSIF ADMIN : peut voir/modifier la fiche employés (taux horaires, salaires). */
export function canSeeEmployes(p?: ProfileLike | null): boolean {
  return role(p) === 'admin';
}

/** ★ EXCLUSIF ADMIN : peut voir les salaires individuels et taux par employé. */
export function canSeeSalaires(p?: ProfileLike | null): boolean {
  return role(p) === 'admin';
}

/** Peut voir le détail par employé dans les analyses (heures, coût par personne). */
export function canSeeEmployesDetails(p?: ProfileLike | null): boolean {
  return role(p) === 'admin';
}

// ─── Helpers d'affichage ──────────────────────────────────────────

export const ROLE_LABELS: Record<Role, string> = {
  admin:         'Admin',
  gestion:       'Gestion',
  planification: 'Planification',
  vendeur:       'Vendeur',
  employe:       'Employé',
  tv:            'TV',
};
