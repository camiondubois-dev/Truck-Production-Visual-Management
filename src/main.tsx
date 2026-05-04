import { StrictMode, Component, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './contexts/AuthContext';
import { RoleProvider } from './contexts/RoleContext';
import { GarageProvider } from './contexts/GarageContext';
import { InventaireProvider } from './contexts/InventaireContext';
import { ClientProvider } from './contexts/ClientContext';
import { MoteurProvider } from './contexts/MoteurContext';
import { AchatProvider } from './contexts/AchatContext';
import App from './App.tsx';
import AchatsApp from './AchatsApp';
import { VueTerrain } from './components/VueTerrain';
import './index.css';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error;
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', background: '#1a1a2e', minHeight: '100dvh', color: 'white' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#ef4444', marginBottom: 16 }}>⚠️ Erreur de rendu</div>
          <pre style={{ background: 'rgba(255,255,255,0.05)', padding: 20, borderRadius: 8, fontSize: 13, overflow: 'auto', color: '#fca5a5' }}>
            {err.message}{'\n\n'}{err.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const path = window.location.pathname;
const isTerrainRoute = path.startsWith('/terrain');
const isAchatsRoute  = path.startsWith('/achats');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isTerrainRoute ? (
      // ── Route /terrain : app mobile mécanos ────────────────
      <ErrorBoundary>
        <InventaireProvider>
          <MoteurProvider>
            <VueTerrain />
          </MoteurProvider>
        </InventaireProvider>
      </ErrorBoundary>
    ) : isAchatsRoute ? (
      // ── Route /achats : module Achats standalone ────────────
      <ErrorBoundary>
        <AuthProvider>
          <InventaireProvider>
            <AchatProvider>
              <AchatsApp />
            </AchatProvider>
          </InventaireProvider>
        </AuthProvider>
      </ErrorBoundary>
    ) : (
      // ── App principale : production ─────────────────────────
      <ErrorBoundary>
        <AuthProvider>
          <RoleProvider>
            <GarageProvider>
              <InventaireProvider>
                <ClientProvider>
                  <MoteurProvider>
                    <App />
                  </MoteurProvider>
                </ClientProvider>
              </InventaireProvider>
            </GarageProvider>
          </RoleProvider>
        </AuthProvider>
      </ErrorBoundary>
    )}
  </StrictMode>
);
