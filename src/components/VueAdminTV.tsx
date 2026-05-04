import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface TVAcces {
  id: string;
  garage_id: string;
  code: string;
  label: string;
  actif: boolean;
  created_at: string;
}

// Configurations TV prédéfinies — doivent correspondre aux clés dans VueTV.tsx TV_CONFIGS
const TV_PRESETS = [
  { garage_id: 'general',          label: 'Vue Générale',             description: 'Toutes les stations', color: '#f97316' },
  { garage_id: 'soudure-generale', label: 'Soudure Générale',         description: 'Soudure générale (slot 17)', color: '#f97316' },
  { garage_id: 'mecanique',        label: 'Mécanique',                description: 'Méc. Moteur + Méc. Générale + Sous-traitants', color: '#3b82f6' },
  { garage_id: 'spec',             label: 'Soudure Spéc. + Peinture', description: 'Soudure spécialisée + Peinture', color: '#f97316' },
  { garage_id: 'sous-traitants',   label: 'Sous-traitants',           description: 'Sous-traitants uniquement', color: '#a855f7' },
  { garage_id: 'suivi-vente',      label: 'Suivi Vente',              description: 'Tableau livraison camions vendus (showroom/bureau)', color: '#0ea5e9' },
];

export function VueAdminTV() {
  const [acces, setAcces] = useState<TVAcces[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Formulaire création
  const [showForm, setShowForm] = useState(false);
  const [formPreset, setFormPreset] = useState(TV_PRESETS[0].garage_id);
  const [formLabel, setFormLabel] = useState('');
  const [formCode, setFormCode] = useState('');
  const [codeConflict, setCodeConflict] = useState(false);

  const charger = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tv_acces')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) setErreur(error.message);
    else setAcces(data ?? []);
    setLoading(false);
  };

  useEffect(() => { charger(); }, []);

  // Vérifier conflit de code en temps réel
  useEffect(() => {
    const trimmed = formCode.trim().toUpperCase();
    if (!trimmed) { setCodeConflict(false); return; }
    setCodeConflict(acces.some(a => a.code === trimmed));
  }, [formCode, acces]);

  // Pré-remplir le label quand on change de preset
  useEffect(() => {
    const preset = TV_PRESETS.find(p => p.garage_id === formPreset);
    if (preset && !formLabel) setFormLabel(preset.label);
  }, [formPreset]);

  const handleCreer = async () => {
    const code = formCode.trim().toUpperCase();
    const label = formLabel.trim();
    if (!code || !label || codeConflict) return;
    setSaving(true);
    setErreur(null);
    const { error } = await supabase.from('tv_acces').insert({
      garage_id: formPreset,
      code,
      label,
      actif: true,
    });
    if (error) setErreur(error.message);
    else {
      setShowForm(false);
      setFormCode('');
      setFormLabel('');
      await charger();
    }
    setSaving(false);
  };

  const handleToggleActif = async (id: string, actif: boolean) => {
    setSaving(true);
    await supabase.from('tv_acces').update({ actif: !actif }).eq('id', id);
    await charger();
    setSaving(false);
  };

  const handleSupprimer = async (id: string) => {
    if (!confirm('Supprimer ce code TV ? Les TV connectées avec ce code seront déconnectées.')) return;
    setSaving(true);
    await supabase.from('tv_acces').delete().eq('id', id);
    await charger();
    setSaving(false);
  };

  const preset = TV_PRESETS.find(p => p.garage_id === formPreset)!;

  return (
    <div style={{
      width: '100%', height: '100%', background: '#0f0e0b',
      overflowY: 'auto', padding: '32px 40px', boxSizing: 'border-box',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <span style={{ fontSize: 28 }}>📺</span>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: 'white' }}>
              Accès TV par garage
            </h2>
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', maxWidth: 480 }}>
            Gérez les codes d'accès pour les écrans TV de chaque garage.
            Chaque code permet de connecter un écran à une vue spécifique.
          </div>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setFormCode(''); setFormLabel(''); setFormPreset(TV_PRESETS[0].garage_id); }}
          style={{
            background: '#f97316', border: 'none', borderRadius: 10,
            color: 'white', padding: '10px 20px', cursor: 'pointer',
            fontSize: 14, fontWeight: 700, flexShrink: 0,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#ea6c0a'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#f97316'; }}
        >
          + Nouveau code TV
        </button>
      </div>

      {erreur && (
        <div style={{
          marginBottom: 20, padding: '12px 16px',
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 8, color: '#f87171', fontSize: 14,
        }}>
          ⚠️ {erreur}
        </div>
      )}

      {/* Formulaire création */}
      {showForm && (
        <div style={{
          marginBottom: 28,
          background: '#1a1714',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 14, padding: '24px 28px',
          boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
        }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'white', marginBottom: 20 }}>
            Créer un nouveau code TV
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            {/* Choix du type de TV */}
            <div style={{ gridColumn: '1 / 3' }}>
              <label style={labelStyle}>Type de vue TV</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {TV_PRESETS.map(p => (
                  <button
                    key={p.garage_id}
                    onClick={() => {
                      setFormPreset(p.garage_id);
                      setFormLabel(p.label);
                    }}
                    style={{
                      background: formPreset === p.garage_id ? `${p.color}20` : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${formPreset === p.garage_id ? `${p.color}60` : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: 8, padding: '8px 14px',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <div style={{
                      fontSize: 13, fontWeight: 700,
                      color: formPreset === p.garage_id ? p.color : 'rgba(255,255,255,0.6)',
                    }}>
                      {p.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                      {p.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Label affiché sur la TV */}
            <div>
              <label style={labelStyle}>Nom affiché sur la TV</label>
              <input
                type="text"
                value={formLabel}
                onChange={e => setFormLabel(e.target.value)}
                placeholder={preset.label}
                style={inputStyle}
              />
            </div>

            {/* Code d'accès */}
            <div>
              <label style={labelStyle}>
                Code d'accès
                {codeConflict && (
                  <span style={{ color: '#f87171', marginLeft: 8, fontSize: 11 }}>
                    ⚠️ Code déjà utilisé
                  </span>
                )}
              </label>
              <input
                type="text"
                value={formCode}
                onChange={e => setFormCode(e.target.value.toUpperCase())}
                placeholder="ex: MECA"
                maxLength={12}
                style={{
                  ...inputStyle,
                  fontFamily: 'monospace', letterSpacing: '0.15em',
                  fontSize: 18, fontWeight: 900,
                  borderColor: codeConflict ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)',
                }}
              />
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>
                Majuscules recommandées — sera saisi sur la TV
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowForm(false)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8, color: 'rgba(255,255,255,0.5)',
                padding: '10px 20px', cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Annuler
            </button>
            <button
              onClick={handleCreer}
              disabled={saving || !formCode.trim() || !formLabel.trim() || codeConflict}
              style={{
                background: saving || !formCode.trim() || !formLabel.trim() || codeConflict
                  ? 'rgba(255,255,255,0.1)'
                  : '#f97316',
                border: 'none', borderRadius: 8,
                color: saving || !formCode.trim() || !formLabel.trim() || codeConflict
                  ? 'rgba(255,255,255,0.3)'
                  : 'white',
                padding: '10px 20px', cursor: saving || !formCode.trim() || codeConflict ? 'not-allowed' : 'pointer',
                fontSize: 14, fontWeight: 700,
                transition: 'all 0.15s',
              }}
            >
              {saving ? '⏳ Création...' : '→ Créer le code'}
            </button>
          </div>
        </div>
      )}

      {/* Liste des codes existants */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: 40 }}>
          Chargement...
        </div>
      ) : acces.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 40px',
          background: '#161410', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 14, color: 'rgba(255,255,255,0.25)', fontSize: 15,
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📺</div>
          Aucun code TV configuré.<br />
          Cliquez sur « Nouveau code TV » pour commencer.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {acces.map(a => {
            const presetInfo = TV_PRESETS.find(p => p.garage_id === a.garage_id);
            const color = presetInfo?.color ?? '#6b7280';
            return (
              <div
                key={a.id}
                style={{
                  background: '#161410',
                  border: `1px solid ${a.actif ? `${color}30` : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 12, padding: '16px 20px',
                  display: 'flex', alignItems: 'center', gap: 16,
                  opacity: a.actif ? 1 : 0.5,
                  transition: 'border-color 0.2s, opacity 0.2s',
                }}
              >
                {/* Indicateur couleur */}
                <div style={{
                  width: 4, height: 44, borderRadius: 2,
                  background: a.actif ? color : '#374151',
                  flexShrink: 0,
                }} />

                {/* Code TV */}
                <div style={{
                  background: a.actif ? `${color}15` : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${a.actif ? `${color}40` : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 8, padding: '6px 14px',
                  fontFamily: 'monospace', fontSize: 22, fontWeight: 900,
                  color: a.actif ? color : 'rgba(255,255,255,0.3)',
                  letterSpacing: '0.1em', minWidth: 80, textAlign: 'center',
                  flexShrink: 0,
                }}>
                  {a.code}
                </div>

                {/* Infos */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'white', marginBottom: 3 }}>
                    {a.label}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                    {presetInfo?.description ?? a.garage_id}
                    {' · '}
                    Créé le {new Date(a.created_at).toLocaleDateString('fr-CA')}
                  </div>
                </div>

                {/* Statut + actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700,
                    color: a.actif ? '#22c55e' : '#6b7280',
                    background: a.actif ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)',
                    border: `1px solid ${a.actif ? 'rgba(34,197,94,0.3)' : 'rgba(107,114,128,0.25)'}`,
                    borderRadius: 6, padding: '3px 10px',
                  }}>
                    {a.actif ? '● Actif' : '○ Inactif'}
                  </span>

                  <button
                    onClick={() => handleToggleActif(a.id, a.actif)}
                    disabled={saving}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 7, color: 'rgba(255,255,255,0.5)',
                      padding: '6px 12px', cursor: 'pointer', fontSize: 12,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                  >
                    {a.actif ? 'Désactiver' : 'Activer'}
                  </button>

                  <button
                    onClick={() => handleSupprimer(a.id)}
                    disabled={saving}
                    style={{
                      background: 'rgba(239,68,68,0.08)',
                      border: '1px solid rgba(239,68,68,0.2)',
                      borderRadius: 7, color: '#f87171',
                      padding: '6px 12px', cursor: 'pointer', fontSize: 12,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Instructions */}
      <div style={{
        marginTop: 40, padding: '20px 24px',
        background: 'rgba(249,115,22,0.06)',
        border: '1px solid rgba(249,115,22,0.15)',
        borderRadius: 12,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#f97316', marginBottom: 10 }}>
          📋 Comment utiliser les codes TV
        </div>
        <ol style={{
          margin: 0, paddingLeft: 20,
          color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 1.7,
        }}>
          <li>Sur l'écran TV du garage, ouvrez l'application dans le navigateur</li>
          <li>Cliquez sur « Accès TV / Garage »</li>
          <li>Entrez le code d'accès correspondant à ce garage</li>
          <li>L'écran affiche automatiquement la vue configurée</li>
          <li>Le code est mémorisé — la TV ne nécessite pas de reconnexion</li>
        </ol>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)',
  display: 'block', marginBottom: 6,
  textTransform: 'uppercase', letterSpacing: '0.06em',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.05)',
  color: 'white', fontSize: 14, outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'system-ui, sans-serif',
};
