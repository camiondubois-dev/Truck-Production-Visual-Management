import { useState, useEffect, useMemo, useCallback } from 'react';
import { useGarage } from '../hooks/useGarage';
import { useInventaire } from '../contexts/InventaireContext';
import { EauIcon } from './EauIcon';
import { STATIONS } from '../data/stations';
import { STATION_TO_GARAGE, SLOT_TO_GARAGE, GARAGE_TO_ROAD_MAP_STATIONS } from '../data/garageData';
import { TOUTES_STATIONS_COMMUNES } from '../data/mockData';
import { SlotAssignModal } from './SlotAssignModal';
import { SlotOccupeModal } from './SlotOccupeModal';
import { CreateWizardModal } from './CreateWizardModal';
import { logJobTemporaire } from '../services/timeLogService';
import type { Slot, Item } from '../types/item.types';
import type { VehiculeInventaire } from '../types/inventaireTypes';

export interface JobTemporaire {
  slotId: string;
  garageId: string;
  typeJob: 'export' | 'demantelement' | 'autres';
  titre: string;
  heureEntree: string;
}

const TYPE_JOB_CONFIG = {
  export:        { label: 'Camion export',        emoji: '🚛', color: '#475569' },
  demantelement: { label: 'Démantèlement pièces',  emoji: '🔧', color: '#374151' },
  autres:        { label: 'Autres travaux',         emoji: '📋', color: '#1f2937' },
} as const;

// Couleur du badge de position selon le rang
const positionColor = (rank: number) =>
  rank === 1 ? '#ef4444' : rank === 2 ? '#f97316' : rank === 3 ? '#f59e0b' : '#6b7280';

type ModalState =
  | { type: 'assign'; slot: Slot; position: { x: number; y: number }; preSelectedItem?: Item }
  | { type: 'occupe'; item: Item; slot: Slot; position: { x: number; y: number } }
  | { type: 'job-type'; slot: Slot; position: { x: number; y: number } }
  | { type: 'job-titre'; slot: Slot; typeJob: JobTemporaire['typeJob']; position: { x: number; y: number } }
  | { type: 'job-occupe'; job: JobTemporaire; slot: Slot; position: { x: number; y: number } }
  | null;

export function PlancherView() {
  const {
    items,
    slotMap, enAttente, assignerSlot,
    retirerVersAttente, terminerItem,
    ajouterItem, updateStationStatus,
    terminerEtAvancer,
  } = useGarage();

  const { vehicules, mettreAJourRoadMap } = useInventaire();

  const [modalState, setModalState] = useState<ModalState>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [tempJobs, setTempJobs] = useState<Record<string, JobTemporaire>>({});

  const allEnAttente = [...enAttente.eau, ...enAttente.client, ...enAttente.detail];

  // Index inventaireId → Item pour croiser road_map et prod_items
  const itemByInvId = useMemo(() => {
    const map: Record<string, Item> = {};
    items.forEach(item => { if (item.inventaireId) map[item.inventaireId] = item; });
    return map;
  }, [items]);

  // Met à jour la priorité (position) d'une étape road_map depuis le plancher
  const handleSetPriorite = useCallback(async (
    inventaireId: string,
    stationId: string,
    priorite: number | undefined,
  ) => {
    const vehicule = vehicules.find(v => v.id === inventaireId);
    if (!vehicule?.roadMap) return;
    const updated = vehicule.roadMap.map(step =>
      step.stationId === stationId ? { ...step, priorite } : step
    );
    await mettreAJourRoadMap(inventaireId, updated);
  }, [vehicules, mettreAJourRoadMap]);

  const calculerPosition = (rect: DOMRect) => {
    const MODAL_WIDTH = 360;
    const MODAL_HEIGHT = 600;
    const MARGIN = 10;
    let x = rect.right + MARGIN;
    let y = rect.top;
    if (x + MODAL_WIDTH > window.innerWidth) x = rect.left - MODAL_WIDTH - MARGIN;
    if (x < MARGIN) x = MARGIN;
    if (y + MODAL_HEIGHT > window.innerHeight) y = window.innerHeight - MODAL_HEIGHT - MARGIN;
    if (y < MARGIN) y = MARGIN;
    return { x, y };
  };

  const handleSlotClick = (e: React.MouseEvent, slot: Slot) => {
    e.stopPropagation();
    const item = slotMap[slot.id];
    const tempJob = tempJobs[slot.id];
    const rect = e.currentTarget.getBoundingClientRect();
    const position = calculerPosition(rect);
    if (tempJob) {
      setModalState({ type: 'job-occupe', job: tempJob, slot, position });
    } else if (item) {
      setModalState({ type: 'occupe', item, slot, position });
    } else if (!slot.futur) {
      setModalState({ type: 'assign', slot, position });
    }
  };

  const handleWaitingItemClick = (e: React.MouseEvent, item: Item, garageId: string) => {
    e.stopPropagation();
    if (item.slotId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const position = calculerPosition(rect);
    const station = STATIONS.find((s) => s.id === garageId);
    const availableSlot = station?.slots.find((s) => !slotMap[s.id] && !tempJobs[s.id]);
    if (availableSlot) {
      setModalState({ type: 'assign', slot: availableSlot, position, preSelectedItem: item });
    } else if (station && station.slots.length > 0) {
      setModalState({ type: 'assign', slot: station.slots[0], position, preSelectedItem: item });
    }
  };

  const handleJobTemporaireStart = (slot: Slot, position: { x: number; y: number }) => {
    setModalState({ type: 'job-type', slot, position });
  };

  const handleJobTypeSelect = (typeJob: JobTemporaire['typeJob']) => {
    if (modalState?.type !== 'job-type') return;
    setModalState({ type: 'job-titre', slot: modalState.slot, typeJob, position: modalState.position });
  };

  const handleJobTitreConfirm = (titre: string) => {
    if (modalState?.type !== 'job-titre') return;
    const { slot, typeJob } = modalState;
    const garageId = SLOT_TO_GARAGE[slot.id] ?? '';
    const job: JobTemporaire = {
      slotId: slot.id, garageId, typeJob,
      titre: titre.trim(),
      heureEntree: new Date().toISOString(),
    };
    setTempJobs(prev => ({ ...prev, [slot.id]: job }));
    setModalState(null);
  };

  const handleViderSlot = async (job: JobTemporaire) => {
    await logJobTemporaire({
      typeJob: job.typeJob,
      titre: job.titre,
      garageId: job.garageId,
      slotId: job.slotId,
      heureEntree: job.heureEntree,
    });
    setTempJobs(prev => {
      const next = { ...prev };
      delete next[job.slotId];
      return next;
    });
    setModalState(null);
  };

  return (
    <div
      onClick={() => setModalState(null)}
      style={{
        width: '100vw', height: '100vh',
        display: 'grid',
        gridTemplateColumns: '1fr 2fr 3fr',
        gridTemplateRows: '1fr 1fr',
        gap: '12px', padding: '12px',
        background: '#0f0e0b',
        boxSizing: 'border-box',
        overflow: 'visible',
        position: 'relative',
      }}
    >
      <button
        onClick={(e) => { e.stopPropagation(); setShowWizard(true); }}
        style={{
          position: 'absolute', top: 20, right: 20,
          padding: '8px 16px', background: '#f97316',
          color: 'white', border: 'none', borderRadius: 8,
          fontWeight: 700, fontSize: 14, cursor: 'pointer',
          zIndex: 100, display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        + Nouveau
      </button>

      <div style={{ gridColumn: '1', gridRow: '1', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <StationBlock station={STATIONS.find((s) => s.id === 'soudure-generale')!} slotMap={slotMap} tempJobs={tempJobs} onSlotClick={handleSlotClick} allEnAttente={allEnAttente} onWaitingItemClick={handleWaitingItemClick} vehicules={vehicules} itemByInvId={itemByInvId} onSetPriorite={handleSetPriorite} />
        <StationBlock station={STATIONS.find((s) => s.id === 'point-s')!} slotMap={slotMap} tempJobs={tempJobs} onSlotClick={handleSlotClick} allEnAttente={allEnAttente} onWaitingItemClick={handleWaitingItemClick} vehicules={vehicules} itemByInvId={itemByInvId} onSetPriorite={handleSetPriorite} />
      </div>

      <StationBlock station={STATIONS.find((s) => s.id === 'mecanique-generale')!} slotMap={slotMap} tempJobs={tempJobs} onSlotClick={handleSlotClick} allEnAttente={allEnAttente} onWaitingItemClick={handleWaitingItemClick} vehicules={vehicules} itemByInvId={itemByInvId} onSetPriorite={handleSetPriorite} style={{ gridColumn: '2', gridRow: '1' }} />

      <StationBlock station={STATIONS.find((s) => s.id === 'mecanique-moteur')!} slotMap={slotMap} tempJobs={tempJobs} onSlotClick={handleSlotClick} allEnAttente={allEnAttente} onWaitingItemClick={handleWaitingItemClick} vehicules={vehicules} itemByInvId={itemByInvId} onSetPriorite={handleSetPriorite} style={{ gridColumn: '3', gridRow: '1' }} />

      <div style={{ gridColumn: '1', gridRow: '2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <HorlogeWidget />
      </div>

      <StationBlock station={STATIONS.find((s) => s.id === 'sous-traitants')!} slotMap={slotMap} tempJobs={tempJobs} onSlotClick={handleSlotClick} allEnAttente={allEnAttente} onWaitingItemClick={handleWaitingItemClick} vehicules={vehicules} itemByInvId={itemByInvId} onSetPriorite={handleSetPriorite} style={{ gridColumn: '2', gridRow: '2' }} />

      <div style={{ gridColumn: '3', gridRow: '2', display: 'flex', gap: 12 }}>
        <StationBlock station={STATIONS.find((s) => s.id === 'soudure-specialisee')!} slotMap={slotMap} tempJobs={tempJobs} onSlotClick={handleSlotClick} allEnAttente={allEnAttente} onWaitingItemClick={handleWaitingItemClick} vehicules={vehicules} itemByInvId={itemByInvId} onSetPriorite={handleSetPriorite} />
        <StationBlock station={STATIONS.find((s) => s.id === 'peinture')!} slotMap={slotMap} tempJobs={tempJobs} onSlotClick={handleSlotClick} allEnAttente={allEnAttente} onWaitingItemClick={handleWaitingItemClick} vehicules={vehicules} itemByInvId={itemByInvId} onSetPriorite={handleSetPriorite} />
      </div>

      {modalState?.type === 'assign' && (
        <SlotAssignModal
          slot={modalState.slot}
          enAttente={enAttente}
          onAssign={assignerSlot}
          onClose={() => setModalState(null)}
          position={modalState.position}
          preSelectedItem={modalState.preSelectedItem}
          onJobTemporaire={() => handleJobTemporaireStart(modalState.slot, modalState.position)}
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

      {modalState?.type === 'job-type' && (
        <ModalJobType
          slot={modalState.slot}
          position={modalState.position}
          onSelect={handleJobTypeSelect}
          onClose={() => setModalState(null)}
        />
      )}

      {modalState?.type === 'job-titre' && (
        <ModalJobTitre
          slot={modalState.slot}
          typeJob={modalState.typeJob}
          position={modalState.position}
          onConfirm={handleJobTitreConfirm}
          onClose={() => setModalState(null)}
        />
      )}

      {modalState?.type === 'job-occupe' && (
        <ModalJobOccupe
          job={modalState.job}
          slot={modalState.slot}
          position={modalState.position}
          onVider={() => handleViderSlot(modalState.job)}
          onClose={() => setModalState(null)}
        />
      )}

      {showWizard && (
        <CreateWizardModal
          onClose={() => setShowWizard(false)}
          onCreate={(item) => ajouterItem(item as Item)}
        />
      )}
    </div>
  );
}

function ModalJobType({ slot, position, onSelect, onClose }: {
  slot: Slot;
  position: { x: number; y: number };
  onSelect: (type: JobTemporaire['typeJob']) => void;
  onClose: () => void;
}) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed', top: position.y, left: position.x, zIndex: 200,
        background: '#1a1814', border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: 10, padding: 16, width: 290,
        boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
      }}
    >
      <div style={{ fontFamily: 'monospace', color: '#ff6040', fontWeight: 700, marginBottom: 4, fontSize: 13 }}>
        Job temporaire — Slot {slot.id}
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 14, fontFamily: 'monospace' }}>
        Quel type de travail?
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(Object.entries(TYPE_JOB_CONFIG) as [JobTemporaire['typeJob'], typeof TYPE_JOB_CONFIG[keyof typeof TYPE_JOB_CONFIG]][]).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => onSelect(key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '11px 14px', borderRadius: 8, cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 600,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
          >
            <span style={{ fontSize: 18 }}>{cfg.emoji}</span>
            {cfg.label}
          </button>
        ))}
      </div>
      <button
        onClick={onClose}
        style={{ width: '100%', marginTop: 10, padding: '6px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 12 }}
      >
        Annuler
      </button>
    </div>
  );
}

function ModalJobTitre({ slot, typeJob, position, onConfirm, onClose }: {
  slot: Slot;
  typeJob: JobTemporaire['typeJob'];
  position: { x: number; y: number };
  onConfirm: (titre: string) => void;
  onClose: () => void;
}) {
  const [titre, setTitre] = useState('');
  const cfg = TYPE_JOB_CONFIG[typeJob];

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed', top: position.y, left: position.x, zIndex: 200,
        background: '#1a1814', border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: 10, padding: 16, width: 290,
        boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
      }}
    >
      <div style={{ fontFamily: 'monospace', color: '#ff6040', fontWeight: 700, marginBottom: 4, fontSize: 13 }}>
        {cfg.emoji} {cfg.label}
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 14, fontFamily: 'monospace' }}>
        Slot {slot.id} — Titre du job
      </div>
      <input
        autoFocus
        type="text"
        value={titre}
        onChange={e => setTitre(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && titre.trim()) onConfirm(titre); }}
        placeholder={typeJob === 'export' ? 'Ex: Export #12' : typeJob === 'demantelement' ? 'Ex: Pièces F-250' : 'Ex: Nettoyage atelier'}
        style={{
          width: '100%', padding: '9px 11px', borderRadius: 7,
          border: '1px solid rgba(255,255,255,0.2)',
          background: 'rgba(255,255,255,0.07)',
          color: 'white', fontSize: 13, outline: 'none',
          boxSizing: 'border-box', marginBottom: 10,
        }}
      />
      <button
        onClick={() => titre.trim() && onConfirm(titre)}
        disabled={!titre.trim()}
        style={{
          width: '100%', padding: '9px', borderRadius: 7, border: 'none',
          background: titre.trim() ? '#4b5563' : 'rgba(255,255,255,0.07)',
          color: titre.trim() ? 'white' : 'rgba(255,255,255,0.25)',
          fontWeight: 700, fontSize: 13, cursor: titre.trim() ? 'pointer' : 'not-allowed',
          marginBottom: 6, transition: 'all 0.15s',
        }}
      >
        Occuper le slot
      </button>
      <button
        onClick={onClose}
        style={{ width: '100%', padding: '6px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 12 }}
      >
        Annuler
      </button>
    </div>
  );
}

function ModalJobOccupe({ job, slot, position, onVider, onClose }: {
  job: JobTemporaire;
  slot: Slot;
  position: { x: number; y: number };
  onVider: () => void;
  onClose: () => void;
}) {
  const cfg = TYPE_JOB_CONFIG[job.typeJob];
  const dureeMin = Math.round((Date.now() - new Date(job.heureEntree).getTime()) / 60000);
  const dureeLabel = dureeMin < 60
    ? `${dureeMin} min`
    : `${Math.floor(dureeMin / 60)}h${String(dureeMin % 60).padStart(2, '0')}`;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed', top: position.y, left: position.x, zIndex: 200,
        background: '#1a1814', border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: 10, padding: 16, width: 290,
        boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
      }}
    >
      <div style={{ fontFamily: 'monospace', color: '#ff6040', fontWeight: 700, marginBottom: 12, fontSize: 13 }}>
        Slot {slot.id} — Job temporaire
      </div>
      <div style={{
        padding: '12px 14px', borderRadius: 8, marginBottom: 14,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.9)', marginBottom: 4 }}>
          {cfg.emoji} {job.titre}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 2 }}>
          {cfg.label}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
          Depuis {new Date(job.heureEntree).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })} — {dureeLabel}
        </div>
      </div>
      <button
        onClick={onVider}
        style={{
          width: '100%', padding: '9px', borderRadius: 7, border: 'none',
          background: '#dc2626', color: 'white',
          fontWeight: 700, fontSize: 13, cursor: 'pointer', marginBottom: 6,
        }}
      >
        Vider le slot
      </button>
      <button
        onClick={onClose}
        style={{ width: '100%', padding: '6px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 12 }}
      >
        Fermer
      </button>
    </div>
  );
}

function HorlogeWidget() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const heure = now.toLocaleTimeString('fr-CA', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });

  const date = now.toLocaleDateString('fr-CA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const fuseau = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div style={{
      background: '#161410',
      border: '1.5px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: '20px 28px',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 8,
      width: '100%', boxSizing: 'border-box',
    }}>
      <div style={{
        fontFamily: 'monospace', fontSize: 'clamp(28px, 3.5vw, 48px)',
        fontWeight: 900, color: '#005AA0', letterSpacing: '0.05em', lineHeight: 1,
      }}>
        {heure}
      </div>
      <div style={{
        fontSize: 'clamp(10px, 1.1vw, 14px)', color: 'rgba(255,255,255,0.6)',
        fontWeight: 600, textTransform: 'capitalize', textAlign: 'center',
      }}>
        {date}
      </div>
      <div style={{
        fontSize: 'clamp(8px, 0.85vw, 11px)', color: 'rgba(255,255,255,0.25)',
        fontFamily: 'monospace', letterSpacing: '0.05em',
      }}>
        {fuseau}
      </div>
    </div>
  );
}

// ── Types internes ─────────────────────────────────────────────
interface QueueEntry {
  item: Item;
  priorite?: number;
  inventaireId?: string;
  stationId?: string;
}

// ── StationBlock ───────────────────────────────────────────────
interface StationBlockProps {
  station: { id: string; label: string; color: string; slots: Slot[]; gridCols: number; optional?: boolean };
  slotMap: Record<string, Item>;
  tempJobs: Record<string, JobTemporaire>;
  onSlotClick: (e: React.MouseEvent, slot: Slot) => void;
  allEnAttente: Item[];
  onWaitingItemClick: (e: React.MouseEvent, item: Item, garageId: string) => void;
  vehicules: VehiculeInventaire[];
  itemByInvId: Record<string, Item>;
  onSetPriorite: (inventaireId: string, stationId: string, priorite: number | undefined) => Promise<void>;
  style?: React.CSSProperties;
}

function StationBlock({ station, slotMap, tempJobs, onSlotClick, allEnAttente, onWaitingItemClick, vehicules, itemByInvId, onSetPriorite, style }: StationBlockProps) {
  const roadMapStations = GARAGE_TO_ROAD_MAP_STATIONS[station.id] ?? [];

  // File d'attente : road_map en-attente + fallback, triée par position (priorite)
  const finalQueue = useMemo((): QueueEntry[] => {
    const seenIds = new Set<string>();
    const queue: QueueEntry[] = [];

    // 1. Camions avec étape road_map 'en-attente' pour ce garage
    if (roadMapStations.length > 0) {
      for (const v of vehicules) {
        if (!v.roadMap) continue;
        const step = v.roadMap.find(s =>
          roadMapStations.includes(s.stationId) && s.statut === 'en-attente'
        );
        if (!step) continue;
        const item = itemByInvId[v.id];
        if (!item || item.etat === 'termine' || item.slotId) continue;
        seenIds.add(item.id);
        queue.push({ item, priorite: step.priorite, inventaireId: v.id, stationId: step.stationId });
      }
    }

    // 2. Fallback : logique dernierGarageId / stationActuelle pour camions sans road_map
    for (const item of allEnAttente) {
      if (seenIds.has(item.id)) continue;
      const isForThisGarage =
        item.dernierGarageId === station.id ||
        STATION_TO_GARAGE[item.stationActuelle ?? ''] === station.id;
      if (!isForThisGarage) continue;
      seenIds.add(item.id);
      queue.push({ item });
    }

    // Trier par position (priorite). Sans position → fin de liste.
    return queue.sort((a, b) => {
      if (a.priorite == null && b.priorite == null) return 0;
      if (a.priorite == null) return 1;
      if (b.priorite == null) return -1;
      return a.priorite - b.priorite;
    });
  }, [vehicules, itemByInvId, allEnAttente, station.id]);

  // Monter un camion dans la file (swap avec celui au-dessus)
  const handleMoveUp = async (idx: number) => {
    if (idx === 0) return;
    const newOrder = [...finalQueue];
    [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
    await saveNewOrder(newOrder);
  };

  // Descendre un camion dans la file (swap avec celui en-dessous)
  const handleMoveDown = async (idx: number) => {
    if (idx === finalQueue.length - 1) return;
    const newOrder = [...finalQueue];
    [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
    await saveNewOrder(newOrder);
  };

  // Réassigne les positions 1..N et sauvegarde ceux qui ont changé
  const saveNewOrder = async (newOrder: QueueEntry[]) => {
    const saves: Promise<void>[] = [];
    newOrder.forEach((entry, i) => {
      const newPrio = i + 1;
      if (entry.inventaireId && entry.stationId && entry.priorite !== newPrio) {
        saves.push(onSetPriorite(entry.inventaireId, entry.stationId, newPrio));
      }
    });
    await Promise.all(saves);
  };

  return (
    <div
      style={{
        width: '100%', height: '92%',
        background: '#161410',
        border: `1.5px solid ${station.color}40`,
        borderRadius: 8,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* En-tête */}
      <div style={{
        padding: '6px 12px',
        background: `${station.color}18`,
        borderBottom: `1px solid ${station.color}30`,
        fontFamily: 'monospace',
        fontSize: 'clamp(9px, 1vw, 13px)',
        fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
        color: station.color, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>{station.label}</span>
        {finalQueue.length > 0 && (
          <span style={{
            background: `${station.color}18`,
            color: station.color,
            border: `1px solid ${station.color}44`,
            borderRadius: 4, padding: '1px 8px',
            fontSize: 'clamp(8px, 0.85vw, 11px)', fontWeight: 700,
          }}>
            {finalQueue.length} en attente
          </span>
        )}
      </div>

      {/* Grille des slots */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: `repeat(${station.gridCols}, 1fr)`,
        gap: '6px', padding: '8px',
        minHeight: 0, overflow: 'auto',
      }}>
        {station.slots.map((slot) => (
          <SlotCardSimple
            key={slot.id}
            slot={slot}
            item={slotMap[slot.id]}
            tempJob={tempJobs[slot.id]}
            accentColor={station.color}
            onSlotClick={onSlotClick}
            isOptional={station.optional}
          />
        ))}
      </div>

      {/* File d'attente numérotée */}
      {finalQueue.length > 0 && (
        <div style={{
          borderTop: `1px solid ${station.color}33`,
          padding: '5px 8px 6px',
          flexShrink: 0,
          background: 'rgba(0,0,0,0.25)',
          maxHeight: '38%',
          overflowY: 'auto',
        }}>
          <div style={{
            fontSize: 'clamp(8px, 0.75vw, 9px)',
            fontFamily: 'monospace', fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: '#f59e0b', marginBottom: 4,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
            File d'attente
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {finalQueue.map((entry, idx) => {
              const { item } = entry;
              const rank = idx + 1;
              const couleur = item.type === 'eau' ? '#f97316' : item.type === 'client' ? '#3b82f6' : '#22c55e';
              const rankColor = positionColor(rank);
              return (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  {/* Badge de position */}
                  <span style={{
                    width: 'clamp(16px, 1.6vw, 20px)', height: 'clamp(16px, 1.6vw, 20px)',
                    borderRadius: 4, flexShrink: 0,
                    background: rankColor,
                    color: 'white', fontSize: 'clamp(8px, 0.85vw, 11px)', fontWeight: 900,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'monospace',
                  }}>
                    {rank}
                  </span>

                  {/* Chip camion */}
                  <div
                    title={item.label}
                    onClick={(e) => onWaitingItemClick(e, item, station.id)}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', gap: 4,
                      background: `${couleur}13`,
                      border: `1px solid ${couleur}44`,
                      borderRadius: 4, padding: '2px 6px',
                      cursor: item.slotId ? 'default' : 'pointer',
                      fontSize: 'clamp(9px, 0.9vw, 11px)',
                      fontFamily: 'monospace', color: couleur, fontWeight: 700,
                      opacity: item.slotId ? 0.5 : 1,
                      minWidth: 0, overflow: 'hidden',
                    }}
                    onMouseEnter={(e) => { if (!item.slotId) e.currentTarget.style.background = `${couleur}22`; }}
                    onMouseLeave={(e) => { if (!item.slotId) e.currentTarget.style.background = `${couleur}13`; }}
                  >
                    {item.type === 'eau' ? <EauIcon /> : <span style={{ fontSize: 'clamp(9px, 0.9vw, 11px)' }}>{item.type === 'client' ? '🔧' : '🏷️'}</span>}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>#{item.numero}</span>
                    {item.etatCommercial === 'vendu' && (
                      <span style={{ fontSize: 'clamp(6px, 0.65vw, 8px)', fontWeight: 700, background: '#fee2e2', color: '#dc2626', padding: '1px 2px', borderRadius: 2, flexShrink: 0 }}>VDU</span>
                    )}
                    {item.etatCommercial === 'reserve' && (
                      <span style={{ fontSize: 'clamp(6px, 0.65vw, 8px)', fontWeight: 700, background: '#fef3c7', color: '#92400e', padding: '1px 2px', borderRadius: 2, flexShrink: 0 }}>RÉS</span>
                    )}
                    {item.etatCommercial === 'location' && (
                      <span style={{ fontSize: 'clamp(6px, 0.65vw, 8px)', fontWeight: 700, background: '#ede9fe', color: '#6d28d9', padding: '1px 2px', borderRadius: 2, flexShrink: 0 }}>LOC</span>
                    )}
                  </div>

                  {/* Boutons haut/bas (seulement si on a un inventaireId pour sauvegarder) */}
                  {entry.inventaireId && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMoveUp(idx); }}
                        disabled={idx === 0}
                        title="Remonter"
                        style={{
                          background: 'none', border: 'none', padding: '1px 3px',
                          cursor: idx === 0 ? 'default' : 'pointer',
                          color: idx === 0 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.45)',
                          fontSize: 'clamp(10px, 1vw, 13px)', lineHeight: 1, flexShrink: 0,
                          transition: 'color 0.1s',
                        }}
                        onMouseEnter={e => { if (idx !== 0) e.currentTarget.style.color = 'rgba(255,255,255,0.9)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = idx === 0 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.45)'; }}
                      >▲</button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMoveDown(idx); }}
                        disabled={idx === finalQueue.length - 1}
                        title="Descendre"
                        style={{
                          background: 'none', border: 'none', padding: '1px 3px',
                          cursor: idx === finalQueue.length - 1 ? 'default' : 'pointer',
                          color: idx === finalQueue.length - 1 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.45)',
                          fontSize: 'clamp(10px, 1vw, 13px)', lineHeight: 1, flexShrink: 0,
                          transition: 'color 0.1s',
                        }}
                        onMouseEnter={e => { if (idx !== finalQueue.length - 1) e.currentTarget.style.color = 'rgba(255,255,255,0.9)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = idx === finalQueue.length - 1 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.45)'; }}
                      >▼</button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface SlotCardSimpleProps {
  slot: Slot;
  item?: Item;
  tempJob?: JobTemporaire;
  accentColor: string;
  onSlotClick: (e: React.MouseEvent, slot: Slot) => void;
  isOptional?: boolean;
}

function SlotCardSimple({ slot, item, tempJob, accentColor, onSlotClick, isOptional }: SlotCardSimpleProps) {
  const typeColor = item
    ? item.type === 'eau'    ? '#f97316'
    : item.type === 'client' ? '#3b82f6'
    : '#22c55e'
    : null;

  const borderColor = item
    ? item.etatCommercial === 'vendu'    ? '#ef4444'
    : item.etatCommercial === 'reserve'  ? '#f59e0b'
    : item.etatCommercial === 'location' ? '#7c3aed'
    : typeColor!
    : null;

  if (tempJob) {
    const cfg = TYPE_JOB_CONFIG[tempJob.typeJob];
    return (
      <div
        onClick={(e) => onSlotClick(e, slot)}
        style={{
          background: '#1e2027',
          border: '2px solid #374151',
          borderRadius: 6, padding: '8px 10px',
          cursor: 'pointer',
          display: 'flex', flexDirection: 'column', gap: 4,
          minHeight: 0, height: '100%', boxSizing: 'border-box',
          transition: 'background 0.15s, transform 0.1s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        <span style={{ fontFamily: 'monospace', fontSize: 'clamp(10px, 1.1vw, 14px)', fontWeight: 700, color: '#ff5533', lineHeight: 1 }}>
          #{slot.id}
        </span>
        <div style={{ fontSize: 'clamp(8px, 0.75vw, 10px)', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          JOB TEMP
        </div>
        <span style={{ fontSize: 'clamp(14px, 1.6vw, 20px)', lineHeight: 1 }}>
          {cfg.emoji}
        </span>
        <span style={{ fontSize: 'clamp(9px, 0.9vw, 12px)', color: 'rgba(255,255,255,0.5)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {tempJob.titre}
        </span>
      </div>
    );
  }

  return (
    <div
      onClick={(e) => onSlotClick(e, slot)}
      style={{
        background: item ? `${typeColor}15` : '#1c1a14',
        border: item
          ? `2px solid ${borderColor}`
          : slot.futur
          ? '1px dashed rgba(255,255,255,0.08)'
          : isOptional
          ? '1px dashed rgba(255, 200, 0, 0.3)'
          : '1px dashed rgba(255,255,255,0.1)',
        borderRadius: 6, padding: '8px 10px',
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: 4,
        minHeight: 0, height: '100%', boxSizing: 'border-box',
        transition: 'background 0.15s, transform 0.1s',
        opacity: slot.futur ? 0.4 : 1,
      }}
      onMouseEnter={(e) => { if (item) e.currentTarget.style.transform = 'scale(1.02)'; }}
      onMouseLeave={(e) => { if (item) e.currentTarget.style.transform = 'scale(1)'; }}
    >
      <span style={{
        fontFamily: 'monospace',
        fontSize: 'clamp(10px, 1.1vw, 14px)',
        fontWeight: 700, color: '#ff5533', lineHeight: 1,
      }}>
        #{slot.id}
      </span>

      {slot.futur ? (
        <span style={{ fontSize: 'clamp(9px, 0.85vw, 11px)', color: 'rgba(255,255,255,0.3)', marginTop: 'auto', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Futur
        </span>
      ) : item ? (
        <>
          {item.type !== 'eau' && (
            <div style={{ fontSize: 'clamp(8px, 0.75vw, 10px)', color: typeColor!, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {item.type === 'client' ? 'CLIENT' : 'DÉTAIL'}
            </div>
          )}
          <span style={{ fontFamily: 'monospace', fontSize: 'clamp(13px, 1.5vw, 18px)', fontWeight: 900, color: '#ffffff', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            {item.numero}
          </span>
          <span style={{ fontSize: 'clamp(9px, 0.9vw, 12px)', color: 'rgba(255,255,255,0.55)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.label.split(' ').slice(0, 3).join(' ')}
          </span>
          {item.type === 'eau' && (
            <div style={{
              fontSize: 'clamp(7px, 0.7vw, 9px)', fontWeight: 700,
              color: (item as any).aUnReservoir ? '#22c55e' : '#f59e0b',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {(item as any).aUnReservoir ? '💧 TANK' : '⚠️ SANS TANK'}
            </div>
          )}
          {item.urgence && (
            <div style={{ fontSize: 'clamp(7px, 0.7vw, 9px)', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ⚡ URGENT
            </div>
          )}
          {item.etatCommercial && item.etatCommercial !== 'non-vendu' && (
            <div style={{
              marginTop: 2, padding: '3px 6px', borderRadius: 4,
              border: `1.5px solid ${item.etatCommercial === 'vendu' ? '#ef4444' : item.etatCommercial === 'location' ? '#7c3aed' : '#f59e0b'}`,
              background: item.etatCommercial === 'vendu' ? '#ef444422' : item.etatCommercial === 'location' ? '#ede9fe' : '#f59e0b22',
              color: item.etatCommercial === 'vendu' ? '#ef4444' : item.etatCommercial === 'location' ? '#6d28d9' : '#f59e0b',
              fontWeight: 800, fontSize: 'clamp(7px, 0.75vw, 10px)',
              textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center',
            }}>
              {item.etatCommercial === 'vendu'
                ? `✓ VENDU${item.clientAcheteur ? ` — ${item.clientAcheteur}` : ''}`
                : item.etatCommercial === 'location'
                ? `🔑 LOCATION${item.clientAcheteur ? ` — ${item.clientAcheteur}` : ''}`
                : `🔒 RÉS.${item.clientAcheteur ? ` — ${item.clientAcheteur}` : ''}`
              }
            </div>
          )}
        </>
      ) : (
        <span style={{ fontSize: 'clamp(9px, 0.85vw, 11px)', color: 'rgba(255,255,255,0.18)', marginTop: 'auto' }}>
          Disponible
        </span>
      )}
    </div>
  );
}
