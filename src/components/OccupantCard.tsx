import type { Occupant } from '../types/occupant.types';

interface OccupantCardProps {
  slot: { id: string; futur?: boolean };
  occupant?: Occupant;
  accentColor: string;
  onSlotClick: (e: React.MouseEvent, slot: { id: string; futur?: boolean }, occupant: Occupant | null) => void;
  isOptional?: boolean;
}

const TYPE_COLORS = {
  eau: '#ff6b35',
  client: '#4a9eff',
  detail: '#44dd88',
};

const STATUT_COLORS = {
  'en-travail': '#4a9eff',
  'attente': '#ffcc44',
  'pret': '#44dd88',
  'bloque': '#ff4444',
};

export function OccupantCard({ slot, occupant, accentColor, onSlotClick, isOptional }: OccupantCardProps) {
  const typeColor = occupant ? TYPE_COLORS[occupant.type] : null;
  const statutColor = occupant ? STATUT_COLORS[occupant.statut] : null;

  const getOccupantDisplay = () => {
    if (!occupant) return null;

    switch (occupant.type) {
      case 'eau':
        return {
          numero: occupant.numero,
          label: `${occupant.marque} ${occupant.modele}`,
        };
      case 'client':
        return {
          numero: occupant.nomClient,
          label: occupant.travailDescription,
        };
      case 'detail':
        return {
          numero: `${occupant.marque} ${occupant.modele}`,
          label: occupant.travailDescription,
        };
    }
  };

  const display = getOccupantDisplay();
  const daysSince = occupant ? Math.floor((Date.now() - new Date(occupant.depuis).getTime()) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <div
      onClick={(e) => onSlotClick(e, slot, occupant || null)}
      style={{
        background: occupant ? `${typeColor}15` : '#1c1a14',
        border: occupant
          ? `2px solid ${typeColor}`
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
        if (occupant) e.currentTarget.style.transform = 'scale(1.02)';
      }}
      onMouseLeave={(e) => {
        if (occupant) e.currentTarget.style.transform = 'scale(1)';
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
      ) : occupant && display ? (
        <>
          {occupant.type === 'client' && (
            <div
              style={{
                fontSize: 'clamp(8px, 0.75vw, 10px)',
                color: typeColor,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              CLIENT
            </div>
          )}
          {occupant.type === 'detail' && (
            <div
              style={{
                fontSize: 'clamp(8px, 0.75vw, 10px)',
                color: typeColor,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              DÉTAIL
            </div>
          )}

          <span
            style={{
              fontFamily: 'monospace',
              fontSize: 'clamp(13px, 1.5vw, 18px)',
              fontWeight: 900,
              color: '#ffffff',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
            }}
          >
            {display.numero}
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
            {display.label}
          </span>

          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: statutColor,
                boxShadow: `0 0 6px ${statutColor}`,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 'clamp(8px, 0.85vw, 11px)',
                color: statutColor,
                fontWeight: 700,
                fontFamily: 'monospace',
                textTransform: 'capitalize',
              }}
            >
              {occupant.statut} · {daysSince}j
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
