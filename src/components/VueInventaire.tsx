import { useState, useRef, useEffect } from 'react';
import { EauIcon } from './EauIcon';
import { searchTable } from '../services/searchService';
import { supabase } from '../lib/supabase';
import { reservoirService } from '../services/reservoirService';
import { useInventaire } from '../contexts/InventaireContext';
import { useGarage } from '../hooks/useGarage';
import { useAuth } from '../contexts/AuthContext';
import type { VehiculeInventaire, EtapeFaite } from '../types/inventaireTypes';
import type { Item, StationProgress } from '../types/item.types';
import {
  PIPELINE_EAU_NEUF, PIPELINE_EAU_USAGE,
  PIPELINE_CLIENT_DEFAUT, PIPELINE_DETAIL_DEFAUT
} from '../data/mockData';
import { MARQUES_LISTE, MARQUES_CAMIONS, ANNEES_LISTE } from '../data/camionData';
import { useClients } from '../contexts/ClientContext';
import type { Client } from '../types/clientTypes';

type FiltreStatut = 'tous' | 'disponible' | 'en-production' | 'pret';
type FiltreType = 'tous' | 'eau' | 'client' | 'detail';

const CHECKLIST_STATIONS = [
  { id: 'soudure-generale',    label: 'Soudure générale',    color: '#ff6b35' },
  { id: 'mecanique-generale',  label: 'Mécanique générale',  color: '#4a9eff' },
  { id: 'mecanique-moteur',    label: 'Mécanique moteur',    color: '#4a9eff' },
  { id: 'soudure-specialisee', label: 'Soudure spécialisée', color: '#ff6b35' },
  { id: 'peinture',            label: 'Peinture',            color: '#94a3b8' },
];

const generateId    = () => `item-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
const generateVehId = () => `veh-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 6,
  border: '1px solid #d1d5db', fontSize: 13, outline: 'none',
  boxSizing: 'border-box',
};

interface FormAjout {
  type: 'eau' | 'client' | 'detail';
  variante: 'Neuf' | 'Usagé' | '';
  numero: string;
  marque: string;
  modele: string;
  annee: string;
  nomClient: string;
  telephone: string;
  vehicule: string;
  descriptionTravail: string;
  descriptionTravaux: string;
  clientAcheteur: string;
  notes: string;
  clientId?: string;
  email?: string;
}

const FORM_DEFAUT: FormAjout = {
  type: 'eau', variante: '', numero: '',
  marque: '', modele: '', annee: '',
  nomClient: '', telephone: '', vehicule: '',
  descriptionTravail: '', descriptionTravaux: '',
  clientAcheteur: '', notes: '',
  clientId: undefined, email: '',
};

function ModalAjoutInventaire({ onAjouter, onClose }: {
  onAjouter: (v: VehiculeInventaire) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormAjout>(FORM_DEFAUT);
  const [suggMarque, setSuggMarque] = useState(false);
  const [suggModele, setSuggModele] = useState(false);
  const [suggAnnee, setSuggAnnee] = useState(false);
  const setF = (p: Partial<FormAjout>) => setForm(f => ({ ...f, ...p }));
  const { rechercherClients, ajouterClient } = useClients();
  const [suggClients, setSuggClients] = useState<Client[]>([]);
  const [showSugg, setShowSugg] = useState(false);

  const handleNomClientChange = (val: string) => {
    setF({ nomClient: val, clientId: undefined });
    setSuggClients(rechercherClients(val));
    setShowSugg(true);
  };

  const handleSelectClient = (client: Client) => {
    setF({ nomClient: client.nom, telephone: client.telephone ?? '', email: client.email ?? '', clientId: client.id });
    setShowSugg(false);
  };

  const filtreMarques = MARQUES_LISTE.filter(m => !form.marque || m.toLowerCase().includes(form.marque.toLowerCase()));
  const filtreModeles = (form.marque && MARQUES_CAMIONS[form.marque] ? MARQUES_CAMIONS[form.marque] : Object.values(MARQUES_CAMIONS).flat())
    .filter(m => !form.modele || m.toLowerCase().includes(form.modele.toLowerCase()));
  const filtreAnnees = ANNEES_LISTE.map(String).filter(a => !form.annee || a.includes(form.annee));

  const typeColor = form.type === 'eau' ? '#f97316' : form.type === 'client' ? '#3b82f6' : '#22c55e';
  const peutSauvegarder = form.numero.trim().length > 0;

  const handleSauvegarder = async () => {
    if (!peutSauvegarder) return;
    let clientIdFinal = form.clientId;
    if (!clientIdFinal && form.type === 'client' && form.nomClient) {
      const nouveauClient: Client = {
        id: `client-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
        nom: form.nomClient, telephone: form.telephone || undefined,
        email: form.email || undefined, dateCreation: new Date().toISOString(),
      };
      await ajouterClient(nouveauClient);
      clientIdFinal = nouveauClient.id;
    }
    const nouveau: VehiculeInventaire = {
      id: generateVehId(), statut: 'disponible', dateImport: new Date().toISOString(),
      numero: form.numero.trim(), type: form.type,
      variante: form.variante || undefined, marque: form.marque || undefined,
      modele: form.modele || undefined, annee: form.annee ? Number(form.annee) : undefined,
      clientAcheteur: form.clientAcheteur || undefined, notes: form.notes || undefined,
      nomClient: form.nomClient || undefined, telephone: form.telephone || undefined,
      vehicule: form.vehicule || undefined, descriptionTravail: form.descriptionTravail || undefined,
      descriptionTravaux: form.descriptionTravaux || undefined,
    };
    onAjouter(nouveau);
    onClose();
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, width: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#111827' }}>📋 Ajouter à l'inventaire</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9ca3af' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Type *</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {([{ val: 'eau' as const, color: '#f97316' }, { val: 'client' as const, color: '#3b82f6' }, { val: 'detail' as const, color: '#22c55e' }]).map(({ val, color }) => (
                <button key={val} type="button" onClick={() => setF({ type: val, variante: '' })}
                  style={{ flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer', border: form.type === val ? `2px solid ${color}` : '1px solid #e5e7eb', background: form.type === val ? `${color}15` : 'white', color: form.type === val ? color : '#9ca3af', fontWeight: form.type === val ? 700 : 400, fontSize: 12, transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  {val === 'eau' ? <><EauIcon /> Camion à eau</> : val === 'client' ? '🔧 Client externe' : '🏷️ Camion détail'}
                </button>
              ))}
            </div>
          </div>
          {form.type === 'eau' && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Variante</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['Neuf', 'Usagé'] as const).map(v => (
                  <button key={v} type="button" onClick={() => setF({ variante: v })}
                    style={{ flex: 1, padding: '7px', borderRadius: 8, cursor: 'pointer', border: form.variante === v ? `2px solid #f97316` : '1px solid #e5e7eb', background: form.variante === v ? '#f9731615' : 'white', color: form.variante === v ? '#f97316' : '#9ca3af', fontWeight: form.variante === v ? 700 : 400, fontSize: 12 }}>
                    {v === 'Neuf' ? '✨ Neuf' : '🔄 Usagé'}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
              {form.type === 'client' ? 'Numéro de work order' : 'Numéro de stock'} *
            </label>
            <input type="text" value={form.numero} onChange={e => setF({ numero: e.target.value })} placeholder={form.type === 'client' ? 'WO-2026-001' : '35088'} style={inputStyle} />
          </div>
          {form.type !== 'client' && (
            <>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Marque</label>
                  <input type="text" value={form.marque} onChange={e => { setF({ marque: e.target.value, modele: '' }); setSuggMarque(true); }} onFocus={() => setSuggMarque(true)} onBlur={() => setTimeout(() => setSuggMarque(false), 150)} placeholder="Kenworth" style={inputStyle} />
                  {suggMarque && filtreMarques.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 99, background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 180, overflowY: 'auto', marginTop: 4 }}>
                      {filtreMarques.slice(0, 8).map(m => (<div key={m} onMouseDown={() => { setF({ marque: m, modele: '' }); setSuggMarque(false); }} style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }} onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; }} onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}>{m}</div>))}
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, position: 'relative' }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Modèle</label>
                  <input type="text" value={form.modele} onChange={e => { setF({ modele: e.target.value }); setSuggModele(true); }} onFocus={() => setSuggModele(true)} onBlur={() => setTimeout(() => setSuggModele(false), 150)} placeholder="T880" style={inputStyle} />
                  {suggModele && filtreModeles.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 99, background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 180, overflowY: 'auto', marginTop: 4 }}>
                      {filtreModeles.slice(0, 8).map(m => (<div key={m} onMouseDown={() => { setF({ modele: m }); setSuggModele(false); }} style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }} onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; }} onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}>{m}</div>))}
                    </div>
                  )}
                </div>
                <div style={{ width: 100, position: 'relative' }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Année</label>
                  <input type="text" value={form.annee} onChange={e => { setF({ annee: e.target.value }); setSuggAnnee(true); }} onFocus={() => setSuggAnnee(true)} onBlur={() => setTimeout(() => setSuggAnnee(false), 150)} placeholder="2024" style={inputStyle} />
                  {suggAnnee && filtreAnnees.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 99, background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 180, overflowY: 'auto', marginTop: 4 }}>
                      {filtreAnnees.slice(0, 8).map(a => (<div key={a} onMouseDown={() => { setF({ annee: a }); setSuggAnnee(false); }} style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }} onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; }} onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}>{a}</div>))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Client acheteur (optionnel)</label>
                <input type="text" value={form.clientAcheteur} onChange={e => setF({ clientAcheteur: e.target.value })} placeholder="Nom du client si déjà vendu..." style={inputStyle} />
              </div>
              {form.type === 'detail' && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Description des travaux</label>
                  <textarea value={form.descriptionTravaux} onChange={e => setF({ descriptionTravaux: e.target.value })} placeholder="Ex: Vérifier les coulisses d'huile..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
              )}
            </>
          )}
          {form.type === 'client' && (
            <>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Nom du client</label>
                  <div style={{ position: 'relative' }}>
                    <input type="text" value={form.nomClient} onChange={e => handleNomClientChange(e.target.value)} onFocus={() => { setSuggClients(rechercherClients(form.nomClient)); setShowSugg(true); }} onBlur={() => setTimeout(() => setShowSugg(false), 150)} placeholder="Transport Tremblay..." style={inputStyle} />
                    {form.clientId && (<div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>✓ Existant</div>)}
                  </div>
                  {showSugg && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 99, background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 200, overflowY: 'auto', marginTop: 4 }}>
                      {suggClients.length > 0 ? (<>{<div style={{ padding: '6px 12px', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9' }}>Clients existants</div>}{suggClients.map(c => (<div key={c.id} onMouseDown={() => handleSelectClient(c)} style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }} onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; }} onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}><div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{c.nom}</div>{c.telephone && <div style={{ fontSize: 11, color: '#6b7280' }}>📞 {c.telephone}</div>}</div>))}</>) : form.nomClient.length > 0 ? (<div style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: 16 }}>✨</span><div><div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Nouveau client</div><div style={{ fontSize: 11, color: '#6b7280' }}>"{form.nomClient}" sera créé automatiquement</div></div></div>) : null}
                    </div>
                  )}
                </div>
                <div style={{ width: 160 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Téléphone</label>
                  <input type="text" value={form.telephone} onChange={e => setF({ telephone: e.target.value })} placeholder="418-555-0123" style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Véhicule</label>
                <input type="text" value={form.vehicule} onChange={e => setF({ vehicule: e.target.value })} placeholder="Kenworth T680 2019" style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Description du travail</label>
                <textarea value={form.descriptionTravail} onChange={e => setF({ descriptionTravail: e.target.value })} placeholder="Changement freins arrière..." rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </>
          )}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Notes</label>
            <textarea value={form.notes} onChange={e => setF({ notes: e.target.value })} placeholder="Informations supplémentaires..." rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </div>
        <div style={{ padding: '14px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
          <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: 13, color: '#374151' }}>Annuler</button>
          <button onClick={handleSauvegarder} disabled={!peutSauvegarder}
            style={{ padding: '10px 28px', borderRadius: 8, border: 'none', background: peutSauvegarder ? typeColor : '#e5e7eb', color: peutSauvegarder ? 'white' : '#9ca3af', fontWeight: 700, fontSize: 14, cursor: peutSauvegarder ? 'pointer' : 'not-allowed' }}>
            📋 Ajouter à l'inventaire
          </button>
        </div>
      </div>
    </div>
  );
}

export function VueInventaire() {
  const { vehicules, importerVehicules, marquerEnProduction, marquerDisponible, supprimerVehicule, ajouterVehicule, mettreAJourType, mettreAJourEtapes, mettreAJourReservoir, marquerPret } = useInventaire();
  const { ajouterItem, supprimerItem } = useGarage();
  const { profile: session } = useAuth();
  const isGestion = session?.role === 'gestion';

  const INVENTAIRE_COLS = ['numero', 'marque', 'modele', 'nom_client', 'client_acheteur', 'notes'];
  const [filtreStatut, setFiltreStatut] = useState<FiltreStatut>('tous');
  const [filtreType, setFiltreType] = useState<FiltreType>('tous');
  const [recherche, setRecherche] = useState('');
  const [searchResults, setSearchResults] = useState<VehiculeInventaire[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [erreurImport, setErreurImport] = useState<string | null>(null);
  const [showModalAjout, setShowModalAjout] = useState(false);
  const [typeOverrides, setTypeOverrides] = useState<Record<string, 'eau' | 'detail'>>({});
  const [submittingJobId, setSubmittingJobId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!recherche.trim()) { setSearchResults(null); return; }
      const results = await searchTable('prod_inventaire', recherche, INVENTAIRE_COLS);
      setSearchResults(results as VehiculeInventaire[]);
    }, 300);
    return () => clearTimeout(timer);
  }, [recherche]);

  const baseList = (searchResults !== null ? searchResults : vehicules)
    .map(v => typeOverrides[v.id] ? { ...v, type: typeOverrides[v.id]! } : v);

  const filtres = [...baseList]
    .filter(v => {
      if (filtreStatut === 'pret') return v.estPret === true;
      if (filtreStatut !== 'tous' && v.statut !== filtreStatut) return false;
      if (filtreType !== 'tous' && v.type !== filtreType) return false;
      return true;
    })
    .sort((a, b) => {
      const numA = parseInt(a.numero?.replace(/\D/g, '') ?? '0') || 0;
      const numB = parseInt(b.numero?.replace(/\D/g, '') ?? '0') || 0;
      return numA - numB;
    });

  const selected = vehicules.find(v => v.id === selectedId) ?? null;
  const pretsCount = vehicules.filter(v => v.estPret).length;

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErreurImport(null);
    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, any>[];
      const nouveaux: VehiculeInventaire[] = rows.filter(row => row.numero && row.type).map(row => ({
        id: generateVehId(), statut: 'disponible' as const, dateImport: new Date().toISOString(),
        numero: String(row.numero), type: row.type as 'eau' | 'client' | 'detail',
        variante: row.variante || undefined, marque: row.marque || undefined,
        modele: row.modele || undefined, annee: row.annee ? Number(row.annee) : undefined,
        clientAcheteur: row.clientAcheteur || undefined, notes: row.notes || undefined,
        nomClient: row.nomClient || undefined, telephone: row.telephone || undefined,
        vehicule: row.vehicule || undefined, descriptionTravail: row.descriptionTravail || undefined,
        descriptionTravaux: row.descriptionTravaux || undefined,
      }));
      if (nouveaux.length === 0) { setErreurImport('Aucun véhicule valide trouvé.'); return; }
      importerVehicules(nouveaux);
    } catch (err) { setErreurImport('Erreur lors de la lecture du fichier Excel.'); }
    e.target.value = '';
  };

  const creerJobDepuisInventaire = async (v: VehiculeInventaire) => {
    if (submittingJobId === v.id) return;
    setSubmittingJobId(v.id);
    setErreurImport(null);
    try {
      const now = new Date().toISOString();
      const jobId = generateId();
      let stationsActives: string[];
      if (v.type === 'eau') stationsActives = v.variante === 'Neuf' ? PIPELINE_EAU_NEUF : PIPELINE_EAU_USAGE;
      else if (v.type === 'client') stationsActives = PIPELINE_CLIENT_DEFAUT;
      else stationsActives = PIPELINE_DETAIL_DEFAUT;

      const etapesFaites = v.etapesFaites ?? [];
      const doneIds = new Set(etapesFaites.filter(e => e.fait).map(e => e.stationId));
      const progression: StationProgress[] = stationsActives.map(sid => ({
        stationId: sid, status: doneIds.has(sid) ? 'termine' as const : 'non-commence' as const, subTasks: [],
      }));

      let label = '';
      if (v.type === 'client') label = v.nomClient ? `${v.nomClient} — ${v.descriptionTravail ?? ''}` : v.vehicule ?? v.numero;
      else label = `${v.marque ?? ''} ${v.modele ?? ''} ${v.annee ?? ''}`.trim();

      const nouvelItem: Item = {
        id: jobId, type: v.type, numero: v.numero, label,
        etat: 'en-attente', dateCreation: now,
        stationsActives, progression, stationActuelle: stationsActives[0],
        inventaireId: v.id, photoUrl: v.photoUrl ?? undefined,
        ...(v.variante && { variante: v.variante }),
        ...(v.marque && { marque: v.marque }),
        ...(v.modele && { modele: v.modele }),
        ...(v.annee && { annee: v.annee }),
        ...(v.clientAcheteur && { clientAcheteur: v.clientAcheteur }),
        ...(v.notes && { notes: v.notes }),
        ...(v.nomClient && { nomClient: v.nomClient }),
        ...(v.telephone && { telephone: v.telephone }),
        ...(v.vehicule && { vehicule: v.vehicule }),
        ...(v.descriptionTravail && { descriptionTravail: v.descriptionTravail }),
        ...(v.descriptionTravaux && { descriptionTravaux: v.descriptionTravaux }),
      };
      await ajouterItem(nouvelItem);
      await marquerEnProduction(v.id, jobId);
      setSelectedId(null);
      setFiltreStatut('tous');
    } catch (err: any) {
      setErreurImport(err?.message ?? 'Erreur lors de la création du job');
    } finally { setSubmittingJobId(null); }
  };

  const retournerEnInventaire = async (v: VehiculeInventaire) => {
    await marquerDisponible(v.id);
    if (v.jobId) await supprimerItem(v.jobId);
    setSelectedId(null);
  };

  const disponibles = vehicules.filter(v => v.statut === 'disponible').length;
  const enProd = vehicules.filter(v => v.statut === 'en-production').length;

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f8fafc', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', marginRight: selected ? 400 : 0, transition: 'margin-right 0.3s ease' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '2px solid #e5e7eb', background: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28 }}>📋</span>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#374151', margin: 0 }}>Inventaire</h1>
            <span style={{ background: '#374151', color: 'white', fontSize: 13, fontWeight: 700, padding: '2px 10px', borderRadius: 12 }}>{vehicules.length} véhicule{vehicules.length !== 1 ? 's' : ''}</span>
            <span style={{ background: '#22c55e', color: 'white', fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 12 }}>{disponibles} disponible{disponibles !== 1 ? 's' : ''}</span>
            {enProd > 0 && <span style={{ background: '#f97316', color: 'white', fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 12 }}>{enProd} en production</span>}
            {pretsCount > 0 && <span style={{ background: '#22c55e', color: 'white', fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 12 }}>✅ {pretsCount} prêt{pretsCount !== 1 ? 's' : ''}</span>}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input type="text" placeholder="Rechercher..." value={recherche} onChange={e => setRecherche(e.target.value)} style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #e5e7eb', fontSize: 13, width: 200, outline: 'none' }} />
            <button onClick={() => setShowModalAjout(true)} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#22c55e', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Ajouter</button>
            {isGestion && (<><button onClick={() => fileRef.current?.click()} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#1e293b', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>📥 Importer Excel</button><input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleImportExcel} /></>)}
          </div>
        </div>

        {erreurImport && (
          <div style={{ margin: '12px 24px 0', padding: '10px 16px', borderRadius: 8, background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', fontSize: 13, fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            ⚠️ {erreurImport}
            <button onClick={() => setErreurImport(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b', fontSize: 16 }}>✕</button>
          </div>
        )}

        {/* Filtres */}
        <div style={{ display: 'flex', gap: 8, padding: '12px 24px', borderBottom: '1px solid #e5e7eb', background: 'white', flexWrap: 'wrap' }}>
          {([
            { id: 'tous' as FiltreStatut, label: 'Tous' },
            { id: 'disponible' as FiltreStatut, label: '✅ Disponible' },
            { id: 'en-production' as FiltreStatut, label: '🔧 En production' },
            { id: 'pret' as FiltreStatut, label: `✅ Prêts${pretsCount > 0 ? ` (${pretsCount})` : ''}` },
          ]).map(s => (
            <button key={s.id} onClick={() => setFiltreStatut(s.id)}
              style={{ padding: '5px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 12, border: filtreStatut === s.id ? 'none' : '1px solid #e5e7eb', background: filtreStatut === s.id ? (s.id === 'pret' ? '#22c55e' : '#374151') : 'white', color: filtreStatut === s.id ? 'white' : '#6b7280', fontWeight: filtreStatut === s.id ? 700 : 400 }}>
              {s.label}
            </button>
          ))}
          <div style={{ width: 1, background: '#e5e7eb', margin: '0 4px' }} />
          {(['tous', 'eau', 'client', 'detail'] as FiltreType[]).map(id => (
            <button key={id} onClick={() => setFiltreType(id)}
              style={{ padding: '5px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 12, border: filtreType === id ? 'none' : '1px solid #e5e7eb', background: filtreType === id ? '#f97316' : 'white', color: filtreType === id ? 'white' : '#6b7280', fontWeight: filtreType === id ? 700 : 400, display: 'flex', alignItems: 'center', gap: 4 }}>
              {id === 'eau' ? <><EauIcon /> Eau</> : id === 'tous' ? 'Tous types' : id === 'client' ? '🔧 Client' : '🏷️ Détail'}
            </button>
          ))}
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {vehicules.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: '#9ca3af' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Aucun véhicule dans l'inventaire</div>
              <div style={{ fontSize: 14, marginBottom: 20 }}>Cliquez sur <strong style={{ color: '#22c55e' }}>+ Ajouter</strong> ou importez un fichier Excel</div>
            </div>
          ) : filtres.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}><div style={{ fontSize: 14 }}>Aucun résultat pour ces filtres</div></div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'white', zIndex: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  {['Numéro', 'Type', 'Marque', 'Modèle', 'Année', 'Client / Description', 'Statut', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtres.map(v => {
                  const typeColor = v.type === 'eau' ? '#f97316' : v.type === 'client' ? '#3b82f6' : '#22c55e';
                  const isSelected = selectedId === v.id;
                  const isEnProd = v.statut === 'en-production';
                  return (
                    <tr key={v.id} onClick={() => setSelectedId(isSelected ? null : v.id)}
                      style={{ borderBottom: '1px solid #f1f5f9', background: isSelected ? '#eff6ff' : isEnProd ? '#fafafa' : 'white', borderLeft: isSelected ? '3px solid #3b82f6' : '3px solid transparent', cursor: 'pointer', transition: 'background 0.1s', opacity: isEnProd ? 0.9 : 1 }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f8fafc'; }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = isEnProd ? '#fafafa' : 'white'; }}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: typeColor }}>#{v.numero}</span>
                          {v.estPret && <span style={{ fontSize: 10, background: '#dcfce7', color: '#166534', padding: '2px 7px', borderRadius: 4, fontWeight: 700, width: 'fit-content' }}>✅ Prêt</span>}
                        </div>
                      </td>
                      <td style={{ padding: '8px 16px' }} onClick={e => e.stopPropagation()}>
                        {v.type === 'client' ? (
                          <span style={{ fontSize: 12, background: '#3b82f618', color: '#3b82f6', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>🔧 Client</span>
                        ) : (
                          <select value={v.type} onChange={async (e) => { const val = e.target.value as 'eau' | 'detail'; setTypeOverrides(prev => ({ ...prev, [v.id]: val })); await mettreAJourType(v.id, val); setTypeOverrides(prev => { const next = { ...prev }; delete next[v.id]; return next; }); }}
                            style={{ fontSize: 12, fontWeight: 600, borderRadius: 10, padding: '2px 8px', border: `1px solid ${v.type === 'eau' ? '#f97316' : '#22c55e'}40`, background: `${v.type === 'eau' ? '#f97316' : '#22c55e'}18`, color: v.type === 'eau' ? '#f97316' : '#22c55e', cursor: 'pointer', outline: 'none' }}>
                            <option value="eau">Eau</option>
                            <option value="detail">🏷️ Détail</option>
                          </select>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600 }}>{v.marque ?? '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>{v.modele ?? '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>{v.annee ?? '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#6b7280', maxWidth: 200 }}>{v.nomClient ?? v.descriptionTravail ?? v.clientAcheteur ?? '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {v.statut === 'disponible' ? (
                            <span style={{ fontSize: 11, background: '#dcfce7', color: '#166534', padding: '3px 8px', borderRadius: 4, fontWeight: 700 }}>✅ Disponible</span>
                          ) : (
                            <span style={{ fontSize: 11, background: '#fff7ed', color: '#c2410c', padding: '3px 8px', borderRadius: 4, fontWeight: 700 }}>🔧 En production</span>
                          )}
                          {v.type === 'eau' && (v.aUnReservoir
                            ? <span style={{ fontSize: 10, background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 4, fontWeight: 700, width: 'fit-content' }}>✅ Réservoir</span>
                            : <span style={{ fontSize: 10, background: '#fff7ed', color: '#c2410c', padding: '2px 8px', borderRadius: 4, fontWeight: 700, width: 'fit-content' }}>⚠️ Sans réservoir</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {v.statut === 'disponible' && (() => {
                          const isSubmitting = submittingJobId === v.id;
                          return (<button onClick={(e) => { e.stopPropagation(); creerJobDepuisInventaire(v); }} disabled={isSubmitting} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: isSubmitting ? '#fdba74' : '#f97316', color: 'white', fontSize: 11, fontWeight: 700, cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}>{isSubmitting ? 'Création...' : '+ Créer job'}</button>);
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selected && (
        <PanneauDetailInventaire
          vehicule={selected}
          onClose={() => setSelectedId(null)}
          onCreerJob={() => creerJobDepuisInventaire(selected)}
          isSubmitting={submittingJobId === selected.id}
          onRetourInventaire={() => retournerEnInventaire(selected)}
          onSupprimer={() => { supprimerVehicule(selected.id); setSelectedId(null); }}
          isGestion={isGestion}
          onEtapesChange={mettreAJourEtapes}
          onReservoirChange={mettreAJourReservoir}
          onMarquerPret={marquerPret}
        />
      )}

      {showModalAjout && (
        <ModalAjoutInventaire
          onAjouter={(v) => { ajouterVehicule(v); setShowModalAjout(false); }}
          onClose={() => setShowModalAjout(false)}
        />
      )}
    </div>
  );
}

function PanneauDetailInventaire({ vehicule: v, onClose, onCreerJob, isSubmitting, onRetourInventaire, onSupprimer, isGestion, onEtapesChange, onReservoirChange, onMarquerPret }: {
  vehicule: VehiculeInventaire;
  onClose: () => void;
  onCreerJob: () => void;
  isSubmitting: boolean;
  onRetourInventaire: () => void;
  onSupprimer: () => void;
  isGestion: boolean;
  onEtapesChange: (id: string, etapes: EtapeFaite[]) => Promise<void>;
  onReservoirChange: (id: string, aUnReservoir: boolean, reservoirId: string | null) => Promise<void>;
  onMarquerPret: (id: string, estPret: boolean) => Promise<void>;
}) {
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);
  const [confirmerRetour, setConfirmerRetour] = useState(false);
  const [savingEtape, setSavingEtape] = useState<string | null>(null);
  const [reservoirsDisponibles, setReservoirsDisponibles] = useState<{id: string; numero: string; type: string}[]>([]);
  const [reservoirInstalle, setReservoirInstalle] = useState<{numero: string; type: string} | null>(null);
  const [reservoirSelectionne, setReservoirSelectionne] = useState<string>('');
  const [savingReservoir, setSavingReservoir] = useState(false);
  const [savingPret, setSavingPret] = useState(false);
  const typeColor = v.type === 'eau' ? '#f97316' : v.type === 'client' ? '#3b82f6' : '#22c55e';
  const typeLabel = v.type === 'eau' ? 'Camion à eau' : v.type === 'client' ? 'Client externe' : 'Camion détail';

  useEffect(() => {
    if (v.type !== 'eau') return;
    if (v.aUnReservoir && v.reservoirId) {
      supabase.from('prod_reservoirs').select('numero,type').eq('id', v.reservoirId).maybeSingle()
        .then(({ data }) => setReservoirInstalle(data ? { numero: data.numero, type: data.type } : null));
    } else if (!v.aUnReservoir) {
      supabase.from('prod_reservoirs').select('id,numero,type').eq('etat', 'disponible')
        .then(({ data }) => setReservoirsDisponibles((data ?? []).map((r: any) => ({ id: r.id, numero: r.numero, type: r.type }))));
    }
  }, [v.id, v.type, v.aUnReservoir, v.reservoirId]);

  const handleAssignerReservoir = async () => {
    if (!reservoirSelectionne) return;
    setSavingReservoir(true);
    try {
      await reservoirService.installerSurInventaire(reservoirSelectionne, v.id);
      await onReservoirChange(v.id, true, reservoirSelectionne);
    } finally { setSavingReservoir(false); }
  };

  const handleMarquerAvecReservoir = async () => {
    setSavingReservoir(true);
    try {
      await onReservoirChange(v.id, true, null);
      if (v.jobId) {
        await supabase.from('prod_items').update({ a_un_reservoir: true, reservoir_id: null }).eq('inventaire_id', v.id);
      }
    } finally { setSavingReservoir(false); }
  };

  const handleRetirerReservoir = async () => {
    setSavingReservoir(true);
    try {
      if (v.reservoirId) {
        await reservoirService.desinstallerDeInventaire(v.reservoirId, v.id);
      }
      await onReservoirChange(v.id, false, null);
    } finally { setSavingReservoir(false); }
  };

  const etapesFaites = v.etapesFaites ?? [];
  const getEtape = (stationId: string): EtapeFaite | undefined => etapesFaites.find(e => e.stationId === stationId);

  const handleToggle = async (stationId: string) => {
    if (savingEtape) return;
    setSavingEtape(stationId);
    const existing = getEtape(stationId);
    const today = new Date().toISOString().slice(0, 10);
    let updated: EtapeFaite[];
    if (existing) {
      updated = etapesFaites.map(e => e.stationId === stationId ? { ...e, fait: !e.fait, date: today } : e);
    } else {
      updated = [...etapesFaites, { stationId, fait: true, date: today }];
    }
    await onEtapesChange(v.id, updated);
    setSavingEtape(null);
  };

  const nbFait = CHECKLIST_STATIONS.filter(s => getEtape(s.id)?.fait).length;

  return (
    <div style={{ position: 'fixed', right: 0, top: 0, width: 400, height: '100vh', background: 'white', borderLeft: '1px solid #e5e7eb', boxShadow: '-4px 0 24px rgba(0,0,0,0.1)', overflowY: 'auto', zIndex: 150 }}>
      <div style={{ padding: 24 }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>✕</button>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 26, fontWeight: 700, color: typeColor, marginBottom: 4 }}>#{v.numero}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={{ fontSize: 12, background: `${typeColor}18`, color: typeColor, padding: '3px 10px', borderRadius: 10, fontWeight: 600 }}>{typeLabel}</span>
            {v.variante && <span style={{ fontSize: 12, background: '#f1f5f9', color: '#374151', padding: '3px 10px', borderRadius: 10, fontWeight: 600 }}>{v.variante}</span>}
            {v.estPret && <span style={{ fontSize: 12, background: '#dcfce7', color: '#166534', padding: '3px 10px', borderRadius: 10, fontWeight: 700 }}>✅ Prêt</span>}
          </div>
        </div>

        {/* Statut */}
        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 20, background: v.statut === 'disponible' ? '#f0fdf4' : '#fff7ed', border: `1px solid ${v.statut === 'disponible' ? '#86efac' : '#fed7aa'}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: v.statut === 'disponible' ? '#166534' : '#c2410c' }}>
            {v.statut === 'disponible' ? '✅ Disponible' : '🔧 En production'}
          </div>
          {v.dateEnProduction && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Mis en production le {new Date(v.dateEnProduction).toLocaleDateString('fr-CA')}</div>}
        </div>

        {/* Réservoir */}
        {v.type === 'eau' && (
          <div style={{ marginBottom: 20, padding: '14px 16px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fafafa' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Réservoir</div>
            {v.aUnReservoir ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, background: '#dcfce7', color: '#166534', padding: '4px 12px', borderRadius: 8, fontWeight: 700 }}>✅ Réservoir installé</span>
                  {reservoirInstalle && <span style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace' }}>#{reservoirInstalle.numero} — {reservoirInstalle.type}</span>}
                </div>
                <button onClick={handleRetirerReservoir} disabled={savingReservoir} style={{ padding: '7px 14px', borderRadius: 7, cursor: savingReservoir ? 'wait' : 'pointer', border: '1px solid #fca5a5', background: 'white', color: '#ef4444', fontSize: 12, fontWeight: 600, opacity: savingReservoir ? 0.5 : 1 }}>
                  {savingReservoir ? 'En cours...' : 'Retirer le réservoir'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>Assigner un réservoir de l'inventaire</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select value={reservoirSelectionne} onChange={e => setReservoirSelectionne(e.target.value)} style={{ flex: 1, padding: '7px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 12, outline: 'none', color: reservoirSelectionne ? '#111827' : '#9ca3af' }}>
                      <option value="">— Choisir un réservoir —</option>
                      {reservoirsDisponibles.map(r => (<option key={r.id} value={r.id}>#{r.numero} ({r.type})</option>))}
                    </select>
                    <button onClick={handleAssignerReservoir} disabled={!reservoirSelectionne || savingReservoir} style={{ padding: '7px 14px', borderRadius: 7, border: 'none', cursor: !reservoirSelectionne || savingReservoir ? 'not-allowed' : 'pointer', background: !reservoirSelectionne || savingReservoir ? '#e5e7eb' : '#f97316', color: !reservoirSelectionne || savingReservoir ? '#9ca3af' : 'white', fontWeight: 700, fontSize: 12 }}>
                      {savingReservoir ? '...' : 'Assigner'}
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
                  <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>ou</span>
                  <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
                </div>
                <button onClick={handleMarquerAvecReservoir} disabled={savingReservoir} style={{ padding: '8px', borderRadius: 7, cursor: savingReservoir ? 'wait' : 'pointer', border: '1px solid #d1d5db', background: 'white', color: '#374151', fontSize: 12, fontWeight: 600, opacity: savingReservoir ? 0.5 : 1 }}>
                  {savingReservoir ? 'En cours...' : '✅ Marquer comme ayant un réservoir'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Informations */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Informations</div>
          <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 2 }}>
            {v.marque && <div><span style={{ fontWeight: 600, color: '#374151' }}>Marque :</span> {v.marque}</div>}
            {v.modele && <div><span style={{ fontWeight: 600, color: '#374151' }}>Modèle :</span> {v.modele}</div>}
            {v.annee && <div><span style={{ fontWeight: 600, color: '#374151' }}>Année :</span> {v.annee}</div>}
            {v.clientAcheteur && <div><span style={{ fontWeight: 600, color: '#374151' }}>Client acheteur :</span> {v.clientAcheteur}</div>}
            {v.nomClient && <div><span style={{ fontWeight: 600, color: '#374151' }}>Client :</span> {v.nomClient}</div>}
            {v.telephone && <div><span style={{ fontWeight: 600, color: '#374151' }}>Téléphone :</span> {v.telephone}</div>}
            {v.vehicule && <div><span style={{ fontWeight: 600, color: '#374151' }}>Véhicule :</span> {v.vehicule}</div>}
            {v.descriptionTravail && <div><span style={{ fontWeight: 600, color: '#374151' }}>Travail :</span> {v.descriptionTravail}</div>}
            {v.descriptionTravaux && <div><span style={{ fontWeight: 600, color: '#374151' }}>Travaux :</span> {v.descriptionTravaux}</div>}
            {v.notes && <div><span style={{ fontWeight: 600, color: '#374151' }}>Notes :</span> {v.notes}</div>}
            <div><span style={{ fontWeight: 600, color: '#374151' }}>Importé le :</span> {new Date(v.dateImport).toLocaleDateString('fr-CA')}</div>
          </div>
        </div>

        {/* Checklist */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Étapes pré-production</div>
            <div style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 10, background: nbFait === CHECKLIST_STATIONS.length ? '#dcfce7' : nbFait > 0 ? '#fff7ed' : '#f1f5f9', color: nbFait === CHECKLIST_STATIONS.length ? '#166534' : nbFait > 0 ? '#c2410c' : '#6b7280' }}>
              {nbFait}/{CHECKLIST_STATIONS.length}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {CHECKLIST_STATIONS.map(station => {
              const etape = getEtape(station.id);
              const fait = etape?.fait ?? false;
              const isSaving = savingEtape === station.id;
              return (
                <button key={station.id} onClick={() => handleToggle(station.id)} disabled={isSaving}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, cursor: isSaving ? 'wait' : 'pointer', border: fait ? `1.5px solid ${station.color}40` : '1.5px solid #e5e7eb', background: fait ? `${station.color}10` : '#fafafa', transition: 'all 0.15s', textAlign: 'left', opacity: isSaving ? 0.6 : 1 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0, border: fait ? `2px solid ${station.color}` : '2px solid #d1d5db', background: fait ? station.color : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {fait && (<svg width="11" height="9" viewBox="0 0 11 9" fill="none"><path d="M1 4L4 7.5L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: fait ? 600 : 400, color: fait ? '#111827' : '#6b7280' }}>{station.label}</div>
                    {fait && etape?.date && <div style={{ fontSize: 10, color: station.color, fontWeight: 500 }}>Fait le {etape.date}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Créer job */}
          {v.statut === 'disponible' && (
            <button onClick={onCreerJob} disabled={isSubmitting}
              style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: isSubmitting ? '#fdba74' : '#f97316', color: 'white', fontWeight: 700, fontSize: 14, cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}>
              {isSubmitting ? 'Création...' : '🚛 Créer un job depuis ce véhicule'}
            </button>
          )}

          {/* Marquer comme prêt / Annuler prêt */}
          {v.statut === 'en-production' && (
            !v.estPret ? (
              <button onClick={async () => { setSavingPret(true); try { const today = new Date().toISOString().slice(0, 10); const toutesEtapes = CHECKLIST_STATIONS.map(s => ({ stationId: s.id, fait: true, date: today })); await onEtapesChange(v.id, toutesEtapes); await onMarquerPret(v.id, true); } finally { setSavingPret(false); } }}
                disabled={savingPret}
                style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: savingPret ? '#86efac' : '#22c55e', color: 'white', fontWeight: 700, fontSize: 14, cursor: savingPret ? 'wait' : 'pointer', opacity: savingPret ? 0.7 : 1 }}>
                {savingPret ? 'En cours...' : '✅ Marquer comme prêt'}
              </button>
            ) : (
              <button onClick={async () => { setSavingPret(true); try { await onMarquerPret(v.id, false); } finally { setSavingPret(false); } }}
                disabled={savingPret}
                style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #d1d5db', background: 'white', color: '#6b7280', fontWeight: 700, fontSize: 14, cursor: savingPret ? 'wait' : 'pointer' }}>
                {savingPret ? 'En cours...' : '↩ Annuler — pas encore prêt'}
              </button>
            )
          )}

          {/* Retour inventaire */}
          {v.statut === 'en-production' && (
            !confirmerRetour ? (
              <button onClick={() => setConfirmerRetour(true)}
                style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #3b82f6', background: 'transparent', color: '#3b82f6', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                ↩ Retourner en inventaire
              </button>
            ) : (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 6 }}>Retourner ce véhicule en inventaire?</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14 }}>Le job de production associé sera supprimé et le véhicule redeviendra disponible.</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setConfirmerRetour(false)} style={{ flex: 1, padding: '8px', borderRadius: 6, border: '1px solid #d1d5db', background: 'white', color: '#374151', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>Annuler</button>
                  <button onClick={() => { onRetourInventaire(); setConfirmerRetour(false); }} style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: '#3b82f6', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>↩ Confirmer</button>
                </div>
              </div>
            )
          )}

          {/* Supprimer */}
          {isGestion && (
            !confirmerSuppression ? (
              <button onClick={() => setConfirmerSuppression(true)} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #fca5a5', background: 'transparent', color: '#ef4444', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                🗑 Supprimer de l'inventaire
              </button>
            ) : (
              <div style={{ background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#991b1b', marginBottom: 6 }}>⚠️ Confirmer la suppression?</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14 }}>Cette action est irréversible.</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setConfirmerSuppression(false)} style={{ flex: 1, padding: '8px', borderRadius: 6, border: '1px solid #d1d5db', background: 'white', color: '#374151', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>Annuler</button>
                  <button onClick={onSupprimer} style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: '#ef4444', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>🗑 Supprimer</button>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
