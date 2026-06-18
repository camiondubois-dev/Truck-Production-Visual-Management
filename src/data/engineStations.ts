// ════════════════════════════════════════════════════════════════
// Module Moteurs — Étapes (workflow) + Slots (postes physiques)
// ════════════════════════════════════════════════════════════════

/** Les 8 étapes du workflow moteur (ordre canonique). */
export const ENGINE_ETAPES = [
  { id: 'a-faire',         label: 'À faire',                     icon: '📋', color: '#94a3b8' },
  { id: 'accessoires',     label: 'Accessoires',                 icon: '🔧', color: '#f59e0b' },
  { id: 'demarrage',       label: 'Démarrage',                   icon: '🔥', color: '#f97316' },
  { id: 'reparation',      label: 'Réparation',                  icon: '⚙️', color: '#3b82f6' },
  { id: 'redemarrage',     label: 'Redémarrage après réparation', icon: '🔁', color: '#8b5cf6' },
  { id: 'lavage-peinture', label: 'Lavage et peinture',          icon: '🎨', color: '#06b6d4' },
  { id: 'prep-web',        label: 'Préparation site Web',        icon: '🌐', color: '#ec4899' },
  { id: 'validation-web',  label: 'Validation web',              icon: '✅', color: '#22c55e' },
] as const;

export type EngineEtapeId = typeof ENGINE_ETAPES[number]['id'];

/**
 * Affichage de l'emplacement physique (slots) — MASQUÉ pour l'instant.
 * Le concept d'emplacement sera retravaillé plus tard ; mettre à `true`
 * pour le réactiver (fiche détail + filtres + cartes du tableau).
 */
export const AFFICHER_EMPLACEMENT_MOTEUR = false;

/** Zones physiques regroupant les slots. */
export const ENGINE_ZONES = [
  { id: 'demarrage',        label: 'Démarrage',         color: '#f97316' },
  { id: 'reparation',       label: 'Réparation',        color: '#3b82f6' },
  { id: 'lavage-peinture',  label: 'Lavage / Peinture', color: '#06b6d4' },
  { id: 'stockage',         label: 'Stockage',          color: '#64748b' },
] as const;

export type EngineZoneId = typeof ENGINE_ZONES[number]['id'];

/** Slots physiques avec leur capacité simultanée. */
export const ENGINE_SLOTS = [
  { id: 'demarrage',     label: 'Démarrage',           zone: 'demarrage' as EngineZoneId,        capacite: 1 },
  { id: 'table-a',       label: 'Table A',             zone: 'reparation' as EngineZoneId,       capacite: 1 },
  { id: 'table-b',       label: 'Table B',             zone: 'reparation' as EngineZoneId,       capacite: 1 },
  { id: 'lp-a',          label: 'Lavage/Peinture A',   zone: 'lavage-peinture' as EngineZoneId,  capacite: 1 },
  { id: 'lp-b',          label: 'Lavage/Peinture B',   zone: 'lavage-peinture' as EngineZoneId,  capacite: 1 },
  { id: 'stockage-p1',   label: 'P1',                  zone: 'stockage' as EngineZoneId,         capacite: 6 },
  { id: 'lavage-ext',    label: 'Lavage extérieur',    zone: 'stockage' as EngineZoneId,         capacite: 6 },
  { id: 'attente-ext',   label: 'Attente extérieur',   zone: 'stockage' as EngineZoneId,         capacite: 9 },
] as const;

export type EngineSlotId = typeof ENGINE_SLOTS[number]['id'];

/**
 * Mapping étape → slots compatibles.
 * Aide à proposer les bons emplacements quand un moteur passe à une étape.
 * Les étapes web (prep/validation) sont des tâches de bureau → pas de slot dédié.
 */
export const ENGINE_ETAPE_SLOTS: Record<EngineEtapeId, EngineSlotId[]> = {
  'a-faire':         ['attente-ext'],
  'accessoires':     ['table-a', 'table-b'],
  'demarrage':       ['demarrage'],
  'reparation':      ['table-a', 'table-b'],
  'redemarrage':     ['demarrage'],
  'lavage-peinture': ['lp-a', 'lp-b'],
  'prep-web':        ['stockage-p1'],
  'validation-web':  ['stockage-p1'],
};

/** Helper : retourne l'étape par ID. */
export function getEngineEtape(id: string) {
  return ENGINE_ETAPES.find(e => e.id === id);
}

/** Helper : retourne le slot par ID. */
export function getEngineSlot(id: string) {
  return ENGINE_SLOTS.find(s => s.id === id);
}

/** Helper : retourne la zone par ID. */
export function getEngineZone(id: string) {
  return ENGINE_ZONES.find(z => z.id === id);
}
