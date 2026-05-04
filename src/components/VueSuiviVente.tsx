import { useState, useEffect, useMemo, useContext } from 'react';
import { useInventaire } from '../contexts/InventaireContext';
import { GarageContext } from '../contexts/GarageContext';
import type { Item } from '../types/item.types';
import { vendeurService, type Vendeur } from '../services/vendeurService';
import { estVehiculePret, type VehiculeInventaire, type RoadMapEtape } from '../types/inventaireTypes';
import { PanneauDetailVehicule, ModalPDF } from './PanneauDetailVehicule';

/** useGarage qui ne crash pas si pas de provider. */
function useGarageOptional(): { items: Item[] } {
  const ctx = useContext(GarageContext);
  return ctx ?? { items: [] };
}

// ── Stations affichées dans le tableau ────────────────────────────
// 6 stations road_map. Lavage + Retouche sont gérés dans le panneau
// détail du camion mais NE sont PAS affichés sur la TV (demande équipe).
const STATIONS_SUIVI = [
  { id: 'soudure-generale',     label: 'Soudure générale',     short: 'SOUD. GÉN.',   mobileLabel: 'Soud. général.',  responsable: 'Daniel D.',    color: '#f97316', icon: '🔧' },
  { id: 'mecanique-generale',   label: 'Mécanique générale',   short: 'MÉC. GÉN.',    mobileLabel: 'Méc. général.',   responsable: 'Régis D.',     color: '#3b82f6', icon: '⚙️' },
  { id: 'mecanique-moteur',     label: 'Mécanique moteur',     short: 'MÉC. MOT.',    mobileLabel: 'Méc. moteur',     responsable: 'Joel C.',      color: '#3b82f6', icon: '🔩' },
  { id: 'mecanique-electrique', label: 'Mécanique électrique', short: 'MÉC. ÉLEC.',   mobileLabel: 'Méc. électrique', responsable: 'Joel C.',      color: '#3b82f6', icon: '💡' },
  { id: 'soudure-specialisee',  label: 'Soudure spécialisée',  short: 'SOUD. SPÉC.',  mobileLabel: 'Soud. spécial.',  responsable: 'Sébastien H.', color: '#f97316', icon: '⚡' },
  { id: 'sous-traitants',       label: 'Sous-traitance',       short: 'SOUS-TRAIT.',  mobileLabel: 'Sous-traitance',  responsable: 'Patrick D.',   color: '#a855f7', icon: '🏭' },
] as const;

export function VueSuiviVente(props: { mobile?: boolean; onClose?: () => void; onSelectVehicule?: (id: string) => void } = {}) {
  if (props.mobile) return <VueSuiviVenteMobile onClose={props.onClose} onSelectVehicule={props.onSelectVehicule} />;
  return <VueSuiviVenteDesktop />;
}

function VueSuiviVenteDesktop() {
  const { vehicules } = useInventaire();
  const { items } = useGarageOptional();
  const [vendeurs, setVendeurs] = useState<Vendeur[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [tvMode, setTvMode] = useState(false);
  const [viewMode, setViewMode] = useState<'a-livrer' | 'prets'>('a-livrer');
  const [pdfOuvert, setPdfOuvert] = useState<{ nom: string; base64: string } | null>(null);

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

  // Tri commun : ASAP en haut, puis date la plus proche
  const trier = (list: VehiculeInventaire[]) => {
    list.sort((a, b) => {
      // ASAP en priorité absolue
      if (a.livraisonAsap && !b.livraisonAsap) return -1;
      if (!a.livraisonAsap && b.livraisonAsap) return 1;
      const da = a.dateLivraisonPlanifiee ? new Date(a.dateLivraisonPlanifiee).getTime() : Number.MAX_SAFE_INTEGER;
      const db = b.dateLivraisonPlanifiee ? new Date(b.dateLivraisonPlanifiee).getTime() : Number.MAX_SAFE_INTEGER;
      return da - db;
    });
    return list;
  };

  // À livrer : pas encore prêts
  const aLivrer = useMemo(() => trier(camionsVendus.filter(v => !estVehiculePret(v))), [camionsVendus]);

  // Prêts : marqués prêt mais pas archivés
  const pretsList = useMemo(() => trier(camionsVendus.filter(estVehiculePret)), [camionsVendus]);

  // Liste affichée selon le mode
  const liste = viewMode === 'prets' ? pretsList : aLivrer;
  const pretsCount = pretsList.length;

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
            <div style={{ fontSize: 'clamp(15px, 1.5vw, 20px)', fontWeight: 900, letterSpacing: '0.04em' }}>
              {viewMode === 'prets' ? 'SUIVI VENTE — PRÊTS À LIVRER' : 'SUIVI VENTE'}
            </div>
            <div style={{ fontSize: 'clamp(9px, 0.85vw, 11px)', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {viewMode === 'prets'
                ? `${pretsList.length} camion${pretsList.length > 1 ? 's' : ''} prêt${pretsList.length > 1 ? 's' : ''} à livrer`
                : `Camions vendus en production · ${aLivrer.length} à livrer`}
            </div>
          </div>
        </div>

        <div />

        {/* Compteur Prêts à livrer (cliquable → toggle) */}
        <button onClick={() => setViewMode(m => m === 'prets' ? 'a-livrer' : 'prets')}
          title={viewMode === 'prets' ? 'Retour à la liste à livrer' : 'Voir les camions prêts à livrer'}
          style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '8px 16px',
            background: viewMode === 'prets'
              ? 'rgba(34,197,94,0.35)'
              : (pretsCount > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)'),
            border: `2px solid ${viewMode === 'prets' ? '#86efac' : (pretsCount > 0 ? '#22c55e' : 'rgba(255,255,255,0.15)')}`,
            borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
            font: 'inherit', color: 'inherit',
            boxShadow: viewMode === 'prets' ? '0 0 0 4px rgba(134,239,172,0.25)' : 'none',
          }}>
          <span style={{ fontSize: 'clamp(20px, 2vw, 28px)' }}>{viewMode === 'prets' ? '↩' : '✅'}</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{
              fontSize: 'clamp(28px, 3vw, 42px)', fontWeight: 900, lineHeight: 1,
              color: pretsCount > 0 ? '#86efac' : 'rgba(255,255,255,0.6)',
              fontFamily: 'system-ui',
            }}>{pretsCount}</div>
            <div style={{ fontSize: 'clamp(9px, 0.85vw, 11px)', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginTop: 2, whiteSpace: 'nowrap' }}>
              {viewMode === 'prets' ? '← Retour' : 'Prêts à livrer'}
            </div>
          </div>
        </button>

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
          gridTemplateRows: liste.length > 0 ? `repeat(${liste.length}, minmax(0, 1fr))` : '1fr',
        }}>
          {liste.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#94a3b8', gap: 12 }}>
              <span style={{ fontSize: 64 }}>{viewMode === 'prets' ? '🚚' : '✅'}</span>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#475569' }}>
                {viewMode === 'prets' ? 'Aucun camion prêt à livrer' : 'Aucun camion vendu en attente'}
              </div>
            </div>
          ) : liste.map((v, idx) => (
            <LigneVente key={v.id} v={v}
              idx={idx}
              vendeur={v.vendeurId ? vendeurById[v.vendeurId] : undefined}
              item={itemByInvId[v.id]}
              onClickNumero={() => setSelectedId(v.id === selectedId ? null : v.id)}
              onClickPdf={setPdfOuvert}
              selected={selectedId === v.id} />
          ))}
        </div>
      </div>

      {/* Panneau détail (slide-in à droite) — key force le remount au changement de camion */}
      {selected && (
        <PanneauDetailVehicule key={selected.id} vehicule={selected} item={selectedItem} onClose={() => setSelectedId(null)} />
      )}

      {/* Modal PDF */}
      {pdfOuvert && <ModalPDF doc={pdfOuvert} onClose={() => setPdfOuvert(null)} />}

      {/* Animation ASAP */}
      <style>{`
        @keyframes asapPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.5); }
          50%      { box-shadow: 0 0 0 6px rgba(220,38,38,0); }
        }
      `}</style>
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
      <CellHeader align="center">
        <div style={{ fontSize: 'clamp(13px, 1.4vw, 22px)' }}>📄</div>
      </CellHeader>
      {STATIONS_SUIVI.map(s => (
        <CellHeader key={s.id} align="center">
          <div style={{ fontSize: 'clamp(13px, 1.4vw, 24px)', marginBottom: 2 }}>{s.icon}</div>
          <div style={{ fontSize: 'clamp(7px, 0.8vw, 12px)', whiteSpace: 'nowrap', textAlign: 'center' }}>{s.short}</div>
          {s.responsable && (
            <div style={{
              fontSize: 'clamp(7px, 0.7vw, 11px)',
              fontWeight: 600,
              color: '#94a3b8',
              textTransform: 'none',
              letterSpacing: 0,
              marginTop: 2,
              whiteSpace: 'nowrap',
            }}>
              {s.responsable}
            </div>
          )}
        </CellHeader>
      ))}
    </div>
  );
}

// Toutes les colonnes en fr → s'adaptent à la largeur disponible (TV/4K friendly)
// Stock | Équipement | Vendeur | Date | PDF | 6 stations road_map
const COL_TEMPLATE = '1.4fr 4fr 1.2fr 1.6fr 0.6fr repeat(6, minmax(0, 1fr))';

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
function LigneVente({ v, idx, vendeur, item, onClickNumero, onClickPdf, selected }: {
  v: VehiculeInventaire;
  idx: number;
  vendeur?: Vendeur;
  item?: Item;
  onClickNumero: () => void;
  onClickPdf: (doc: { nom: string; base64: string }) => void;
  selected: boolean;
}) {
  const dateStr = formatDate(v.dateLivraisonPlanifiee);
  const dateUrgence = urgenceDate(v.dateLivraisonPlanifiee);
  const equipement = formatEquipement(v);
  const documents = item?.documents ?? [];

  // Zebra : alterner blanc / gris très pâle
  const zebraBg = idx % 2 === 0 ? 'white' : '#f3f4f6';

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: COL_TEMPLATE,
      borderBottom: '1px solid #e5e7eb',
      background: selected ? '#fef3c7' : zebraBg,
      transition: 'background 0.15s',
      minHeight: 0,
    }}>
      {/* Stock — cliquable, gros pour TV (auto-fit jusqu'à 40px en 4K) */}
      <Cell onClick={onClickNumero} style={{
        cursor: 'pointer',
        background: selected ? '#fde68a' : (idx % 2 === 0 ? '#f1f5f9' : '#e2e8f0'),
      }}>
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

          {/* Texte équipement — wrap multi-lignes pour lecture complète */}
          <span style={{
            flex: 1, minWidth: 0,
            fontSize: 'clamp(13px, 1.4vw, 24px)',
            fontWeight: 800, color: '#0f172a',
            whiteSpace: 'normal',
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            lineHeight: 1.2,
          }}>
            {equipement}
          </span>

          {/* Badge commercial */}
          <CommercialBadge etat={v.etatCommercial} />
        </div>
      </Cell>

      {/* Vendeur + mini-badges paiement */}
      <Cell>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          <span style={{
            fontSize: 'clamp(13px, 1.3vw, 22px)',
            fontWeight: 800, color: vendeur ? '#7c3aed' : '#9ca3af',
            textTransform: 'uppercase', whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {vendeur?.nom ?? '—'}
          </span>
          {(v.paiementDepot || v.paiementComplet || v.paiementPo) && (
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {v.paiementDepot   && <MiniBadgePaiement bg="#f59e0b" label="💵" title="Dépôt reçu" />}
              {v.paiementComplet && <MiniBadgePaiement bg="#22c55e" label="✅" title="Payé complet" />}
              {v.paiementPo      && <MiniBadgePaiement bg="#3b82f6" label="📋" title="PO reçu" />}
            </div>
          )}
        </div>
      </Cell>

      {/* Date prévue livraison + flag ASAP */}
      <Cell>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
          {v.livraisonAsap ? (
            <div style={{
              fontSize: 'clamp(13px, 1.3vw, 22px)', fontWeight: 900,
              color: '#dc2626', whiteSpace: 'nowrap',
              padding: '3px 8px', borderRadius: 4,
              background: '#fee2e2', border: '1px solid #fca5a5',
              animation: 'asapPulse 1.5s infinite',
            }}>
              🔥 ASAP
            </div>
          ) : (
            <>
              <div style={{ fontSize: 'clamp(13px, 1.3vw, 22px)', fontWeight: 800, color: dateUrgence.color, whiteSpace: 'nowrap' }}>
                {dateStr}
              </div>
              {dateUrgence.note && (
                <div style={{ fontSize: 'clamp(10px, 0.95vw, 16px)', color: dateUrgence.color, fontWeight: 700, marginTop: 2, whiteSpace: 'nowrap' }}>
                  {dateUrgence.note}
                </div>
              )}
            </>
          )}
        </div>
      </Cell>

      {/* PDF (compact) */}
      <Cell align="center">
        {documents.length > 0 ? (
          <button onClick={(e) => { e.stopPropagation(); onClickPdf({ nom: documents[0].nom, base64: documents[0].base64 }); }}
            title={documents.map(d => d.nom).join(' · ')}
            style={{
              background: '#fee2e2', border: '1px solid #fca5a5',
              color: '#dc2626', borderRadius: 6,
              padding: 'clamp(4px, 0.6vw, 8px) clamp(6px, 0.7vw, 10px)',
              cursor: 'pointer', fontWeight: 700,
              fontSize: 'clamp(11px, 1.1vw, 16px)',
              display: 'flex', alignItems: 'center', gap: 3,
              whiteSpace: 'nowrap',
            }}>
            📄{documents.length > 1 && <span>{documents.length}</span>}
          </button>
        ) : (
          <span style={{ color: '#cbd5e1', fontSize: 'clamp(12px, 1.1vw, 16px)' }}>—</span>
        )}
      </Cell>

      {/* Stations */}
      {STATIONS_SUIVI.map(s => {
        const etat = etatStationOrFinale(v, s.id);
        return <Cell key={s.id} align="center"><EtapeIcon etat={etat} /></Cell>;
      })}
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

// ── Mini-badge paiement (compact, sous vendeur) ──────────────────
function MiniBadgePaiement({ bg, label, title }: { bg: string; label: string; title: string }) {
  return (
    <span title={title} style={{
      fontSize: 'clamp(10px, 0.85vw, 13px)',
      background: bg, color: 'white',
      padding: 'clamp(1px, 0.2vh, 3px) clamp(4px, 0.4vw, 7px)',
      borderRadius: 3, fontWeight: 800,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
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
  return 'planifie';
}

/** État pour stations road_map OU étapes finales (lavage/retouche). */
function etatStationOrFinale(v: VehiculeInventaire, stationId: string): EtatEtape {
  if (stationId === 'lavage') {
    if (v.lavageEtat === 'pas-requis') return 'absente';
    if (v.lavageEtat === 'fait')        return 'termine';
    return 'planifie';
  }
  if (stationId === 'retouche') {
    if (v.retoucheEtat === 'pas-requis') return 'absente';
    if (v.retoucheEtat === 'fait')        return 'termine';
    return 'planifie';
  }
  return etatStation(v.roadMap ?? [], stationId);
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

// ════════════════════════════════════════════════════════════════
// MOBILE — Vue Suivi Vente en cards verticales (VueTerrain)
// ════════════════════════════════════════════════════════════════

function VueSuiviVenteMobile({ onClose, onSelectVehicule }: {
  onClose?: () => void;
  onSelectVehicule?: (id: string) => void;
}) {
  const { vehicules } = useInventaire();
  const [vendeurs, setVendeurs] = useState<Vendeur[]>([]);
  const [recherche, setRecherche] = useState('');
  const [viewMode, setViewMode] = useState<'a-livrer' | 'prets'>('a-livrer');

  useEffect(() => {
    vendeurService.getAll().then(setVendeurs).catch(console.error);
  }, []);

  const vendeurById = useMemo(() => {
    const m: Record<string, Vendeur> = {};
    for (const v of vendeurs) m[v.id] = v;
    return m;
  }, [vendeurs]);

  const camionsVendus = useMemo(() =>
    vehicules.filter(v =>
      v.statut !== 'archive' &&
      (v.type === 'eau' || v.type === 'detail') &&
      (v.etatCommercial === 'vendu' || v.etatCommercial === 'reserve' || v.etatCommercial === 'location')
    ),
  [vehicules]);

  const trier = (list: VehiculeInventaire[]) => {
    list.sort((a, b) => {
      if (a.livraisonAsap && !b.livraisonAsap) return -1;
      if (!a.livraisonAsap && b.livraisonAsap) return 1;
      const da = a.dateLivraisonPlanifiee ? new Date(a.dateLivraisonPlanifiee).getTime() : Number.MAX_SAFE_INTEGER;
      const db = b.dateLivraisonPlanifiee ? new Date(b.dateLivraisonPlanifiee).getTime() : Number.MAX_SAFE_INTEGER;
      return da - db;
    });
    return list;
  };

  const aLivrer = useMemo(() => trier(camionsVendus.filter(v => !estVehiculePret(v))), [camionsVendus]);
  const pretsList = useMemo(() => trier(camionsVendus.filter(estVehiculePret)), [camionsVendus]);
  const baseList = viewMode === 'prets' ? pretsList : aLivrer;

  const liste = useMemo(() => {
    if (!recherche.trim()) return baseList;
    const q = recherche.trim().toLowerCase();
    return baseList.filter(v =>
      v.numero.toLowerCase().includes(q) ||
      v.marque?.toLowerCase().includes(q) ||
      v.modele?.toLowerCase().includes(q) ||
      v.clientAcheteur?.toLowerCase().includes(q)
    );
  }, [baseList, recherche]);

  return (
    <div style={{
      width: '100vw', height: '100dvh',
      background: '#f8fafc',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Header sticky */}
      <div style={{
        flexShrink: 0,
        background: '#0f172a',
        color: 'white',
        padding: '12px 14px env(safe-area-inset-top, 12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          {onClose && (
            <button onClick={onClose}
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', width: 36, height: 36, borderRadius: 8, color: 'white', fontSize: 18, cursor: 'pointer', flexShrink: 0 }}>
              ←
            </button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
              🛒 SUIVI VENTE
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
              {liste.length} camion{liste.length > 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Toggle À livrer / Prêts */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <button onClick={() => setViewMode('a-livrer')}
            style={{
              flex: 1, padding: '10px', borderRadius: 8,
              border: 'none',
              background: viewMode === 'a-livrer' ? '#ea580c' : 'rgba(255,255,255,0.08)',
              color: 'white',
              fontWeight: viewMode === 'a-livrer' ? 800 : 500,
              fontSize: 13, cursor: 'pointer',
            }}>
            🔥 À livrer ({aLivrer.length})
          </button>
          <button onClick={() => setViewMode('prets')}
            style={{
              flex: 1, padding: '10px', borderRadius: 8,
              border: 'none',
              background: viewMode === 'prets' ? '#22c55e' : 'rgba(255,255,255,0.08)',
              color: 'white',
              fontWeight: viewMode === 'prets' ? 800 : 500,
              fontSize: 13, cursor: 'pointer',
            }}>
            ✅ Prêts ({pretsList.length})
          </button>
        </div>

        {/* Recherche */}
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>🔍</span>
          <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher #, marque, client..."
            style={{ width: '100%', padding: '10px 12px 10px 38px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', fontSize: 14, background: 'rgba(255,255,255,0.06)', color: 'white', outline: 'none', boxSizing: 'border-box' }} />
        </div>
      </div>

      {/* Liste cards */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px env(safe-area-inset-bottom, 12px)', WebkitOverflowScrolling: 'touch' }}>
        {liste.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{viewMode === 'prets' ? '🚚' : '✅'}</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {viewMode === 'prets' ? 'Aucun camion prêt' : 'Aucun camion en attente'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {liste.map(v => (
              <CarteSuiviVenteMobile key={v.id} v={v}
                vendeur={v.vendeurId ? vendeurById[v.vendeurId] : undefined}
                onClick={() => onSelectVehicule?.(v.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CarteSuiviVenteMobile({ v, vendeur, onClick }: {
  v: VehiculeInventaire;
  vendeur?: Vendeur;
  onClick: () => void;
}) {
  const dateStr = formatDate(v.dateLivraisonPlanifiee);
  const dateUrgence = urgenceDate(v.dateLivraisonPlanifiee);
  const equipement = formatEquipement(v);

  return (
    <div onClick={onClick}
      style={{
        background: 'white',
        borderRadius: 12,
        border: '1px solid #e5e7eb',
        borderLeft: `4px solid ${v.type === 'eau' ? '#1e40af' : '#166534'}`,
        padding: 12,
        cursor: 'pointer',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
      {/* Top : icône type + numéro + badge commercial + date */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
        <TypeIcon type={v.type} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 18, color: '#0f172a', lineHeight: 1.1 }}>
            #{v.numero}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
            {equipement}
          </div>
        </div>
        <CommercialBadge etat={v.etatCommercial} />
      </div>

      {/* Vendeur + Date */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>Vendeur</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: vendeur ? '#7c3aed' : '#9ca3af' }}>
            {vendeur?.nom ?? '—'}
          </span>
        </div>
        <div>
          {v.livraisonAsap ? (
            <span style={{ fontSize: 12, fontWeight: 800, color: 'white', background: '#dc2626', padding: '3px 10px', borderRadius: 4 }}>
              🔥 ASAP
            </span>
          ) : (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: dateUrgence.color }}>{dateStr}</div>
              {dateUrgence.note && (
                <div style={{ fontSize: 10, fontWeight: 700, color: dateUrgence.color }}>{dateUrgence.note}</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mini-badges paiement */}
      {(v.paiementDepot || v.paiementComplet || v.paiementPo) && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
          {v.paiementDepot   && <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 3, background: '#fef3c7', color: '#92400e' }}>💵 Dépôt</span>}
          {v.paiementComplet && <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 3, background: '#dcfce7', color: '#166534' }}>✅ Payé</span>}
          {v.paiementPo      && <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 3, background: '#dbeafe', color: '#1e40af' }}>📋 PO</span>}
        </div>
      )}

      {/* Stations grid (noms à la place des icônes) */}
      <div>
        <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
          Stations
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {STATIONS_SUIVI.map(s => {
            const etat = etatStationOrFinale(v, s.id);
            return (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 8px',
                background: '#f8fafc',
                border: `1px solid ${s.color}40`,
                borderLeft: `3px solid ${s.color}`,
                borderRadius: 6,
                minWidth: 0,
              }}>
                <EtapeIcon etat={etat} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#0f172a', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.mobileLabel}
                  </div>
                  {s.responsable && (
                    <div style={{ fontSize: 8, color: '#9ca3af', fontWeight: 600, lineHeight: 1.1, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.responsable}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
