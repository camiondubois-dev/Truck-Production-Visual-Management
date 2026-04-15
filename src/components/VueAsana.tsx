import { useState, useMemo } from 'react';
import { useGarage } from '../hooks/useGarage';
import { useInventaire } from '../contexts/InventaireContext';
import { EauIcon } from './EauIcon';
import { CreateWizardModal } from './CreateWizardModal';
import { ROAD_MAP_STATIONS } from '../data/etapes';
import type { TypeItem, Item } from '../types/item.types';
import type { VehiculeInventaire } from '../types/inventaireTypes';
import { PanneauDetailVehicule, getSectionVehicule, StatutBadgeSection, BadgeCommercial } from './PanneauDetailVehicule';
import type { Section } from './PanneauDetailVehicule';

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
type FiltreCommercial = 'tous' | 'non-vendu' | 'vendu' | 'reserve' | 'location';

// ── Composant principal ──────────────────────────────────────────
export function VueAsana({ type, config }: VueAsanaProps) {
  const { items, ajouterItem } = useGarage();
  const { vehicules } = useInventaire();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [filtreActif, setFiltreActif] = useState<FiltreVue>('tous');
  const [filtreCommercial, setFiltreCommercial] = useState<FiltreCommercial>('tous');
  const [showArchives, setShowArchives] = useState(false);
  const [recherche, setRecherche] = useState('');

  // Map inventaireId → Item pour croiser les données
  // Inclut aussi un mapping par item.id pour les orphelins sans inventaireId
  const itemByInvId = useMemo(() => {
    const map: Record<string, Item> = {};
    items.forEach(i => {
      if (i.inventaireId) map[i.inventaireId] = i;
      // Aussi mapper par item.id pour retrouver les orphelins dont le vehicule.id === item.id
      map[i.id] = i;
    });
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
    let result = mesVehicules;
    // Recherche textuelle (filtre in-memory, instantané)
    if (recherche.trim()) {
      const q = recherche.trim().toLowerCase();
      result = result.filter(v =>
        v.numero?.toLowerCase().includes(q) ||
        v.marque?.toLowerCase().includes(q) ||
        v.modele?.toLowerCase().includes(q) ||
        v.nomClient?.toLowerCase().includes(q) ||
        v.clientAcheteur?.toLowerCase().includes(q) ||
        v.vehicule?.toLowerCase().includes(q)
      );
    }
    if (filtreActif === 'a-planifier') {
      result = result.filter(v => getSectionVehicule(v, itemByInvId[v.id]) === 'a-planifier');
    } else if (filtreActif === 'pret') {
      result = result.filter(v => getSectionVehicule(v, itemByInvId[v.id]) === 'pret');
    } else if (filtreActif === 'dans-le-garage') {
      result = result.filter(v => getSectionVehicule(v, itemByInvId[v.id]) === 'dans-le-garage');
    } else if (filtreActif === 'en-attente') {
      result = result.filter(v => getSectionVehicule(v, itemByInvId[v.id]) === 'en-attente');
    } else if (filtreActif !== 'tous') {
      // Filtre par station
      result = result.filter(v => {
        if (!v.roadMap) return false;
        return v.roadMap.some(s => s.stationId === filtreActif && (s.statut === 'en-attente' || s.statut === 'en-cours'));
      });
    }
    // Filtre commercial (Vendu/Location/Disponible/Réservé)
    if (filtreCommercial !== 'tous') {
      result = result.filter(v => (v.etatCommercial ?? 'non-vendu') === filtreCommercial);
    }
    return result;
  }, [mesVehicules, filtreActif, filtreCommercial, itemByInvId, recherche]);

  // Comptes pour filtres commerciaux
  const countsCommercial = useMemo(() => {
    const c = { 'non-vendu': 0, vendu: 0, reserve: 0, location: 0 };
    mesVehicules.filter(v => v.statut !== 'archive').forEach(v => {
      const e = (v.etatCommercial ?? 'non-vendu') as keyof typeof c;
      if (e in c) c[e]++;
    });
    return c;
  }, [mesVehicules]);

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="text"
              placeholder="Rechercher #, client, marque..."
              value={recherche}
              onChange={e => setRecherche(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #e5e7eb', fontSize: 13, width: 220, outline: 'none' }}
            />
            <button onClick={() => setShowModal(true)}
              style={{ background: config.color, color: 'white', border: 'none', borderRadius: 8, padding: '8px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              + Nouveau
            </button>
          </div>
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

        {/* ── Filtres commerciaux (Vendu / Location / Disponible) ──── */}
        {type !== 'client' && (
          <div style={{
            display: 'flex', gap: 6, padding: '8px 20px 10px', borderBottom: '1px solid #e5e7eb',
            background: '#fafbfc', flexWrap: 'wrap', flexShrink: 0, alignItems: 'center',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>Commercial :</span>
            <FiltreBtn active={filtreCommercial === 'tous'} onClick={() => setFiltreCommercial('tous')} label="Tous" />
            <FiltreBtn active={filtreCommercial === 'non-vendu'} onClick={() => setFiltreCommercial('non-vendu')} label={`✅ Disponible (${countsCommercial['non-vendu']})`} color="#64748b" />
            <FiltreBtn active={filtreCommercial === 'vendu'} onClick={() => setFiltreCommercial('vendu')} label={`💰 Vendu (${countsCommercial.vendu})`} color="#22c55e" />
            <FiltreBtn active={filtreCommercial === 'reserve'} onClick={() => setFiltreCommercial('reserve')} label={`🔒 Réservé (${countsCommercial.reserve})`} color="#f59e0b" />
            <FiltreBtn active={filtreCommercial === 'location'} onClick={() => setFiltreCommercial('location')} label={`🔑 Location (${countsCommercial.location})`} color="#7c3aed" />
          </div>
        )}

        {/* ── En-têtes stations fixes + liste ─────────────────── */}
        {mesVehicules.filter(v => v.statut !== 'archive').length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#9ca3af' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>{config.icon === 'EAU_LOGO' ? <EauIcon /> : config.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Aucun véhicule pour l'instant</div>
            <div style={{ fontSize: 14 }}>Clique sur "+ Nouveau" pour commencer</div>
          </div>
        ) : (
          <>
            {/* En-têtes stations — sticky */}
            <div style={{
              display: 'flex', alignItems: 'stretch', flexShrink: 0,
              borderBottom: '3px solid #e5e7eb', background: '#f8fafc',
              boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
            }}>
              <div style={{ width: 340, minWidth: 340, flexShrink: 0, padding: '12px 16px', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center' }}>
                Véhicule
              </div>
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${ROAD_MAP_STATIONS.length}, 1fr)`, gap: 0 }}>
                {ROAD_MAP_STATIONS.map(s => (
                  <div key={s.id} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '10px 4px', borderLeft: '1px solid #e5e7eb',
                  }}>
                    <span style={{ fontSize: 20, marginBottom: 3 }}>{s.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: s.color, textAlign: 'center', lineHeight: 1.2 }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Liste scrollable */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
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
          </>
        )}
      </div>

      {/* ── Panneau détail ──────────────────────────────────── */}
      {selectedVehicule && (
        <PanneauDetailVehicule
          key={selectedVehicule.id}
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

export function FiltreBtn({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color?: string }) {
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

export function SectionHeaderCard({ label, color, count, onClick, clickable }: {
  label: string; color: string; count: number; onClick?: () => void; clickable?: boolean;
}) {
  return (
    <div onClick={onClick} style={{
      padding: '10px 16px', cursor: clickable ? 'pointer' : 'default',
      fontSize: 13, fontWeight: 700, color, letterSpacing: '0.04em',
      background: `${color}08`, borderBottom: `1px solid ${color}30`,
      borderTop: '1px solid #e5e7eb',
    }}>
      {label}
      {!clickable && (
        <span style={{ marginLeft: 8, background: color, color: 'white', fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
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

export function CarteVehicule({ vehicule: v, item, type, selected, onClick }: {
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
        display: 'flex', alignItems: 'stretch',
        background: selected ? `${typeColor}06` : isArchive ? '#fafafa' : 'white',
        borderBottom: '1px solid #e5e7eb',
        borderLeft: `4px solid ${typeColor}`,
        cursor: 'pointer', transition: 'all 0.15s',
        opacity: isArchive ? 0.65 : 1,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
      onMouseEnter={e => { if (!selected) { (e.currentTarget as HTMLDivElement).style.background = '#f0f4ff'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; } }}
      onMouseLeave={e => { if (!selected) { (e.currentTarget as HTMLDivElement).style.background = isArchive ? '#fafafa' : 'white'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; } }}
    >
      {/* ── Info camion (gauche) ── */}
      <div style={{ width: 336, minWidth: 336, flexShrink: 0, padding: '12px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 24, flexShrink: 0 }}>
          {v.type === 'eau' ? <EauIcon /> : v.type === 'client' ? '🔧' : '🏷️'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 15, color: typeColor }}>#{v.numero}</span>
            <StatutBadgeSection section={section} />
            {item?.slotId && (
              <span style={{ fontFamily: 'monospace', fontSize: 10, background: '#eff6ff', color: '#1d4ed8', padding: '2px 6px', borderRadius: 10, fontWeight: 600 }}>
                Slot {item.slotId}
              </span>
            )}
            {v.etatCommercial && v.etatCommercial !== 'non-vendu' && (
              <BadgeCommercial etat={v.etatCommercial} client={v.clientAcheteur} />
            )}
            {v.type === 'eau' && (
              v.aUnReservoir
                ? <span style={{ fontSize: 9, background: '#dcfce7', color: '#166534', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>✅ Rés.</span>
                : <span style={{ fontSize: 9, background: '#fff7ed', color: '#c2410c', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>⚠️ Sans rés.</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#374151', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getLabelVehicule(v)}</div>
          {v.variante && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{v.variante}</div>}
        </div>
      </div>

      {/* ── Cellules progression (droite, alignées avec les en-têtes) ── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${ROAD_MAP_STATIONS.length}, 1fr)`, gap: 0, alignItems: 'center' }}>
        {ROAD_MAP_STATIONS.map(s => {
          const steps = v.roadMap?.filter(r => r.stationId === s.id) ?? [];
          if (steps.length === 0) {
            // Pas dans le road map → tiret rouge
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid #f1f5f9', padding: '10px 0' }}>
                <div style={{ width: 20, height: 3, borderRadius: 2, background: '#fca5a5' }} />
              </div>
            );
          }
          const anySaute = steps.some(r => r.statut === 'saute');
          const allTermine = steps.length > 0 && steps.every(r => r.statut === 'termine');
          const anyEnCours = steps.some(r => r.statut === 'en-cours');
          const anyEnAttente = steps.some(r => r.statut === 'en-attente');
          const count = steps.length;
          return (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid #f1f5f9', padding: '10px 0', position: 'relative' }}>
              {allTermine ? (
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 15, fontWeight: 700, boxShadow: '0 2px 6px rgba(34,197,94,0.3)' }}>✓</div>
              ) : anyEnCours ? (
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, boxShadow: '0 2px 8px rgba(59,130,246,0.35)', animation: 'pulse 2s infinite' }}>🚛</div>
              ) : anyEnAttente ? (
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'white', boxShadow: '0 2px 6px rgba(245,158,11,0.3)' }}>⏳</div>
              ) : anySaute ? (
                <span style={{ fontSize: 10, background: '#fef3c7', color: '#92400e', padding: '3px 8px', borderRadius: 4, fontWeight: 800, whiteSpace: 'nowrap', border: '1px solid #fde68a' }}>⚠️ SAUTÉ</span>
              ) : (
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'white', border: '2px solid #d1d5db' }} />
              )}
              {count > 1 && (
                <span style={{ position: 'absolute', top: 4, right: '50%', marginRight: -22, fontSize: 9, background: allTermine ? '#22c55e' : anyEnCours ? '#3b82f6' : anyEnAttente ? '#f59e0b' : anySaute ? '#92400e' : '#9ca3af', color: 'white', borderRadius: 10, padding: '1px 5px', fontWeight: 800, lineHeight: 1.3 }}>{count}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


