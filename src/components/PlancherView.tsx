import { useState, useEffect } from 'react';
import { useGarage } from '../hooks/useGarage';
import { STATIONS } from '../data/stations';
import { STATION_TO_GARAGE } from '../data/garageData';
import { TOUTES_STATIONS_COMMUNES } from '../data/mockData';
import { SlotAssignModal } from './SlotAssignModal';
import { SlotOccupeModal } from './SlotOccupeModal';
import { CreateWizardModal } from './CreateWizardModal';
import type { Slot, Item } from '../types/item.types';

type ModalState =
  | { type: 'assign'; slot: Slot; position: { x: number; y: number }; preSelectedItem?: Item }
  | { type: 'occupe'; item: Item; slot: Slot; position: { x: number; y: number } }
  | null;

export function PlancherView() {
  const {
    slotMap, enAttente, assignerSlot,
    retirerVersAttente, terminerItem,
    ajouterItem, updateStationStatus,
    terminerEtAvancer,
  } = useGarage();

  const [modalState, setModalState] = useState<ModalState>(null);
  const [showWizard, setShowWizard] = useState(false);

  const allEnAttente = [...enAttente.eau, ...enAttente.client, ...enAttente.detail];

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
    const rect = e.currentTarget.getBoundingClientRect();
    const position = calculerPosition(rect);
    if (item) {
      setModalState({ type: 'occupe', item, slot, position });
    } else if (!slot.futur) {
      setModalState({ type: 'assign', slot, position });
    }
  };

  const handleWaitingItemClick = (e: React.MouseEvent, item: Item, garageId: string) => {
    e.stopPropagation();
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
        <StationBlock station={STATIONS.find((s) => s.id === 'soudure-generale')!} slotMap={slotMap} onSlotClick={handleSlotClick} allEnAttente={allEnAttente} onWaitingItemClick={handleWaitingItemClick} />
        <StationBlock station={STATIONS.find((s) => s.id === 'point-s')!} slotMap={slotMap} onSlotClick={handleSlotClick} allEnAttente={allEnAttente} onWaitingItemClick={handleWaitingItemClick} />
      </div>

      <StationBlock station={STATIONS.find((s) => s.id === 'mecanique-generale')!} slotMap={slotMap} onSlotClick={handleSlotClick} allEnAttente={allEnAttente} onWaitingItemClick={handleWaitingItemClick} style={{ gridColumn: '2', gridRow: '1' }} />

      <StationBlock station={STATIONS.find((s) => s.id === 'mecanique-moteur')!} slotMap={slotMap} onSlotClick={handleSlotClick} allEnAttente={allEnAttente} onWaitingItemClick={handleWaitingItemClick} style={{ gridColumn: '3', gridRow: '1' }} />

      {/* ── HORLOGE ── */}
      <div style={{ gridColumn: '1', gridRow: '2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <HorlogeWidget />
      </div>

      <StationBlock station={STATIONS.find((s) => s.id === 'sous-traitants')!} slotMap={slotMap} onSlotClick={handleSlotClick} allEnAttente={allEnAttente} onWaitingItemClick={handleWaitingItemClick} style={{ gridColumn: '2', gridRow: '2' }} />

      <div style={{ gridColumn: '3', gridRow: '2', display: 'flex', gap: 12 }}>
        <StationBlock station={STATIONS.find((s) => s.id === 'soudure-specialisee')!} slotMap={slotMap} onSlotClick={handleSlotClick} allEnAttente={allEnAttente} onWaitingItemClick={handleWaitingItemClick} />
        <StationBlock station={STATIONS.find((s) => s.id === 'peinture')!} slotMap={slotMap} onSlotClick={handleSlotClick} allEnAttente={allEnAttente} onWaitingItemClick={handleWaitingItemClick} />
      </div>

      {modalState?.type === 'assign' && (
        <SlotAssignModal
          slot={modalState.slot}
          enAttente={enAttente}
          onAssign={assignerSlot}
          onClose={() => setModalState(null)}
          position={modalState.position}
          preSelectedItem={modalState.preSelectedItem}
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

      {showWizard && (
        <CreateWizardModal
          onClose={() => setShowWizard(false)}
          onCreate={(item) => ajouterItem(item as Item)}
        />
      )}
    </div>
  );
}

// ── HorlogeWidget ─────────────────────────────────────────────

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

// ── StationBlock ──────────────────────────────────────────────

interface StationBlockProps {
  station: { id: string; label: string; color: string; slots: Slot[]; gridCols: number; optional?: boolean };
  slotMap: Record<string, Item>;
  onSlotClick: (e: React.MouseEvent, slot: Slot) => void;
  allEnAttente: Item[];
  onWaitingItemClick: (e: React.MouseEvent, item: Item, garageId: string) => void;
  style?: React.CSSProperties;
}

function StationBlock({ station, slotMap, onSlotClick, allEnAttente, onWaitingItemClick, style }: StationBlockProps) {
  const itemsEnAttente = allEnAttente.filter(item => {
    if (item.dernierGarageId) return item.dernierGarageId === station.id;
    const garageViaStation = STATION_TO_GARAGE[item.stationActuelle ?? ''];
    return garageViaStation === station.id;
  });

  return (
    <div style={{
      width: '100%', height: '92%',
      background: '#161410',
      border: `1.5px solid ${station.color}40`,
      borderRadius: 8,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      ...style,
    }}>
      <div style={{
        padding: '6px 12px',
        background: `${station.color}18`,
        borderBottom: `1px solid ${station.color}30`,
        fontFamily: 'monospace',
        fontSize: 'clamp(9px, 1vw, 13px)',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: station.color,
        flexShrink: 0,
      }}>
        {station.label}
      </div>

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
          />
        ))}
      </div>

      {itemsEnAttente.length > 0 && (
        <div style={{
          borderTop: `1px solid ${station.color}33`,
          padding: '6px 8px 4px',
          flexShrink: 0,
        }}>
          <div style={{
            fontSize: 'clamp(8px, 0.8vw, 9px)',
            fontFamily: 'monospace', fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: '#f59e0b', marginBottom: 4,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
            En attente ({itemsEnAttente.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {itemsEnAttente.map((item) => {
              const couleur = item.type === 'eau' ? '#f97316' : item.type === 'client' ? '#3b82f6' : '#22c55e';
              const icon = item.type === 'eau' ? '🚒' : item.type === 'client' ? '🔧' : '🏷️';
              return (
                <div
                  key={item.id}
                  title={item.label}
                  onClick={(e) => onWaitingItemClick(e, item, station.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: `${couleur}18`,
                    border: `1px solid ${couleur}55`,
                    borderRadius: 4, padding: '3px 7px',
                    cursor: 'pointer',
                    fontSize: 'clamp(9px, 0.9vw, 11px)',
                    fontFamily: 'monospace', color: couleur, fontWeight: 700,
                    transition: 'transform 0.15s, background 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.background = `${couleur}25`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = `${couleur}18`; }}
                >
                  <span style={{ fontSize: 'clamp(10px, 1vw, 12px)' }}>{icon}</span>
                  <span>#{item.numero}</span>
                  {item.urgence && (
                    <span style={{ fontSize: 'clamp(7px, 0.7vw, 8px)', fontWeight: 700, background: '#fef3c7', color: '#92400e', padding: '1px 3px', borderRadius: 2 }}>
                      URG
                    </span>
                  )}
                  {item.etatCommercial === 'vendu' && (
                    <span style={{ fontSize: 'clamp(7px, 0.7vw, 8px)', fontWeight: 700, background: '#fee2e2', color: '#dc2626', padding: '1px 3px', borderRadius: 2 }}>
                      VDU
                    </span>
                  )}
                  {item.etatCommercial === 'reserve' && (
                    <span style={{ fontSize: 'clamp(7px, 0.7vw, 8px)', fontWeight: 700, background: '#fef3c7', color: '#92400e', padding: '1px 3px', borderRadius: 2 }}>
                      RÉS
                    </span>
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

// ── SlotCardSimple ────────────────────────────────────────────

interface SlotCardSimpleProps {
  slot: Slot;
  item?: Item;
  accentColor: string;
  onSlotClick: (e: React.MouseEvent, slot: Slot) => void;
  isOptional?: boolean;
}

function SlotCardSimple({ slot, item, accentColor, onSlotClick, isOptional }: SlotCardSimpleProps) {
  const typeColor = item
    ? item.type === 'eau'    ? '#f97316'
    : item.type === 'client' ? '#3b82f6'
    : '#22c55e'
    : null;

  const borderColor = item
    ? item.etatCommercial === 'vendu'   ? '#ef4444'
    : item.etatCommercial === 'reserve' ? '#f59e0b'
    : typeColor!
    : null;

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
          {item.urgence && (
            <div style={{ fontSize: 'clamp(7px, 0.7vw, 9px)', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ⚡ URGENT
            </div>
          )}
          {item.etatCommercial && item.etatCommercial !== 'non-vendu' && (
            <div style={{
              marginTop: 2, padding: '3px 6px', borderRadius: 4,
              border: `1.5px solid ${item.etatCommercial === 'vendu' ? '#ef4444' : '#f59e0b'}`,
              background: item.etatCommercial === 'vendu' ? '#ef444422' : '#f59e0b22',
              color: item.etatCommercial === 'vendu' ? '#ef4444' : '#f59e0b',
              fontWeight: 800, fontSize: 'clamp(7px, 0.75vw, 10px)',
              textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center',
            }}>
              {item.etatCommercial === 'vendu'
                ? `✓ VENDU${item.clientAcheteur ? ` — ${item.clientAcheteur}` : ''}`
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