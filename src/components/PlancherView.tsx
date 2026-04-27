import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useGarage } from '../hooks/useGarage';
import { useInventaire } from '../contexts/InventaireContext';
import { supabase } from '../lib/supabase';
import { EauIcon } from './EauIcon';
import { STATIONS } from '../data/stations';
import { STATION_TO_GARAGE, SLOT_TO_GARAGE, GARAGE_TO_ROAD_MAP_STATIONS } from '../data/garageData';
import { TOUTES_STATIONS_COMMUNES } from '../data/mockData';
import { ROAD_MAP_STATIONS } from '../data/etapes';
import { SlotAssignModal } from './SlotAssignModal';
import { SlotOccupeModal } from './SlotOccupeModal';
import { CreateWizardModal } from './CreateWizardModal';
import { PanneauDetailVehicule } from './PanneauDetailVehicule';
import { logJobTemporaire } from '../services/timeLogService';
import { inventaireService } from '../services/inventaireService';
import { reservoirService } from '../services/reservoirService';
import { photoService } from '../services/photoService';
import type { Slot, Item, Document } from '../types/item.types';
import type { VehiculeInventaire, RoadMapEtape } from '../types/inventaireTypes';

// Types de jobs temporaires — persistés dans prod_items comme les autres jobs
const TYPES_JOB_TEMP = ['export', 'demantelement', 'autres'] as const;

const TYPE_JOB_CONFIG = {
  export:        { label: 'Camion export',        emoji: '🚛', color: '#475569' },
  demantelement: { label: 'Démantèlement pièces',  emoji: '🔧', color: '#374151' },
  autres:        { label: 'Autres travaux',         emoji: '📋', color: '#1f2937' },
} as const;

// Couleur du badge de position selon le rang
const positionColor = (rank: number) =>
  rank === 1 ? '#ef4444' : rank === 2 ? '#f97316' : rank === 3 ? '#f59e0b' : '#6b7280';

type TypeJobTemp = 'export' | 'demantelement' | 'autres';

type ModalState =
  | { type: 'assign'; slot: Slot; position: { x: number; y: number }; preSelectedItem?: Item }
  | { type: 'occupe'; item: Item; slot: Slot; position: { x: number; y: number } }
  | { type: 'job-type'; slot: Slot; position: { x: number; y: number } }
  | { type: 'job-titre'; slot: Slot; typeJob: TypeJobTemp; position: { x: number; y: number } }
  | { type: 'job-occupe'; item: Item; slot: Slot; position: { x: number; y: number } }
  | { type: 'inventaire-picker'; slot: Slot; position: { x: number; y: number } }
  | { type: 'inventaire-roadmap'; slot: Slot; vehicule: VehiculeInventaire; position: { x: number; y: number } }
  | { type: 'detail'; vehiculeId: string; itemId?: string }
  | null;

export function PlancherView({ showWizard = false, setShowWizard }: { showWizard?: boolean; setShowWizard?: (v: boolean) => void }) {
  const {
    items,
    slotMap, enAttente, assignerSlot,
    retirerVersAttente, terminerItem,
    ajouterItem, updateStationStatus,
    terminerEtAvancer, rechargerItems,
  } = useGarage();

  const { vehicules, mettreAJourRoadMap, mettreAJourPriorites } = useInventaire();

  const [modalState, setModalState] = useState<ModalState>(null);
  // showWizard/setShowWizard viennent des props (levés dans App.tsx)
  const _setShowWizard = setShowWizard ?? (() => {});

  // Fermer tout modal en appuyant sur Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModalState(null);
        _setShowWizard(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const allEnAttente = [...enAttente.eau, ...enAttente.client, ...enAttente.detail];

  // Index vehiculeId → Item pour croiser road_map et prod_items
  // Mappe par inventaireId ET par item.id (pour les orphelins sans inventaireId)
  const itemByInvId = useMemo(() => {
    const map: Record<string, Item> = {};
    items.forEach(item => {
      if (item.inventaireId) map[item.inventaireId] = item;
      else map[item.id] = item; // Orphelin: le véhicule synthétique a id = item.id
    });
    return map;
  }, [items]);

  // Véhicules COMPLETS : prod_inventaire + items orphelins (prod_items sans prod_inventaire)
  // Identique à la logique de VueAsana — même source de données partout
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

  const isTempJobType = (type: string) => type === 'export' || type === 'demantelement' || type === 'autres';

  const handleSlotClick = (e: React.MouseEvent, slot: Slot) => {
    e.stopPropagation();
    const item = slotMap[slot.id];
    const rect = e.currentTarget.getBoundingClientRect();
    const position = calculerPosition(rect);
    if (item && isTempJobType(item.type)) {
      // Job temporaire → modal spécifique avec durée et bouton vider
      setModalState({ type: 'job-occupe', item, slot, position });
    } else if (item) {
      // Job normal → panneau détail unifié
      setModalState({ type: 'detail', vehiculeId: item.inventaireId || item.id, itemId: item.id });
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
    const availableSlot = station?.slots.find((s) => !slotMap[s.id]);
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
      const availableSlot = station?.slots.find(s => !slotMap[s.id]);
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

  const handleJobTypeSelect = (typeJob: TypeJobTemp) => {
    if (modalState?.type !== 'job-type') return;
    setModalState({ type: 'job-titre', slot: modalState.slot, typeJob, position: modalState.position });
  };

  const handleJobTitreConfirm = async (titre: string) => {
    if (modalState?.type !== 'job-titre') return;
    const { slot, typeJob } = modalState;
    const garageId = SLOT_TO_GARAGE[slot.id] ?? '';
    const now = new Date().toISOString();
    const cfg = TYPE_JOB_CONFIG[typeJob];
    const item: Item = {
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: typeJob,
      etat: 'en-slot',
      numero: titre.trim() || cfg.label,
      label: `${cfg.emoji} ${titre.trim() || cfg.label}`,
      slotId: slot.id,
      dateCreation: now,
      dateEntreeSlot: now,
      dernierGarageId: garageId,
      dernierSlotId: slot.id,
      stationsActives: [],
      progression: [],
    };
    try {
      await ajouterItem(item);
      setModalState(null);
    } catch (err: any) {
      console.error('[PlancherView] Erreur création job temporaire:', err);
      alert(`Erreur création job temporaire: ${err?.message ?? err}`);
      setModalState(null);
    }
  };

  const handleViderSlot = async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (item) {
      // Log le temps dans prod_time_logs
      await logJobTemporaire({
        typeJob: item.type,
        titre: item.numero,
        garageId: item.dernierGarageId ?? '',
        slotId: item.slotId ?? '',
        heureEntree: item.dateEntreeSlot ?? item.dateCreation,
      });
      // Terminer le job (libère le slot)
      terminerItem(item.id);
    }
    setModalState(null);
  };

  const handleOpenDetail = (vehiculeId: string) => {
    setModalState({ type: 'detail', vehiculeId });
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
      <div style={{ gridColumn: '1', gridRow: '1', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0 }}>
        <StationBlock station={STATIONS.find((s) => s.id === 'soudure-generale')!} slotMap={slotMap} onSlotClick={handleSlotClick} allEnAttente={allEnAttente} onWaitingItemClick={handleWaitingItemClick} onCreateAndAssign={handleCreateAndAssign} vehicules={vehiculesComplets} itemByInvId={itemByInvId} onReorder={handleReorder} onOpenDetail={handleOpenDetail} />
        <StationBlock station={STATIONS.find((s) => s.id === 'point-s')!} slotMap={slotMap} onSlotClick={handleSlotClick} allEnAttente={allEnAttente} onWaitingItemClick={handleWaitingItemClick} onCreateAndAssign={handleCreateAndAssign} vehicules={vehiculesComplets} itemByInvId={itemByInvId} onReorder={handleReorder} onOpenDetail={handleOpenDetail} />
      </div>

      <StationBlock station={STATIONS.find((s) => s.id === 'mecanique-generale')!} slotMap={slotMap} onSlotClick={handleSlotClick} allEnAttente={allEnAttente} onWaitingItemClick={handleWaitingItemClick} vehicules={vehiculesComplets} itemByInvId={itemByInvId} onReorder={handleReorder} onOpenDetail={handleOpenDetail} style={{ gridColumn: '2', gridRow: '1' }} />

      <StationBlock station={STATIONS.find((s) => s.id === 'mecanique-moteur')!} slotMap={slotMap} onSlotClick={handleSlotClick} allEnAttente={allEnAttente} onWaitingItemClick={handleWaitingItemClick} vehicules={vehiculesComplets} itemByInvId={itemByInvId} onReorder={handleReorder} onOpenDetail={handleOpenDetail} style={{ gridColumn: '3', gridRow: '1' }} />

      <StationBlock station={STATIONS.find((s) => s.id === 'sous-traitants')!} slotMap={slotMap} onSlotClick={handleSlotClick} allEnAttente={allEnAttente} onWaitingItemClick={handleWaitingItemClick} vehicules={vehiculesComplets} itemByInvId={itemByInvId} onReorder={handleReorder} onOpenDetail={handleOpenDetail} style={{ gridColumn: '1 / 3', gridRow: '2' }} />

      <div style={{ gridColumn: '3', gridRow: '2', display: 'flex', gap: 6, minHeight: 0 }}>
        <StationBlock station={STATIONS.find((s) => s.id === 'soudure-specialisee')!} slotMap={slotMap} onSlotClick={handleSlotClick} allEnAttente={allEnAttente} onWaitingItemClick={handleWaitingItemClick} onCreateAndAssign={handleCreateAndAssign} vehicules={vehiculesComplets} itemByInvId={itemByInvId} onReorder={handleReorder} onOpenDetail={handleOpenDetail} />
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
          item={modalState.item}
          slot={modalState.slot}
          position={modalState.position}
          onVider={() => handleViderSlot(modalState.item.id)}
          onClose={() => setModalState(null)}
        />
      )}

      {/* Panneau détail véhicule — composant UNIQUE partagé avec VueAsana */}
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

      {showWizard && (
        <CreateWizardModal
          onClose={() => _setShowWizard(false)}
          onCreate={(item) => ajouterItem(item as Item)}
        />
      )}
    </div>
  );
}

function ModalJobType({ slot, position, onSelect, onClose }: {
  slot: Slot;
  position: { x: number; y: number };
  onSelect: (type: TypeJobTemp) => void;
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
        {(Object.entries(TYPE_JOB_CONFIG) as [TypeJobTemp, typeof TYPE_JOB_CONFIG[keyof typeof TYPE_JOB_CONFIG]][]).map(([key, cfg]) => (
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
  typeJob: TypeJobTemp;
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

function ModalJobOccupe({ item, slot, position, onVider, onClose }: {
  item: Item;
  slot: Slot;
  position: { x: number; y: number };
  onVider: () => void;
  onClose: () => void;
}) {
  const cfg = TYPE_JOB_CONFIG[item.type as keyof typeof TYPE_JOB_CONFIG] ?? { label: item.type, emoji: '📋', color: '#6b7280' };
  const entree = item.dateEntreeSlot ?? item.dateCreation;
  const dureeMin = Math.round((Date.now() - new Date(entree).getTime()) / 60000);
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
        Slot {slot.id} — {cfg.label}
      </div>
      <div style={{
        padding: '12px 14px', borderRadius: 8, marginBottom: 14,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.9)', marginBottom: 4 }}>
          {cfg.emoji} {item.numero}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 2 }}>
          {cfg.label}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
          Depuis {new Date(entree).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })} — {dureeLabel}
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
  onSlotClick: (e: React.MouseEvent, slot: Slot) => void;
  allEnAttente: Item[];
  onWaitingItemClick: (e: React.MouseEvent, item: Item, garageId: string) => void;
  onCreateAndAssign: (e: React.MouseEvent, vehicule: VehiculeInventaire, garageId: string) => Promise<void>;
  vehicules: VehiculeInventaire[];
  itemByInvId: Record<string, Item>;
  onReorder: (newOrder: QueueEntry[]) => Promise<void>;
  onOpenDetail?: (vehiculeId: string) => void;
  style?: React.CSSProperties;
}

function StationBlock({ station, slotMap, onSlotClick, allEnAttente, onWaitingItemClick, onCreateAndAssign, vehicules, itemByInvId, onReorder, onOpenDetail, style }: StationBlockProps) {
  const roadMapStations = GARAGE_TO_ROAD_MAP_STATIONS[station.id] ?? [];

  // Index inventaireId → VehiculeInventaire (pour la description sous-traitant sur les fiches)
  const vehiculeByInvId = useMemo(() => {
    const map: Record<string, VehiculeInventaire> = {};
    vehicules.forEach(v => { map[v.id] = v; });
    return map;
  }, [vehicules]);

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

    // 2. Fallback : prod_items en-attente SANS road_map (trucks anciens uniquement)
    // Si le véhicule a un road_map, la section 1 ci-dessus est la seule source de vérité.
    // Le fallback ne s'applique qu'aux véhicules sans road_map pour éviter les doublons
    // et les placements incorrects (ex: dernierGarageId périmé après terminé).
    for (const item of allEnAttente) {
      if (seenItemIds.has(item.id)) continue;
      if (!item.inventaireId || seenVehIds.has(item.inventaireId)) continue;
      // Trouver le vehicule correspondant
      const vehicule = vehicules.find(v => v.id === item.inventaireId);
      if (!vehicule) continue;
      // Si le véhicule a un road_map, on ne passe PAS par le fallback
      if (vehicule.roadMap && vehicule.roadMap.length > 0) continue;
      const isForThisGarage =
        item.dernierGarageId === station.id ||
        STATION_TO_GARAGE[item.stationActuelle ?? ''] === station.id;
      if (!isForThisGarage) continue;
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
            accentColor={station.color}
            onSlotClick={onSlotClick}
            isOptional={station.optional}
            onOpenDetail={onOpenDetail}
            soustraitantDesc={
              slotMap[slot.id]?.inventaireId
                ? vehiculeByInvId[slotMap[slot.id]!.inventaireId!]?.roadMap
                    ?.find(e => e.stationId === 'sous-traitants' && e.description && (e.statut === 'en-cours' || e.statut === 'en-attente'))
                    ?.description
                : undefined
            }
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
                      if (item && !inSlot && onOpenDetail) {
                        e.stopPropagation();
                        onOpenDetail(item.inventaireId || item.id);
                      } else if (!item && onOpenDetail) {
                        e.stopPropagation();
                        onOpenDetail(vehicule.id);
                      }
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
  accentColor: string;
  onSlotClick: (e: React.MouseEvent, slot: Slot) => void;
  isOptional?: boolean;
  onOpenDetail?: (vehiculeId: string) => void;
  soustraitantDesc?: string;
}

function SlotCardSimple({ slot, item, accentColor, onSlotClick, isOptional, onOpenDetail, soustraitantDesc }: SlotCardSimpleProps) {
  const isTempJob = item && (item.type === 'export' || item.type === 'demantelement' || item.type === 'autres');

  const typeColor = item
    ? isTempJob ? '#6b7280'
    : item.type === 'eau'    ? '#f97316'
    : item.type === 'client' ? '#3b82f6'
    : '#22c55e'
    : null;

  const borderColor = item
    ? isTempJob ? '#374151'
    : item.etatCommercial === 'vendu'    ? '#ef4444'
    : item.etatCommercial === 'reserve'  ? '#f59e0b'
    : item.etatCommercial === 'location' ? '#7c3aed'
    : typeColor!
    : null;

  if (isTempJob) {
    const cfg = TYPE_JOB_CONFIG[item.type as keyof typeof TYPE_JOB_CONFIG];
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
          {cfg.label}
        </div>
        <span style={{ fontSize: 'clamp(14px, 1.6vw, 20px)', lineHeight: 1 }}>
          {cfg.emoji}
        </span>
        <span style={{ fontSize: 'clamp(9px, 0.9vw, 12px)', color: 'rgba(255,255,255,0.5)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.numero}
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
        position: 'relative',
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
          {soustraitantDesc && (
            <div style={{
              fontSize: 'clamp(7px, 0.75vw, 10px)',
              color: '#c084fc',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              🏭 {soustraitantDesc}
            </div>
          )}
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
          {/* Bouton Voir fiche */}
          {item.inventaireId && onOpenDetail && (
            <button
              onClick={(e) => { e.stopPropagation(); onOpenDetail(item.inventaireId!); }}
              title="Voir la fiche"
              style={{
                position: 'absolute', top: 4, right: 4,
                background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 4,
                padding: '2px 5px', cursor: 'pointer', fontSize: 'clamp(9px, 0.9vw, 12px)',
                color: 'rgba(255,255,255,0.6)', lineHeight: 1,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.3)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
            >📋</button>
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

  const pickerTop = Math.max(64, Math.min(position.y, window.innerHeight - 120));
  const pickerLeft = Math.min(position.x, window.innerWidth - 360);
  const pickerMaxH = window.innerHeight - pickerTop - 16;

  return (
    <div onClick={e => e.stopPropagation()} style={{
      position: 'fixed',
      top: pickerTop, left: pickerLeft,
      zIndex: 200,
      background: '#1a1814', border: '1px solid rgba(99,179,237,0.4)',
      borderRadius: 12, padding: 16, width: 340,
      boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
      maxHeight: pickerMaxH,
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
  const { mettreAJourRoadMap } = useInventaire();
  const [steps, setSteps] = useState<RoadMapEtape[]>(
    (vehicule.roadMap ?? []).sort((a, b) => a.ordre - b.ordre)
  );
  const [typeReservoir, setTypeReservoir] = useState(vehicule.typeReservoirRequis ?? '');
  const [saving, setSaving] = useState(false);

  const typeColor = vehicule.type === 'eau' ? '#f97316' : vehicule.type === 'client' ? '#3b82f6' : '#22c55e';
  const typeIcon = vehicule.type === 'eau' ? '💧' : vehicule.type === 'client' ? '🔧' : '🏷️';

  const panelTop = Math.max(64, Math.min(position.y, window.innerHeight - 120));
  const panelLeft = Math.min(position.x, window.innerWidth - 440);
  const maxH = window.innerHeight - panelTop - 16;

  const genId = () =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `step-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const toggleStation = (stationId: string) => {
    const station = ROAD_MAP_STATIONS.find(s => s.id === stationId);
    const hasDescription = !!(station as any)?.hasDescription;
    const lastIdx = [...steps].map((s, i) => ({ s, i })).reverse().find(({ s }) => s.stationId === stationId)?.i ?? -1;
    if (lastIdx >= 0 && !hasDescription) {
      setSteps(steps.filter((_, i) => i !== lastIdx).map((s, i) => ({ ...s, ordre: i + 1 })));
    } else {
      setSteps([...steps, { id: genId(), stationId, ordre: steps.length + 1, statut: 'planifie', description: hasDescription ? '' : undefined }]);
    }
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const n = [...steps]; [n[idx - 1], n[idx]] = [n[idx], n[idx - 1]];
    setSteps(n.map((s, i) => ({ ...s, ordre: i + 1 })));
  };
  const moveDown = (idx: number) => {
    if (idx === steps.length - 1) return;
    const n = [...steps]; [n[idx], n[idx + 1]] = [n[idx + 1], n[idx]];
    setSteps(n.map((s, i) => ({ ...s, ordre: i + 1 })));
  };

  const handleAssigner = async () => {
    setSaving(true);
    try {
      await mettreAJourRoadMap(vehicule.id, steps);
      if (vehicule.type === 'eau') {
        await supabase.from('prod_inventaire')
          .update({ type_reservoir_requis: typeReservoir || null, updated_at: new Date().toISOString() })
          .eq('id', vehicule.id);
      }
      await onAssigner(vehicule);
    } catch (err) {
      console.error('[ModalRoadMapSlot]', err);
    } finally { setSaving(false); }
  };

  const DARK_STATUTS: Record<string, { label: string; color: string; bg: string }> = {
    planifie:     { label: 'Planifié',   color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
    'en-attente': { label: 'En attente', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
    'en-cours':   { label: 'En cours',   color: '#60a5fa', bg: 'rgba(96,165,250,0.12)'  },
    termine:      { label: 'Terminé',    color: '#34d399', bg: 'rgba(52,211,153,0.12)'  },
    saute:        { label: 'Sauté',      color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  };

  return (
    <div onClick={e => e.stopPropagation()} style={{
      position: 'fixed',
      top: panelTop, left: panelLeft,
      zIndex: 200,
      background: '#12110e',
      border: `1px solid ${typeColor}30`,
      borderRadius: 14, width: 420,
      boxShadow: `0 24px 80px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.04)`,
      maxHeight: maxH,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>

      {/* ── Header ── */}
      <div style={{
        padding: '16px 18px 14px', flexShrink: 0,
        background: `linear-gradient(135deg, ${typeColor}0d, transparent)`,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: `${typeColor}18`, border: `1.5px solid ${typeColor}45`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0,
          }}>{typeIcon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: 'white', fontWeight: 800, fontSize: 15, fontFamily: 'monospace', letterSpacing: '-0.01em' }}>
              #{vehicule.numero}
              {vehicule.nomClient && <span style={{ color: typeColor, fontSize: 12, marginLeft: 8, fontWeight: 600 }}>· {vehicule.nomClient}</span>}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 }}>
              {[vehicule.marque, vehicule.modele, vehicule.annee].filter(Boolean).join(' ')}
            </div>
          </div>
          <div style={{
            background: `${typeColor}18`, border: `1px solid ${typeColor}35`,
            borderRadius: 8, padding: '5px 10px',
            color: typeColor, fontSize: 12, fontWeight: 700, fontFamily: 'monospace', flexShrink: 0,
          }}>→ {slot.id}</div>
        </div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)', fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          🗺 Configuration du Road Map
        </div>
      </div>

      {/* ── Body scrollable ── */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '14px 18px' }}>

        {/* Postes de travail */}
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
          Postes de travail
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 18 }}>
          {ROAD_MAP_STATIONS.map(station => {
            const count = steps.filter(s => s.stationId === station.id).length;
            const isSelected = count > 0;
            const firstIdx = steps.findIndex(s => s.stationId === station.id);
            return (
              <button
                key={station.id}
                onClick={() => toggleStation(station.id)}
                style={{
                  padding: '10px 6px 8px', borderRadius: 10,
                  border: isSelected ? `1.5px solid ${station.color}55` : '1.5px solid rgba(255,255,255,0.07)',
                  background: isSelected ? `${station.color}14` : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                  transition: 'all 0.15s',
                  boxShadow: isSelected ? `0 0 14px ${station.color}18` : 'none',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = isSelected ? `${station.color}1e` : 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.borderColor = isSelected ? `${station.color}80` : 'rgba(255,255,255,0.14)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = isSelected ? `${station.color}14` : 'rgba(255,255,255,0.03)';
                  e.currentTarget.style.borderColor = isSelected ? `${station.color}55` : 'rgba(255,255,255,0.07)';
                }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: 6,
                  background: isSelected ? station.color : 'rgba(255,255,255,0.06)',
                  border: isSelected ? 'none' : '1.5px dashed rgba(255,255,255,0.12)',
                  color: isSelected ? 'white' : 'rgba(255,255,255,0.25)',
                  fontSize: 10, fontWeight: 900, fontFamily: 'monospace',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isSelected ? `0 2px 8px ${station.color}50` : 'none',
                }}>
                  {isSelected ? (count > 1 ? `×${count}` : firstIdx + 1) : '+'}
                </div>
                <div style={{ fontSize: 17, lineHeight: 1 }}>{station.icon}</div>
                <div style={{
                  fontSize: 9.5, fontWeight: isSelected ? 700 : 500,
                  color: isSelected ? station.color : 'rgba(255,255,255,0.32)',
                  textAlign: 'center', lineHeight: 1.25,
                }}>{station.label}</div>
              </button>
            );
          })}
        </div>

        {/* Ordre des étapes */}
        {steps.length > 0 && (
          <>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
              Ordre des étapes — {steps.length} étape{steps.length > 1 ? 's' : ''}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
              {steps.map((step, idx) => {
                const station = ROAD_MAP_STATIONS.find(s => s.id === step.stationId);
                const sc = DARK_STATUTS[step.statut] ?? DARK_STATUTS.planifie;
                const stColor = (station as any)?.color ?? '#64748b';
                return (
                  <div key={step.id ?? `${step.stationId}-${idx}`} style={{
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderLeft: `3px solid ${stColor}`,
                    padding: '8px 10px',
                    display: 'flex', flexDirection: 'column', gap: 5,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{
                        width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                        background: stColor, color: 'white',
                        fontSize: 10, fontWeight: 800, fontFamily: 'monospace',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>{idx + 1}</span>
                      <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
                        {station?.icon} {station?.label}
                      </span>
                      <button onClick={() => moveUp(idx)} disabled={idx === 0}
                        style={{ background: 'none', border: 'none', fontSize: 12, cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.45)', padding: '2px 4px', lineHeight: 1 }}>↑</button>
                      <button onClick={() => moveDown(idx)} disabled={idx === steps.length - 1}
                        style={{ background: 'none', border: 'none', fontSize: 12, cursor: idx === steps.length - 1 ? 'default' : 'pointer', color: idx === steps.length - 1 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.45)', padding: '2px 4px', lineHeight: 1 }}>↓</button>
                      <button
                        onClick={() => setSteps(steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, ordre: i + 1 })))}
                        style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer', fontSize: 11, color: '#f87171', padding: '3px 7px', borderRadius: 5, fontWeight: 700, flexShrink: 0 }}>✕</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 27 }}>
                      {(station as any)?.hasDescription && (
                        <input
                          type="text"
                          value={step.description ?? ''}
                          onChange={e => setSteps(steps.map((s, i) => i === idx ? { ...s, description: e.target.value } : s))}
                          placeholder="Ex: XYZ Inc."
                          style={{
                            flex: 1, fontSize: 11, padding: '4px 8px', borderRadius: 6,
                            border: '1px solid rgba(255,255,255,0.12)',
                            background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.8)',
                            outline: 'none', minWidth: 0,
                          }}
                        />
                      )}
                      <select
                        value={step.statut}
                        onChange={e => setSteps(steps.map((s, i) => i === idx ? { ...s, statut: e.target.value as RoadMapEtape['statut'] } : s))}
                        onClick={e => e.stopPropagation()}
                        style={{
                          fontSize: 10, fontWeight: 700, borderRadius: 6, padding: '3px 8px',
                          border: `1px solid ${sc.color}35`, background: sc.bg, color: sc.color,
                          cursor: 'pointer', outline: 'none', flexShrink: 0,
                        }}
                      >
                        <option value="planifie">⬜ Planifié</option>
                        <option value="en-attente">⏳ En attente</option>
                        <option value="en-cours">🔵 En cours</option>
                        <option value="termine">✅ Terminé</option>
                        <option value="saute">⏭️ Sauté</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Réservoir requis (eau seulement) */}
        {vehicule.type === 'eau' && (
          <div style={{
            padding: '10px 12px', borderRadius: 10,
            background: 'rgba(14,165,233,0.07)', border: '1px solid rgba(14,165,233,0.2)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 16 }}>🛢</span>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#7dd3fc', whiteSpace: 'nowrap' }}>Réservoir requis :</label>
            <select
              value={typeReservoir}
              onChange={e => setTypeReservoir(e.target.value)}
              style={{
                flex: 1, padding: '5px 8px', borderRadius: 6,
                border: '1px solid rgba(14,165,233,0.25)', fontSize: 12, fontWeight: 600,
                outline: 'none', background: 'rgba(14,165,233,0.1)', color: '#7dd3fc',
              }}
            >
              <option value="">— Non spécifié —</option>
              {['2500g', '3750g', '4000g', '5000g'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{ padding: '12px 18px 16px', flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button onClick={handleAssigner} disabled={saving} style={{
          width: '100%', padding: '13px', borderRadius: 10, border: 'none',
          background: saving ? '#374151' : typeColor,
          color: 'white', fontWeight: 700, fontSize: 14,
          cursor: saving ? 'wait' : 'pointer',
          boxShadow: saving ? 'none' : `0 4px 20px ${typeColor}40`,
          transition: 'all 0.2s', letterSpacing: '0.01em',
        }}>
          {saving ? '⏳ Assignation en cours...' : `✓ Sauvegarder et assigner — Slot ${slot.id}`}
        </button>
        <button onClick={onClose} style={{
          width: '100%', padding: '8px', background: 'transparent',
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8,
          color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 12,
        }}>Annuler</button>
      </div>
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

