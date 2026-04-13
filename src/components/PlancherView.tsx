import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useGarage } from '../hooks/useGarage';
import { useInventaire } from '../contexts/InventaireContext';
import { supabase } from '../lib/supabase';
import { EauIcon } from './EauIcon';
import { STATIONS } from '../data/stations';
import { STATION_TO_GARAGE, SLOT_TO_GARAGE, GARAGE_TO_ROAD_MAP_STATIONS } from '../data/garageData';
import { TOUTES_STATIONS_COMMUNES } from '../data/mockData';
import { SlotAssignModal } from './SlotAssignModal';
import { SlotOccupeModal } from './SlotOccupeModal';
import { CreateWizardModal } from './CreateWizardModal';
import { RoadMapEditor } from './RoadMapEditor';
import { logJobTemporaire } from '../services/timeLogService';
import { inventaireService } from '../services/inventaireService';
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
  | { type: 'inventaire-picker'; slot: Slot; position: { x: number; y: number } }
  | { type: 'inventaire-roadmap'; slot: Slot; vehicule: VehiculeInventaire; position: { x: number; y: number } }
  | null;

export function PlancherView() {
  const {
    items,
    slotMap, enAttente, assignerSlot,
    retirerVersAttente, terminerItem,
    ajouterItem, updateStationStatus,
    terminerEtAvancer, rechargerItems,
  } = useGarage();

  const { vehicules, mettreAJourRoadMap, mettreAJourPriorites } = useInventaire();

  const [modalState, setModalState] = useState<ModalState>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [tempJobs, setTempJobs] = useState<Record<string, JobTemporaire>>({});

  // Fermer tout modal en appuyant sur Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModalState(null);
        setShowWizard(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const allEnAttente = [...enAttente.eau, ...enAttente.client, ...enAttente.detail];

  // Index inventaireId → Item pour croiser road_map et prod_items
  const itemByInvId = useMemo(() => {
    const map: Record<string, Item> = {};
    items.forEach(item => { if (item.inventaireId) map[item.inventaireId] = item; });
    return map;
  }, [items]);

  // Reorder atomique : reçoit la nouvelle liste ordonnée depuis StationBlock,
  // calcule les priorités 1..N pour chaque véhicule et sauvegarde en un seul appel
  const handleReorder = useCallback(async (newOrder: QueueEntry[]) => {
    const updatesMap = new Map<string, RoadMapEtape[]>();
    newOrder.forEach((entry, i) => {
      if (!entry.stationId || !entry.vehicule.roadMap) return;
      const vid = entry.vehicule.id;
      if (!updatesMap.has(vid)) {
        updatesMap.set(vid, entry.vehicule.roadMap.map(s => ({ ...s })));
      }
      const roadMap = updatesMap.get(vid)!;
      const stepIdx = roadMap.findIndex(s =>
        entry.stepId ? s.id === entry.stepId : s.stationId === entry.stationId
      );
      if (stepIdx >= 0) roadMap[stepIdx] = { ...roadMap[stepIdx], priorite: i + 1 };
    });
    const updates = [...updatesMap.entries()].map(([id, roadMap]) => ({ id, roadMap }));
    if (updates.length > 0) await mettreAJourPriorites(updates);
  }, [mettreAJourPriorites]);

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

  // Quand on clique sur un chip ATT (pas de prod_item) → crée le job puis ouvre le modal d'assignation
  const handleCreateAndAssign = async (e: React.MouseEvent, vehicule: VehiculeInventaire, garageId: string) => {
    e.stopPropagation();
    try {
      await inventaireService.creerProdItemDepuisVehicule(vehicule);
      // Recharge les items pour obtenir le nouveau prod_item
      const freshItems = await rechargerItems();
      const newItem = freshItems.find(i => i.inventaireId === vehicule.id && i.etat !== 'termine');
      if (!newItem) return;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const position = calculerPosition(rect);
      const station = STATIONS.find(s => s.id === garageId);
      const availableSlot = station?.slots.find(s => !slotMap[s.id] && !tempJobs[s.id]);
      if (availableSlot) {
        setModalState({ type: 'assign', slot: availableSlot, position, preSelectedItem: newItem });
      } else if (station && station.slots.length > 0) {
        setModalState({ type: 'assign', slot: station.slots[0], position, preSelectedItem: newItem });
      }
    } catch (err) {
      console.error('[PlancherView] handleCreateAndAssign error:', err);
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
        width: '100%', height: '100%',
        display: 'grid',
        gridTemplateColumns: '1fr 2fr 3fr',
        gridTemplateRows: '1fr 1fr',
        gap: '8px', padding: '8px',
        background: '#0f0e0b',
        boxSizing: 'border-box',
        overflow: 'hidden',
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

      <div style={{ gridColumn: '1', gridRow: '1', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0 }}>
        <StationBlock station={STATIONS.find((s) => s.id === 'soudure-generale')!} slotMap={slotMap} tempJobs={tempJobs} onSlotClick={handleSlotClick} allEnAttente={allEnAttente} onWaitingItemClick={handleWaitingItemClick} onCreateAndAssign={handleCreateAndAssign} vehicules={vehicules} itemByInvId={itemByInvId} onReorder={handleReorder} />
        <StationBlock station={STATIONS.find((s) => s.id === 'point-s')!} slotMap={slotMap} tempJobs={tempJobs} onSlotClick={handleSlotClick} allEnAttente={allEnAttente} onWaitingItemClick={handleWaitingItemClick} onCreateAndAssign={handleCreateAndAssign} vehicules={vehicules} itemByInvId={itemByInvId} onReorder={handleReorder} />
      </div>

      <StationBlock station={STATIONS.find((s) => s.id === 'mecanique-generale')!} slotMap={slotMap} tempJobs={tempJobs} onSlotClick={handleSlotClick} allEnAttente={allEnAttente} onWaitingItemClick={handleWaitingItemClick} vehicules={vehicules} itemByInvId={itemByInvId} onReorder={handleReorder} style={{ gridColumn: '2', gridRow: '1' }} />

      <StationBlock station={STATIONS.find((s) => s.id === 'mecanique-moteur')!} slotMap={slotMap} tempJobs={tempJobs} onSlotClick={handleSlotClick} allEnAttente={allEnAttente} onWaitingItemClick={handleWaitingItemClick} vehicules={vehicules} itemByInvId={itemByInvId} onReorder={handleReorder} style={{ gridColumn: '3', gridRow: '1' }} />

      <div style={{ gridColumn: '1', gridRow: '2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <HorlogeWidget />
      </div>

      <StationBlock station={STATIONS.find((s) => s.id === 'sous-traitants')!} slotMap={slotMap} tempJobs={tempJobs} onSlotClick={handleSlotClick} allEnAttente={allEnAttente} onWaitingItemClick={handleWaitingItemClick} vehicules={vehicules} itemByInvId={itemByInvId} onReorder={handleReorder} style={{ gridColumn: '2', gridRow: '2' }} />

      <div style={{ gridColumn: '3', gridRow: '2', display: 'flex', gap: 6, minHeight: 0 }}>
        <StationBlock station={STATIONS.find((s) => s.id === 'soudure-specialisee')!} slotMap={slotMap} tempJobs={tempJobs} onSlotClick={handleSlotClick} allEnAttente={allEnAttente} onWaitingItemClick={handleWaitingItemClick} onCreateAndAssign={handleCreateAndAssign} vehicules={vehicules} itemByInvId={itemByInvId} onReorder={handleReorder} />
        <PeintureStationBlock station={STATIONS.find((s) => s.id === 'peinture')!} />
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
          onChoisirInventaire={() => setModalState({ type: 'inventaire-picker', slot: modalState.slot, position: modalState.position })}
          itemOccupant={slotMap[modalState.slot.id]}
          onRetirerOccupant={retirerVersAttente}
          onTerminerOccupant={terminerItem}
        />
      )}

      {modalState?.type === 'inventaire-picker' && (
        <ModalInventairePicker
          slot={modalState.slot}
          position={modalState.position}
          vehicules={vehicules}
          onSelect={(v) => setModalState({ type: 'inventaire-roadmap', slot: modalState.slot, vehicule: v, position: modalState.position })}
          onClose={() => setModalState(null)}
        />
      )}

      {modalState?.type === 'inventaire-roadmap' && (
        <ModalRoadMapSlot
          slot={modalState.slot}
          vehicule={modalState.vehicule}
          position={modalState.position}
          onAssigner={async (v) => {
            try {
              const jobId = await inventaireService.creerProdItemDepuisVehicule(v);
              const freshItems = await rechargerItems();
              const newItem = freshItems.find(i => i.inventaireId === v.id && i.etat !== 'termine');
              if (newItem) assignerSlot(newItem.id, modalState.slot.id);
            } catch (err) { console.error(err); }
            setModalState(null);
          }}
          onClose={() => setModalState(null)}
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
  vehicule: VehiculeInventaire;  // toujours présent — road_map est source de vérité
  item?: Item;                   // prod_items correspondant si disponible (pour assigner slot)
  priorite?: number;
  stepId?: string;               // id de l'étape road_map
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
  onCreateAndAssign: (e: React.MouseEvent, vehicule: VehiculeInventaire, garageId: string) => Promise<void>;
  vehicules: VehiculeInventaire[];
  itemByInvId: Record<string, Item>;
  onReorder: (newOrder: QueueEntry[]) => Promise<void>;
  style?: React.CSSProperties;
}

function StationBlock({ station, slotMap, tempJobs, onSlotClick, allEnAttente, onWaitingItemClick, onCreateAndAssign, vehicules, itemByInvId, onReorder, style }: StationBlockProps) {
  const roadMapStations = GARAGE_TO_ROAD_MAP_STATIONS[station.id] ?? [];

  // File d'attente : road_map en-attente = source de vérité + fallback prod_items
  const finalQueue = useMemo((): QueueEntry[] => {
    const seenVehIds = new Set<string>();
    const seenItemIds = new Set<string>();
    const queue: QueueEntry[] = [];

    // 1. Camions avec étape road_map 'en-attente' pour ce garage (source de vérité)
    if (roadMapStations.length > 0) {
      for (const v of vehicules) {
        if (!v.roadMap) continue;
        const step = v.roadMap.find(s =>
          roadMapStations.includes(s.stationId) && s.statut === 'en-attente'
        );
        if (!step) continue;
        const item = itemByInvId[v.id];
        // Skip si déjà dans un slot (en cours de travail)
        if (item?.slotId) continue;
        if (item?.etat === 'termine') continue;
        seenVehIds.add(v.id);
        if (item) seenItemIds.add(item.id);
        queue.push({ vehicule: v, item, priorite: step.priorite, stepId: step.id, stationId: step.stationId });
      }
    }

    // 2. Fallback : prod_items en-attente sans road_map associée (trucks anciens)
    for (const item of allEnAttente) {
      if (seenItemIds.has(item.id)) continue;
      if (!item.inventaireId || seenVehIds.has(item.inventaireId)) continue;
      const isForThisGarage =
        item.dernierGarageId === station.id ||
        STATION_TO_GARAGE[item.stationActuelle ?? ''] === station.id;
      if (!isForThisGarage) continue;
      // Trouver le vehicule correspondant
      const vehicule = vehicules.find(v => v.id === item.inventaireId);
      if (!vehicule) continue;
      seenItemIds.add(item.id);
      queue.push({ vehicule, item });
    }

    // Trier par position (priorite). Sans position → fin de liste.
    return queue.sort((a, b) => {
      if (a.priorite == null && b.priorite == null) return 0;
      if (a.priorite == null) return 1;
      if (b.priorite == null) return -1;
      return a.priorite - b.priorite;
    });
  }, [vehicules, itemByInvId, allEnAttente, station.id]);

  // ── localQueue : source d'affichage locale ──────────────────────────────
  // Mis à jour IMMÉDIATEMENT lors d'un reorder (pas d'attente réseau).
  // Remis à null seulement si des items sont ajoutés/retirés de la file.
  const [localQueue, setLocalQueue] = useState<QueueEntry[] | null>(null);
  const queueSignature = finalQueue.map(e => e.vehicule.id).join('|');
  const prevSigRef = useRef(queueSignature);
  useEffect(() => {
    if (prevSigRef.current !== queueSignature) {
      prevSigRef.current = queueSignature;
      setLocalQueue(null); // nouvel item ou item retiré → réinitialiser
    }
  }, [queueSignature]);
  const displayQueue = localQueue ?? finalQueue;

  // Drag-and-drop state
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  // Badge picker
  const [pickerIdx, setPickerIdx] = useState<number | null>(null);

  // Fermer le picker si on clique ailleurs
  useEffect(() => {
    if (pickerIdx === null) return;
    const close = () => setPickerIdx(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [pickerIdx]);

  // Applique un nouvel ordre : mise à jour locale immédiate + save DB en arrière-plan
  const applyReorder = (newOrder: QueueEntry[]) => {
    setLocalQueue(newOrder);
    onReorder(newOrder); // fire-and-forget, pas d'await → pas de blocage UI
  };

  // Monter d'un rang
  const handleMoveUp = (idx: number) => {
    if (idx === 0) return;
    const newOrder = [...displayQueue];
    [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
    applyReorder(newOrder);
  };

  // Descendre d'un rang
  const handleMoveDown = (idx: number) => {
    if (idx === displayQueue.length - 1) return;
    const newOrder = [...displayQueue];
    [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
    applyReorder(newOrder);
  };

  // Drag-and-drop
  const handleDrop = (dropIdx: number) => {
    if (dragIdx === null || dragIdx === dropIdx) {
      setDragIdx(null); setDragOverIdx(null); return;
    }
    const newOrder = [...displayQueue];
    const [moved] = newOrder.splice(dragIdx, 1);
    newOrder.splice(dropIdx, 0, moved);
    setDragIdx(null); setDragOverIdx(null);
    applyReorder(newOrder);
  };

  // Picker : sauter directement à une position
  const handlePickerMove = (fromIdx: number, toIdx: number) => {
    setPickerIdx(null);
    if (fromIdx === toIdx) return;
    const newOrder = [...displayQueue];
    const [moved] = newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, moved);
    applyReorder(newOrder);
  };

  return (
    <div
      style={{
        width: '100%', height: '100%',
        background: '#161410',
        border: `1.5px solid ${station.color}40`,
        borderRadius: 8,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        minHeight: 0,
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
        {displayQueue.length > 0 && (
          <span style={{
            background: `${station.color}18`,
            color: station.color,
            border: `1px solid ${station.color}44`,
            borderRadius: 4, padding: '1px 8px',
            fontSize: 'clamp(8px, 0.85vw, 11px)', fontWeight: 700,
          }}>
            {displayQueue.length} en attente
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
      {displayQueue.length > 0 && (
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
            {displayQueue.map((entry, idx) => {
              const { vehicule, item } = entry;
              const rank = idx + 1;
              const couleur = vehicule.type === 'eau' ? '#f97316' : vehicule.type === 'client' ? '#3b82f6' : '#22c55e';
              const rankColor = positionColor(rank);
              const inSlot = !!item?.slotId;
              const label = item?.label ?? (vehicule.type === 'client'
                ? (vehicule.nomClient ?? vehicule.vehicule ?? vehicule.numero)
                : `${vehicule.marque ?? ''} ${vehicule.modele ?? ''} ${vehicule.annee ?? ''}`.trim() || vehicule.numero);
              const etatCommercial = item?.etatCommercial ?? vehicule.etatCommercial;
              const entryKey = entry.stepId ?? `${vehicule.id}-${entry.stationId ?? idx}`;
              const isDragging = dragIdx === idx;
              const isOver = dragOverIdx === idx && dragIdx !== null && dragIdx !== idx;
              const canDrag = true; // tous les items sont draggables
              return (
                <div
                  key={entryKey}
                  draggable={canDrag}
                  onDragStart={() => { if (canDrag) { setDragIdx(idx); setDragOverIdx(null); } }}
                  onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                  onDragOver={(e) => { if (canDrag || dragIdx !== null) { e.preventDefault(); setDragOverIdx(idx); } }}
                  onDragLeave={() => setDragOverIdx(null)}
                  onDrop={() => handleDrop(idx)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    opacity: isDragging ? 0.4 : 1,
                    borderTop: isOver && dragIdx !== null && dragIdx > idx ? '2px solid #f59e0b' : '2px solid transparent',
                    borderBottom: isOver && dragIdx !== null && dragIdx < idx ? '2px solid #f59e0b' : '2px solid transparent',
                    transition: 'opacity 0.1s',
                    cursor: canDrag ? 'grab' : 'default',
                  }}
                >
                  {/* Badge de position — clic pour choisir la position directement */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <span
                      onClick={(e) => { e.stopPropagation(); setPickerIdx(pickerIdx === idx ? null : idx); }}
                      style={{
                        width: 'clamp(16px, 1.6vw, 20px)', height: 'clamp(16px, 1.6vw, 20px)',
                        borderRadius: 4,
                        background: rankColor,
                        color: 'white', fontSize: 'clamp(8px, 0.85vw, 11px)', fontWeight: 900,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'monospace',
                        cursor: 'pointer',
                        outline: pickerIdx === idx ? `2px solid ${rankColor}` : 'none',
                        outlineOffset: 1,
                      }}
                    >
                      {rank}
                    </span>
                    {/* Mini picker de position */}
                    {pickerIdx === idx && (
                      <div
                        onClick={e => e.stopPropagation()}
                        style={{
                          position: 'absolute', top: '110%', left: 0, zIndex: 60,
                          background: '#1a1a1a', border: '1px solid #f59e0b66',
                          borderRadius: 6, padding: '3px',
                          display: 'flex', flexDirection: 'column', gap: 1,
                          minWidth: 28, boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                        }}
                      >
                        {displayQueue.map((_, pos) => (
                          <button
                            key={pos}
                            onClick={() => handlePickerMove(idx, pos)}
                            style={{
                              background: pos === idx ? `${positionColor(pos+1)}33` : 'transparent',
                              border: 'none',
                              color: pos === idx ? positionColor(pos+1) : 'rgba(255,255,255,0.65)',
                              padding: '3px 6px', borderRadius: 4,
                              cursor: 'pointer',
                              fontSize: 'clamp(9px, 0.9vw, 11px)',
                              fontWeight: pos === idx ? 900 : 400,
                              fontFamily: 'monospace',
                              textAlign: 'center',
                            }}
                          >
                            {pos + 1}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Chip camion */}
                  <div
                    title={label}
                    onClick={(e) => {
                      if (item && !inSlot) onWaitingItemClick(e, item, station.id);
                      else if (!item) onCreateAndAssign(e, vehicule, station.id);
                    }}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', gap: 4,
                      background: `${couleur}13`,
                      border: `1px solid ${couleur}44`,
                      borderRadius: 4, padding: '2px 6px',
                      cursor: (!inSlot) ? 'pointer' : 'default',
                      fontSize: 'clamp(9px, 0.9vw, 11px)',
                      fontFamily: 'monospace', color: couleur, fontWeight: 700,
                      opacity: inSlot ? 0.5 : 1,
                      minWidth: 0, overflow: 'hidden',
                    }}
                    onMouseEnter={(e) => { if (!inSlot) e.currentTarget.style.background = `${couleur}22`; }}
                    onMouseLeave={(e) => { if (!inSlot) e.currentTarget.style.background = `${couleur}13`; }}
                  >
                    {vehicule.type === 'eau' ? <EauIcon /> : <span style={{ fontSize: 'clamp(9px, 0.9vw, 11px)' }}>{vehicule.type === 'client' ? '🔧' : '🏷️'}</span>}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>#{vehicule.numero}</span>
                    {!item && (
                      <span style={{ fontSize: 'clamp(6px, 0.65vw, 8px)', fontWeight: 700, background: '#fef9c3', color: '#854d0e', padding: '1px 2px', borderRadius: 2, flexShrink: 0 }}>ATT</span>
                    )}
                    {etatCommercial === 'vendu' && (
                      <span style={{ fontSize: 'clamp(6px, 0.65vw, 8px)', fontWeight: 700, background: '#fee2e2', color: '#dc2626', padding: '1px 2px', borderRadius: 2, flexShrink: 0 }}>VDU</span>
                    )}
                    {etatCommercial === 'reserve' && (
                      <span style={{ fontSize: 'clamp(6px, 0.65vw, 8px)', fontWeight: 700, background: '#fef3c7', color: '#92400e', padding: '1px 2px', borderRadius: 2, flexShrink: 0 }}>RÉS</span>
                    )}
                    {etatCommercial === 'location' && (
                      <span style={{ fontSize: 'clamp(6px, 0.65vw, 8px)', fontWeight: 700, background: '#ede9fe', color: '#6d28d9', padding: '1px 2px', borderRadius: 2, flexShrink: 0 }}>LOC</span>
                    )}
                  </div>

                  {/* Boutons ▲▼ — sur TOUS les items */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleMoveUp(idx); }}
                    title="Remonter"
                    style={{
                      background: 'none', border: 'none', padding: '1px 3px',
                      cursor: 'pointer',
                      color: 'rgba(255,255,255,0.45)',
                      fontSize: 'clamp(10px, 1vw, 13px)', lineHeight: 1, flexShrink: 0,
                      transition: 'color 0.1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.9)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}
                  >▲</button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleMoveDown(idx); }}
                    title="Descendre"
                    style={{
                      background: 'none', border: 'none', padding: '1px 3px',
                      cursor: 'pointer',
                      color: 'rgba(255,255,255,0.45)',
                      fontSize: 'clamp(10px, 1vw, 13px)', lineHeight: 1, flexShrink: 0,
                      transition: 'color 0.1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.9)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}
                  >▼</button>
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
          <span style={{ fontFamily: 'monospace', fontSize: 'clamp(20px, 2.5vw, 32px)', fontWeight: 900, color: '#ffffff', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
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

// ── ModalInventairePicker ─────────────────────────────────────────────────────
function ModalInventairePicker({ slot, position, vehicules, onSelect, onClose }: {
  slot: Slot;
  position: { x: number; y: number };
  vehicules: VehiculeInventaire[];
  onSelect: (v: VehiculeInventaire) => void;
  onClose: () => void;
}) {
  const [recherche, setRecherche] = useState('');
  const q = recherche.trim().toLowerCase();

  const liste = vehicules
    .filter(v => v.statut !== 'archive')
    .filter(v => !q || [v.numero, v.marque, v.modele, v.annee?.toString(), v.nomClient]
      .filter(Boolean).join(' ').toLowerCase().includes(q))
    .sort((a, b) => a.numero.localeCompare(b.numero));

  const tc = (t: string) => t === 'eau' ? '#f97316' : t === 'client' ? '#3b82f6' : '#22c55e';
  const ti = (t: string) => t === 'eau' ? '💧' : t === 'client' ? '🔧' : '🏷️';

  return (
    <div onClick={e => e.stopPropagation()} style={{
      position: 'fixed', top: position.y, left: position.x, zIndex: 200,
      background: '#1a1814', border: '1px solid rgba(99,179,237,0.4)',
      borderRadius: 12, padding: 16, width: 340,
      boxShadow: '0 8px 32px rgba(0,0,0,0.7)', maxHeight: '75vh',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ fontFamily: 'monospace', color: '#63b3ed', fontWeight: 700, marginBottom: 4, fontSize: 13 }}>
        📋 Inventaire — Slot {slot.id}
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>
        Choisir un camion pour configurer son road map et l'état
      </div>
      <input autoFocus type="text" value={recherche} onChange={e => setRecherche(e.target.value)}
        placeholder="# numéro, marque, client..."
        style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: 'white', fontSize: 12, outline: 'none', boxSizing: 'border-box', marginBottom: 10 }}
      />
      <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {liste.length === 0 && (
          <div style={{ color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: 20, fontSize: 12 }}>Aucun véhicule trouvé</div>
        )}
        {liste.map(v => (
          <div key={v.id} onClick={() => onSelect(v)} style={{
            padding: '9px 12px', borderRadius: 7, cursor: 'pointer',
            background: `${tc(v.type)}10`, border: `1px solid ${tc(v.type)}35`, transition: 'background 0.12s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = `${tc(v.type)}22`)}
          onMouseLeave={e => (e.currentTarget.style.background = `${tc(v.type)}10`)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{ti(v.type)}</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: tc(v.type), fontSize: 13 }}>#{v.numero}</span>
              {v.estPret && <span style={{ fontSize: 9, background: '#dcfce7', color: '#166534', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>PRÊT</span>}
              {v.statut === 'en-production' && <span style={{ fontSize: 9, background: '#fff7ed', color: '#c2410c', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>EN PROD</span>}
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                {(v.roadMap ?? []).length} étape{(v.roadMap ?? []).length !== 1 ? 's' : ''}
              </span>
            </div>
            {(v.marque || v.modele || v.nomClient) && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>
                {[v.marque, v.modele, v.annee, v.nomClient ? `· ${v.nomClient}` : ''].filter(Boolean).join(' ')}
              </div>
            )}
          </div>
        ))}
      </div>
      <button onClick={onClose} style={{ width: '100%', marginTop: 10, padding: '6px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 12 }}>
        Annuler
      </button>
    </div>
  );
}

// ── ModalRoadMapSlot ──────────────────────────────────────────────────────────
function ModalRoadMapSlot({ slot, vehicule, position, onAssigner, onClose }: {
  slot: Slot;
  vehicule: VehiculeInventaire;
  position: { x: number; y: number };
  onAssigner: (v: VehiculeInventaire) => void;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const typeColor = vehicule.type === 'eau' ? '#f97316' : vehicule.type === 'client' ? '#3b82f6' : '#22c55e';

  const handleAssigner = async () => {
    setSaving(true);
    try { await onAssigner(vehicule); }
    finally { setSaving(false); }
  };

  return (
    <div onClick={e => e.stopPropagation()} style={{
      position: 'fixed',
      top: Math.min(position.y, window.innerHeight - 640),
      left: Math.min(position.x, window.innerWidth - 420),
      zIndex: 200,
      background: '#1a1814', border: `1px solid ${typeColor}55`,
      borderRadius: 12, padding: 16, width: 400,
      boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
      maxHeight: '82vh', overflowY: 'auto',
    }}>
      <div style={{ fontFamily: 'monospace', color: typeColor, fontWeight: 700, marginBottom: 4, fontSize: 13 }}>
        🗺️ Road Map — #{vehicule.numero} → Slot {slot.id}
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 14 }}>
        {[vehicule.marque, vehicule.modele, vehicule.annee].filter(Boolean).join(' ')}
        {vehicule.nomClient ? ` · ${vehicule.nomClient}` : ''}
      </div>
      <div style={{ background: 'white', borderRadius: 10, padding: 14, marginBottom: 14 }}>
        <RoadMapEditor vehicule={vehicule} onSaved={() => {}} compact={false} />
      </div>
      <button onClick={handleAssigner} disabled={saving} style={{
        width: '100%', padding: '12px', borderRadius: 8, border: 'none',
        background: saving ? '#374151' : typeColor, color: 'white',
        fontWeight: 700, fontSize: 14, cursor: saving ? 'wait' : 'pointer', marginBottom: 6,
      }}>
        {saving ? '⏳ Assignation...' : `✓ Assigner au Slot ${slot.id}`}
      </button>
      <button onClick={onClose} style={{ width: '100%', padding: '6px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 12 }}>
        Annuler
      </button>
    </div>
  );
}

// ── PeintureStationBlock ──────────────────────────────────────────────────────
// La station Peinture gère exclusivement des réservoirs (prod_reservoirs),
// pas des camions. Chaque slot peut accueillir un réservoir en peinture.

interface ReservoirSlotInfo {
  id: string;
  numero: string;
  type: string;
}

type PeintureModal =
  | { type: 'assigner'; slot: Slot; position: { x: number; y: number } }
  | { type: 'occupe';   slot: Slot; reservoir: ReservoirSlotInfo; position: { x: number; y: number } }
  | null;

function PeintureStationBlock({
  station,
  style,
}: {
  station: { id: string; label: string; color: string; slots: Slot[]; gridCols: number; optional?: boolean };
  style?: React.CSSProperties;
}) {
  const [peintureSlots, setPeintureSlots] = useState<Record<string, ReservoirSlotInfo>>({});
  const [dispos, setDispos] = useState<ReservoirSlotInfo[]>([]);
  const [modal, setModal] = useState<PeintureModal>(null);

  // Fermer le modal peinture avec Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setModal(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const charger = async () => {
    const { data: enPeinture } = await supabase
      .from('prod_reservoirs')
      .select('id, numero, type, slot_id')
      .eq('etat', 'en-peinture');

    const map: Record<string, ReservoirSlotInfo> = {};
    (enPeinture ?? []).forEach((r: any) => {
      if (r.slot_id) map[r.slot_id] = { id: r.id, numero: r.numero, type: r.type };
    });
    setPeintureSlots(map);

    const { data: disponibles } = await supabase
      .from('prod_reservoirs')
      .select('id, numero, type')
      .eq('etat', 'disponible')
      .order('numero', { ascending: true });
    setDispos((disponibles ?? []).map((r: any) => ({ id: r.id, numero: r.numero, type: r.type })));
  };

  useEffect(() => { charger(); }, []);

  const handleSlotClick = (e: React.MouseEvent, slot: Slot) => {
    e.stopPropagation();
    if (slot.futur) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const MODAL_W = 300;
    const MODAL_H = Math.min(480, window.innerHeight * 0.7); // adaptive height estimate
    const MARGIN = 12;
    // Préférer à gauche du slot si pas assez de place à droite
    let x = rect.right + MARGIN;
    if (x + MODAL_W > window.innerWidth - MARGIN) x = rect.left - MODAL_W - MARGIN;
    if (x < MARGIN) x = MARGIN;
    // Aligner en haut du slot, mais garantir que le modal reste dans l'écran
    let y = rect.top;
    if (y + MODAL_H > window.innerHeight - MARGIN) y = window.innerHeight - MODAL_H - MARGIN;
    if (y < MARGIN) y = MARGIN;

    const reservoir = peintureSlots[slot.id];
    if (reservoir) {
      setModal({ type: 'occupe', slot, reservoir, position: { x, y } });
    } else {
      setModal({ type: 'assigner', slot, position: { x, y } });
    }
  };

  const assignerReservoir = async (reservoirId: string, slotId: string) => {
    await supabase
      .from('prod_reservoirs')
      .update({ etat: 'en-peinture', slot_id: slotId, updated_at: new Date().toISOString() })
      .eq('id', reservoirId);
    await charger();
    setModal(null);
  };

  const retirerReservoir = async (reservoirId: string) => {
    await supabase
      .from('prod_reservoirs')
      .update({ etat: 'disponible', slot_id: null, updated_at: new Date().toISOString() })
      .eq('id', reservoirId);
    await charger();
    setModal(null);
  };

  const PEINTURE_COLOR = '#94a3b8';

  return (
    <div
      onClick={() => setModal(null)}
      style={{
        width: '100%', height: '100%',
        background: '#161410',
        border: `1.5px solid ${PEINTURE_COLOR}40`,
        borderRadius: 8,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        minHeight: 0,
        ...style,
      }}
    >
      {/* En-tête */}
      <div style={{
        padding: '6px 12px',
        background: `${PEINTURE_COLOR}18`,
        borderBottom: `1px solid ${PEINTURE_COLOR}30`,
        fontFamily: 'monospace',
        fontSize: 'clamp(9px, 1vw, 13px)',
        fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
        color: PEINTURE_COLOR, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>{station.label}</span>
        <span style={{
          fontSize: 'clamp(7px, 0.75vw, 9px)', color: `${PEINTURE_COLOR}88`,
          fontWeight: 500, letterSpacing: '0.05em',
        }}>
          RÉSERVOIRS
        </span>
      </div>

      {/* Grille des slots */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: `repeat(${station.gridCols}, 1fr)`,
        gap: '6px', padding: '8px',
        minHeight: 0, overflow: 'auto',
      }}>
        {station.slots.map((slot) => {
          const reservoir = peintureSlots[slot.id];
          return (
            <div
              key={slot.id}
              onClick={(e) => handleSlotClick(e, slot)}
              style={{
                background: reservoir ? `${PEINTURE_COLOR}18` : '#1c1a14',
                border: reservoir
                  ? `2px solid ${PEINTURE_COLOR}`
                  : slot.futur
                  ? '1px dashed rgba(255,255,255,0.08)'
                  : '1px dashed rgba(255,255,255,0.1)',
                borderRadius: 6, padding: '8px 10px',
                cursor: slot.futur ? 'default' : 'pointer',
                display: 'flex', flexDirection: 'column', gap: 4,
                minHeight: 0, height: '100%', boxSizing: 'border-box',
                transition: 'background 0.15s, transform 0.1s',
                opacity: slot.futur ? 0.4 : 1,
              }}
              onMouseEnter={(e) => { if (!slot.futur) e.currentTarget.style.transform = 'scale(1.02)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
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
              ) : reservoir ? (
                <>
                  <div style={{ fontSize: 'clamp(8px, 0.75vw, 10px)', color: PEINTURE_COLOR, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    🎨 RÉSERVOIR
                  </div>
                  <span style={{ fontFamily: 'monospace', fontSize: 'clamp(20px, 2.5vw, 32px)', fontWeight: 900, color: '#ffffff', lineHeight: 1.1 }}>
                    #{reservoir.numero}
                  </span>
                  <span style={{ fontSize: 'clamp(9px, 0.9vw, 11px)', color: 'rgba(255,255,255,0.5)', lineHeight: 1.3 }}>
                    {reservoir.type}
                  </span>
                </>
              ) : (
                <span style={{ fontSize: 'clamp(9px, 0.85vw, 11px)', color: 'rgba(255,255,255,0.18)', marginTop: 'auto', textAlign: 'center' }}>
                  + Réservoir
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal: assigner un réservoir au slot */}
      {modal?.type === 'assigner' && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed', top: modal.position.y, left: modal.position.x, zIndex: 300,
            background: '#1a1814', border: `1px solid ${PEINTURE_COLOR}55`,
            borderRadius: 10, padding: 16, width: 290,
            boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
            maxHeight: 'min(480px, 70vh)',
            display: 'flex', flexDirection: 'column',
          }}
        >
          <div style={{ fontFamily: 'monospace', color: PEINTURE_COLOR, fontWeight: 700, marginBottom: 4, fontSize: 13 }}>
            🎨 Slot {modal.slot.id} — Peinture
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 12 }}>
            Choisir un réservoir à peindre
          </div>
          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {dispos.length === 0 ? (
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center', padding: '16px 0' }}>
                Aucun réservoir disponible
              </div>
            ) : (
              dispos.map(r => (
                <div
                  key={r.id}
                  onClick={() => assignerReservoir(r.id, modal.slot.id)}
                  style={{
                    padding: '10px 12px', borderRadius: 7,
                    background: `${PEINTURE_COLOR}12`,
                    border: `1px solid ${PEINTURE_COLOR}30`,
                    cursor: 'pointer', transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = `${PEINTURE_COLOR}22`)}
                  onMouseLeave={e => (e.currentTarget.style.background = `${PEINTURE_COLOR}12`)}
                >
                  <div style={{ fontFamily: 'monospace', fontWeight: 700, color: PEINTURE_COLOR, fontSize: 13 }}>
                    #{r.numero}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{r.type}</div>
                </div>
              ))
            )}
          </div>
          <button
            onClick={() => setModal(null)}
            style={{ width: '100%', marginTop: 10, padding: '6px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 12 }}
          >
            Annuler
          </button>
        </div>
      )}

      {/* Modal: slot occupé par un réservoir */}
      {modal?.type === 'occupe' && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed', top: modal.position.y, left: modal.position.x, zIndex: 300,
            background: '#1a1814', border: `1px solid ${PEINTURE_COLOR}`,
            borderRadius: 10, padding: 16, width: 280,
            boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
          }}
        >
          <div style={{ fontFamily: 'monospace', color: PEINTURE_COLOR, fontWeight: 700, marginBottom: 8, fontSize: 13 }}>
            🎨 Slot {modal.slot.id} — En peinture
          </div>
          <div style={{
            padding: '10px 12px', borderRadius: 8,
            background: `${PEINTURE_COLOR}12`,
            border: `1px solid ${PEINTURE_COLOR}30`,
            marginBottom: 14,
          }}>
            <div style={{ fontFamily: 'monospace', fontWeight: 900, color: 'white', fontSize: 16 }}>
              #{modal.reservoir.numero}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
              {modal.reservoir.type}
            </div>
          </div>
          <button
            onClick={() => retirerReservoir(modal.reservoir.id)}
            style={{ width: '100%', marginBottom: 8, padding: '10px', background: '#f59e0b', border: 'none', borderRadius: 7, color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
          >
            ↩ Retirer du slot
          </button>
          <button
            onClick={() => retirerReservoir(modal.reservoir.id)}
            style={{ width: '100%', marginBottom: 8, padding: '10px', background: '#22c55e', border: 'none', borderRadius: 7, color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
          >
            ✓ Peinture terminée
          </button>
          <button
            onClick={() => setModal(null)}
            style={{ width: '100%', padding: '6px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 12 }}
          >
            Fermer
          </button>
        </div>
      )}
    </div>
  );
}
