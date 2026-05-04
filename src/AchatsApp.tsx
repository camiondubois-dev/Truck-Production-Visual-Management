// ════════════════════════════════════════════════════════════════
// Module Achats — App standalone (route /achats)
// ════════════════════════════════════════════════════════════════
// Application séparée de la production, avec son propre shell.
// Accessible via l'URL /achats — partage la même Supabase et le
// même Auth que l'app principale, mais interface dédiée à l'achat.

import { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { PageConnexion } from './components/PageConnexion';
import { VueAchats } from './components/VueAchats';

const COULEUR = '#10b981';

export default function AchatsApp() {
  const { profile, loading, deconnexion } = useAuth();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

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

  return (
    <div style={{ width: '100vw', height: '100dvh', overflow: 'hidden', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      {/* Header dédié Achats */}
      <div style={{
        flexShrink: 0,
        height: 60,
        background: '#0f172a',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px',
        borderBottom: `2px solid ${COULEUR}`,
      }}>
        {/* Gauche : logo + titre */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <img src="/logo-camions-dubois-_-noir-bleu-1.png" alt="Camions Dubois"
            style={{ height: 30, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            paddingLeft: 14, borderLeft: '1px solid rgba(255,255,255,0.15)',
          }}>
            <span style={{ fontSize: 22 }}>🛒</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'white', letterSpacing: '0.04em' }}>
                MODULE ACHATS
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Suivi des opportunités d'achat de camions
              </div>
            </div>
          </div>
        </div>

        {/* Droite : horloge + utilisateur + déconnexion + retour */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: 'white', lineHeight: 1, letterSpacing: '0.04em' }}>
              {now.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', lineHeight: 1, marginTop: 2 }}>
              {now.toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' })}
            </div>
          </div>

          <div style={{
            padding: '6px 12px', borderRadius: 6,
            background: 'rgba(16,185,129,0.15)', border: `1px solid ${COULEUR}40`,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: COULEUR }}>👤 {profile.nom ?? profile.email}</span>
          </div>

          <a href="/" style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 6, color: 'rgba(255,255,255,0.5)',
            padding: '6px 12px', cursor: 'pointer',
            fontSize: 12, textDecoration: 'none',
            transition: 'all 0.15s',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLAnchorElement).style.color = 'white'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.5)'; }}>
            🏭 App Production
          </a>

          <button
            onClick={() => deconnexion()}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 6, color: 'rgba(255,255,255,0.5)',
              padding: '6px 12px', cursor: 'pointer',
              fontSize: 12, transition: 'all 0.15s',
            }}>
            ← Se déconnecter
          </button>
        </div>
      </div>

      {/* Body : VueAchats prend tout le reste */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <VueAchats />
      </div>
    </div>
  );
}
