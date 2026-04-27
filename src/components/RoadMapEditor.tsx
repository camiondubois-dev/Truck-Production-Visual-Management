import { useState } from 'react';
import { ROAD_MAP_STATIONS } from '../data/etapes';
import { useInventaire } from '../contexts/InventaireContext';
import { supabase } from '../lib/supabase';
import type { VehiculeInventaire, RoadMapEtape } from '../types/inventaireTypes';

const TYPES_RESERVOIR = ['2500g', '3750g', '4000g', '5000g'] as const;

const generateStepId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `step-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const STATUT_CONFIG = {
  planifie:    { label: 'Planifié',   bg: '#f1f5f9', color: '#64748b', dot: '⬜' },
  'en-attente':{ label: 'En attente', bg: '#fff7ed', color: '#c2410c', dot: '⏳' },
  'en-cours':  { label: 'En cours',   bg: '#eff6ff', color: '#1d4ed8', dot: '🔵' },
  termine:     { label: 'Terminé',    bg: '#f0fdf4', color: '#166534', dot: '✅' },
  saute:       { label: 'Sauté',      bg: '#fef2f2', color: '#dc2626', dot: '⏭️' },
};

interface Props {
  vehicule: VehiculeInventaire;
  onSaved: (updated: VehiculeInventaire) => void;
  compact?: boolean; // true = terrain (mobile), false = desktop
}

export function RoadMapEditor({ vehicule, onSaved, compact = false }: Props) {
  const { mettreAJourRoadMap } = useInventaire();
  const [steps, setSteps] = useState<RoadMapEtape[]>(
    (vehicule.roadMap ?? []).sort((a, b) => a.ordre - b.ordre)
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newStation, setNewStation] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [typeReservoir, setTypeReservoir] = useState<string>(vehicule.typeReservoirRequis ?? '');

  // All stations always available (duplicate sous-traitants etc. allowed)
  const availableStations = [...ROAD_MAP_STATIONS];

  const handleSave = async (newSteps: RoadMapEtape[]) => {
    setSaving(true);
    try {
      // Passe par le contexte → met à jour le state global → PlancherView se rafraîchit
      await mettreAJourRoadMap(vehicule.id, newSteps);
      // Sauvegarder le type de réservoir requis si c'est un camion à eau
      if (vehicule.type === 'eau') {
        const newType = typeReservoir || null;
        await supabase.from('prod_inventaire')
          .update({ type_reservoir_requis: newType, updated_at: new Date().toISOString() })
          .eq('id', vehicule.id);
      }
      onSaved({ ...vehicule, roadMap: newSteps, typeReservoirRequis: (typeReservoir || undefined) as any });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const newSteps = [...steps];
    [newSteps[idx-1], newSteps[idx]] = [newSteps[idx], newSteps[idx-1]];
    setSteps(newSteps.map((s, i) => ({ ...s, ordre: i + 1 })));
  };

  const moveDown = (idx: number) => {
    if (idx === steps.length - 1) return;
    const newSteps = [...steps];
    [newSteps[idx], newSteps[idx+1]] = [newSteps[idx+1], newSteps[idx]];
    setSteps(newSteps.map((s, i) => ({ ...s, ordre: i + 1 })));
  };

  const removeStep = (idx: number) => {
    setSteps(steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, ordre: i + 1 })));
  };

  const changeStatut = (idx: number, statut: RoadMapEtape['statut']) => {
    setSteps(steps.map((s, i) => i === idx ? { ...s, statut } : s));
  };

  // Mode compact: toggle une station (clic = ajoute, re-clic = retire le dernier ajouté)
  // Exception: stations avec hasDescription (ex: sous-traitants) → toujours ajouter
  const toggleStation = (stationId: string) => {
    const station = ROAD_MAP_STATIONS.find(s => s.id === stationId);
    const hasDescription = !!(station as any)?.hasDescription;

    const lastIdx = [...steps].map((s, i) => ({ s, i })).reverse().find(({ s }) => s.stationId === stationId)?.i ?? -1;

    if (lastIdx >= 0 && !hasDescription) {
      // Retirer (seulement pour les stations sans description — usage unique)
      setSteps(steps.filter((_, i) => i !== lastIdx).map((s, i) => ({ ...s, ordre: i + 1 })));
    } else {
      // Ajouter en fin de liste (toujours pour sous-traitants et similaires)
      const newStep: RoadMapEtape = {
        id: generateStepId(),
        stationId,
        ordre: steps.length + 1,
        statut: 'planifie',
        description: hasDescription ? '' : undefined,
      };
      setSteps([...steps, newStep]);
    }
  };

  const addStep = () => {
    if (!newStation) return;
    const station = ROAD_MAP_STATIONS.find(s => s.id === newStation);
    if (!station) return;
    const newStep: RoadMapEtape = {
      id: generateStepId(),
      stationId: newStation,
      ordre: steps.length + 1,
      statut: 'planifie',
      description: (station as any).hasDescription ? newDescription : undefined,
    };
    setSteps([...steps, newStep]);
    setNewStation('');
    setNewDescription('');
    setShowAdd(false);
  };

  const fs = compact ? 13 : 14;

  // ── Mode compact (terrain): grille toggle ──────────────────
  if (compact) {
    return (
      <div>
        {/* Grille toggle: un clic = ajoute numéroté, re-clic = efface */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 8, marginBottom: 12,
        }}>
          {ROAD_MAP_STATIONS.map(station => {
            const stepIdx = steps.findIndex(s => s.stationId === station.id);
            const isSelected = stepIdx >= 0;
            const step = isSelected ? steps[stepIdx] : null;
            const cfg = step ? (STATUT_CONFIG[step.statut] ?? STATUT_CONFIG.planifie) : null;

            return (
              <button
                key={station.id}
                onClick={() => toggleStation(station.id)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: `2px solid ${isSelected ? station.color : '#e2e8f0'}`,
                  background: isSelected ? `${station.color}12` : '#f8fafc',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                  transition: 'all 0.15s',
                  textAlign: 'left',
                  position: 'relative',
                }}
              >
                {/* Badge de position */}
                {isSelected ? (
                  <span style={{
                    width: 22, height: 22, borderRadius: 6,
                    background: station.color,
                    color: 'white', fontSize: 12, fontWeight: 800, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {stepIdx + 1}
                  </span>
                ) : (
                  <span style={{
                    width: 22, height: 22, borderRadius: 6,
                    border: '2px dashed #cbd5e1',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, fontSize: 14, color: '#94a3b8',
                  }}>
                    +
                  </span>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: isSelected ? 700 : 500, color: isSelected ? station.color : '#64748b', lineHeight: 1.2 }}>
                    {station.icon} {station.label}
                  </div>
                  {step && (
                    <div style={{ fontSize: 10, color: cfg!.color, marginTop: 2 }}>
                      {cfg!.dot} {cfg!.label}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Statut pour les étapes sélectionnées (optionnel, compact) */}
        {steps.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Statuts
            </div>
            {steps.map((step, idx) => {
              const station = ROAD_MAP_STATIONS.find(s => s.id === step.stationId);
              const cfg = STATUT_CONFIG[step.statut] ?? STATUT_CONFIG.planifie;
              return (
                <div key={step.id ?? `${step.stationId}-${idx}`} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', marginBottom: 4, borderRadius: 8,
                  background: cfg.bg, border: `1px solid ${cfg.color}25`,
                }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                    background: (station as any)?.color ?? '#64748b',
                    color: 'white', fontSize: 10, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{idx + 1}</span>
                  <span style={{ fontSize: 13, flex: 1 }}>{station?.icon} {station?.label}</span>
                  <select
                    value={step.statut}
                    onChange={e => changeStatut(idx, e.target.value as RoadMapEtape['statut'])}
                    onClick={e => e.stopPropagation()}
                    style={{
                      fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '3px 6px',
                      border: `1px solid ${cfg.color}60`, background: cfg.bg, color: cfg.color,
                      cursor: 'pointer', outline: 'none',
                    }}
                  >
                    <option value="planifie">⬜ Planifié</option>
                    <option value="en-attente">⏳ En attente</option>
                    <option value="en-cours">🔵 En cours</option>
                    <option value="termine">✅ Terminé</option>
                    <option value="saute">⏭️ Sauté</option>
                  </select>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Type de réservoir requis (compact, eau seulement) ── */}
        {vehicule.type === 'eau' && (
          <div style={{
            marginBottom: 12, padding: '10px 12px', borderRadius: 10,
            background: '#f0f9ff', border: '1px solid #bae6fd',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 16 }}>🛢</span>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#0c4a6e', whiteSpace: 'nowrap' }}>
              Réservoir :
            </label>
            <select
              value={typeReservoir}
              onChange={e => setTypeReservoir(e.target.value)}
              style={{
                flex: 1, padding: '6px 10px', borderRadius: 6,
                border: '1px solid #7dd3fc', fontSize: 12, fontWeight: 600,
                outline: 'none', background: 'white', color: '#0c4a6e',
              }}
            >
              <option value="">— Non spécifié —</option>
              {TYPES_RESERVOIR.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={() => handleSave(steps)}
          disabled={saving}
          style={{
            width: '100%', padding: '14px', borderRadius: 12, fontWeight: 700, fontSize: 14,
            border: 'none', cursor: saving ? 'wait' : 'pointer',
            background: saved ? '#22c55e' : saving ? '#e5e7eb' : '#111827',
            color: saved ? 'white' : saving ? '#9ca3af' : 'white',
            transition: 'all 0.3s',
          }}
        >
          {saving ? 'Sauvegarde...' : saved ? '✓ Road Map sauvegardé !' : '💾 Sauvegarder le Road Map'}
        </button>
      </div>
    );
  }

  // ── Mode desktop: même grille toggle que compact + liste pour statuts/réordre ──
  return (
    <div>
      {/* Grille toggle : cliquer = ajouter numéroté, re-cliquer = retirer */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8, marginBottom: 14,
      }}>
        {ROAD_MAP_STATIONS.map(station => {
          // Compte le nb de fois que cette station apparaît
          const count = steps.filter(s => s.stationId === station.id).length;
          const isSelected = count > 0;
          const firstStepIdx = steps.findIndex(s => s.stationId === station.id);
          const cfg = isSelected ? (STATUT_CONFIG[steps[firstStepIdx]?.statut] ?? STATUT_CONFIG.planifie) : null;

          return (
            <button
              key={station.id}
              onClick={() => toggleStation(station.id)}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                border: `2px solid ${isSelected ? station.color : '#e2e8f0'}`,
                background: isSelected ? `${station.color}12` : '#f8fafc',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
                transition: 'all 0.15s',
                textAlign: 'left',
                position: 'relative',
              }}
            >
              {isSelected ? (
                <span style={{
                  width: 24, height: 24, borderRadius: 6,
                  background: station.color, color: 'white',
                  fontSize: 12, fontWeight: 800, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {count > 1 ? count : firstStepIdx + 1}
                </span>
              ) : (
                <span style={{
                  width: 24, height: 24, borderRadius: 6,
                  border: '2px dashed #cbd5e1',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, fontSize: 15, color: '#94a3b8',
                }}>+</span>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: fs, fontWeight: isSelected ? 700 : 500, color: isSelected ? station.color : '#64748b', lineHeight: 1.2 }}>
                  {station.icon} {station.label}
                </div>
                {cfg && (
                  <div style={{ fontSize: 10, color: cfg.color, marginTop: 2 }}>
                    {cfg.dot} {cfg.label}{count > 1 ? ` (×${count})` : ''}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Liste des étapes sélectionnées pour ajuster statut, ordre, description */}
      {steps.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Étapes planifiées
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {steps.map((step, idx) => {
              const station = ROAD_MAP_STATIONS.find(s => s.id === step.stationId);
              const cfg = STATUT_CONFIG[step.statut] ?? STATUT_CONFIG.planifie;
              return (
                <div key={step.id ?? `${step.stationId}-${idx}`} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 10px', borderRadius: 8,
                  background: cfg.bg, border: `1px solid ${cfg.color}25`,
                }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                    background: (station as any)?.color ?? '#64748b',
                    color: 'white', fontSize: 10, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{idx + 1}</span>
                  <span style={{ fontSize: fs, flex: 1 }}>{station?.icon} {station?.label}</span>
                  {(station as any)?.hasDescription && (
                    <input
                      type="text"
                      value={step.description ?? ''}
                      onChange={e => setSteps(steps.map((s, i) => i === idx ? { ...s, description: e.target.value } : s))}
                      placeholder="Description (ex: XYZ Inc.)"
                      style={{ fontSize: 11, padding: '3px 6px', borderRadius: 5, border: '1px solid #d1d5db', width: 130, outline: 'none' }}
                    />
                  )}
                  <select
                    value={step.statut}
                    onChange={e => changeStatut(idx, e.target.value as RoadMapEtape['statut'])}
                    onClick={e => e.stopPropagation()}
                    style={{
                      fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '3px 6px',
                      border: `1px solid ${cfg.color}60`, background: cfg.bg, color: cfg.color,
                      cursor: 'pointer', outline: 'none',
                    }}
                  >
                    <option value="planifie">⬜ Planifié</option>
                    <option value="en-attente">⏳ En attente</option>
                    <option value="en-cours">🔵 En cours</option>
                    <option value="termine">✅ Terminé</option>
                    <option value="saute">⏭️ Sauté</option>
                  </select>
                  <button onClick={() => moveUp(idx)} disabled={idx === 0}
                    style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', fontSize: 13, color: idx === 0 ? '#e5e7eb' : '#6b7280', padding: '2px' }}>↑</button>
                  <button onClick={() => moveDown(idx)} disabled={idx === steps.length - 1}
                    style={{ background: 'none', border: 'none', cursor: idx === steps.length - 1 ? 'default' : 'pointer', fontSize: 13, color: idx === steps.length - 1 ? '#e5e7eb' : '#6b7280', padding: '2px' }}>↓</button>
                  <button onClick={() => removeStep(idx)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#d1d5db', padding: '2px' }}>✕</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Type de réservoir requis (camions à eau seulement) ── */}
      {vehicule.type === 'eau' && (
        <div style={{
          marginBottom: 12, padding: '10px 12px', borderRadius: 10,
          background: '#f0f9ff', border: '1px solid #bae6fd',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 16 }}>🛢</span>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#0c4a6e', whiteSpace: 'nowrap' }}>
            Réservoir requis :
          </label>
          <select
            value={typeReservoir}
            onChange={e => setTypeReservoir(e.target.value)}
            style={{
              flex: 1, padding: '6px 10px', borderRadius: 6,
              border: '1px solid #7dd3fc', fontSize: 12, fontWeight: 600,
              outline: 'none', background: 'white', color: '#0c4a6e',
            }}
          >
            <option value="">— Non spécifié —</option>
            {TYPES_RESERVOIR.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      )}

      <button onClick={() => handleSave(steps)} disabled={saving}
        style={{
          width: '100%', padding: '12px', borderRadius: 12, fontWeight: 700, fontSize: fs,
          border: 'none', cursor: saving ? 'wait' : 'pointer',
          background: saved ? '#22c55e' : saving ? '#e5e7eb' : '#111827',
          color: saved ? 'white' : saving ? '#9ca3af' : 'white',
          transition: 'all 0.3s',
        }}>
        {saving ? 'Sauvegarde...' : saved ? '✓ Road Map sauvegardé !' : '💾 Sauvegarder le Road Map'}
      </button>
    </div>
  );
}
