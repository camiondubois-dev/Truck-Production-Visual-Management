import { useState, useEffect, useContext, useMemo } from 'react';
import { useAchats } from '../contexts/AchatContext';
import { AuthContext } from '../contexts/AuthContext';
import { useInventaire } from '../contexts/InventaireContext';
import { achatService } from '../services/achatService';
import { conducteurService } from '../services/conducteurService';
import type {
  Achat, EvaluationInitiale, EvaluationFinale, DecisionAchat,
  AchatTowing, Conducteur, AchatPhoto, DestinationAchat, ModeTransport,
  Recommandation,
} from '../types/achatTypes';
import { LABELS_STATUT, COULEURS_STATUT } from '../types/achatTypes';
import { supabase } from '../lib/supabase';

const COULEUR = '#10b981';

export function FicheAchat({ achat, onClose }: { achat: Achat; onClose: () => void }) {
  const { mettreAJour } = useAchats();
  const { ajouterVehicule } = useInventaire();
  const auth = useContext(AuthContext);
  const me = auth?.profile;

  const [photos, setPhotos] = useState<AchatPhoto[]>([]);
  const [evalInits, setEvalInits] = useState<EvaluationInitiale[]>([]);
  const [evalFinales, setEvalFinales] = useState<EvaluationFinale[]>([]);
  const [decisions, setDecisions] = useState<DecisionAchat[]>([]);
  const [towing, setTowing] = useState<AchatTowing | null>(null);
  const [conducteurs, setConducteurs] = useState<Conducteur[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, { nom: string; rolesAchat: string[] }>>({});

  // Charger les data liées
  const reload = async () => {
    const [p, ei, ef, dec, tw] = await Promise.all([
      achatService.getPhotos(achat.id),
      achatService.getEvaluationsInitiales(achat.id),
      achatService.getEvaluationsFinales(achat.id),
      achatService.getDecisions(achat.id),
      achatService.getTowing(achat.id),
    ]);
    setPhotos(p); setEvalInits(ei); setEvalFinales(ef); setDecisions(dec); setTowing(tw);
  };

  useEffect(() => {
    reload();
    conducteurService.getAll().then(setConducteurs).catch(console.error);
    // Charger profiles pour afficher noms
    supabase.from('profiles').select('id, nom, roles_achat').then(({ data }) => {
      const m: Record<string, { nom: string; rolesAchat: string[] }> = {};
      for (const p of (data ?? [])) m[p.id] = { nom: p.nom ?? '?', rolesAchat: p.roles_achat ?? [] };
      setProfilesById(m);
    });
  }, [achat.id]);

  const myRoles = me ? (profilesById[me.id]?.rolesAchat ?? []) : [];
  const isAcheteurPrincipal = myRoles.includes('acheteur-principal');
  const isEvalFinale        = myRoles.includes('evaluateur-final');
  const isApprobPieces      = myRoles.includes('approbateur-pieces');
  const isApprobVente       = myRoles.includes('approbateur-vente');
  const isApprobateur       = isApprobPieces || isApprobVente;
  const isPaiementAdmin     = myRoles.includes('paiement-admin');
  const isInventaireAdmin   = myRoles.includes('inventaire-admin');

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.4)',
      display: 'flex', justifyContent: 'flex-end',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 640, maxWidth: '100vw', height: '100dvh',
        background: 'white', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
        overflowY: 'auto', color: '#111827',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, background: 'white', zIndex: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#0f172a' }}>
                {[achat.annee, achat.marque, achat.modele].filter(Boolean).join(' ') || 'Sans titre'}
              </div>
              {achat.vin && <div style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace', marginTop: 2 }}>VIN : {achat.vin}</div>}
            </div>
            <button onClick={onClose} style={{ background: '#f3f4f6', border: 'none', width: 32, height: 32, borderRadius: 6, fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>✕</button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 4, background: `${COULEURS_STATUT[achat.statut]}20`, color: COULEURS_STATUT[achat.statut] }}>
              {LABELS_STATUT[achat.statut]}
            </span>
            {achat.destination === 'pieces' && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 4, background: '#fef3c7', color: '#92400e' }}>🔧 PIÈCES</span>
            )}
            {achat.destination === 'vente-detail' && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 4, background: '#dcfce7', color: '#166534' }}>🏷️ VENTE DÉTAIL</span>
            )}
            {achat.paye && <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 4, background: '#dcfce7', color: '#166534' }}>💰 PAYÉ</span>}
          </div>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Identification ─────────────── */}
          <Section title="🚛 Identification">
            <KV label="Marque"      value={achat.marque ?? '—'} />
            <KV label="Modèle"      value={achat.modele ?? '—'} />
            <KV label="Année"       value={achat.annee ? String(achat.annee) : '—'} />
            <KV label="VIN"         value={achat.vin ?? '—'} />
            <KV label="Kilométrage" value={achat.kilometrage ? `${achat.kilometrage.toLocaleString()} km` : '—'} />
            <KV label="État"        value={achat.etatGeneral ?? '—'} />
            {achat.defautsConnus && <KV label="Défauts" value={achat.defautsConnus} multiline />}
          </Section>

          {/* ── Vendeur ────────────────────── */}
          <Section title="👤 Vendeur">
            <KV label="Nom"       value={achat.vendeurNom} />
            <KV label="Type"      value={achat.vendeurType} />
            <KV label="Téléphone" value={achat.vendeurTelephone} />
            <KV label="Email"     value={achat.vendeurEmail} />
            <KV label="Adresse"   value={achat.vendeurAdresse} />
            {achat.vendeurNote && <KV label="Note" value={achat.vendeurNote} multiline />}
            {achat.source && <KV label="Source" value={achat.source} />}
          </Section>

          {/* ── Prix ───────────────────────── */}
          <Section title="💰 Prix">
            <KV label="Demandé"     value={achat.prixDemandeInitial != null ? `${achat.prixDemandeInitial.toLocaleString()} $` : '—'} />
            <KV label="Approuvé"    value={achat.prixApprouve != null ? `${achat.prixApprouve.toLocaleString()} $` : '—'} />
            <KV label="Contre-offre" value={achat.prixContreOffre != null ? `${achat.prixContreOffre.toLocaleString()} $` : '—'} />
            <KV label="Payé"        value={achat.prixPaye != null ? `${achat.prixPaye.toLocaleString()} $` : '—'} />
          </Section>

          {/* ── Évaluation initiale (Phase 2) ── */}
          {(achat.statut === 'evaluation-initiale' || evalInits.length > 0) && (
            <SectionEvalInit achat={achat} evals={evalInits} profiles={profilesById} canEvaluate={isAcheteurPrincipal} userId={me?.id}
              onSaved={async () => { await reload(); /* check si 2 évals → passer à finale */
                const refreshed = await achatService.getEvaluationsInitiales(achat.id);
                if (refreshed.length >= 2 && achat.statut === 'evaluation-initiale') {
                  await mettreAJour(achat.id, { statut: 'evaluation-finale' });
                }
              }} />
          )}

          {/* ── Évaluation finale (Phase 3) ── */}
          {(['evaluation-finale','a-approuver','approuve-a-offrir','offre-faite','contre-offre','acceptee','refusee'].includes(achat.statut) || evalFinales.length > 0) && (
            <SectionEvalFinale achat={achat} evals={evalFinales} profiles={profilesById} canEvaluate={isEvalFinale} userId={me?.id}
              onSaved={async () => { await reload();
                const refreshed = await achatService.getEvaluationsFinales(achat.id);
                if (refreshed.length >= 1 && achat.statut === 'evaluation-finale') {
                  await mettreAJour(achat.id, { statut: 'a-approuver' });
                }
              }} />
          )}

          {/* ── Approbation (Phase 4) ── */}
          {achat.statut === 'a-approuver' && isApprobateur && me && (
            <SectionApprobation achat={achat} userId={me.id} canPieces={isApprobPieces} canVente={isApprobVente}
              onApprouve={async (destination, prix, note) => {
                await mettreAJour(achat.id, { destination, approbateurId: me.id, prixApprouve: prix, statut: 'approuve-a-offrir' });
                await achatService.ajouterDecision({ achatId: achat.id, decideurId: me.id, type: 'approbation', montant: prix, destination, note });
                await reload();
              }}
              onRefuse={async (note) => {
                await mettreAJour(achat.id, { statut: 'refusee', annulationMotif: note });
                await achatService.ajouterDecision({ achatId: achat.id, decideurId: me.id, type: 'refus', note });
                await reload();
              }} />
          )}

          {/* ── Offre / Contre-offre (Phase 5) ── */}
          {['approuve-a-offrir','offre-faite','contre-offre'].includes(achat.statut) && (
            <SectionOffre achat={achat} userId={me?.id} canApprover={isApprobateur}
              onOffreFaite={async () => { await mettreAJour(achat.id, { statut: 'offre-faite' }); await reload(); }}
              onAcceptee={async () => { await mettreAJour(achat.id, { statut: 'acceptee', prixPaye: achat.prixContreOffre ?? achat.prixApprouve }); await reload(); }}
              onContreOffre={async (montant) => { await mettreAJour(achat.id, { statut: 'contre-offre', prixContreOffre: montant }); await reload(); }}
              onContreOffreAcceptee={async () => {
                if (!me) return;
                await mettreAJour(achat.id, { statut: 'acceptee', prixApprouve: achat.prixContreOffre ?? achat.prixApprouve, prixPaye: achat.prixContreOffre ?? achat.prixApprouve });
                await achatService.ajouterDecision({ achatId: achat.id, decideurId: me.id, type: 'contre-offre-acceptee', montant: achat.prixContreOffre ?? undefined });
                await reload();
              }}
              onRefusee={async (motif) => {
                if (!me) return;
                await mettreAJour(achat.id, { statut: 'refusee', annulationMotif: motif });
                await achatService.ajouterDecision({ achatId: achat.id, decideurId: me.id, type: 'refus', note: motif });
                await reload();
              }} />
          )}

          {/* ── Achat conclu (Phase 6) ── */}
          {achat.statut === 'acceptee' && (
            <SectionConclure achat={achat} userId={me?.id}
              onConclure={async (data) => {
                if (!me) return;
                await mettreAJour(achat.id, {
                  ententesVendeur: data.ententes,
                  modeTransport: data.transport,
                  adressePickup: data.adresse,
                  contactPickup: data.contact,
                  horairesPickup: data.horaires,
                  statut: 'achete-a-payer-a-ramasser',
                });
                // Notifier Michael + Christina
                const { data: paiementAdmins } = await supabase.from('profiles').select('id').contains('roles_achat', ['paiement-admin']);
                for (const p of paiementAdmins ?? []) {
                  await achatService.creerNotification(p.id, achat.id, 'achat-conclu', `Camion acheté : ${achat.marque} ${achat.modele} — à payer + à ramasser`);
                }
                await reload();
              }} />
          )}

          {/* ── Paiement (Phase 7) ── */}
          {['achete-a-payer-a-ramasser','paye-a-ramasser','en-towing','arrive'].includes(achat.statut) && (
            <SectionPaiement achat={achat} canPay={isPaiementAdmin} userId={me?.id}
              onTogglePaye={async () => {
                if (!me) return;
                const nouveau = !achat.paye;
                await mettreAJour(achat.id, {
                  paye: nouveau,
                  datePaiement: nouveau ? new Date().toISOString() : undefined,
                  paiementParId: nouveau ? me.id : undefined,
                  statut: nouveau ? (achat.modeTransport === 'roule' ? 'paye-a-ramasser' : 'paye-a-ramasser') : 'achete-a-payer-a-ramasser',
                });
                await reload();
              }} />
          )}

          {/* ── Towing (Phase 8) ── */}
          {['acceptee','achete-a-payer-a-ramasser','paye-a-ramasser','en-towing','arrive'].includes(achat.statut) && achat.modeTransport && (
            <SectionTowing achat={achat} towing={towing} conducteurs={conducteurs}
              onSave={async (updates) => { await achatService.upsertTowing({ achatId: achat.id, ...updates }); await reload(); }}
              onArrive={async () => {
                await mettreAJour(achat.id, { statut: 'arrive' });
                if (achat.modeTransport === 'towing') {
                  await achatService.upsertTowing({ achatId: achat.id, statut: 'arrive', dateArrivee: new Date().toISOString() });
                }
                await reload();
              }} />
          )}

          {/* ── Transfert vers inventaire (Phase 9) ── */}
          {achat.statut === 'arrive' && (isInventaireAdmin || me?.role === 'gestion') && (
            <SectionTransfert achat={achat} onTransfert={async (typeInventaire) => {
              if (!me) return;
              // Créer véhicule dans prod_inventaire
              const newVeh = {
                id: crypto.randomUUID(),
                statut: 'disponible' as const,
                dateImport: new Date().toISOString(),
                numero: achat.vin?.slice(-6) ?? `ACH-${achat.id.slice(0, 6)}`,
                type: typeInventaire,
                marque: achat.marque,
                modele: achat.modele,
                annee: achat.annee,
                notes: `Transféré depuis achat ${achat.id} · ${achat.defautsConnus ?? ''}`,
                roadMap: [],
              };
              await ajouterVehicule(newVeh as any);
              await mettreAJour(achat.id, { statut: 'transferee-inventaire', inventaireId: newVeh.id });
              await achatService.ajouterDecision({ achatId: achat.id, decideurId: me.id, type: 'transfert', note: `Transféré en ${typeInventaire}` });
              alert('Camion transféré en inventaire !');
              onClose();
            }} />
          )}

          {/* ── Annulation (toujours visible si non terminé) ── */}
          {!['transferee-inventaire','annulee','archivee'].includes(achat.statut) && (
            <SectionAnnulation onAnnule={async (motif) => {
              if (!me) return;
              await mettreAJour(achat.id, { statut: 'annulee', annulationMotif: motif });
              await achatService.ajouterDecision({ achatId: achat.id, decideurId: me.id, type: 'annulation', note: motif });
              onClose();
            }} />
          )}

          {/* ── Photos ────────────────────── */}
          {photos.length > 0 && (
            <Section title="📸 Photos">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                {photos.map(p => (
                  <a key={p.id} href={p.url} target="_blank" rel="noreferrer" style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid #e5e7eb', display: 'block' }}>
                    <img src={p.url} alt={p.tag ?? ''} style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />
                  </a>
                ))}
              </div>
            </Section>
          )}

          {/* ── Historique décisions ───────── */}
          {decisions.length > 0 && (
            <Section title="📋 Historique">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {decisions.map(d => (
                  <div key={d.id} style={{ padding: 8, background: '#f8fafc', borderRadius: 6, fontSize: 12, borderLeft: `3px solid ${COULEUR}` }}>
                    <div style={{ fontWeight: 700 }}>{d.type}{d.montant != null && <> · {d.montant.toLocaleString()} $</>}</div>
                    <div style={{ color: '#6b7280', marginTop: 2 }}>
                      {profilesById[d.decideurId]?.nom ?? d.decideurId} · {new Date(d.createdAt).toLocaleString('fr-CA')}
                    </div>
                    {d.note && <div style={{ marginTop: 4, color: '#374151' }}>{d.note}</div>}
                  </div>
                ))}
              </div>
            </Section>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Sous-sections ──────────────────────────────────────────

function SectionEvalInit({ achat, evals, profiles, canEvaluate, userId, onSaved }: any) {
  const monEval = evals.find((e: any) => e.evaluateurId === userId);
  const [estimation, setEstimation] = useState(monEval?.monEstimation ? String(monEval.monEstimation) : '');
  const [prixVendeur, setPrixVendeur] = useState(monEval?.prixAttenduVendeur ? String(monEval.prixAttenduVendeur) : '');
  const [comm, setComm] = useState(monEval?.commentaire ?? '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      await achatService.upsertEvaluationInitiale({
        achatId: achat.id, evaluateurId: userId,
        monEstimation: parseFloat(estimation), prixAttenduVendeur: parseFloat(prixVendeur),
        commentaire: comm || undefined,
      });
      await onSaved();
    } finally { setSaving(false); }
  };

  return (
    <Section title="📊 Évaluation initiale (Stéphane + Roger)">
      {evals.map((e: EvaluationInitiale) => (
        <div key={e.id} style={{ padding: 10, background: '#eff6ff', borderRadius: 6, marginBottom: 6, borderLeft: '3px solid #3b82f6' }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{profiles[e.evaluateurId]?.nom ?? '?'}</div>
          <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>
            Mon estimation : <strong>{e.monEstimation.toLocaleString()} $</strong> ·
            Prix attendu vendeur : <strong>{e.prixAttenduVendeur.toLocaleString()} $</strong>
          </div>
          {e.commentaire && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{e.commentaire}</div>}
        </div>
      ))}
      {canEvaluate && (
        <div style={{ marginTop: 10, padding: 10, background: '#f0fdf4', borderRadius: 6, border: '1px solid #86efac' }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{monEval ? 'Modifier mon évaluation' : 'Saisir mon évaluation'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <input type="number" value={estimation} onChange={e => setEstimation(e.target.value)} placeholder="Mon estimation $" style={inputStyle} />
            <input type="number" value={prixVendeur} onChange={e => setPrixVendeur(e.target.value)} placeholder="Prix attendu vendeur $" style={inputStyle} />
          </div>
          <textarea value={comm} onChange={e => setComm(e.target.value)} placeholder="Commentaire (optionnel)" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          <button onClick={submit} disabled={saving || !estimation || !prixVendeur}
            style={{ marginTop: 8, padding: '8px 16px', borderRadius: 6, border: 'none', background: COULEUR, color: 'white', fontWeight: 700, cursor: 'pointer' }}>
            {saving ? '...' : '✓ Enregistrer'}
          </button>
        </div>
      )}
    </Section>
  );
}

function SectionEvalFinale({ achat, evals, profiles, canEvaluate, userId, onSaved }: any) {
  const monEval = evals.find((e: any) => e.evaluateurId === userId);
  const [prix, setPrix] = useState(monEval?.prixPropose ? String(monEval.prixPropose) : '');
  const [reco, setReco] = useState<Recommandation>(monEval?.recommandation ?? 'acheter');
  const [destSugg, setDestSugg] = useState<string>(monEval?.destinationSuggeree ?? '');
  const [comm, setComm] = useState(monEval?.commentaire ?? '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      await achatService.upsertEvaluationFinale({
        achatId: achat.id, evaluateurId: userId,
        prixPropose: parseFloat(prix),
        recommandation: reco,
        destinationSuggeree: destSugg as any || undefined,
        commentaire: comm || undefined,
      });
      await onSaved();
    } finally { setSaving(false); }
  };

  return (
    <Section title="🎯 Évaluation finale (Joel + Jason + Régis)">
      {evals.map((e: EvaluationFinale) => (
        <div key={e.id} style={{ padding: 10, background: '#fef3c7', borderRadius: 6, marginBottom: 6, borderLeft: '3px solid #f59e0b' }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{profiles[e.evaluateurId]?.nom ?? '?'}</div>
          <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>
            <strong>{e.prixPropose.toLocaleString()} $</strong> · {e.recommandation}
            {e.destinationSuggeree && <> · destination : {e.destinationSuggeree}</>}
          </div>
          {e.commentaire && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{e.commentaire}</div>}
        </div>
      ))}
      {canEvaluate && (
        <div style={{ marginTop: 10, padding: 10, background: '#f0fdf4', borderRadius: 6, border: '1px solid #86efac' }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{monEval ? 'Modifier mon évaluation' : 'Saisir mon évaluation finale'}</div>
          <input type="number" value={prix} onChange={e => setPrix(e.target.value)} placeholder="Prix proposé $" style={{ ...inputStyle, marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {(['acheter','negocier','passer'] as Recommandation[]).map(r => (
              <button key={r} onClick={() => setReco(r)}
                style={{ flex: 1, padding: '6px', borderRadius: 6, fontWeight: reco === r ? 700 : 500,
                  border: reco === r ? `2px solid ${COULEUR}` : '1px solid #e5e7eb',
                  background: reco === r ? `${COULEUR}15` : 'white', color: reco === r ? COULEUR : '#6b7280', cursor: 'pointer', fontSize: 12 }}>
                {r}
              </button>
            ))}
          </div>
          <select value={destSugg} onChange={e => setDestSugg(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }}>
            <option value="">— Destination suggérée —</option>
            <option value="pieces">🔧 Pièces</option>
            <option value="vente-detail">🏷️ Vente détail</option>
            <option value="indetermine">Indéterminé</option>
          </select>
          <textarea value={comm} onChange={e => setComm(e.target.value)} placeholder="Commentaire" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          <button onClick={submit} disabled={saving || !prix}
            style={{ marginTop: 8, padding: '8px 16px', borderRadius: 6, border: 'none', background: COULEUR, color: 'white', fontWeight: 700, cursor: 'pointer' }}>
            {saving ? '...' : '✓ Enregistrer'}
          </button>
        </div>
      )}
    </Section>
  );
}

function SectionApprobation({ achat: _achat, userId: _userId, canPieces, canVente, onApprouve, onRefuse }: any) {
  const [prix, setPrix] = useState('');
  const [note, setNote] = useState('');
  const [showRefuse, setShowRefuse] = useState(false);

  return (
    <Section title="⚖ Approbation finale">
      <input type="number" value={prix} onChange={e => setPrix(e.target.value)} placeholder="Prix d'offre approuvé $" style={{ ...inputStyle, marginBottom: 8 }} />
      <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optionnel)" rows={2} style={{ ...inputStyle, resize: 'vertical', marginBottom: 8 }} />
      <div style={{ display: 'flex', gap: 8 }}>
        {canPieces && (
          <button onClick={() => prix && onApprouve('pieces', parseFloat(prix), note)}
            style={{ flex: 1, padding: '10px', borderRadius: 6, border: 'none', background: '#f59e0b', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
            ✓ Approuver → 🔧 Pièces
          </button>
        )}
        {canVente && (
          <button onClick={() => prix && onApprouve('vente-detail', parseFloat(prix), note)}
            style={{ flex: 1, padding: '10px', borderRadius: 6, border: 'none', background: '#22c55e', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
            ✓ Approuver → 🏷️ Vente détail
          </button>
        )}
        <button onClick={() => setShowRefuse(true)}
          style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid #fca5a5', background: 'white', color: '#dc2626', fontWeight: 700, cursor: 'pointer' }}>
          ✗ Refuser
        </button>
      </div>
      {showRefuse && (
        <div style={{ marginTop: 10, padding: 10, background: '#fee2e2', borderRadius: 6 }}>
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Motif du refus..." rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          <button onClick={() => note && onRefuse(note)} disabled={!note}
            style={{ marginTop: 6, padding: '8px 16px', borderRadius: 6, border: 'none', background: '#dc2626', color: 'white', fontWeight: 700, cursor: note ? 'pointer' : 'not-allowed' }}>
            Confirmer le refus
          </button>
        </div>
      )}
    </Section>
  );
}

function SectionOffre({ achat, canApprover, onOffreFaite, onAcceptee, onContreOffre, onContreOffreAcceptee, onRefusee }: any) {
  const [contreOffre, setContreOffre] = useState('');
  const [motif, setMotif] = useState('');
  const isContreOffre = achat.statut === 'contre-offre';

  return (
    <Section title="📤 Offre / Contre-offre">
      <div style={{ fontSize: 13, color: '#374151', marginBottom: 8 }}>
        Prix approuvé : <strong>{achat.prixApprouve?.toLocaleString()} $</strong>
        {achat.prixContreOffre && <> · Contre-offre : <strong>{achat.prixContreOffre.toLocaleString()} $</strong></>}
      </div>

      {achat.statut === 'approuve-a-offrir' && (
        <button onClick={onOffreFaite}
          style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: COULEUR, color: 'white', fontWeight: 700, cursor: 'pointer', marginBottom: 8 }}>
          📞 J'ai fait l'offre au vendeur
        </button>
      )}

      {achat.statut === 'offre-faite' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button onClick={onAcceptee}
              style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: '#22c55e', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
              ✅ Acceptée
            </button>
            <button onClick={() => onRefusee('Vendeur a refusé')}
              style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: '#dc2626', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
              ❌ Refusée
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="number" value={contreOffre} onChange={e => setContreOffre(e.target.value)} placeholder="Contre-offre $" style={inputStyle} />
            <button onClick={() => contreOffre && onContreOffre(parseFloat(contreOffre))} disabled={!contreOffre}
              style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: '#f97316', color: 'white', fontWeight: 700, cursor: contreOffre ? 'pointer' : 'not-allowed' }}>
              🔄 Contre-offre
            </button>
          </div>
        </>
      )}

      {isContreOffre && canApprover && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={onContreOffreAcceptee}
            style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: '#22c55e', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
            ✓ Accepter contre-offre
          </button>
          <button onClick={() => motif && onRefusee(motif)} disabled={!motif}
            style={{ flex: 1, padding: '8px', borderRadius: 6, border: '1px solid #fca5a5', background: 'white', color: '#dc2626', fontWeight: 700, cursor: motif ? 'pointer' : 'not-allowed' }}>
            ✗ Refuser
          </button>
        </div>
      )}
      {isContreOffre && (
        <input value={motif} onChange={e => setMotif(e.target.value)} placeholder="Motif refus (si refus)" style={{ ...inputStyle, marginTop: 8 }} />
      )}
    </Section>
  );
}

function SectionConclure({ achat: _achat, onConclure }: any) {
  const [ententes, setEntentes] = useState('');
  const [transport, setTransport] = useState<ModeTransport>('roule');
  const [adresse, setAdresse] = useState('');
  const [contact, setContact] = useState('');
  const [horaires, setHoraires] = useState('');
  const [saving, setSaving] = useState(false);

  return (
    <Section title="🛒 Conclure l'achat">
      <textarea value={ententes} onChange={e => setEntentes(e.target.value)} placeholder="Ententes avec vendeur (texte libre — conditions, délais, garanties verbales...)" rows={3} style={{ ...inputStyle, resize: 'vertical', marginBottom: 8 }} />
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {(['roule','towing'] as ModeTransport[]).map(t => (
          <button key={t} onClick={() => setTransport(t)}
            style={{ flex: 1, padding: '8px', borderRadius: 6, fontWeight: transport === t ? 700 : 500,
              border: transport === t ? `2px solid ${COULEUR}` : '1px solid #e5e7eb',
              background: transport === t ? `${COULEUR}15` : 'white', color: transport === t ? COULEUR : '#6b7280', cursor: 'pointer' }}>
            {t === 'roule' ? '🚗 Roule par lui-même' : '🚛 Besoin de towing'}
          </button>
        ))}
      </div>
      <input value={adresse} onChange={e => setAdresse(e.target.value)} placeholder="Adresse pickup" style={{ ...inputStyle, marginBottom: 8 }} />
      <input value={contact} onChange={e => setContact(e.target.value)} placeholder="Contact (nom + téléphone)" style={{ ...inputStyle, marginBottom: 8 }} />
      <input value={horaires} onChange={e => setHoraires(e.target.value)} placeholder="Horaires dispo" style={{ ...inputStyle, marginBottom: 8 }} />
      <button onClick={async () => { setSaving(true); await onConclure({ ententes, transport, adresse, contact, horaires }); setSaving(false); }}
        disabled={saving}
        style={{ padding: '10px 16px', borderRadius: 6, border: 'none', background: COULEUR, color: 'white', fontWeight: 700, cursor: 'pointer', width: '100%' }}>
        {saving ? '...' : '✓ Conclure l\'achat (notifier Michael + Christina)'}
      </button>
    </Section>
  );
}

function SectionPaiement({ achat, canPay, onTogglePaye }: any) {
  return (
    <Section title="💰 Paiement">
      <div style={{ padding: 14, background: achat.paye ? '#dcfce7' : '#fef3c7', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: achat.paye ? '#166534' : '#92400e' }}>
            {achat.paye ? '✅ Payé' : '⏳ Non payé'}
          </div>
          {achat.paye && achat.datePaiement && (
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
              {new Date(achat.datePaiement).toLocaleString('fr-CA')}
            </div>
          )}
        </div>
        {canPay && (
          <button onClick={onTogglePaye}
            style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: achat.paye ? '#dc2626' : '#22c55e', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
            {achat.paye ? 'Marquer non payé' : 'Marquer payé'}
          </button>
        )}
      </div>
    </Section>
  );
}

function SectionTowing({ achat: _achat, towing, conducteurs, onSave, onArrive }: any) {
  const [conducteurId, setConducteurId] = useState(towing?.conducteurId ?? '');
  const [datePrevue, setDatePrevue] = useState(towing?.datePrevue ?? '');
  const [statut, setStatut] = useState(towing?.statut ?? 'a-ramasser');
  const [notes, setNotes] = useState(towing?.notes ?? '');

  return (
    <Section title="🚛 Towing / Pickup">
      <select value={conducteurId} onChange={e => setConducteurId(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }}>
        <option value="">— Conducteur —</option>
        {conducteurs.filter((c: Conducteur) => c.actif && (c.peutTowing || c.peutChauffeur)).map((c: Conducteur) => (
          <option key={c.id} value={c.id}>{c.nom}{c.peutTowing ? ' 🚛' : ''}{c.peutChauffeur ? ' 🚗' : ''}</option>
        ))}
      </select>
      <input type="date" value={datePrevue} onChange={e => setDatePrevue(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }} />
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {['a-ramasser','en-route','arrive'].map(s => (
          <button key={s} onClick={() => setStatut(s)}
            style={{ flex: 1, padding: '6px', borderRadius: 6, fontSize: 11, fontWeight: statut === s ? 700 : 500,
              border: statut === s ? `2px solid ${COULEUR}` : '1px solid #e5e7eb',
              background: statut === s ? `${COULEUR}15` : 'white', color: statut === s ? COULEUR : '#6b7280', cursor: 'pointer' }}>
            {s}
          </button>
        ))}
      </div>
      <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes towing" rows={2} style={{ ...inputStyle, resize: 'vertical', marginBottom: 8 }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onSave({ conducteurId: conducteurId || undefined, datePrevue: datePrevue || undefined, statut, notes })}
          style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: COULEUR, color: 'white', fontWeight: 700, cursor: 'pointer' }}>
          💾 Sauvegarder
        </button>
        <button onClick={onArrive}
          style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: '#22c55e', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
          📍 Marquer arrivé
        </button>
      </div>
    </Section>
  );
}

function SectionTransfert({ achat, onTransfert }: any) {
  const [type, setType] = useState<'eau' | 'detail'>(achat.destination === 'pieces' ? 'detail' : 'eau');
  return (
    <Section title="🏭 Transférer en inventaire de production">
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
        Le camion est arrivé. Choisis le type d'inventaire pour le transférer en production.
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {(['eau','detail'] as const).map(t => (
          <button key={t} onClick={() => setType(t)}
            style={{ flex: 1, padding: '10px', borderRadius: 6, fontWeight: type === t ? 700 : 500,
              border: type === t ? `2px solid ${COULEUR}` : '1px solid #e5e7eb',
              background: type === t ? `${COULEUR}15` : 'white', color: type === t ? COULEUR : '#6b7280', cursor: 'pointer' }}>
            {t === 'eau' ? '💧 Camion à eau' : '🏷️ Camion détail'}
          </button>
        ))}
      </div>
      <button onClick={() => onTransfert(type)}
        style={{ width: '100%', padding: '10px', borderRadius: 6, border: 'none', background: COULEUR, color: 'white', fontWeight: 700, cursor: 'pointer' }}>
        ✓ Transférer en inventaire
      </button>
    </Section>
  );
}

function SectionAnnulation({ onAnnule }: any) {
  const [show, setShow] = useState(false);
  const [motif, setMotif] = useState('');
  return (
    <Section title="🚫 Annulation">
      {!show ? (
        <button onClick={() => setShow(true)}
          style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #fca5a5', background: 'white', color: '#dc2626', fontWeight: 600, cursor: 'pointer' }}>
          🚫 Annuler cette opportunité
        </button>
      ) : (
        <div>
          <textarea value={motif} onChange={e => setMotif(e.target.value)} placeholder="Motif d'annulation..." rows={2} style={{ ...inputStyle, resize: 'vertical', marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShow(false)} style={{ flex: 1, padding: '8px', borderRadius: 6, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer' }}>Annuler</button>
            <button onClick={() => motif && onAnnule(motif)} disabled={!motif}
              style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: '#dc2626', color: 'white', fontWeight: 700, cursor: motif ? 'pointer' : 'not-allowed' }}>
              Confirmer annulation
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}

// ── UI Helpers ─────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function KV({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 13, marginBottom: 4, alignItems: multiline ? 'flex-start' : 'center' }}>
      <span style={{ width: 110, flexShrink: 0, fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>{label}</span>
      <span style={{ color: '#111827', fontWeight: 500, whiteSpace: multiline ? 'pre-wrap' : 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 6,
  border: '1px solid #d1d5db', fontSize: 13, outline: 'none',
  boxSizing: 'border-box', background: 'white', color: '#111827',
};
