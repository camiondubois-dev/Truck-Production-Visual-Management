import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { reservoirService } from '../services/reservoirService';
import type { Reservoir, TypeReservoir, EtatReservoir } from '../types/reservoirTypes';

const TYPES_RESERVOIR: TypeReservoir[] = ['2500g', '3750g', '4000g', '5000g'];

const TYPE_COLORS: Record<TypeReservoir, string> = {
  '2500g': '#22c55e',
  '3750g': '#4a9eff',
  '4000g': '#f97316',
  '5000g': '#ef4444',
};

const genId = () => `res-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

type SourceCamion = 'production' | 'inventaire';

interface CamionOption {
  id: string;
  numero: string;
  variante?: string;
  marque?: string;
  modele?: string;
  annee?: number;
  source: SourceCamion;
}

function ModalInstallerCamion({
  reservoir,
  onConfirm,
  onClose,
}: {
  reservoir: Reservoir;
  onConfirm: (camionId: string, source: SourceCamion) => Promise<void>;
  onClose: () => void;
}) {
  const [camionsProduction, setCamionsProduction] = useState<CamionOption[]>([]);
  const [camionsInventaire, setCamionsInventaire] = useState<CamionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<{ id: string; source: SourceCamion } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('prod_items').select('id,numero,variante,marque,modele,annee,a_un_reservoir').eq('type', 'eau').neq('etat', 'termine'),
      supabase.from('prod_inventaire').select('id,numero,variante,marque,modele,annee,a_un_reservoir').eq('type', 'eau'),
    ]).then(([prodRes, invRes]) => {
      setCamionsProduction(
        ((prodRes.data ?? []) as any[])
          .filter(r => !r.a_un_reservoir)
          .map(r => ({ id: r.id, numero: r.numero, variante: r.variante ?? undefined, marque: r.marque ?? undefined, modele: r.modele ?? undefined, annee: r.annee ?? undefined, source: 'production' as SourceCamion }))
      );
      setCamionsInventaire(
        ((invRes.data ?? []) as any[])
          .filter(r => !r.a_un_reservoir)
          .map(r => ({ id: r.id, numero: r.numero, variante: r.variante ?? undefined, marque: r.marque ?? undefined, modele: r.modele ?? undefined, annee: r.annee ?? undefined, source: 'inventaire' as SourceCamion }))
      );
      setLoading(false);
    });
  }, []);

  const handleConfirm = async () => {
    if (!selected) return;
    setSubmitting(true);
    await onConfirm(selected.id, selected.source);
    setSubmitting(false);
  };

  const totalCamions = camionsProduction.length + camionsInventaire.length;

  const renderCamionButton = (c: CamionOption) => {
    const isSelected = selected?.id === c.id;
    return (
      <button
        key={c.id}
        onClick={() => setSelected({ id: c.id, source: c.source })}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '11px 13px', borderRadius: 10, cursor: 'pointer',
          border: isSelected ? '2px solid #f97316' : '1.5px solid #e5e7eb',
          background: isSelected ? '#fff7ed' : 'white',
          transition: 'all 0.15s', textAlign: 'left', width: '100%',
        }}
      >
        <div style={{
          width: 20, height: 20, borderRadius: 5, flexShrink: 0,
          border: isSelected ? '2px solid #f97316' : '2px solid #d1d5db',
          background: isSelected ? '#f97316' : 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isSelected && (
            <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
              <path d="M1 4L4 7.5L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
            #{c.numero}
            {c.variante && <span style={{ fontSize: 11, color: '#f97316', marginLeft: 8, fontWeight: 600 }}>{c.variante}</span>}
          </div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>
            {[c.marque, c.modele, c.annee].filter(Boolean).join(' ')}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: 16, width: 520, maxHeight: '82vh',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, color: '#111827' }}>Installer sur un camion</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              Réservoir #{reservoir.numero} — {reservoir.type}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9ca3af' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: 13 }}>Chargement...</div>
          ) : totalCamions === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: 13 }}>
              Aucun camion à eau disponible (tous ont déjà un réservoir)
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {camionsProduction.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f97316', display: 'inline-block' }} />
                    En production
                    <span style={{ background: '#fff7ed', color: '#c2410c', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 8 }}>
                      {camionsProduction.length}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {camionsProduction.map(renderCamionButton)}
                  </div>
                </div>
              )}

              {camionsInventaire.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                    En inventaire
                    <span style={{ background: '#f0fdf4', color: '#166534', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 8 }}>
                      {camionsInventaire.length}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {camionsInventaire.map(renderCamionButton)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', gap: 10, background: '#fafafa' }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: 13, color: '#374151', fontWeight: 600 }}
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selected || submitting}
            style={{
              flex: 2, padding: '9px', borderRadius: 8, border: 'none',
              background: selected && !submitting ? '#f97316' : '#e5e7eb',
              color: selected && !submitting ? 'white' : '#9ca3af',
              fontWeight: 700, fontSize: 13,
              cursor: selected && !submitting ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s',
            }}
          >
            {submitting ? 'Installation...' : 'Confirmer l\'installation'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalAjoutReservoir({
  onAjouter,
  onClose,
}: {
  onAjouter: (r: Reservoir) => Promise<void>;
  onClose: () => void;
}) {
  const [numero, setNumero] = useState('');
  const [type, setType] = useState<TypeReservoir>('4000g');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    if (!numero.trim()) return;
    setSubmitting(true);
    const r: Reservoir = {
      id: genId(),
      numero: numero.trim(),
      type,
      etat: 'disponible',
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await onAjouter(r);
    setSubmitting(false);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: 16, width: 440,
          boxShadow: '0 24px 64px rgba(0,0,0,0.3)', overflow: 'hidden',
        }}
      >
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 17, color: '#111827' }}>Ajouter un réservoir</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9ca3af' }}>✕</button>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Numéro *</label>
            <input
              type="text"
              value={numero}
              onChange={e => setNumero(e.target.value)}
              placeholder="RES-001"
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>Grosseur *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {TYPES_RESERVOIR.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  style={{
                    flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer',
                    border: type === t ? `2px solid ${TYPE_COLORS[t]}` : '1px solid #e5e7eb',
                    background: type === t ? `${TYPE_COLORS[t]}15` : 'white',
                    color: type === t ? TYPE_COLORS[t] : '#9ca3af',
                    fontWeight: type === t ? 700 : 400,
                    fontSize: 13, transition: 'all 0.15s',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notes optionnelles..."
              rows={2}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', gap: 10, background: '#fafafa' }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: 13, color: '#374151', fontWeight: 600 }}
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={!numero.trim() || submitting}
            style={{
              flex: 2, padding: '9px', borderRadius: 8, border: 'none',
              background: numero.trim() && !submitting ? '#f97316' : '#e5e7eb',
              color: numero.trim() && !submitting ? 'white' : '#9ca3af',
              fontWeight: 700, fontSize: 13,
              cursor: numero.trim() && !submitting ? 'pointer' : 'not-allowed',
            }}
          >
            {submitting ? 'Ajout...' : '+ Ajouter le réservoir'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function VueReservoirs() {
  const [reservoirs, setReservoirs] = useState<Reservoir[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtreType, setFiltreType] = useState<TypeReservoir | 'tous'>('tous');
  const [filtreEtat, setFiltreEtat] = useState<EtatReservoir | 'tous'>('tous');
  const [installerReservoir, setInstallerReservoir] = useState<Reservoir | null>(null);
  const [showModalAjout, setShowModalAjout] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    reservoirService.getAll()
      .then(setReservoirs)
      .catch(e => setErreur(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtres = reservoirs.filter(r => {
    if (filtreType !== 'tous' && r.type !== filtreType) return false;
    if (filtreEtat !== 'tous' && r.etat !== filtreEtat) return false;
    return true;
  });

  const disponibles = reservoirs.filter(r => r.etat === 'disponible').length;
  const installes   = reservoirs.filter(r => r.etat === 'installe').length;

  const handleAjouter = async (r: Reservoir) => {
    await reservoirService.ajouter(r);
    setReservoirs(prev => [r, ...prev]);
  };

  const handleInstaller = async (camionId: string, source: SourceCamion) => {
    if (!installerReservoir) return;
    setErreur(null);
    try {
      if (source === 'inventaire') {
        await reservoirService.installerSurInventaire(installerReservoir.id, camionId);
      } else {
        await reservoirService.installerSurCamion(installerReservoir.id, camionId);
      }
      setReservoirs(prev => prev.map(r =>
        r.id === installerReservoir.id ? { ...r, etat: 'installe', camionId } : r
      ));
      setInstallerReservoir(null);
    } catch (e: any) {
      setErreur(e.message ?? 'Erreur lors de l\'installation');
    }
  };

  const handleSupprimer = async (r: Reservoir) => {
    if (!confirm(`Supprimer le réservoir #${r.numero} ?`)) return;
    await reservoirService.supprimer(r.id);
    setReservoirs(prev => prev.filter(x => x.id !== r.id));
  };

  return (
    <div style={{ height: '100%', background: '#f8fafc', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 24px', borderBottom: '2px solid #e5e7eb', background: 'white',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 26 }}>🛢</span>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#374151', margin: 0 }}>Réservoirs</h1>
          <span style={{ background: '#374151', color: 'white', fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 12 }}>
            {reservoirs.length} total
          </span>
          <span style={{ background: '#22c55e', color: 'white', fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 12 }}>
            {disponibles} disponible{disponibles !== 1 ? 's' : ''}
          </span>
          {installes > 0 && (
            <span style={{ background: '#f97316', color: 'white', fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 12 }}>
              {installes} installé{installes !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowModalAjout(true)}
          style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#22c55e', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
        >
          + Ajouter
        </button>
      </div>

      {erreur && (
        <div style={{ margin: '12px 24px 0', padding: '10px 16px', borderRadius: 8, background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', fontSize: 13, fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
          {erreur}
          <button onClick={() => setErreur(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b', fontSize: 16 }}>✕</button>
        </div>
      )}

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 24px', borderBottom: '1px solid #e5e7eb', background: 'white', flexWrap: 'wrap' }}>
        {(['tous', ...TYPES_RESERVOIR] as (TypeReservoir | 'tous')[]).map(t => (
          <button
            key={t}
            onClick={() => setFiltreType(t)}
            style={{
              padding: '5px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 12,
              border: filtreType === t ? 'none' : '1px solid #e5e7eb',
              background: filtreType === t
                ? (t === 'tous' ? '#374151' : TYPE_COLORS[t as TypeReservoir])
                : 'white',
              color: filtreType === t ? 'white' : '#6b7280',
              fontWeight: filtreType === t ? 700 : 400,
            }}
          >
            {t === 'tous' ? 'Tous types' : t}
          </button>
        ))}
        <div style={{ width: 1, background: '#e5e7eb', margin: '0 4px' }} />
        {(['tous', 'disponible', 'installe'] as (EtatReservoir | 'tous')[]).map(e => (
          <button
            key={e}
            onClick={() => setFiltreEtat(e)}
            style={{
              padding: '5px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 12,
              border: filtreEtat === e ? 'none' : '1px solid #e5e7eb',
              background: filtreEtat === e
                ? (e === 'tous' ? '#374151' : e === 'disponible' ? '#22c55e' : '#f97316')
                : 'white',
              color: filtreEtat === e ? 'white' : '#6b7280',
              fontWeight: filtreEtat === e ? 700 : 400,
            }}
          >
            {e === 'tous' ? 'Tous états' : e === 'disponible' ? '✅ Disponible' : '🔧 Installé'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#9ca3af', fontSize: 14 }}>Chargement...</div>
        ) : filtres.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#9ca3af' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🛢</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
              {reservoirs.length === 0 ? 'Aucun réservoir dans l\'inventaire' : 'Aucun résultat pour ces filtres'}
            </div>
            {reservoirs.length === 0 && (
              <div style={{ fontSize: 13 }}>
                Cliquez sur <strong style={{ color: '#22c55e' }}>+ Ajouter</strong> pour commencer
              </div>
            )}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'white', zIndex: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                {['Numéro', 'Grosseur', 'État', 'Notes', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtres.map(r => (
                <tr
                  key={r.id}
                  style={{ borderBottom: '1px solid #f1f5f9', background: 'white', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                >
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: TYPE_COLORS[r.type] }}>
                      #{r.numero}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 10,
                      background: `${TYPE_COLORS[r.type]}18`, color: TYPE_COLORS[r.type],
                      border: `1px solid ${TYPE_COLORS[r.type]}40`,
                    }}>
                      {r.type}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {r.etat === 'disponible' ? (
                      <span style={{ fontSize: 11, background: '#dcfce7', color: '#166534', padding: '3px 10px', borderRadius: 6, fontWeight: 700 }}>
                        ✅ Disponible
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, background: '#fff7ed', color: '#c2410c', padding: '3px 10px', borderRadius: 6, fontWeight: 700 }}>
                        🔧 Installé
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: '#6b7280', maxWidth: 240 }}>
                    {r.notes ?? <span style={{ color: '#d1d5db' }}>—</span>}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      {r.etat === 'disponible' && (
                        <button
                          onClick={() => setInstallerReservoir(r)}
                          style={{
                            padding: '6px 14px', borderRadius: 6, border: 'none',
                            background: '#f97316', color: 'white',
                            fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          }}
                        >
                          Installer sur camion
                        </button>
                      )}
                      <button
                        onClick={() => handleSupprimer(r)}
                        style={{
                          padding: '6px 12px', borderRadius: 6,
                          border: '1px solid #fca5a5', background: 'transparent',
                          color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {installerReservoir && (
        <ModalInstallerCamion
          reservoir={installerReservoir}
          onConfirm={handleInstaller}
          onClose={() => setInstallerReservoir(null)}
        />
      )}

      {showModalAjout && (
        <ModalAjoutReservoir
          onAjouter={handleAjouter}
          onClose={() => setShowModalAjout(false)}
        />
      )}
    </div>
  );
}
