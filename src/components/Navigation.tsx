import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGarage } from '../hooks/useGarage';
import { EauIcon } from './EauIcon';
import { toutesEtapesCompletees } from '../utils/progressionUtils';
import type { Profile } from '../services/authService';

interface NavigationProps {
  currentTab: string;
  onTabChange: (tabId: string) => void;
  onNouveau?: () => void;
}

const TABS = [
  { id: 'plancher',    label: 'Vue Plancher',     icon: '🏭' },
  { id: 'eau',         label: 'Camions à eau',    icon: 'EAU_LOGO', color: '#f97316' },
  { id: 'detail',      label: 'Camions détail',   icon: '🏷️',       color: '#22c55e' },
  { id: 'livraisons',  label: 'Suivi livraisons', icon: '🚚',       color: '#dc2626' },
  { id: 'suivi-vente', label: 'Suivi vente',      icon: '🛒',       color: '#0ea5e9' },
  { id: 'moteurs',     label: 'Moteurs',          icon: '🛠️',      color: '#7c3aed' },
  { id: 'inventaire',  label: 'Inventaire',       icon: '📋',       color: '#1e293b' },
  { id: 'reservoirs',  label: 'Réservoirs',       icon: '🛢',       color: '#0ea5e9' },
  { id: 'archive',     label: 'Archive',          icon: '📦',       color: '#6b7280' },
];

const ADMIN_TABS = [
  { id: 'analyse',       label: 'Analyse',         icon: '📊', color: '#8b5cf6' },
  { id: 'tv-admin',      label: 'Modifications TV', icon: '📺', color: '#f97316' },
  { id: 'import',        label: 'Import',           icon: '📥', color: '#f59e0b' },
  { id: 'profitabilite', label: 'Profitabilité',    icon: '💹', color: '#22c55e' },
];

export function Navigation({ currentTab, onTabChange, onNouveau }: NavigationProps) {
  const { deconnexion, profile } = useAuth();
  const { items } = useGarage();
  const adminRef = useRef<HTMLDivElement>(null);
  const [dropdownLeft, setDropdownLeft] = useState(0);

  const [now, setNow] = useState(() => new Date());
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fermer le menu admin si clic en dehors
  useEffect(() => {
    if (!showAdmin) return;
    const handler = (e: MouseEvent) => {
      if (adminRef.current && !adminRef.current.contains(e.target as Node)) {
        setShowAdmin(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAdmin]);

  const isAdminTab = ADMIN_TABS.some(t => t.id === currentTab);

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      height: 60,
      background: '#0f0e0b',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      display: 'flex',
      alignItems: 'center',
      gap: 0,
      padding: '0 20px',
      zIndex: 100,
      overflow: 'hidden',
    }}>
      {/* Logo — fixe à gauche */}
      <div
        onClick={() => deconnexion()}
        style={{
          display: 'flex', alignItems: 'center', flexShrink: 0,
          cursor: 'pointer', padding: '4px 8px',
          borderRadius: 8, transition: 'background 0.15s', marginRight: 12,
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

      {/* Onglets — zone scrollable, prend l'espace disponible */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, overflow: 'hidden' }}>

        {/* Onglets principaux */}
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
              padding: '7px 12px',
              background: currentTab === tab.id ? (tab.color ? `${tab.color}20` : 'rgba(255,255,255,0.08)') : 'transparent',
              border: currentTab === tab.id ? `1px solid ${tab.color || 'rgba(255,255,255,0.15)'}` : '1px solid transparent',
              borderRadius: 8,
              color: currentTab === tab.id ? (tab.color || '#ffffff') : 'rgba(255,255,255,0.5)',
              cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
              fontSize: 13, fontWeight: 600, transition: 'all 0.2s', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { if (currentTab !== tab.id) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; } }}
            onMouseLeave={e => { if (currentTab !== tab.id) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; } }}
          >
            {tab.icon === 'EAU_LOGO' ? <EauIcon /> : <span style={{ fontSize: 15 }}>{tab.icon}</span>}
            <span>{tab.label}</span>
          </button>
        ))}

        {/* ── Menu Administration (gestion seulement) ── */}
        {profile?.role === 'gestion' && (
          <div ref={adminRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => {
                if (adminRef.current) {
                  setDropdownLeft(adminRef.current.getBoundingClientRect().left);
                }
                setShowAdmin(v => !v);
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 12px',
                background: isAdminTab ? '#6366f120' : showAdmin ? 'rgba(255,255,255,0.06)' : 'transparent',
                border: isAdminTab ? '1px solid #6366f1' : showAdmin ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
                borderRadius: 8,
                color: isAdminTab ? '#6366f1' : 'rgba(255,255,255,0.5)',
                cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
                fontSize: 13, fontWeight: 600, transition: 'all 0.2s', whiteSpace: 'nowrap',
              }}
            >
              <span style={{ fontSize: 15 }}>⚙️</span>
              <span>Administration</span>
              <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 2 }}>{showAdmin ? '▲' : '▼'}</span>
            </button>

            {/* Dropdown — position fixed pour échapper au overflow:hidden de la nav */}
            {showAdmin && (
              <div style={{
                position: 'fixed', top: 68, left: dropdownLeft,
                background: '#1a1917', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10, padding: 6, zIndex: 9999,
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                minWidth: 200,
              }}>
                {ADMIN_TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => { onTabChange(tab.id); setShowAdmin(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', padding: '9px 12px', borderRadius: 7,
                      background: currentTab === tab.id ? `${tab.color}20` : 'transparent',
                      border: 'none',
                      color: currentTab === tab.id ? tab.color : 'rgba(255,255,255,0.65)',
                      cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
                      fontSize: 13, fontWeight: currentTab === tab.id ? 700 : 500,
                      textAlign: 'left', transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { if (currentTab !== tab.id) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                    onMouseLeave={e => { if (currentTab !== tab.id) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ fontSize: 15 }}>{tab.icon}</span>
                    <span>{tab.label}</span>
                    {currentTab === tab.id && (
                      <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: tab.color, display: 'inline-block' }} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Droite — nouveau + horloge + déconnexion, toujours visible */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, paddingLeft: 12 }}>

        {/* Bouton + Nouveau (seulement sur Vue Plancher) */}
        {onNouveau && (
          <button
            onClick={onNouveau}
            style={{
              background: '#f97316', border: 'none', borderRadius: 8,
              color: 'white', padding: '7px 14px', cursor: 'pointer',
              fontSize: 13, fontWeight: 700, fontFamily: 'system-ui, sans-serif',
              whiteSpace: 'nowrap', transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = '#ea6c0a'}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = '#f97316'}
          >
            + Nouveau
          </button>
        )}

        {/* Horloge */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
          <span style={{
            fontFamily: 'monospace', fontSize: 15, fontWeight: 700,
            color: 'white', letterSpacing: '0.04em', lineHeight: 1,
          }}>
            {now.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', lineHeight: 1, whiteSpace: 'nowrap' }}>
            {now.toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
        </div>

        {/* Déconnexion */}
        <button
          onClick={() => deconnexion()}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6, color: 'rgba(255,255,255,0.3)',
            padding: '6px 14px', cursor: 'pointer',
            fontSize: 12, fontFamily: 'system-ui, sans-serif',
            transition: 'all 0.2s', whiteSpace: 'nowrap',
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
    </div>
  );
}
