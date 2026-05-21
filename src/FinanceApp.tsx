// ════════════════════════════════════════════════════════════════
// Module Finance — App standalone mobile-first (route /finance-mobile)
// Auth : PIN fixe local (VITE_FINANCE_PIN) + compte Supabase partagé (TV)
// Lecture seule — session sessionStorage (expire à la fermeture de l'onglet)
// Auto-lock : verrouillage automatique après 60 s en arrière-plan
// ════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { FinancePinLogin }   from './components/FinancePinLogin';
import { VueFinanceMobile }  from './components/VueFinanceMobile';
import { ensureSharedAuth }  from './hooks/useAchatsAuth';

// Délai avant verrouillage automatique (ms) — 60 secondes
const AUTO_LOCK_MS = 60_000;

const SK_UNLOCKED  = 'finance_unlocked';
const SK_HIDDEN_AT = 'finance_hidden_at';

function isUnlocked(): boolean {
  if (sessionStorage.getItem(SK_UNLOCKED) !== '1') return false;
  // Si l'app était en arrière-plan depuis plus de AUTO_LOCK_MS, verrouiller maintenant
  const hiddenAt = sessionStorage.getItem(SK_HIDDEN_AT);
  if (hiddenAt && Date.now() - parseInt(hiddenAt, 10) >= AUTO_LOCK_MS) {
    sessionStorage.removeItem(SK_UNLOCKED);
    sessionStorage.removeItem(SK_HIDDEN_AT);
    return false;
  }
  return true;
}

function lock(setUnlocked: (v: boolean) => void) {
  sessionStorage.removeItem(SK_UNLOCKED);
  sessionStorage.removeItem(SK_HIDDEN_AT);
  setUnlocked(false);
}

export default function FinanceApp() {
  const [unlocked,  setUnlocked]  = useState(isUnlocked);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  // Écran noir immédiat dès que l'app part en arrière-plan (même pendant la grâce)
  const [obscured, setObscured] = useState(false);

  // Connexion Supabase Auth partagé (compte TV) au chargement
  useEffect(() => {
    ensureSharedAuth().then(ok => {
      if (!ok) setAuthError('Impossible de se connecter au serveur. Vérifie ta connexion.');
      setAuthReady(true);
    });
  }, []);

  // ── Auto-lock sur visibilitychange ──────────────────────────────
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        // Masquer immédiatement le contenu (capture iOS App Switcher, etc.)
        setObscured(true);
        // Enregistre l'heure de départ en arrière-plan
        sessionStorage.setItem(SK_HIDDEN_AT, String(Date.now()));
      } else {
        // Retour au premier plan : vérifier si le délai est dépassé
        const hiddenAt = sessionStorage.getItem(SK_HIDDEN_AT);
        sessionStorage.removeItem(SK_HIDDEN_AT);
        if (hiddenAt && Date.now() - parseInt(hiddenAt, 10) >= AUTO_LOCK_MS) {
          lock(setUnlocked);
          // setObscured reste true jusqu'à ce que le PIN soit validé
        } else {
          // Absence courte : on lève le rideau
          setObscured(false);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
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

  // ── PIN non entré (ou verrouillé après absence) ──────────────────
  if (!unlocked || obscured) {
    return (
      <FinancePinLogin
        onLogged={() => {
          setUnlocked(true);
          setObscured(false);
        }}
        // Si obscured mais encore dans la grâce (unlocked=true), afficher un rideau discret
        rideau={obscured && unlocked}
      />
    );
  }

  // ── Module principal ────────────────────────────────────────────
  return (
    <VueFinanceMobile
      onLogout={() => { lock(setUnlocked); setObscured(false); }}
    />
  );
}
