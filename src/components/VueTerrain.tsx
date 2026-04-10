import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { inventaireService, fromDB } from '../services/inventaireService';
import { reservoirService } from '../services/reservoirService';
import { photoService } from '../services/photoService';
import { TERRAIN_PIN } from '../config/terrain';
import type { VehiculeInventaire } from '../types/inventaireTypes';
import { ROAD_MAP_STATIONS } from '../data/etapes';
import { RoadMapEditor } from './RoadMapEditor';
import { GARAGES_COLONNES, GARAGE_TO_SLOTS } from '../data/garageData';

type FiltreType   = 'tous' | 'eau' | 'detail';
type FiltreStatut = 'tous' | 'disponibles' | 'prets' | 'vendus';
type Ecran = 'pin' | 'login' | 'ok';

// ─── PIN ────────────────────────────────────────────────────────────────────

function EcranPin({ onSuccess }: { onSuccess: () => void }) {
  const [digits, setDigits] = useState('');
  const [erreur, setErreur] = useState(false);

  const handleDigit = (d: string) => {
    if (digits.length >= 4) return;
    const next = digits + d;
    setErreur(false);
    setDigits(next);
    if (next.length === 4) {
      if (next === TERRAIN_PIN) {
        sessionStorage.setItem('terrain_pin_ok', '1');
        onSuccess();
      } else {
        setTimeout(() => { setDigits(''); setErreur(true); }, 400);
      }
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#1a1a2e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <img src="/logo-camions-dubois-_-noir-bleu-1.png" alt="Camions Dubois" style={{ height: 60, marginBottom: 20, filter: 'brightness(0) invert(1)' }} />
      <div style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 6 }}>Vue Terrain</div>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 40 }}>Entrez votre code d'accès</div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{ width: 18, height: 18, borderRadius: '50%', background: digits.length > i ? (erreur ? '#ef4444' : '#f97316') : 'rgba(255,255,255,0.2)', transition: 'background 0.2s' }} />
        ))}
      </div>
      {erreur && <div style={{ fontSize: 13, color: '#ef4444', marginBottom: 12 }}>Code incorrect</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, width: 240, marginTop: 24 }}>
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
          <button key={i} onClick={() => d === '⌫' ? setDigits(p => p.slice(0,-1)) : d ? handleDigit(d) : undefined}
            disabled={!d}
            style={{ padding: '18px 0', borderRadius: 14, border: 'none', background: d ? 'rgba(255,255,255,0.1)' : 'transparent', color: 'white', fontSize: 22, fontWeight: 600, cursor: d ? 'pointer' : 'default', opacity: d ? 1 : 0 }}>
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Création camion ────────────────────────────────────────────────────────

function ModalCreation({ onClose, onCree }: { onClose: () => void; onCree: (v: VehiculeInventaire) => void }) {
  const [type, setType]         = useState<'eau' | 'detail'>('eau');
  const [variante, setVariante] = useState<'Neuf' | 'Usagé' | ''>('');
  const [numero, setNumero]     = useState('');
  const [marque, setMarque]     = useState('');
  const [modele, setModele]     = useState('');
  const [annee, setAnnee]       = useState('');
  const [saving, setSaving]     = useState(false);

  const handleCreer = async () => {
    if (!numero.trim()) return;
    setSaving(true);
    try {
      const nouveau: VehiculeInventaire = {
        id: `veh-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
        statut: 'disponible',
        dateImport: new Date().toISOString(),
        numero: numero.trim(),
        type,
        variante: variante || undefined,
        marque: marque || undefined,
        modele: modele || undefined,
        annee: annee ? Number(annee) : undefined,
      };
      await inventaireService.ajouter(nouveau);
      onCree(nouveau);
      onClose();
    } finally { setSaving(false); }
  };

  const inp: React.CSSProperties = { width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 16, outline: 'none', boxSizing: 'border-box', WebkitAppearance: 'none' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: 'white', borderRadius: '20px 20px 0 0', padding: '20px 20px 40px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: '#e5e7eb', margin: '0 auto 20px' }} />
        <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 20 }}>Nouveau camion</div>

        {/* Type */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Type</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['eau', 'detail'] as const).map(t => (
              <button key={t} onClick={() => { setType(t); setVariante(''); }}
                style={{ flex: 1, padding: '12px', borderRadius: 10, cursor: 'pointer', border: type === t ? '2px solid #f97316' : '1px solid #e5e7eb', background: type === t ? '#fff7ed' : 'white', color: type === t ? '#f97316' : '#6b7280', fontWeight: 700, fontSize: 14 }}>
                {t === 'eau' ? '💧 Eau' : '🏷️ Détail'}
              </button>
            ))}
          </div>
        </div>

        {/* Variante */}
        {type === 'eau' && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Variante</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['Neuf', 'Usagé'] as const).map(v => (
                <button key={v} onClick={() => setVariante(v)}
                  style={{ flex: 1, padding: '12px', borderRadius: 10, cursor: 'pointer', border: variante === v ? '2px solid #f97316' : '1px solid #e5e7eb', background: variante === v ? '#fff7ed' : 'white', color: variante === v ? '#f97316' : '#6b7280', fontWeight: variante === v ? 700 : 400, fontSize: 14 }}>
                  {v === 'Neuf' ? '✨ Neuf' : '🔄 Usagé'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Numéro */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Numéro de stock *</div>
          <input style={inp} type="text" inputMode="numeric" value={numero} onChange={e => setNumero(e.target.value)} placeholder="35088" autoFocus />
        </div>

        {/* Marque / Modèle / Année */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <div style={{ flex: 2 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Marque</div>
            <input style={inp} type="text" value={marque} onChange={e => setMarque(e.target.value)} placeholder="Kenworth" />
          </div>
          <div style={{ flex: 2 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Modèle</div>
            <input style={inp} type="text" value={modele} onChange={e => setModele(e.target.value)} placeholder="T880" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Année</div>
            <input style={inp} type="text" inputMode="numeric" value={annee} onChange={e => setAnnee(e.target.value)} placeholder="2024" />
          </div>
        </div>

        <button onClick={handleCreer} disabled={!numero.trim() || saving}
          style={{ width: '100%', padding: '16px', borderRadius: 12, border: 'none', background: !numero.trim() || saving ? '#e5e7eb' : '#f97316', color: !numero.trim() || saving ? '#9ca3af' : 'white', fontWeight: 700, fontSize: 16, cursor: !numero.trim() || saving ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Création...' : '✅ Créer le camion'}
        </button>
      </div>
    </div>
  );
}

// ─── Fiche camion (bottom sheet) ─────────────────────────────────────────────

function FicheCamion({ vehicule: v, onClose, onMisAJour }: {
  vehicule: VehiculeInventaire;
  onClose: () => void;
  onMisAJour: (updated: VehiculeInventaire) => void;
}) {
  const [reservoirsDispos, setReservoirsDispos] = useState<{ id: string; numero: string; type: string }[]>([]);
  const [reservoirChoisi, setReservoirChoisi]   = useState<string>('');
  const [saving, setSaving]                     = useState(false);
  const [saved, setSaved]                       = useState(false);
  const [uploadingPhoto, setUploadingPhoto]     = useState(false);

  const [showSlotAssign, setShowSlotAssign]     = useState(false);
  const [slotGarageChoisi, setSlotGarageChoisi] = useState('');
  const [slotChoisi, setSlotChoisi]             = useState('');
  const [slotConflict, setSlotConflict]         = useState<{item: any, slotId: string} | null>(null);
  const [assigningSlot, setAssigningSlot]       = useState(false);

  useEffect(() => {
    if (v.type === 'eau' && !v.aUnReservoir) {
      supabase.from('prod_reservoirs').select('id,numero,type').eq('etat', 'disponible')
        .then(({ data }) => setReservoirsDispos((data ?? []).map((r: any) => ({ id: r.id, numero: r.numero, type: r.type }))));
    }
  }, [v.id, v.type, v.aUnReservoir]);

  // Photo
  const handlePhoto = async (fichier: File) => {
    if (fichier.size > 10 * 1024 * 1024) { alert('Max 10 MB'); return; }
    setUploadingPhoto(true);
    try {
      if (v.photoUrl) await photoService.supprimerPhoto(v.photoUrl);
      const url = await photoService.uploaderPhoto(fichier, 'inventaire');
      await inventaireService.mettreAJourPhoto(v.id, url);
      onMisAJour({ ...v, photoUrl: url });
    } finally { setUploadingPhoto(false); }
  };

  // Changement type (Eau/Détail) - sauvegarde immédiate
  const handleChangeType = async (newType: 'eau' | 'detail') => {
    if (newType === v.type) return;
    await inventaireService.mettreAJourType(v.id, newType);
    onMisAJour({ ...v, type: newType });
  };

  // Changement variante (Neuf/Usagé) - sauvegarde immédiate
  const handleChangeVariante = async (newVariante: 'Neuf' | 'Usagé') => {
    const val = v.variante === newVariante ? null : newVariante;
    await inventaireService.mettreAJourVariante(v.id, val);
    onMisAJour({ ...v, variante: val ?? undefined });
  };

  // Marquer prêt (réservoir si besoin + estPret)
  const handleMarquerPret = async () => {
    setSaving(true);
    try {
      if (v.type === 'eau' && !v.aUnReservoir) {
        if (reservoirChoisi) {
          await reservoirService.installerSurInventaire(reservoirChoisi, v.id);
          await inventaireService.mettreAJourReservoir(v.id, true, reservoirChoisi);
        } else {
          await inventaireService.mettreAJourReservoir(v.id, true, null);
        }
      }
      await inventaireService.marquerPret(v.id, true);
      onMisAJour({
        ...v,
        estPret: true,
        aUnReservoir: v.type === 'eau' ? true : v.aUnReservoir,
        reservoirId: reservoirChoisi || v.reservoirId,
      });
      setSaved(true);
      setTimeout(onClose, 900);
    } finally { setSaving(false); }
  };

  const handleDecocher = async () => {
    setSaving(true);
    try {
      await inventaireService.marquerPret(v.id, false);
      onMisAJour({ ...v, estPret: false });
      onClose();
    } finally { setSaving(false); }
  };

  const inp: React.CSSProperties = {
    width: '100%', padding: '12px', borderRadius: 10,
    border: '1px solid #e5e7eb', fontSize: 15, outline: 'none',
    background: 'white', boxSizing: 'border-box',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: 'white', borderRadius: '20px 20px 0 0', maxHeight: '92vh', overflowY: 'auto', paddingBottom: 40 }}>

        {/* Poignée + bouton fermer */}
        <div style={{ padding: '12px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ width: 32 }} />
          <div style={{ width: 40, height: 4, borderRadius: 2, background: '#e5e7eb' }} />
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#f1f5f9', color: '#6b7280', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>✕</button>
        </div>

        {/* Photo */}
        {v.photoUrl ? (
          <div style={{ position: 'relative', margin: '12px 20px', borderRadius: 12, overflow: 'hidden', height: 180 }}>
            <img src={v.photoUrl} alt={`#${v.numero}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <label style={{ position: 'absolute', bottom: 10, right: 10, padding: '7px 14px', borderRadius: 8, background: 'rgba(0,0,0,0.65)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {uploadingPhoto ? '...' : '📷 Changer'}
              <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handlePhoto(f); }} />
            </label>
          </div>
        ) : (
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, margin: '12px 20px', padding: '18px', borderRadius: 12, border: '2px dashed #d1d5db', background: '#fafafa', cursor: 'pointer', color: '#6b7280', fontSize: 15 }}>
            {uploadingPhoto ? 'Chargement...' : '📷 Prendre une photo'}
            <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handlePhoto(f); }} />
          </label>
        )}

        {/* Header */}
        <div style={{ padding: '4px 20px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 24, fontWeight: 700, color: v.type === 'eau' ? '#f97316' : '#22c55e' }}>#{v.numero}</span>
            {v.estPret && <span style={{ fontSize: 12, background: '#dcfce7', color: '#166534', padding: '3px 10px', borderRadius: 8, fontWeight: 700 }}>✅ Prêt</span>}
            {!v.estPret && v.statut === 'en-production' && (
              <span style={{ fontSize: 12, background: '#fff7ed', color: '#c2410c', padding: '3px 10px', borderRadius: 8, fontWeight: 700 }}>
                🔧 En production
              </span>
            )}
          </div>
          <div style={{ fontSize: 14, color: '#6b7280' }}>
            {[v.marque, v.modele, v.annee].filter(Boolean).join(' ') || (v.type === 'eau' ? 'Camion à eau' : 'Camion détail')}
          </div>
        </div>

        {/* ── Type & Variante ── */}
        <div style={{ margin: '0 20px 16px', padding: '14px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Type & Variante</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {(['eau', 'detail'] as const).map(t => (
              <button key={t} onClick={() => handleChangeType(t)}
                style={{ flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer', fontWeight: v.type === t ? 700 : 400, fontSize: 14,
                  border: v.type === t ? 'none' : '1px solid #e5e7eb',
                  background: v.type === t ? (t === 'eau' ? '#fff7ed' : '#f0fdf4') : 'white',
                  color: v.type === t ? (t === 'eau' ? '#f97316' : '#22c55e') : '#9ca3af',
                }}>
                {t === 'eau' ? '💧 Eau' : '🏷️ Détail'}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['Neuf', 'Usagé'] as const).map(var_ => (
              <button key={var_} onClick={() => handleChangeVariante(var_)}
                style={{ flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer', fontWeight: v.variante === var_ ? 700 : 400, fontSize: 14,
                  border: v.variante === var_ ? 'none' : '1px solid #e5e7eb',
                  background: v.variante === var_ ? '#eff6ff' : 'white',
                  color: v.variante === var_ ? '#1d4ed8' : '#9ca3af',
                }}>
                {var_ === 'Neuf' ? '✨ Neuf' : '🔄 Usagé'}
              </button>
            ))}
          </div>
        </div>

        {/* ── Réservoir (eau seulement) ── */}
        {v.type === 'eau' && (
          <div style={{ margin: '0 20px 16px', padding: '14px', borderRadius: 12, background: '#fafafa', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Réservoir</div>
            {v.aUnReservoir ? (
              <span style={{ fontSize: 13, background: '#dcfce7', color: '#166534', padding: '6px 14px', borderRadius: 8, fontWeight: 700 }}>✅ Réservoir installé</span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <select value={reservoirChoisi} onChange={e => setReservoirChoisi(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1px solid #d1d5db', fontSize: 15, outline: 'none', background: 'white' }}>
                  <option value="">Aucun réservoir numéroté</option>
                  {reservoirsDispos.map(r => (
                    <option key={r.id} value={r.id}>#{r.numero} — {r.type}</option>
                  ))}
                </select>
                <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>Laissez vide = réservoir installé sans numéro</div>
              </div>
            )}
          </div>
        )}

        {/* ── Road Map ── */}
        <div style={{ margin: '0 20px 16px', padding: '14px', borderRadius: 12, background: '#fafafa', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            🗺️ Road Map
          </div>
          {(v.roadMap ?? []).length === 0 ? (
            <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 8 }}>Aucune étape planifiée.</div>
          ) : (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {(v.roadMap ?? []).sort((a,b)=>a.ordre-b.ordre).map(step => {
                const station = ROAD_MAP_STATIONS.find(s => s.id === step.stationId);
                const cfg = step.statut === 'termine' ? {bg:'#f0fdf4',color:'#166534'}
                  : step.statut === 'en-cours' ? {bg:'#eff6ff',color:'#1d4ed8'}
                  : step.statut === 'en-attente' ? {bg:'#fff7ed',color:'#c2410c'}
                  : {bg:'#f1f5f9',color:'#64748b'};
                return (
                  <span key={step.id ?? `${step.stationId}-${step.ordre}`} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, fontWeight: 600, background: cfg.bg, color: cfg.color }}>
                    {station?.icon} {station?.label ?? step.stationId}
                  </span>
                );
              })}
            </div>
          )}
          <RoadMapEditor
            vehicule={v}
            onSaved={updated => onMisAJour(updated)}
            compact={true}
          />
        </div>

        {/* ── Assigner à un slot ── */}
        <div style={{ margin: '0 20px 16px' }}>
          {!showSlotAssign ? (
            <button onClick={() => setShowSlotAssign(true)}
              style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1px dashed #d1d5db', background: 'white', color: '#6b7280', fontSize: 14, cursor: 'pointer', fontWeight: 500 }}>
              🏭 Assigner à un slot de garage
            </button>
          ) : (
            <div style={{ padding: '14px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assigner à un slot</div>

              {/* Département */}
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>1. Sélectionner le département</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {GARAGES_COLONNES.map(g => (
                  <button key={g.id} onClick={() => { setSlotGarageChoisi(g.id); setSlotChoisi(''); }}
                    style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: slotGarageChoisi === g.id ? 700 : 400, cursor: 'pointer',
                      border: slotGarageChoisi === g.id ? 'none' : '1px solid #e5e7eb',
                      background: slotGarageChoisi === g.id ? g.color : 'white',
                      color: slotGarageChoisi === g.id ? 'white' : '#6b7280',
                    }}>
                    {g.labelCourt}
                  </button>
                ))}
              </div>

              {/* Slot */}
              {slotGarageChoisi && (
                <>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>2. Sélectionner le slot</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    {(GARAGE_TO_SLOTS[slotGarageChoisi] ?? []).map(slotId => (
                      <button key={slotId} onClick={() => setSlotChoisi(slotId)}
                        style={{ width: 52, height: 44, borderRadius: 8, fontSize: 14, fontWeight: slotChoisi === slotId ? 700 : 400, cursor: 'pointer',
                          border: slotChoisi === slotId ? 'none' : '1px solid #e5e7eb',
                          background: slotChoisi === slotId ? '#111827' : 'white',
                          color: slotChoisi === slotId ? 'white' : '#374151',
                        }}>
                        {slotId}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Conflict dialog */}
              {slotConflict && (
                <div style={{ padding: '12px', borderRadius: 10, background: '#fef3c7', border: '1px solid #fde68a', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 8 }}>
                    ⚠️ Slot occupé — #{slotConflict.item.numero ?? slotConflict.item.label} est dans ce slot
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button onClick={async () => {
                      setAssigningSlot(true);
                      try {
                        await supabase.from('prod_items')
                          .update({ slot_id: null, etat: 'en-attente', updated_at: new Date().toISOString() })
                          .eq('id', slotConflict.item.id);
                        const updatedRoadMap = (v.roadMap ?? []).map(e =>
                          e.stationId === slotGarageChoisi && e.statut === 'en-attente'
                            ? { ...e, statut: 'en-cours' as const } : e
                        );
                        await inventaireService.mettreAJourRoadMap(v.id, updatedRoadMap);
                        onMisAJour({ ...v, roadMap: updatedRoadMap });
                        setSlotConflict(null);
                        setShowSlotAssign(false);
                        alert(`Camion assigné au slot ${slotChoisi} ✓`);
                      } finally { setAssigningSlot(false); }
                    }}
                      style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: '#22c55e', color: 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                      ✅ Il est sorti
                    </button>
                    <button onClick={() => setSlotConflict(null)}
                      style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                      ↩️ Il est encore là
                    </button>
                  </div>
                </div>
              )}

              {/* Confirm button */}
              {slotGarageChoisi && slotChoisi && !slotConflict && (
                <button onClick={async () => {
                  setAssigningSlot(true);
                  try {
                    const { data: occupant } = await supabase
                      .from('prod_items')
                      .select('id, numero, label')
                      .eq('slot_id', slotChoisi)
                      .neq('etat', 'termine')
                      .maybeSingle();
                    if (occupant) {
                      setSlotConflict({ item: occupant, slotId: slotChoisi });
                      return;
                    }
                    const updatedRoadMap = (v.roadMap ?? []).map(e =>
                      GARAGE_TO_SLOTS[slotGarageChoisi]?.includes(slotChoisi) && e.statut === 'en-attente'
                        ? { ...e, statut: 'en-cours' as const } : e
                    );
                    await inventaireService.mettreAJourRoadMap(v.id, updatedRoadMap);
                    onMisAJour({ ...v, roadMap: updatedRoadMap });
                    setShowSlotAssign(false);
                    setSlotGarageChoisi('');
                    setSlotChoisi('');
                  } finally { setAssigningSlot(false); }
                }} disabled={assigningSlot}
                  style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: assigningSlot ? '#e5e7eb' : '#111827', color: assigningSlot ? '#9ca3af' : 'white', fontWeight: 700, fontSize: 14, cursor: assigningSlot ? 'wait' : 'pointer' }}>
                  {assigningSlot ? 'Vérification...' : `✓ Confirmer — Slot ${slotChoisi}`}
                </button>
              )}

              <button onClick={() => { setShowSlotAssign(false); setSlotGarageChoisi(''); setSlotChoisi(''); setSlotConflict(null); }}
                style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', fontSize: 13, cursor: 'pointer', marginTop: 8 }}>
                Annuler
              </button>
            </div>
          )}
        </div>

        {/* ── Statut commercial ── */}
        {(v.type === 'eau' || v.type === 'detail') && (
          <div style={{ margin: '0 20px 16px', display: 'flex', gap: 8 }}>
            {([
              { val: 'non-vendu' as const, label: 'À vendre', color: '#f59e0b' },
              { val: 'reserve'   as const, label: 'Réservé',  color: '#3b82f6' },
              { val: 'vendu'     as const, label: 'Vendu',    color: '#22c55e' },
              { val: 'location'  as const, label: 'Location', color: '#7c3aed' },
            ]).map(({ val, label, color }) => {
              const actif = (v.etatCommercial ?? 'non-vendu') === val;
              return (
                <button key={val} onClick={() => {
                  inventaireService.mettreAJourCommercial(v.id, val, v.dateLivraisonPlanifiee ?? null, v.clientAcheteur ?? null);
                  onMisAJour({ ...v, etatCommercial: val });
                }}
                  style={{ flex: 1, padding: '10px 4px', borderRadius: 10, cursor: 'pointer', border: actif ? `2px solid ${color}` : '1px solid #e5e7eb', background: actif ? `${color}18` : 'white', color: actif ? color : '#9ca3af', fontWeight: actif ? 700 : 400, fontSize: 12 }}>
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Boutons d'action ── */}
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Marquer prêt OU Retirer prêt */}
          {v.estPret ? (
            <button onClick={handleDecocher} disabled={saving}
              style={{ width: '100%', padding: '14px', borderRadius: 14, border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', fontWeight: 600, fontSize: 14, cursor: saving ? 'wait' : 'pointer' }}>
              {saving ? '...' : '↩️ Retirer le statut prêt'}
            </button>
          ) : (
            <button onClick={handleMarquerPret} disabled={saving}
              style={{ width: '100%', padding: '16px', borderRadius: 14, border: 'none', background: saving ? '#e5e7eb' : '#22c55e', color: saving ? '#9ca3af' : 'white', fontWeight: 700, fontSize: 16, cursor: saving ? 'wait' : 'pointer' }}>
              {saving ? 'En cours...' : saved ? '✓ Prêt !' : '✅ Marquer prêt'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Vue principale ──────────────────────────────────────────────────────────

function VueTerrainMain() {
  const [camions, setCamions]           = useState<VehiculeInventaire[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filtreType, setFiltreType]     = useState<FiltreType>('tous');
  const [filtreStatut, setFiltreStatut] = useState<FiltreStatut>('tous');
  const [recherche, setRecherche]       = useState('');
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [showCreation, setShowCreation] = useState(false);

  const charger = async () => {
    const { data } = await supabase
      .from('prod_inventaire')
      .select('*')
      .neq('statut', 'archive')
      .neq('type', 'client')
      .order('numero', { ascending: true });
    setCamions((data ?? []).map(fromDB));
    setLoading(false);
  };

  useEffect(() => { charger(); }, []);

  const q = recherche.trim().toLowerCase();

  const filtrés = camions
    .filter(c => {
      if (filtreType !== 'tous' && c.type !== filtreType) return false;
      if (filtreStatut === 'disponibles' && c.estPret) return false;
      if (filtreStatut === 'prets' && !c.estPret) return false;
      if (filtreStatut === 'vendus' && c.etatCommercial !== 'vendu' && c.etatCommercial !== 'reserve' && c.etatCommercial !== 'location') return false;
      if (q) {
        const haystack = [c.numero, c.marque, c.modele, c.annee?.toString(), c.variante].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (a.estPret && !b.estPret) return 1;
      if (!a.estPret && b.estPret) return -1;
      return a.numero.localeCompare(b.numero);
    });

  const nbPrets = camions.filter(c => c.estPret).length;
  const selected = camions.find(c => c.id === selectedId) ?? null;

  const handleMisAJour = (updated: VehiculeInventaire) => {
    setCamions(prev => prev.map(c => c.id === updated.id ? updated : c));
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 16 }}>
        Chargement...
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '16px 16px 0', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo-camions-dubois-_-noir-bleu-1.png" alt="" style={{ height: 28 }} />
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#111827' }}>Vue Terrain</div>
              <div style={{ fontSize: 12, color: '#9ca3af' }}>{nbPrets} / {camions.length} prêts</div>
            </div>
          </div>
          <button onClick={() => setShowCreation(true)}
            style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: '#f97316', color: 'white', fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
            +
          </button>
        </div>

        {/* Barre de recherche */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#9ca3af' }}>🔍</span>
          <input
            type="search" value={recherche} onChange={e => setRecherche(e.target.value)}
            placeholder="Numéro, marque, modèle..."
            style={{ width: '100%', padding: '10px 12px 10px 38px', borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 15, outline: 'none', boxSizing: 'border-box', background: '#f8fafc' }}
          />
          {recherche && (
            <button onClick={() => setRecherche('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', fontSize: 16, color: '#9ca3af', cursor: 'pointer', padding: 4 }}>✕</button>
          )}
        </div>

        {/* Filtre statut */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8 }}>
          {([
            ['tous',        'Tous',         camions.length],
            ['disponibles', 'Disponibles',  camions.filter(c => !c.estPret).length],
            ['prets',       '✅ Prêts',      camions.filter(c => c.estPret).length],
            ['vendus',      '✓ Non dispo',   camions.filter(c => c.etatCommercial === 'vendu' || c.etatCommercial === 'reserve' || c.etatCommercial === 'location').length],
          ] as [FiltreStatut, string, number][]).map(([id, label, count]) => (
            <button key={id} onClick={() => setFiltreStatut(id)}
              style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: filtreStatut === id ? 700 : 400, border: filtreStatut === id ? 'none' : '1px solid #e5e7eb', background: filtreStatut === id ? '#1d4ed8' : 'white', color: filtreStatut === id ? 'white' : '#6b7280', cursor: 'pointer', flexShrink: 0 }}>
              {label} <span style={{ opacity: 0.75 }}>{count}</span>
            </button>
          ))}
        </div>

        {/* Filtre type */}
        <div style={{ display: 'flex', gap: 6, paddingBottom: 12 }}>
          {([['tous', 'Tous types'], ['eau', '💧 Eau'], ['detail', '🏷️ Détail']] as [FiltreType, string][]).map(([id, label]) => (
            <button key={id} onClick={() => setFiltreType(id)}
              style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: filtreType === id ? 700 : 400, border: filtreType === id ? 'none' : '1px solid #e5e7eb', background: filtreType === id ? '#111827' : 'white', color: filtreType === id ? 'white' : '#6b7280', cursor: 'pointer' }}>
              {label}
            </button>
          ))}
          {filtrés.length !== camions.length && (
            <span style={{ fontSize: 12, color: '#9ca3af', alignSelf: 'center', marginLeft: 4 }}>{filtrés.length} résultat{filtrés.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

      {/* Liste */}
      <div style={{ padding: '8px 12px' }}>
        {filtrés.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🚛</div>
            <div style={{ fontSize: 16 }}>Aucun camion</div>
          </div>
        ) : filtrés.map(camion => {
          const pret = camion.estPret ?? false;
          return (
            <div key={camion.id} onClick={() => setSelectedId(camion.id)}
              style={{ background: pret ? '#f0fdf4' : 'white', borderRadius: 14, border: `1px solid ${pret ? '#86efac' : '#e5e7eb'}`, borderLeft: `4px solid ${pret ? '#22c55e' : camion.type === 'eau' ? '#f97316' : '#22c55e'}`, padding: '14px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', opacity: pret ? 0.75 : 1 }}>
              {camion.photoUrl ? (
                <img src={camion.photoUrl} alt="" style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 52, height: 52, borderRadius: 10, background: camion.type === 'eau' ? '#fff7ed' : '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                  {camion.type === 'eau' ? '💧' : '🏷️'}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 17, color: camion.type === 'eau' ? '#f97316' : '#22c55e' }}>#{camion.numero}</span>
                  {pret && <span style={{ fontSize: 12, background: '#dcfce7', color: '#166534', padding: '1px 7px', borderRadius: 6, fontWeight: 700 }}>✅</span>}
                  {camion.type === 'eau' && !camion.aUnReservoir && !pret && (
                    <span style={{ fontSize: 11, background: '#fff7ed', color: '#c2410c', padding: '1px 7px', borderRadius: 6, fontWeight: 600 }}>⚠️ Sans réservoir</span>
                  )}
                  {camion.type === 'eau' && camion.aUnReservoir && (
                    <span style={{ fontSize: 11, background: '#dcfce7', color: '#166534', padding: '1px 7px', borderRadius: 6, fontWeight: 600 }}>✅ Réservoir</span>
                  )}
                </div>
                <div style={{ fontSize: 14, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[camion.marque, camion.modele, camion.annee].filter(Boolean).join(' ') || (camion.type === 'eau' ? 'Camion à eau' : 'Camion détail')}
                  {camion.variante && ` · ${camion.variante}`}
                </div>
                {/* Étapes progress */}
                {!camion.estPret && (camion.etapesFaites ?? []).some(e => e.fait && e.stationId !== RETOUCHE_ID) && (() => {
                  const nb = CHECKLIST_STATIONS.filter(s => (camion.etapesFaites ?? []).find(e => e.stationId === s.id)?.fait).length;
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <div style={{ flex: 1, height: 4, borderRadius: 2, background: '#e5e7eb', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 2, background: '#f97316', width: `${(nb / CHECKLIST_STATIONS.length) * 100}%`, transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ fontSize: 11, color: '#f97316', fontWeight: 700, flexShrink: 0 }}>{nb}/{CHECKLIST_STATIONS.length}</span>
                    </div>
                  );
                })()}
                {!camion.estPret && (camion.etapesFaites ?? []).find(e => e.stationId === RETOUCHE_ID && e.fait) && (
                  <span style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 4, fontWeight: 700, marginTop: 3, display: 'inline-block' }}>⚠️ Retouche</span>
                )}
              </div>
              <div style={{ color: '#d1d5db', fontSize: 18 }}>›</div>
            </div>
          );
        })}
      </div>

      {selected && (
        <FicheCamion
          vehicule={selected}
          onClose={() => setSelectedId(null)}
          onMisAJour={updated => { handleMisAJour(updated); }}
        />
      )}
      {showCreation && (
        <ModalCreation
          onClose={() => setShowCreation(false)}
          onCree={nouveau => setCamions(prev => [nouveau, ...prev])}
        />
      )}
    </div>
  );
}

// ─── Connexion ───────────────────────────────────────────────────────────────

function EcranConnexion({ onConnecte }: { onConnecte: () => void }) {
  const [email, setEmail]     = useState('');
  const [mdp, setMdp]         = useState('');
  const [erreur, setErreur]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleConnexion = async () => {
    if (!email.trim() || !mdp) return;
    setLoading(true); setErreur('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: mdp });
    if (error) { setErreur('Email ou mot de passe incorrect'); setLoading(false); return; }
    onConnecte();
  };

  const inp: React.CSSProperties = { width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: 16, outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ minHeight: '100vh', background: '#1a1a2e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <img src="/logo-camions-dubois-_-noir-bleu-1.png" alt="Camions Dubois" style={{ height: 60, marginBottom: 20, filter: 'brightness(0) invert(1)' }} />
      <div style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 6 }}>Connexion</div>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 32 }}>Vue Terrain — Camions Dubois</div>

      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input style={inp} type="email" inputMode="email" autoComplete="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input style={inp} type="password" autoComplete="current-password" placeholder="Mot de passe" value={mdp} onChange={e => setMdp(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleConnexion()} />
        {erreur && <div style={{ fontSize: 13, color: '#f87171', textAlign: 'center' }}>{erreur}</div>}
        <button onClick={handleConnexion} disabled={loading || !email.trim() || !mdp}
          style={{ padding: '16px', borderRadius: 12, border: 'none', background: loading || !email.trim() || !mdp ? 'rgba(255,255,255,0.1)' : '#f97316', color: 'white', fontWeight: 700, fontSize: 16, cursor: loading ? 'wait' : 'pointer', marginTop: 8 }}>
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
      </div>
    </div>
  );
}

// ─── Export principal ────────────────────────────────────────────────────────

export function VueTerrain() {
  const [ecran, setEcran] = useState<Ecran>(() =>
    sessionStorage.getItem('terrain_pin_ok') === '1' ? 'ok' : 'pin'
  );

  useEffect(() => {
    if (ecran !== 'ok') return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) setEcran('login');
    });
  }, [ecran]);

  if (ecran === 'pin')   return <EcranPin onSuccess={() => setEcran('ok')} />;
  if (ecran === 'login') return <EcranConnexion onConnecte={() => setEcran('ok')} />;
  return <VueTerrainMain />;
}
