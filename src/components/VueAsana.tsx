import { useState, useMemo } from 'react';
import { useGarage } from '../hooks/useGarage';
import { useInventaire } from '../contexts/InventaireContext';
import { EauIcon } from './EauIcon';
import { useAuth } from '../contexts/AuthContext';
import { CreateWizardModal } from './CreateWizardModal';
import { PopupAssignationSlot } from './PopupAssignationSlot';
import { photoService } from '../services/photoService';
import { ROAD_MAP_STATIONS } from '../data/etapes';
import { RoadMapEditor } from './RoadMapEditor';
import type { TypeItem, Item, EtatCommercial, Document } from '../types/item.types';
import type { VehiculeInventaire } from '../types/inventaireTypes';
import { useClients } from '../contexts/ClientContext';

// ── Types ────────────────────────────────────────────────────────
interface VueAsanaProps {
  type: TypeItem;
  config: {
    color: string;
    icon: string;
    label: string;
  };
}

type FiltreVue = 'tous' | 'a-planifier' | 'dans-le-garage' | 'en-attente' | 'pret' | string; // string = stationId
type Section = 'a-planifier' | 'en-attente' | 'dans-le-garage' | 'pret' | 'archive';

// ── Helper: détermine la section d'un véhicule ───────────────────
function getSectionVehicule(v: VehiculeInventaire, item?: Item): Section {
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

// ── Composant principal ──────────────────────────────────────────
export function VueAsana({ type, config }: VueAsanaProps) {
  const { items, ajouterItem } = useGarage();
  const { vehicules } = useInventaire();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [filtreActif, setFiltreActif] = useState<FiltreVue>('tous');
  const [showArchives, setShowArchives] = useState(false);

  // Map inventaireId → Item pour croiser les données
  const itemByInvId = useMemo(() => {
    const map: Record<string, Item> = {};
    items.forEach(i => { if (i.inventaireId) map[i.inventaireId] = i; });
    return map;
  }, [items]);

  // Véhicules du bon type, triés par numéro
  // Inclut les items orphelins (prod_items sans prod_inventaire) — notamment les jobs clients existants
  const mesVehicules = useMemo(() => {
    const filtered = vehicules.filter(v => v.type === type);
    const invIds = new Set(filtered.map(v => v.id));
    // Items orphelins: dans prod_items du bon type mais sans entrée prod_inventaire correspondante
    const orphelins: VehiculeInventaire[] = items
      .filter(i => i.type === type && i.etat !== 'termine' && (!i.inventaireId || !invIds.has(i.inventaireId)))
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
          return { id: `synth-${i.id}-${idx}`, stationId: sid, statut, priorite: idx + 1 };
        }),
        estPret: false,
        etatCommercial: i.etatCommercial as any ?? 'non-vendu',
      }));
    const combined = [...filtered, ...orphelins];
    return combined.sort((a, b) => {
      const na = parseInt(a.numero.replace(/\D/g, '') || '0');
      const nb = parseInt(b.numero.replace(/\D/g, '') || '0');
      return na - nb;
    });
  }, [vehicules, items, type]);

  // Filtre actif appliqué
  const vehiculesFiltres = useMemo(() => {
    if (filtreActif === 'tous') return mesVehicules;
    if (filtreActif === 'a-planifier') {
      return mesVehicules.filter(v => getSectionVehicule(v, itemByInvId[v.id]) === 'a-planifier');
    }
    if (filtreActif === 'pret') {
      return mesVehicules.filter(v => getSectionVehicule(v, itemByInvId[v.id]) === 'pret');
    }
    if (filtreActif === 'dans-le-garage') {
      return mesVehicules.filter(v => getSectionVehicule(v, itemByInvId[v.id]) === 'dans-le-garage');
    }
    if (filtreActif === 'en-attente') {
      return mesVehicules.filter(v => getSectionVehicule(v, itemByInvId[v.id]) === 'en-attente');
    }
    // Filtre par station: camions qui ont cette étape active (en-attente ou en-cours)
    return mesVehicules.filter(v => {
      if (!v.roadMap) return false;
      return v.roadMap.some(s => s.stationId === filtreActif && (s.statut === 'en-attente' || s.statut === 'en-cours'));
    });
  }, [mesVehicules, filtreActif, itemByInvId]);

  // Sections
  const aPlanifier   = vehiculesFiltres.filter(v => v.statut !== 'archive' && getSectionVehicule(v, itemByInvId[v.id]) === 'a-planifier');
  const enAttente    = vehiculesFiltres.filter(v => v.statut !== 'archive' && getSectionVehicule(v, itemByInvId[v.id]) === 'en-attente');
  const dansLeGarage = vehiculesFiltres.filter(v => v.statut !== 'archive' && getSectionVehicule(v, itemByInvId[v.id]) === 'dans-le-garage');
  const prets        = vehiculesFiltres.filter(v => v.statut !== 'archive' && getSectionVehicule(v, itemByInvId[v.id]) === 'pret');
  const archives     = mesVehicules.filter(v => v.statut === 'archive');

  const selectedVehicule = mesVehicules.find(v => v.id === selectedId) ?? null;
  const selectedItem = selectedVehicule ? itemByInvId[selectedVehicule.id] : undefined;

  const totalActifs = aPlanifier.length + enAttente.length + dansLeGarage.length + prets.length;

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: '#f8fafc' }}>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        marginRight: selectedVehicule ? 380 : 0, transition: 'margin-right 0.3s ease',
      }}>
        {/* ── En-tête ─────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 24px', borderBottom: '2px solid #e5e7eb', background: 'white', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {config.icon === 'EAU_LOGO' ? <EauIcon /> : <span style={{ fontSize: 26 }}>{config.icon}</span>}
              <h1 style={{ fontSize: 20, fontWeight: 700, color: config.color, margin: 0 }}>{config.label}</h1>
            </div>
            <StatPill label="À planifier"    value={aPlanifier.length}   color="#9ca3af" />
            <StatPill label="En attente"     value={enAttente.length}    color="#f59e0b" />
            <StatPill label="Dans le garage" value={dansLeGarage.length} color="#3b82f6" />
            <StatPill label="Prêts"          value={prets.length}        color="#22c55e" />
          </div>
          <button onClick={() => setShowModal(true)}
            style={{ background: config.color, color: 'white', border: 'none', borderRadius: 8, padding: '8px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            + Nouveau
          </button>
        </div>

        {/* ── Barre de filtres ────────────────────────────────── */}
        <div style={{
          display: 'flex', gap: 6, padding: '10px 20px', borderBottom: '1px solid #e5e7eb',
          background: 'white', flexWrap: 'wrap', flexShrink: 0,
        }}>
          <FiltreBtn active={filtreActif === 'tous'} onClick={() => setFiltreActif('tous')} label={`Tous (${totalActifs})`} />
          <FiltreBtn active={filtreActif === 'dans-le-garage'} onClick={() => setFiltreActif('dans-le-garage')} label={`🔧 Dans le garage (${dansLeGarage.length})`} color="#3b82f6" />
          <FiltreBtn active={filtreActif === 'pret'} onClick={() => setFiltreActif('pret')} label={`✅ Prêt (${prets.length})`} color="#22c55e" />
          <FiltreBtn active={filtreActif === 'a-planifier'} onClick={() => setFiltreActif('a-planifier')} label={`📋 À planifier (${aPlanifier.length})`} />
          <FiltreBtn active={filtreActif === 'en-attente'} onClick={() => setFiltreActif('en-attente')} label={`⏳ En attente (${enAttente.length})`} color="#f59e0b" />
          <div style={{ width: 1, background: '#e5e7eb', margin: '0 2px', alignSelf: 'stretch' }} />
          {ROAD_MAP_STATIONS.map(s => {
            const nb = mesVehicules.filter(v => v.roadMap?.some(r => r.stationId === s.id && (r.statut === 'en-attente' || r.statut === 'en-cours'))).length;
            if (nb === 0) return null;
            return (
              <FiltreBtn key={s.id} active={filtreActif === s.id} onClick={() => setFiltreActif(s.id)}
                label={`${s.icon} ${s.label} (${nb})`} color={s.color} />
            );
          })}
        </div>

        {/* ── Liste cartes ─────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {mesVehicules.filter(v => v.statut !== 'archive').length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: '#9ca3af' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>{config.icon === 'EAU_LOGO' ? <EauIcon /> : config.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Aucun véhicule pour l'instant</div>
              <div style={{ fontSize: 14 }}>Clique sur "+ Nouveau" pour commencer</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {aPlanifier.length > 0 && (
                <>
                  <SectionHeaderCard label="📋 À planifier" color="#9ca3af" count={aPlanifier.length} />
                  {aPlanifier.map(v => (
                    <CarteVehicule key={v.id} vehicule={v} item={itemByInvId[v.id]} type={type}
                      selected={selectedId === v.id}
                      onClick={() => setSelectedId(v.id === selectedId ? null : v.id)} />
                  ))}
                </>
              )}
              {enAttente.length > 0 && (
                <>
                  <SectionHeaderCard label="⏳ En attente" color="#f59e0b" count={enAttente.length} />
                  {enAttente.map(v => (
                    <CarteVehicule key={v.id} vehicule={v} item={itemByInvId[v.id]} type={type}
                      selected={selectedId === v.id}
                      onClick={() => setSelectedId(v.id === selectedId ? null : v.id)} />
                  ))}
                </>
              )}
              {dansLeGarage.length > 0 && (
                <>
                  <SectionHeaderCard label="🔧 Dans le garage" color="#3b82f6" count={dansLeGarage.length} />
                  {dansLeGarage.map(v => (
                    <CarteVehicule key={v.id} vehicule={v} item={itemByInvId[v.id]} type={type}
                      selected={selectedId === v.id}
                      onClick={() => setSelectedId(v.id === selectedId ? null : v.id)} />
                  ))}
                </>
              )}
              {prets.length > 0 && (
                <>
                  <SectionHeaderCard label="✅ Prêts" color="#22c55e" count={prets.length} />
                  {prets.map(v => (
                    <CarteVehicule key={v.id} vehicule={v} item={itemByInvId[v.id]} type={type}
                      selected={selectedId === v.id}
                      onClick={() => setSelectedId(v.id === selectedId ? null : v.id)} />
                  ))}
                </>
              )}
              {vehiculesFiltres.filter(v => v.statut !== 'archive').length === 0 && filtreActif !== 'tous' && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', fontSize: 14 }}>
                  Aucun résultat pour ce filtre
                </div>
              )}
              {archives.length > 0 && (
                <>
                  <SectionHeaderCard
                    label={showArchives ? 'Archivés (masquer)' : `Archivés (${archives.length})`}
                    color="#d1d5db" count={archives.length}
                    onClick={() => setShowArchives(s => !s)} clickable />
                  {showArchives && archives.map(v => (
                    <CarteVehicule key={v.id} vehicule={v} item={itemByInvId[v.id]} type={type}
                      selected={selectedId === v.id}
                      onClick={() => setSelectedId(v.id === selectedId ? null : v.id)} />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Panneau détail ──────────────────────────────────── */}
      {selectedVehicule && (
        <PanneauDetailVehicule
          vehicule={selectedVehicule}
          item={selectedItem}
          onClose={() => setSelectedId(null)}
        />
      )}

      {/* ── Modal création ──────────────────────────────────── */}
      {showModal && (
        <CreateWizardModal
          initialType={type}
          onClose={() => setShowModal(false)}
          onCreate={(item) => { ajouterItem(item); setShowModal(false); }}
        />
      )}
    </div>
  );
}

// ── Sous-composants utilitaires ──────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 12, color: '#6b7280' }}>{label}</span>
      <span style={{ background: color, color: 'white', fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 10, minWidth: 20, textAlign: 'center' }}>
        {value}
      </span>
    </div>
  );
}

function FiltreBtn({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color?: string }) {
  const c = color ?? '#6b7280';
  return (
    <button onClick={onClick}
      style={{
        padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: active ? 700 : 500,
        border: active ? `2px solid ${c}` : '1px solid #e5e7eb',
        background: active ? `${c}15` : 'white',
        color: active ? c : '#6b7280',
        cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

function SectionHeaderCard({ label, color, count, onClick, clickable }: {
  label: string; color: string; count: number; onClick?: () => void; clickable?: boolean;
}) {
  return (
    <div onClick={onClick} style={{
      padding: '8px 4px', cursor: clickable ? 'pointer' : 'default',
      fontSize: 12, fontWeight: 700, color, letterSpacing: '0.04em',
      marginTop: 8,
    }}>
      {label}
      {!clickable && (
        <span style={{ marginLeft: 8, background: color, color: 'white', fontSize: 11, padding: '2px 7px', borderRadius: 10, fontWeight: 700 }}>
          {count}
        </span>
      )}
    </div>
  );
}

function getLabelVehicule(v: VehiculeInventaire): string {
  if (v.type === 'client') {
    return [v.nomClient, v.vehicule].filter(Boolean).join(' — ') || 'Job client';
  }
  return [v.marque, v.modele, v.annee].filter(Boolean).join(' ') ||
    (v.type === 'detail' ? 'Camion détail' : 'Camion à eau');
}

// ── CarteVehicule ────────────────────────────────────────────────

function CarteVehicule({ vehicule: v, item, type, selected, onClick }: {
  vehicule: VehiculeInventaire;
  item?: Item;
  type: TypeItem;
  selected: boolean;
  onClick: () => void;
}) {
  const typeColor = v.type === 'eau' ? '#f97316' : v.type === 'client' ? '#3b82f6' : '#22c55e';
  const section = getSectionVehicule(v, item);
  const isArchive = v.statut === 'archive';

  return (
    <div onClick={onClick}
      style={{
        background: selected ? `${typeColor}08` : isArchive ? '#fafafa' : 'white',
        borderRadius: 10,
        border: `1px solid ${selected ? typeColor : '#e5e7eb'}`,
        borderLeft: `4px solid ${typeColor}`,
        padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: 16,
        cursor: 'pointer', transition: 'all 0.15s',
        opacity: isArchive ? 0.65 : 1,
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.background = '#f8fafc'; }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.background = isArchive ? '#fafafa' : 'white'; }}
    >
      {/* Icône */}
      <div style={{ fontSize: 28, flexShrink: 0 }}>
        {v.type === 'eau' ? <EauIcon /> : v.type === 'client' ? '🔧' : '🏷️'}
      </div>

      {/* Contenu principal */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 16, color: typeColor }}>#{v.numero}</span>
          <StatutBadgeSection section={section} />
          {item?.slotId && (
            <span style={{ fontFamily: 'monospace', fontSize: 11, background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
              Slot {item.slotId}
            </span>
          )}
          {v.etatCommercial && v.etatCommercial !== 'non-vendu' && (
            <BadgeCommercial etat={v.etatCommercial} client={v.clientAcheteur} />
          )}
          {v.type === 'eau' && (
            v.aUnReservoir
              ? <span style={{ fontSize: 10, background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>✅ Réservoir</span>
              : <span style={{ fontSize: 10, background: '#fff7ed', color: '#c2410c', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>⚠️ Sans réservoir</span>
          )}
        </div>
        <div style={{ fontSize: 14, color: '#374151', fontWeight: 500, marginBottom: 4 }}>{getLabelVehicule(v)}</div>
        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#9ca3af', alignItems: 'center', flexWrap: 'wrap' }}>
          {v.marque && v.annee && v.type !== 'client' && <span>🚛 {v.marque} {v.annee}</span>}
          {v.type === 'client' && v.descriptionTravail && <span style={{ color: '#6b7280' }}>{v.descriptionTravail}</span>}
          {v.variante && <span>{v.variante}</span>}
          {v.dateLivraisonPlanifiee && <span style={{ color: '#1d4ed8', fontWeight: 600 }}>📅 Livraison : {new Date(v.dateLivraisonPlanifiee).toLocaleDateString('fr-CA')}</span>}
        </div>
        {/* Road map mini indicateurs */}
        {v.roadMap && v.roadMap.length > 0 && (
          <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
            {ROAD_MAP_STATIONS.map(s => {
              const steps = v.roadMap?.filter(r => r.stationId === s.id) ?? [];
              if (steps.length === 0) return null;
              const allTermine = steps.every(r => r.statut === 'termine' || r.statut === 'saute');
              const anyEnCours = steps.some(r => r.statut === 'en-cours');
              const bg = allTermine ? '#dcfce7' : anyEnCours ? '#dbeafe' : '#fef3c7';
              const color = allTermine ? '#166534' : anyEnCours ? '#1d4ed8' : '#92400e';
              const icon = allTermine ? '✓' : anyEnCours ? '▶' : '⏳';
              return (
                <span key={s.id} style={{ fontSize: 9, background: bg, color, padding: '2px 6px', borderRadius: 4, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {icon} {s.label}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatutBadgeSection({ section }: { section: Section }) {
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

// ── Badges utilitaires ───────────────────────────────────────────

function BadgeCommercial({ etat, client }: { etat?: EtatCommercial; client?: string }) {
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

// ── PanneauDetailVehicule ────────────────────────────────────────

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

const STATUT_CFG = {
  planifie:    { label: 'Planifié',    bg: '#f1f5f9', color: '#64748b', icon: '⬜' },
  'en-attente':{ label: 'En attente',  bg: '#fff7ed', color: '#c2410c', icon: '⏳' },
  'en-cours':  { label: 'En cours',    bg: '#eff6ff', color: '#1d4ed8', icon: '🔵' },
  termine:     { label: 'Terminé',     bg: '#f0fdf4', color: '#166534', icon: '✅' },
  saute:       { label: 'Sauté',       bg: '#fef2f2', color: '#dc2626', icon: '⏭️' },
} as const;

function PanneauDetailVehicule({ vehicule: v, item, onClose }: {
  vehicule: VehiculeInventaire;
  item?: Item;
  onClose: () => void;
}) {
  const {
    mettreAJourRoadMap, mettreAJourPhotoInventaire,
    marquerPret, mettreAJourCommercial, archiverVehicule, supprimerVehicule,
    marquerDisponible,
  } = useInventaire();
  const { supprimerItem, ajouterDocument, supprimerDocument } = useGarage();
  const { profile: session } = useAuth();
  const { clients } = useClients();

  const [confirmerSuppr, setConfirmerSuppr] = useState(false);
  const [confirmerRetour, setConfirmerRetour] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [pdfOuvert, setPdfOuvert] = useState<{ nom: string; base64: string } | null>(null);
  const [popupStation, setPopupStation] = useState<string | null>(null);

  const typeColor = v.type === 'eau' ? '#f97316' : v.type === 'client' ? '#3b82f6' : '#22c55e';
  const isGestion = session?.role === 'gestion';
  const montrerCommercial = v.type === 'eau' || v.type === 'detail';
  const etatCommercial = v.etatCommercial ?? 'non-vendu';
  const clientLie = v.clientId ? clients.find(c => c.id === v.clientId) : null;


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

          {/* ── Road Map ─────────────────────────── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              🗺 Plan de production
            </div>
            <RoadMapEditor
              vehicule={v}
              onSaved={() => {}}
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
