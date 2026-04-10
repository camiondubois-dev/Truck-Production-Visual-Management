import { useAuth } from '../contexts/AuthContext';
import { useGarage } from '../hooks/useGarage';
import { EauIcon } from './EauIcon';
import { toutesEtapesCompletees } from '../utils/progressionUtils';

interface NavigationProps {
  currentTab: string;
  onTabChange: (tabId: string) => void;
}

const TABS = [
  { id: 'plancher',    label: 'Vue Plancher',   icon: '🏭' },
  { id: 'eau',         label: 'Camions à eau',  icon: 'EAU_LOGO', color: '#f97316' },
  { id: 'clients',     label: 'Jobs clients',   icon: '🔧',       color: '#3b82f6' },
  { id: 'detail',      label: 'Camions détail', icon: '🏷️',       color: '#22c55e' },
  { id: 'prets',       label: 'Prêts',          icon: '✅',        color: '#22c55e' },
  { id: 'inventaire',  label: 'Inventaire',     icon: '📋',       color: '#1e293b' },
  { id: 'reservoirs',  label: 'Réservoirs',     icon: '🛢',       color: '#0ea5e9' },
  { id: 'baseclients', label: 'Clients',        icon: '👤',       color: '#6366f1' },
  { id: 'archive',     label: 'Archive',        icon: '📦',       color: '#6b7280' },
];

export function Navigation({ currentTab, onTabChange }: NavigationProps) {
  const { deconnexion } = useAuth();
  const { items } = useGarage();

  const pretsCount = items.filter(i => i.etat !== 'termine' && toutesEtapesCompletees(i)).length;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      height: 60,
      background: '#0f0e0b',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '0 20px',
      zIndex: 100,
    }}>
      {/* Logo */}
      <div
        onClick={() => deconnexion()}
        style={{
          display: 'flex', alignItems: 'center',
          cursor: 'pointer', padding: '4px 8px',
          borderRadius: 8, transition: 'background 0.15s', marginRight: 16,
        }}
        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.05)'}
        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
        title="Se déconnecter"
      >
        <img
          src="/logo-camions-dubois-_-noir-bleu-1.png"
          alt="Camions Dubois"
          style={{ height: 34, objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
        />
      </div>

      {TABS.map((tab) => {
        const count = tab.id === 'prets' ? pretsCount : undefined;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 16px',
              background: currentTab === tab.id ? (tab.color ? `${tab.color}20` : 'rgba(255,255,255,0.08)') : 'transparent',
              border: currentTab === tab.id ? `1px solid ${tab.color || 'rgba(255,255,255,0.15)'}` : '1px solid transparent',
              borderRadius: 8,
              color: currentTab === tab.id ? (tab.color || '#ffffff') : 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              fontFamily: 'system-ui, sans-serif',
              fontSize: 14, fontWeight: 600, transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (currentTab !== tab.id) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
              }
            }}
            onMouseLeave={(e) => {
              if (currentTab !== tab.id) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'transparent';
              }
            }}
          >
            {tab.icon === 'EAU_LOGO' ? <EauIcon /> : <span style={{ fontSize: 16 }}>{tab.icon}</span>}
            <span>{tab.label}</span>
            {count !== undefined && count > 0 && (
              <span style={{
                background: currentTab === tab.id ? tab.color : '#22c55e',
                color: 'white',
                fontSize: 12, fontWeight: 700,
                padding: '2px 8px', borderRadius: 10,
                minWidth: 20, textAlign: 'center',
              }}>
                {count}
              </span>
            )}
          </button>
        );
      })}

      <button
        onClick={() => deconnexion()}
        style={{
          marginLeft: 'auto', background: 'transparent',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 6, color: 'rgba(255,255,255,0.3)',
          padding: '6px 14px', cursor: 'pointer',
          fontSize: 12, fontFamily: 'system-ui, sans-serif',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
          e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'rgba(255,255,255,0.3)';
        }}
      >
        ← Se déconnecter
      </button>
    </div>
  );
}
