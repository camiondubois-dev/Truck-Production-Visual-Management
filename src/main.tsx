import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './contexts/AuthContext';
import { RoleProvider } from './contexts/RoleContext';
import { GarageProvider } from './contexts/GarageContext';
import { InventaireProvider } from './contexts/InventaireContext';
import { ClientProvider } from './contexts/ClientContext';
import App from './App.tsx';
import { VueTerrain } from './components/VueTerrain';
import './index.css';

const isTerrainRoute = window.location.pathname.startsWith('/terrain');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isTerrainRoute ? (
      <InventaireProvider>
        <VueTerrain />
      </InventaireProvider>
    ) : (
      <AuthProvider>
        <RoleProvider>
          <GarageProvider>
            <InventaireProvider>
              <ClientProvider>
                <App />
              </ClientProvider>
            </InventaireProvider>
          </GarageProvider>
        </RoleProvider>
      </AuthProvider>
    )}
  </StrictMode>
);