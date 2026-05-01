// ════════════════════════════════════════════════════════════════
// Module Moteurs — Étapes (workflow) + Slots (postes physiques)
// ════════════════════════════════════════════════════════════════

/** Les 6 étapes du workflow moteur (ordre canonique). */
export const ENGINE_ETAPES = [
  { id: 'accessoire-demancher',  label: 'Accessoire démancher',  icon: '🔧', color: '#94a3b8' },
  { id: 'moteur-demarrer',       label: 'Moteur démarrer',       icon: '🔥', color: '#f97316' },
  { id: 'moteur-reparer',        label: 'Moteur réparer',        icon: '⚙️', color: '#3b82f6' },
  { id: 'moteur-demarrer-final', label: 'Moteur démarrer final', icon: '✅', color: '#22c55e' },
  { id: 'lavage',                label: 'Lavage',                icon: '🧽', color: '#06b6d4' },
  { id: 'peinture',              label: 'Peinture',              icon: '🎨', color: '#a855f7' },
] as const;

export type EngineEtapeId = typeof ENGINE_ETAPES[number]['id'];

/** Zones physiques regroupant les slots. */
export const ENGINE_ZONES = [
  { id: 'demarrage',        label: 'Démarrage',         color: '#f97316' },
  { id: 'reparation',       label: 'Réparation',        color: '#3b82f6' },
  { id: 'lavage-peinture',  label: 'Lavage / Peinture', color: '#a855f7' },
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
 */
export const ENGINE_ETAPE_SLOTS: Record<EngineEtapeId, EngineSlotId[]> = {
  'accessoire-demancher':  ['table-a', 'table-b'],
  'moteur-demarrer':       ['demarrage'],
  'moteur-reparer':        ['table-a', 'table-b'],
  'moteur-demarrer-final': ['demarrage'],
  'lavage':                ['lp-a', 'lp-b'],
  'peinture':              ['lp-a', 'lp-b'],
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
