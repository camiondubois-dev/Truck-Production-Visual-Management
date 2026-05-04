// ════════════════════════════════════════════════════════════════
// Fiche Achat Mobile — workflow complet 9 étapes optimisé téléphone
// ════════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { useAchats } from '../contexts/AchatContext';
import { useInventaire } from '../contexts/InventaireContext';
import { achatService } from '../services/achatService';
import { conducteurService } from '../services/conducteurService';
import { supabase } from '../lib/supabase';
import type {
  Achat, EvaluationInitiale, EvaluationFinale, DecisionAchat,
  AchatTowing, Conducteur, AchatPhoto, ModeTransport,
  Recommandation,
} from '../types/achatTypes';
import { LABELS_STATUT, COULEURS_STATUT } from '../types/achatTypes';
import type { AchatsSession } from '../hooks/useAchatsAuth';

const COULEUR = '#10b981';

export function FicheAchatMobile({ achat, session, onClose }: {
  achat: Achat;
  session: AchatsSession;
  onClose: () => void;
}) {
  const { mettreAJour } = useAchats();
  const { ajouterVehicule } = useInventaire();

  const [photos, setPhotos] = useState<AchatPhoto[]>([]);
  const [evalInits, setEvalInits] = useState<EvaluationInitiale[]>([]);
  const [evalFinales, setEvalFinales] = useState<EvaluationFinale[]>([]);
  const [decisions, setDecisions] = useState<DecisionAchat[]>([]);
  const [towing, setTowing] = useState<AchatTowing | null>(null);
  const [conducteurs, setConducteurs] = useState<Conducteur[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, { nom: string }>>({});

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
    supabase.from('profiles').select('id, nom').then(({ data }) => {
      const m: Record<string, { nom: string }> = {};
      for (const p of (data ?? [])) m[p.id] = { nom: p.nom ?? '?' };
      setProfilesById(m);
    });
  }, [achat.id]);

  const roles = session.rolesAchat;
  const isAcheteurPrincipal = roles.includes('acheteur-principal');
  const isEvalFinale        = roles.includes('evaluateur-final');
  const isApprobPieces      = roles.includes('approbateur-pieces');
  const isApprobVente       = roles.includes('approbateur-vente');
  const isApprobateur       = isApprobPieces || isApprobVente;
  const isPaiementAdmin     = roles.includes('paiement-admin');
  const isInventaireAdmin   = roles.includes('inventaire-admin');

  const titre = [achat.annee, achat.marque, achat.modele].filter(Boolean).join(' ') || 'Sans titre';
  const statutCfg = { color: COULEURS_STATUT[achat.statut], label: LABELS_STATUT[achat.statut] };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: '#f8fafc',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Header sticky */}
      <div style={{
        flexShrink: 0,
        background: '#0f172a',
        color: 'white',
        padding: '12px 14px env(safe-area-inset-top, 12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <button onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', width: 36, height: 36, borderRadius: 8, color: 'white', fontSize: 18, cursor: 'pointer', flexShrink: 0 }}>
            ←
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titre}</div>
            {achat.vin && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>VIN {achat.vin}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: `${statutCfg.color}30`, color: statutCfg.color }}>
            {statutCfg.label}
          </span>
          {achat.destination === 'pieces' && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: '#fef3c7', color: '#92400e' }}>🔧 PIÈCES</span>
          )}
          {achat.destination === 'vente-detail' && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: '#dcfce7', color: '#166534' }}>🏷️ VENTE</span>
          )}
          {achat.paye && <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: '#dcfce7', color: '#166534' }}>💰 PAYÉ</span>}
        </div>
      </div>

      {/* Body scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px env(safe-area-inset-bottom, 14px)', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Photos en grille */}
          {photos.length > 0 && (
            <Section title={`📸 Photos (${photos.length})`}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {photos.map(p => (
                  <a key={p.id} href={p.url} target="_blank" rel="noreferrer" style={{ display: 'block', borderRadius: 6, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                    <img src={p.url} alt={p.tag ?? ''} style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }} />
                  </a>
                ))}
              </div>
            </Section>
          )}

          {/* Identification */}
          <Section title="🚛 Camion">
            <KV label="Marque" value={achat.marque ?? '—'} />
            <KV label="Modèle" value={achat.modele ?? '—'} />
            <KV label="Année"  value={achat.annee != null ? String(achat.annee) : '—'} />
            <KV label="VIN"    value={achat.vin ?? '—'} />
            <KV label="KM"     value={achat.kilometrage != null ? `${achat.kilometrage.toLocaleString()} km` : '—'} />
            <KV label="État"   value={achat.etatGeneral ?? '—'} />
            {achat.defautsConnus && <KV label="Défauts" value={achat.defautsConnus} multiline />}
          </Section>

          {/* Specs moteur */}
          {(achat.moteurMarque || achat.moteurModele || achat.moteurHp) && (
            <Section title="⚙️ Moteur">
              <KV label="Marque" value={achat.moteurMarque ?? '—'} />
              <KV label="Modèle" value={achat.moteurModele ?? '—'} />
              <KV label="HP"     value={achat.moteurHp != null ? `${achat.moteurHp} HP` : '—'} />
              <KV label="EPA"    value={achat.moteurEpa ?? '—'} />
              <KV label="Série"  value={achat.moteurSerie ?? '—'} />
            </Section>
          )}

          {/* Trans / diff */}
          {(achat.transType || achat.differentielRatio) && (
            <Section title="🔧 Trans / Diff">
              <KV label="Type"      value={achat.transType ?? '—'} />
              <KV label="Marque"    value={achat.transMarque ?? '—'} />
              <KV label="Modèle"    value={achat.transModele ?? '—'} />
              <KV label="Vitesses"  value={achat.transVitesses ?? '—'} />
              <KV label="Diff"      value={achat.differentielRatio ?? '—'} />
            </Section>
          )}

          {/* Châssis */}
          {(achat.suspension || achat.configEssieux || achat.gvwr) && (
            <Section title="🚚 Châssis">
              <KV label="Suspension" value={achat.suspension ?? '—'} />
              <KV label="Essieux"    value={achat.configEssieux ?? '—'} />
              <KV label="Empattement" value={achat.empattement != null ? `${achat.empattement}"` : '—'} />
              <KV label="GVWR"       value={achat.gvwr ?? '—'} />
              <KV label="Cabine"     value={achat.typeCabine ?? '—'} />
            </Section>
          )}

          {/* Vendeur */}
          <Section title="👤 Vendeur">
            <KV label="Nom"     value={achat.vendeurNom} />
            <KV label="Type"    value={achat.vendeurType} />
            <KV label="Tél"     value={achat.vendeurTelephone} />
            <KV label="Email"   value={achat.vendeurEmail} />
            <KV label="Adresse" value={achat.vendeurAdresse} multiline />
            {achat.vendeurNote && <KV label="Note" value={achat.vendeurNote} multiline />}
            {achat.source && <KV label="Source" value={achat.source} />}
            {achat.lieuLocalisation && <KV label="Lieu pickup" value={achat.lieuLocalisation} />}
          </Section>

          {/* Prix */}
          <Section title="💰 Prix">
            <KV label="Demandé"   value={achat.prixDemandeInitial != null ? `${achat.prixDemandeInitial.toLocaleString()} $` : '—'} />
            <KV label="Approuvé"  value={achat.prixApprouve       != null ? `${achat.prixApprouve.toLocaleString()} $` : '—'} />
            <KV label="Contre-offre" value={achat.prixContreOffre != null ? `${achat.prixContreOffre.toLocaleString()} $` : '—'} />
            <KV label="Payé"      value={achat.prixPaye           != null ? `${achat.prixPaye.toLocaleString()} $` : '—'} />
          </Section>

          {/* ── Évaluation initiale ───────────────────────── */}
          {(achat.statut === 'evaluation-initiale' || evalInits.length > 0) && (
            <SectionEvalInit achat={achat} evals={evalInits} profiles={profilesById}
              canEvaluate={isAcheteurPrincipal} userId={session.profileId}
              onSaved={async () => { await reload();
                const refreshed = await achatService.getEvaluationsInitiales(achat.id);
                if (refreshed.length >= 2 && achat.statut === 'evaluation-initiale') {
                  await mettreAJour(achat.id, { statut: 'evaluation-finale' });
                }
              }} />
          )}

          {/* Évaluation finale */}
          {(['evaluation-finale','a-approuver','approuve-a-offrir','offre-faite','contre-offre','acceptee','refusee'].includes(achat.statut) || evalFinales.length > 0) && (
            <SectionEvalFinale achat={achat} evals={evalFinales} profiles={profilesById}
              canEvaluate={isEvalFinale} userId={session.profileId}
              onSaved={async () => { await reload();
                const refreshed = await achatService.getEvaluationsFinales(achat.id);
                if (refreshed.length >= 1 && achat.statut === 'evaluation-finale') {
                  await mettreAJour(achat.id, { statut: 'a-approuver' });
                }
              }} />
          )}

          {/* Approbation */}
          {achat.statut === 'a-approuver' && isApprobateur && (
            <SectionApprobation canPieces={isApprobPieces} canVente={isApprobVente}
              onApprouve={async (destination, prix, note) => {
                await mettreAJour(achat.id, { destination, approbateurId: session.profileId, prixApprouve: prix, statut: 'approuve-a-offrir' });
                await achatService.ajouterDecision({ achatId: achat.id, decideurId: session.profileId, type: 'approbation', montant: prix, destination, note });
                await reload();
              }}
              onRefuse={async (note) => {
                await mettreAJour(achat.id, { statut: 'refusee', annulationMotif: note });
                await achatService.ajouterDecision({ achatId: achat.id, decideurId: session.profileId, type: 'refus', note });
                await reload();
              }} />
          )}

          {/* Offre / contre-offre */}
          {['approuve-a-offrir','offre-faite','contre-offre'].includes(achat.statut) && (
            <SectionOffre achat={achat} canApprover={isApprobateur}
              onOffreFaite={async () => { await mettreAJour(achat.id, { statut: 'offre-faite' }); await reload(); }}
              onAcceptee={async () => { await mettreAJour(achat.id, { statut: 'acceptee', prixPaye: achat.prixContreOffre ?? achat.prixApprouve }); await reload(); }}
              onContreOffre={async (montant) => { await mettreAJour(achat.id, { statut: 'contre-offre', prixContreOffre: montant }); await reload(); }}
              onContreOffreAcceptee={async () => {
                await mettreAJour(achat.id, { statut: 'acceptee', prixApprouve: achat.prixContreOffre ?? achat.prixApprouve, prixPaye: achat.prixContreOffre ?? achat.prixApprouve });
                await achatService.ajouterDecision({ achatId: achat.id, decideurId: session.profileId, type: 'contre-offre-acceptee', montant: achat.prixContreOffre ?? undefined });
                await reload();
              }}
              onRefusee={async (motif) => {
                await mettreAJour(achat.id, { statut: 'refusee', annulationMotif: motif });
                await achatService.ajouterDecision({ achatId: achat.id, decideurId: session.profileId, type: 'refus', note: motif });
                await reload();
              }} />
          )}

          {/* Conclure achat */}
          {achat.statut === 'acceptee' && (
            <SectionConclure
              onConclure={async (data) => {
                await mettreAJour(achat.id, {
                  ententesVendeur: data.ententes,
                  modeTransport: data.transport,
                  adressePickup: data.adresse,
                  contactPickup: data.contact,
                  horairesPickup: data.horaires,
                  statut: 'achete-a-payer-a-ramasser',
                });
                const { data: paiementAdmins } = await supabase.from('profiles').select('id').contains('roles_achat', ['paiement-admin']);
                for (const p of paiementAdmins ?? []) {
                  await achatService.creerNotification(p.id, achat.id, 'achat-conclu', `Camion acheté : ${achat.marque} ${achat.modele} — à payer + ramasser`);
                }
                await reload();
              }} />
          )}

          {/* Paiement */}
          {['achete-a-payer-a-ramasser','paye-a-ramasser','en-towing','arrive'].includes(achat.statut) && (
            <SectionPaiement achat={achat} canPay={isPaiementAdmin}
              onTogglePaye={async () => {
                const nouveau = !achat.paye;
                await mettreAJour(achat.id, {
                  paye: nouveau,
                  datePaiement: nouveau ? new Date().toISOString() : undefined,
                  paiementParId: nouveau ? session.profileId : undefined,
                  statut: nouveau ? 'paye-a-ramasser' : 'achete-a-payer-a-ramasser',
                });
                await reload();
              }} />
          )}

          {/* Towing */}
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

          {/* Transfert */}
          {achat.statut === 'arrive' && isInventaireAdmin && (
            <SectionTransfert achat={achat} onTransfert={async (typeInventaire) => {
              const newVehId = `ach-${achat.id.slice(0, 8)}-${Date.now()}`;
              const newVeh = {
                id: newVehId,
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
              await mettreAJour(achat.id, { statut: 'transferee-inventaire', inventaireId: newVehId });
              await achatService.ajouterDecision({ achatId: achat.id, decideurId: session.profileId, type: 'transfert', note: `Transféré en ${typeInventaire}` });
              alert('Camion transféré en inventaire !');
              onClose();
            }} />
          )}

          {/* Annulation */}
          {!['transferee-inventaire','annulee','archivee'].includes(achat.statut) && (
            <SectionAnnulation onAnnule={async (motif) => {
              await mettreAJour(achat.id, { statut: 'annulee', annulationMotif: motif });
              await achatService.ajouterDecision({ achatId: achat.id, decideurId: session.profileId, type: 'annulation', note: motif });
              onClose();
            }} />
          )}

          {/* Historique */}
          {decisions.length > 0 && (
            <Section title="📋 Historique">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {decisions.map(d => (
                  <div key={d.id} style={{ padding: 8, background: '#f8fafc', borderRadius: 6, fontSize: 11, borderLeft: `3px solid ${COULEUR}` }}>
                    <div style={{ fontWeight: 700 }}>{d.type}{d.montant != null && <> · {d.montant.toLocaleString()} $</>}</div>
                    <div style={{ color: '#6b7280', marginTop: 2 }}>
                      {profilesById[d.decideurId]?.nom ?? '?'} · {new Date(d.createdAt).toLocaleString('fr-CA')}
                    </div>
                    {d.note && <div style={{ marginTop: 3, color: '#374151' }}>{d.note}</div>}
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

// ── Sous-sections ─────────────────────────────────────────

function SectionEvalInit({ achat, evals, profiles, canEvaluate, userId, onSaved }: any) {
  const monEval = evals.find((e: any) => e.evaluateurId === userId);
  const [estimation, setEstimation] = useState(monEval?.monEstimation ? String(monEval.monEstimation) : '');
  const [prixVendeur, setPrixVendeur] = useState(monEval?.prixAttenduVendeur ? String(monEval.prixAttenduVendeur) : '');
  const [comm, setComm] = useState(monEval?.commentaire ?? '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
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
            Estimation : <strong>{e.monEstimation.toLocaleString()} $</strong> · Vendeur attend : <strong>{e.prixAttenduVendeur.toLocaleString()} $</strong>
          </div>
          {e.commentaire && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{e.commentaire}</div>}
        </div>
      ))}
      {canEvaluate && (
        <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8, border: '1px solid #86efac', marginTop: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{monEval ? '✏️ Modifier' : '➕ Ma soumission'}</div>
          <input type="number" value={estimation} onChange={e => setEstimation(e.target.value)} placeholder="Mon estimation $" style={inputStyle} />
          <input type="number" value={prixVendeur} onChange={e => setPrixVendeur(e.target.value)} placeholder="Prix vendeur attend $" style={{ ...inputStyle, marginTop: 6 }} />
          <textarea value={comm} onChange={e => setComm(e.target.value)} placeholder="Commentaire (optionnel)" rows={2} style={{ ...inputStyle, marginTop: 6, resize: 'vertical' }} />
          <button onClick={submit} disabled={saving || !estimation || !prixVendeur}
            style={{ ...btnPrimary, marginTop: 8, opacity: saving || !estimation || !prixVendeur ? 0.5 : 1 }}>
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
    setSaving(true);
    try {
      await achatService.upsertEvaluationFinale({
        achatId: achat.id, evaluateurId: userId,
        prixPropose: parseFloat(prix), recommandation: reco,
        destinationSuggeree: destSugg as any || undefined,
        commentaire: comm || undefined,
      });
      await onSaved();
    } finally { setSaving(false); }
  };

  return (
    <Section title="🎯 Évaluation finale (Joel/Jason/Régis)">
      {evals.map((e: EvaluationFinale) => (
        <div key={e.id} style={{ padding: 10, background: '#fef3c7', borderRadius: 6, marginBottom: 6, borderLeft: '3px solid #f59e0b' }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{profiles[e.evaluateurId]?.nom ?? '?'}</div>
          <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>
            <strong>{e.prixPropose.toLocaleString()} $</strong> · {e.recommandation}
            {e.destinationSuggeree && <> · {e.destinationSuggeree}</>}
          </div>
          {e.commentaire && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{e.commentaire}</div>}
        </div>
      ))}
      {canEvaluate && (
        <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8, border: '1px solid #86efac', marginTop: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{monEval ? '✏️ Modifier' : '➕ Mon évaluation'}</div>
          <input type="number" value={prix} onChange={e => setPrix(e.target.value)} placeholder="Prix proposé $" style={inputStyle} />
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {(['acheter','negocier','passer'] as Recommandation[]).map(r => (
              <button key={r} onClick={() => setReco(r)}
                style={{ flex: 1, padding: '10px 6px', borderRadius: 8,
                  border: reco === r ? `2px solid ${COULEUR}` : '1px solid #e5e7eb',
                  background: reco === r ? `${COULEUR}15` : 'white',
                  color: reco === r ? COULEUR : '#6b7280',
                  fontWeight: reco === r ? 700 : 500, fontSize: 13, cursor: 'pointer' }}>
                {r}
              </button>
            ))}
          </div>
          <select value={destSugg} onChange={e => setDestSugg(e.target.value)} style={{ ...inputStyle, marginTop: 8 }}>
            <option value="">— Destination suggérée —</option>
            <option value="pieces">🔧 Pièces</option>
            <option value="vente-detail">🏷️ Vente détail</option>
            <option value="indetermine">Indéterminé</option>
          </select>
          <textarea value={comm} onChange={e => setComm(e.target.value)} placeholder="Commentaire" rows={2} style={{ ...inputStyle, marginTop: 6, resize: 'vertical' }} />
          <button onClick={submit} disabled={saving || !prix} style={{ ...btnPrimary, marginTop: 8, opacity: saving || !prix ? 0.5 : 1 }}>
            {saving ? '...' : '✓ Enregistrer'}
          </button>
        </div>
      )}
    </Section>
  );
}

function SectionApprobation({ canPieces, canVente, onApprouve, onRefuse }: any) {
  const [prix, setPrix] = useState('');
  const [note, setNote] = useState('');
  const [showRefuse, setShowRefuse] = useState(false);

  return (
    <Section title="⚖ Approbation">
      <input type="number" value={prix} onChange={e => setPrix(e.target.value)} placeholder="Prix d'offre approuvé $" style={inputStyle} />
      <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optionnel)" rows={2} style={{ ...inputStyle, marginTop: 6, resize: 'vertical' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
        {canPieces && (
          <button onClick={() => prix && onApprouve('pieces', parseFloat(prix), note)}
            style={{ ...btnPrimary, background: '#f59e0b', opacity: prix ? 1 : 0.5 }}>
            ✓ Approuver → 🔧 PIÈCES
          </button>
        )}
        {canVente && (
          <button onClick={() => prix && onApprouve('vente-detail', parseFloat(prix), note)}
            style={{ ...btnPrimary, background: '#22c55e', opacity: prix ? 1 : 0.5 }}>
            ✓ Approuver → 🏷️ VENTE
          </button>
        )}
        <button onClick={() => setShowRefuse(true)}
          style={{ ...btnPrimary, background: 'white', color: '#dc2626', border: '1px solid #fca5a5' }}>
          ✗ Refuser
        </button>
      </div>
      {showRefuse && (
        <div style={{ marginTop: 10, padding: 10, background: '#fee2e2', borderRadius: 8 }}>
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Motif du refus..." rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          <button onClick={() => note && onRefuse(note)} disabled={!note}
            style={{ ...btnPrimary, marginTop: 6, background: '#dc2626', opacity: note ? 1 : 0.5 }}>
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

  return (
    <Section title="📤 Offre / Contre-offre">
      <div style={{ fontSize: 13, color: '#374151', marginBottom: 10 }}>
        Approuvé : <strong>{achat.prixApprouve?.toLocaleString()} $</strong>
        {achat.prixContreOffre && <><br/>Contre-offre : <strong>{achat.prixContreOffre.toLocaleString()} $</strong></>}
      </div>

      {achat.statut === 'approuve-a-offrir' && (
        <button onClick={onOffreFaite} style={btnPrimary}>📞 J'ai fait l'offre</button>
      )}

      {achat.statut === 'offre-faite' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button onClick={onAcceptee} style={{ ...btnPrimary, background: '#22c55e' }}>✅ Acceptée</button>
          <button onClick={() => onRefusee('Refusée par le vendeur')} style={{ ...btnPrimary, background: '#dc2626' }}>❌ Refusée</button>
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="number" value={contreOffre} onChange={e => setContreOffre(e.target.value)} placeholder="Contre-offre $" style={{ ...inputStyle, flex: 1 }} />
            <button onClick={() => contreOffre && onContreOffre(parseFloat(contreOffre))} disabled={!contreOffre}
              style={{ padding: '12px', borderRadius: 8, border: 'none', background: '#f97316', color: 'white', fontWeight: 700, cursor: contreOffre ? 'pointer' : 'not-allowed', opacity: contreOffre ? 1 : 0.5 }}>
              🔄
            </button>
          </div>
        </div>
      )}

      {achat.statut === 'contre-offre' && canApprover && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button onClick={onContreOffreAcceptee} style={{ ...btnPrimary, background: '#22c55e' }}>✓ Accepter contre-offre</button>
          <input value={motif} onChange={e => setMotif(e.target.value)} placeholder="Motif refus" style={inputStyle} />
          <button onClick={() => motif && onRefusee(motif)} disabled={!motif} style={{ ...btnPrimary, background: 'white', color: '#dc2626', border: '1px solid #fca5a5', opacity: motif ? 1 : 0.5 }}>
            ✗ Refuser
          </button>
        </div>
      )}
    </Section>
  );
}

function SectionConclure({ onConclure }: any) {
  const [ententes, setEntentes] = useState('');
  const [transport, setTransport] = useState<ModeTransport>('roule');
  const [adresse, setAdresse] = useState('');
  const [contact, setContact] = useState('');
  const [horaires, setHoraires] = useState('');
  const [saving, setSaving] = useState(false);

  return (
    <Section title="🛒 Conclure l'achat">
      <textarea value={ententes} onChange={e => setEntentes(e.target.value)} placeholder="Ententes vendeur (texte libre)" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        {(['roule','towing'] as ModeTransport[]).map(t => (
          <button key={t} onClick={() => setTransport(t)}
            style={{ flex: 1, padding: '12px', borderRadius: 8,
              border: transport === t ? `2px solid ${COULEUR}` : '1px solid #e5e7eb',
              background: transport === t ? `${COULEUR}15` : 'white',
              color: transport === t ? COULEUR : '#6b7280',
              fontWeight: transport === t ? 700 : 500, fontSize: 13, cursor: 'pointer' }}>
            {t === 'roule' ? '🚗 Roule' : '🚛 Towing'}
          </button>
        ))}
      </div>
      <input value={adresse} onChange={e => setAdresse(e.target.value)} placeholder="Adresse pickup" style={{ ...inputStyle, marginTop: 6 }} />
      <input value={contact} onChange={e => setContact(e.target.value)} placeholder="Contact (nom + tél)" style={{ ...inputStyle, marginTop: 6 }} />
      <input value={horaires} onChange={e => setHoraires(e.target.value)} placeholder="Horaires dispo" style={{ ...inputStyle, marginTop: 6 }} />
      <button onClick={async () => { setSaving(true); await onConclure({ ententes, transport, adresse, contact, horaires }); setSaving(false); }}
        disabled={saving} style={{ ...btnPrimary, marginTop: 10, opacity: saving ? 0.5 : 1 }}>
        {saving ? '...' : '✓ Conclure (notifier Michael + Christina)'}
      </button>
    </Section>
  );
}

function SectionPaiement({ achat, canPay, onTogglePaye }: any) {
  return (
    <Section title="💰 Paiement">
      <div style={{ padding: 14, background: achat.paye ? '#dcfce7' : '#fef3c7', borderRadius: 8 }}>
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
          style={{ ...btnPrimary, marginTop: 10, background: achat.paye ? '#dc2626' : '#22c55e' }}>
          {achat.paye ? 'Marquer non payé' : 'Marquer payé'}
        </button>
      )}
    </Section>
  );
}

function SectionTowing({ towing, conducteurs, onSave, onArrive }: any) {
  const [conducteurId, setConducteurId] = useState(towing?.conducteurId ?? '');
  const [datePrevue, setDatePrevue] = useState(towing?.datePrevue ?? '');
  const [statut, setStatut] = useState(towing?.statut ?? 'a-ramasser');
  const [notes, setNotes] = useState(towing?.notes ?? '');

  return (
    <Section title="🚛 Towing">
      <select value={conducteurId} onChange={e => setConducteurId(e.target.value)} style={inputStyle}>
        <option value="">— Conducteur —</option>
        {conducteurs.filter((c: Conducteur) => c.actif).map((c: Conducteur) => (
          <option key={c.id} value={c.id}>{c.nom}{c.peutTowing ? ' 🚛' : ''}{c.peutChauffeur ? ' 🚗' : ''}</option>
        ))}
      </select>
      <input type="date" value={datePrevue} onChange={e => setDatePrevue(e.target.value)} style={{ ...inputStyle, marginTop: 6 }} />
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        {['a-ramasser','en-route','arrive'].map(s => (
          <button key={s} onClick={() => setStatut(s)}
            style={{ flex: 1, padding: '10px 4px', borderRadius: 8,
              border: statut === s ? `2px solid ${COULEUR}` : '1px solid #e5e7eb',
              background: statut === s ? `${COULEUR}15` : 'white',
              color: statut === s ? COULEUR : '#6b7280',
              fontWeight: statut === s ? 700 : 500, fontSize: 11, cursor: 'pointer' }}>
            {s}
          </button>
        ))}
      </div>
      <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes towing" rows={2} style={{ ...inputStyle, marginTop: 6, resize: 'vertical' }} />
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button onClick={() => onSave({ conducteurId: conducteurId || undefined, datePrevue: datePrevue || undefined, statut, notes })}
          style={{ ...btnPrimary, flex: 1 }}>💾 Sauver</button>
        <button onClick={onArrive} style={{ ...btnPrimary, flex: 1, background: '#22c55e' }}>📍 Arrivé</button>
      </div>
    </Section>
  );
}

function SectionTransfert({ achat, onTransfert }: any) {
  const [type, setType] = useState<'eau' | 'detail'>(achat.destination === 'pieces' ? 'detail' : 'eau');
  return (
    <Section title="🏭 Transférer en inventaire">
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>Le camion est arrivé. Choisis le type d'inventaire.</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {(['eau','detail'] as const).map(t => (
          <button key={t} onClick={() => setType(t)}
            style={{ flex: 1, padding: '14px', borderRadius: 8,
              border: type === t ? `2px solid ${COULEUR}` : '1px solid #e5e7eb',
              background: type === t ? `${COULEUR}15` : 'white',
              color: type === t ? COULEUR : '#6b7280',
              fontWeight: type === t ? 700 : 500, fontSize: 13, cursor: 'pointer' }}>
            {t === 'eau' ? '💧 Camion eau' : '🏷️ Détail'}
          </button>
        ))}
      </div>
      <button onClick={() => onTransfert(type)} style={btnPrimary}>✓ Transférer</button>
    </Section>
  );
}

function SectionAnnulation({ onAnnule }: any) {
  const [show, setShow] = useState(false);
  const [motif, setMotif] = useState('');
  return (
    <Section title="🚫 Annuler">
      {!show ? (
        <button onClick={() => setShow(true)} style={{ ...btnPrimary, background: 'white', color: '#dc2626', border: '1px solid #fca5a5' }}>
          🚫 Annuler cette opportunité
        </button>
      ) : (
        <div>
          <textarea value={motif} onChange={e => setMotif(e.target.value)} placeholder="Motif d'annulation..." rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button onClick={() => setShow(false)} style={{ flex: 1, padding: 12, borderRadius: 8, border: '1px solid #e5e7eb', background: 'white' }}>Annuler</button>
            <button onClick={() => motif && onAnnule(motif)} disabled={!motif} style={{ flex: 1, padding: 12, borderRadius: 8, border: 'none', background: '#dc2626', color: 'white', fontWeight: 700, cursor: motif ? 'pointer' : 'not-allowed', opacity: motif ? 1 : 0.5 }}>
              Confirmer
            </button>
          </div>
        </div>
      )}
    </Section>
  );
}

// ── UI Helpers ───────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#374151', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{title}</div>
      {children}
    </div>
  );
}

function KV({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 13, marginBottom: 4, alignItems: multiline ? 'flex-start' : 'center' }}>
      <span style={{ width: 80, flexShrink: 0, fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>{label}</span>
      <span style={{ color: '#111827', fontWeight: 500, flex: 1, whiteSpace: multiline ? 'pre-wrap' : 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 10,
  border: '1px solid #d1d5db', fontSize: 14, outline: 'none',
  boxSizing: 'border-box', background: 'white', color: '#111827',
};

const btnPrimary: React.CSSProperties = {
  width: '100%', padding: '14px', borderRadius: 10, border: 'none',
  background: COULEUR, color: 'white', fontWeight: 800, fontSize: 14, cursor: 'pointer',
};
