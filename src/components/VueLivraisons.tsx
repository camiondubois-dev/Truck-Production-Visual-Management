import { useContext, useMemo, useState, useEffect } from 'react';
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

function isEngagé(v: VehiculeInventaire): boolean {
  return v.etatCommercial === 'vendu' || v.etatCommercial === 'reserve' || v.etatCommercial === 'location';
}

// ── Composant principal ─────────────────────────────────────────
interface VueLivraisonsProps {
  /** Affichage compact pour mobile (VueTerrain) */
  mobile?: boolean;
  onClose?: () => void;
  /** Callback custom pour mobile (pas accès aux providers nécessaires au panneau) */
  onSelectVehicule?: (vehiculeId: string) => void;
}

export function VueLivraisons(props: VueLivraisonsProps) {
  if (props.mobile) return <VueLivraisonsMobile {...props} />;
  return <VueLivraisonsDashboard onSelectVehicule={props.onSelectVehicule} />;
}

// ════════════════════════════════════════════════════════════════
// DASHBOARD TV / WINDOWS
// Layout: Header KPI strip + Kanban 5 colonnes par urgence livraison
// ════════════════════════════════════════════════════════════════

interface BucketDef {
  id: 'retard' | 'aujourdhui' | 'semaine' | 'mois' | 'plus-tard' | 'sans-date';
  label: string;
  sublabel: string;
  emoji: string;
  bg: string;          // gradient
  accent: string;      // border + accent
  pulse: boolean;
}

const BUCKETS: BucketDef[] = [
  { id: 'retard',     label: 'EN RETARD',     sublabel: 'Date dépassée',    emoji: '🚨', bg: 'linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)', accent: '#fca5a5', pulse: true  },
  { id: 'aujourdhui', label: "AUJOURD'HUI",  sublabel: 'Demain inclus',     emoji: '🔥', bg: 'linear-gradient(135deg, #9a3412 0%, #ea580c 100%)', accent: '#fdba74', pulse: false },
  { id: 'semaine',    label: 'CETTE SEMAINE', sublabel: '2 à 7 jours',       emoji: '⏰', bg: 'linear-gradient(135deg, #92400e 0%, #f59e0b 100%)', accent: '#fcd34d', pulse: false },
  { id: 'mois',       label: 'CE MOIS',       sublabel: '8 à 30 jours',      emoji: '📅', bg: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', accent: '#93c5fd', pulse: false },
  { id: 'plus-tard',  label: 'PLUS TARD',     sublabel: '30j+ ou sans date', emoji: '📆', bg: 'linear-gradient(135deg, #334155 0%, #64748b 100%)', accent: '#cbd5e1', pulse: false },
];

function VueLivraisonsDashboard({ onSelectVehicule }: { onSelectVehicule?: (id: string) => void }) {
  const { vehicules } = useInventaire();
  const { items } = useGarageOptional();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const itemByInvId = useMemo(() => {
    const map: Record<string, Item> = {};
    for (const it of items) if (it.inventaireId) map[it.inventaireId] = it;
    return map;
  }, [items]);

  const cmpDate = (a: VehiculeInventaire, b: VehiculeInventaire) => {
    const ja = joursAvant(a.dateLivraisonPlanifiee);
    const jb = joursAvant(b.dateLivraisonPlanifiee);
    if (ja === null && jb === null) return 0;
    if (ja === null) return 1;
    if (jb === null) return -1;
    return ja - jb;
  };

  // Tous les engagés (vendus + réservés + location)
  const tousEngagés = useMemo(() =>
    vehicules.filter(v => v.statut !== 'archive' && isEngagé(v)),
  [vehicules]);

  // Pas encore prêts → kanban du haut
  const aLivrer = useMemo(() =>
    tousEngagés.filter(v => !estVehiculePret(v)),
  [tousEngagés]);

  // Prêts → bandeau du bas
  const prets = useMemo(() => {
    const list = tousEngagés.filter(estVehiculePret);
    list.sort(cmpDate);
    return list;
  }, [tousEngagés]);

  const buckets = useMemo(() => {
    const result: Record<BucketDef['id'], VehiculeInventaire[]> = {
      'retard': [], 'aujourdhui': [], 'semaine': [], 'mois': [], 'plus-tard': [], 'sans-date': [],
    };
    for (const v of aLivrer) {
      const j = joursAvant(v.dateLivraisonPlanifiee);
      if (j === null)      result['plus-tard'].push(v);
      else if (j < 0)      result['retard'].push(v);
      else if (j <= 1)     result['aujourdhui'].push(v);
      else if (j <= 7)     result['semaine'].push(v);
      else if (j <= 30)    result['mois'].push(v);
      else                 result['plus-tard'].push(v);
    }
    for (const k of Object.keys(result) as BucketDef['id'][]) {
      result[k].sort(cmpDate);
    }
    return result;
  }, [aLivrer]);

  const total = tousEngagés.length;
  const enRetard = buckets['retard'].length;
  const sansReservoir = aLivrer.filter(v => v.type === 'eau' && !v.aUnReservoir).length;

  const selected = selectedId ? vehicules.find(v => v.id === selectedId) ?? null : null;
  const selectedItem = selected ? itemByInvId[selected.id] : undefined;

  const handleClick = (id: string) => {
    if (onSelectVehicule) onSelectVehicule(id);
    else setSelectedId(id);
  };

  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'radial-gradient(ellipse at top, #1a1814 0%, #0f0e0b 100%)',
      color: 'white', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <style>{`
        @keyframes pulseRed {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.7); }
          50%      { box-shadow: 0 0 0 12px rgba(220,38,38,0); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .livr-card { animation: slideIn 0.3s ease-out backwards; }
        .livr-col-body::-webkit-scrollbar { width: 4px; }
        .livr-col-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
        .livr-col-body { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.15) transparent; }
      `}</style>

      {/* ── Top KPI strip ──────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        padding: 'clamp(10px, 1.5vh, 18px) clamp(16px, 2vw, 28px)',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: 'clamp(12px, 2vw, 28px)',
        alignItems: 'center',
        background: 'rgba(0,0,0,0.4)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 'clamp(22px, 2.5vw, 32px)' }}>🚚</div>
          <div>
            <div style={{ fontSize: 'clamp(14px, 1.5vw, 20px)', fontWeight: 800, letterSpacing: '0.02em' }}>SUIVI LIVRAISONS</div>
            <div style={{ fontSize: 'clamp(9px, 0.85vw, 11px)', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Camions engagés (vendus · réservés · location)
            </div>
          </div>
        </div>

        {/* KPIs centraux */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 'clamp(12px, 2vw, 32px)',
        }}>
          <KPIBlock value={total}         label="Engagés" color="#3b82f6" />
          <KPIBlock value={enRetard}      label="En retard" color="#dc2626" pulse={enRetard > 0} />
          <KPIBlock value={buckets['aujourdhui'].length} label="Aujourd'hui / Demain" color="#ea580c" />
          <KPIBlock value={sansReservoir} label="Sans réservoir" color="#f59e0b" />
          <KPIBlock value={prets.length}  label="Prêts à livrer" color="#22c55e" />
        </div>

        {/* Horloge */}
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontFamily: 'monospace', fontSize: 'clamp(18px, 1.8vw, 26px)',
            fontWeight: 700, lineHeight: 1, letterSpacing: '0.04em',
          }}>
            {now.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div style={{ fontSize: 'clamp(9px, 0.85vw, 11px)', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>
            {now.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
      </div>

      {/* ── Kanban 5 colonnes (À LIVRER) ───────────────────────── */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 'clamp(8px, 0.9vw, 14px)',
        padding: 'clamp(8px, 1vw, 14px) clamp(10px, 1.2vw, 18px) 0',
      }}>
        {BUCKETS.map(b => {
          const list = b.id === 'plus-tard'
            ? [...buckets['plus-tard'], ...buckets['sans-date']]
            : buckets[b.id];
          return (
            <Colonne key={b.id} bucket={b} vehicules={list} onClick={handleClick} itemByInvId={itemByInvId} />
          );
        })}
      </div>

      {/* ── Bandeau PRÊTS À LIVRER ─────────────────────────────── */}
      <BandeauPrets prets={prets} onClick={handleClick} itemByInvId={itemByInvId} />

      {/* Panneau détail (se positionne lui-même en fixed) */}
      {selected && !onSelectVehicule && (
        <PanneauDetailVehicule
          vehicule={selected}
          item={selectedItem}
          onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}

// ── Photo (avec fallback icône) ─────────────────────────────────
function PhotoOuIcone({ v, taille }: { v: VehiculeInventaire; taille: string | number }) {
  const typeColor = v.type === 'eau' ? '#f97316' : v.type === 'client' ? '#3b82f6' : '#22c55e';
  const sizeStyle = { width: taille, height: taille };

  if (v.photoUrl) {
    return (
      <img src={v.photoUrl} alt={`#${v.numero}`}
        style={{
          ...sizeStyle, objectFit: 'cover', borderRadius: 6,
          border: `2px solid ${typeColor}`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          flexShrink: 0,
        }}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  return (
    <div style={{
      ...sizeStyle, borderRadius: 6,
      background: `${typeColor}20`, border: `1px solid ${typeColor}50`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      fontSize: typeof taille === 'string' ? `calc(${taille} * 0.55)` : `${(taille as number) * 0.55}px`,
    }}>
      {v.type === 'eau' ? <EauIcon /> : v.type === 'client' ? '🔧' : '🏷️'}
    </div>
  );
}

// ── KPI Block ───────────────────────────────────────────────────
function KPIBlock({ value, label, color, pulse }: { value: number; label: string; color: string; pulse?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '4px 14px',
      borderLeft: `3px solid ${color}`,
      animation: pulse ? 'pulseRed 1.6s infinite' : undefined,
      borderRadius: pulse ? 6 : 0,
    }}>
      <div style={{
        fontSize: 'clamp(22px, 2.4vw, 34px)', fontWeight: 900,
        color, lineHeight: 1, fontFamily: 'system-ui',
        textShadow: pulse ? `0 0 16px ${color}50` : 'none',
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 'clamp(9px, 0.85vw, 11px)', color: 'rgba(255,255,255,0.6)',
        textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700,
        lineHeight: 1.2, maxWidth: 90,
      }}>
        {label}
      </div>
    </div>
  );
}

// ── Colonne kanban ──────────────────────────────────────────────
function Colonne({ bucket, vehicules, onClick, itemByInvId }: {
  bucket: BucketDef;
  vehicules: VehiculeInventaire[];
  onClick: (id: string) => void;
  itemByInvId: Record<string, Item>;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: 'rgba(255,255,255,0.02)',
      borderRadius: 12,
      border: `1px solid ${bucket.accent}25`,
      overflow: 'hidden',
      minHeight: 0,
    }}>
      {/* Header */}
      <div style={{
        flexShrink: 0,
        background: bucket.bg,
        padding: 'clamp(8px, 1vw, 14px) clamp(10px, 1.2vw, 16px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        animation: bucket.pulse && vehicules.length > 0 ? 'pulseRed 2s infinite' : undefined,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 'clamp(16px, 1.6vw, 22px)', flexShrink: 0 }}>{bucket.emoji}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 'clamp(10px, 1vw, 14px)', fontWeight: 800,
              letterSpacing: '0.05em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {bucket.label}
            </div>
            <div style={{ fontSize: 'clamp(8px, 0.7vw, 10px)', color: 'rgba(255,255,255,0.7)', fontWeight: 500, marginTop: 1 }}>
              {bucket.sublabel}
            </div>
          </div>
        </div>
        <div style={{
          fontSize: 'clamp(20px, 2vw, 32px)', fontWeight: 900, lineHeight: 1,
          color: 'white', textShadow: '0 2px 8px rgba(0,0,0,0.4)',
          fontFamily: 'system-ui',
        }}>
          {vehicules.length}
        </div>
      </div>

      {/* Body — no-scroll, distribue l'espace en parts égales */}
      <div className="livr-col-body" style={{
        flex: 1, minHeight: 0, overflow: 'hidden',
        padding: 'clamp(5px, 0.5vw, 8px)',
        display: 'grid',
        gridTemplateRows: vehicules.length > 0 ? `repeat(${vehicules.length}, minmax(0, 1fr))` : '1fr',
        gap: 'clamp(3px, 0.4vw, 6px)',
      }}>
        {vehicules.length === 0 ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.2)',
            fontSize: 'clamp(10px, 0.9vw, 12px)', fontStyle: 'italic',
          }}>
            —
          </div>
        ) : vehicules.map((v, idx) => (
          <CarteCamionDashboard key={v.id} v={v} accent={bucket.accent}
            inGarage={!!itemByInvId[v.id]?.slotId}
            slotId={itemByInvId[v.id]?.slotId}
            onClick={() => onClick(v.id)}
            delay={idx * 30}
            compact={vehicules.length > 4} />
        ))}
      </div>
    </div>
  );
}

// ── Carte camion (compacte, dense, visuelle) ────────────────────
function CarteCamionDashboard({ v, accent, inGarage, slotId, onClick, delay, compact }: {
  v: VehiculeInventaire;
  accent: string;
  inGarage: boolean;
  slotId?: string;
  onClick: () => void;
  delay: number;
  /** Mode condensé quand beaucoup de cartes dans la colonne */
  compact?: boolean;
}) {
  const j = joursAvant(v.dateLivraisonPlanifiee);
  const typeColor = v.type === 'eau' ? '#f97316' : v.type === 'client' ? '#3b82f6' : '#22c55e';
  const restantes = getEtapesRestantes(v);
  const pct = getProgressionPct(v);
  const enCours = (v.roadMap ?? []).find(s => s.statut === 'en-cours');
  const prochaine = (v.roadMap ?? []).find(s => s.statut === 'en-attente') ?? restantes[0];
  const station = enCours ? getStation(enCours.stationId) : prochaine ? getStation(prochaine.stationId) : null;
  const stationStatut = enCours ? 'en-cours' : prochaine?.statut === 'en-attente' ? 'en-attente' : 'planifie';

  const dateLabel = j === null
    ? 'Pas de date'
    : j < 0   ? `🚨 ${Math.abs(j)}j retard`
    : j === 0 ? "Aujourd'hui"
    : j === 1 ? 'Demain'
    : `Dans ${j}j`;

  const cBadgeBg =
    v.etatCommercial === 'vendu'    ? '#22c55e' :
    v.etatCommercial === 'reserve'  ? '#f59e0b' :
    v.etatCommercial === 'location' ? '#7c3aed' :
    '#6b7280';

  const cBadgeIcon =
    v.etatCommercial === 'vendu'    ? '✓' :
    v.etatCommercial === 'reserve'  ? '🔒' :
    v.etatCommercial === 'location' ? '🔑' :
    '○';

  const client = v.clientAcheteur || v.nomClient;

  return (
    <div className="livr-card" onClick={onClick}
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
        border: `1px solid ${accent}40`,
        borderLeft: `3px solid ${typeColor}`,
        borderRadius: 8,
        padding: compact ? '5px 8px' : 'clamp(6px, 0.6vw, 9px) clamp(7px, 0.7vw, 10px)',
        cursor: 'pointer',
        transition: 'all 0.15s',
        display: 'flex', flexDirection: 'column',
        gap: compact ? 3 : 'clamp(3px, 0.35vw, 5px)',
        animationDelay: `${delay}ms`,
        minHeight: 0, overflow: 'hidden',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.background = 'linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)';
        el.style.transform = 'translateX(2px)';
        el.style.borderColor = `${accent}80`;
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.background = 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)';
        el.style.transform = 'none';
        el.style.borderColor = `${accent}40`;
      }}
    >
      {/* Ligne 1 : photo/icône · numéro · commercial · date */}
      <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 6 : 8, flexShrink: 0 }}>
        <PhotoOuIcone v={v} taille={compact ? 28 : 'clamp(34px, 3.4vw, 48px)'} />
        <span style={{
          fontFamily: 'monospace', fontWeight: 900,
          fontSize: compact ? 13 : 'clamp(13px, 1.25vw, 17px)', color: typeColor,
          lineHeight: 1,
        }}>
          #{v.numero}
        </span>
        <span title={v.etatCommercial} style={{
          fontSize: 'clamp(9px, 0.8vw, 11px)',
          background: cBadgeBg, color: 'white',
          padding: '1px 5px', borderRadius: 3, fontWeight: 800,
          flexShrink: 0,
        }}>
          {cBadgeIcon}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{
          fontSize: 'clamp(9px, 0.85vw, 11px)', fontWeight: 800,
          color: j !== null && j < 0 ? '#fca5a5' : j !== null && j <= 7 ? '#fdba74' : 'rgba(255,255,255,0.85)',
          whiteSpace: 'nowrap',
        }}>
          {dateLabel}
        </span>
      </div>

      {/* Ligne 2 : client + label véhicule (caché en mode compact) */}
      {!compact && (
        <div style={{
          fontSize: 'clamp(10px, 0.9vw, 12px)',
          color: 'rgba(255,255,255,0.75)', fontWeight: 600,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          lineHeight: 1.25,
        }}>
          {client && <span style={{ color: 'white' }}>{client}</span>}
          {client && ' · '}
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>{getLabelVehicule(v)}</span>
        </div>
      )}
      {compact && client && (
        <div style={{
          fontSize: 11, color: 'white', fontWeight: 600,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          lineHeight: 1.2,
        }}>
          {client}
        </div>
      )}

      {/* Ligne 3 : barre de progression + pct */}
      {(v.roadMap ?? []).length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 2,
              width: `${pct}%`,
              background: pct === 100 ? '#22c55e' : pct >= 50 ? '#3b82f6' : '#f59e0b',
              transition: 'width 0.3s',
            }} />
          </div>
          <span style={{
            fontSize: 'clamp(9px, 0.8vw, 11px)', fontWeight: 800,
            color: pct >= 50 ? '#86efac' : 'rgba(255,255,255,0.65)',
            minWidth: 30, textAlign: 'right', fontFamily: 'monospace',
          }}>
            {pct}%
          </span>
        </div>
      )}

      {/* Ligne 4 : étape en cours/prochaine + alertes (caché si compact) */}
      {!compact && <div style={{
        display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap',
        fontSize: 'clamp(9px, 0.8vw, 11px)',
      }}>
        {station && (
          <span style={{
            padding: '1px 6px', borderRadius: 3, fontWeight: 700,
            background: stationStatut === 'en-cours' ? 'rgba(59,130,246,0.25)' :
                        stationStatut === 'en-attente' ? 'rgba(245,158,11,0.22)' :
                        'rgba(255,255,255,0.06)',
            color: stationStatut === 'en-cours' ? '#93c5fd' :
                   stationStatut === 'en-attente' ? '#fcd34d' :
                   'rgba(255,255,255,0.55)',
          }}>
            {stationStatut === 'en-cours' ? '🚛' : stationStatut === 'en-attente' ? '⏳' : '⏸'}
            {' '}{station.icon} {station.label}
          </span>
        )}
        {inGarage && slotId && (
          <span style={{ padding: '1px 5px', borderRadius: 3, background: 'rgba(59,130,246,0.25)', color: '#93c5fd', fontWeight: 800, fontFamily: 'monospace' }}>
            Slot {slotId}
          </span>
        )}
        {v.type === 'eau' && !v.aUnReservoir && (
          <span style={{ padding: '1px 5px', borderRadius: 3, background: 'rgba(220,38,38,0.25)', color: '#fca5a5', fontWeight: 800 }}>
            ⚠️ Sans rés.
          </span>
        )}
        {restantes.length > 0 && (
          <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>
            {restantes.length} restante{restantes.length > 1 ? 's' : ''}
          </span>
        )}
      </div>}
    </div>
  );
}

// ── Bandeau Prêts à livrer (en bas) ─────────────────────────────
function BandeauPrets({ prets, onClick, itemByInvId }: {
  prets: VehiculeInventaire[];
  onClick: (id: string) => void;
  itemByInvId: Record<string, Item>;
}) {
  return (
    <div style={{
      flexShrink: 0,
      borderTop: '2px solid rgba(34,197,94,0.4)',
      background: 'linear-gradient(180deg, rgba(20,83,45,0.45) 0%, rgba(20,83,45,0.15) 100%)',
      padding: 'clamp(8px, 0.9vw, 12px) clamp(10px, 1.2vw, 18px)',
      display: 'flex', flexDirection: 'column', gap: 8,
      maxHeight: '24%',
      minHeight: 'clamp(110px, 14vh, 170px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{
          fontSize: 'clamp(13px, 1.2vw, 17px)', fontWeight: 900,
          color: '#86efac', letterSpacing: '0.05em',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          ✅ PRÊTS À LIVRER
        </span>
        <span style={{
          fontSize: 'clamp(18px, 1.8vw, 26px)', fontWeight: 900, color: '#22c55e', lineHeight: 1,
        }}>
          {prets.length}
        </span>
        <div style={{ flex: 1, height: 1, background: 'rgba(34,197,94,0.25)' }} />
        <span style={{ fontSize: 'clamp(9px, 0.8vw, 11px)', color: 'rgba(134,239,172,0.7)', fontStyle: 'italic' }}>
          Toutes étapes complétées · Plus rapprochés à gauche
        </span>
      </div>

      {prets.length === 0 ? (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'rgba(255,255,255,0.25)', fontSize: 'clamp(11px, 1vw, 13px)', fontStyle: 'italic',
        }}>
          Aucun camion prêt à livrer pour le moment
        </div>
      ) : (
        <div style={{
          flex: 1, minHeight: 0, overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(prets.length, 12)}, minmax(0, 1fr))`,
          gap: 'clamp(5px, 0.5vw, 8px)',
        }}>
          {prets.slice(0, 12).map(v => (
            <CartePret key={v.id} v={v} inGarage={!!itemByInvId[v.id]?.slotId}
              onClick={() => onClick(v.id)} />
          ))}
          {prets.length > 12 && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#86efac', fontWeight: 700, fontSize: 'clamp(11px, 1vw, 13px)',
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 8,
            }}>
              +{prets.length - 12}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CartePret({ v, inGarage, onClick }: {
  v: VehiculeInventaire;
  inGarage: boolean;
  onClick: () => void;
}) {
  const typeColor = v.type === 'eau' ? '#f97316' : v.type === 'client' ? '#3b82f6' : '#22c55e';
  const j = joursAvant(v.dateLivraisonPlanifiee);
  const dateLabel = j === null ? '—'
    : j < 0  ? `🚨 ${Math.abs(j)}j`
    : j === 0 ? "Auj."
    : j === 1 ? 'Demain'
    : `${j}j`;
  const client = v.clientAcheteur || v.nomClient;

  return (
    <div onClick={onClick} className="livr-card"
      style={{
        background: 'linear-gradient(135deg, rgba(34,197,94,0.18) 0%, rgba(34,197,94,0.05) 100%)',
        border: '1px solid rgba(34,197,94,0.4)',
        borderLeft: `3px solid ${typeColor}`,
        borderRadius: 8,
        padding: '6px 8px',
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: 4,
        minHeight: 0, overflow: 'hidden',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(34,197,94,0.3)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'none'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <PhotoOuIcone v={v} taille={28} />
        <span style={{
          fontFamily: 'monospace', fontWeight: 900,
          fontSize: 'clamp(11px, 1vw, 14px)', color: typeColor,
          lineHeight: 1,
        }}>
          #{v.numero}
        </span>
      </div>
      {client && (
        <div style={{
          fontSize: 'clamp(9px, 0.8vw, 11px)', color: 'white', fontWeight: 600,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2,
        }}>
          {client}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 'clamp(9px, 0.8vw, 11px)', fontWeight: 800,
          color: j !== null && j < 0 ? '#fca5a5' : j !== null && j <= 7 ? '#fdba74' : '#86efac',
        }}>
          📅 {dateLabel}
        </span>
        {inGarage && (
          <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: 'rgba(59,130,246,0.3)', color: '#93c5fd', fontWeight: 800 }}>
            Garage
          </span>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MOBILE (VueTerrain) — liste compacte avec filtres
// ════════════════════════════════════════════════════════════════

function VueLivraisonsMobile({ onClose, onSelectVehicule }: VueLivraisonsProps) {
  const { vehicules } = useInventaire();

  const [filtreCommercial, setFiltreCommercial] = useState<FiltreCommercial>('engagés');
  const [filtreType, setFiltreType] = useState<FiltreType>('tous');
  const [tri, setTri] = useState<Tri>('livraison');
  const [recherche, setRecherche] = useState('');

  const filtres = useMemo(() => {
    let result = vehicules.filter(v => v.statut !== 'archive');

    if (filtreCommercial === 'engagés') {
      result = result.filter(v => isEngagé(v) && !estVehiculePret(v));
    } else if (filtreCommercial === 'vendus') {
      result = result.filter(v => v.etatCommercial === 'vendu');
    } else if (filtreCommercial === 'reserves') {
      result = result.filter(v => v.etatCommercial === 'reserve');
    } else if (filtreCommercial === 'location') {
      result = result.filter(v => v.etatCommercial === 'location');
    } else if (filtreCommercial === 'non-vendus') {
      result = result.filter(v => !v.etatCommercial || v.etatCommercial === 'non-vendu');
    }

    if (filtreType !== 'tous') result = result.filter(v => v.type === filtreType);

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

    if (tri === 'livraison') {
      result.sort((a, b) => {
        const ja = joursAvant(a.dateLivraisonPlanifiee);
        const jb = joursAvant(b.dateLivraisonPlanifiee);
        if (ja === null && jb === null) return (a.numero || '').localeCompare(b.numero || '');
        if (ja === null) return 1;
        if (jb === null) return -1;
        return ja - jb;
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

  return (
    <div style={{
      width: '100%', height: '100dvh',
      background: '#f8fafc', display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ flexShrink: 0, background: 'white', borderBottom: '1px solid #e5e7eb', padding: '14px 16px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          {onClose && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#6b7280', padding: 4 }}>←</button>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>🚚 Suivi livraisons</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{filtres.length} camion{filtres.length > 1 ? 's' : ''}</div>
          </div>
        </div>
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#9ca3af' }}>🔍</span>
          <input type="search" value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="# / marque / client..."
            style={{ width: '100%', padding: '9px 12px 9px 36px', borderRadius: 10, fontSize: 14, border: '1px solid #e5e7eb', background: '#f8fafc', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 8 }}>
          {COMMERCIAL_OPTIONS.map(o => {
            const actif = filtreCommercial === o.id;
            return (
              <button key={o.id} onClick={() => setFiltreCommercial(o.id)}
                style={{ padding: '6px 12px', borderRadius: 16, fontSize: 12, fontWeight: actif ? 700 : 500,
                  border: actif ? `2px solid ${o.color}` : '1px solid #e5e7eb',
                  background: actif ? `${o.color}18` : 'white', color: actif ? o.color : '#6b7280',
                  cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {o.label}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {([['tous', 'Tous'], ['eau', '💧 Eau'], ['detail', '🏷️ Détail']] as [FiltreType, string][]).map(([id, label]) => {
              const actif = filtreType === id;
              return (
                <button key={id} onClick={() => setFiltreType(id)}
                  style={{ padding: '5px 10px', borderRadius: 12, fontSize: 11, fontWeight: actif ? 700 : 500,
                    border: actif ? '1px solid #1d4ed8' : '1px solid #e5e7eb', background: actif ? '#dbeafe' : 'white',
                    color: actif ? '#1d4ed8' : '#6b7280', cursor: 'pointer' }}>
                  {label}
                </button>
              );
            })}
          </div>
          <div style={{ width: 1, height: 18, background: '#e5e7eb' }} />
          <div style={{ display: 'flex', gap: 4 }}>
            {([['livraison', '📅'], ['priorite', '⭐'], ['restantes', '⏱']] as [Tri, string][]).map(([id, label]) => {
              const actif = tri === id;
              return (
                <button key={id} onClick={() => setTri(id)} style={{ padding: '5px 10px', borderRadius: 12, fontSize: 12, fontWeight: actif ? 700 : 500, border: actif ? '1px solid #7c3aed' : '1px solid #e5e7eb', background: actif ? '#ede9fe' : 'white', color: actif ? '#7c3aed' : '#6b7280', cursor: 'pointer' }}>{label}</button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Liste */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {filtres.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 14 }}>Aucun camion ne correspond</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtres.map(v => <CarteCamionMobile key={v.id} v={v} onClick={() => onSelectVehicule?.(v.id)} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function CarteCamionMobile({ v, onClick }: { v: VehiculeInventaire; onClick: () => void }) {
  const typeColor = v.type === 'eau' ? '#f97316' : v.type === 'client' ? '#3b82f6' : '#22c55e';
  const j = joursAvant(v.dateLivraisonPlanifiee);
  const restantes = getEtapesRestantes(v);
  const pct = getProgressionPct(v);
  const enCours = (v.roadMap ?? []).find(s => s.statut === 'en-cours');
  const prochaine = (v.roadMap ?? []).find(s => s.statut === 'en-attente') ?? restantes[0];

  const dateBg = j === null ? '#9ca3af'
    : j < 0   ? '#dc2626'
    : j <= 1  ? '#dc2626'
    : j <= 7  ? '#ea580c'
    : j <= 30 ? '#f59e0b'
    : '#22c55e';

  const dateLabel = j === null ? 'Pas de date'
    : j < 0  ? `${Math.abs(j)}j retard`
    : j === 0 ? "Auj."
    : j === 1 ? 'Demain'
    : `${j}j`;

  return (
    <div onClick={onClick}
      style={{ background: 'white', border: '1px solid #e5e7eb', borderLeft: `4px solid ${typeColor}`, borderRadius: 10, padding: '12px 14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <PhotoOuIcone v={v} taille={42} />
        <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 16, color: typeColor }}>#{v.numero}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, fontWeight: 800, color: 'white', background: dateBg, padding: '2px 8px', borderRadius: 4 }}>📅 {dateLabel}</span>
      </div>
      <div style={{ fontSize: 12, color: '#374151' }}>
        {v.clientAcheteur || v.nomClient || getLabelVehicule(v)}
      </div>
      {(v.roadMap ?? []).length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: '#e5e7eb', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#22c55e' : '#3b82f6' }} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', minWidth: 30, textAlign: 'right' }}>{pct}%</span>
        </div>
      )}
      {(enCours || prochaine) && (() => {
        const step = enCours ?? prochaine;
        if (!step) return null;
        const st = getStation(step.stationId);
        return (
          <div style={{ fontSize: 11, color: '#6b7280' }}>
            {enCours ? '🚛 ' : '⏭ '}{st?.icon} {st?.label}
            {!enCours && step.priorite && ` · priorité ${step.priorite}`}
          </div>
        );
      })()}
    </div>
  );
}
