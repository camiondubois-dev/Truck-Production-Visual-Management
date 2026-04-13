import { useState } from 'react';
import { useGarage } from '../hooks/useGarage';
import { CreateWizardModal } from './CreateWizardModal';
import { EauIcon } from './EauIcon';
import type { Item, TypeItem } from '../types/item.types';

interface ListeItemsViewProps {
  type: TypeItem;
}

function formatDateRelative(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffDays > 0) return `il y a ${diffDays}j`;
  if (diffHours > 0) return `il y a ${diffHours}h`;
  return 'à l\'instant';
}

export function ListeItemsView({ type }: ListeItemsViewProps) {
  const { items, assignerSlot, retirerVersAttente, terminerItem, ajouterItem } = useGarage();
  const [showWizard, setShowWizard] = useState(false);

  const filteredItems = items.filter((i) => i.type === type && i.etat !== 'termine');
  const enAttente = filteredItems.filter((i) => i.etat === 'en-attente');
  const enSlot = filteredItems.filter((i) => i.etat === 'en-slot');

  const config = {
    eau: { color: '#f97316', icon: 'EAU_LOGO', label: 'Camions à eau' },
    client: { color: '#3b82f6', icon: '🔧', label: 'Jobs clients' },
    detail: { color: '#22c55e', icon: '🏷️', label: 'Camions détail' },
  }[type];

  return (
    <div
      style={{
        padding: '80px 32px 32px',
        maxWidth: 1400,
        margin: '0 auto',
        background: '#0f0e0b',
        minHeight: '100dvh',
      }}
    >
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          {config.icon === 'EAU_LOGO' ? <EauIcon /> : <span style={{ fontSize: 32 }}>{config.icon}</span>}
          <h1
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: config.color,
              margin: 0,
            }}
          >
            {config.label}
          </h1>
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 16,
              color: 'rgba(255,255,255,0.4)',
              fontFamily: 'monospace',
            }}
          >
            {filteredItems.length} actif{filteredItems.length > 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setShowWizard(true)}
            style={{
              padding: '8px 16px',
              background: config.color,
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            + Nouveau
          </button>
        </div>

        <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
          <StatCard label="En slot" value={enSlot.length} color={config.color} />
          <StatCard label="En attente" value={enAttente.length} color="#f59e0b" />
        </div>
      </div>

      {enAttente.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.7)',
              marginBottom: 16,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            En attente d'assignation
          </h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {enAttente.map((item) => (
              <ItemCard key={item.id} item={item} config={config} />
            ))}
          </div>
        </div>
      )}

      {enSlot.length > 0 && (
        <div>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.7)',
              marginBottom: 16,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Dans les slots
          </h2>
          <div style={{ display: 'grid', gap: 12 }}>
            {enSlot.map((item) => (
              <ItemCard key={item.id} item={item} config={config} />
            ))}
          </div>
        </div>
      )}

      {showWizard && (
        <CreateWizardModal
          initialType={type}
          onClose={() => setShowWizard(false)}
          onCreate={(item) => ajouterItem(item as Item)}
        />
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  color: string;
}

function StatCard({ label, value, color }: StatCardProps) {
  return (
    <div
      style={{
        flex: 1,
        background: `${color}15`,
        border: `1px solid ${color}44`,
        borderRadius: 8,
        padding: '16px 20px',
      }}
    >
      <div
        style={{
          fontSize: 32,
          fontWeight: 900,
          color,
          fontFamily: 'monospace',
          marginBottom: 4,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'rgba(255,255,255,0.6)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </div>
    </div>
  );
}

interface ItemCardProps {
  item: Item;
  config: { color: string; icon: string; label: string };
}

function ItemCard({ item, config }: ItemCardProps) {
  return (
    <div
      style={{
        background: '#161410',
        border: `1px solid ${config.color}44`,
        borderRadius: 10,
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 20,
      }}
    >
      <div style={{ fontSize: 28 }}>{config.icon}</div>

      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: 20,
              fontWeight: 900,
              color: config.color,
            }}
          >
            #{item.numero}
          </span>
          {item.urgence && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                background: '#fef3c7',
                color: '#92400e',
                padding: '3px 8px',
                borderRadius: 4,
              }}
            >
              URGENT
            </span>
          )}
          {item.slotId && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                background: `${config.color}20`,
                color: config.color,
                padding: '3px 8px',
                borderRadius: 4,
                fontFamily: 'monospace',
              }}
            >
              Slot {item.slotId}
            </span>
          )}
        </div>

        <div
          style={{
            fontSize: 16,
            color: 'rgba(255,255,255,0.85)',
            marginBottom: 8,
          }}
        >
          {item.label}
        </div>

        <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
          {item.variante && <span>Variante: {item.variante}</span>}
          {item.nomClient && <span>Client: {item.nomClient}</span>}
          {item.prixVente && (
            <span>
              Prix: {item.prixVente.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
            </span>
          )}
          <span>Créé {formatDateRelative(item.dateCreation)}</span>
        </div>

        {item.stationActuelle && (
          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              color: config.color,
              fontFamily: 'monospace',
            }}
          >
            Station: {item.stationActuelle}
          </div>
        )}
      </div>
    </div>
  );
}
