import { useContext, useMemo, useState } from 'react';
import { useInventaire } from '../contexts/InventaireContext';
import { GarageContext } from '../contexts/GarageContext';
import type { Item } from '../types/item.types';
import { ROAD_MAP_STATIONS } from '../data/etapes';
import { estVehiculePret, type VehiculeInventaire } from '../types/inventaireTypes';
import { PanneauDetailVehicule } from './PanneauDetailVehicule';
import { EauIcon } from './EauIcon';

/** useGarage qui ne crash pas si pas de provider (cas VueTerrain mobile). */
function useGarageOptional(): { items: Item[] } {
  const ctx = useContext(GarageContext);
  return ctx ?? { items: [] };
}

// ── Filtres ─────────────────────────────────────────────────────
type FiltreCommercial = 'engagés' | 'vendus' | 'reserves' | 'location' | 'non-vendus' | 'tous';
type FiltreType       = 'tous' | 'eau' | 'detail';
type Tri              = 'livraison' | 'priorite' | 'restantes';

const COMMERCIAL_OPTIONS: { id: FiltreCommercial; label: string; color: string }[] = [
  { id: 'engagés',    label: '🎯 À livrer (vendus + réservés + location)', color: '#dc2626' },
  { id: 'vendus',     label: '✓ Vendus',     color: '#22c55e' },
  { id: 'reserves',   label: '🔒 Réservés',  color: '#f59e0b' },
  { id: 'location',   label: '🔑 Location',  color: '#7c3aed' },
  { id: 'non-vendus', label: '○ Non vendus', color: '#6b7280' },
  { id: 'tous',       label: 'Tous',         color: '#1e293b' },
];

// ── Helpers ─────────────────────────────────────────────────────
function joursAvant(dateStr?: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

function labelLivraison(j: number | null): { texte: string; color: string } {
  if (j === null) return { texte: 'Pas de date', color: '#9ca3af' };
  if (j < 0)      return { texte: `En retard (${Math.abs(j)}j)`, color: '#dc2626' };
  if (j === 0)   return { texte: "Aujourd'hui", color: '#dc2626' };
  if (j === 1)   return { texte: 'Demain', color: '#dc2626' };
  if (j <= 7)    return { texte: `Dans ${j}j`, color: '#ea580c' };
  if (j <= 30)   return { texte: `Dans ${j}j`, color: '#f59e0b' };
  return { texte: `Dans ${j}j`, color: '#22c55e' };
}

function getEtapesRestantes(v: VehiculeInventaire) {
  return (v.roadMap ?? []).filter(s => s.statut !== 'termine' && s.statut !== 'saute');
}

function getProgressionPct(v: VehiculeInventaire): number {
  const total = v.roadMap?.length ?? 0;
  if (total === 0) return 0;
  const finies = total - getEtapesRestantes(v).length;
  return Math.round((finies / total) * 100);
}

function getLabelVehicule(v: VehiculeInventaire): string {
  if (v.type === 'client') {
    return [v.nomClient, v.vehicule].filter(Boolean).join(' — ') || 'Job client';
  }
  return [v.marque, v.modele, v.annee].filter(Boolean).join(' ') ||
    (v.type === 'detail' ? 'Camion détail' : 'Camion à eau');
}

function getStation(stationId: string) {
  return ROAD_MAP_STATIONS.find(s => s.id === stationId);
}

// ── Composant principal ─────────────────────────────────────────
interface VueLivraisonsProps {
  /** Affichage compact pour mobile (VueTerrain) */
  mobile?: boolean;
  /** Bouton retour (mobile) */
  onClose?: () => void;
  /**
   * Callback custom pour gérer l'ouverture du détail (utilisé par VueTerrain mobile
   * qui n'a pas accès à GarageProvider/ClientProvider/AuthProvider).
   * Si non fourni, ouvre PanneauDetailVehicule en interne.
   */
  onSelectVehicule?: (vehiculeId: string) => void;
}

export function VueLivraisons({ mobile = false, onClose, onSelectVehicule }: VueLivraisonsProps) {
  const { vehicules } = useInventaire();
  const { items } = useGarageOptional();

  const [filtreCommercial, setFiltreCommercial] = useState<FiltreCommercial>('engagés');
  const [filtreType, setFiltreType] = useState<FiltreType>('tous');
  const [tri, setTri] = useState<Tri>('livraison');
  const [recherche, setRecherche] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const itemByInvId = useMemo(() => {
    const map: Record<string, typeof items[number]> = {};
    for (const it of items) if (it.inventaireId) map[it.inventaireId] = it;
    return map;
  }, [items]);

  const filtres = useMemo(() => {
    let result = vehicules.filter(v => v.statut !== 'archive');

    // Statut commercial
    if (filtreCommercial === 'engagés') {
      result = result.filter(v =>
        (v.etatCommercial === 'vendu' || v.etatCommercial === 'reserve' || v.etatCommercial === 'location')
        && !estVehiculePret(v)
      );
    } else if (filtreCommercial === 'vendus') {
      result = result.filter(v => v.etatCommercial === 'vendu');
    } else if (filtreCommercial === 'reserves') {
      result = result.filter(v => v.etatCommercial === 'reserve');
    } else if (filtreCommercial === 'location') {
      result = result.filter(v => v.etatCommercial === 'location');
    } else if (filtreCommercial === 'non-vendus') {
      result = result.filter(v => !v.etatCommercial || v.etatCommercial === 'non-vendu');
    }

    // Type
    if (filtreType !== 'tous') {
      result = result.filter(v => v.type === filtreType);
    }

    // Recherche
    if (recherche.trim()) {
      const q = recherche.trim().toLowerCase();
      result = result.filter(v =>
        v.numero?.toLowerCase().includes(q) ||
        v.marque?.toLowerCase().includes(q) ||
        v.modele?.toLowerCase().includes(q) ||
        v.clientAcheteur?.toLowerCase().includes(q) ||
        v.nomClient?.toLowerCase().includes(q)
      );
    }

    // Tri
    if (tri === 'livraison') {
      result.sort((a, b) => {
        const ja = joursAvant(a.dateLivraisonPlanifiee);
        const jb = joursAvant(b.dateLivraisonPlanifiee);
        // Sans date = en bas
        if (ja === null && jb === null) return (a.numero || '').localeCompare(b.numero || '');
        if (ja === null) return 1;
        if (jb === null) return -1;
        return ja - jb; // plus proche = en haut
      });
    } else if (tri === 'restantes') {
      result.sort((a, b) => getEtapesRestantes(b).length - getEtapesRestantes(a).length);
    } else if (tri === 'priorite') {
      result.sort((a, b) => {
        const pa = (a.roadMap ?? []).find(s => s.statut === 'en-attente' || s.statut === 'en-cours')?.priorite ?? 999;
        const pb = (b.roadMap ?? []).find(s => s.statut === 'en-attente' || s.statut === 'en-cours')?.priorite ?? 999;
        return pa - pb;
      });
    }

    return result;
  }, [vehicules, filtreCommercial, filtreType, recherche, tri]);

  const selected = vehicules.find(v => v.id === selectedId) ?? null;
  const selectedItem = selected ? itemByInvId[selected.id] : undefined;

  // ── Style helpers ─────────────────────────────────────────────
  const bgPage    = mobile ? '#f8fafc' : '#0f0e0b';
  const bgCard    = mobile ? 'white'   : '#161410';
  const bgFiltre  = mobile ? 'white'   : '#1a1814';
  const textMain  = mobile ? '#111827' : 'white';
  const textDim   = mobile ? '#6b7280' : 'rgba(255,255,255,0.5)';
  const border    = mobile ? '#e5e7eb' : 'rgba(255,255,255,0.08)';

  return (
    <div style={{
      width: '100%', height: mobile ? '100dvh' : '100%',
      background: bgPage, color: textMain,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>

      {/* ── Header ───────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        background: bgFiltre,
        borderBottom: `1px solid ${border}`,
        padding: mobile ? '14px 16px 10px' : '16px 24px 12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {mobile && onClose && (
              <button onClick={onClose}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#6b7280', padding: 4 }}>
                ←
              </button>
            )}
            <div>
              <div style={{ fontSize: mobile ? 18 : 20, fontWeight: 700 }}>🚚 Suivi livraisons</div>
              <div style={{ fontSize: 12, color: textDim, marginTop: 2 }}>
                {filtres.length} camion{filtres.length > 1 ? 's' : ''}
              </div>
            </div>
          </div>

          {/* Recherche */}
          <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: textDim }}>🔍</span>
            <input
              type="search" value={recherche} onChange={e => setRecherche(e.target.value)}
              placeholder="# / marque / client..."
              style={{
                width: '100%', padding: '8px 12px 8px 36px',
                borderRadius: 8, fontSize: 13,
                border: `1px solid ${border}`,
                background: mobile ? '#f8fafc' : 'rgba(255,255,255,0.05)',
                color: textMain, outline: 'none', boxSizing: 'border-box',
              }} />
          </div>
        </div>

        {/* Filtres commerciaux */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 8 }}>
          {COMMERCIAL_OPTIONS.map(o => {
            const actif = filtreCommercial === o.id;
            return (
              <button key={o.id} onClick={() => setFiltreCommercial(o.id)}
                style={{
                  padding: '6px 12px', borderRadius: 16, fontSize: 12, fontWeight: actif ? 700 : 500,
                  border: actif ? `2px solid ${o.color}` : `1px solid ${border}`,
                  background: actif ? `${o.color}18` : (mobile ? 'white' : 'rgba(255,255,255,0.04)'),
                  color: actif ? o.color : textDim,
                  cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  transition: 'all 0.15s',
                }}>
                {o.label}
              </button>
            );
          })}
        </div>

        {/* Filtres type + tri */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {([['tous', 'Tous'], ['eau', '💧 Eau'], ['detail', '🏷️ Détail']] as [FiltreType, string][]).map(([id, label]) => {
              const actif = filtreType === id;
              return (
                <button key={id} onClick={() => setFiltreType(id)}
                  style={{
                    padding: '5px 10px', borderRadius: 12, fontSize: 11, fontWeight: actif ? 700 : 500,
                    border: actif ? '1px solid #1d4ed8' : `1px solid ${border}`,
                    background: actif ? '#dbeafe' : (mobile ? 'white' : 'rgba(255,255,255,0.04)'),
                    color: actif ? '#1d4ed8' : textDim,
                    cursor: 'pointer',
                  }}>
                  {label}
                </button>
              );
            })}
          </div>

          <div style={{ width: 1, height: 18, background: border }} />

          <span style={{ fontSize: 11, color: textDim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tri:</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {([
              ['livraison',  '📅 Livraison'],
              ['priorite',   '⭐ Priorité'],
              ['restantes',  '⏱ Restantes'],
            ] as [Tri, string][]).map(([id, label]) => {
              const actif = tri === id;
              return (
                <button key={id} onClick={() => setTri(id)}
                  style={{
                    padding: '5px 10px', borderRadius: 12, fontSize: 11, fontWeight: actif ? 700 : 500,
                    border: actif ? '1px solid #7c3aed' : `1px solid ${border}`,
                    background: actif ? '#ede9fe' : (mobile ? 'white' : 'rgba(255,255,255,0.04)'),
                    color: actif ? '#7c3aed' : textDim,
                    cursor: 'pointer',
                  }}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Liste ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: mobile ? '8px' : '12px 24px' }}>
        {filtres.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: textDim, fontSize: 14 }}>
            Aucun camion ne correspond à ces filtres
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtres.map(v => (
              <CarteCamion key={v.id} v={v} mobile={mobile} bgCard={bgCard}
                textMain={textMain} textDim={textDim} border={border}
                onClick={() => onSelectVehicule ? onSelectVehicule(v.id) : setSelectedId(v.id)} />
            ))}
          </div>
        )}
      </div>

      {/* ── Panneau détail (uniquement si pas de callback custom) ──── */}
      {selected && !onSelectVehicule && (
        <div style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: mobile ? '100vw' : 460, maxWidth: '100vw',
          background: 'white', boxShadow: '-8px 0 32px rgba(0,0,0,0.3)',
          zIndex: 200, overflowY: 'auto',
        }}>
          <PanneauDetailVehicule
            vehicule={selected}
            item={selectedItem}
            onClose={() => setSelectedId(null)} />
        </div>
      )}
    </div>
  );
}

// ── Carte camion ────────────────────────────────────────────────
function CarteCamion({ v, mobile, bgCard, textMain, textDim, border, onClick }: {
  v: VehiculeInventaire;
  mobile: boolean;
  bgCard: string;
  textMain: string;
  textDim: string;
  border: string;
  onClick: () => void;
}) {
  const typeColor = v.type === 'eau' ? '#f97316' : v.type === 'client' ? '#3b82f6' : '#22c55e';
  const j = joursAvant(v.dateLivraisonPlanifiee);
  const livr = labelLivraison(j);
  const restantes = getEtapesRestantes(v);
  const pct = getProgressionPct(v);
  const enCours = (v.roadMap ?? []).find(s => s.statut === 'en-cours');
  const prochaine = (v.roadMap ?? []).find(s => s.statut === 'en-attente') ?? restantes[0];

  // Statut commercial badge
  const cBadge =
    v.etatCommercial === 'vendu'    ? { bg: '#dcfce7', color: '#166534', label: '✓ Vendu' }    :
    v.etatCommercial === 'reserve'  ? { bg: '#fef3c7', color: '#92400e', label: '🔒 Réservé' } :
    v.etatCommercial === 'location' ? { bg: '#ede9fe', color: '#6d28d9', label: '🔑 Location' }:
    null;

  return (
    <div onClick={onClick}
      style={{
        background: bgCard,
        border: `1px solid ${border}`,
        borderLeft: `4px solid ${typeColor}`,
        borderRadius: 10,
        padding: '12px 14px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'none'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
    >
      {/* Ligne 1 : numéro + type + commercial + livraison */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {v.type === 'eau' ? <EauIcon /> : <span style={{ fontSize: 16 }}>{v.type === 'client' ? '🔧' : '🏷️'}</span>}
        <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: mobile ? 16 : 18, color: typeColor }}>
          #{v.numero}
        </span>
        {cBadge && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: cBadge.bg, color: cBadge.color }}>
            {cBadge.label}
            {v.clientAcheteur && <span style={{ marginLeft: 4, opacity: 0.8 }}>· {v.clientAcheteur}</span>}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: livr.color, padding: '3px 8px', background: `${livr.color}15`, border: `1px solid ${livr.color}40`, borderRadius: 4, whiteSpace: 'nowrap' }}>
          📅 {livr.texte}
        </span>
      </div>

      {/* Ligne 2 : marque/modèle */}
      <div style={{ fontSize: 12, color: textDim }}>
        {getLabelVehicule(v)}{v.variante && ` · ${v.variante}`}
        {v.type === 'eau' && (
          v.aUnReservoir
            ? <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 3, background: '#dcfce7', color: '#166534' }}>✅ Rés.</span>
            : <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 3, background: '#fff7ed', color: '#c2410c' }}>⚠️ Sans rés.</span>
        )}
      </div>

      {/* Ligne 3 : barre de progression */}
      {(v.roadMap ?? []).length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#e5e7eb', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: pct === 100 ? '#22c55e' : '#3b82f6', transition: 'width 0.3s' }} />
          </div>
          <span style={{ fontSize: 11, color: textDim, fontWeight: 700, minWidth: 40, textAlign: 'right' }}>
            {pct}%
          </span>
        </div>
      )}

      {/* Ligne 4 : étape en cours / prochaine + restantes */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {enCours && (() => {
          const st = getStation(enCours.stationId);
          return (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: '#dbeafe', color: '#1e40af' }}>
              🚛 En cours : {st?.icon} {st?.label}
            </span>
          );
        })()}
        {!enCours && prochaine && (() => {
          const st = getStation(prochaine.stationId);
          return (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: '#fef3c7', color: '#92400e' }}>
              ⏭ Prochaine : {st?.icon} {st?.label}
              {prochaine.priorite && ` (priorité ${prochaine.priorite})`}
            </span>
          );
        })()}
        {restantes.length > 0 && (
          <span style={{ fontSize: 11, color: textDim }}>
            {restantes.length} étape{restantes.length > 1 ? 's' : ''} restante{restantes.length > 1 ? 's' : ''}
          </span>
        )}
        {restantes.length === 0 && (v.roadMap ?? []).length > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, color: '#22c55e' }}>
            ✅ Toutes étapes complétées
          </span>
        )}
      </div>
    </div>
  );
}
