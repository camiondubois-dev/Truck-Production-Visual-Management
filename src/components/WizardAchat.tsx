import { useState, useEffect, useContext } from 'react';
import { useAchats } from '../contexts/AchatContext';
import { vendeurExterneService } from '../services/vendeurExterneService';
import { AuthContext } from '../contexts/AuthContext';
import type { VendeurExterne, TypeVendeur, EtatGeneral } from '../types/achatTypes';

const COULEUR = '#10b981';

export function WizardAchat({ onClose, onCree }: { onClose: () => void; onCree: (id: string) => void }) {
  const { creer } = useAchats();
  const auth = useContext(AuthContext);
  const userId = auth?.profile?.id;

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Étape 1 — photos (TODO: upload)
  // Pour MVP on passe sans photos, on peut les ajouter sur la fiche après création

  // Étape 2 — Identification
  const [marque, setMarque] = useState('');
  const [modele, setModele] = useState('');
  const [annee, setAnnee] = useState('');
  const [vin, setVin] = useState('');
  const [kilometrage, setKilometrage] = useState('');

  // Étape 3 — Specs et état
  const [etatGeneral, setEtatGeneral] = useState<EtatGeneral | ''>('');
  const [defautsConnus, setDefautsConnus] = useState('');

  // Étape 4 — Vendeur
  const [vendeursExt, setVendeursExt] = useState<VendeurExterne[]>([]);
  const [vendeurExterneId, setVendeurExterneId] = useState<string>('');
  const [vendeurNom, setVendeurNom] = useState('');
  const [vendeurType, setVendeurType] = useState<TypeVendeur>('particulier');
  const [vendeurTel, setVendeurTel] = useState('');
  const [vendeurEmail, setVendeurEmail] = useState('');
  const [vendeurAdresse, setVendeurAdresse] = useState('');
  const [vendeurNote, setVendeurNote] = useState('');
  const [sauverVendeur, setSauverVendeur] = useState(true);

  // Étape 5 — Source + prix
  const [source, setSource] = useState('');
  const [prixDemande, setPrixDemande] = useState('');

  useEffect(() => {
    vendeurExterneService.getAll(true).then(setVendeursExt).catch(console.error);
  }, []);

  // Préfill quand un vendeur existant est sélectionné
  useEffect(() => {
    if (!vendeurExterneId) return;
    const v = vendeursExt.find(x => x.id === vendeurExterneId);
    if (v) {
      setVendeurNom(v.nom);
      setVendeurType(v.type);
      setVendeurTel(v.telephonePrincipal ?? '');
      setVendeurEmail(v.email ?? '');
      setVendeurAdresse(v.adresse ?? '');
      setVendeurNote(v.note ?? '');
      setSauverVendeur(false); // déjà existant
    }
  }, [vendeurExterneId, vendeursExt]);

  const peutPasser = () => {
    if (step === 2) return marque.trim() && annee.trim();
    if (step === 4) return vendeurNom.trim() && vendeurTel.trim() && vendeurEmail.trim() && vendeurAdresse.trim();
    return true;
  };

  const handleCreer = async () => {
    if (!userId) { setErreur('Utilisateur non identifié'); return; }
    setErreur(null);
    setSaving(true);
    try {
      // Vendeur récurrent : créer/réutiliser si demandé
      let extId: string | undefined;
      if (vendeurExterneId) {
        extId = vendeurExterneId;
        await vendeurExterneService.incrementerUtilisation(vendeurExterneId);
      } else if (sauverVendeur && vendeurNom.trim()) {
        const ext = await vendeurExterneService.getOrCreate(vendeurNom.trim(), vendeurType);
        extId = ext.id;
        // mettre à jour les infos si vide
        await vendeurExterneService.mettreAJour(ext.id, {
          telephonePrincipal: vendeurTel.trim() || undefined,
          email: vendeurEmail.trim() || undefined,
          adresse: vendeurAdresse.trim() || undefined,
          note: vendeurNote.trim() || undefined,
        });
        await vendeurExterneService.incrementerUtilisation(ext.id);
      }

      const created = await creer({
        marque: marque.trim() || undefined,
        modele: modele.trim() || undefined,
        annee: annee.trim() ? parseInt(annee.trim()) : undefined,
        vin: vin.trim() || undefined,
        kilometrage: kilometrage.trim() ? parseInt(kilometrage.trim()) : undefined,
        specs: {},
        etatGeneral: etatGeneral || undefined,
        defautsConnus: defautsConnus.trim() || undefined,
        vendeurExterneId: extId,
        vendeurNom: vendeurNom.trim(),
        vendeurTelephone: vendeurTel.trim(),
        vendeurEmail: vendeurEmail.trim(),
        vendeurType,
        vendeurAdresse: vendeurAdresse.trim(),
        vendeurNote: vendeurNote.trim(),
        source: source.trim() || undefined,
        prixDemandeInitial: prixDemande.trim() ? parseFloat(prixDemande) : undefined,
        paye: false,
        statut: 'evaluation-initiale',
        acheteurId: userId,
      });

      onCree(created.id);
    } catch (e: any) {
      setErreur(String(e?.message ?? e));
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
        width: 720, maxWidth: '100%', maxHeight: '92vh', overflowY: 'auto',
        background: 'white', borderRadius: 14, boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#111827' }}>🛒 Nouvelle opportunité</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Étape {step}/5</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: '#9ca3af', cursor: 'pointer', padding: 4 }}>✕</button>
        </div>

        {/* Stepper */}
        <div style={{ display: 'flex', padding: '12px 24px', gap: 6 }}>
          {[1,2,3,4,5].map(s => (
            <div key={s} style={{
              flex: 1, height: 6, borderRadius: 3,
              background: s <= step ? COULEUR : '#e5e7eb',
              transition: 'all 0.2s',
            }} />
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {step === 1 && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>📸 Photos</h3>
              <div style={{ padding: 24, border: '2px dashed #d1d5db', borderRadius: 10, textAlign: 'center', color: '#6b7280', background: '#f8fafc' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
                <div style={{ fontWeight: 600 }}>Tu pourras ajouter les photos</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>directement depuis la fiche après création</div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>🚛 Identification</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Marque *">
                  <input value={marque} onChange={e => setMarque(e.target.value.toUpperCase())} placeholder="PACCAR, KENWORTH, FREIGHTLINER..." style={inputStyle} list="ach-marques" />
                  <datalist id="ach-marques">
                    <option value="PACCAR" /><option value="KENWORTH" /><option value="FREIGHTLINER" /><option value="WESTERN STAR" /><option value="VOLVO" /><option value="MACK" /><option value="INTERNATIONAL" /><option value="PETERBILT" />
                  </datalist>
                </Field>
                <Field label="Modèle">
                  <input value={modele} onChange={e => setModele(e.target.value)} placeholder="MX-13, T800, M2 106..." style={inputStyle} />
                </Field>
                <Field label="Année *">
                  <input type="number" value={annee} onChange={e => setAnnee(e.target.value)} placeholder="2018" min={1980} max={2030} style={inputStyle} />
                </Field>
                <Field label="VIN">
                  <input value={vin} onChange={e => setVin(e.target.value.toUpperCase())} placeholder="1FUJBBCG43LK12345" style={inputStyle} />
                </Field>
                <Field label="Kilométrage">
                  <input type="number" value={kilometrage} onChange={e => setKilometrage(e.target.value)} placeholder="350000" style={inputStyle} />
                </Field>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>🔧 État du camion</h3>
              <Field label="État général">
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(['excellent','bon','moyen','projet','pieces'] as EtatGeneral[]).map(e => {
                    const actif = etatGeneral === e;
                    const cfg = { excellent: { label: '⭐ Excellent', color: '#22c55e' },
                                  bon:        { label: '✓ Bon',      color: '#3b82f6' },
                                  moyen:      { label: '⚠ Moyen',    color: '#f59e0b' },
                                  projet:     { label: '🔨 Projet',   color: '#a855f7' },
                                  pieces:     { label: '🔧 Pièces',   color: '#dc2626' } }[e];
                    return (
                      <button key={e} type="button" onClick={() => setEtatGeneral(e)}
                        style={{ padding: '8px 14px', borderRadius: 8, fontWeight: actif ? 700 : 500, fontSize: 13,
                          border: actif ? `2px solid ${cfg.color}` : '1px solid #e5e7eb',
                          background: actif ? `${cfg.color}15` : 'white', color: actif ? cfg.color : '#6b7280', cursor: 'pointer' }}>
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Défauts connus / état (texte libre)">
                <textarea value={defautsConnus} onChange={e => setDefautsConnus(e.target.value)} rows={4}
                  placeholder="Ex: BLOW BY · pompe à fuel · piston faible · suspension à refaire..." style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
              </Field>
            </div>
          )}

          {step === 4 && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>👤 Vendeur</h3>
              {vendeursExt.length > 0 && (
                <Field label="Vendeur connu (préfille les infos)">
                  <select value={vendeurExterneId} onChange={e => setVendeurExterneId(e.target.value)} style={inputStyle}>
                    <option value="">— Nouveau vendeur —</option>
                    {vendeursExt.map(v => (
                      <option key={v.id} value={v.id}>{v.nom} ({v.type}{v.foisUtilise > 0 ? ` · ${v.foisUtilise}×` : ''})</option>
                    ))}
                  </select>
                </Field>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <Field label="Nom *">
                  <input value={vendeurNom} onChange={e => setVendeurNom(e.target.value)} placeholder="Jean Tremblay / Encan Manheim..." style={inputStyle} />
                </Field>
                <Field label="Type *">
                  <select value={vendeurType} onChange={e => setVendeurType(e.target.value as TypeVendeur)} style={inputStyle}>
                    <option value="particulier">Particulier</option>
                    <option value="concessionnaire">Concessionnaire</option>
                    <option value="encan">Encan</option>
                    <option value="flotte">Flotte</option>
                    <option value="autre">Autre</option>
                  </select>
                </Field>
                <Field label="Téléphone *">
                  <input value={vendeurTel} onChange={e => setVendeurTel(e.target.value)} placeholder="514-555-1234" style={inputStyle} />
                </Field>
                <Field label="Email *">
                  <input type="email" value={vendeurEmail} onChange={e => setVendeurEmail(e.target.value)} placeholder="vendeur@example.com" style={inputStyle} />
                </Field>
              </div>
              <Field label="Adresse complète *">
                <input value={vendeurAdresse} onChange={e => setVendeurAdresse(e.target.value)} placeholder="123 rue Principale, Ville, QC G0G 0G0" style={inputStyle} />
              </Field>
              <Field label="Note (préférences, horaires dispo, etc.)">
                <textarea value={vendeurNote} onChange={e => setVendeurNote(e.target.value)} rows={2} placeholder="Disponible soir et fin de semaine..." style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
              </Field>
              {!vendeurExterneId && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 12, color: '#6b7280' }}>
                  <input type="checkbox" checked={sauverVendeur} onChange={e => setSauverVendeur(e.target.checked)} />
                  Sauvegarder ce vendeur pour le réutiliser plus tard
                </label>
              )}
            </div>
          )}

          {step === 5 && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>💰 Source + prix demandé</h3>
              <Field label="Source de l'opportunité">
                <input value={source} onChange={e => setSource(e.target.value)} placeholder="Ex: Encan Manheim 30 avril 2025, AutoTrader, Référence Joel..." style={inputStyle} />
              </Field>
              <Field label="Prix demandé par le vendeur ($)">
                <input type="number" value={prixDemande} onChange={e => setPrixDemande(e.target.value)} placeholder="35000" style={inputStyle} />
              </Field>
              {erreur && <div style={{ marginTop: 10, padding: 10, borderRadius: 6, background: '#fee2e2', color: '#991b1b', fontWeight: 600, fontSize: 13 }}>⚠ {erreur}</div>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <button onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', fontWeight: 600, cursor: 'pointer' }}>
            {step === 1 ? 'Annuler' : '← Précédent'}
          </button>
          {step < 5 ? (
            <button onClick={() => peutPasser() && setStep(step + 1)} disabled={!peutPasser()}
              style={{ padding: '10px 22px', borderRadius: 8, border: 'none',
                background: peutPasser() ? COULEUR : '#e5e7eb', color: peutPasser() ? 'white' : '#9ca3af',
                fontWeight: 700, fontSize: 14, cursor: peutPasser() ? 'pointer' : 'not-allowed' }}>
              Suivant →
            </button>
          ) : (
            <button onClick={handleCreer} disabled={!peutPasser() || saving}
              style={{ padding: '10px 22px', borderRadius: 8, border: 'none',
                background: peutPasser() && !saving ? COULEUR : '#e5e7eb',
                color: peutPasser() && !saving ? 'white' : '#9ca3af',
                fontWeight: 700, fontSize: 14, cursor: peutPasser() && !saving ? 'pointer' : 'not-allowed' }}>
              {saving ? 'Création...' : '✓ Créer l\'opportunité'}
            </button>
          )}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
      <label style={{ fontSize: 12, color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </label>
      {children}
    </div>
  );
}
