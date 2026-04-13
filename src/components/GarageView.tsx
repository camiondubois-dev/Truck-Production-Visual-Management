import { useState } from 'react';
import { MOCK_TRUCKS, STATUS_CONFIG, GARAGES as GARAGE_DATA } from '../data/garageData';
import type { TruckData, QueueTruck, GarageData } from '../types/garage.types';

interface GarageConfig {
  id: string;
  label: string;
  accentColor: string;
  cols: number;
  slots: Array<{ id: string; futur?: boolean }>;
  optional?: boolean;
  queue: QueueTruck[];
}

const GARAGES: Record<string, GarageConfig> = {
  soudureGenerale: {
    id: 'soudure-generale',
    label: 'Soudure Générale',
    accentColor: '#ff6b35',
    cols: 1,
    slots: [{ id: '17' }],
    queue: GARAGE_DATA.find((g) => g.id === 'soudure-generale')?.queue || [],
  },
  pointS: {
    id: 'point-s',
    label: 'Point S',
    accentColor: '#888888',
    cols: 1,
    slots: [{ id: '18' }],
    optional: true,
    queue: GARAGE_DATA.find((g) => g.id === 'point-s')?.queue || [],
  },
  mecaGenerale: {
    id: 'mecanique-generale',
    label: 'Mécanique Générale',
    accentColor: '#4a9eff',
    cols: 2,
    slots: [{ id: '9A' }, { id: '10A' }, { id: '9B' }, { id: '10B' }],
    queue: GARAGE_DATA.find((g) => g.id === 'mecanique-generale')?.queue || [],
  },
  mecaMoteur: {
    id: 'mecanique-moteur',
    label: 'Mécanique Moteur / Électrique',
    accentColor: '#4a9eff',
    cols: 3,
    slots: [{ id: '11' }, { id: '12' }, { id: '13' }, { id: '16' }, { id: '15' }, { id: '14' }],
    queue: GARAGE_DATA.find((g) => g.id === 'mecanique-moteur')?.queue || [],
  },
  sousTraitants: {
    id: 'sous-traitants',
    label: 'Sous-traitants',
    accentColor: '#a855f7',
    cols: 2,
    slots: [
      { id: 'S-01' },
      { id: 'S-02' },
      { id: 'S-03' },
      { id: 'S-04' },
      { id: 'S-05' },
      { id: 'S-06' },
    ],
    queue: GARAGE_DATA.find((g) => g.id === 'sous-traitants')?.queue || [],
  },
  soudureSpecialisee: {
    id: 'soudure-specialisee',
    label: 'Soudure spécialisée',
    accentColor: '#ff6b35',
    cols: 2,
    slots: [{ id: '5' }, { id: '6' }, { id: '4' }, { id: '3' }],
    queue: GARAGE_DATA.find((g) => g.id === 'soudure-specialisee')?.queue || [],
  },
  peinture: {
    id: 'peinture',
    label: 'Peinture',
    accentColor: '#94a3b8',
    cols: 2,
    slots: [{ id: '7', futur: true }, { id: '8', futur: true }, { id: '2' }, { id: '1' }],
    queue: GARAGE_DATA.find((g) => g.id === 'peinture')?.queue || [],
  },
};

interface TooltipState {
  slot: { id: string; futur?: boolean };
  truck: TruckData | null;
  position: { x: number; y: number };
}

export function GarageView() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const getTruckInSlot = (slotId: string): TruckData | undefined => {
    return MOCK_TRUCKS.find((truck) => truck.slotId === slotId);
  };

  const handleSlotClick = (
    e: React.MouseEvent,
    slot: { id: string; futur?: boolean },
    truck: TruckData | null
  ) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();

    let x = rect.right + 10;
    let y = rect.top;

    if (x + 290 > window.innerWidth) x = rect.left - 290;
    if (y + 300 > window.innerHeight) y = window.innerHeight - 310;

    setTooltip({ slot, truck, position: { x, y } });
  };

  const handleQueueTruckClick = (
    e: React.MouseEvent,
    queueTruck: QueueTruck,
    garage: GarageConfig
  ) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();

    const fullTruck: TruckData = {
      id: queueTruck.id,
      slotId: 'FILE',
      type: 'Camion à eau',
      variant: queueTruck.variant,
      status: 'en-attente',
      etape: `En attente — ${garage.label}`,
      jours: 0,
    };

    let x = rect.right + 10;
    let y = rect.top;

    if (x + 290 > window.innerWidth) x = rect.left - 290;
    if (y + 300 > window.innerHeight) y = window.innerHeight - 310;

    setTooltip({ slot: { id: 'FILE' }, truck: fullTruck, position: { x, y } });
  };

  return (
    <div
      onClick={() => setTooltip(null)}
      style={{
        width: '100%',
        height: '100%',
        display: 'grid',
        gridTemplateColumns: '1fr 2fr 3fr',
        gridTemplateRows: '1fr 1fr',
        gap: '12px',
        padding: '12px',
        background: '#0f0e0b',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          gridColumn: '1',
          gridRow: '1',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <GarageBlock
          garage={GARAGES.soudureGenerale}
          getTruckInSlot={getTruckInSlot}
          onSlotClick={handleSlotClick}
          onQueueTruckClick={handleQueueTruckClick}
        />
        <GarageBlock
          garage={GARAGES.pointS}
          getTruckInSlot={getTruckInSlot}
          onSlotClick={handleSlotClick}
          onQueueTruckClick={handleQueueTruckClick}
        />
      </div>

      <GarageBlock
        garage={GARAGES.mecaGenerale}
        getTruckInSlot={getTruckInSlot}
        onSlotClick={handleSlotClick}
        onQueueTruckClick={handleQueueTruckClick}
        style={{ gridColumn: '2', gridRow: '1' }}
      />

      <GarageBlock
        garage={GARAGES.mecaMoteur}
        getTruckInSlot={getTruckInSlot}
        onSlotClick={handleSlotClick}
        onQueueTruckClick={handleQueueTruckClick}
        style={{ gridColumn: '3', gridRow: '1' }}
      />

      <div style={{ gridColumn: '1', gridRow: '2' }} />

      <GarageBlock
        garage={GARAGES.sousTraitants}
        getTruckInSlot={getTruckInSlot}
        onSlotClick={handleSlotClick}
        onQueueTruckClick={handleQueueTruckClick}
        style={{ gridColumn: '2', gridRow: '2' }}
      />

      <div
        style={{
          gridColumn: '3',
          gridRow: '2',
          display: 'flex',
          gap: 12,
        }}
      >
        <GarageBlock
          garage={GARAGES.soudureSpecialisee}
          getTruckInSlot={getTruckInSlot}
          onSlotClick={handleSlotClick}
          onQueueTruckClick={handleQueueTruckClick}
        />
        <GarageBlock
          garage={GARAGES.peinture}
          getTruckInSlot={getTruckInSlot}
          onSlotClick={handleSlotClick}
          onQueueTruckClick={handleQueueTruckClick}
        />
      </div>

      <Legend />

      {tooltip && (
        <SlotTooltip
          slot={tooltip.slot}
          truck={tooltip.truck}
          position={tooltip.position}
          onClose={() => setTooltip(null)}
        />
      )}
    </div>
  );
}

interface GarageBlockProps {
  garage: GarageConfig;
  getTruckInSlot: (slotId: string) => TruckData | undefined;
  onSlotClick: (e: React.MouseEvent, slot: { id: string; futur?: boolean }, truck: TruckData | null) => void;
  onQueueTruckClick: (e: React.MouseEvent, queueTruck: QueueTruck, garage: GarageConfig) => void;
  style?: React.CSSProperties;
}

function GarageBlock({ garage, getTruckInSlot, onSlotClick, onQueueTruckClick, style }: GarageBlockProps) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#161410',
        border: `1.5px solid ${garage.accentColor}40`,
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          padding: '6px 12px',
          background: `${garage.accentColor}18`,
          borderBottom: `1px solid ${garage.accentColor}30`,
          fontFamily: 'monospace',
          fontSize: 'clamp(9px, 1vw, 13px)',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: garage.accentColor,
          flexShrink: 0,
        }}
      >
        {garage.label}
      </div>

      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: `repeat(${garage.cols}, 1fr)`,
          gap: '6px',
          padding: '8px',
          minHeight: 0,
        }}
      >
        {garage.slots.map((slot) => {
          const truck = getTruckInSlot(slot.id);
          return (
            <SlotCard
              key={slot.id}
              slot={slot}
              truck={truck}
              accentColor={garage.accentColor}
              onSlotClick={onSlotClick}
              isOptional={garage.optional}
            />
          );
        })}
      </div>

      {garage.queue.length > 0 && (
        <div
          style={{
            flexShrink: 0,
            borderTop: '1px solid rgba(255, 204, 68, 0.2)',
            background: '#0f0d09',
            padding: '5px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#ffcc44',
                boxShadow: '0 0 5px #ffcc44',
              }}
            />
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: 'clamp(7px, 0.7vw, 9px)',
                fontWeight: 700,
                color: 'rgba(255,204,68,0.5)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              Attente
            </span>
          </div>

          {garage.queue
            .sort((a, b) => a.priorite - b.priorite)
            .map((truck, index) => (
              <div key={truck.id} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {index > 0 && (
                  <span
                    style={{
                      fontSize: 'clamp(8px, 0.8vw, 11px)',
                      color: 'rgba(255,204,68,0.25)',
                      flexShrink: 0,
                    }}
                  >
                    ›
                  </span>
                )}
                <div
                  onClick={(e) => onQueueTruckClick(e, truck, garage)}
                  style={{
                    background: 'rgba(255,204,68,0.12)',
                    border: '1px solid rgba(255,204,68,0.45)',
                    borderRadius: 4,
                    padding: '2px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    transition: 'background 0.12s',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,204,68,0.22)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,204,68,0.12)')}
                >
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: 'clamp(7px, 0.65vw, 9px)',
                      color: 'rgba(255,204,68,0.45)',
                      fontWeight: 700,
                    }}
                  >
                    {truck.priorite}.
                  </span>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: 'clamp(9px, 0.95vw, 13px)',
                      fontWeight: 900,
                      color: '#ffcc44',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {truck.id}
                  </span>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

interface SlotCardProps {
  slot: { id: string; futur?: boolean };
  truck?: TruckData;
  accentColor: string;
  onSlotClick: (e: React.MouseEvent, slot: { id: string; futur?: boolean }, truck: TruckData | null) => void;
  isOptional?: boolean;
}

function SlotCard({ slot, truck, accentColor, onSlotClick, isOptional }: SlotCardProps) {
  const status = truck ? STATUS_CONFIG[truck.status] : null;

  return (
    <div
      onClick={(e) => onSlotClick(e, slot, truck || null)}
      style={{
        background: truck ? `${status!.color}15` : '#1c1a14',
        border: truck
          ? `2px solid ${status!.color}`
          : slot.futur
          ? '1px dashed rgba(255,255,255,0.08)'
          : isOptional
          ? '1px dashed rgba(255, 200, 0, 0.3)'
          : '1px dashed rgba(255,255,255,0.1)',
        borderRadius: 6,
        padding: '8px 10px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        minHeight: 0,
        height: '100%',
        boxSizing: 'border-box',
        position: 'relative',
        transition: 'background 0.15s, transform 0.1s',
        opacity: slot.futur ? 0.4 : 1,
      }}
      onMouseEnter={(e) => {
        if (truck) e.currentTarget.style.transform = 'scale(1.02)';
      }}
      onMouseLeave={(e) => {
        if (truck) e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      <span
        style={{
          fontFamily: 'monospace',
          fontSize: 'clamp(10px, 1.1vw, 14px)',
          fontWeight: 700,
          color: '#ff5533',
          lineHeight: 1,
        }}
      >
        #{slot.id}
      </span>

      {slot.futur ? (
        <span
          style={{
            fontSize: 'clamp(9px, 0.85vw, 11px)',
            color: 'rgba(255,255,255,0.3)',
            marginTop: 'auto',
            textAlign: 'center',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Futur
        </span>
      ) : truck ? (
        <>
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: 'clamp(14px, 1.8vw, 22px)',
              fontWeight: 900,
              color: '#ffffff',
              lineHeight: 1,
              letterSpacing: '-0.02em',
            }}
          >
            {truck.id}
          </span>

          <span
            style={{
              fontSize: 'clamp(9px, 0.9vw, 12px)',
              color: 'rgba(255,255,255,0.55)',
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {truck.etape}
          </span>

          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: status!.color,
                boxShadow: `0 0 6px ${status!.color}`,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 'clamp(8px, 0.85vw, 11px)',
                color: status!.color,
                fontWeight: 700,
                fontFamily: 'monospace',
              }}
            >
              {status!.label} · {truck.jours}j
            </span>
          </div>
        </>
      ) : (
        <span
          style={{
            fontSize: 'clamp(9px, 0.85vw, 11px)',
            color: 'rgba(255,255,255,0.18)',
            marginTop: 'auto',
          }}
        >
          Disponible
        </span>
      )}
    </div>
  );
}

function Legend() {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 12,
        left: 12,
        display: 'flex',
        gap: 16,
        background: 'rgba(0,0,0,0.7)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 6,
        padding: '6px 14px',
        zIndex: 500,
      }}
    >
      {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: cfg.color,
              boxShadow: `0 0 5px ${cfg.color}`,
            }}
          />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
            {cfg.label}
          </span>
        </div>
      ))}
    </div>
  );
}

interface SlotTooltipProps {
  slot: { id: string; futur?: boolean };
  truck: TruckData | null;
  position: { x: number; y: number };
  onClose: () => void;
}

function SlotTooltip({ slot, truck, position, onClose }: SlotTooltipProps) {
  if (!truck) {
    return (
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: position.y,
          left: position.x,
          background: '#1a1814',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 8,
          padding: '12px 16px',
          zIndex: 1000,
          minWidth: 180,
          boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
          fontFamily: 'monospace',
        }}
      >
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, margin: 0 }}>
          Slot #{slot.id} — Disponible
        </p>
        <button
          onClick={onClose}
          style={{
            marginTop: 8,
            fontSize: 11,
            color: 'rgba(255,255,255,0.3)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          ✕ Fermer
        </button>
      </div>
    );
  }

  const status = STATUS_CONFIG[truck.status];

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: position.y,
        left: position.x,
        zIndex: 1000,
        width: 280,
        background: '#12100c',
        border: `2px solid ${status.color}`,
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: `0 12px 40px rgba(0,0,0,0.9), 0 0 20px ${status.color}20`,
        fontFamily: 'monospace',
      }}
    >
      <div
        style={{
          background: `${status.color}25`,
          borderBottom: `1px solid ${status.color}40`,
          padding: '10px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 10,
              color: status.color,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Slot #{slot.id}
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 900,
              color: '#fff',
              letterSpacing: '-0.02em',
            }}
          >
            {truck.id}
          </div>
        </div>
        <div
          style={{
            background: `${status.color}30`,
            border: `1px solid ${status.color}`,
            color: status.color,
            fontSize: 10,
            fontWeight: 700,
            padding: '4px 8px',
            borderRadius: 4,
            letterSpacing: '0.05em',
          }}
        >
          {status.label}
        </div>
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Row label="Type" value={truck.type} />
        <Row
          label="Variante"
          value={truck.variant}
          color={truck.variant === 'Neuf' ? '#44dd88' : '#ffcc44'}
        />
        <Row label="Étape actuelle" value={truck.etape} />
        <Row
          label="Temps en cours"
          value={`${truck.jours} jour${truck.jours > 1 ? 's' : ''}`}
          color={truck.jours > 3 ? '#ff4444' : '#ffffff'}
        />
      </div>

      <div
        style={{
          borderTop: '1px solid rgba(255,255,255,0.08)',
          padding: '8px 14px',
          display: 'flex',
          gap: 8,
        }}
      >
        <button
          style={{
            flex: 1,
            background: '#44dd8820',
            border: '1px solid #44dd88',
            color: '#44dd88',
            fontSize: 11,
            fontWeight: 700,
            padding: '6px',
            borderRadius: 4,
            cursor: 'pointer',
            fontFamily: 'monospace',
            letterSpacing: '0.04em',
          }}
        >
          ✓ Avancer
        </button>
        <button
          style={{
            flex: 1,
            background: '#ff444420',
            border: '1px solid #ff4444',
            color: '#ff4444',
            fontSize: 11,
            fontWeight: 700,
            padding: '6px',
            borderRadius: 4,
            cursor: 'pointer',
            fontFamily: 'monospace',
            letterSpacing: '0.04em',
          }}
        >
          ⚠ Bloquer
        </button>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: '1px solid rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.4)',
            fontSize: 11,
            padding: '6px 10px',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

interface RowProps {
  label: string;
  value: string;
  color?: string;
}

function Row({ label, value, color = 'rgba(255,255,255,0.85)' }: RowProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 8,
      }}
    >
      <span
        style={{
          fontSize: 10,
          color: 'rgba(255,255,255,0.35)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 12,
          color,
          fontWeight: 700,
          textAlign: 'right',
        }}
      >
        {value}
      </span>
    </div>
  );
}
