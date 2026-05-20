// ════════════════════════════════════════════════════════════════
// Module Finance — App standalone mobile-first (route /finance-mobile)
// Auth : PIN fixe local (VITE_FINANCE_PIN) + compte Supabase partagé (TV)
// Lecture seule — session sessionStorage (expire à la fermeture de l'onglet)
// ════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { FinancePinLogin }   from './components/FinancePinLogin';
import { VueFinanceMobile }  from './components/VueFinanceMobile';
import { ensureSharedAuth }  from './hooks/useAchatsAuth';

function isUnlocked(): boolean {
  return sessionStorage.getItem('finance_unlocked') === '1';
}

export default function FinanceApp() {
  const [unlocked,  setUnlocked]  = useState(isUnlocked);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Connexion Supabase Auth partagé (compte TV) au chargement
  useEffect(() => {
    ensureSharedAuth().then(ok => {
      if (!ok) setAuthError('Impossible de se connecter au serveur. Vérifie ta connexion.');
      setAuthReady(true);
    });
  }, []);

  // ── Connexion en cours ──────────────────────────────────────────
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

  // ── Erreur de connexion ─────────────────────────────────────────
  if (authError) {
    return (
      <div style={{
        width: '100vw', height: '100dvh', background: '#0f172a', color: 'white',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 24, gap: 16, fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <span style={{ fontSize: 48 }}>⚠️</span>
        <div style={{ fontSize: 16, fontWeight: 700, textAlign: 'center' }}>{authError}</div>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '12px 24px', borderRadius: 10, border: 'none',
            background: '#f59e0b', color: 'white', fontWeight: 700, cursor: 'pointer',
          }}
        >
          Réessayer
        </button>
      </div>
    );
  }

  // ── PIN non entré ────────────────────────────────────────────────
  if (!unlocked) {
    return <FinancePinLogin onLogged={() => setUnlocked(true)} />;
  }

  // ── Module principal ────────────────────────────────────────────
  return (
    <VueFinanceMobile
      onLogout={() => {
        sessionStorage.removeItem('finance_unlocked');
        setUnlocked(false);
      }}
    />
  );
}
