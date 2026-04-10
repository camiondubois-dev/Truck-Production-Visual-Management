import { useState } from 'react';
import { ROAD_MAP_STATIONS } from '../data/etapes';
import { inventaireService } from '../services/inventaireService';
import type { VehiculeInventaire, RoadMapEtape } from '../types/inventaireTypes';

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
  const [steps, setSteps] = useState<RoadMapEtape[]>(
    (vehicule.roadMap ?? []).sort((a, b) => a.ordre - b.ordre)
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newStation, setNewStation] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const usedIds = new Set(steps.map(s => s.stationId));
  const availableStations = ROAD_MAP_STATIONS.filter(s => !usedIds.has(s.id));

  const handleSave = async (newSteps: RoadMapEtape[]) => {
    setSaving(true);
    try {
      await inventaireService.mettreAJourRoadMap(vehicule.id, newSteps);
      onSaved({ ...vehicule, roadMap: newSteps });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const newSteps = [...steps];
    [newSteps[idx-1], newSteps[idx]] = [newSteps[idx], newSteps[idx-1]];
    const reordered = newSteps.map((s, i) => ({ ...s, ordre: i + 1 }));
    setSteps(reordered);
  };

  const moveDown = (idx: number) => {
    if (idx === steps.length - 1) return;
    const newSteps = [...steps];
    [newSteps[idx], newSteps[idx+1]] = [newSteps[idx+1], newSteps[idx]];
    const reordered = newSteps.map((s, i) => ({ ...s, ordre: i + 1 }));
    setSteps(reordered);
  };

  const removeStep = (idx: number) => {
    const newSteps = steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, ordre: i + 1 }));
    setSteps(newSteps);
  };

  const changeStatut = (idx: number, statut: RoadMapEtape['statut']) => {
    const newSteps = steps.map((s, i) => i === idx ? { ...s, statut } : s);
    setSteps(newSteps);
  };

  const addStep = () => {
    if (!newStation) return;
    const station = ROAD_MAP_STATIONS.find(s => s.id === newStation);
    if (!station) return;
    const newStep: RoadMapEtape = {
      stationId: newStation,
      ordre: steps.length + 1,
      statut: 'planifie',
      description: (station as any).hasDescription ? newDescription : undefined,
    };
    const newSteps = [...steps, newStep];
    setSteps(newSteps);
    setNewStation('');
    setNewDescription('');
    setShowAdd(false);
  };

  const fs = compact ? 13 : 14;

  return (
    <div>
      {/* Steps list */}
      {steps.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af', fontSize: fs }}>
          Aucune étape planifiée. Ajoutez des étapes ci-dessous.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {steps.map((step, idx) => {
            const station = ROAD_MAP_STATIONS.find(s => s.id === step.stationId);
            const cfg = STATUT_CONFIG[step.statut] ?? STATUT_CONFIG.planifie;
            return (
              <div key={step.stationId} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px', borderRadius: 10,
                background: cfg.bg, border: `1px solid ${cfg.color}30`,
              }}>
                {/* Ordre */}
                <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', minWidth: 16 }}>{idx+1}</span>
                {/* Station */}
                <span style={{ fontSize: fs }}>{station?.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: fs, fontWeight: 600, color: '#111827' }}>
                    {station?.label ?? step.stationId}
                  </div>
                  {step.description && (
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{step.description}</div>
                  )}
                </div>
                {/* Statut badge */}
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
                {/* Move buttons */}
                {!compact && (
                  <>
                    <button onClick={() => moveUp(idx)} disabled={idx===0}
                      style={{ background:'none', border:'none', cursor: idx===0 ? 'default':'pointer', fontSize:14, color: idx===0 ? '#e5e7eb' : '#6b7280', padding:'2px' }}>↑</button>
                    <button onClick={() => moveDown(idx)} disabled={idx===steps.length-1}
                      style={{ background:'none', border:'none', cursor: idx===steps.length-1 ? 'default':'pointer', fontSize:14, color: idx===steps.length-1 ? '#e5e7eb' : '#6b7280', padding:'2px' }}>↓</button>
                  </>
                )}
                <button onClick={() => removeStep(idx)}
                  style={{ background:'none', border:'none', cursor:'pointer', fontSize:14, color:'#d1d5db', padding:'2px' }}>✕</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add step */}
      {showAdd ? (
        <div style={{ padding: '10px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e5e7eb', marginBottom: 10 }}>
          <select value={newStation} onChange={e => setNewStation(e.target.value)}
            style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: fs, marginBottom: 8, outline: 'none' }}>
            <option value="">— Choisir une étape —</option>
            {availableStations.map(s => (
              <option key={s.id} value={s.id}>{s.icon} {s.label}</option>
            ))}
          </select>
          {newStation && (ROAD_MAP_STATIONS.find(s => s.id === newStation) as any)?.hasDescription && (
            <input type="text" value={newDescription} onChange={e => setNewDescription(e.target.value)}
              placeholder="Ex: Peinture chez XYZ Inc."
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: fs, marginBottom: 8, outline: 'none', boxSizing: 'border-box' }} />
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addStep} disabled={!newStation}
              style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: newStation ? '#22c55e' : '#e5e7eb', color: newStation ? 'white' : '#9ca3af', fontWeight: 700, fontSize: fs, cursor: newStation ? 'pointer' : 'not-allowed' }}>
              + Ajouter
            </button>
            <button onClick={() => { setShowAdd(false); setNewStation(''); setNewDescription(''); }}
              style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', fontSize: fs, cursor: 'pointer' }}>
              Annuler
            </button>
          </div>
        </div>
      ) : (
        availableStations.length > 0 && (
          <button onClick={() => setShowAdd(true)}
            style={{ width: '100%', padding: '10px', borderRadius: 10, border: '2px dashed #d1d5db', background: 'white', color: '#6b7280', fontSize: fs, cursor: 'pointer', marginBottom: 10 }}>
            + Ajouter une étape
          </button>
        )
      )}

      {/* Save button */}
      <button onClick={() => handleSave(steps)} disabled={saving}
        style={{
          width: '100%', padding: compact ? '14px' : '12px', borderRadius: 12, fontWeight: 700, fontSize: fs,
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
