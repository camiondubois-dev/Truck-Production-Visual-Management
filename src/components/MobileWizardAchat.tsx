// ════════════════════════════════════════════════════════════════
// Mobile Wizard Achat — 8 étapes optimisées téléphone
// Ordre : Photos → Identification → Vendeur → Prix → Specs (opt.) → Résumé
// ════════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo } from 'react';
import { useAchats } from '../contexts/AchatContext';
import { vendeurExterneService } from '../services/vendeurExterneService';
import { achatService } from '../services/achatService';
import { photoService } from '../services/photoService';
import {
  TRUCK_MARQUES, getModelesPour, getAnneesPour,
  ENGINE_MARQUES, ENGINE_MODELES_BY_MARQUE,
  EPA_VALUES, TRANSMISSION_MARQUES, TRANSMISSION_MODELES, TRANSMISSION_TYPES,
  DIFFERENTIEL_RATIOS, SUSPENSIONS, CONFIGS_ESSIEUX, TYPES_CABINE, GVWR_OPTIONS,
} from '../data/truckReference';
import type { VendeurExterne, TypeVendeur, EtatGeneral } from '../types/achatTypes';

const COULEUR = '#10b981';
const DRAFT_KEY = 'achats_wizard_draft';

// ─── Étapes ────────────────────────────────────────────────────
// 1: Photos
// 2: Identification (marque/année/modèle/VIN/KM/état/défauts)
// 3: Vendeur (nom, type, tél…) — OBLIGATOIRE
// 4: Source + Prix + Lieu — chemin minimal complet
// 5: Moteur (optionnel — peut passer)
// 6: Transmission + Différentiel (optionnel — peut passer)
// 7: Châssis + Cabine + Pneus (optionnel — peut passer)
// 8: Résumé + Créer
const TOTAL_STEPS = 8;
const ETAPES_OPTIONNELLES = [5, 6, 7]; // peuvent être passées

interface WizardData {
  step: number;
  marque: string;
  annee: string;
  modele: string;
  vin: string;
  kilometrage: string;
  etatGeneral: EtatGeneral | '';
  defautsConnus: string;
  moteurMarque: string;
  moteurModele: string;
  moteurHp: string;
  moteurEpa: string;
  moteurSerie: string;
  transType: string;
  transMarque: string;
  transModele: string;
  transVitesses: string;
  differentielRatio: string;
  suspension: string;
  configEssieux: string;
  empattement: string;
  gvwr: string;
  typeCabine: string;
  pneusAvant: string;
  pneusArriere: string;
  pneusEtat: string;
  vendeurExterneId: string;
  vendeurNom: string;
  vendeurType: TypeVendeur;
  vendeurTel: string;
  vendeurEmail: string;
  vendeurAdresse: string;
  vendeurNote: string;
  sauverVendeur: boolean;
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

export function MobileWizardAchat({ acheteurId, onClose, onCree }: {
  acheteurId: string;
  onClose: () => void;
  onCree: (id: string) => void;
}) {
  const { creer } = useAchats();

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

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    vendeurExterneService.getAll(true).then(setVendeursExt).catch(console.error);
  }, []);

  const update = (patch: Partial<WizardData>) => setData(prev => ({ ...prev, ...patch }));

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

  const modelesDispo = useMemo(() => {
    if (!data.marque) return [];
    return getModelesPour(data.marque, data.annee ? parseInt(data.annee) : undefined);
  }, [data.marque, data.annee]);

  const anneesDispo = useMemo(() => {
    if (!data.marque) return [];
    return getAnneesPour(data.marque);
  }, [data.marque]);

  const moteurModelesDispo = data.moteurMarque ? (ENGINE_MODELES_BY_MARQUE[data.moteurMarque] ?? []) : [];
  const transModelesDispo   = data.transMarque  ? (TRANSMISSION_MODELES[data.transMarque] ?? [])    : [];

  const goNext = () => update({ step: Math.min(data.step + 1, TOTAL_STEPS) });
  const goPrev = () => update({ step: Math.max(data.step - 1, 1) });
  const passerEtape = () => goNext(); // sauter une étape optionnelle

  const handleAjouterPhoto = (e: React.ChangeEvent<HTMLInputElement>, tag: string) => {
    const files = e.target.files;
    if (!files) return;
    const newFiles = Array.from(files);
    setPhotos(prev => [...prev, ...newFiles]);
    setPhotoTags(prev => [...prev, ...newFiles.map(() => tag)]);
    e.target.value = '';
  };

  const handleSupprimerPhoto = (idx: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
    setPhotoTags(prev => prev.filter((_, i) => i !== idx));
  };

  const handleCreer = async () => {
    setSaving(true);
    setErreur(null);
    try {
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

      const created = await creer({
        marque: data.marque || undefined,
        modele: data.modele === '__autre__' ? undefined : data.modele || undefined,
        annee: data.annee ? parseInt(data.annee) : undefined,
        vin: data.vin || undefined,
        kilometrage: data.kilometrage ? parseInt(data.kilometrage) : undefined,
        specs: {},
        etatGeneral: data.etatGeneral || undefined,
        defautsConnus: data.defautsConnus || undefined,
        moteurMarque: data.moteurMarque || undefined,
        moteurModele: data.moteurModele === '__autre__' ? undefined : data.moteurModele || undefined,
        moteurHp: data.moteurHp ? parseInt(data.moteurHp) : undefined,
        moteurEpa: data.moteurEpa || undefined,
        moteurSerie: data.moteurSerie || undefined,
        transType: data.transType || undefined,
        transMarque: data.transMarque || undefined,
        transModele: data.transModele === '__autre__' ? undefined : data.transModele || undefined,
        transVitesses: data.transVitesses || undefined,
        differentielRatio: data.differentielRatio || undefined,
        suspension: data.suspension || undefined,
        configEssieux: data.configEssieux || undefined,
        empattement: data.empattement ? parseInt(data.empattement) : undefined,
        gvwr: data.gvwr || undefined,
        typeCabine: data.typeCabine || undefined,
        pneusAvant: data.pneusAvant || undefined,
        pneusArriere: data.pneusArriere || undefined,
        pneusEtat: data.pneusEtat || undefined,
        vendeurExterneId: extId,
        vendeurNom: data.vendeurNom,
        vendeurTelephone: data.vendeurTel,
        vendeurEmail: data.vendeurEmail,
        vendeurType: data.vendeurType,
        vendeurAdresse: data.vendeurAdresse,
        vendeurNote: data.vendeurNote,
        source: data.source || undefined,
        prixDemandeInitial: data.prixDemande ? parseFloat(data.prixDemande) : undefined,
        lieuLocalisation: data.lieuLocalisation || undefined,
        paye: false,
        statut: 'evaluation-initiale',
        acheteurId,
      });

      if (photos.length > 0) {
        await Promise.all(photos.map(async (file, i) => {
          try {
            const url = await photoService.uploaderPhoto(file, 'inventaire');
            await achatService.ajouterPhoto(created.id, url, photoTags[i], acheteurId);
          } catch (e) { console.error('Erreur upload photo', e); }
        }));
      }

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

  const peutSuivant = (() => {
    switch (data.step) {
      case 1: return true;
      case 2: return true;
      case 3: return data.vendeurNom.trim().length > 0;
      case 4: return true;
      case 5: return true;
      case 6: return true;
      case 7: return true;
      case 8: return true;
      default: return false;
    }
  })();

  const estOptionnelle = ETAPES_OPTIONNELLES.includes(data.step);

  const nomEtape = [
    '', '📸 Photos', '🚛 Camion', '👤 Vendeur', '💰 Prix', '⚙️ Moteur', '🔧 Trans', '🚚 Châssis', '✅ Résumé',
  ][data.step];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: '#f1f5f9',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        flexShrink: 0,
        background: '#0f172a',
        color: 'white',
        padding: '16px 16px 12px',
        borderBottom: `3px solid ${COULEUR}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button onClick={handleAbandonner}
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', fontSize: 15, cursor: 'pointer', padding: '8px 14px', borderRadius: 10, fontWeight: 600 }}>
            ← Annuler
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'white' }}>{nomEtape}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>
              Étape {data.step} / {TOTAL_STEPS}
              {estOptionnelle && <span style={{ color: COULEUR, marginLeft: 6 }}>· optionnelle</span>}
            </div>
          </div>
          <button onClick={() => setShowResume(true)}
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: COULEUR, fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: '8px 14px', borderRadius: 10 }}>
            Résumé
          </button>
        </div>
        {/* Barre de progression */}
        <div style={{ display: 'flex', gap: 3 }}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 5, borderRadius: 3,
              background: i < data.step ? COULEUR : 'rgba(255,255,255,0.12)',
              transition: 'background 0.2s',
            }} />
          ))}
        </div>
      </div>

      {/* Corps — scroll */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '22px 16px 110px', WebkitOverflowScrolling: 'touch' }}>

        {/* ─── Étape 1 : Photos ─────────────────────────────────── */}
        {data.step === 1 && (
          <Step title="📸 Photos du camion" subtitle="Prends tes photos directement avec la caméra. Tu peux aussi en ajouter plus tard.">
            {photos.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
                {photos.map((f, i) => (
                  <div key={i} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '2px solid #e5e7eb' }}>
                    <img src={URL.createObjectURL(f)} alt="" style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }} />
                    <button onClick={() => handleSupprimerPhoto(i)}
                      style={{ position: 'absolute', top: 5, right: 5, width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.75)', color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
                      ✕
                    </button>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '3px 6px', background: 'rgba(0,0,0,0.72)', color: 'white', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>
                      {photoTags[i]}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {photos.length > 0 && (
              <div style={{ textAlign: 'center', padding: '8px', background: `${COULEUR}15`, borderRadius: 10, marginBottom: 12, fontSize: 15, fontWeight: 700, color: COULEUR }}>
                ✓ {photos.length} photo{photos.length > 1 ? 's' : ''} ajoutée{photos.length > 1 ? 's' : ''}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { tag: 'exterieur', emoji: '🚛', label: 'Extérieur',       hint: 'avant, arrière, côtés' },
                { tag: 'interieur', emoji: '🪑', label: 'Intérieur cabine', hint: 'tableau de bord, sièges' },
                { tag: 'moteur',    emoji: '⚙️', label: 'Moteur',           hint: 'capot ouvert' },
                { tag: 'plaque',    emoji: '🔢', label: 'Plaque VIN',       hint: 'numéro de série' },
                { tag: 'compteur',  emoji: '📊', label: 'Kilométrage',      hint: 'tableau de bord' },
                { tag: 'defaut',    emoji: '⚠️', label: 'Défaut visible',   hint: 'dommage, rouille, fuite' },
                { tag: 'documents', emoji: '📄', label: 'Documents',        hint: 'titre, immat, service' },
                { tag: 'autre',     emoji: '➕', label: 'Autre',            hint: '' },
              ].map(p => (
                <label key={p.tag} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '16px 18px', borderRadius: 14,
                  border: '2px solid #e2e8f0', background: 'white',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}>
                  <input type="file" accept="image/*" capture="environment" multiple
                    onChange={e => handleAjouterPhoto(e, p.tag)}
                    style={{ display: 'none' }} />
                  <span style={{ fontSize: 28, flexShrink: 0 }}>{p.emoji}</span>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: '#1e293b' }}>{p.label}</div>
                    {p.hint && <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 1 }}>{p.hint}</div>}
                  </div>
                  <span style={{ marginLeft: 'auto', fontSize: 24, color: '#cbd5e1' }}>📷</span>
                </label>
              ))}
            </div>
          </Step>
        )}

        {/* ─── Étape 2 : Identification camion ──────────────────── */}
        {data.step === 2 && (
          <Step title="🚛 Identification" subtitle="Marque · Année · Modèle · VIN · Kilométrage">
            <FieldDropdown label="Marque" value={data.marque} onChange={v => update({ marque: v, modele: '' })}
              options={[{ value: '', label: '— Choisir la marque —' }, ...TRUCK_MARQUES.map(m => ({ value: m, label: m })), { value: '__autre__', label: '— Autre / saisie libre —', special: true }]} />

            {data.marque && data.marque !== '__autre__' && (
              <FieldDropdown label="Année" value={data.annee} onChange={v => update({ annee: v, modele: '' })}
                options={[{ value: '', label: '— Choisir l\'année —' }, ...anneesDispo.map(y => ({ value: String(y), label: String(y) }))]} />
            )}

            {data.marque && data.annee && (
              <FieldDropdown label={`Modèle (${modelesDispo.length} disponibles)`} value={data.modele} onChange={v => update({ modele: v })}
                options={[
                  { value: '', label: '— Choisir le modèle —' },
                  ...modelesDispo.map(m => ({ value: m.modele, label: `${m.modele}${m.notes ? ' · ' + m.notes : ''}` })),
                  { value: '__autre__', label: '+ Autre / saisie libre', special: true },
                ]} />
            )}

            {(data.modele === '__autre__' || data.marque === '__autre__') && (
              <FieldText label="Modèle (texte libre)" value={data.modele === '__autre__' ? '' : data.modele} onChange={v => update({ modele: v })} placeholder="Entrer le modèle manuellement" />
            )}

            <FieldText label="Numéro VIN (numéro de série)" value={data.vin} onChange={v => update({ vin: v.toUpperCase() })} placeholder="ex: 1FUJBBCG43LK12345" />
            <FieldText label="Kilométrage" type="number" value={data.kilometrage} onChange={v => update({ kilometrage: v })} placeholder="ex: 350 000" />

            <FieldChoix label="État général" value={data.etatGeneral} onChange={v => update({ etatGeneral: v as EtatGeneral })}
              options={[
                { value: 'excellent', label: '⭐ Excellent', color: '#22c55e' },
                { value: 'bon',       label: '✓ Bon',        color: '#3b82f6' },
                { value: 'moyen',     label: '⚠ Moyen',      color: '#f59e0b' },
                { value: 'projet',    label: '🔨 Projet',     color: '#a855f7' },
                { value: 'pieces',    label: '🔧 Pièces',     color: '#dc2626' },
              ]} />

            <FieldTextarea label="Défauts connus / notes importantes" value={data.defautsConnus} onChange={v => update({ defautsConnus: v })}
              placeholder="ex: Blow-by moteur, pompe à fuel à changer, piston faible cyl. 3, suspension usée…" />
          </Step>
        )}

        {/* ─── Étape 3 : Vendeur ────────────────────────────────── */}
        {data.step === 3 && (
          <Step title="👤 Vendeur" subtitle="Qui vend ce camion ? (obligatoire)">
            {vendeursExt.length > 0 && (
              <div style={{ marginBottom: 4 }}>
                <FieldDropdown label="Vendeur connu — préremplit les infos" value={data.vendeurExterneId} onChange={v => update({ vendeurExterneId: v })}
                  options={[
                    { value: '', label: '— Nouveau vendeur —' },
                    ...vendeursExt.map(v => ({ value: v.id, label: `${v.nom} · ${v.type}${v.foisUtilise > 0 ? ` (${v.foisUtilise}×)` : ''}` })),
                  ]} />
              </div>
            )}

            <FieldText label="Nom du vendeur *" value={data.vendeurNom} onChange={v => update({ vendeurNom: v })} placeholder="Jean Tremblay / Encan Manheim / Peterbilt Montréal…" />

            <FieldChoix label="Type de vendeur" value={data.vendeurType} onChange={v => update({ vendeurType: v as TypeVendeur })}
              options={[
                { value: 'particulier',     label: '👤 Particulier',     color: '#64748b' },
                { value: 'concessionnaire', label: '🏢 Concessionnaire', color: '#3b82f6' },
                { value: 'encan',           label: '🔨 Encan',            color: '#f97316' },
                { value: 'flotte',          label: '🚛 Flotte',           color: '#22c55e' },
                { value: 'autre',           label: '➕ Autre',            color: '#6b7280' },
              ]} />

            <FieldText label="Téléphone" type="tel" value={data.vendeurTel} onChange={v => update({ vendeurTel: v })} placeholder="514-555-1234" />
            <FieldText label="Courriel" type="email" value={data.vendeurEmail} onChange={v => update({ vendeurEmail: v })} placeholder="vendeur@example.com" />
            <FieldText label="Adresse (ville, province)" value={data.vendeurAdresse} onChange={v => update({ vendeurAdresse: v })} placeholder="Trois-Rivières, QC" />
            <FieldTextarea label="Note sur le vendeur" value={data.vendeurNote} onChange={v => update({ vendeurNote: v })} placeholder="Disponibilités, conditions, commentaires…" />

            {!data.vendeurExterneId && data.vendeurNom.trim() && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px', borderRadius: 12, background: '#f0fdf4', border: '1px solid #86efac', fontSize: 15 }}>
                <input type="checkbox" checked={data.sauverVendeur} onChange={e => update({ sauverVendeur: e.target.checked })} style={{ width: 22, height: 22 }} />
                <span style={{ fontWeight: 600, color: '#15803d' }}>💾 Mémoriser ce vendeur pour la prochaine fois</span>
              </label>
            )}
          </Step>
        )}

        {/* ─── Étape 4 : Source + Prix + Lieu ───────────────────── */}
        {data.step === 4 && (
          <Step title="💰 Source · Prix · Lieu" subtitle="Où as-tu trouvé ce camion, à quel prix et où le récupérer ?">
            <FieldText label="Source (comment tu l'as trouvé)" value={data.source} onChange={v => update({ source: v })} placeholder="Encan Manheim 30 avril · AutoTrader · Référence de Joël…" />
            <FieldText label="Prix demandé ($)" type="number" value={data.prixDemande} onChange={v => update({ prixDemande: v })} placeholder="35 000" />
            <FieldText label="Lieu de récupération (ville)" value={data.lieuLocalisation} onChange={v => update({ lieuLocalisation: v })} placeholder="Trois-Rivières, QC" />

            {/* Rappel visite rapide */}
            <div style={{ padding: '14px 16px', borderRadius: 12, background: '#eff6ff', border: '1px solid #bfdbfe', marginTop: 4 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1d4ed8', marginBottom: 4 }}>💡 Chemin rapide</div>
              <div style={{ fontSize: 14, color: '#3730a3', lineHeight: 1.5 }}>
                Tu peux créer l'opportunité maintenant et compléter les specs du moteur, transmission et châssis plus tard depuis la fiche.
              </div>
            </div>
          </Step>
        )}

        {/* ─── Étape 5 : Moteur (OPTIONNELLE) ───────────────────── */}
        {data.step === 5 && (
          <Step title="⚙️ Moteur" subtitle="Optionnel — tu peux remplir ça plus tard depuis la fiche." optionnel>
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
              <FieldText label="Modèle moteur (libre)" value="" onChange={v => update({ moteurModele: v })} placeholder="ex: ISX15, DD13…" />
            )}

            <FieldText label="Puissance (HP)" type="number" value={data.moteurHp} onChange={v => update({ moteurHp: v })} placeholder="ex: 510" />
            <FieldDropdown label="EPA / GHG" value={data.moteurEpa} onChange={v => update({ moteurEpa: v })}
              options={[{ value: '', label: '— Choisir —' }, ...EPA_VALUES.map(e => ({ value: e, label: e }))]} />
            <FieldText label="Série moteur (CM xxxx)" value={data.moteurSerie} onChange={v => update({ moteurSerie: v.toUpperCase() })} placeholder="ex: CM2350" />
          </Step>
        )}

        {/* ─── Étape 6 : Transmission + Différentiel (OPTIONNELLE) */}
        {data.step === 6 && (
          <Step title="🔧 Transmission · Différentiel" subtitle="Optionnel — tu peux remplir ça plus tard depuis la fiche." optionnel>
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

            <FieldText label="Nombre de vitesses" value={data.transVitesses} onChange={v => update({ transVitesses: v })} placeholder="ex: 10-speed, 13-speed, 18-speed" />
            <FieldDropdown label="Différentiel (ratio)" value={data.differentielRatio} onChange={v => update({ differentielRatio: v })}
              options={[{ value: '', label: '— Choisir —' }, ...DIFFERENTIEL_RATIOS.map(r => ({ value: r, label: r }))]} />
          </Step>
        )}

        {/* ─── Étape 7 : Châssis + Cabine + Pneus (OPTIONNELLE) ─── */}
        {data.step === 7 && (
          <Step title="🚚 Châssis · Cabine · Pneus" subtitle="Optionnel — tu peux remplir ça plus tard depuis la fiche." optionnel>
            <FieldDropdown label="Suspension arrière" value={data.suspension} onChange={v => update({ suspension: v })}
              options={[{ value: '', label: '— Choisir —' }, ...SUSPENSIONS.map(s => ({ value: s, label: s }))]} />
            <FieldDropdown label="Configuration essieux" value={data.configEssieux} onChange={v => update({ configEssieux: v })}
              options={[{ value: '', label: '— Choisir —' }, ...CONFIGS_ESSIEUX.map(c => ({ value: c, label: c }))]} />
            <FieldText label="Empattement (pouces)" type="number" value={data.empattement} onChange={v => update({ empattement: v })} placeholder="ex: 240" />
            <FieldDropdown label="GVWR (capacité)" value={data.gvwr} onChange={v => update({ gvwr: v })}
              options={[{ value: '', label: '— Choisir —' }, ...GVWR_OPTIONS.map(g => ({ value: g, label: g }))]} />
            <FieldDropdown label="Type cabine" value={data.typeCabine} onChange={v => update({ typeCabine: v })}
              options={[{ value: '', label: '— Choisir —' }, ...TYPES_CABINE.map(c => ({ value: c, label: c }))]} />
            <FieldText label="Pneus avant" value={data.pneusAvant} onChange={v => update({ pneusAvant: v })} placeholder="ex: 295/75R22.5" />
            <FieldText label="Pneus arrière" value={data.pneusArriere} onChange={v => update({ pneusArriere: v })} placeholder="ex: 11R22.5" />
            <FieldChoix label="État pneus" value={data.pneusEtat} onChange={v => update({ pneusEtat: v })}
              options={[
                { value: 'neufs',     label: '⭐ Neufs',      color: '#22c55e' },
                { value: 'mi-vie',    label: '✓ Mi-vie',     color: '#f59e0b' },
                { value: 'a-changer', label: '⚠ À changer',  color: '#dc2626' },
              ]} />
          </Step>
        )}

        {/* ─── Étape 8 : Résumé ─────────────────────────────────── */}
        {data.step === 8 && (
          <Step title="✅ Résumé final" subtitle="Vérifie les informations avant de créer l'opportunité.">
            <ResumeCarte data={data} photos={photos.length} />
            {erreur && (
              <div style={{ padding: 14, borderRadius: 10, background: '#fee2e2', color: '#991b1b', fontSize: 15, fontWeight: 600, marginTop: 14 }}>
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
        borderTop: '2px solid #e5e7eb',
        padding: '14px 16px env(safe-area-inset-bottom, 14px)',
        display: 'flex', gap: 10,
        boxShadow: '0 -4px 16px rgba(0,0,0,0.10)',
      }}>
        {data.step > 1 && (
          <button onClick={goPrev}
            style={{ flex: '0 0 auto', padding: '16px 20px', borderRadius: 14, border: '2px solid #e5e7eb', background: 'white', color: '#374151', fontSize: 18, fontWeight: 700, cursor: 'pointer', minWidth: 56 }}>
            ←
          </button>
        )}

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.step < TOTAL_STEPS && (
            <button onClick={goNext} disabled={!peutSuivant}
              style={{
                width: '100%', padding: '16px', borderRadius: 14, border: 'none',
                background: peutSuivant ? COULEUR : '#e5e7eb',
                color: peutSuivant ? 'white' : '#9ca3af',
                fontSize: 18, fontWeight: 800,
                cursor: peutSuivant ? 'pointer' : 'not-allowed',
                boxShadow: peutSuivant ? '0 4px 14px rgba(16,185,129,0.35)' : 'none',
              }}>
              Suivant →
            </button>
          )}

          {/* Bouton "Passer" pour étapes optionnelles */}
          {estOptionnelle && data.step < TOTAL_STEPS && (
            <button onClick={passerEtape}
              style={{
                width: '100%', padding: '12px', borderRadius: 12, border: '1px dashed #94a3b8',
                background: 'white', color: '#64748b',
                fontSize: 15, fontWeight: 600, cursor: 'pointer',
              }}>
              Passer — remplir plus tard →
            </button>
          )}

          {data.step === TOTAL_STEPS && (
            <button onClick={handleCreer} disabled={saving}
              style={{
                width: '100%', padding: '16px', borderRadius: 14, border: 'none',
                background: saving ? '#e5e7eb' : COULEUR,
                color: saving ? '#9ca3af' : 'white',
                fontSize: 18, fontWeight: 800,
                cursor: saving ? 'not-allowed' : 'pointer',
                boxShadow: saving ? 'none' : '0 4px 14px rgba(16,185,129,0.35)',
              }}>
              {saving ? '⏳ Création en cours…' : '✓ CRÉER L\'OPPORTUNITÉ'}
            </button>
          )}
        </div>
      </div>

      {/* Modal résumé */}
      {showResume && (
        <div onClick={() => setShowResume(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 500, maxHeight: '80vh', overflowY: 'auto', background: 'white', borderRadius: 16, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Résumé</h3>
              <button onClick={() => setShowResume(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#9ca3af' }}>✕</button>
            </div>
            <ResumeCarte data={data} photos={photos.length} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Composants UI ─────────────────────────────────────────────────

function Step({ title, subtitle, children, optionnel }: {
  title: string; subtitle?: string; children: React.ReactNode; optionnel?: boolean;
}) {
  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', margin: '0 0 4px' }}>{title}</h2>
      {subtitle && (
        <p style={{ fontSize: 15, color: optionnel ? '#f59e0b' : '#64748b', margin: '0 0 20px', lineHeight: 1.4, fontWeight: optionnel ? 600 : 400 }}>
          {optionnel && '⚡ '}{subtitle}
        </p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
    </div>
  );
}

function FieldText({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', padding: '16px 16px', borderRadius: 12, border: '2px solid #e2e8f0', fontSize: 18, background: 'white', boxSizing: 'border-box', outline: 'none', color: '#111827', WebkitAppearance: 'none' }}
        onFocus={e => e.target.style.borderColor = COULEUR}
        onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
    </div>
  );
}

function FieldTextarea({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3}
        style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '2px solid #e2e8f0', fontSize: 16, background: 'white', boxSizing: 'border-box', outline: 'none', color: '#111827', fontFamily: 'inherit', resize: 'vertical' }}
        onFocus={e => e.target.style.borderColor = COULEUR}
        onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
    </div>
  );
}

function FieldDropdown({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: Array<{ value: string; label: string; special?: boolean }>;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '16px 40px 16px 16px', borderRadius: 12, border: '2px solid #e2e8f0', fontSize: 18, background: 'white', boxSizing: 'border-box', outline: 'none', color: '#111827', cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center' }}>
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
      <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map(o => {
          const actif = value === o.value;
          const color = o.color ?? '#3b82f6';
          return (
            <button key={o.value} onClick={() => onChange(actif ? '' : o.value)}
              style={{
                flex: '1 1 calc(50% - 4px)', minWidth: 0,
                padding: '14px 8px', borderRadius: 12,
                border: actif ? `2px solid ${color}` : '2px solid #e2e8f0',
                background: actif ? `${color}18` : 'white',
                color: actif ? color : '#374151',
                fontSize: 16, fontWeight: actif ? 800 : 500,
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card title="🚛 Camion">
        <Line label="Camion" value={titre} />
        <Line label="VIN"    value={data.vin || '—'} />
        <Line label="KM"     value={data.kilometrage ? `${parseInt(data.kilometrage).toLocaleString('fr-CA')} km` : '—'} />
        <Line label="État"   value={data.etatGeneral || '—'} />
        {data.defautsConnus && <Line label="Défauts" value={data.defautsConnus} multiline />}
      </Card>
      {(data.moteurMarque || data.moteurHp) && (
        <Card title="⚙️ Moteur">
          <Line label="Marque" value={data.moteurMarque || '—'} />
          <Line label="Modèle" value={data.moteurModele || '—'} />
          <Line label="HP"     value={data.moteurHp || '—'} />
          <Line label="EPA"    value={data.moteurEpa || '—'} />
        </Card>
      )}
      {(data.transType || data.transMarque) && (
        <Card title="🔧 Trans · Diff">
          <Line label="Type"    value={data.transType || '—'} />
          <Line label="Marque"  value={data.transMarque || '—'} />
          <Line label="Diff"    value={data.differentielRatio || '—'} />
        </Card>
      )}
      <Card title="👤 Vendeur">
        <Line label="Nom"  value={data.vendeurNom || '—'} />
        <Line label="Type" value={data.vendeurType} />
        <Line label="Tél"  value={data.vendeurTel || '—'} />
      </Card>
      <Card title="💰 Prix · Lieu">
        <Line label="Source" value={data.source || '—'} />
        <Line label="Prix"   value={data.prixDemande ? `${parseFloat(data.prixDemande).toLocaleString('fr-CA')} $` : '—'} />
        <Line label="Lieu"   value={data.lieuLocalisation || '—'} />
      </Card>
      <Card title="📸 Photos">
        <Line label="Nombre" value={photos > 0 ? `${photos} photo${photos > 1 ? 's' : ''}` : 'Aucune photo'} />
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</div>
      {children}
    </div>
  );
}

function Line({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 14, padding: '3px 0', alignItems: multiline ? 'flex-start' : 'center' }}>
      <span style={{ width: 70, flexShrink: 0, color: '#94a3b8', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', paddingTop: multiline ? 1 : 0 }}>{label}</span>
      <span style={{ color: '#111827', fontWeight: 600, whiteSpace: multiline ? 'pre-wrap' : 'normal', wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}
