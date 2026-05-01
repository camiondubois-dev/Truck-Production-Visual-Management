import { useState } from 'react';
import { useMoteurs } from '../contexts/MoteurContext';
import { ENGINE_ETAPES } from '../data/engineStations';
import type { EngineEtapeId } from '../data/engineStations';
import type { ProprietaireMoteur } from '../types/engineTypes';

export function WizardMoteur({ onClose, onCree }: { onClose: () => void; onCree: (id: string) => void }) {
  const { creer } = useMoteurs();

  const [stkNumero, setStkNumero] = useState('');
  const [workOrder, setWorkOrder] = useState('');
  const [descriptionMoteur, setDescriptionMoteur] = useState('');
  const [proprietaire, setProprietaire] = useState<ProprietaireMoteur>('interne');
  const [nomClient, setNomClient] = useState('');
  const [etatCommercial, setEtatCommercial] = useState('');
  const [notes, setNotes] = useState('');
  const [etapesACocher, setEtapesACocher] = useState<Set<EngineEtapeId>>(new Set());
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const toggleEtape = (id: EngineEtapeId) => {
    setEtapesACocher(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const cocherToutes = () => setEtapesACocher(new Set(ENGINE_ETAPES.map(e => e.id)));
  const decocherToutes = () => setEtapesACocher(new Set());

  const peutCreer = stkNumero.trim().length > 0 && etapesACocher.size > 0;

  const handleCreer = async () => {
    if (!peutCreer) return;
    setErreur(null);
    setSaving(true);
    try {
      // Construire le road_map à partir des étapes cochées (ordre = ordre canonique)
      const roadMap = ENGINE_ETAPES
        .filter(e => etapesACocher.has(e.id))
        .map((e, idx) => ({
          id: crypto.randomUUID(),
          etapeId: e.id,
          ordre: idx + 1,
          statut: 'planifie' as const,
        }));

      const m = await creer({
        stkNumero: stkNumero.trim(),
        workOrder: workOrder.trim() || undefined,
        descriptionMoteur: descriptionMoteur.trim() || undefined,
        proprietaire,
        nomClient: proprietaire === 'client' ? (nomClient.trim() || undefined) : undefined,
        etatCommercial: etatCommercial.trim() || undefined,
        notes: notes.trim() || undefined,
        statut: 'en-attente',
        roadMap,
      });

      onCree(m.id);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.includes('duplicate key') && msg.includes('stk_numero')) {
        setErreur(`Le numéro de stock "${stkNumero}" existe déjà.`);
      } else if (msg.includes('duplicate key') && msg.includes('work_order')) {
        setErreur(`Le W/O "${workOrder}" existe déjà.`);
      } else {
        setErreur(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 640, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto',
        background: 'white', borderRadius: 14, boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>🛠️ Nouveau moteur</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Saisie + sélection des étapes à faire</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: '#9ca3af', cursor: 'pointer', padding: 4 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* STK# + W/O */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Numéro stock (STK #) *" required>
              <input value={stkNumero} onChange={e => setStkNumero(e.target.value)}
                placeholder="35030" autoFocus
                style={inputStyle} />
            </Field>
            <Field label="Work Order (W/O)">
              <input value={workOrder} onChange={e => setWorkOrder(e.target.value)}
                placeholder="1-32491"
                style={inputStyle} />
            </Field>
          </div>

          {/* Description moteur */}
          <Field label="Description moteur">
            <input value={descriptionMoteur} onChange={e => setDescriptionMoteur(e.target.value)}
              placeholder="ex: PACCAR MX-13 EPA17 510 HP"
              style={inputStyle} />
          </Field>

          {/* Propriétaire */}
          <Field label="Propriétaire">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['interne', 'client', 'exportation', 'inventaire'] as ProprietaireMoteur[]).map(p => {
                const actif = proprietaire === p;
                return (
                  <button key={p} type="button" onClick={() => setProprietaire(p)}
                    style={{
                      padding: '8px 14px', borderRadius: 8, fontWeight: actif ? 700 : 500, fontSize: 13,
                      border: actif ? '2px solid #7c3aed' : '1px solid #e5e7eb',
                      background: actif ? '#ede9fe' : 'white', color: actif ? '#7c3aed' : '#6b7280',
                      cursor: 'pointer', textTransform: 'capitalize',
                    }}>
                    {p === 'interne' ? 'Interne' : p === 'client' ? 'Client' : p === 'exportation' ? 'Exportation' : 'Inventaire'}
                  </button>
                );
              })}
            </div>
          </Field>

          {/* Nom client (si client) */}
          {proprietaire === 'client' && (
            <Field label="Nom du client">
              <input value={nomClient} onChange={e => setNomClient(e.target.value)}
                placeholder="Nom de l'entreprise / personne"
                style={inputStyle} />
            </Field>
          )}

          {/* États commercial */}
          <Field label="État (libre)">
            <input value={etatCommercial} onChange={e => setEtatCommercial(e.target.value)}
              placeholder="ex: VENDU URGENT, À VENDRE, EN SOUMISSION..."
              style={inputStyle} />
          </Field>

          {/* Notes */}
          <Field label="Notes / problématique">
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="ex: TROUBLE POMPE A FUEL, BESOIN PIÈCES 350$..."
              rows={2}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
          </Field>

          {/* Étapes à faire */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ fontSize: 12, color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Étapes à faire * <span style={{ color: '#9ca3af', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>({etapesACocher.size}/{ENGINE_ETAPES.length})</span>
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={cocherToutes} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', color: '#7c3aed', fontWeight: 600 }}>
                  Tout cocher
                </button>
                <button type="button" onClick={decocherToutes} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', color: '#6b7280' }}>
                  Tout décocher
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ENGINE_ETAPES.map(e => {
                const coche = etapesACocher.has(e.id);
                return (
                  <label key={e.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 8,
                      border: coche ? `2px solid ${e.color}` : '1px solid #e5e7eb',
                      background: coche ? `${e.color}11` : 'white',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                    <input type="checkbox" checked={coche} onChange={() => toggleEtape(e.id)}
                      style={{ width: 18, height: 18, cursor: 'pointer', accentColor: e.color }} />
                    <span style={{ fontSize: 16 }}>{e.icon}</span>
                    <span style={{ fontSize: 14, fontWeight: coche ? 700 : 500, color: coche ? e.color : '#374151' }}>
                      {e.label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {erreur && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', fontSize: 13, fontWeight: 600 }}>
              ⚠️ {erreur}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose}
            style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', fontWeight: 600, cursor: 'pointer' }}>
            Annuler
          </button>
          <button onClick={handleCreer} disabled={!peutCreer || saving}
            style={{
              padding: '10px 22px', borderRadius: 8, border: 'none',
              background: !peutCreer || saving ? '#e5e7eb' : '#7c3aed',
              color: !peutCreer || saving ? '#9ca3af' : 'white',
              fontWeight: 700, fontSize: 14,
              cursor: !peutCreer || saving ? 'not-allowed' : 'pointer',
            }}>
            {saving ? 'Création...' : '✓ Créer le moteur'}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8,
  border: '1px solid #e5e7eb', fontSize: 14, outline: 'none',
  boxSizing: 'border-box', background: 'white', color: '#111827',
};

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
        {required && <span style={{ color: '#dc2626', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  );
}
