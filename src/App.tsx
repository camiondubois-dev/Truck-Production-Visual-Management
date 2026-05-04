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
import { VueLivraisons } from './components/VueLivraisons';
import { VueMoteurs } from './components/VueMoteurs';
import { VueAnalyse } from './components/VueAnalyse';
import { VueTV } from './components/VueTV';
import { TVConnexion } from './components/TVConnexion';
import { VueAdminTV } from './components/VueAdminTV';
import { getTVSession } from './hooks/useTVAccess';
import { supabase } from './lib/supabase';

type Tab = 'plancher' | 'eau' | 'clients' | 'detail' | 'prets' | 'livraisons' | 'moteurs' | 'inventaire' | 'reservoirs' | 'baseclients' | 'analyse' | 'archive' | 'tv-admin';

export default function App() {
  const { profile, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<Tab>('livraisons');
  const [showWizard, setShowWizard] = useState(false);

  if (loading) {
    return (
      <div style={{
        width: '100vw', height: '100dvh',
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

  // Rôle TV : vérifie si un garage est déjà sélectionné en localStorage
  if (profile.role === 'tv') {
    const tvSession = getTVSession();
    if (tvSession) {
      return <VueTV />;
    }
    return (
      <TVConnexion
        onConnecte={() => window.location.reload()}
        onRetourAdmin={async () => {
          await supabase.auth.signOut();
          window.location.reload();
        }}
      />
    );
  }

  return (
    <div style={{ width: '100vw', height: '100dvh', overflow: 'hidden', background: '#0f0e0b' }}>
      <Navigation
        currentTab={currentTab}
        onTabChange={(id) => setCurrentTab(id as Tab)}
        onNouveau={currentTab === 'plancher' ? () => setShowWizard(true) : undefined}
      />
      <div style={{ paddingTop: 60, width: '100%', height: '100%', boxSizing: 'border-box' }}>
        {currentTab === 'plancher'    && <PlancherView showWizard={showWizard} setShowWizard={setShowWizard} />}
        {currentTab === 'eau'         && <VueCamionsEau />}
        {currentTab === 'clients'     && <VueClientsExternes />}
        {currentTab === 'detail'      && <VueCamionsDetail />}
        {currentTab === 'prets'       && <VuePrets />}
        {currentTab === 'livraisons'  && <VueLivraisons />}
        {currentTab === 'moteurs'     && <VueMoteurs />}
        {currentTab === 'inventaire'  && <VueInventaire />}
        {currentTab === 'reservoirs'  && <VueReservoirs />}
        {currentTab === 'baseclients' && <VueClients />}
        {currentTab === 'analyse'     && <VueAnalyse />}
        {currentTab === 'archive'     && <VueArchive />}
        {currentTab === 'tv-admin'    && <VueAdminTV />}
      </div>
    </div>
  );
}
