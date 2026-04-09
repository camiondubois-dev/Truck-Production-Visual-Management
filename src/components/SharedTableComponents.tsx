import { GarageAssignment, EtatItem } from '../types/item.types';

export const thStyle = (width: number): React.CSSProperties => ({
  width,
  textAlign: 'left',
  padding: '10px 12px',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: '#6b7280',
  whiteSpace: 'nowrap',
});

export const tdStyle: React.CSSProperties = {
  padding: '12px',
  fontSize: 13,
  verticalAlign: 'middle',
};

export const StatPill = ({ label, value, color }: {
  label: string; value: number; color: string;
}) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
    <span style={{
      background: color, color: 'white',
      fontWeight: 700, fontSize: 13,
      padding: '2px 10px', borderRadius: 12,
      minWidth: 28, textAlign: 'center',
    }}>
      {value}
    </span>
    <span style={{ fontSize: 13, color: '#6b7280' }}>{label}</span>
  </div>
);

export const SectionHeader = ({ label, color, count }: {
  label: string; color: string; count: number;
}) => (
  <tr>
    <td colSpan={999} style={{
      padding: '8px 12px',
      background: '#f8fafc',
      borderTop: '1px solid #e5e7eb',
      borderBottom: '1px solid #e5e7eb',
      fontSize: 12, fontWeight: 700,
      color,
      letterSpacing: '0.05em',
    }}>
      {label}
      <span style={{
        marginLeft: 8, background: color, color: 'white',
        fontSize: 11, padding: '1px 7px',
        borderRadius: 10, fontWeight: 700,
      }}>
        {count}
      </span>
    </td>
  </tr>
);

export const StatutBadge = ({ etat }: { etat: EtatItem }) => {
  const config = {
    'en-slot':    { label: 'En slot',    bg: '#dbeafe', color: '#1d4ed8' },
    'en-attente': { label: 'En attente', bg: '#fef3c7', color: '#92400e' },
    'termine':    { label: 'Terminé',    bg: '#dcfce7', color: '#166534' },
  }[etat];
  return (
    <span style={{
      fontSize: 11, fontWeight: 700,
      background: config.bg, color: config.color,
      padding: '3px 8px', borderRadius: 4,
    }}>
      {config.label}
    </span>
  );
};

export const CelluleGarage = ({ assignment, color }: {
  assignment?: GarageAssignment; color: string;
}) => {
  if (!assignment) {
    return (
      <div
        style={{
          width: 10, height: 10, borderRadius: '50%',
          background: '#e5e7eb', margin: '0 auto',
          transition: 'background 0.15s', cursor: 'pointer',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#94a3b8'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '#e5e7eb'; }}
      />
    );
  }

  if (assignment.statut === 'en-attente-slot') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <div style={{
          width: 26, height: 26, borderRadius: '50%',
          background: '#fef3c7', border: `2px solid #f59e0b`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, margin: '0 auto', cursor: 'pointer',
        }}>⏳</div>
        <span style={{ fontSize: 9, color: '#f59e0b', fontWeight: 700 }}>ATTENTE</span>
      </div>
    );
  }

  if (assignment.statut === 'en-slot') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 6,
          background: '#dbeafe', border: `2px solid #3b82f6`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, cursor: 'pointer',
        }}>🚛</div>
        <span style={{ fontSize: 9, color: '#3b82f6', fontWeight: 700 }}>
          Slot {assignment.slotId}
        </span>
      </div>
    );
  }

  if (assignment.statut === 'termine') {
    return (
      <div style={{
        width: 26, height: 26, borderRadius: '50%',
        background: '#dcfce7', border: '2px solid #22c55e',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#16a34a', fontSize: 13, fontWeight: 700,
        margin: '0 auto', cursor: 'pointer',
      }}>✓</div>
    );
  }

  return null;
};
