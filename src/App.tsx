import { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { PageConnexion } from './components/PageConnexion';
import { VueDepartement } from './components/VueDepartement';
import { Navigation } from './components/Navigation';
import { PlancherView } from './components/PlancherView';
import { VueCamionsEau } from './components/VueCamionsEau';
import { VueClientsExternes } from './components/VueClientsExternes';
import { VueCamionsDetail } from './components/VueCamionsDetail';
import { VueInventaire } from './components/VueInventaire';
import { VueArchive } from './components/VueArchive';
import { VueClients } from './components/VueClients';
import { VueReservoirs } from './components/VueReservoirs';
import { VuePrets } from './components/VuePrets';

type Tab = 'plancher' | 'eau' | 'clients' | 'detail' | 'prets' | 'inventaire' | 'reservoirs' | 'baseclients' | 'archive';

export default function App() {
  const { profile, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<Tab>('plancher');

  if (loading) {
    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: '#0f0e0b',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'rgba(255,255,255,0.4)', fontSize: 14, fontFamily: 'monospace',
      }}>
        Chargement...
      </div>
    );
  }

  if (!profile) {
    return <PageConnexion />;
  }

  if (profile.role === 'employe') {
    return <VueDepartement />;
  }

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#0f0e0b' }}>
      <Navigation currentTab={currentTab} onTabChange={(id) => setCurrentTab(id as Tab)} />
      <div style={{ paddingTop: 60, width: '100%', height: '100%', boxSizing: 'border-box' }}>
        {currentTab === 'plancher'    && <PlancherView />}
        {currentTab === 'eau'         && <VueCamionsEau />}
        {currentTab === 'clients'     && <VueClientsExternes />}
        {currentTab === 'detail'      && <VueCamionsDetail />}
        {currentTab === 'prets'       && <VuePrets />}
        {currentTab === 'inventaire'  && <VueInventaire />}
        {currentTab === 'reservoirs'  && <VueReservoirs />}
        {currentTab === 'baseclients' && <VueClients />}
        {currentTab === 'archive'     && <VueArchive />}
      </div>
    </div>
  );
}
