import { useState, useEffect, useMemo, useContext } from 'react';
import { useInventaire } from '../contexts/InventaireContext';
import { GarageContext } from '../contexts/GarageContext';
import type { Item } from '../types/item.types';
import { vendeurService, type Vendeur } from '../services/vendeurService';
import { estVehiculePret, type VehiculeInventaire, type RoadMapEtape } from '../types/inventaireTypes';
import { PanneauDetailVehicule } from './PanneauDetailVehicule';

/** useGarage qui ne crash pas si pas de provider. */
function useGarageOptional(): { items: Item[] } {
  const ctx = useContext(GarageContext);
  return ctx ?? { items: [] };
}

// ── Stations affichées dans le tableau ────────────────────────────
// Dans cet ordre : 6 stations + colonne "Prêt livraison"
const STATIONS_SUIVI = [
  { id: 'soudure-generale',     label: 'Soudure générale',     short: 'SOUD. GÉN.',   responsable: 'Daniel D.',    color: '#f97316', icon: '🔧' },
  { id: 'mecanique-generale',   label: 'Mécanique générale',   short: 'MÉC. GÉN.',    responsable: 'Régis D.',     color: '#3b82f6', icon: '⚙️' },
  { id: 'mecanique-moteur',     label: 'Mécanique moteur',     short: 'MÉC. MOT.',    responsable: 'Joel C.',      color: '#3b82f6', icon: '🔩' },
  { id: 'mecanique-electrique', label: 'Mécanique électrique', short: 'MÉC. ÉLEC.',   responsable: 'Joel C.',      color: '#3b82f6', icon: '💡' },
  { id: 'soudure-specialisee',  label: 'Soudure spécialisée',  short: 'SOUD. SPÉC.',  responsable: 'Sébastien H.', color: '#f97316', icon: '⚡' },
  { id: 'sous-traitants',       label: 'Sous-traitance',       short: 'SOUS-TRAIT.',  responsable: 'Patrick D.',   color: '#a855f7', icon: '🏭' },
] as const;

export function VueSuiviVente() {
  const { vehicules } = useInventaire();
  const { items } = useGarageOptional();
  const [vendeurs, setVendeurs] = useState<Vendeur[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [tvMode, setTvMode] = useState(false);

  // Horloge live
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Charger vendeurs
  useEffect(() => {
    vendeurService.getAll().then(setVendeurs).catch(console.error);
  }, []);

  // Sortie ESC du fullscreen
  useEffect(() => {
    const onFs = () => { if (!document.fullscreenElement) setTvMode(false); };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const toggleTvMode = async () => {
    if (!tvMode) {
      try { await document.documentElement.requestFullscreen(); } catch { /* ignore */ }
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

  const vendeurById = useMemo(() => {
    const m: Record<string, Vendeur> = {};
    for (const v of vendeurs) m[v.id] = v;
    return m;
  }, [vendeurs]);

  // Filtre : VENDU + RÉSERVÉ + LOCATION, types eau + détail, non archivés
  const camionsVendus = useMemo(() =>
    vehicules.filter(v =>
      v.statut !== 'archive' &&
      (v.type === 'eau' || v.type === 'detail') &&
      (v.etatCommercial === 'vendu' || v.etatCommercial === 'reserve' || v.etatCommercial === 'location')
    ),
  [vehicules]);

  // Liste affichée : ceux pas encore prêts
  const aLivrer = useMemo(() => {
    const list = camionsVendus.filter(v => !estVehiculePret(v));
    list.sort((a, b) => {
      const da = a.dateLivraisonPlanifiee ? new Date(a.dateLivraisonPlanifiee).getTime() : Number.MAX_SAFE_INTEGER;
      const db = b.dateLivraisonPlanifiee ? new Date(b.dateLivraisonPlanifiee).getTime() : Number.MAX_SAFE_INTEGER;
      return da - db;
    });
    return list;
  }, [camionsVendus]);

  // Compteur prêts à livrer (vendus + prêts, pas archivés)
  const pretsCount = useMemo(() =>
    camionsVendus.filter(estVehiculePret).length,
  [camionsVendus]);

  const selected = selectedId ? vehicules.find(v => v.id === selectedId) ?? null : null;
  const selectedItem = selected ? itemByInvId[selected.id] : undefined;

  return (
    <div style={{
      ...(tvMode
        ? { position: 'fixed' as const, inset: 0, zIndex: 9999, width: '100vw', height: '100dvh' }
        : { width: '100%', height: '100%' }),
      background: '#ffffff',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>

      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        padding: 'clamp(10px, 1.4vh, 18px) clamp(16px, 2vw, 28px)',
        background: '#0f172a',
        color: 'white',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto auto',
        gap: 'clamp(12px, 2vw, 28px)',
        alignItems: 'center',
        borderBottom: '3px solid #1e293b',
      }}>
        {/* Titre */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 'clamp(24px, 2.5vw, 34px)' }}>🛒</span>
          <div>
            <div style={{ fontSize: 'clamp(15px, 1.5vw, 20px)', fontWeight: 900, letterSpacing: '0.04em' }}>SUIVI VENTE</div>
            <div style={{ fontSize: 'clamp(9px, 0.85vw, 11px)', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Camions vendus en production · {aLivrer.length} à livrer
            </div>
          </div>
        </div>

        <div />

        {/* Compteur Prêts à livrer */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '8px 16px',
          background: pretsCount > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)',
          border: `2px solid ${pretsCount > 0 ? '#22c55e' : 'rgba(255,255,255,0.15)'}`,
          borderRadius: 10,
        }}>
          <span style={{ fontSize: 'clamp(20px, 2vw, 28px)' }}>✅</span>
          <div>
            <div style={{
              fontSize: 'clamp(28px, 3vw, 42px)', fontWeight: 900, lineHeight: 1,
              color: pretsCount > 0 ? '#86efac' : 'rgba(255,255,255,0.6)',
              fontFamily: 'system-ui',
            }}>{pretsCount}</div>
            <div style={{ fontSize: 'clamp(9px, 0.85vw, 11px)', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginTop: 2 }}>
              Prêts à livrer
            </div>
          </div>
        </div>

        {/* Horloge + bouton TV */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'monospace', fontSize: 'clamp(16px, 1.6vw, 22px)', fontWeight: 700, lineHeight: 1, letterSpacing: '0.04em' }}>
              {now.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div style={{ fontSize: 'clamp(9px, 0.8vw, 10px)', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>
              {now.toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' })}
            </div>
          </div>
          <button onClick={toggleTvMode}
            title={tvMode ? 'Quitter (ESC)' : 'Plein écran TV'}
            style={{
              background: tvMode ? '#dc2626' : 'rgba(255,255,255,0.08)',
              border: `1px solid ${tvMode ? '#fca5a5' : 'rgba(255,255,255,0.15)'}`,
              color: 'white', padding: 'clamp(6px, 0.8vw, 10px) clamp(8px, 1vw, 12px)',
              borderRadius: 8, cursor: 'pointer', fontSize: 'clamp(11px, 1vw, 13px)', fontWeight: 700,
              flexShrink: 0,
            }}>
            {tvMode ? '✕' : '🖥'}
          </button>
        </div>
      </div>

      {/* ── Tableau (un seul écran, auto-fit) ──────────────────────── */}
      <div style={{
        flex: 1, minHeight: 0, overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* En-têtes colonnes */}
        <HeaderRow />

        {/* Body : auto-fit lignes */}
        <div style={{
          flex: 1, minHeight: 0, overflow: 'hidden',
          display: 'grid',
          gridTemplateRows: aLivrer.length > 0 ? `repeat(${aLivrer.length}, minmax(0, 1fr))` : '1fr',
        }}>
          {aLivrer.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#94a3b8', gap: 12 }}>
              <span style={{ fontSize: 64 }}>✅</span>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#475569' }}>Aucun camion vendu en attente</div>
              {pretsCount > 0 && (
                <div style={{ fontSize: 14 }}><strong>{pretsCount}</strong> prêt{pretsCount > 1 ? 's' : ''} à livrer (compteur en haut)</div>
              )}
            </div>
          ) : aLivrer.map(v => (
            <LigneVente key={v.id} v={v}
              vendeur={v.vendeurId ? vendeurById[v.vendeurId] : undefined}
              onClickNumero={() => setSelectedId(v.id === selectedId ? null : v.id)}
              selected={selectedId === v.id} />
          ))}
        </div>
      </div>

      {/* Panneau détail (slide-in à droite) */}
      {selected && (
        <PanneauDetailVehicule vehicule={selected} item={selectedItem} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}

// ── En-têtes colonnes ────────────────────────────────────────────
function HeaderRow() {
  return (
    <div style={{
      flexShrink: 0,
      display: 'grid',
      gridTemplateColumns: COL_TEMPLATE,
      background: '#1e293b',
      color: 'white',
      borderBottom: '2px solid #334155',
      fontSize: 'clamp(10px, 1vw, 16px)',
      fontWeight: 800,
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
    }}>
      <CellHeader>Stock</CellHeader>
      <CellHeader>Équipement</CellHeader>
      <CellHeader>Vendeur</CellHeader>
      <CellHeader>Date prévue<br/>livraison</CellHeader>
      {STATIONS_SUIVI.map(s => (
        <CellHeader key={s.id} align="center">
          <div style={{ fontSize: 'clamp(14px, 1.5vw, 26px)', marginBottom: 2 }}>{s.icon}</div>
          <div style={{ fontSize: 'clamp(8px, 0.85vw, 13px)', whiteSpace: 'nowrap', textAlign: 'center' }}>{s.short}</div>
          <div style={{
            fontSize: 'clamp(8px, 0.75vw, 12px)',
            fontWeight: 600,
            color: '#94a3b8',
            textTransform: 'none',
            letterSpacing: 0,
            marginTop: 2,
            whiteSpace: 'nowrap',
          }}>
            {s.responsable}
          </div>
        </CellHeader>
      ))}
      <CellHeader align="center" style={{ background: '#166534' }}>
        <div style={{ fontSize: 'clamp(14px, 1.5vw, 26px)', marginBottom: 2 }}>🚚</div>
        <div style={{ fontSize: 'clamp(8px, 0.85vw, 13px)', textAlign: 'center', whiteSpace: 'nowrap' }}>Prêt<br/>livraison</div>
      </CellHeader>
    </div>
  );
}

// Toutes les colonnes en fr → s'adaptent à la largeur disponible (TV/4K friendly)
// Stock, Vendeur, Date, Prêt = colonnes étroites mais visibles
// Équipement = la plus large (4fr, prend tout l'espace restant)
// 6 stations = 1fr chacune (égales)
const COL_TEMPLATE = '1.4fr 4fr 1.2fr 1.6fr repeat(6, minmax(0, 1fr)) 1.2fr';

function CellHeader({ children, align, style }: { children: React.ReactNode; align?: 'left' | 'center'; style?: React.CSSProperties }) {
  return (
    <div style={{
      padding: 'clamp(6px, 0.8vh, 12px) clamp(6px, 0.6vw, 10px)',
      borderRight: '1px solid #334155',
      display: 'flex', alignItems: 'center', justifyContent: align === 'center' ? 'center' : 'flex-start',
      flexDirection: 'column',
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── Ligne d'un véhicule vendu ────────────────────────────────────
function LigneVente({ v, vendeur, onClickNumero, selected }: {
  v: VehiculeInventaire;
  vendeur?: Vendeur;
  onClickNumero: () => void;
  selected: boolean;
}) {
  const dateStr = formatDate(v.dateLivraisonPlanifiee);
  const dateUrgence = urgenceDate(v.dateLivraisonPlanifiee);
  const equipement = formatEquipement(v);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: COL_TEMPLATE,
      borderBottom: '1px solid #e5e7eb',
      background: selected ? '#fef3c7' : 'white',
      transition: 'background 0.15s',
      minHeight: 0,
    }}>
      {/* Stock — cliquable, gros pour TV (auto-fit jusqu'à 40px en 4K) */}
      <Cell onClick={onClickNumero} style={{ cursor: 'pointer', background: selected ? '#fde68a' : '#f8fafc' }}>
        <span style={{
          fontFamily: 'monospace', fontWeight: 900,
          fontSize: 'clamp(18px, 2vw, 40px)',
          color: selected ? '#92400e' : '#0f172a',
          textDecoration: 'underline', textDecorationColor: '#cbd5e1',
          letterSpacing: '0.02em',
          whiteSpace: 'nowrap',
        }}>
          {v.numero}**
        </span>
      </Cell>

      {/* Équipement — icône type + texte + badge commercial */}
      <Cell align="left">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(6px, 0.7vw, 12px)', width: '100%', minWidth: 0 }}>
          {/* Icône type (eau / detail) */}
          <TypeIcon type={v.type} />

          {/* Texte équipement */}
          <span style={{
            flex: 1, minWidth: 0,
            fontSize: 'clamp(15px, 1.5vw, 26px)',
            fontWeight: 800, color: '#0f172a',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {equipement}
          </span>

          {/* Badge commercial */}
          <CommercialBadge etat={v.etatCommercial} />
        </div>
      </Cell>

      {/* Vendeur */}
      <Cell>
        <span style={{
          fontSize: 'clamp(13px, 1.3vw, 24px)',
          fontWeight: 800, color: vendeur ? '#7c3aed' : '#9ca3af',
          textTransform: 'uppercase', whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
        }}>
          {vendeur?.nom ?? '—'}
        </span>
      </Cell>

      {/* Date prévue livraison */}
      <Cell>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
          <div style={{ fontSize: 'clamp(13px, 1.3vw, 22px)', fontWeight: 800, color: dateUrgence.color, whiteSpace: 'nowrap' }}>
            {dateStr}
          </div>
          {dateUrgence.note && (
            <div style={{ fontSize: 'clamp(10px, 0.95vw, 16px)', color: dateUrgence.color, fontWeight: 700, marginTop: 2, whiteSpace: 'nowrap' }}>
              {dateUrgence.note}
            </div>
          )}
        </div>
      </Cell>

      {/* Stations */}
      {STATIONS_SUIVI.map(s => {
        const etat = etatStation(v.roadMap ?? [], s.id);
        return <Cell key={s.id} align="center"><EtapeIcon etat={etat} /></Cell>;
      })}

      {/* Prêt livraison */}
      <Cell align="center" style={{ background: estVehiculePret(v) ? '#dcfce7' : '#f8fafc' }}>
        <EtapeIcon etat={estVehiculePret(v) ? 'termine' : 'planifie'} large />
      </Cell>
    </div>
  );
}

function Cell({ children, align, onClick, style }: { children: React.ReactNode; align?: 'left' | 'center'; onClick?: () => void; style?: React.CSSProperties }) {
  return (
    <div onClick={onClick} style={{
      padding: 'clamp(4px, 0.6vh, 10px) clamp(8px, 0.8vw, 14px)',
      borderRight: '1px solid #e5e7eb',
      display: 'flex',
      alignItems: 'center',
      justifyContent: align === 'center' ? 'center' : 'flex-start',
      minHeight: 0, overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── Icône d'étape (case à cocher style PDF) ──────────────────────
type EtatEtape = 'termine' | 'en-cours' | 'planifie' | 'absente';

function EtapeIcon({ etat, large }: { etat: EtatEtape; large?: boolean }) {
  // Taille adaptative TV-friendly (auto-fit jusqu'à 4K)
  const size = large ? 'clamp(30px, 3vw, 56px)' : 'clamp(24px, 2.4vw, 44px)';
  const fontSize = large ? 'clamp(20px, 2vw, 36px)' : 'clamp(16px, 1.6vw, 28px)';

  if (etat === 'termine') {
    return (
      <div style={{
        width: size, height: size, borderRadius: 'clamp(4px, 0.5vw, 8px)',
        background: '#22c55e', color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize, fontWeight: 900, boxShadow: '0 2px 6px rgba(34,197,94,0.35)',
      }}>
        ✓
      </div>
    );
  }

  if (etat === 'en-cours') {
    return (
      <div style={{
        width: size, height: size, borderRadius: 'clamp(4px, 0.5vw, 8px)',
        background: '#dbeafe', color: '#1e40af',
        border: '2px solid #3b82f6',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize,
      }}>
        ⏳
      </div>
    );
  }

  if (etat === 'absente') {
    // Rond barré rouge — étape pas dans le road_map = pas à faire
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        border: 'clamp(2px, 0.25vw, 4px) solid #dc2626',
        background: 'white',
        position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          position: 'absolute', width: '70%',
          height: 'clamp(2px, 0.25vw, 4px)',
          background: '#dc2626',
          transform: 'rotate(-45deg)',
        }} />
      </div>
    );
  }

  // planifie / en-attente / saute → case vide
  return (
    <div style={{
      width: size, height: size, borderRadius: 'clamp(4px, 0.5vw, 8px)',
      border: 'clamp(2px, 0.25vw, 3px) solid #cbd5e1', background: 'white',
    }} />
  );
}

// ── Icône type (eau = goutte bleue / detail = tag vert) ──────────
function TypeIcon({ type }: { type: 'eau' | 'client' | 'detail' }) {
  const cfg = type === 'eau'
    ? { bg: '#dbeafe', color: '#1e40af', emoji: '💧', label: 'Eau' }
    : { bg: '#dcfce7', color: '#166534', emoji: '🏷️', label: 'Détail' };
  return (
    <div title={cfg.label} style={{
      width:  'clamp(28px, 2.6vw, 44px)',
      height: 'clamp(28px, 2.6vw, 44px)',
      borderRadius: '50%',
      background: cfg.bg,
      border: `2px solid ${cfg.color}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      fontSize: 'clamp(14px, 1.3vw, 22px)',
    }}>
      {cfg.emoji}
    </div>
  );
}

// ── Badge commercial ─────────────────────────────────────────────
function CommercialBadge({ etat }: { etat?: string }) {
  if (etat === 'vendu')    return <Badge bg="#22c55e" label="VENDU" />;
  if (etat === 'reserve')  return <Badge bg="#f59e0b" label="RÉSERVÉ" />;
  if (etat === 'location') return <Badge bg="#7c3aed" label="LOCATION" />;
  return null;
}

function Badge({ bg, label }: { bg: string; label: string }) {
  return (
    <span style={{
      flexShrink: 0,
      fontSize: 'clamp(9px, 0.8vw, 13px)',
      fontWeight: 800,
      color: 'white',
      background: bg,
      padding: 'clamp(2px, 0.3vh, 4px) clamp(6px, 0.6vw, 10px)',
      borderRadius: 4,
      letterSpacing: '0.05em',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

// ── Helpers ───────────────────────────────────────────────────────

function etatStation(roadMap: RoadMapEtape[], stationId: string): EtatEtape {
  const etapes = roadMap.filter(r => r.stationId === stationId);
  if (etapes.length === 0) return 'absente'; // pas dans le road_map → rond barré rouge
  if (etapes.some(r => r.statut === 'termine') && etapes.every(r => r.statut === 'termine' || r.statut === 'saute')) return 'termine';
  if (etapes.some(r => r.statut === 'en-cours')) return 'en-cours';
  // Tout en planifié, en-attente, ou sauté (mais pas terminé) → vide
  return 'planifie';
}

function formatEquipement(v: VehiculeInventaire): string {
  const parts = [];
  if (v.annee) parts.push(String(v.annee));
  if (v.marque) parts.push(v.marque.toUpperCase());
  if (v.modele) parts.push(v.modele);
  return parts.join(' ') || (v.descriptionTravail ?? v.numero);
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-CA', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function urgenceDate(dateStr?: string): { color: string; note?: string } {
  if (!dateStr) return { color: '#94a3b8' };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { color: '#94a3b8' };
  const today = new Date(); today.setHours(0, 0, 0, 0); d.setHours(0, 0, 0, 0);
  const j = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (j < 0)   return { color: '#dc2626', note: `${Math.abs(j)}j retard` };
  if (j === 0) return { color: '#dc2626', note: "Aujourd'hui" };
  if (j === 1) return { color: '#dc2626', note: 'Demain' };
  if (j <= 7)  return { color: '#ea580c', note: `Dans ${j}j` };
  if (j <= 30) return { color: '#f59e0b', note: `Dans ${j}j` };
  return { color: '#0f172a' };
}
