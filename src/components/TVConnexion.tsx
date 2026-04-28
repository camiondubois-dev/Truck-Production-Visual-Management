import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { saveTVSession } from '../hooks/useTVAccess';

interface TVConnexionProps {
  onConnecte: () => void;       // callback après connexion réussie
  onRetourAdmin: () => void;    // retour vers login admin
}

export function TVConnexion({ onConnecte, onRetourAdmin }: TVConnexionProps) {
  const [code, setCode]       = useState('');
  const [erreur, setErreur]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setErreur(null);
    setLoading(true);

    try {
      // 1. Valider le code dans la table tv_acces
      const { data, error } = await supabase
        .from('tv_acces')
        .select('garage_id, label, actif')
        .eq('code', code.trim().toUpperCase())
        .maybeSingle();

      if (error || !data) {
        setErreur('Code invalide. Vérifiez le code dans la page admin → TV.');
        setLoading(false);
        return;
      }
      if (!data.actif) {
        setErreur('Ce code a été désactivé par l\'administrateur.');
        setLoading(false);
        return;
      }

      // 2. Connexion Supabase avec le compte TV partagé
      const tvEmail    = import.meta.env.VITE_TV_EMAIL;
      const tvPassword = import.meta.env.VITE_TV_PASSWORD;

      if (!tvEmail || !tvPassword) {
        setErreur('Configuration TV manquante (VITE_TV_EMAIL / VITE_TV_PASSWORD).');
        setLoading(false);
        return;
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: tvEmail,
        password: tvPassword,
      });

      if (authError) {
        setErreur('Erreur de connexion au compte TV. Contactez l\'admin.');
        setLoading(false);
        return;
      }

      // 3. Sauvegarder le garage dans localStorage
      saveTVSession(data.garage_id, data.label, code.trim().toUpperCase());
      onConnecte();

    } catch (err: any) {
      setErreur(err?.message ?? 'Erreur inconnue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      width: '100vw', height: '100dvh',
      background: '#0a0908',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 40,
    }}>
      <img
        src="/logo-camions-dubois-_-noir-bleu-1.png"
        alt="Camions Dubois"
        style={{ height: 56, objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.6 }}
      />

      <div style={{
        width: 520, background: '#161410',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20, overflow: 'hidden',
        boxShadow: '0 40px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Header */}
        <div style={{
          padding: '36px 48px 28px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(249,115,22,0.08), transparent)',
        }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>📺</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'white', marginBottom: 8 }}>
            Interface TV Garage
          </div>
          <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.35)' }}>
            Entrez le code d'accès de ce garage
          </div>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} style={{ padding: '32px 48px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="ex: MECA"
            autoFocus
            maxLength={12}
            style={{
              width: '100%', padding: '18px 24px',
              borderRadius: 12, border: '1.5px solid rgba(255,255,255,0.12)',
              background: 'rgba(255,255,255,0.06)',
              color: 'white', fontSize: 32, fontWeight: 900,
              letterSpacing: '0.2em', textAlign: 'center',
              outline: 'none', boxSizing: 'border-box',
              fontFamily: 'monospace',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = '#f97316')}
            onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
          />

          {erreur && (
            <div style={{
              padding: '12px 16px', borderRadius: 10,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#f87171', fontSize: 14, textAlign: 'center', fontWeight: 600,
            }}>
              ⚠️ {erreur}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !code.trim()}
            style={{
              width: '100%', padding: '16px',
              borderRadius: 12, border: 'none',
              background: loading || !code.trim() ? 'rgba(255,255,255,0.08)' : '#f97316',
              color: loading || !code.trim() ? 'rgba(255,255,255,0.25)' : 'white',
              fontWeight: 800, fontSize: 18,
              cursor: loading || !code.trim() ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s', marginTop: 4,
              boxShadow: loading || !code.trim() ? 'none' : '0 4px 20px rgba(249,115,22,0.4)',
            }}
          >
            {loading ? '⏳ Vérification...' : '→ Accéder au garage'}
          </button>
        </form>
      </div>

      <button
        onClick={onRetourAdmin}
        style={{
          background: 'transparent', border: 'none',
          color: 'rgba(255,255,255,0.25)', fontSize: 13, cursor: 'pointer',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        ← Retour connexion administrateur
      </button>

      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.15)', textAlign: 'center' }}>
        Le code est affiché dans l'espace Admin → 📺 TV
      </div>
    </div>
  );
}
