import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useGarage } from '../hooks/useGarage';
import { useInventaire } from '../contexts/InventaireContext';
import { getTVSession, clearTVSession } from '../hooks/useTVAccess';
import { supabase } from '../lib/supabase';
import { STATIONS } from '../data/stations';
import { GARAGE_TO_ROAD_MAP_STATIONS, STATION_TO_GARAGE } from '../data/garageData';
import { EauIcon } from './EauIcon';
import type { Item, Slot } from '../types/item.types';
import type { VehiculeInventaire, RoadMapEtape } from '../types/inventaireTypes';

// ── TV Configurations ──────────────────────────────────────────
// garage_id (depuis tv_acces) → quelles stations physiques afficher
const TV_CONFIGS: Record<string, { label: string; stationIds: string[] }> = {
  'general':          { label: 'Vue Générale',             stationIds: ['soudure-generale', 'mecanique-generale', 'mecanique-moteur', 'sous-traitants', 'soudure-specialisee', 'peinture'] },
  'soudure-generale': { label: 'Soudure Générale',         stationIds: ['soudure-generale'] },
  'mecanique':        { label: 'Mécanique',                stationIds: ['mecanique-moteur', 'mecanique-generale', 'sous-traitants'] },
  'spec':             { label: 'Soudure Spéc. + Peinture', stationIds: ['soudure-specialisee', 'peinture'] },
  'sous-traitants':   { label: 'Sous-traitants',           stationIds: ['sous-traitants'] },
};

// Couleur selon le rang dans la file
const rankColor = (rank: number) =>
  rank === 1 ? '#ef4444' : rank === 2 ? '#f97316' : rank === 3 ? '#f59e0b' : '#6b7280';

// Couleur selon type véhicule
const typeColor = (type: string) =>
  type === 'eau' ? '#f97316' : type === 'client' ? '#3b82f6' : '#22c55e';

// Statut label + couleur
const STATUT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  'planifie':   { label: 'Planifié',   color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  'en-attente': { label: 'En attente', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  'en-cours':   { label: 'En cours',   color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  'termine':    { label: 'Terminé',    color: '#22c55e', bg: 'rgba(34,197,94,0.12)'  },
  'saute':      { label: 'Sauté',      color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
};

interface QueueEntry {
  vehicule: VehiculeInventaire;
  item?: Item;
  priorite?: number;
  stepId?: string;
  stationId?: string;
}

// ── Main VueTV ──────────────────────────────────────────────────
export function VueTV() {
  const session = getTVSession();
  const garageId = session?.garageId ?? '';
  const tvLabel  = session?.label ?? '';

  const { items, slotMap, enAttente, assignerSlot, rechargerItems, mettreAJourPriorites: garageReorder } = useGarage();
  const { vehicules, mettreAJourRoadMap, mettreAJourPriorites } = useInventaire();

  // Heartbeat toutes les 25s pour éviter timeout Supabase Realtime sur TV
  useEffect(() => {
    const hb = setInterval(() => {
      supabase.channel('tv-heartbeat').subscribe();
    }, 25_000);
    return () => clearInterval(hb);
  }, []);

  // Réveil écran → recharger
  useEffect(() => {
    const onVisible = () => { if (!document.hidden) rechargerItems(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [rechargerItems]);

  const allEnAttente = [...enAttente.eau, ...enAttente.client, ...enAttente.detail];

  // itemByInvId
  const itemByInvId = useMemo(() => {
    const map: Record<string, Item> = {};
    items.forEach(item => {
      if (item.inventaireId) map[item.inventaireId] = item;
      else map[item.id] = item;
    });
    return map;
  }, [items]);

  // vehiculesComplets (identique PlancherView)
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
        type: i.type as any,
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
    return [...vehicules, ...orphelins];
  }, [vehicules, items]);

  // Reorder handler (même logique que PlancherView)
  const handleReorder = useCallback(async (newOrder: QueueEntry[]) => {
    const updatesMap = new Map<string, RoadMapEtape[]>();
    newOrder.forEach((entry, i) => {
      if (!entry.stationId || !entry.vehicule.roadMap) return;
      const vid = entry.vehicule.id;
      if (!updatesMap.has(vid)) updatesMap.set(vid, entry.vehicule.roadMap.map(s => ({ ...s })));
      const roadMap = updatesMap.get(vid)!;
      const stepIdx = roadMap.findIndex(s =>
        entry.stepId ? s.id === entry.stepId : s.stationId === entry.stationId
      );
      if (stepIdx >= 0) roadMap[stepIdx] = { ...roadMap[stepIdx], priorite: i + 1 };
    });
    const updates = [...updatesMap.entries()].map(([id, roadMap]) => ({ id, roadMap }));
    if (updates.length > 0) await mettreAJourPriorites(updates);
  }, [mettreAJourPriorites]);

  const config = TV_CONFIGS[garageId];
  const stationsToShow = config
    ? STATIONS.filter(s => config.stationIds.includes(s.id))
    : [];

  // Horloge
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleDeconnexion = async () => {
    clearTVSession();
    await supabase.auth.signOut();
    window.location.reload();
  };

  if (!config) {
    return (
      <div style={{
        width: '100vw', height: '100dvh', background: '#0a0908',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24,
      }}>
        <div style={{ fontSize: 64 }}>⚠️</div>
        <div style={{ color: '#f87171', fontSize: 20, fontWeight: 700, fontFamily: 'monospace' }}>
          Configuration TV inconnue : « {garageId} »
        </div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
          Contactez l'administrateur pour configurer ce code TV.
        </div>
        <button
          onClick={handleDeconnexion}
          style={{
            marginTop: 16, background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 8, color: 'rgba(255,255,255,0.5)',
            padding: '10px 24px', cursor: 'pointer',
            fontSize: 14, fontFamily: 'system-ui, sans-serif',
          }}
        >
          ← Retour
        </button>
      </div>
    );
  }

  return (
    <div style={{
      width: '100vw', height: '100dvh', background: '#0a0908',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Header TV */}
      <div style={{
        flexShrink: 0, height: 56,
        background: '#0f0e0b',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center',
        padding: '0 28px', gap: 20,
      }}>
        <img
          src="/logo-camions-dubois-_-noir-bleu-1.png"
          alt="Camions Dubois"
          style={{ height: 30, objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.5 }}
        />
        <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />
        <div style={{ fontSize: 18, fontWeight: 800, color: 'white', letterSpacing: '-0.01em' }}>
          📺 {tvLabel || config.label}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{
          fontFamily: 'monospace', fontSize: 18, fontWeight: 700,
          color: 'rgba(255,255,255,0.7)', letterSpacing: '0.04em',
        }}>
          {now.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
        <button
          onClick={handleDeconnexion}
          style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6, color: 'rgba(255,255,255,0.3)',
            padding: '5px 12px', cursor: 'pointer',
            fontSize: 12, transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
        >
          ← Déconnecter
        </button>
      </div>

      {/* Corps — stations en flex row */}
      <div style={{
        flex: 1, display: 'flex', gap: 8, padding: 8,
        overflow: 'hidden', minHeight: 0,
      }}>
        {stationsToShow.map(station => (
          <TVStationBlock
            key={station.id}
            station={station}
            slotMap={slotMap}
            allEnAttente={allEnAttente}
            vehicules={vehiculesComplets}
            itemByInvId={itemByInvId}
            onReorder={handleReorder}
            mettreAJourRoadMap={mettreAJourRoadMap}
            assignerSlot={assignerSlot}
            flex={stationsToShow.length === 1 ? 1 : station.id === 'sous-traitants' ? 2 : 1}
          />
        ))}
      </div>
    </div>
  );
}

// ── TVStationBlock ──────────────────────────────────────────────
interface TVStationBlockProps {
  station: typeof STATIONS[0];
  slotMap: Record<string, Item>;
  allEnAttente: Item[];
  vehicules: VehiculeInventaire[];
  itemByInvId: Record<string, Item>;
  onReorder: (newOrder: QueueEntry[]) => Promise<void>;
  mettreAJourRoadMap: (vehiculeId: string, roadMap: RoadMapEtape[]) => Promise<void>;
  assignerSlot: (itemId: string, slotId: string) => void;
  flex?: number;
}

function TVStationBlock({
  station, slotMap, allEnAttente, vehicules, itemByInvId,
  onReorder, mettreAJourRoadMap, assignerSlot, flex = 1,
}: TVStationBlockProps) {
  const roadMapStations = GARAGE_TO_ROAD_MAP_STATIONS[station.id] ?? [];

  // ── File d'attente (en-attente) ──────────────────────────────
  const finalQueue = useMemo((): QueueEntry[] => {
    const seenVehIds = new Set<string>();
    const seenItemIds = new Set<string>();
    const queue: QueueEntry[] = [];

    if (roadMapStations.length > 0) {
      for (const v of vehicules) {
        if (!v.roadMap) continue;
        const step = v.roadMap.find(s =>
          roadMapStations.includes(s.stationId) && s.statut === 'en-attente'
        );
        if (!step) continue;
        const item = itemByInvId[v.id];
        if (item?.slotId) continue;
        if (item?.etat === 'termine') continue;
        seenVehIds.add(v.id);
        if (item) seenItemIds.add(item.id);
        queue.push({ vehicule: v, item, priorite: step.priorite, stepId: step.id, stationId: step.stationId });
      }
    }

    for (const item of allEnAttente) {
      if (seenItemIds.has(item.id)) continue;
      if (!item.inventaireId || seenVehIds.has(item.inventaireId)) continue;
      const vehicule = vehicules.find(v => v.id === item.inventaireId);
      if (!vehicule) continue;
      if (vehicule.roadMap && vehicule.roadMap.length > 0) continue;
      const isForThis =
        item.dernierGarageId === station.id ||
        STATION_TO_GARAGE[item.stationActuelle ?? ''] === station.id;
      if (!isForThis) continue;
      seenItemIds.add(item.id);
      queue.push({ vehicule, item });
    }

    return queue.sort((a, b) => {
      if (a.priorite == null && b.priorite == null) return 0;
      if (a.priorite == null) return 1;
      if (b.priorite == null) return -1;
      return a.priorite - b.priorite;
    });
  }, [vehicules, itemByInvId, allEnAttente, station.id]);

  // ── Camions planifiés (statut 'planifie') ────────────────────
  const planifies = useMemo((): VehiculeInventaire[] => {
    if (roadMapStations.length === 0) return [];
    const seen = new Set<string>();
    const result: VehiculeInventaire[] = [];
    for (const v of vehicules) {
      if (!v.roadMap) continue;
      const step = v.roadMap.find(s =>
        roadMapStations.includes(s.stationId) && s.statut === 'planifie'
      );
      if (!step) continue;
      // Ne pas inclure si déjà dans en-attente
      const alreadyInQueue = finalQueue.some(e => e.vehicule.id === v.id);
      if (alreadyInQueue) continue;
      if (seen.has(v.id)) continue;
      seen.add(v.id);
      result.push(v);
    }
    return result;
  }, [vehicules, finalQueue, roadMapStations]);

  // localQueue pour reorder immédiat
  const [localQueue, setLocalQueue] = useState<QueueEntry[] | null>(null);
  const queueSig = finalQueue.map(e => e.vehicule.id).join('|');
  const prevSigRef = useRef(queueSig);
  useEffect(() => {
    if (prevSigRef.current !== queueSig) {
      prevSigRef.current = queueSig;
      setLocalQueue(null);
    }
  }, [queueSig]);
  const displayQueue = localQueue ?? finalQueue;

  const applyReorder = (newOrder: QueueEntry[]) => {
    setLocalQueue(newOrder);
    onReorder(newOrder);
  };

  const handleMoveUp = (idx: number) => {
    if (idx === 0) return;
    const o = [...displayQueue];
    [o[idx - 1], o[idx]] = [o[idx], o[idx - 1]];
    applyReorder(o);
  };
  const handleMoveDown = (idx: number) => {
    if (idx === displayQueue.length - 1) return;
    const o = [...displayQueue];
    [o[idx], o[idx + 1]] = [o[idx + 1], o[idx]];
    applyReorder(o);
  };

  // Drag-and-drop
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleDrop = (dropIdx: number) => {
    if (dragIdx === null || dragIdx === dropIdx) { setDragIdx(null); setDragOverIdx(null); return; }
    const o = [...displayQueue];
    const [moved] = o.splice(dragIdx, 1);
    o.splice(dropIdx, 0, moved);
    setDragIdx(null); setDragOverIdx(null);
    applyReorder(o);
  };

  // Modal état
  type ModalTV =
    | { type: 'slot-occupe'; item: Item; vehicule?: VehiculeInventaire; slot: typeof STATIONS[0]['slots'][0] }
    | { type: 'slot-vide'; slot: typeof STATIONS[0]['slots'][0] }
    | null;
  const [modal, setModal] = useState<ModalTV>(null);

  return (
    <div style={{
      flex, minWidth: 0, height: '100%',
      background: '#161410',
      border: `1.5px solid ${station.color}40`,
      borderRadius: 10,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* En-tête */}
      <div style={{
        padding: '10px 16px',
        background: `${station.color}18`,
        borderBottom: `1px solid ${station.color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: 16, fontWeight: 900, color: station.color,
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          {station.label}
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {displayQueue.length > 0 && (
            <span style={{
              background: `${station.color}18`, color: station.color,
              border: `1px solid ${station.color}44`,
              borderRadius: 6, padding: '2px 10px',
              fontSize: 12, fontWeight: 700,
            }}>
              {displayQueue.length} en attente
            </span>
          )}
          {planifies.length > 0 && (
            <span style={{
              background: 'rgba(148,163,184,0.1)', color: '#94a3b8',
              border: '1px solid rgba(148,163,184,0.25)',
              borderRadius: 6, padding: '2px 10px',
              fontSize: 12, fontWeight: 700,
            }}>
              {planifies.length} planifié{planifies.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Contenu scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>

        {/* ── Slots ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(station.gridCols, station.slots.length)}, 1fr)`,
          gap: 8,
        }}>
          {station.slots.map(slot => {
            const item = slotMap[slot.id];
            return (
              <TVSlotCard
                key={slot.id}
                slot={slot}
                item={item}
                accentColor={station.color}
                onClick={() => {
                  if (item) {
                    const v = item.inventaireId
                      ? vehicules.find(v => v.id === item.inventaireId)
                      : undefined;
                    setModal({ type: 'slot-occupe', item, vehicule: v, slot });
                  } else if (!slot.futur) {
                    setModal({ type: 'slot-vide', slot });
                  }
                }}
              />
            );
          })}
        </div>

        {/* ── File d'attente ── */}
        {displayQueue.length > 0 && (
          <div style={{
            borderTop: `1px solid ${station.color}25`,
            paddingTop: 8,
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: '#f59e0b',
              marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
              File d'attente
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {displayQueue.map((entry, idx) => {
                const { vehicule, item } = entry;
                const rank = idx + 1;
                const color = typeColor(vehicule.type);
                const isDragging = dragIdx === idx;
                const isOver = dragOverIdx === idx && dragIdx !== null && dragIdx !== idx;
                return (
                  <div
                    key={entry.stepId ?? `${vehicule.id}-${idx}`}
                    draggable
                    onDragStart={() => { setDragIdx(idx); setDragOverIdx(null); }}
                    onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                    onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx); }}
                    onDragLeave={() => setDragOverIdx(null)}
                    onDrop={() => handleDrop(idx)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      opacity: isDragging ? 0.4 : 1,
                      borderTop: isOver && dragIdx! > idx ? '2px solid #f59e0b' : '2px solid transparent',
                      borderBottom: isOver && dragIdx! < idx ? '2px solid #f59e0b' : '2px solid transparent',
                      cursor: 'grab',
                    }}
                  >
                    {/* Badge rang */}
                    <span style={{
                      width: 28, height: 28, borderRadius: 6,
                      background: rankColor(rank),
                      color: 'white', fontSize: 15, fontWeight: 900,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'monospace', flexShrink: 0,
                    }}>
                      {rank}
                    </span>

                    {/* Chip camion — grand numéro */}
                    <div style={{
                      flex: 1, display: 'flex', alignItems: 'center', gap: 6,
                      background: `${color}13`,
                      border: `1px solid ${color}40`,
                      borderRadius: 6, padding: '4px 10px',
                      minWidth: 0,
                    }}>
                      {vehicule.type === 'eau' ? <EauIcon /> : (
                        <span style={{ fontSize: 13 }}>
                          {vehicule.type === 'client' ? '🔧' : '🏷️'}
                        </span>
                      )}
                      <span style={{
                        color, fontSize: 20, fontWeight: 900,
                        fontFamily: 'monospace', letterSpacing: '-0.02em',
                      }}>
                        #{vehicule.numero}
                      </span>
                      {vehicule.type === 'client' && vehicule.nomClient && (
                        <span style={{
                          color: 'rgba(255,255,255,0.4)', fontSize: 12,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {vehicule.nomClient}
                        </span>
                      )}
                      {!item && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, background: '#fef9c3',
                          color: '#854d0e', padding: '1px 4px', borderRadius: 3, flexShrink: 0,
                        }}>ATT</span>
                      )}
                    </div>

                    {/* Boutons ▲▼ */}
                    <button onClick={() => handleMoveUp(idx)} style={arrowBtnStyle}>▲</button>
                    <button onClick={() => handleMoveDown(idx)} style={arrowBtnStyle}>▼</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Planifiés ── */}
        {planifies.length > 0 && (
          <div style={{
            borderTop: '1px solid rgba(148,163,184,0.15)',
            paddingTop: 8,
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: '#94a3b8',
              marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#94a3b8', display: 'inline-block' }} />
              Pipeline planifié
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {planifies.map(v => {
                const color = typeColor(v.type);
                return (
                  <div key={v.id} style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: `${color}0e`,
                    border: `1px solid ${color}30`,
                    borderRadius: 6, padding: '4px 10px',
                  }}>
                    {v.type === 'eau' ? <EauIcon /> : (
                      <span style={{ fontSize: 11 }}>
                        {v.type === 'client' ? '🔧' : '🏷️'}
                      </span>
                    )}
                    <span style={{
                      color, fontSize: 15, fontWeight: 800,
                      fontFamily: 'monospace',
                    }}>
                      #{v.numero}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Message vide */}
        {displayQueue.length === 0 && planifies.length === 0 &&
          station.slots.every(s => !slotMap[s.id]) && (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.12)', fontSize: 13, fontStyle: 'italic',
          }}>
            Station libre
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {modal?.type === 'slot-occupe' && (
        <TVModalSlotOccupe
          item={modal.item}
          vehicule={modal.vehicule}
          slot={modal.slot}
          accentColor={station.color}
          mettreAJourRoadMap={mettreAJourRoadMap}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'slot-vide' && (
        <TVModalSlotVide
          slot={modal.slot}
          queue={displayQueue}
          accentColor={station.color}
          assignerSlot={assignerSlot}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

const arrowBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', padding: '2px 4px',
  cursor: 'pointer', color: 'rgba(255,255,255,0.35)',
  fontSize: 13, lineHeight: 1, flexShrink: 0,
};

// ── TVSlotCard ──────────────────────────────────────────────────
interface TVSlotCardProps {
  slot: { id: string; futur?: boolean; label?: string };
  item?: Item;
  accentColor: string;
  onClick: () => void;
}

function TVSlotCard({ slot, item, accentColor, onClick }: TVSlotCardProps) {
  const isTempJob = item && ['export', 'demantelement', 'autres'].includes(item.type);
  const tColor = item
    ? isTempJob ? '#6b7280'
    : item.type === 'eau' ? '#f97316'
    : item.type === 'client' ? '#3b82f6'
    : '#22c55e'
    : null;

  const borderColor = item
    ? isTempJob ? '#374151'
    : item.etatCommercial === 'vendu' ? '#ef4444'
    : item.etatCommercial === 'reserve' ? '#f59e0b'
    : item.etatCommercial === 'location' ? '#7c3aed'
    : tColor!
    : accentColor;

  return (
    <div
      onClick={onClick}
      style={{
        background: item ? `${tColor}0d` : 'rgba(255,255,255,0.02)',
        border: `2px solid ${item ? `${borderColor}60` : `${accentColor}20`}`,
        borderRadius: 8,
        padding: '10px 12px',
        cursor: slot.futur ? 'default' : 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 4, minHeight: 80,
        transition: 'background 0.15s, border-color 0.15s',
        position: 'relative',
        opacity: slot.futur ? 0.4 : 1,
      }}
      onMouseEnter={e => {
        if (!slot.futur) e.currentTarget.style.background = item ? `${tColor}18` : 'rgba(255,255,255,0.04)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = item ? `${tColor}0d` : 'rgba(255,255,255,0.02)';
      }}
    >
      {/* Numéro slot en haut à gauche */}
      <span style={{
        position: 'absolute', top: 6, left: 8,
        fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace', fontWeight: 700,
      }}>
        {slot.id}
      </span>

      {slot.futur ? (
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>À venir</span>
      ) : item ? (
        <>
          {tColor && (
            <span style={{
              fontSize: 38, fontWeight: 900, color: tColor,
              fontFamily: 'monospace', letterSpacing: '-0.03em', lineHeight: 1,
            }}>
              #{item.numero}
            </span>
          )}
          {isTempJob && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
              {item.label ?? item.numero}
            </span>
          )}
          {!isTempJob && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
              {item.etatCommercial === 'vendu' && <EtatBadge label="VENDU" color="#ef4444" />}
              {item.etatCommercial === 'reserve' && <EtatBadge label="RÉS." color="#f59e0b" />}
              {item.etatCommercial === 'location' && <EtatBadge label="LOC." color="#7c3aed" />}
              {item.type === 'eau' && <span style={{ fontSize: 11 }}><EauIcon /></span>}
              {item.type === 'client' && <span style={{ fontSize: 11 }}>🔧</span>}
              {item.type === 'detail' && <span style={{ fontSize: 11 }}>🏷️</span>}
            </div>
          )}
        </>
      ) : (
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.15)', fontStyle: 'italic' }}>
          Libre
        </span>
      )}
    </div>
  );
}

function EtatBadge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 700,
      background: `${color}22`, color,
      padding: '2px 5px', borderRadius: 3,
    }}>
      {label}
    </span>
  );
}

// ── TVModalSlotOccupe ───────────────────────────────────────────
interface TVModalSlotOccupeProps {
  item: Item;
  vehicule?: VehiculeInventaire;
  slot: { id: string };
  accentColor: string;
  mettreAJourRoadMap: (vehiculeId: string, roadMap: RoadMapEtape[]) => Promise<void>;
  onClose: () => void;
}

function TVModalSlotOccupe({ item, vehicule, slot, accentColor, mettreAJourRoadMap, onClose }: TVModalSlotOccupeProps) {
  const [saving, setSaving] = useState(false);

  const tColor = item.type === 'eau' ? '#f97316'
    : item.type === 'client' ? '#3b82f6'
    : '#22c55e';

  // Trouver l'étape "en-cours" du road map pour ce véhicule
  const currentStep = vehicule?.roadMap?.find(s => s.statut === 'en-cours');
  const roadMap = vehicule?.roadMap ?? [];

  const handleChangeStatut = async (stepId: string, newStatut: RoadMapEtape['statut']) => {
    if (!vehicule) return;
    setSaving(true);
    try {
      const updated = roadMap.map(s =>
        s.id === stepId ? { ...s, statut: newStatut } : s
      );
      await mettreAJourRoadMap(vehicule.id, updated);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <TVModal onClose={onClose}>
      <div style={{
        borderBottom: `1px solid ${tColor}30`, paddingBottom: 16, marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 10,
          background: `${tColor}15`, border: `2px solid ${tColor}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {item.type === 'eau' ? <EauIcon /> : (
            <span style={{ fontSize: 22 }}>{item.type === 'client' ? '🔧' : '🏷️'}</span>
          )}
        </div>
        <div>
          <div style={{ fontSize: 28, fontWeight: 900, color: tColor, fontFamily: 'monospace' }}>
            #{item.numero}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
            Slot {slot.id}
            {item.nomClient ? ` · ${item.nomClient}` : ''}
          </div>
        </div>
      </div>

      {/* Étapes road map */}
      {roadMap.length > 0 ? (
        <div>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)',
            marginBottom: 10,
          }}>
            Étapes Road Map
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
            {roadMap.map(step => {
              const cfg = STATUT_CONFIG[step.statut] ?? STATUT_CONFIG['planifie'];
              return (
                <div key={step.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid rgba(255,255,255,0.07)`,
                  borderRadius: 8, padding: '8px 10px',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: 'white', fontWeight: 600 }}>
                      {step.stationId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </div>
                    {step.description && (
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                        {step.description}
                      </div>
                    )}
                  </div>
                  <select
                    value={step.statut}
                    disabled={saving}
                    onChange={e => handleChangeStatut(step.id, e.target.value as RoadMapEtape['statut'])}
                    style={{
                      background: cfg.bg, color: cfg.color,
                      border: `1px solid ${cfg.color}50`,
                      borderRadius: 6, padding: '4px 8px',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    <option value="planifie">Planifié</option>
                    <option value="en-attente">En attente</option>
                    <option value="en-cours">En cours</option>
                    <option value="termine">Terminé</option>
                    <option value="saute">Sauté</option>
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{
          padding: '20px', textAlign: 'center',
          color: 'rgba(255,255,255,0.25)', fontSize: 13, fontStyle: 'italic',
        }}>
          Pas de road map configuré
        </div>
      )}

      {saving && (
        <div style={{
          marginTop: 12, textAlign: 'center',
          color: '#f59e0b', fontSize: 13, fontWeight: 600,
        }}>
          ⏳ Sauvegarde...
        </div>
      )}
    </TVModal>
  );
}

// ── TVModalSlotVide ─────────────────────────────────────────────
interface TVModalSlotVideProps {
  slot: { id: string };
  queue: QueueEntry[];
  accentColor: string;
  assignerSlot: (itemId: string, slotId: string) => void;
  onClose: () => void;
}

function TVModalSlotVide({ slot, queue, accentColor, assignerSlot, onClose }: TVModalSlotVideProps) {
  const availableItems = queue.filter(e => e.item && !e.item.slotId);

  const handleAssign = (entry: QueueEntry) => {
    if (entry.item) {
      assignerSlot(entry.item.id, slot.id);
      onClose();
    }
  };

  return (
    <TVModal onClose={onClose}>
      <div style={{
        fontSize: 18, fontWeight: 800, color: 'white', marginBottom: 4,
      }}>
        Assigner au slot {slot.id}
      </div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>
        Choisir un camion de la file d'attente
      </div>

      {availableItems.length === 0 ? (
        <div style={{
          padding: '24px', textAlign: 'center',
          color: 'rgba(255,255,255,0.2)', fontSize: 13, fontStyle: 'italic',
        }}>
          File d'attente vide
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {availableItems.map((entry, idx) => {
            const { vehicule } = entry;
            const color = typeColor(vehicule.type);
            return (
              <button
                key={entry.vehicule.id}
                onClick={() => handleAssign(entry)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: `${color}10`,
                  border: `1px solid ${color}35`,
                  borderRadius: 8, padding: '10px 14px',
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = `${color}20`; }}
                onMouseLeave={e => { e.currentTarget.style.background = `${color}10`; }}
              >
                <span style={{
                  width: 24, height: 24, borderRadius: 5,
                  background: rankColor(idx + 1),
                  color: 'white', fontSize: 13, fontWeight: 900,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'monospace', flexShrink: 0,
                }}>
                  {idx + 1}
                </span>
                <span style={{
                  fontSize: 20, fontWeight: 900, color,
                  fontFamily: 'monospace',
                }}>
                  #{vehicule.numero}
                </span>
                {vehicule.type === 'client' && vehicule.nomClient && (
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                    {vehicule.nomClient}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </TVModal>
  );
}

// ── TVModal (wrapper) ───────────────────────────────────────────
function TVModal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#1a1714',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 16, padding: '24px 28px',
          width: 420, maxHeight: '80vh', overflowY: 'auto',
          boxShadow: '0 40px 80px rgba(0,0,0,0.7)',
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 14, right: 14,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6, color: 'rgba(255,255,255,0.4)',
            width: 28, height: 28, cursor: 'pointer',
            fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
