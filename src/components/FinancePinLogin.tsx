// ════════════════════════════════════════════════════════════════
// Finance Mobile — Écran de connexion PIN fixe
// PIN configuré via VITE_FINANCE_PIN (variable d'environnement)
// rideau=true → écran noir "Touche pour reprendre" (absence < 60 s)
// ════════════════════════════════════════════════════════════════

import { useState } from 'react';

const COULEUR = '#f59e0b'; // amber / gold

export function FinancePinLogin({ onLogged, rideau = false }: { onLogged: () => void; rideau?: boolean }) {
  const [pin, setPin]       = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

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
    if (!correctPin) {
      setErreur('PIN non configuré (VITE_FINANCE_PIN manquant)');
      setPin('');
      return;
    }
    if (p === correctPin) {
      sessionStorage.setItem('finance_unlocked', '1');
      onLogged();
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
    // Auto-valider dès que la longueur correspond au PIN configuré
    if (next.length === pinLen) {
      setTimeout(() => validate(next), 120);
    }
  };

  const handleBackspace = () => { setErreur(null); setPin(p => p.slice(0, -1)); };
  const handleClear     = () => { setErreur(null); setPin(''); };
  const handleValidate  = () => { if (pin.length >= 4) validate(pin); };

  return (
    <div style={{
      width: '100vw', height: '100dvh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 20, color: 'white',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Logo */}
      <img
        src="/logo-camions-dubois-_-noir-bleu-1.png"
        alt="Camions Dubois"
        style={{ height: 56, marginBottom: 20, filter: 'brightness(0) invert(1)' }}
      />

      <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 6, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span>📊</span> FINANCES
      </div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 28, textAlign: 'center' }}>
        Entre ton code PIN pour accéder
      </div>

      {/* Cercles indicateurs PIN */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, height: 32 }}>
        {Array.from({ length: pinLen }).map((_, i) => (
          <div key={i} style={{
            width: 18, height: 18, borderRadius: '50%',
            background: i < pin.length ? COULEUR : 'transparent',
            border: `2px solid ${i < pin.length ? COULEUR : 'rgba(255,255,255,0.3)'}`,
            transition: 'all 0.15s',
            transform: i === pin.length - 1 ? 'scale(1.2)' : 'scale(1)',
          }} />
        ))}
      </div>

      {/* Erreur */}
      {erreur && (
        <div style={{
          background: 'rgba(220,38,38,0.15)',
          border: '1px solid rgba(220,38,38,0.4)',
          color: '#fca5a5',
          padding: '8px 16px', borderRadius: 8,
          fontSize: 13, fontWeight: 600,
          marginBottom: 16,
        }}>
          ⚠️ {erreur}
        </div>
      )}

      {/* Pavé numérique */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 14, width: '100%', maxWidth: 320,
      }}>
        {['1','2','3','4','5','6','7','8','9'].map(d => (
          <PinButton key={d} onClick={() => handleDigit(d)}>{d}</PinButton>
        ))}
        <PinButton onClick={handleClear} variant="secondary">C</PinButton>
        <PinButton onClick={() => handleDigit('0')}>0</PinButton>
        <PinButton onClick={handleBackspace} variant="secondary">⌫</PinButton>
      </div>

      {/* Bouton Entrer */}
      <button
        onClick={handleValidate}
        disabled={pin.length < 4}
        style={{
          marginTop: 24, width: '100%', maxWidth: 320,
          padding: '16px', borderRadius: 14, border: 'none',
          background: pin.length >= 4 ? COULEUR : 'rgba(255,255,255,0.1)',
          color: pin.length >= 4 ? 'white' : 'rgba(255,255,255,0.3)',
          fontSize: 16, fontWeight: 800,
          cursor: pin.length >= 4 ? 'pointer' : 'not-allowed',
          transition: 'all 0.15s',
        }}
      >
        → Entrer
      </button>

      {/* Lien retour */}
      <a href="/" style={{
        marginTop: 30, color: 'rgba(255,255,255,0.4)', fontSize: 12, textDecoration: 'none',
      }}>
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
