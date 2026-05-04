// ════════════════════════════════════════════════════════════════
// Module Achats — App standalone mobile-first (route /achats)
// ════════════════════════════════════════════════════════════════
// Auth : compte Supabase Auth partagé (TV) + PIN identifie l'acheteur
// Mobile-first : optimisé téléphone, big tap targets, full screen

import { useState, useEffect } from 'react';
import { AchatsPinLogin } from './components/AchatsPinLogin';
import { VueAchatsMobile } from './components/VueAchatsMobile';
import { ensureSharedAuth, getAchatsSession, clearAchatsSession, type AchatsSession } from './hooks/useAchatsAuth';

export default function AchatsApp() {
  const [session, setSession] = useState<AchatsSession | null>(getAchatsSession);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Auto-login compte Supabase Auth partagé au chargement
  useEffect(() => {
    ensureSharedAuth().then(ok => {
      if (!ok) setAuthError('Impossible de se connecter au serveur. Vérifie ta connexion.');
      setAuthReady(true);
    });
  }, []);

  if (!authReady) {
    return (
      <div style={{
        width: '100vw', height: '100dvh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'rgba(255,255,255,0.5)', fontSize: 14, fontFamily: 'monospace',
      }}>
        Connexion au serveur…
      </div>
    );
  }

  if (authError) {
    return (
      <div style={{
        width: '100vw', height: '100dvh',
        background: '#0f172a', color: 'white',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 24, gap: 16,
      }}>
        <span style={{ fontSize: 48 }}>⚠️</span>
        <div style={{ fontSize: 16, fontWeight: 700, textAlign: 'center' }}>{authError}</div>
        <button onClick={() => window.location.reload()}
          style={{ padding: '12px 24px', borderRadius: 10, border: 'none', background: '#10b981', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
          Réessayer
        </button>
      </div>
    );
  }

  if (!session) {
    return <AchatsPinLogin onLogged={setSession} />;
  }

  return <VueAchatsMobile session={session} onLogout={() => { clearAchatsSession(); setSession(null); }} />;
}
