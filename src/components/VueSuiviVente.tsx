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
  { id: 'soudure-generale',     label: 'Soudure générale',     short: 'SOUD. GÉN.',   color: '#f97316', icon: '🔧' },
  { id: 'mecanique-generale',   label: 'Mécanique générale',   short: 'MÉC. GÉN.',    color: '#3b82f6', icon: '⚙️' },
  { id: 'mecanique-moteur',     label: 'Mécanique moteur',     short: 'MÉC. MOT.',    color: '#3b82f6', icon: '🔩' },
  { id: 'mecanique-electrique', label: 'Mécanique électrique', short: 'MÉC. ÉLEC.',   color: '#3b82f6', icon: '💡' },
  { id: 'soudure-specialisee',  label: 'Soudure spécialisée',  short: 'SOUD. SPÉC.',  color: '#f97316', icon: '⚡' },
  { id: 'sous-traitants',       label: 'Sous-traitance',       short: 'SOUS-TRAIT.',  color: '#a855f7', icon: '🏭' },
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

  // Filtre : VENDU seulement, types eau + détail, non archivés
  const camionsVendus = useMemo(() =>
    vehicules.filter(v =>
      v.statut !== 'archive' &&
      (v.type === 'eau' || v.type === 'detail') &&
      v.etatCommercial === 'vendu'
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
      fontSize: 'clamp(9px, 0.9vw, 12px)',
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
          <div style={{ fontSize: 'clamp(13px, 1.2vw, 18px)', marginBottom: 2 }}>{s.icon}</div>
          <div style={{ fontSize: 'clamp(8px, 0.8vw, 10px)', whiteSpace: 'nowrap' }}>{s.short}</div>
        </CellHeader>
      ))}
      <CellHeader align="center" style={{ background: '#166534' }}>
        <div style={{ fontSize: 'clamp(13px, 1.2vw, 18px)', marginBottom: 2 }}>🚚</div>
        <div style={{ fontSize: 'clamp(8px, 0.8vw, 10px)' }}>Prêt<br/>livraison</div>
      </CellHeader>
    </div>
  );
}

const COL_TEMPLATE = '120px minmax(260px, 3fr) 100px 140px repeat(6, minmax(70px, 1fr)) 100px';

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
      {/* Stock — cliquable, gros pour TV */}
      <Cell onClick={onClickNumero} style={{ cursor: 'pointer', background: selected ? '#fde68a' : '#f8fafc' }}>
        <span style={{
          fontFamily: 'monospace', fontWeight: 900, fontSize: 'clamp(20px, 2vw, 30px)',
          color: selected ? '#92400e' : '#0f172a',
          textDecoration: 'underline', textDecorationColor: '#cbd5e1',
          letterSpacing: '0.02em',
        }}>
          {v.numero}**
        </span>
      </Cell>

      {/* Équipement — gros pour TV */}
      <Cell align="left">
        <span style={{ fontSize: 'clamp(15px, 1.5vw, 22px)', fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
          {equipement}
        </span>
      </Cell>

      {/* Vendeur */}
      <Cell>
        <span style={{ fontSize: 'clamp(13px, 1.2vw, 17px)', fontWeight: 800, color: vendeur ? '#7c3aed' : '#9ca3af', textTransform: 'uppercase' }}>
          {vendeur?.nom ?? '—'}
        </span>
      </Cell>

      {/* Date prévue livraison */}
      <Cell>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
          <div style={{ fontSize: 'clamp(13px, 1.2vw, 17px)', fontWeight: 800, color: dateUrgence.color, whiteSpace: 'nowrap' }}>
            {dateStr}
          </div>
          {dateUrgence.note && (
            <div style={{ fontSize: 'clamp(10px, 0.9vw, 12px)', color: dateUrgence.color, fontWeight: 700, marginTop: 2, whiteSpace: 'nowrap' }}>
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
  const size = large ? 'clamp(28px, 2.6vw, 38px)' : 'clamp(22px, 2vw, 30px)';

  if (etat === 'termine') {
    return (
      <div style={{
        width: size, height: size, borderRadius: 6,
        background: '#22c55e', color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: large ? 'clamp(20px, 1.9vw, 26px)' : 'clamp(15px, 1.4vw, 20px)',
        fontWeight: 900, boxShadow: '0 2px 4px rgba(34,197,94,0.3)',
      }}>
        ✓
      </div>
    );
  }

  if (etat === 'en-cours') {
    return (
      <div style={{
        width: size, height: size, borderRadius: 6,
        background: '#dbeafe', color: '#1e40af',
        border: '2px solid #3b82f6',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: large ? 'clamp(18px, 1.7vw, 24px)' : 'clamp(14px, 1.3vw, 18px)',
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
        border: '2.5px solid #dc2626',
        background: 'white',
        position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          position: 'absolute', width: '70%', height: 2.5, background: '#dc2626',
          transform: 'rotate(-45deg)',
        }} />
      </div>
    );
  }

  // planifie / en-attente / saute → case vide
  return (
    <div style={{
      width: size, height: size, borderRadius: 6,
      border: '2px solid #cbd5e1', background: 'white',
    }} />
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
  if (v.type === 'eau') parts.push('WT');
  // type detail : pas de préfixe (comme dans le PDF)

  if (v.annee) parts.push(String(v.annee));
  if (v.marque) parts.push(v.marque.toUpperCase());
  if (v.modele) parts.push(v.modele);

  if (v.etatCommercial === 'location') parts.push('(LOCATION)');

  const result = parts.join(parts[0] === 'WT' ? ' - ' : ' ').replace(/^WT - WT/, 'WT');
  // si commence par "WT" et qu'il y a une année juste après, format "WT - 2018 ..."
  if (parts[0] === 'WT') {
    const rest = parts.slice(1).join(' ');
    return `WT - ${rest}`;
  }
  return result || (v.descriptionTravail ?? v.numero);
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
