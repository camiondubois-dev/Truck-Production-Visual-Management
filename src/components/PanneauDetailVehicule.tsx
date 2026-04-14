import { useState, useEffect } from 'react';
import { useGarage } from '../hooks/useGarage';
import { useInventaire } from '../contexts/InventaireContext';
import { useAuth } from '../contexts/AuthContext';
import { photoService } from '../services/photoService';
import { reservoirService } from '../services/reservoirService';
import { RoadMapEditor } from './RoadMapEditor';
import { PopupAssignationSlot } from './PopupAssignationSlot';
import { useClients } from '../contexts/ClientContext';
import { supabase } from '../lib/supabase';
import { STATIONS } from '../data/stations';
import { SLOT_TO_GARAGE, STATION_TO_GARAGE } from '../data/garageData';
import type { Item, EtatCommercial, Document } from '../types/item.types';
import type { VehiculeInventaire } from '../types/inventaireTypes';

// ── Types exportés ──────────────────────────────────────────────
export type Section = 'a-planifier' | 'en-attente' | 'dans-le-garage' | 'pret' | 'archive';

export function getSectionVehicule(v: VehiculeInventaire, item?: Item): Section {
  if (v.statut === 'archive') return 'archive';
  if (v.estPret) return 'pret';
  if (item?.slotId) return 'dans-le-garage';
  if (!v.roadMap || v.roadMap.length === 0) return 'a-planifier';
  const active = v.roadMap.filter(s => s.statut !== 'planifie' && s.statut !== 'saute');
  if (active.length === 0) return 'a-planifier';
  if (active.some(s => s.statut === 'en-cours')) return 'dans-le-garage';
  if (active.some(s => s.statut === 'en-attente')) return 'en-attente';
  if (active.every(s => s.statut === 'termine')) return 'pret';
  return 'a-planifier';
}

// ── Badges utilitaires ──────────────────────────────────────────

export function StatutBadgeSection({ section }: { section: Section }) {
  const cfg: Record<Section, { bg: string; color: string; label: string }> = {
    'a-planifier':    { bg: '#f3f4f6', color: '#6b7280', label: '📋 À planifier' },
    'en-attente':     { bg: '#fef3c7', color: '#92400e', label: '⏳ En attente' },
    'dans-le-garage': { bg: '#dbeafe', color: '#1e40af', label: '🔧 En garage' },
    'pret':           { bg: '#dcfce7', color: '#166534', label: '✅ Prêt' },
    'archive':        { bg: '#f9fafb', color: '#9ca3af', label: '📦 Archivé' },
  };
  const c = cfg[section];
  return (
    <span style={{ fontSize: 11, background: c.bg, color: c.color, padding: '4px 8px', borderRadius: 4, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {c.label}
    </span>
  );
}

export function BadgeCommercial({ etat, client }: { etat?: EtatCommercial; client?: string }) {
  if (!etat || etat === 'non-vendu') return null;
  const cfg = etat === 'vendu'
    ? { bg: '#dcfce7', color: '#166534', label: client ? `✓ Vendu — ${client}` : '✓ Vendu' }
    : etat === 'location'
    ? { bg: '#ede9fe', color: '#6d28d9', label: client ? `🔑 Location — ${client}` : '🔑 Location' }
    : { bg: '#fef3c7', color: '#92400e', label: client ? `🔒 Réservé — ${client}` : '🔒 Réservé' };
  return (
    <span style={{ fontSize: 10, background: cfg.bg, color: cfg.color, padding: '2px 7px', borderRadius: 4, fontWeight: 700, width: 'fit-content' }}>
      {cfg.label}
    </span>
  );
}

// ── Modal PDF ───────────────────────────────────────────────────

function ModalPDF({ doc, onClose }: { doc: { nom: string; base64: string }; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '90vw', height: '90vh', background: '#1a1814', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.8)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', background: '#111009', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>📄</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{doc.nom}</span>
          </div>
          <button onClick={onClose} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#ef4444', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✕ Fermer</button>
        </div>
        <iframe src={doc.base64} style={{ flex: 1, width: '100%', border: 'none', background: 'white' }} title={doc.nom} />
      </div>
    </div>
  );
}

// ── Panneau principal ───────────────────────────────────────────

export function PanneauDetailVehicule({ vehicule: v, item, onClose }: {
  vehicule: VehiculeInventaire;
  item?: Item;
  onClose: () => void;
}) {
  const {
    mettreAJourRoadMap, mettreAJourPhotoInventaire,
    marquerPret, mettreAJourCommercial, archiverVehicule, supprimerVehicule,
    marquerDisponible, mettreAJourReservoir,
  } = useInventaire();
  const { supprimerItem, ajouterDocument, supprimerDocument, retirerVersAttente, assignerSlot, slotMap } = useGarage();
  const { profile: session } = useAuth();
  const { clients } = useClients();

  const [confirmerSuppr, setConfirmerSuppr] = useState(false);
  const [confirmerRetour, setConfirmerRetour] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [pdfOuvert, setPdfOuvert] = useState<{ nom: string; base64: string } | null>(null);
  const [popupStation, setPopupStation] = useState<string | null>(null);

  // Réservoir state
  const [reservoirsDisponibles, setReservoirsDisponibles] = useState<{id: string; numero: string; type: string}[]>([]);
  const [reservoirInstalle, setReservoirInstalle] = useState<{numero: string; type: string} | null>(null);
  const [reservoirSelectionne, setReservoirSelectionne] = useState('');
  const [savingReservoir, setSavingReservoir] = useState(false);

  const typeColor = v.type === 'eau' ? '#f97316' : v.type === 'client' ? '#3b82f6' : '#22c55e';
  const isGestion = session?.role === 'gestion';
  const montrerCommercial = v.type === 'eau' || v.type === 'detail';
  const etatCommercial = v.etatCommercial ?? 'non-vendu';
  const clientLie = v.clientId ? clients.find(c => c.id === v.clientId) : null;

  // Charger réservoir
  useEffect(() => {
    if (v.type !== 'eau') return;
    if (v.aUnReservoir && v.reservoirId) {
      supabase.from('prod_reservoirs').select('numero,type').eq('id', v.reservoirId).maybeSingle()
        .then(({ data }) => setReservoirInstalle(data ? { numero: data.numero, type: data.type } : null));
    } else if (!v.aUnReservoir) {
      supabase.from('prod_reservoirs').select('id,numero,type').eq('etat', 'disponible')
        .then(({ data }) => setReservoirsDisponibles((data ?? []).map((r: any) => ({ id: r.id, numero: r.numero, type: r.type }))));
    }
  }, [v.id, v.type, v.aUnReservoir, v.reservoirId]);

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    if (fichier.size > 10 * 1024 * 1024) { alert('Max 10 MB'); return; }
    setUploadingPhoto(true);
    try {
      if (v.photoUrl) await photoService.supprimerPhoto(v.photoUrl);
      const url = await photoService.uploaderPhoto(fichier, 'items');
      await mettreAJourPhotoInventaire(v.id, url);
    } catch { alert("Erreur lors de l'upload de la photo"); }
    finally { setUploadingPhoto(false); }
    e.target.value = '';
  };

  const handleSupprimerPhoto = async () => {
    if (!v.photoUrl) return;
    await photoService.supprimerPhoto(v.photoUrl);
    await mettreAJourPhotoInventaire(v.id, null);
  };

  const handleRetourInventaire = async () => {
    await marquerDisponible(v.id);
    if (item) await supprimerItem(item.id);
    onClose();
  };

  const changerEtatCommercial = async (val: EtatCommercial) => {
    await mettreAJourCommercial(v.id, val,
      v.dateLivraisonPlanifiee ?? null,
      val === 'non-vendu' ? null : (v.clientAcheteur ?? null)
    );
  };

  const changerClientAcheteur = async (nom: string) => {
    await mettreAJourCommercial(v.id, etatCommercial as EtatCommercial, v.dateLivraisonPlanifiee ?? null, nom || null);
  };

  const changerDateLivraison = async (date: string) => {
    await mettreAJourCommercial(v.id, etatCommercial as EtatCommercial, date || null, v.clientAcheteur ?? null);
  };

  // Réservoir handlers
  const handleAssignerReservoir = async () => {
    if (!reservoirSelectionne) return;
    setSavingReservoir(true);
    try {
      await reservoirService.installerSurInventaire(reservoirSelectionne, v.id);
      await mettreAJourReservoir(v.id, true, reservoirSelectionne);
    } finally { setSavingReservoir(false); }
  };
  const handleMarquerAvecReservoir = async () => {
    setSavingReservoir(true);
    try {
      await mettreAJourReservoir(v.id, true, null);
      if (v.jobId) await supabase.from('prod_items').update({ a_un_reservoir: true, reservoir_id: null }).eq('inventaire_id', v.id);
    } finally { setSavingReservoir(false); }
  };
  const handleRetirerReservoir = async () => {
    setSavingReservoir(true);
    try {
      if (v.reservoirId) await reservoirService.desinstallerDeInventaire(v.reservoirId, v.id);
      await mettreAJourReservoir(v.id, false, null);
    } finally { setSavingReservoir(false); }
  };

  return (
    <>
      <div onClick={e => e.stopPropagation()} style={{
        position: 'fixed', right: 0, top: 0, width: 380, height: '100dvh',
        background: 'white', borderLeft: '1px solid #e5e7eb',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.1)', overflowY: 'auto', zIndex: 150,
      }}>
        <div style={{ padding: 20 }}>
          <button onClick={onClose}
            style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >✕</button>

          {/* ── En-tête ─────────────────────────── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 26, fontWeight: 700, color: typeColor, marginBottom: 4 }}>
              #{v.numero}
            </div>
            <div style={{ fontSize: 14, color: '#374151', marginBottom: 10 }}>
              {v.marque} {v.modele} {v.annee ? `(${v.annee})` : ''}{v.variante ? ` — ${v.variante}` : ''}
              {v.nomClient && <span> — {v.nomClient}</span>}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <StatutBadgeSection section={getSectionVehicule(v, item)} />
              {item?.slotId && (
                <span style={{ fontSize: 11, background: '#eff6ff', color: '#1d4ed8', padding: '3px 8px', borderRadius: 4, fontWeight: 600, fontFamily: 'monospace' }}>
                  Slot {item.slotId}
                </span>
              )}
              {v.estPret && (
                <span style={{ fontSize: 11, background: '#dcfce7', color: '#166534', padding: '3px 8px', borderRadius: 4, fontWeight: 600 }}>✅ Prêt</span>
              )}
              <BadgeCommercial etat={v.etatCommercial} client={v.clientAcheteur} />
            </div>
          </div>

          {/* ── Photo ────────────────────────────── */}
          <div style={{ marginBottom: 20 }}>
            {v.photoUrl ? (
              <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                <img src={v.photoUrl} alt={`Photo ${v.numero}`}
                  style={{ width: '100%', height: 190, objectFit: 'cover', display: 'block' }} />
                <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
                  <label style={{ padding: '5px 10px', borderRadius: 6, cursor: 'pointer', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 11, fontWeight: 600 }}>
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUploadPhoto} />
                    📷 Changer
                  </label>
                  <button onClick={handleSupprimerPhoto}
                    style={{ padding: '5px 10px', borderRadius: 6, cursor: 'pointer', background: 'rgba(239,68,68,0.8)', color: 'white', border: 'none', fontSize: 11, fontWeight: 600 }}>
                    🗑
                  </button>
                </div>
                {uploadingPhoto && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14 }}>
                    ⏳ Upload en cours...
                  </div>
                )}
              </div>
            ) : (
              <label style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 8, padding: '20px', borderRadius: 10, border: '2px dashed #d1d5db',
                background: '#f8fafc', color: '#9ca3af', cursor: 'pointer', transition: 'all 0.15s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLLabelElement).style.borderColor = typeColor; (e.currentTarget as HTMLLabelElement).style.color = typeColor; }}
                onMouseLeave={e => { (e.currentTarget as HTMLLabelElement).style.borderColor = '#d1d5db'; (e.currentTarget as HTMLLabelElement).style.color = '#9ca3af'; }}
              >
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUploadPhoto} />
                <span style={{ fontSize: 28 }}>📷</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  {uploadingPhoto ? '⏳ Upload en cours...' : 'Ajouter une photo'}
                </span>
              </label>
            )}
          </div>

          {/* ── Statut commercial ───────────────── */}
          {montrerCommercial && (
            <div style={{ marginBottom: 20, padding: 14, borderRadius: 10, background: '#f8fafc', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Statut commercial</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: etatCommercial !== 'non-vendu' ? 10 : 0 }}>
                {([
                  { val: 'non-vendu' as EtatCommercial, label: 'Non vendu', icon: '○', color: '#6b7280' },
                  { val: 'reserve'   as EtatCommercial, label: 'Réservé',   icon: '🔒', color: '#f59e0b' },
                  { val: 'vendu'     as EtatCommercial, label: 'Vendu',     icon: '✓', color: '#22c55e' },
                  { val: 'location'  as EtatCommercial, label: 'Location',  icon: '🔑', color: '#7c3aed' },
                ]).map(({ val, label, icon, color }) => (
                  <button key={val} onClick={() => changerEtatCommercial(val)}
                    style={{
                      flex: 1, padding: '7px 3px', borderRadius: 8, cursor: 'pointer',
                      border: etatCommercial === val ? `2px solid ${color}` : '1px solid #e5e7eb',
                      background: etatCommercial === val ? `${color}15` : 'white',
                      color: etatCommercial === val ? color : '#9ca3af',
                      fontWeight: etatCommercial === val ? 700 : 400,
                      fontSize: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{icon}</span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              {(etatCommercial === 'reserve' || etatCommercial === 'vendu' || etatCommercial === 'location') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input type="text" defaultValue={v.clientAcheteur ?? ''} onBlur={e => changerClientAcheteur(e.target.value)}
                    placeholder="Nom du client (optionnel)"
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                  <input type="date" defaultValue={v.dateLivraisonPlanifiee ?? ''} onBlur={e => changerDateLivraison(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              )}
            </div>
          )}

          {/* ── Réservoir (eau seulement) ────────── */}
          {v.type === 'eau' && (
            <div style={{ marginBottom: 20, padding: 14, borderRadius: 10, background: '#f8fafc', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>🛢 Réservoir</div>
              {v.aUnReservoir ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 11, background: '#dcfce7', color: '#166534', padding: '3px 8px', borderRadius: 4, fontWeight: 700 }}>
                      ✅ {reservoirInstalle ? `#${reservoirInstalle.numero} — ${reservoirInstalle.type}` : 'Réservoir installé (hors inventaire)'}
                    </span>
                  </div>
                  <button onClick={handleRetirerReservoir} disabled={savingReservoir}
                    style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #fca5a5', background: 'transparent', color: '#ef4444', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                    {savingReservoir ? '...' : '✕ Retirer le réservoir'}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {reservoirsDisponibles.length > 0 && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <select value={reservoirSelectionne} onChange={e => setReservoirSelectionne(e.target.value)}
                        style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, outline: 'none' }}>
                        <option value="">Choisir un réservoir...</option>
                        {reservoirsDisponibles.map(r => (
                          <option key={r.id} value={r.id}>#{r.numero} — {r.type}</option>
                        ))}
                      </select>
                      <button onClick={handleAssignerReservoir} disabled={!reservoirSelectionne || savingReservoir}
                        style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: '#22c55e', color: 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer', opacity: !reservoirSelectionne ? 0.5 : 1 }}>
                        {savingReservoir ? '...' : '✓'}
                      </button>
                    </div>
                  )}
                  <button onClick={handleMarquerAvecReservoir} disabled={savingReservoir}
                    style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #d1d5db', background: 'transparent', color: '#6b7280', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                    {savingReservoir ? '...' : '🛢 Marquer comme ayant un réservoir (hors inventaire)'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Road Map ─────────────────────────── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              🗺 Plan de production
            </div>
            <RoadMapEditor
              vehicule={v}
              onSaved={(updated) => {
                // Si une étape "en-cours" existe et le camion n'est pas dans un slot
                // → ouvrir le popup d'assignation de slot automatiquement
                const enCoursStep = updated.roadMap?.find(s => s.statut === 'en-cours');
                if (enCoursStep && item && !item.slotId) {
                  const garageId = STATION_TO_GARAGE[enCoursStep.stationId];
                  if (garageId) setPopupStation(garageId);
                }
              }}
              compact={false}
            />
          </div>

          {/* ── Informations ─────────────────────── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Informations</div>
            <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.9 }}>
              {v.variante          && <div><span style={{ fontWeight: 600 }}>Variante:</span> {v.variante}</div>}
              {v.marque            && <div><span style={{ fontWeight: 600 }}>Marque:</span> {v.marque}</div>}
              {v.modele            && <div><span style={{ fontWeight: 600 }}>Modèle:</span> {v.modele}</div>}
              {v.annee             && <div><span style={{ fontWeight: 600 }}>Année:</span> {v.annee}</div>}
              {v.nomClient         && <div><span style={{ fontWeight: 600 }}>Client:</span> {v.nomClient}</div>}
              {v.telephone         && <div><span style={{ fontWeight: 600 }}>Téléphone:</span> {v.telephone}</div>}
              {v.vehicule          && <div><span style={{ fontWeight: 600 }}>Véhicule:</span> {v.vehicule}</div>}
              {v.descriptionTravail && <div><span style={{ fontWeight: 600 }}>Description:</span> {v.descriptionTravail}</div>}
            </div>
          </div>

          {/* ── Fiche client ─────────────────────── */}
          {clientLie && (
            <div style={{ marginBottom: 20, padding: 14, borderRadius: 10, background: '#f0f9ff', border: '1px solid #bae6fd' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0369a1', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>👤 Fiche client</div>
              <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.8 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{clientLie.nom}</div>
                {clientLie.telephone && <div>📞 {clientLie.telephone}</div>}
                {clientLie.email     && <div>✉️ {clientLie.email}</div>}
                {clientLie.adresse   && <div>📍 {clientLie.adresse}</div>}
              </div>
            </div>
          )}

          {/* ── Documents (si prod_item lié) ─────── */}
          {item && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>📎 Documents</span>
                <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>{item.documents?.length ?? 0}/3</span>
              </div>
              {(item.documents ?? []).map(doc => (
                <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 6, borderRadius: 8, border: '1px solid #e5e7eb', background: '#f8fafc' }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>📄</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.nom}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{doc.taille}</div>
                  </div>
                  <button onClick={() => setPdfOuvert({ nom: doc.nom, base64: doc.base64 })}
                    style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid #3b82f6', background: 'transparent', color: '#3b82f6', fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                    👁 Voir
                  </button>
                  <button onClick={() => supprimerDocument(item.id, doc.id)}
                    style={{ padding: '4px 8px', borderRadius: 5, border: '1px solid #fca5a5', background: 'transparent', color: '#ef4444', fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                    🗑
                  </button>
                </div>
              ))}
              {(item.documents?.length ?? 0) < 3 && (
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', borderRadius: 8, border: '1.5px dashed #d1d5db', background: 'white', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLLabelElement).style.borderColor = '#3b82f6'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLLabelElement).style.borderColor = '#d1d5db'; }}
                >
                  <input type="file" accept=".pdf,application/pdf" style={{ display: 'none' }}
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 10 * 1024 * 1024) { alert('Max 10 MB'); return; }
                      const reader = new FileReader();
                      reader.onload = () => {
                        const base64 = reader.result as string;
                        const tailleKB = Math.round(file.size / 1024);
                        const taille = tailleKB > 1024 ? `${(tailleKB / 1024).toFixed(1)} MB` : `${tailleKB} KB`;
                        const doc: Document = { id: `doc-${Date.now()}`, nom: file.name, taille, dateUpload: new Date().toISOString(), base64 };
                        ajouterDocument(item.id, doc);
                      };
                      reader.readAsDataURL(file);
                      e.target.value = '';
                    }}
                  />
                  + Ajouter un document PDF
                </label>
              )}
            </div>
          )}

          {/* ── Actions slot (si dans un slot) ─────── */}
          {item?.slotId && (() => {
            const garageId = SLOT_TO_GARAGE[item.slotId];
            const station = STATIONS.find(s => s.id === garageId);
            const autresSlots = station?.slots.filter(s => !s.futur && s.id !== item.slotId && !slotMap[s.id]) ?? [];
            return (
              <div style={{ marginBottom: 20, padding: 14, borderRadius: 10, background: '#fffbeb', border: '1px solid #fde68a' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  🔧 Slot {item.slotId} — {station?.label ?? garageId}
                </div>
                {/* Mettre en attente */}
                <button onClick={() => { retirerVersAttente(item.id); onClose(); }}
                  style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: '#f59e0b', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  ⏸ Mettre en attente — libérer le slot
                </button>
                {/* Changer de slot */}
                {autresSlots.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, color: '#92400e', marginBottom: 6, fontWeight: 600 }}>Changer de slot :</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {autresSlots.map(s => (
                        <button key={s.id} onClick={() => { assignerSlot(item.id, s.id); }}
                          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: 'white', color: '#374151', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'monospace' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#fef3c7'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}
                        >
                          {s.id}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Marquer prêt ─────────────────────── */}
          {!v.estPret && v.statut !== 'archive' && (
            <div style={{ marginBottom: 14 }}>
              <button onClick={() => marquerPret(v.id, true)}
                style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: '#22c55e', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                ✅ Marquer comme prêt
              </button>
            </div>
          )}
          {v.estPret && (
            <div style={{ marginBottom: 14 }}>
              <button onClick={() => marquerPret(v.id, false)}
                style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #22c55e', background: 'transparent', color: '#22c55e', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                ↩ Retirer le statut Prêt
              </button>
            </div>
          )}

          {/* ── Retour inventaire ────────────────── */}
          {item && v.statut !== 'archive' && (
            <div style={{ marginBottom: 14 }}>
              {!confirmerRetour ? (
                <button onClick={() => setConfirmerRetour(true)}
                  style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #3b82f6', background: 'transparent', color: '#3b82f6', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  ↩ Retourner à l'inventaire
                </button>
              ) : (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 6 }}>Retourner ce véhicule à l'inventaire?</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>Le job de production sera supprimé et le véhicule redeviendra disponible.</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setConfirmerRetour(false)}
                      style={{ flex: 1, padding: '8px', borderRadius: 6, border: '1px solid #d1d5db', background: 'white', color: '#374151', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>
                      Annuler
                    </button>
                    <button onClick={handleRetourInventaire}
                      style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: '#3b82f6', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
                      ↩ Confirmer
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Archiver ─────────────────────────── */}
          {v.statut !== 'archive' && isGestion && (
            <div style={{ marginBottom: 14 }}>
              <button onClick={() => { archiverVehicule(v.id); onClose(); }}
                style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #22c55e', background: 'transparent', color: '#22c55e', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                🏁 Archiver ce véhicule
              </button>
            </div>
          )}

          {/* ── Supprimer ────────────────────────── */}
          {isGestion && (
            <div style={{ borderTop: '1px solid #fee2e2', paddingTop: 14 }}>
              {!confirmerSuppr ? (
                <button onClick={() => setConfirmerSuppr(true)}
                  style={{ width: '100%', padding: '10px', borderRadius: 7, border: '1px solid #fca5a5', background: 'transparent', color: '#ef4444', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                  🗑 Supprimer ce véhicule
                </button>
              ) : (
                <div style={{ background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#991b1b', marginBottom: 6 }}>⚠️ Confirmer la suppression</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>#{v.numero} — Action irréversible.</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setConfirmerSuppr(false)}
                      style={{ flex: 1, padding: '8px', borderRadius: 6, border: '1px solid #d1d5db', background: 'white', color: '#374151', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>
                      Annuler
                    </button>
                    <button onClick={() => { supprimerVehicule(v.id); if (item) supprimerItem(item.id); onClose(); }}
                      style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: '#ef4444', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
                      🗑 Supprimer
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {popupStation && item && (
          <PopupAssignationSlot
            camion={item}
            prochaineStation={popupStation}
            onAssigned={() => setPopupStation(null)}
            onMettreEnAttente={() => setPopupStation(null)}
          />
        )}
      </div>

      {pdfOuvert && <ModalPDF doc={pdfOuvert} onClose={() => setPdfOuvert(null)} />}
    </>
  );
}
