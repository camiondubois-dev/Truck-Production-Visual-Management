import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function PageConnexion() {
  const { connexion } = useAuth();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleConnexion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !motDePasse) return;
    setErreur(null);
    setLoading(true);
    try {
      await connexion(email, motDePasse);
    } catch (err) {
      setErreur('Email ou mot de passe incorrect');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: '#0f0e0b',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 420, background: '#161410',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{
          padding: '32px 40px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        }}>
          <img
            src="/logo-camions-dubois-_-noir-bleu-1.png"
            alt="Camions Dubois"
            style={{ height: 48, objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
          />
          <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
            Connexion au système
          </div>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleConnexion} style={{ padding: '28px 40px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Adresse email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="nom@camionsdubois.com"
              autoFocus
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: 'white', fontSize: 14, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Mot de passe
            </label>
            <input
              type="password"
              value={motDePasse}
              onChange={e => setMotDePasse(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: 'white', fontSize: 14, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {erreur && (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#ef4444', fontSize: 13, fontWeight: 600,
            }}>
              ⚠️ {erreur}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !email || !motDePasse}
            style={{
              width: '100%', padding: '12px',
              borderRadius: 8, border: 'none',
              background: loading || !email || !motDePasse ? 'rgba(255,255,255,0.1)' : '#f97316',
              color: loading || !email || !motDePasse ? 'rgba(255,255,255,0.3)' : 'white',
              fontWeight: 700, fontSize: 15,
              cursor: loading || !email || !motDePasse ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s', marginTop: 8,
            }}
          >
            {loading ? '⏳ Connexion...' : '→ Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}