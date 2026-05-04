// ════════════════════════════════════════════════════════════════
// Mobile Wizard Achat — 8 étapes optimisées téléphone
// ════════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo } from 'react';
import { useAchats } from '../contexts/AchatContext';
import { vendeurExterneService } from '../services/vendeurExterneService';
import { achatService } from '../services/achatService';
import { photoService } from '../services/photoService';
import {
  TRUCK_MARQUES, TRUCK_MODELES_BY_MARQUE,
  getModelesPour, getAnneesPour,
  ENGINE_MARQUES, ENGINE_MODELES_BY_MARQUE,
  EPA_VALUES, TRANSMISSION_MARQUES, TRANSMISSION_MODELES, TRANSMISSION_TYPES,
  DIFFERENTIEL_RATIOS, SUSPENSIONS, CONFIGS_ESSIEUX, TYPES_CABINE, GVWR_OPTIONS,
} from '../data/truckReference';
import type { VendeurExterne, TypeVendeur, EtatGeneral, AchatPhoto } from '../types/achatTypes';

const COULEUR = '#10b981';
const DRAFT_KEY = 'achats_wizard_draft';

interface WizardData {
  step: number;
  // Identification
  marque: string;
  annee: string;
  modele: string;
  vin: string;
  kilometrage: string;
  etatGeneral: EtatGeneral | '';
  defautsConnus: string;
  // Specs moteur
  moteurMarque: string;
  moteurModele: string;
  moteurHp: string;
  moteurEpa: string;
  moteurSerie: string;
  // Transmission
  transType: string;
  transMarque: string;
  transModele: string;
  transVitesses: string;
  // Châssis
  differentielRatio: string;
  suspension: string;
  configEssieux: string;
  empattement: string;
  gvwr: string;
  // Cabine
  typeCabine: string;
  // Pneus
  pneusAvant: string;
  pneusArriere: string;
  pneusEtat: string;
  // Vendeur
  vendeurExterneId: string;
  vendeurNom: string;
  vendeurType: TypeVendeur;
  vendeurTel: string;
  vendeurEmail: string;
  vendeurAdresse: string;
  vendeurNote: string;
  sauverVendeur: boolean;
  // Source + prix + lieu
  source: string;
  prixDemande: string;
  lieuLocalisation: string;
}

const EMPTY: WizardData = {
  step: 1,
  marque: '', annee: '', modele: '', vin: '', kilometrage: '',
  etatGeneral: '', defautsConnus: '',
  moteurMarque: '', moteurModele: '', moteurHp: '', moteurEpa: '', moteurSerie: '',
  transType: '', transMarque: '', transModele: '', transVitesses: '',
  differentielRatio: '', suspension: '', configEssieux: '', empattement: '', gvwr: '',
  typeCabine: '',
  pneusAvant: '', pneusArriere: '', pneusEtat: '',
  vendeurExterneId: '', vendeurNom: '', vendeurType: 'particulier', vendeurTel: '',
  vendeurEmail: '', vendeurAdresse: '', vendeurNote: '', sauverVendeur: true,
  source: '', prixDemande: '', lieuLocalisation: '',
};

const TOTAL_STEPS = 8;

export function MobileWizardAchat({ acheteurId, onClose, onCree }: {
  acheteurId: string;
  onClose: () => void;
  onCree: (id: string) => void;
}) {
  const { creer } = useAchats();

  // Charger draft si existe
  const [data, setData] = useState<WizardData>(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try { return JSON.parse(saved); } catch { return EMPTY; }
    }
    return EMPTY;
  });

  const [photos, setPhotos] = useState<File[]>([]);
  const [photoTags, setPhotoTags] = useState<string[]>([]);
  const [vendeursExt, setVendeursExt] = useState<VendeurExterne[]>([]);
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [showResume, setShowResume] = useState(false);

  // Auto-save draft
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
  }, [data]);

  // Charger vendeurs externes
  useEffect(() => {
    vendeurExterneService.getAll(true).then(setVendeursExt).catch(console.error);
  }, []);

  const update = (patch: Partial<WizardData>) => setData(prev => ({ ...prev, ...patch }));

  // Préfill vendeur quand sélection
  useEffect(() => {
    if (!data.vendeurExterneId) return;
    const v = vendeursExt.find(x => x.id === data.vendeurExterneId);
    if (v) update({
      vendeurNom: v.nom, vendeurType: v.type,
      vendeurTel: v.telephonePrincipal ?? '', vendeurEmail: v.email ?? '',
      vendeurAdresse: v.adresse ?? '', vendeurNote: v.note ?? '',
      sauverVendeur: false,
    });
  }, [data.vendeurExterneId, vendeursExt]);

  // Modèles disponibles selon marque + année
  const modelesDispo = useMemo(() => {
    if (!data.marque) return [];
    const annee = data.annee ? parseInt(data.annee) : undefined;
    return getModelesPour(data.marque, annee);
  }, [data.marque, data.annee]);

  const anneesDispo = useMemo(() => {
    if (!data.marque) return [];
    return getAnneesPour(data.marque);
  }, [data.marque]);

  // Modèles moteur dispo
  const moteurModelesDispo = data.moteurMarque ? (ENGINE_MODELES_BY_MARQUE[data.moteurMarque] ?? []) : [];

  // Modèles transmission dispo
  const transModelesDispo = data.transMarque ? (TRANSMISSION_MODELES[data.transMarque] ?? []) : [];

  const goNext = () => update({ step: Math.min(data.step + 1, TOTAL_STEPS) });
  const goPrev = () => update({ step: Math.max(data.step - 1, 1) });

  const handleAjouterPhoto = (e: React.ChangeEvent<HTMLInputElement>, tag: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotos(prev => [...prev, file]);
    setPhotoTags(prev => [...prev, tag]);
    e.target.value = ''; // reset
  };

  const handleSupprimerPhoto = (idx: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
    setPhotoTags(prev => prev.filter((_, i) => i !== idx));
  };

  const handleCreer = async () => {
    setSaving(true);
    setErreur(null);
    try {
      // Vendeur récurrent
      let extId: string | undefined;
      if (data.vendeurExterneId) {
        extId = data.vendeurExterneId;
        await vendeurExterneService.incrementerUtilisation(extId);
      } else if (data.sauverVendeur && data.vendeurNom.trim()) {
        const ext = await vendeurExterneService.getOrCreate(data.vendeurNom.trim(), data.vendeurType);
        extId = ext.id;
        await vendeurExterneService.mettreAJour(ext.id, {
          telephonePrincipal: data.vendeurTel.trim() || undefined,
          email: data.vendeurEmail.trim() || undefined,
          adresse: data.vendeurAdresse.trim() || undefined,
          note: data.vendeurNote.trim() || undefined,
        });
        await vendeurExterneService.incrementerUtilisation(ext.id);
      }

      // Créer achat
      const created = await creer({
        marque: data.marque || undefined,
        modele: data.modele || undefined,
        annee: data.annee ? parseInt(data.annee) : undefined,
        vin: data.vin || undefined,
        kilometrage: data.kilometrage ? parseInt(data.kilometrage) : undefined,
        specs: {},
        etatGeneral: data.etatGeneral || undefined,
        defautsConnus: data.defautsConnus || undefined,
        // Moteur
        moteurMarque: data.moteurMarque || undefined,
        moteurModele: data.moteurModele || undefined,
        moteurHp: data.moteurHp ? parseInt(data.moteurHp) : undefined,
        moteurEpa: data.moteurEpa || undefined,
        moteurSerie: data.moteurSerie || undefined,
        // Trans
        transType: data.transType || undefined,
        transMarque: data.transMarque || undefined,
        transModele: data.transModele || undefined,
        transVitesses: data.transVitesses || undefined,
        // Châssis
        differentielRatio: data.differentielRatio || undefined,
        suspension: data.suspension || undefined,
        configEssieux: data.configEssieux || undefined,
        empattement: data.empattement ? parseInt(data.empattement) : undefined,
        gvwr: data.gvwr || undefined,
        // Cabine
        typeCabine: data.typeCabine || undefined,
        // Pneus
        pneusAvant: data.pneusAvant || undefined,
        pneusArriere: data.pneusArriere || undefined,
        pneusEtat: data.pneusEtat || undefined,
        // Vendeur
        vendeurExterneId: extId,
        vendeurNom: data.vendeurNom,
        vendeurTelephone: data.vendeurTel,
        vendeurEmail: data.vendeurEmail,
        vendeurType: data.vendeurType,
        vendeurAdresse: data.vendeurAdresse,
        vendeurNote: data.vendeurNote,
        // Source / prix / lieu
        source: data.source || undefined,
        prixDemandeInitial: data.prixDemande ? parseFloat(data.prixDemande) : undefined,
        lieuLocalisation: data.lieuLocalisation || undefined,
        paye: false,
        statut: 'evaluation-initiale',
        acheteurId,
      });

      // Upload photos en parallèle
      if (photos.length > 0) {
        await Promise.all(photos.map(async (file, i) => {
          try {
            const url = await photoService.uploaderPhoto(file, 'inventaire');
            await achatService.ajouterPhoto(created.id, url, photoTags[i], acheteurId);
          } catch (e) { console.error('Erreur upload photo', e); }
        }));
      }

      // Clear draft
      localStorage.removeItem(DRAFT_KEY);
      onCree(created.id);
    } catch (e: any) {
      setErreur(String(e?.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  const handleAbandonner = () => {
    if (confirm('Abandonner cette opportunité ? Le brouillon sera effacé.')) {
      localStorage.removeItem(DRAFT_KEY);
      onClose();
    }
  };

  // Validation par étape
  const peutSuivant = (() => {
    switch (data.step) {
      case 1: return true;            // Photos optionnelles
      case 2: return true;            // Identification — tout optionnel
      case 3: return true;            // Specs moteur — tout optionnel
      case 4: return true;            // Trans + diff
      case 5: return true;            // Châssis + cabine + pneus
      case 6: return data.vendeurNom.trim().length > 0;  // Vendeur nom obligatoire pour BD
      case 7: return true;            // Source + prix
      case 8: return true;
      default: return false;
    }
  })();

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: '#f8fafc',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        flexShrink: 0,
        background: '#0f172a',
        color: 'white',
        padding: '14px 16px 10px',
        borderBottom: `2px solid ${COULEUR}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <button onClick={handleAbandonner}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer', padding: 4 }}>
            ← Annuler
          </button>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>
            🛒 Étape {data.step}/{TOTAL_STEPS}
          </div>
          <button onClick={() => setShowResume(true)}
            style={{ background: 'none', border: 'none', color: COULEUR, fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 4 }}>
            Résumé
          </button>
        </div>
        {/* Progress bar */}
        <div style={{ display: 'flex', gap: 4 }}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: i < data.step ? COULEUR : 'rgba(255,255,255,0.15)',
              transition: 'all 0.2s',
            }} />
          ))}
        </div>
      </div>

      {/* Body — scroll */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 100px' }}>

        {/* ── Étape 1 : Photos ────────────────────────────────────── */}
        {data.step === 1 && (
          <Step title="📸 Photos du camion" subtitle="Prends quelques photos avec ta caméra. Optionnel.">
            {/* Photos prises */}
            {photos.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
                {photos.map((f, i) => (
                  <div key={i} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                    <img src={URL.createObjectURL(f)} alt="" style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />
                    <button onClick={() => handleSupprimerPhoto(i)}
                      style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.7)', color: 'white', cursor: 'pointer', fontSize: 12 }}>
                      ✕
                    </button>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '2px 6px', background: 'rgba(0,0,0,0.7)', color: 'white', fontSize: 9, fontWeight: 600 }}>
                      {photoTags[i]}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Boutons par catégorie */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { tag: 'exterieur', label: '📷 Extérieur (avant/arrière/côtés)' },
                { tag: 'interieur', label: '🪑 Intérieur cabine' },
                { tag: 'moteur',    label: '⚙️ Moteur (capot ouvert)' },
                { tag: 'plaque',    label: '🔢 Plaque VIN' },
                { tag: 'compteur',  label: '📊 Compteur kilométrage' },
                { tag: 'defaut',    label: '⚠️ Défaut visible' },
                { tag: 'documents', label: '📄 Documents' },
                { tag: 'autre',     label: '➕ Autre' },
              ].map(p => (
                <label key={p.tag}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 16px', borderRadius: 12,
                    border: '2px solid #e5e7eb', background: 'white',
                    cursor: 'pointer', fontSize: 15, fontWeight: 600, color: '#374151',
                  }}>
                  <input type="file" accept="image/*" capture="environment"
                    onChange={e => handleAjouterPhoto(e, p.tag)}
                    style={{ display: 'none' }} />
                  <span style={{ fontSize: 22 }}>📷</span>
                  <span>{p.label}</span>
                </label>
              ))}
            </div>
          </Step>
        )}

        {/* ── Étape 2 : Identification ────────────────────────────── */}
        {data.step === 2 && (
          <Step title="🚛 Identification" subtitle="Marque · Année · Modèle · VIN · KM">
            <FieldDropdown label="Marque" value={data.marque} onChange={v => update({ marque: v, modele: '' })}
              options={[...TRUCK_MARQUES.map(m => ({ value: m, label: m })), { value: '', label: '— Autre / saisie libre —', special: true }]} />

            {data.marque && (
              <FieldDropdown label="Année" value={data.annee} onChange={v => update({ annee: v, modele: '' })}
                options={[{ value: '', label: '— Choisir —' }, ...anneesDispo.map(y => ({ value: String(y), label: String(y) }))]} />
            )}

            {data.marque && data.annee && (
              <FieldDropdown label={`Modèle (${modelesDispo.length} dispo pour ${data.marque} ${data.annee})`} value={data.modele} onChange={v => update({ modele: v })}
                options={[
                  { value: '', label: '— Choisir —' },
                  ...modelesDispo.map(m => ({ value: m.modele, label: `${m.modele}${m.notes ? ' · ' + m.notes : ''}` })),
                  { value: '__autre__', label: '+ Autre / saisie libre', special: true },
                ]} />
            )}

            {data.modele === '__autre__' && (
              <FieldText label="Modèle (texte libre)" value="" onChange={v => update({ modele: v })} placeholder="Entrer le modèle" />
            )}

            <FieldText label="VIN (numéro de série)" value={data.vin} onChange={v => update({ vin: v.toUpperCase() })} placeholder="ex: 1FUJBBCG43LK12345" />
            <FieldText label="Kilométrage" type="number" value={data.kilometrage} onChange={v => update({ kilometrage: v })} placeholder="ex: 350000" />

            <FieldChoix label="État général" value={data.etatGeneral} onChange={v => update({ etatGeneral: v as EtatGeneral })}
              options={[
                { value: 'excellent', label: '⭐ Excellent', color: '#22c55e' },
                { value: 'bon',       label: '✓ Bon',        color: '#3b82f6' },
                { value: 'moyen',     label: '⚠ Moyen',      color: '#f59e0b' },
                { value: 'projet',    label: '🔨 Projet',     color: '#a855f7' },
                { value: 'pieces',    label: '🔧 Pièces',     color: '#dc2626' },
              ]} />

            <FieldTextarea label="Défauts connus" value={data.defautsConnus} onChange={v => update({ defautsConnus: v })} placeholder="ex: BLOW BY · pompe à fuel · piston faible · suspension..." />
          </Step>
        )}

        {/* ── Étape 3 : Moteur ────────────────────────────────────── */}
        {data.step === 3 && (
          <Step title="⚙️ Moteur" subtitle="Marque · Modèle · HP · EPA · Série">
            <FieldDropdown label="Marque moteur" value={data.moteurMarque} onChange={v => update({ moteurMarque: v, moteurModele: '' })}
              options={[{ value: '', label: '— Choisir —' }, ...ENGINE_MARQUES.map(m => ({ value: m, label: m }))]} />

            {data.moteurMarque && (
              <FieldDropdown label="Modèle moteur" value={data.moteurModele} onChange={v => update({ moteurModele: v })}
                options={[
                  { value: '', label: '— Choisir —' },
                  ...moteurModelesDispo.map(m => ({ value: m, label: m })),
                  { value: '__autre__', label: '+ Autre', special: true },
                ]} />
            )}

            {data.moteurModele === '__autre__' && (
              <FieldText label="Modèle moteur (libre)" value="" onChange={v => update({ moteurModele: v })} placeholder="ex: Custom..." />
            )}

            <FieldText label="HP (puissance)" type="number" value={data.moteurHp} onChange={v => update({ moteurHp: v })} placeholder="ex: 510" />

            <FieldDropdown label="EPA / GHG" value={data.moteurEpa} onChange={v => update({ moteurEpa: v })}
              options={[{ value: '', label: '— Choisir —' }, ...EPA_VALUES.map(e => ({ value: e, label: e }))]} />

            <FieldText label="Série moteur (CM xxxx)" value={data.moteurSerie} onChange={v => update({ moteurSerie: v.toUpperCase() })} placeholder="ex: CM2350" />
          </Step>
        )}

        {/* ── Étape 4 : Transmission + Différentiel ──────────────── */}
        {data.step === 4 && (
          <Step title="🔧 Transmission · Différentiel" subtitle="Type · Marque · Vitesses · Ratio">
            <FieldChoix label="Type transmission" value={data.transType} onChange={v => update({ transType: v })}
              options={TRANSMISSION_TYPES.map(t => ({ value: t, label: t, color: '#3b82f6' }))} />

            <FieldDropdown label="Marque transmission" value={data.transMarque} onChange={v => update({ transMarque: v, transModele: '' })}
              options={[{ value: '', label: '— Choisir —' }, ...TRANSMISSION_MARQUES.map(m => ({ value: m, label: m }))]} />

            {data.transMarque && (
              <FieldDropdown label="Modèle transmission" value={data.transModele} onChange={v => update({ transModele: v })}
                options={[
                  { value: '', label: '— Choisir —' },
                  ...transModelesDispo.map(m => ({ value: m, label: m })),
                  { value: '__autre__', label: '+ Autre', special: true },
                ]} />
            )}
            {data.transModele === '__autre__' && (
              <FieldText label="Modèle transmission (libre)" value="" onChange={v => update({ transModele: v })} placeholder="ex: ..." />
            )}

            <FieldText label="Nombre de vitesses" value={data.transVitesses} onChange={v => update({ transVitesses: v })} placeholder="ex: 10-speed, 13-speed, 18-speed" />

            <FieldDropdown label="Différentiel (ratio)" value={data.differentielRatio} onChange={v => update({ differentielRatio: v })}
              options={[{ value: '', label: '— Choisir —' }, ...DIFFERENTIEL_RATIOS.map(r => ({ value: r, label: r }))]} />
          </Step>
        )}

        {/* ── Étape 5 : Châssis + cabine + pneus ─────────────────── */}
        {data.step === 5 && (
          <Step title="🚚 Châssis · Cabine · Pneus" subtitle="Suspension · Essieux · Empattement · GVWR">
            <FieldDropdown label="Suspension arrière" value={data.suspension} onChange={v => update({ suspension: v })}
              options={[{ value: '', label: '— Choisir —' }, ...SUSPENSIONS.map(s => ({ value: s, label: s }))]} />

            <FieldDropdown label="Configuration essieux" value={data.configEssieux} onChange={v => update({ configEssieux: v })}
              options={[{ value: '', label: '— Choisir —' }, ...CONFIGS_ESSIEUX.map(c => ({ value: c, label: c }))]} />

            <FieldText label="Empattement (pouces)" type="number" value={data.empattement} onChange={v => update({ empattement: v })} placeholder="ex: 240" />

            <FieldDropdown label="GVWR (capacité)" value={data.gvwr} onChange={v => update({ gvwr: v })}
              options={[{ value: '', label: '— Choisir —' }, ...GVWR_OPTIONS.map(g => ({ value: g, label: g }))]} />

            <FieldDropdown label="Type cabine" value={data.typeCabine} onChange={v => update({ typeCabine: v })}
              options={[{ value: '', label: '— Choisir —' }, ...TYPES_CABINE.map(c => ({ value: c, label: c }))]} />

            <FieldText label="Pneus avant (dimension)" value={data.pneusAvant} onChange={v => update({ pneusAvant: v })} placeholder="ex: 295/75R22.5" />
            <FieldText label="Pneus arrière (dimension)" value={data.pneusArriere} onChange={v => update({ pneusArriere: v })} placeholder="ex: 11R22.5" />

            <FieldChoix label="État pneus" value={data.pneusEtat} onChange={v => update({ pneusEtat: v })}
              options={[
                { value: 'neufs',     label: '⭐ Neufs',      color: '#22c55e' },
                { value: 'mi-vie',    label: '✓ Mi-vie',     color: '#f59e0b' },
                { value: 'a-changer', label: '⚠ À changer',   color: '#dc2626' },
              ]} />
          </Step>
        )}

        {/* ── Étape 6 : Vendeur ──────────────────────────────────── */}
        {data.step === 6 && (
          <Step title="👤 Vendeur" subtitle="Qui vend le camion ?">
            {vendeursExt.length > 0 && (
              <FieldDropdown label="Vendeur connu (préfille)" value={data.vendeurExterneId} onChange={v => update({ vendeurExterneId: v })}
                options={[
                  { value: '', label: '— Nouveau vendeur —' },
                  ...vendeursExt.map(v => ({ value: v.id, label: `${v.nom} (${v.type})${v.foisUtilise > 0 ? ` · ${v.foisUtilise}×` : ''}` })),
                ]} />
            )}

            <FieldText label="Nom du vendeur *" value={data.vendeurNom} onChange={v => update({ vendeurNom: v })} placeholder="Jean Tremblay / Encan Manheim..." />

            <FieldChoix label="Type vendeur" value={data.vendeurType} onChange={v => update({ vendeurType: v as TypeVendeur })}
              options={[
                { value: 'particulier',     label: '👤 Particulier',     color: '#64748b' },
                { value: 'concessionnaire', label: '🏢 Concessionnaire', color: '#3b82f6' },
                { value: 'encan',           label: '🔨 Encan',            color: '#f97316' },
                { value: 'flotte',          label: '🚛 Flotte',           color: '#22c55e' },
                { value: 'autre',           label: '➕ Autre',            color: '#6b7280' },
              ]} />

            <FieldText label="Téléphone" type="tel" value={data.vendeurTel} onChange={v => update({ vendeurTel: v })} placeholder="514-555-1234" />
            <FieldText label="Email" type="email" value={data.vendeurEmail} onChange={v => update({ vendeurEmail: v })} placeholder="vendeur@example.com" />
            <FieldText label="Adresse" value={data.vendeurAdresse} onChange={v => update({ vendeurAdresse: v })} placeholder="123 rue Principale, Ville, QC" />
            <FieldTextarea label="Note vendeur" value={data.vendeurNote} onChange={v => update({ vendeurNote: v })} placeholder="Disponibilités, préférences..." />

            {!data.vendeurExterneId && data.vendeurNom.trim() && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #86efac', fontSize: 13 }}>
                <input type="checkbox" checked={data.sauverVendeur} onChange={e => update({ sauverVendeur: e.target.checked })} style={{ width: 18, height: 18 }} />
                <span>💾 Sauvegarder ce vendeur pour réutilisation future</span>
              </label>
            )}
          </Step>
        )}

        {/* ── Étape 7 : Source + prix + lieu ─────────────────────── */}
        {data.step === 7 && (
          <Step title="💰 Source · Prix · Lieu" subtitle="Où as-tu trouvé ce camion ? Combien ? Où le récupérer ?">
            <FieldText label="Source (où trouvé)" value={data.source} onChange={v => update({ source: v })} placeholder="Ex: Encan Manheim 30 avril, AutoTrader, référence Joel..." />
            <FieldText label="Prix demandé ($)" type="number" value={data.prixDemande} onChange={v => update({ prixDemande: v })} placeholder="35000" />
            <FieldText label="Lieu pickup (ville/coordonnées)" value={data.lieuLocalisation} onChange={v => update({ lieuLocalisation: v })} placeholder="Ex: Trois-Rivières, QC" />
          </Step>
        )}

        {/* ── Étape 8 : Résumé + créer ───────────────────────────── */}
        {data.step === 8 && (
          <Step title="✅ Résumé" subtitle="Vérifie et crée l'opportunité">
            <ResumeCarte data={data} photos={photos.length} />
            {erreur && (
              <div style={{ padding: 12, borderRadius: 8, background: '#fee2e2', color: '#991b1b', fontSize: 13, fontWeight: 600, marginTop: 14 }}>
                ⚠ {erreur}
              </div>
            )}
          </Step>
        )}
      </div>

      {/* Footer fixe */}
      <div style={{
        flexShrink: 0,
        background: 'white',
        borderTop: '1px solid #e5e7eb',
        padding: '12px 16px env(safe-area-inset-bottom, 12px)',
        display: 'flex', gap: 10,
        boxShadow: '0 -2px 12px rgba(0,0,0,0.08)',
      }}>
        {data.step > 1 && (
          <button onClick={goPrev}
            style={{ flex: '0 0 auto', padding: '14px 20px', borderRadius: 12, border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
            ←
          </button>
        )}
        {data.step < TOTAL_STEPS ? (
          <button onClick={goNext} disabled={!peutSuivant}
            style={{
              flex: 1, padding: '14px', borderRadius: 12, border: 'none',
              background: peutSuivant ? COULEUR : '#e5e7eb',
              color: peutSuivant ? 'white' : '#9ca3af',
              fontSize: 16, fontWeight: 800, cursor: peutSuivant ? 'pointer' : 'not-allowed',
            }}>
            Suivant →
          </button>
        ) : (
          <button onClick={handleCreer} disabled={saving}
            style={{
              flex: 1, padding: '14px', borderRadius: 12, border: 'none',
              background: saving ? '#e5e7eb' : COULEUR,
              color: saving ? '#9ca3af' : 'white',
              fontSize: 16, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer',
            }}>
            {saving ? '⏳ Création...' : '✓ CRÉER L\'OPPORTUNITÉ'}
          </button>
        )}
      </div>

      {/* Modal résumé */}
      {showResume && (
        <div onClick={() => setShowResume(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 500, maxHeight: '80vh', overflowY: 'auto', background: 'white', borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Résumé</h3>
              <button onClick={() => setShowResume(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9ca3af' }}>✕</button>
            </div>
            <ResumeCarte data={data} photos={photos.length} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Components ────────────────────────────────────────────────────

function Step({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', margin: '4px 0 4px' }}>{title}</h2>
      {subtitle && <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 18px' }}>{subtitle}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
    </div>
  );
}

function FieldText({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', padding: '14px 14px', borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 16, background: 'white', boxSizing: 'border-box', outline: 'none', color: '#111827' }} />
    </div>
  );
}

function FieldTextarea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3}
        style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 15, background: 'white', boxSizing: 'border-box', outline: 'none', color: '#111827', fontFamily: 'inherit', resize: 'vertical' }} />
    </div>
  );
}

function FieldDropdown({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: Array<{ value: string; label: string; special?: boolean }>;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '14px 14px', borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 16, background: 'white', boxSizing: 'border-box', outline: 'none', color: '#111827', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', paddingRight: 40 }}>
        {options.map(o => (
          <option key={o.value} value={o.value} style={o.special ? { fontStyle: 'italic', color: '#7c3aed' } : undefined}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function FieldChoix({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: Array<{ value: string; label: string; color?: string }>;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map(o => {
          const actif = value === o.value;
          const color = o.color ?? '#3b82f6';
          return (
            <button key={o.value} onClick={() => onChange(actif ? '' : o.value)}
              style={{
                flex: '1 1 calc(50% - 4px)', minWidth: 0,
                padding: '12px 8px', borderRadius: 10,
                border: actif ? `2px solid ${color}` : '1px solid #e5e7eb',
                background: actif ? `${color}15` : 'white',
                color: actif ? color : '#374151',
                fontSize: 14, fontWeight: actif ? 700 : 500,
                cursor: 'pointer', textAlign: 'center',
              }}>
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ResumeCarte({ data, photos }: { data: WizardData; photos: number }) {
  const titre = [data.annee, data.marque, data.modele].filter(x => x && x !== '__autre__').join(' ') || 'Sans titre';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Card title="🚛 Camion">
        <Line label="Titre" value={titre} />
        <Line label="VIN" value={data.vin || '—'} />
        <Line label="KM" value={data.kilometrage ? `${parseInt(data.kilometrage).toLocaleString()} km` : '—'} />
        <Line label="État" value={data.etatGeneral || '—'} />
        {data.defautsConnus && <Line label="Défauts" value={data.defautsConnus} multiline />}
      </Card>
      <Card title="⚙️ Moteur">
        <Line label="Marque" value={data.moteurMarque || '—'} />
        <Line label="Modèle" value={data.moteurModele || '—'} />
        <Line label="HP" value={data.moteurHp || '—'} />
        <Line label="EPA" value={data.moteurEpa || '—'} />
      </Card>
      <Card title="🔧 Trans · Diff">
        <Line label="Type" value={data.transType || '—'} />
        <Line label="Marque" value={data.transMarque || '—'} />
        <Line label="Modèle" value={data.transModele || '—'} />
        <Line label="Vitesses" value={data.transVitesses || '—'} />
        <Line label="Diff ratio" value={data.differentielRatio || '—'} />
      </Card>
      <Card title="🚚 Châssis · Cabine">
        <Line label="Suspension" value={data.suspension || '—'} />
        <Line label="Essieux" value={data.configEssieux || '—'} />
        <Line label="Empattement" value={data.empattement ? `${data.empattement}"` : '—'} />
        <Line label="GVWR" value={data.gvwr || '—'} />
        <Line label="Cabine" value={data.typeCabine || '—'} />
      </Card>
      <Card title="👤 Vendeur">
        <Line label="Nom" value={data.vendeurNom || '—'} />
        <Line label="Type" value={data.vendeurType} />
        <Line label="Tél" value={data.vendeurTel || '—'} />
        <Line label="Email" value={data.vendeurEmail || '—'} />
      </Card>
      <Card title="💰 Prix · Lieu">
        <Line label="Source" value={data.source || '—'} />
        <Line label="Prix demandé" value={data.prixDemande ? `${parseFloat(data.prixDemande).toLocaleString()} $` : '—'} />
        <Line label="Lieu" value={data.lieuLocalisation || '—'} />
      </Card>
      <Card title="📸 Photos">
        <Line label="Nombre" value={String(photos)} />
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>
      {children}
    </div>
  );
}

function Line({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 6, fontSize: 13, padding: '2px 0', alignItems: multiline ? 'flex-start' : 'center' }}>
      <span style={{ width: 90, flexShrink: 0, color: '#9ca3af', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      <span style={{ color: '#111827', fontWeight: 600, whiteSpace: multiline ? 'pre-wrap' : 'nowrap', overflow: multiline ? 'visible' : 'hidden', textOverflow: multiline ? 'clip' : 'ellipsis' }}>{value}</span>
    </div>
  );
}
