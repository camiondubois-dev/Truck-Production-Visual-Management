import { useState, useEffect } from 'react';
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
import { VueReservoirs } from './components/VueReservoirs';
import { VueLivraisons } from './components/VueLivraisons';
import { VueSuiviVente } from './components/VueSuiviVente';
import { VueMoteurs } from './components/VueMoteurs';
import { VueAnalyse } from './components/VueAnalyse';
import { VueTV } from './components/VueTV';
import { TVConnexion } from './components/TVConnexion';
import { VueAdminTV } from './components/VueAdminTV';
import { VueImport } from './components/VueImport';
import { VueProfitabilite } from './components/VueProfitabilite';
import { VueActivite } from './components/VueActivite';
import { getTVSession } from './hooks/useTVAccess';
import { supabase } from './lib/supabase';
import { useActiviteTracker } from './hooks/useActiviteTracker';
import { useAutoReload } from './hooks/useAutoReload';

type Tab = 'plancher' | 'eau' | 'clients' | 'detail' | 'livraisons' | 'suivi-vente' | 'moteurs' | 'inventaire' | 'reservoirs' | 'archive' | 'analyse' | 'tv-admin' | 'import' | 'profitabilite' | 'activite';

const VALID_TABS: Tab[] = ['plancher','eau','clients','detail','livraisons','suivi-vente','moteurs','inventaire','reservoirs','archive','analyse','tv-admin','import','profitabilite','activite'];
const LS_TAB_KEY = 'app_current_tab';

export default function App() {
  const { profile, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<Tab>(() => {
    try {
      const saved = localStorage.getItem(LS_TAB_KEY);
      if (saved && (VALID_TABS as string[]).includes(saved)) return saved as Tab;
    } catch { /* ignore */ }
    return 'livraisons';
  });
  const [showWizard, setShowWizard] = useState(false);

  // Rechargement automatique quand Netlify déploie une nouvelle version
  useAutoReload();

  // Tracking activité — log chaque changement d'onglet
  useActiviteTracker(profile?.nom, profile?.role, currentTab);

  // Nettoyage : si le compte TV s'est connecté par erreur (bug ancien ensureSharedAuth)
  // et qu'aucune session TV n'est sélectionnée → déconnexion automatique
  useEffect(() => {
    if (profile?.role === 'tv' && !getTVSession()) {
      supabase.auth.signOut().then(() => window.location.reload());
    }
  }, [profile]);

  // Persiste l'onglet courant pour survivre au refresh
  const handleTabChange = (id: string) => {
    setCurrentTab(id as Tab);
    try { localStorage.setItem(LS_TAB_KEY, id); } catch { /* ignore */ }
  };

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
      // Vues spéciales (non-garage) : Suivi Vente
      if (tvSession.garageId === 'suivi-vente') {
        return <VueSuiviVente />;
      }
      return <VueTV />;
    }
    // Pas de session TV sélectionnée → useEffect ci-dessus gère la déconnexion
    return (
      <div style={{ width: '100vw', height: '100dvh', background: '#0f0e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
        Reconnexion…
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100dvh', overflow: 'hidden', background: '#0f0e0b' }}>
      <Navigation
        currentTab={currentTab}
        onTabChange={handleTabChange}
        onNouveau={currentTab === 'plancher' ? () => setShowWizard(true) : undefined}
      />
      <div style={{ paddingTop: 60, width: '100%', height: '100%', boxSizing: 'border-box' }}>
        {currentTab === 'plancher'      && <PlancherView showWizard={showWizard} setShowWizard={setShowWizard} />}
        {currentTab === 'eau'           && <VueCamionsEau />}
        {currentTab === 'clients'       && <VueClientsExternes />}
        {currentTab === 'detail'        && <VueCamionsDetail />}
        {currentTab === 'livraisons'    && <VueLivraisons />}
        {currentTab === 'suivi-vente'   && <VueSuiviVente />}
        {currentTab === 'moteurs'       && <VueMoteurs />}
        {currentTab === 'inventaire'    && <VueInventaire />}
        {currentTab === 'reservoirs'    && <VueReservoirs />}
        {currentTab === 'archive'       && <VueArchive />}
        {/* Administration — gestion seulement */}
        {currentTab === 'analyse'       && <VueAnalyse />}
        {currentTab === 'tv-admin'      && <VueAdminTV />}
        {currentTab === 'import'        && <VueImport />}
        {currentTab === 'profitabilite' && <VueProfitabilite />}
        {currentTab === 'activite'      && <VueActivite />}
      </div>
    </div>
  );
}
