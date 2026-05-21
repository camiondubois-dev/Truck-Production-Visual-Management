// ════════════════════════════════════════════════════════════════
// Finance Mobile — Écran de connexion PIN fixe
// PIN configuré via VITE_FINANCE_PIN (variable d'environnement)
// rideau=true → écran noir "Touche pour reprendre" (absence < 60 s)
// ════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { isBiometricSupported, isBiometricRegistered, registerBiometric, authenticateWithBiometric, removeBiometric } from '../hooks/useBiometric';

const COULEUR    = '#f59e0b'; // amber / gold
const APP_KEY_FI = 'finance';

export function FinancePinLogin({ onLogged, rideau = false }: { onLogged: () => void; rideau?: boolean }) {
  const [pin,          setPin]          = useState('');
  const [erreur,       setErreur]       = useState<string | null>(null);
  const [loading,      setLoading]      = useState(false);
  const [bioRegistred, setBioRegistred] = useState(() => isBiometricRegistered(APP_KEY_FI));
  const [bioSupport,   setBioSupport]   = useState(false);
  const [offrirBio,    setOffrirBio]    = useState(false);
  const [modePIN,      setModePIN]      = useState(!isBiometricRegistered(APP_KEY_FI));

  useEffect(() => {
    isBiometricSupported().then(setBioSupport);
  }, []);

  const handleSuccess = () => onLogged();

  // ── Authentification Face ID ───────────────────────────────────
  const lancerFaceId = async () => {
    setLoading(true);
    setErreur(null);
    const ok = await authenticateWithBiometric(APP_KEY_FI);
    setLoading(false);
    if (ok) {
      handleSuccess();
    } else {
      setErreur('Face ID non reconnu — entre ton code PIN');
      setModePIN(true);
    }
  };

  const activerFaceId = async () => {
    const ok = await registerBiometric(APP_KEY_FI);
    if (ok) { setBioRegistred(true); setBioSupport(true); }
    setOffrirBio(false);
    handleSuccess();
  };

  // ── Mode rideau : écran noir discret, un tap suffit pour reprendre ──
  if (rideau) {
    return (
      <div
        onClick={onLogged}
        style={{
          width: '100vw', height: '100dvh',
          background: '#000',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 16, cursor: 'pointer', userSelect: 'none',
        }}
      >
        <div style={{ fontSize: 52 }}>🔒</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.05em' }}>
          FINANCES
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
          Touche pour reprendre
        </div>
      </div>
    );
  }

  const correctPin = import.meta.env.VITE_FINANCE_PIN as string | undefined;
  const pinLen     = correctPin?.length ?? 6;

  const validate = (p: string) => {
    if (!correctPin) { setErreur('PIN non configuré (VITE_FINANCE_PIN manquant)'); setPin(''); return; }
    if (p === correctPin) {
      sessionStorage.setItem('finance_unlocked', '1');
      // Offrir Face ID après premier PIN réussi
      if (bioSupport && !bioRegistred) { setOffrirBio(true); }
      else { handleSuccess(); }
    } else {
      setErreur('PIN invalide');
      setPin('');
    }
  };

  const handleDigit = (d: string) => {
    setErreur(null);
    if (pin.length >= 8) return;
    const next = pin + d;
    setPin(next);
    if (next.length === pinLen) setTimeout(() => validate(next), 120);
  };

  const handleBackspace = () => { setErreur(null); setPin(p => p.slice(0, -1)); };
  const handleClear     = () => { setErreur(null); setPin(''); };
  const handleValidate  = () => { if (pin.length >= 4) validate(pin); };

  // ── Modal "Activer Face ID ?" ──────────────────────────────────
  if (offrirBio) {
    return (
      <div style={{ width: '100vw', height: '100dvh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16, color: 'white', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div style={{ fontSize: 64 }}>🔒</div>
        <div style={{ fontSize: 20, fontWeight: 800, textAlign: 'center' }}>Activer Face ID ?</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 1.5 }}>
          La prochaine fois, tu pourras accéder aux finances avec ton visage.
        </div>
        <button onClick={activerFaceId} style={{ width: '100%', maxWidth: 280, padding: '16px', borderRadius: 14, border: 'none', background: COULEUR, color: 'white', fontSize: 16, fontWeight: 800, cursor: 'pointer', marginTop: 8 }}>
          ✅ Activer Face ID
        </button>
        <button onClick={() => { setOffrirBio(false); handleSuccess(); }} style={{ width: '100%', maxWidth: 280, padding: '14px', borderRadius: 14, border: 'none', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.45)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          Non merci
        </button>
      </div>
    );
  }

  // ── Écran Face ID (si déjà enregistré et pas en mode PIN forcé) ──
  if (bioRegistred && !modePIN) {
    return (
      <div style={{ width: '100vw', height: '100dvh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, color: 'white', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <img src="/logo-camions-dubois-_-noir-bleu-1.png" alt="Camions Dubois" style={{ height: 56, marginBottom: 20, filter: 'brightness(0) invert(1)' }} />
        <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>📊</span> FINANCES
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 40 }}>Déverrouille avec Face ID</div>

        <button onClick={lancerFaceId} disabled={loading} style={{ width: 100, height: 100, borderRadius: '50%', border: `2px solid ${COULEUR}88`, background: loading ? `${COULEUR}18` : `${COULEUR}20`, color: 'white', fontSize: 44, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', marginBottom: 16, boxShadow: `0 0 30px ${COULEUR}30` }}>
          {loading ? '⏳' : '🔒'}
        </button>

        {loading
          ? <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Vérification…</div>
          : <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>Appuie pour Face ID</div>
        }
        {erreur && <div style={{ marginTop: 12, fontSize: 13, color: '#fca5a5', textAlign: 'center', maxWidth: 260 }}>⚠️ {erreur}</div>}

        <button onClick={() => { setModePIN(true); setErreur(null); }} style={{ marginTop: 32, background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
          Utiliser le code PIN
        </button>
        <button onClick={() => { removeBiometric(APP_KEY_FI); setBioRegistred(false); setModePIN(true); }} style={{ marginTop: 8, background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', fontSize: 11, cursor: 'pointer' }}>
          Désactiver Face ID
        </button>
      </div>
    );
  }

  // ── Écran PIN classique ───────────────────────────────────────
  return (
    <div style={{
      width: '100vw', height: '100dvh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 20, color: 'white', fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <img src="/logo-camions-dubois-_-noir-bleu-1.png" alt="Camions Dubois" style={{ height: 56, marginBottom: 20, filter: 'brightness(0) invert(1)' }} />
      <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 6, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span>📊</span> FINANCES
      </div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 28, textAlign: 'center' }}>
        Entre ton code PIN pour accéder
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, height: 32 }}>
        {Array.from({ length: pinLen }).map((_, i) => (
          <div key={i} style={{ width: 18, height: 18, borderRadius: '50%', background: i < pin.length ? COULEUR : 'transparent', border: `2px solid ${i < pin.length ? COULEUR : 'rgba(255,255,255,0.3)'}`, transition: 'all 0.15s', transform: i === pin.length - 1 ? 'scale(1.2)' : 'scale(1)' }} />
        ))}
      </div>

      {erreur && (
        <div style={{ background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.4)', color: '#fca5a5', padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
          ⚠️ {erreur}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, width: '100%', maxWidth: 320 }}>
        {['1','2','3','4','5','6','7','8','9'].map(d => (
          <PinButton key={d} onClick={() => handleDigit(d)}>{d}</PinButton>
        ))}
        <PinButton onClick={handleClear} variant="secondary">C</PinButton>
        <PinButton onClick={() => handleDigit('0')}>0</PinButton>
        <PinButton onClick={handleBackspace} variant="secondary">⌫</PinButton>
      </div>

      <button onClick={handleValidate} disabled={pin.length < 4}
        style={{ marginTop: 24, width: '100%', maxWidth: 320, padding: '16px', borderRadius: 14, border: 'none', background: pin.length >= 4 ? COULEUR : 'rgba(255,255,255,0.1)', color: pin.length >= 4 ? 'white' : 'rgba(255,255,255,0.3)', fontSize: 16, fontWeight: 800, cursor: pin.length >= 4 ? 'pointer' : 'not-allowed', transition: 'all 0.15s' }}>
        → Entrer
      </button>

      {/* Retour Face ID si enregistré */}
      {bioRegistred && (
        <button onClick={() => { setModePIN(false); setErreur(null); setPin(''); }} style={{ marginTop: 16, background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
          🔒 Utiliser Face ID
        </button>
      )}

      <a href="/" style={{ marginTop: 30, color: 'rgba(255,255,255,0.4)', fontSize: 12, textDecoration: 'none' }}>
        ← Retour app principale
      </a>
    </div>
  );
}

// ─── Bouton du pavé numérique ─────────────────────────────────────────────────

function PinButton({
  children, onClick, variant,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'secondary';
}) {
  return (
    <button
      onClick={onClick}
      style={{
        height: 70,
        background: variant === 'secondary' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.1)',
        border: `1px solid ${variant === 'secondary' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.15)'}`,
        borderRadius: 14, color: 'white',
        fontSize: variant === 'secondary' ? 18 : 28,
        fontWeight: 700, fontFamily: 'system-ui',
        cursor: 'pointer', transition: 'all 0.1s',
      }}
      onTouchStart={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.95)'; }}
      onTouchEnd={e   => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
      onMouseDown={e  => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.95)'; }}
      onMouseUp={e    => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
    >
      {children}
    </button>
  );
}
