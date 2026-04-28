import { useState, useMemo, useEffect, useCallback } from 'react';
import { useGarage } from '../hooks/useGarage';
import { useInventaire } from '../contexts/InventaireContext';
import { getTVSession, clearTVSession } from '../hooks/useTVAccess';
import { supabase } from '../lib/supabase';
import { STATIONS } from '../data/stations';
import { SLOT_TO_GARAGE } from '../data/garageData';
import { TOUTES_STATIONS_COMMUNES } from '../data/mockData';
import { StationBlock, PeintureStationBlock, QueueEntry } from './PlancherView';
import { PanneauDetailVehicule } from './PanneauDetailVehicule';
import { SlotAssignModal } from './SlotAssignModal';
import { SlotOccupeModal } from './SlotOccupeModal';
import { inventaireService } from '../services/inventaireService';
import type { Item, Slot } from '../types/item.types';
import type { VehiculeInventaire, RoadMapEtape } from '../types/inventaireTypes';

// ── TV Configurations ──────────────────────────────────────────
// garage_id (depuis tv_acces) → quelles stations physiques afficher.
// On accepte plusieurs alias par config pour la rétrocompatibilité.
type TVConfig = { label: string; stationIds: string[] };

const TV_CONFIGS: Record<string, TVConfig> = {
  'general':              { label: 'Vue Générale',             stationIds: ['soudure-generale', 'point-s', 'mecanique-generale', 'mecanique-moteur', 'sous-traitants', 'soudure-specialisee', 'peinture'] },
  'soudure-generale':     { label: 'Soudure Générale',         stationIds: ['soudure-generale'] },
  'mecanique':            { label: 'Mécanique',                stationIds: ['mecanique-generale', 'mecanique-moteur', 'sous-traitants'] },
  'spec':                 { label: 'Soudure Spéc. + Peinture', stationIds: ['soudure-specialisee', 'peinture'] },
  'soudure-specialisee':  { label: 'Soudure Spéc. + Peinture', stationIds: ['soudure-specialisee', 'peinture'] }, // alias
  'sous-traitants':       { label: 'Sous-traitants',           stationIds: ['sous-traitants'] },
};

// ── Main VueTV ──────────────────────────────────────────────────
export function VueTV() {
  const session = getTVSession();
  const garageId = session?.garageId ?? '';
  const tvLabel  = session?.label ?? '';

  const {
    items, slotMap, enAttente, assignerSlot,
    retirerVersAttente, terminerItem,
    updateStationStatus, terminerEtAvancer, rechargerItems,
  } = useGarage();
  const { vehicules, mettreAJourPriorites } = useInventaire();

  // Heartbeat toutes les 25s pour éviter timeout
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

  // vehiculesComplets
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

  // Reorder handler
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

  // ── Gestion modal/détail (identique PlancherView) ─────────────
  type ModalState =
    | { type: 'assign'; slot: Slot; position: { x: number; y: number }; preSelectedItem?: Item }
    | { type: 'occupe'; item: Item; slot: Slot; position: { x: number; y: number } }
    | { type: 'detail'; vehiculeId: string; itemId?: string }
    | null;
  const [modalState, setModalState] = useState<ModalState>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setModalState(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const calculerPosition = (rect: DOMRect) => {
    const W = 360, H = 600, M = 10;
    let x = rect.right + M;
    let y = rect.top;
    if (x + W > window.innerWidth) x = rect.left - W - M;
    if (x < M) x = M;
    if (y + H > window.innerHeight) y = window.innerHeight - H - M;
    if (y < M) y = M;
    return { x, y };
  };

  const handleSlotClick = (e: React.MouseEvent, slot: Slot) => {
    e.stopPropagation();
    const item = slotMap[slot.id];
    const rect = e.currentTarget.getBoundingClientRect();
    const position = calculerPosition(rect);
    if (item) {
      setModalState({ type: 'detail', vehiculeId: item.inventaireId || item.id, itemId: item.id });
    } else if (!slot.futur) {
      setModalState({ type: 'assign', slot, position });
    }
  };

  const handleWaitingItemClick = (e: React.MouseEvent, item: Item, garageId2: string) => {
    e.stopPropagation();
    if (item.slotId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const position = calculerPosition(rect);
    const station = STATIONS.find(s => s.id === garageId2);
    const availableSlot = station?.slots.find(s => !slotMap[s.id]);
    if (availableSlot) {
      setModalState({ type: 'assign', slot: availableSlot, position, preSelectedItem: item });
    } else if (station && station.slots.length > 0) {
      setModalState({ type: 'assign', slot: station.slots[0], position, preSelectedItem: item });
    }
  };

  const handleOpenDetail = (vehiculeId: string) => {
    setModalState({ type: 'detail', vehiculeId });
  };

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

  const config = TV_CONFIGS[garageId];

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

  // Props communs aux StationBlock
  const blockProps = {
    slotMap,
    onSlotClick: handleSlotClick,
    allEnAttente,
    onWaitingItemClick: handleWaitingItemClick,
    vehicules: vehiculesComplets,
    itemByInvId,
    onReorder: handleReorder,
    onOpenDetail: handleOpenDetail,
    showPlanifies: true, // affiche le pipeline planifié sur TV
  };

  // ── Layout par config TV ──────────────────────────────────────
  // GENERAL = identique à PlancherView
  // Autres = layouts adaptés aux stations affichées
  const isGeneral   = garageId === 'general';
  const isMecanique = garageId === 'mecanique';
  const isSpec      = garageId === 'spec' || garageId === 'soudure-specialisee';

  return (
    <div style={{
      width: '100vw', height: '100dvh', background: '#0a0908',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Header TV */}
      <div style={{
        flexShrink: 0, height: 48,
        background: '#0f0e0b',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center',
        padding: '0 20px', gap: 16,
      }}>
        <img
          src="/logo-camions-dubois-_-noir-bleu-1.png"
          alt="Camions Dubois"
          style={{ height: 26, objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.5 }}
        />
        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />
        <div style={{ fontSize: 16, fontWeight: 800, color: 'white', letterSpacing: '-0.01em' }}>
          📺 {tvLabel || config.label}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{
          fontFamily: 'monospace', fontSize: 16, fontWeight: 700,
          color: 'rgba(255,255,255,0.7)', letterSpacing: '0.04em',
        }}>
          {now.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
        <button
          onClick={handleDeconnexion}
          style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6, color: 'rgba(255,255,255,0.3)',
            padding: '4px 10px', cursor: 'pointer',
            fontSize: 11, transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}
        >
          ← Déconnecter
        </button>
      </div>

      {/* Corps — un layout par config TV */}
      <div
        onClick={() => setModalState(null)}
        style={{
          flex: 1, position: 'relative', overflow: 'hidden',
          background: '#0f0e0b',
        }}
      >
        {/* GENERAL : identique à PlancherView */}
        {isGeneral && (
          <div style={{
            width: '100%', height: '100%',
            display: 'grid',
            gridTemplateColumns: '1fr 2fr 3fr',
            gridTemplateRows: '1fr 1fr',
            gap: 8, padding: 8,
            boxSizing: 'border-box',
          }}>
            <div style={{ gridColumn: '1', gridRow: '1', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0 }}>
              <StationBlock station={STATIONS.find(s => s.id === 'soudure-generale')!} {...blockProps} />
              <StationBlock station={STATIONS.find(s => s.id === 'point-s')!} {...blockProps} />
            </div>
            <StationBlock station={STATIONS.find(s => s.id === 'mecanique-generale')!} {...blockProps} style={{ gridColumn: '2', gridRow: '1' }} />
            <StationBlock station={STATIONS.find(s => s.id === 'mecanique-moteur')!} {...blockProps} style={{ gridColumn: '3', gridRow: '1' }} />
            <StationBlock station={STATIONS.find(s => s.id === 'sous-traitants')!} {...blockProps} style={{ gridColumn: '1 / 3', gridRow: '2' }} />
            <div style={{ gridColumn: '3', gridRow: '2', display: 'flex', gap: 6, minHeight: 0 }}>
              <StationBlock station={STATIONS.find(s => s.id === 'soudure-specialisee')!} {...blockProps} />
              <PeintureStationBlock station={STATIONS.find(s => s.id === 'peinture')!} />
            </div>
          </div>
        )}

        {/* MÉCANIQUE : Méc-Gén + Méc-Mot en haut, Sous-traitants en bas */}
        {isMecanique && (
          <div style={{
            width: '100%', height: '100%',
            display: 'grid',
            gridTemplateColumns: '2fr 3fr',
            gridTemplateRows: '1fr 1fr',
            gap: 8, padding: 8,
            boxSizing: 'border-box',
          }}>
            <StationBlock station={STATIONS.find(s => s.id === 'mecanique-generale')!} {...blockProps} style={{ gridColumn: '1', gridRow: '1' }} />
            <StationBlock station={STATIONS.find(s => s.id === 'mecanique-moteur')!} {...blockProps} style={{ gridColumn: '2', gridRow: '1' }} />
            <StationBlock station={STATIONS.find(s => s.id === 'sous-traitants')!} {...blockProps} style={{ gridColumn: '1 / 3', gridRow: '2' }} />
          </div>
        )}

        {/* SPEC : Soudure Spéc. + Peinture côte-à-côte */}
        {isSpec && (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', gap: 8, padding: 8,
            boxSizing: 'border-box',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <StationBlock station={STATIONS.find(s => s.id === 'soudure-specialisee')!} {...blockProps} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <PeintureStationBlock station={STATIONS.find(s => s.id === 'peinture')!} />
            </div>
          </div>
        )}

        {/* SOUDURE GÉNÉRALE seule : full-screen */}
        {garageId === 'soudure-generale' && (
          <div style={{
            width: '100%', height: '100%',
            padding: 8, boxSizing: 'border-box',
          }}>
            <StationBlock station={STATIONS.find(s => s.id === 'soudure-generale')!} {...blockProps} />
          </div>
        )}

        {/* SOUS-TRAITANTS seul : full-screen */}
        {garageId === 'sous-traitants' && (
          <div style={{
            width: '100%', height: '100%',
            padding: 8, boxSizing: 'border-box',
          }}>
            <StationBlock station={STATIONS.find(s => s.id === 'sous-traitants')!} {...blockProps} />
          </div>
        )}

        {/* ── Modals ── */}
        {modalState?.type === 'assign' && (
          <SlotAssignModal
            slot={modalState.slot}
            enAttente={enAttente}
            onAssign={assignerSlot}
            onClose={() => setModalState(null)}
            position={modalState.position}
            preSelectedItem={modalState.preSelectedItem}
            onJobTemporaire={() => {}}
            onChoisirInventaire={() => {}}
            itemOccupant={slotMap[modalState.slot.id]}
            onRetirerOccupant={retirerVersAttente}
            onTerminerOccupant={terminerItem}
          />
        )}

        {modalState?.type === 'occupe' && (
          <SlotOccupeModal
            item={slotMap[modalState.slot.id] ?? modalState.item}
            slot={modalState.slot}
            onRetirerAttente={retirerVersAttente}
            onTerminerEtAvancer={terminerEtAvancer}
            onTerminer={terminerItem}
            onClose={() => setModalState(null)}
            position={modalState.position}
            stations={TOUTES_STATIONS_COMMUNES}
            onUpdateStationStatus={updateStationStatus}
            onAssignerSlot={assignerSlot}
            slotMap={slotMap}
          />
        )}

        {modalState?.type === 'detail' && (() => {
          const detailVehicule = vehiculesComplets.find(v => v.id === modalState.vehiculeId);
          const detailItem = modalState.itemId
            ? items.find(i => i.id === modalState.itemId)
            : items.find(i =>
                (i.inventaireId === modalState.vehiculeId || i.id === modalState.vehiculeId) &&
                i.etat !== 'termine'
              );
          if (!detailVehicule) return null;
          return (
            <PanneauDetailVehicule
              key={detailVehicule.id}
              vehicule={detailVehicule}
              item={detailItem}
              onClose={() => setModalState(null)}
            />
          );
        })()}
      </div>
    </div>
  );
}
