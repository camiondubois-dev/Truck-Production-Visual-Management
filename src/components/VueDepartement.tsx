import { useAuth } from '../contexts/AuthContext';
import { useGarage } from '../contexts/GarageContext';
import { useInventaire } from '../contexts/InventaireContext';
import { EauIcon } from './EauIcon';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { SlotAssignModal } from './SlotAssignModal';
import { PanneauDetailVehicule } from './PanneauDetailVehicule';
import { TOUTES_STATIONS_COMMUNES } from '../data/mockData';
import { reservoirService } from '../services/reservoirService';
import type { Reservoir, TypeReservoir } from '../types/reservoirTypes';
import type { Item, Document } from '../types/item.types';
import type { VehiculeInventaire } from '../types/inventaireTypes';

// ── Constantes réservoirs ──────────────────────────────────────
const TYPES_RESERVOIR: TypeReservoir[] = ['2500g', '3750g', '4000g', '5000g'];
const TYPE_COLORS: Record<TypeReservoir, string> = {
  '2500g': '#22c55e', '3750g': '#4a9eff', '4000g': '#f97316', '5000g': '#ef4444',
};
const ETAT_CFG: Record<string, { color: string; label: string; icon: string }> = {
  'disponible':  { color: '#22c55e', label: 'Disponible', icon: '✓' },
  'installe':    { color: '#0ea5e9', label: 'Installé',   icon: '🔧' },
  'en-peinture': { color: '#f59e0b', label: 'Peinture',   icon: '🎨' },
};

// ── Panneau Réservoirs ─────────────────────────────────────────
function PanneauReservoirs({ onClose }: { onClose: () => void }) {
  const [reservoirs, setReservoirs] = useState<Reservoir[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtre, setFiltre] = useState<'tous' | TypeReservoir>('tous');
  const [filtreEtat, setFiltreEtat] = useState<'tous' | 'disponible' | 'installe' | 'en-peinture'>('tous');
  const [ajoutMode, setAjoutMode] = useState(false);
  const [ajoutNumero, setAjoutNumero] = useState('');
  const [ajoutType, setAjoutType] = useState<TypeReservoir>('2500g');
  const [ajoutNotes, setAjoutNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const charger = useCallback(async () => {
    try {
      const data = await reservoirService.getAll();
      setReservoirs(data);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const resFiltres = reservoirs.filter(r => {
    if (filtre !== 'tous' && r.type !== filtre) return false;
    if (filtreEtat !== 'tous' && r.etat !== filtreEtat) return false;
    return true;
  });

  const stats = {
    total: reservoirs.length,
    disponibles: reservoirs.filter(r => r.etat === 'disponible').length,
    installes: reservoirs.filter(r => r.etat === 'installe').length,
    peinture: reservoirs.filter(r => r.etat === 'en-peinture').length,
  };

  const handleAjouter = async () => {
    if (!ajoutNumero.trim()) return;
    setSaving(true);
    try {
      const nouveau: Reservoir = {
        id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        numero: ajoutNumero.trim(),
        type: ajoutType,
        etat: 'disponible',
        notes: ajoutNotes.trim() || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await reservoirService.ajouter(nouveau);
      setAjoutNumero(''); setAjoutNotes(''); setAjoutMode(false);
      await charger();
    } catch (err: any) {
      alert(`Erreur: ${err?.message ?? err}`);
    }
    setSaving(false);
  };

  const changerEtat = async (r: Reservoir, nouvelEtat: 'disponible' | 'en-peinture') => {
    try {
      const { error } = await (await import('../lib/supabase')).supabase
        .from('prod_reservoirs')
        .update({ etat: nouvelEtat, updated_at: new Date().toISOString() })
        .eq('id', r.id);
      if (error) throw error;
      await charger();
    } catch (err: any) {
      alert(`Erreur: ${err?.message ?? err}`);
    }
  };

  return (
    <div onClick={e => e.stopPropagation()} style={{
      position: 'fixed', top: 0, right: 0, bottom: 0,
      width: Math.min(420, window.innerWidth - 20),
      background: '#111009', borderLeft: '2px solid rgba(14,165,233,0.3)',
      zIndex: 400, display: 'flex', flexDirection: 'column',
      boxShadow: '-8px 0 32px rgba(0,0,0,0.6)',
    }}>
      {/* Header */}
      <div style={{
        padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>🛢</span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>Réservoirs</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
              {stats.disponibles} dispo · {stats.installes} inst. · {stats.peinture} peint.
            </div>
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
          fontSize: 20, cursor: 'pointer', padding: 4,
        }}>✕</button>
      </div>

      {/* Compteurs rapides */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 20px', flexShrink: 0 }}>
        {[
          { label: 'Dispo', count: stats.disponibles, color: '#22c55e' },
          { label: 'Installé', count: stats.installes, color: '#0ea5e9' },
          { label: 'Peinture', count: stats.peinture, color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, textAlign: 'center', padding: '10px 6px',
            borderRadius: 8, background: `${s.color}12`, border: `1px solid ${s.color}30`,
          }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color, fontFamily: 'monospace' }}>{s.count}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ padding: '0 20px 10px', display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
        {(['tous', ...TYPES_RESERVOIR] as const).map(t => (
          <button key={t} onClick={() => setFiltre(t as any)} style={{
            padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', border: 'none',
            background: filtre === t ? (t === 'tous' ? '#ffffff20' : `${TYPE_COLORS[t as TypeReservoir]}30`) : 'rgba(255,255,255,0.05)',
            color: filtre === t ? (t === 'tous' ? 'white' : TYPE_COLORS[t as TypeReservoir]) : 'rgba(255,255,255,0.4)',
          }}>{t === 'tous' ? 'Tous' : t}</button>
        ))}
        <div style={{ width: 1, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
        {(['tous', 'disponible', 'installe', 'en-peinture'] as const).map(e => (
          <button key={e} onClick={() => setFiltreEtat(e)} style={{
            padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
            cursor: 'pointer', border: 'none',
            background: filtreEtat === e ? `${ETAT_CFG[e]?.color ?? '#fff'}25` : 'rgba(255,255,255,0.05)',
            color: filtreEtat === e ? (ETAT_CFG[e]?.color ?? 'white') : 'rgba(255,255,255,0.35)',
          }}>{e === 'tous' ? 'Tous' : ETAT_CFG[e]?.label ?? e}</button>
        ))}
      </div>

      {/* Liste */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)' }}>Chargement...</div>
        ) : resFiltres.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)' }}>Aucun réservoir</div>
        ) : (
          resFiltres.map(r => {
            const tc = TYPE_COLORS[r.type];
            const ec = ETAT_CFG[r.etat] ?? { color: '#64748b', label: r.etat, icon: '?' };
            return (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', marginBottom: 6, borderRadius: 10,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                {/* Type badge */}
                <div style={{
                  padding: '4px 10px', borderRadius: 6,
                  background: `${tc}20`, color: tc,
                  fontWeight: 700, fontSize: 13, fontFamily: 'monospace',
                  flexShrink: 0, minWidth: 55, textAlign: 'center',
                }}>{r.type}</div>
                {/* Numéro + notes */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'white', fontSize: 15 }}>
                    {r.numero}
                  </div>
                  {r.notes && (
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.notes}
                    </div>
                  )}
                </div>
                {/* État */}
                <div style={{
                  padding: '4px 10px', borderRadius: 6,
                  background: `${ec.color}15`, color: ec.color,
                  fontWeight: 700, fontSize: 12, flexShrink: 0,
                }}>
                  {ec.icon} {ec.label}
                </div>
                {/* Actions rapides (seulement pour dispo/peinture) */}
                {r.etat === 'disponible' && (
                  <button onClick={() => changerEtat(r, 'en-peinture')} title="Envoyer en peinture"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 4 }}>🎨</button>
                )}
                {r.etat === 'en-peinture' && (
                  <button onClick={() => changerEtat(r, 'disponible')} title="Marquer disponible"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 4 }}>✅</button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Formulaire d'ajout */}
      {ajoutMode ? (
        <div style={{
          padding: 20, borderTop: '1px solid rgba(255,255,255,0.1)',
          background: '#0a0908', flexShrink: 0,
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 12 }}>
            + Nouveau réservoir
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              placeholder="Numéro du réservoir"
              value={ajoutNumero}
              onChange={e => setAjoutNumero(e.target.value)}
              autoFocus
              style={{
                padding: '10px 14px', borderRadius: 8,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                color: 'white', fontSize: 14, outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              {TYPES_RESERVOIR.map(t => (
                <button key={t} onClick={() => setAjoutType(t)} style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, fontSize: 14, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'monospace',
                  border: ajoutType === t ? `2px solid ${TYPE_COLORS[t]}` : '1px solid rgba(255,255,255,0.1)',
                  background: ajoutType === t ? `${TYPE_COLORS[t]}20` : 'rgba(255,255,255,0.03)',
                  color: ajoutType === t ? TYPE_COLORS[t] : 'rgba(255,255,255,0.4)',
                }}>{t}</button>
              ))}
            </div>
            <input
              placeholder="Notes (optionnel)"
              value={ajoutNotes}
              onChange={e => setAjoutNotes(e.target.value)}
              style={{
                padding: '10px 14px', borderRadius: 8,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                color: 'white', fontSize: 13, outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setAjoutMode(false)} style={{
                flex: 1, padding: '10px', borderRadius: 8,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>Annuler</button>
              <button onClick={handleAjouter} disabled={saving || !ajoutNumero.trim()} style={{
                flex: 1, padding: '10px', borderRadius: 8,
                background: saving ? '#22c55e40' : '#22c55e', border: 'none',
                color: 'white', fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer',
                opacity: !ajoutNumero.trim() ? 0.4 : 1,
              }}>{saving ? '...' : '✓ Ajouter'}</button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
          <button onClick={() => setAjoutMode(true)} style={{
            width: '100%', padding: '12px', borderRadius: 10,
            background: 'rgba(14,165,233,0.1)', border: '1.5px dashed rgba(14,165,233,0.4)',
            color: '#0ea5e9', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>
            + Ajouter un réservoir
          </button>
        </div>
      )}
    </div>
  );
}

interface DepartementConfig {
  label: string;
  icon: string;
  color: string;
  cols: number;
  slots: string[];
}

const DEPARTEMENTS_CONFIG: Record<string, DepartementConfig> = {
  'soudure-generale':    { label: 'Soudure générale',      icon: '🔥', color: '#f97316', cols: 1, slots: ['17'] },
  'mecanique-generale':  { label: 'Mécanique générale',    icon: '🔧', color: '#3b82f6', cols: 2, slots: ['9A', '10A', '9B', '10B'] },
  'mecanique-moteur':    { label: 'Mécanique moteur',      icon: '⚙️', color: '#3b82f6', cols: 3, slots: ['11', '12', '13', '16', '15', '14'] },
  'sous-traitants':      { label: 'Sous-traitants',        icon: '🤝', color: '#a855f7', cols: 2, slots: ['S-01', 'S-02', 'S-03', 'S-04', 'S-05', 'S-06'] },
  'soudure-specialisee': { label: 'Soudure spécialisée', icon: '⚡', color: '#f97316', cols: 2, slots: ['5', '6', '4', '3'] },
  'peinture':            { label: 'Peinture',              icon: '🎨', color: '#6b7280', cols: 2, slots: ['7', '8', '2', '1'] },
};

type ModalState =
  | { type: 'detail'; vehiculeId: string; itemId?: string }
  | { type: 'assign'; slot: { id: string }; position: { x: number; y: number } }
  | null;

// ── Badge commercial ──────────────────────────────────────────

function BadgeCommercialSlot({ item }: { item: Item }) {
  if (!item.etatCommercial || item.etatCommercial === 'non-vendu') return null;

  const isVendu = item.etatCommercial === 'vendu';
  const color = isVendu ? '#ef4444' : '#f59e0b';
  const label = isVendu
    ? `✓ VENDU${item.clientAcheteur ? ` — ${item.clientAcheteur}` : ''}`
    : `🔒 RÉSERVÉ${item.clientAcheteur ? ` — ${item.clientAcheteur}` : ''}`;

  return (
    <div style={{
      marginTop: 10,
      padding: '6px 12px',
      borderRadius: 6,
      background: `${color}22`,
      border: `2px solid ${color}`,
      color,
      fontWeight: 800,
      fontSize: 13,
      textAlign: 'center',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
    }}>
      {label}
    </div>
  );
}

export const VueDepartement = () => {
  const { profile, deconnexion } = useAuth();
  const { items, slotMap, enAttente, assignerSlot, ajouterDocument } = useGarage();
  const { vehicules } = useInventaire();

  const [modeTV, setModeTV] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [modalState, setModalState] = useState<ModalState>(null);
  const [pdfOuvert, setPdfOuvert] = useState<{ nom: string; base64: string } | null>(null);
  const [panneauReservoirs, setPanneauReservoirs] = useState(false);

  const dept = DEPARTEMENTS_CONFIG[profile?.departement ?? ''];

  // vehiculesComplets : mêmes données que PlancherView et VueAsana
  const vehiculesComplets = useMemo(() => {
    const invIds = new Set(vehicules.map(v => v.id));
    const orphelins: VehiculeInventaire[] = items
      .filter(i => i.etat !== 'termine' && (!i.inventaireId || !invIds.has(i.inventaireId)))
      .map(i => ({
        id: i.inventaireId || i.id,
        statut: 'en-production' as const,
        dateImport: i.dateCreation ?? new Date().toISOString(),
        dateEnProduction: i.dateCreation,
        jobId: i.id,
        numero: i.numero ?? '',
        type: i.type as 'eau' | 'client' | 'detail',
        nomClient: i.nomClient,
        telephone: i.telephone,
        vehicule: i.vehicule,
        descriptionTravail: i.descriptionTravail,
        descriptionTravaux: i.descriptionTravaux,
        notes: i.notes,
        roadMap: (i.stationsActives ?? []).map((sid: string, idx: number) => {
          const prog = i.progression?.find((p: any) => p.stationId === sid);
          const statut = prog?.status === 'termine' ? 'termine' as const
            : prog?.status === 'en-cours' ? 'en-cours' as const
            : 'en-attente' as const;
          return { id: `synth-${i.id}-${idx}`, stationId: sid, statut, priorite: idx + 1, ordre: idx + 1 };
        }),
        estPret: false,
        etatCommercial: i.etatCommercial as any ?? 'non-vendu',
      }));
    return [...vehicules, ...orphelins];
  }, [vehicules, items]);

  useEffect(() => {
    if (!modeTV) return;
    const interval = setInterval(() => setLastRefresh(new Date()), 30000);
    return () => clearInterval(interval);
  }, [modeTV]);

  if (!dept) {
    return (
      <div style={{
        width: '100vw', height: '100dvh', background: '#0d0c08',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        color: 'white', fontFamily: 'monospace', gap: 16, padding: 40,
      }}>
        <div style={{ fontSize: 48 }}>⚠️</div>
        <div style={{ fontSize: 20, fontWeight: 700, textAlign: 'center' }}>
          Département non configuré
        </div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', maxWidth: 500, lineHeight: 1.6 }}>
          Votre profil n'a pas de département assigné ou le département
          «&nbsp;{profile?.departement ?? '(vide)'}&nbsp;» n'est pas reconnu.
          <br /><br />
          Départements valides : {Object.keys(DEPARTEMENTS_CONFIG).join(', ')}
        </div>
        <button
          onClick={() => deconnexion()}
          style={{
            marginTop: 16, padding: '10px 24px', borderRadius: 8,
            background: '#ef4444', color: 'white', border: 'none',
            fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}
        >
          ← Se déconnecter
        </button>
      </div>
    );
  }

  const itemsEnAttente = items.filter(item => {
    if (item.etat !== 'en-attente') return false;
    if (item.dernierGarageId) return item.dernierGarageId === profile?.departement;
    return false;
  });

  const handleSlotClick = (e: React.MouseEvent, slotId: string) => {
    if (modeTV) return;
    e.stopPropagation();

    const item = slotMap[slotId];
    if (item) {
      // Slot occupé → ouvrir le panneau détail unifié (même que PlancherView/VueAsana)
      setModalState({ type: 'detail', vehiculeId: item.inventaireId || item.id, itemId: item.id });
    } else {
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      let x = rect.right + 10;
      let y = rect.top;
      if (x + 360 > window.innerWidth) x = rect.left - 370;
      if (y + 500 > window.innerHeight) y = window.innerHeight - 510;
      setModalState({ type: 'assign', slot: { id: slotId }, position: { x, y } });
    }
  };

  const ouvrirDoc = (e: React.MouseEvent, doc: { nom: string; base64: string }) => {
    e.stopPropagation();
    setPdfOuvert(doc);
  };

  return (
    <div
      onClick={() => setModalState(null)}
      style={{
        width: '100vw', height: '100dvh',
        background: '#0d0c08',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ── HEADER ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 24px',
        borderBottom: `2px solid ${dept.color}44`,
        background: '#111009',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            onClick={(e) => { e.stopPropagation(); deconnexion(); }}
            title="Retour au menu principal"
            style={{ cursor: 'pointer', flexShrink: 0, transition: 'opacity 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.opacity = '0.7'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = '1'; }}
          >
            <img
              src="/logo-camions-dubois-_-noir-bleu-1.png"
              alt="Camions Dubois"
              style={{ height: 34, objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
            />
          </div>

          <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.1)' }} />

          <span style={{ fontSize: 28 }}>{dept.icon}</span>
          <div>
            <div style={{
              fontFamily: 'monospace', fontSize: 22, fontWeight: 700,
              color: dept.color, letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              {dept.label}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
              {modeTV
                ? `Actualisation auto · ${lastRefresh.toLocaleTimeString('fr-CA')}`
                : 'Mode interactif — cliquez sur un slot pour modifier'
              }
            </div>
          </div>
        </div>

        {!modeTV ? (
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={(e) => { e.stopPropagation(); setPanneauReservoirs(true); }}
              style={{
                padding: '8px 16px', borderRadius: 8,
                background: panneauReservoirs ? 'rgba(14,165,233,0.15)' : 'rgba(255,255,255,0.05)',
                border: panneauReservoirs ? '1px solid rgba(14,165,233,0.4)' : '1px solid rgba(255,255,255,0.15)',
                color: panneauReservoirs ? '#0ea5e9' : 'rgba(255,255,255,0.6)',
                cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}
            >
              🛢 Réservoirs
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setModeTV(true); }}
              style={{
                padding: '8px 16px', borderRadius: 8,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 12,
              }}
            >
              📺 Mode TV
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); deconnexion(); }}
              style={{
                padding: '8px 16px', borderRadius: 8, background: 'transparent',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 12,
              }}
            >
              ← Changer
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setModeTV(false); }}
            style={{
              padding: '6px 14px', borderRadius: 8, background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: 11,
            }}
          >
            Sortir mode TV
          </button>
        )}
      </div>

      {/* ── GRILLE DES SLOTS ── */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: `repeat(${dept.cols}, 1fr)`,
        gap: 16, padding: 20,
        overflow: 'auto',
        minHeight: 0,
      }}>
        {dept.slots.map(slotId => {
          const item = slotMap[slotId];
          const isTempJob = item && (item.type === 'export' || item.type === 'demantelement' || item.type === 'autres');
          const typeColor = item
            ? isTempJob             ? '#475569'
            : item.type === 'eau'   ? '#f97316'
            : item.type === 'client' ? '#3b82f6'
            : '#22c55e'
            : null;

          // Couleur de bordure — priorité: vendu > urgent > type
          const borderColor = item
            ? item.etatCommercial === 'vendu'   ? '#ef4444'
            : item.etatCommercial === 'reserve' ? '#f59e0b'
            : item.urgence                      ? '#ef4444'
            : typeColor!
            : 'rgba(255,255,255,0.1)';

          return (
            <div
              key={slotId}
              onClick={(e) => handleSlotClick(e, slotId)}
              style={{
                background: item ? `${typeColor}18` : '#1a1814',
                border: item
                  ? `2px solid ${borderColor}`
                  : '1px dashed rgba(255,255,255,0.1)',
                borderRadius: 12,
                display: 'flex', flexDirection: 'column',
                padding: 20,
                cursor: modeTV ? 'default' : 'pointer',
                transition: 'all 0.15s',
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                if (!modeTV) (e.currentTarget as HTMLDivElement).style.opacity = '0.85';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.opacity = '1';
              }}
            >
              <div style={{
                fontFamily: 'monospace', fontSize: 14,
                fontWeight: 700, color: '#ff6040', marginBottom: 8,
              }}>
                #{slotId}
              </div>

              {item ? (
                <>
                  <div style={{
                    fontSize: 11, fontWeight: 700,
                    color: typeColor!, letterSpacing: '0.08em', marginBottom: 8,
                  }}>
                    {isTempJob
                      ? item.type === 'export' ? '🚛 EXPORT'
                      : item.type === 'demantelement' ? '🔧 DÉMANTÈLEMENT'
                      : '📋 AUTRES'
                    : item.type === 'eau'
                      ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><EauIcon /> CAMION À EAU</span>
                      : item.type === 'client' ? '🔧 CLIENT EXT.'
                      : '🏷️ DÉTAIL'}
                  </div>

                  <div style={{
                    fontFamily: 'monospace', fontSize: 48,
                    fontWeight: 700, color: 'white',
                    lineHeight: 1, marginBottom: 8,
                  }}>
                    {item.numero}
                  </div>

                  <div style={{
                    fontSize: 18, color: 'rgba(255,255,255,0.7)',
                    marginBottom: 12, lineHeight: 1.3,
                  }}>
                    {item.type === 'client'
                      ? item.nomClient
                      : `${item.marque} ${item.modele} ${item.annee}`}
                  </div>

                  {item.stationActuelle && (
                    <div style={{
                      fontSize: 14, color: dept.color,
                      fontWeight: 600, marginBottom: 8,
                    }}>
                      Étape : {
                        TOUTES_STATIONS_COMMUNES.find(s => s.id === item.stationActuelle)?.label
                        ?? item.stationActuelle
                      }
                    </div>
                  )}

                  {/* ── BADGE COMMERCIAL ── */}
                  <BadgeCommercialSlot item={item} />

                  {/* ── DOCUMENTS PDF ── */}
                  <div style={{
                    marginTop: 12,
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                    paddingTop: 12,
                    display: 'flex', flexDirection: 'column', gap: 8,
                  }}>
                    <div style={{
                      fontSize: 14, color: 'rgba(255,255,255,0.7)',
                      fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      📄 Documents PDF
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>
                        ({item.documents?.length ?? 0}/3)
                      </span>
                    </div>

                    {/* Documents existants */}
                    {(item.documents ?? []).map(doc => (
                      <button
                        key={doc.id}
                        onClick={(e) => ouvrirDoc(e, doc)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 14px', borderRadius: 8,
                          border: '1px solid rgba(59,130,246,0.3)',
                          background: 'rgba(59,130,246,0.1)',
                          color: 'white',
                          cursor: 'pointer', fontSize: 14,
                          fontWeight: 600, textAlign: 'left',
                          width: '100%', transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'rgba(59,130,246,0.2)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'rgba(59,130,246,0.1)';
                        }}
                      >
                        <span style={{ fontSize: 22, flexShrink: 0 }}>📄</span>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {doc.nom}
                        </span>
                        <span style={{
                          fontSize: 12, color: '#3b82f6', fontWeight: 700,
                          padding: '3px 8px', borderRadius: 4,
                          background: 'rgba(59,130,246,0.15)', flexShrink: 0,
                        }}>
                          👁 Voir
                        </span>
                      </button>
                    ))}

                    {/* Bouton AJOUTER PDF — toujours visible si < 3 docs */}
                    {(item.documents?.length ?? 0) < 3 && (
                      <label
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                          padding: '12px 14px', borderRadius: 8,
                          border: '2px dashed rgba(59,130,246,0.4)',
                          background: 'rgba(59,130,246,0.05)',
                          color: '#3b82f6', fontSize: 15,
                          fontWeight: 700, cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'rgba(59,130,246,0.15)';
                          e.currentTarget.style.borderColor = 'rgba(59,130,246,0.6)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'rgba(59,130,246,0.05)';
                          e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)';
                        }}
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
                        <span style={{ fontSize: 20 }}>📎</span>
                        + Ajouter un PDF
                      </label>
                    )}
                  </div>

                  {item.urgence && (
                    <div style={{
                      marginTop: 10, background: '#ef444420',
                      border: '1px solid #ef4444', borderRadius: 6,
                      padding: '6px 12px', color: '#ef4444',
                      fontWeight: 700, fontSize: 14, textAlign: 'center',
                    }}>
                      ⚡ URGENT
                    </div>
                  )}

                  {!modeTV && (
                    <div style={{
                      marginTop: 10, fontSize: 10,
                      color: 'rgba(255,255,255,0.2)', textAlign: 'center',
                    }}>
                      Cliquer pour modifier
                    </div>
                  )}
                </>
              ) : (
                <div style={{
                  flex: 1, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  color: 'rgba(255,255,255,0.15)',
                  fontSize: 20, fontWeight: 500,
                }}>
                  Disponible
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── FILE D'ATTENTE ── */}
      {itemsEnAttente.length > 0 && (
        <div style={{
          borderTop: `1px solid ${dept.color}33`,
          padding: '10px 20px',
          background: 'rgba(0,0,0,0.3)',
          flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: '#f59e0b',
            fontFamily: 'monospace', letterSpacing: '0.08em', flexShrink: 0,
          }}>
            ⏳ EN ATTENTE ({itemsEnAttente.length})
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {itemsEnAttente.map(item => (
              <div
                key={item.id}
                onClick={(e) => {
                  e.stopPropagation();
                  // Ouvrir le panneau détail pour ce camion en attente
                  setModalState({ type: 'detail', vehiculeId: item.inventaireId || item.id, itemId: item.id });
                }}
                style={{
                  background: 'rgba(245,158,11,0.1)',
                  border: '1px solid rgba(245,158,11,0.4)',
                  borderRadius: 6, padding: '4px 12px',
                  fontFamily: 'monospace', fontWeight: 700,
                  fontSize: 13, color: '#f59e0b', cursor: 'pointer',
                }}
              >
                #{item.numero}
                {item.urgence && (
                  <span style={{ marginLeft: 6, fontSize: 10, color: '#ef4444' }}>URG</span>
                )}
                {item.etatCommercial === 'vendu' && (
                  <span style={{ marginLeft: 6, fontSize: 10, color: '#ef4444', fontWeight: 700 }}>VENDU</span>
                )}
                {item.etatCommercial === 'reserve' && (
                  <span style={{ marginLeft: 6, fontSize: 10, color: '#f59e0b', fontWeight: 700 }}>RÉS.</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PANNEAU DÉTAIL UNIFIÉ (même que PlancherView/VueAsana) ── */}
      {modalState?.type === 'detail' && (() => {
        const detailItem = modalState.itemId
          ? items.find(i => i.id === modalState.itemId)
          : items.find(i =>
              (i.inventaireId === modalState.vehiculeId || i.id === modalState.vehiculeId) &&
              i.etat !== 'termine'
            );
        let detailVehicule = vehiculesComplets.find(v => v.id === modalState.vehiculeId);
        // Fallback : si le véhicule n'est pas trouvé dans vehiculesComplets,
        // créer un objet synthétique à partir du prod_item pour garantir l'ouverture du panneau
        if (!detailVehicule && detailItem) {
          detailVehicule = {
            id: detailItem.inventaireId || detailItem.id,
            statut: 'en-production' as const,
            dateImport: detailItem.dateCreation ?? new Date().toISOString(),
            dateEnProduction: detailItem.dateCreation,
            jobId: detailItem.id,
            numero: detailItem.numero ?? '',
            type: (detailItem.type === 'eau' || detailItem.type === 'client' || detailItem.type === 'detail')
              ? detailItem.type : 'detail' as const,
            nomClient: detailItem.nomClient,
            telephone: detailItem.telephone,
            vehicule: detailItem.vehicule,
            descriptionTravail: detailItem.descriptionTravail,
            descriptionTravaux: detailItem.descriptionTravaux,
            notes: detailItem.notes,
            marque: detailItem.marque,
            modele: detailItem.modele,
            annee: detailItem.annee,
            roadMap: (detailItem.stationsActives ?? []).map((sid: string, idx: number) => {
              const prog = detailItem.progression?.find((p: any) => p.stationId === sid);
              const statut = prog?.status === 'termine' ? 'termine' as const
                : prog?.status === 'en-cours' ? 'en-cours' as const
                : 'en-attente' as const;
              return { id: `synth-${detailItem.id}-${idx}`, stationId: sid, statut, priorite: idx + 1, ordre: idx + 1 };
            }),
            estPret: false,
            etatCommercial: detailItem.etatCommercial as any ?? 'non-vendu',
          };
        }
        if (!detailVehicule) return null;
        return (
          <PanneauDetailVehicule
            vehicule={detailVehicule}
            item={detailItem}
            onClose={() => setModalState(null)}
          />
        );
      })()}

      {/* ── MODAL ASSIGNATION SLOT ── */}
      {modalState?.type === 'assign' && (
        <SlotAssignModal
          slot={modalState.slot}
          enAttente={enAttente}
          onAssign={(itemId, slotId) => {
            assignerSlot(itemId, slotId);
            setModalState(null);
          }}
          onClose={() => setModalState(null)}
          position={modalState.position}
        />
      )}

      {/* ── MODAL APERÇU PDF ── */}
      {/* ── PANNEAU RÉSERVOIRS ── */}
      {panneauReservoirs && (
        <>
          <div onClick={() => setPanneauReservoirs(false)} style={{
            position: 'fixed', inset: 0, zIndex: 399, background: 'rgba(0,0,0,0.4)',
          }} />
          <PanneauReservoirs onClose={() => setPanneauReservoirs(false)} />
        </>
      )}

      {pdfOuvert && (
        <div
          onClick={() => setPdfOuvert(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 500,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '90vw', height: '90vh',
              background: '#1a1814', borderRadius: 12,
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              background: '#111009', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>📄</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
                  {pdfOuvert.nom}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = pdfOuvert.base64;
                    link.download = pdfOuvert.nom;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  style={{
                    padding: '6px 14px', borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  ⬇ Télécharger
                </button>
                <button
                  onClick={() => setPdfOuvert(null)}
                  style={{
                    padding: '6px 14px', borderRadius: 6,
                    border: 'none', background: '#ef4444',
                    color: 'white', fontSize: 12,
                    fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  ✕ Fermer
                </button>
              </div>
            </div>
            <iframe
              src={pdfOuvert.base64}
              style={{ flex: 1, width: '100%', border: 'none', background: 'white' }}
              title={pdfOuvert.nom}
            />
          </div>
        </div>
      )}
    </div>
  );
};