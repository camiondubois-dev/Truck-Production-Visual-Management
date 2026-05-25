// ════════════════════════════════════════════════════════════════
// Permissions par rôle — règles centralisées pour éviter les
// "if (role === 'gestion')" éparpillés dans tout le code.
//
// Rôles :
//   gestion       — accès complet (analytics inclus)
//   planification — accès large mais pas l'admin
//   vendeur       — entrer ventes, voir prix/coûts/marge par camion,
//                   créer plans de vente. PAS de totaux entreprise.
//   employe       — seulement son département
//   tv            — affichage TV uniquement
// ════════════════════════════════════════════════════════════════

export type Role = 'gestion' | 'planification' | 'vendeur' | 'employe' | 'tv';

interface ProfileLike { role?: Role | string | null }

const role = (p?: ProfileLike | null): Role | undefined =>
  (p?.role as Role | undefined) ?? undefined;

// ─── Capacités par feature ────────────────────────────────────────

/** Peut voir/éditer prix de vente, coûts, marge par camion (vue détail). */
export function canSeeFinancialPerTruck(p?: ProfileLike | null): boolean {
  const r = role(p);
  return r === 'gestion' || r === 'vendeur';
}

/** Peut voir les totaux entreprise : Bilan hebdo, totaux YTD, marge moyenne, etc. */
export function canSeeMargeTotale(p?: ProfileLike | null): boolean {
  return role(p) === 'gestion';
}

/** Peut voir l'onglet Profitabilité (analytics globaux). */
export function canSeeProfitabilite(p?: ProfileLike | null): boolean {
  return role(p) === 'gestion';
}

/** Peut voir l'onglet Bilan hebdomadaire. */
export function canSeeBilan(p?: ProfileLike | null): boolean {
  return role(p) === 'gestion';
}

/** Peut voir l'onglet Plans de vente (création de projections). */
export function canSeePlansVente(p?: ProfileLike | null): boolean {
  const r = role(p);
  return r === 'gestion' || r === 'vendeur';
}

/** Peut entrer des ventes / modifier les prix dans Suivi vente. */
export function canEditVentes(p?: ProfileLike | null): boolean {
  const r = role(p);
  return r === 'gestion' || r === 'vendeur';
}

/** Peut voir/modifier le suivi des paiements (qui a payé combien). */
export function canSeePaiements(p?: ProfileLike | null): boolean {
  return role(p) === 'gestion';
}

/** Peut accéder aux outils d'admin : Analyse, Activité, TV admin. */
export function canSeeAdmin(p?: ProfileLike | null): boolean {
  return role(p) === 'gestion';
}

/** Peut accéder à l'import iTrack (Hitrac) : coûts + ventes + pièces. */
export function canImport(p?: ProfileLike | null): boolean {
  const r = role(p);
  return r === 'gestion' || r === 'vendeur';
}

/** Peut voir l'onglet Inventaire (liste de tous les camions). */
export function canSeeInventaire(p?: ProfileLike | null): boolean {
  const r = role(p);
  return r === 'gestion' || r === 'vendeur';
}

/** Peut voir Suivi vente. */
export function canSeeSuiviVente(p?: ProfileLike | null): boolean {
  const r = role(p);
  return r === 'gestion' || r === 'vendeur';
}

/** Peut voir les onglets Camions Eau / Détail / Clients. */
export function canSeeCamionsParType(p?: ProfileLike | null): boolean {
  const r = role(p);
  return r === 'gestion' || r === 'vendeur';
}

/** Peut voir Archive. */
export function canSeeArchive(p?: ProfileLike | null): boolean {
  return role(p) === 'gestion';
}

/** Peut voir Réservoirs. */
export function canSeeReservoirs(p?: ProfileLike | null): boolean {
  return role(p) === 'gestion';
}

// ─── Helpers d'affichage ──────────────────────────────────────────

export const ROLE_LABELS: Record<Role, string> = {
  gestion:       'Gestion',
  planification: 'Planification',
  vendeur:       'Vendeur',
  employe:       'Employé',
  tv:            'TV',
};
