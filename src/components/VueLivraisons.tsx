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
// Layout: Header KPIs + grille auto-fit À LIVRER + grille PRÊTS
// ════════════════════════════════════════════════════════════════

function VueLivraisonsDashboard({ onSelectVehicule }: { onSelectVehicule?: (id: string) => void }) {
  const { vehicules } = useInventaire();
  const { items } = useGarageOptional();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [tvMode, setTvMode] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Sync l'état tvMode quand l'utilisateur sort du fullscreen avec ESC
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) setTvMode(false);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleTvMode = async () => {
    if (!tvMode) {
      try { await document.documentElement.requestFullscreen(); } catch { /* navigateur peut refuser */ }
      setTvMode(true);
    } else {
      try { if (document.fullscreenElement) await document.exitFullscreen(); } catch { /* ignore */ }
      setTvMode(false);
    }
  };

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

  // Tri intelligent : retard > date proche > sans date par progression desc
  const aLivrerOrdonnés = useMemo(() => {
    const list = [...aLivrer];
    list.sort((a, b) => {
      const ja = joursAvant(a.dateLivraisonPlanifiee);
      const jb = joursAvant(b.dateLivraisonPlanifiee);
      // Avec date d'abord (les plus urgents en haut)
      if (ja !== null && jb !== null) return ja - jb;
      if (ja !== null) return -1;
      if (jb !== null) return 1;
      // Sans date : par progression descendante (les plus avancés en haut)
      return getProgressionPct(b) - getProgressionPct(a);
    });
    return list;
  }, [aLivrer]);

  const enRetard = aLivrer.filter(v => {
    const j = joursAvant(v.dateLivraisonPlanifiee);
    return j !== null && j < 0;
  }).length;
  const aujourdhui = aLivrer.filter(v => {
    const j = joursAvant(v.dateLivraisonPlanifiee);
    return j !== null && j >= 0 && j <= 1;
  }).length;
  const total = tousEngagés.length;
  const sansReservoir = aLivrer.filter(v => v.type === 'eau' && !v.aUnReservoir).length;

  const selected = selectedId ? vehicules.find(v => v.id === selectedId) ?? null : null;
  const selectedItem = selected ? itemByInvId[selected.id] : undefined;

  const handleClick = (id: string) => {
    if (onSelectVehicule) onSelectVehicule(id);
    else setSelectedId(id);
  };

  return (
    <div style={{
      ...(tvMode
        ? { position: 'fixed' as const, inset: 0, zIndex: 9999, width: '100vw', height: '100dvh' }
        : { width: '100%', height: '100%' }),
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
          <KPIBlock value={aujourdhui} label="Aujourd'hui / Demain" color="#ea580c" />
          <KPIBlock value={sansReservoir} label="Sans réservoir" color="#f59e0b" />
          <KPIBlock value={prets.length}  label="Prêts à livrer" color="#22c55e" />
        </div>

        {/* Horloge + bouton TV */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
          <button onClick={toggleTvMode}
            title={tvMode ? 'Quitter le mode TV (ESC)' : 'Plein écran TV'}
            style={{
              background: tvMode ? '#dc2626' : 'rgba(255,255,255,0.08)',
              border: `1px solid ${tvMode ? '#fca5a5' : 'rgba(255,255,255,0.15)'}`,
              color: 'white',
              padding: 'clamp(8px, 0.8vw, 12px) clamp(10px, 1vw, 14px)',
              borderRadius: 8, cursor: 'pointer',
              fontSize: 'clamp(13px, 1.2vw, 16px)', fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'all 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={e => { if (!tvMode) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.16)'; }}
            onMouseLeave={e => { if (!tvMode) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'; }}
          >
            {tvMode ? '✕ Quitter' : '🖥 Mode TV'}
          </button>
        </div>
      </div>

      {/* ── À LIVRER (grille auto-fit) ─────────────────────────── */}
      <SectionGrille
        titre="À LIVRER"
        icone="🔥"
        couleur="#ea580c"
        vehicules={aLivrerOrdonnés}
        onClick={handleClick}
        itemByInvId={itemByInvId}
        flexBasis={prets.length > 0 ? 0.68 : 1}
      />

      {/* ── PRÊTS À LIVRER (grille séparée verte) ──────────────── */}
      {prets.length > 0 && (
        <SectionGrille
          titre="PRÊTS À LIVRER"
          icone="✅"
          couleur="#22c55e"
          vehicules={prets}
          onClick={handleClick}
          itemByInvId={itemByInvId}
          flexBasis={0.32}
          variantPret
        />
      )}

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


// ── Section grille (À LIVRER ou PRÊTS) ──────────────────────────
function SectionGrille({ titre, icone, couleur, vehicules, onClick, itemByInvId, flexBasis, variantPret }: {
  titre: string;
  icone: string;
  couleur: string;
  vehicules: VehiculeInventaire[];
  onClick: (id: string) => void;
  itemByInvId: Record<string, Item>;
  flexBasis: number;
  variantPret?: boolean;
}) {
  // Largeur min calculée en fonction du nombre — plus il y en a, plus on est dense
  const count = vehicules.length;
  const minW =
    count === 0       ? 240 :
    count <= 4        ? 320 :
    count <= 8        ? 270 :
    count <= 14       ? 230 :
    count <= 24       ? 195 :
    count <= 36       ? 170 :
    150;

  return (
    <div style={{
      flex: `${flexBasis} 1 0`, minHeight: 0,
      display: 'flex', flexDirection: 'column',
      padding: 'clamp(8px, 1vh, 14px) clamp(10px, 1.2vw, 18px)',
      borderTop: variantPret ? `2px solid ${couleur}40` : 'none',
      background: variantPret
        ? 'linear-gradient(180deg, rgba(20,83,45,0.35) 0%, rgba(20,83,45,0.05) 100%)'
        : 'transparent',
    }}>
      {/* Header de section */}
      <div style={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 12,
        marginBottom: 'clamp(6px, 0.8vh, 10px)',
      }}>
        <span style={{ fontSize: 'clamp(16px, 1.5vw, 22px)' }}>{icone}</span>
        <span style={{
          fontSize: 'clamp(13px, 1.2vw, 17px)', fontWeight: 900,
          color: couleur, letterSpacing: '0.05em',
        }}>
          {titre}
        </span>
        <span style={{
          fontSize: 'clamp(20px, 2vw, 30px)', fontWeight: 900,
          color: couleur, lineHeight: 1, fontFamily: 'system-ui',
        }}>
          {count}
        </span>
        <div style={{ flex: 1, height: 1, background: `${couleur}30` }} />
        {!variantPret && count > 0 && (
          <span style={{ fontSize: 'clamp(9px, 0.85vw, 11px)', color: 'rgba(255,255,255,0.45)', fontStyle: 'italic' }}>
            Plus urgents en haut · Sans date triés par avancement
          </span>
        )}
      </div>

      {/* Grille auto-fit */}
      {count === 0 ? (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'rgba(255,255,255,0.25)', fontSize: 'clamp(12px, 1vw, 14px)', fontStyle: 'italic',
        }}>
          Aucun camion
        </div>
      ) : (
        <div style={{
          flex: 1, minHeight: 0, overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fit, minmax(${minW}px, 1fr))`,
          gridAutoRows: '1fr',
          gap: 'clamp(6px, 0.6vw, 10px)',
          alignContent: 'start',
        }}>
          {vehicules.map((v, idx) => (
            <CarteRiche key={v.id} v={v}
              inGarage={!!itemByInvId[v.id]?.slotId}
              slotId={itemByInvId[v.id]?.slotId}
              onClick={() => onClick(v.id)}
              delay={Math.min(idx * 25, 600)}
              variantPret={variantPret} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Carte camion riche (info complète, lisible TV) ──────────────
function CarteRiche({ v, inGarage, slotId, onClick, delay, variantPret }: {
  v: VehiculeInventaire;
  inGarage: boolean;
  slotId?: string;
  onClick: () => void;
  delay: number;
  variantPret?: boolean;
}) {
  const typeColor = v.type === 'eau' ? '#f97316' : v.type === 'client' ? '#3b82f6' : '#22c55e';
  const j = joursAvant(v.dateLivraisonPlanifiee);
  const restantes = getEtapesRestantes(v);
  const pct = getProgressionPct(v);
  const enCours = (v.roadMap ?? []).find(s => s.statut === 'en-cours');
  const prochaine = (v.roadMap ?? []).find(s => s.statut === 'en-attente') ?? restantes[0];
  const station = enCours ? getStation(enCours.stationId) : prochaine ? getStation(prochaine.stationId) : null;
  const stationStatut = enCours ? 'en-cours' : prochaine?.statut === 'en-attente' ? 'en-attente' : 'planifie';
  const client = v.clientAcheteur || v.nomClient;

  // Couleur urgence (utilisée pour bordure haut + pill date)
  const urgence =
    j === null ? { color: '#94a3b8', bg: 'rgba(148,163,184,0.18)', label: 'Pas de date', pulse: false }
    : j < 0    ? { color: '#fca5a5', bg: 'rgba(220,38,38,0.4)',    label: `🚨 ${Math.abs(j)}j retard`, pulse: true }
    : j === 0  ? { color: '#fca5a5', bg: 'rgba(220,38,38,0.4)',    label: "Aujourd'hui", pulse: true }
    : j === 1  ? { color: '#fdba74', bg: 'rgba(234,88,12,0.35)',   label: 'Demain', pulse: false }
    : j <= 7   ? { color: '#fdba74', bg: 'rgba(234,88,12,0.3)',    label: `Dans ${j}j`, pulse: false }
    : j <= 30  ? { color: '#fcd34d', bg: 'rgba(245,158,11,0.25)',  label: `Dans ${j}j`, pulse: false }
                : { color: '#93c5fd', bg: 'rgba(59,130,246,0.2)',  label: `Dans ${j}j`, pulse: false };

  const cBadgeBg = v.etatCommercial === 'vendu' ? '#22c55e' : v.etatCommercial === 'reserve' ? '#f59e0b' : v.etatCommercial === 'location' ? '#7c3aed' : '#6b7280';
  const cBadgeLabel = v.etatCommercial === 'vendu' ? '✓ VENDU' : v.etatCommercial === 'reserve' ? '🔒 RÉSERVÉ' : v.etatCommercial === 'location' ? '🔑 LOCATION' : '';

  const baseBg = variantPret
    ? 'linear-gradient(135deg, rgba(34,197,94,0.18) 0%, rgba(34,197,94,0.04) 100%)'
    : 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)';
  const hoverBg = variantPret
    ? 'linear-gradient(135deg, rgba(34,197,94,0.28) 0%, rgba(34,197,94,0.08) 100%)'
    : 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%)';

  return (
    <div className="livr-card" onClick={onClick}
      style={{
        background: baseBg,
        border: `1px solid ${urgence.color}50`,
        borderTop: `3px solid ${urgence.color}`,
        borderLeft: `3px solid ${typeColor}`,
        borderRadius: 10,
        padding: 'clamp(8px, 0.7vw, 11px)',
        cursor: 'pointer',
        transition: 'all 0.15s',
        display: 'flex', flexDirection: 'column',
        gap: 'clamp(4px, 0.4vh, 7px)',
        animationDelay: `${delay}ms`,
        minHeight: 0, overflow: 'hidden',
        boxShadow: urgence.pulse ? `0 0 0 0 ${urgence.color}40` : 'none',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = hoverBg; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 6px 20px rgba(0,0,0,0.4)`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = baseBg; (e.currentTarget as HTMLDivElement).style.transform = 'none'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
    >
      {/* Ligne 1 : photo + numéro + badge commercial */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(7px, 0.7vw, 10px)', flexShrink: 0 }}>
        <PhotoOuIcone v={v} taille="clamp(46px, 4.5vw, 64px)" />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{
            fontFamily: 'monospace', fontWeight: 900,
            fontSize: 'clamp(18px, 1.7vw, 24px)', color: typeColor,
            lineHeight: 1, letterSpacing: '0.02em',
          }}>
            #{v.numero}
          </span>
          {cBadgeLabel && (
            <span style={{
              fontSize: 'clamp(9px, 0.78vw, 10.5px)',
              background: cBadgeBg, color: 'white',
              padding: '2px 6px', borderRadius: 3, fontWeight: 800,
              alignSelf: 'flex-start', letterSpacing: '0.05em',
            }}>
              {cBadgeLabel}
            </span>
          )}
        </div>
      </div>

      {/* Ligne 2 : pill date GROS */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: urgence.bg, color: urgence.color,
        padding: 'clamp(4px, 0.4vh, 7px) 8px', borderRadius: 6,
        fontSize: 'clamp(11px, 1vw, 13px)', fontWeight: 800,
        border: `1px solid ${urgence.color}40`,
        whiteSpace: 'nowrap',
      }}>
        📅 {urgence.label}
      </div>

      {/* Ligne 3 : client (BIG) + véhicule */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minHeight: 0, overflow: 'hidden' }}>
        {client ? (
          <div style={{
            fontSize: 'clamp(12px, 1.1vw, 15px)', color: 'white', fontWeight: 700,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2,
          }}>
            {client}
          </div>
        ) : null}
        <div style={{
          fontSize: 'clamp(10px, 0.85vw, 12px)', color: 'rgba(255,255,255,0.55)', fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2,
        }}>
          {getLabelVehicule(v)}{v.variante ? ` · ${v.variante}` : ''}
        </div>
      </div>

      {/* Ligne 4 : barre de progression */}
      {(v.roadMap ?? []).length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 3, width: `${pct}%`,
              background: pct === 100 ? '#22c55e' : pct >= 50 ? '#3b82f6' : '#f59e0b',
              transition: 'width 0.3s',
            }} />
          </div>
          <span style={{
            fontSize: 'clamp(11px, 0.95vw, 13px)', fontWeight: 800,
            color: pct >= 50 ? '#86efac' : 'rgba(255,255,255,0.85)',
            minWidth: 36, textAlign: 'right', fontFamily: 'monospace',
          }}>
            {pct}%
          </span>
        </div>
      )}

      {/* Ligne 5 : étape en cours/prochaine + étapes restantes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
        {station && (
          <div style={{
            fontSize: 'clamp(10px, 0.9vw, 12px)', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 5,
            color: stationStatut === 'en-cours' ? '#93c5fd' :
                   stationStatut === 'en-attente' ? '#fcd34d' :
                   'rgba(255,255,255,0.6)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            <span style={{ flexShrink: 0 }}>
              {variantPret ? '✅' : stationStatut === 'en-cours' ? '🚛 EN COURS:' : stationStatut === 'en-attente' ? '⏳ EN ATTENTE:' : '⏸ PROCHAINE:'}
            </span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {variantPret ? 'Toutes étapes complétées' : `${station.icon} ${station.label}`}
            </span>
          </div>
        )}
        {!variantPret && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 'clamp(10px, 0.85vw, 11.5px)' }}>
            {restantes.length > 0 && (
              <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
                <strong style={{ color: '#fbbf24' }}>{restantes.length}</strong> étape{restantes.length > 1 ? 's' : ''} restante{restantes.length > 1 ? 's' : ''}
              </span>
            )}
            {inGarage && slotId && (
              <span style={{ padding: '1px 6px', borderRadius: 3, background: 'rgba(59,130,246,0.3)', color: '#93c5fd', fontWeight: 800, fontFamily: 'monospace' }}>
                Slot {slotId}
              </span>
            )}
            {v.type === 'eau' && !v.aUnReservoir && (
              <span style={{ padding: '1px 6px', borderRadius: 3, background: 'rgba(220,38,38,0.3)', color: '#fca5a5', fontWeight: 800 }}>
                ⚠️ Sans rés.
              </span>
            )}
          </div>
        )}
        {variantPret && inGarage && slotId && (
          <div>
            <span style={{ padding: '1px 6px', borderRadius: 3, background: 'rgba(59,130,246,0.3)', color: '#93c5fd', fontWeight: 800, fontFamily: 'monospace', fontSize: 'clamp(10px, 0.85vw, 11.5px)' }}>
              Slot {slotId}
            </span>
          </div>
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
