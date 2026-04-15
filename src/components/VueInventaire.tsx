import { useState, useRef, useEffect, useMemo } from 'react';
import { EauIcon } from './EauIcon';
import { searchTable } from '../services/searchService';
import { fromDB as inventaireFromDB } from '../services/inventaireService';
import { useInventaire } from '../contexts/InventaireContext';
import { useGarage } from '../hooks/useGarage';
import { useAuth } from '../contexts/AuthContext';
import type { VehiculeInventaire } from '../types/inventaireTypes';
import type { Item } from '../types/item.types';
import { MARQUES_LISTE, MARQUES_CAMIONS, ANNEES_LISTE } from '../data/camionData';
import { useClients } from '../contexts/ClientContext';
import type { Client } from '../types/clientTypes';
import { ROAD_MAP_STATIONS } from '../data/etapes';
import { getSectionVehicule, PanneauDetailVehicule } from './PanneauDetailVehicule';
import { CarteVehicule, SectionHeaderCard } from './VueAsana';

type FiltreStatut = 'tous' | 'disponible' | 'en-production' | 'pret' | 'vendu';
type FiltreType = 'tous' | 'eau' | 'client' | 'detail';
type FiltreDept = 'tous' | string; // station ID
type FiltrePretCommercial = 'tous' | 'a-vendre' | 'a-livrer' | 'location' | 'reserve';

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
  const { vehicules, importerVehicules, marquerDisponible, supprimerVehicule, ajouterVehicule } = useInventaire();
  const { items, supprimerItem } = useGarage();

  // Map inventaireId → Item (pour CarteVehicule)
  const itemByInvId = useMemo(() => {
    const map: Record<string, Item> = {};
    items.forEach(i => {
      if (i.inventaireId) map[i.inventaireId] = i;
      map[i.id] = i;
    });
    return map;
  }, [items]);
  const { profile: session } = useAuth();
  const isGestion = session?.role === 'gestion';

  const INVENTAIRE_COLS = ['numero', 'marque', 'modele', 'nom_client', 'client_acheteur', 'notes'];
  const [filtreStatut, setFiltreStatut] = useState<FiltreStatut>('tous');
  const [filtreType, setFiltreType] = useState<FiltreType>('tous');
  const [filtreDept, setFiltreDept] = useState<FiltreDept>('tous');
  const [filtrePretCommercial, setFiltrePretCommercial] = useState<FiltrePretCommercial>('tous');
  const [recherche, setRecherche] = useState('');
  const [searchResults, setSearchResults] = useState<VehiculeInventaire[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [erreurImport, setErreurImport] = useState<string | null>(null);
  const [showModalAjout, setShowModalAjout] = useState(false);
  const [typeOverrides] = useState<Record<string, 'eau' | 'detail'>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!recherche.trim()) { setSearchResults(null); return; }
      const results = await searchTable('prod_inventaire', recherche, INVENTAIRE_COLS);
      setSearchResults(results.map(inventaireFromDB));
    }, 300);
    return () => clearTimeout(timer);
  }, [recherche]);

  const baseList = (searchResults !== null ? searchResults : vehicules)
    .map(v => typeOverrides[v.id] ? { ...v, type: typeOverrides[v.id]! } : v);

  const deptCounts = ROAD_MAP_STATIONS.reduce((acc, s) => {
    acc[s.id] = vehicules.filter(v =>
      (v.roadMap ?? []).some(e => e.stationId === s.id && (e.statut === 'en-attente' || e.statut === 'en-cours'))
    ).length;
    return acc;
  }, {} as Record<string, number>);

  const filtres = [...baseList]
    .filter(v => {
      if (filtreStatut === 'pret' && !v.estPret) return false;
      if (filtreStatut === 'vendu' && v.etatCommercial !== 'vendu' && v.etatCommercial !== 'reserve' && v.etatCommercial !== 'location') return false;
      if (filtreStatut !== 'tous' && filtreStatut !== 'pret' && filtreStatut !== 'vendu' && v.statut !== filtreStatut) return false;
      // Sub-filtre prêt par statut commercial
      if (filtreStatut === 'pret' && filtrePretCommercial !== 'tous') {
        if (filtrePretCommercial === 'a-vendre'  && v.etatCommercial !== 'non-vendu')  return false;
        if (filtrePretCommercial === 'a-livrer'  && v.etatCommercial !== 'vendu')      return false;
        if (filtrePretCommercial === 'location'  && v.etatCommercial !== 'location')   return false;
        if (filtrePretCommercial === 'reserve'   && v.etatCommercial !== 'reserve')    return false;
      }
      if (filtreType !== 'tous' && v.type !== filtreType) return false;
      if (filtreDept !== 'tous' && !(v.roadMap ?? []).some(e => e.stationId === filtreDept && (e.statut === 'en-attente' || e.statut === 'en-cours'))) return false;
      return true;
    })
    .sort((a, b) => {
      const numA = parseInt(a.numero?.replace(/\D/g, '') ?? '0') || 0;
      const numB = parseInt(b.numero?.replace(/\D/g, '') ?? '0') || 0;
      return numA - numB;
    });

  const selected = vehicules.find(v => v.id === selectedId) ?? null;
  const pretsCount = vehicules.filter(v => v.estPret).length;
  const vendusCount = vehicules.filter(v => v.etatCommercial === 'vendu' || v.etatCommercial === 'reserve' || v.etatCommercial === 'location').length;
  const pretsParCommercial = {
    aVendre:  vehicules.filter(v => v.estPret && v.etatCommercial === 'non-vendu').length,
    aLivrer:  vehicules.filter(v => v.estPret && v.etatCommercial === 'vendu').length,
    location: vehicules.filter(v => v.estPret && v.etatCommercial === 'location').length,
    reserve:  vehicules.filter(v => v.estPret && v.etatCommercial === 'reserve').length,
  };

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

  const retournerEnInventaire = async (v: VehiculeInventaire) => {
    await marquerDisponible(v.id);
    if (v.jobId) await supprimerItem(v.jobId);
    setSelectedId(null);
  };

  const disponibles = vehicules.filter(v => v.statut === 'disponible').length;
  const enProd = vehicules.filter(v => v.statut === 'en-production').length;

  return (
    <div style={{ display: 'flex', height: '100%', background: '#f8fafc', overflow: 'hidden' }}>
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
            { id: 'disponible'    as FiltreStatut, label: '✅ Disponible' },
            { id: 'en-production' as FiltreStatut, label: '🔧 En production' },
            { id: 'pret'          as FiltreStatut, label: `✅ Prêts${pretsCount > 0 ? ` (${pretsCount})` : ''}` },
            { id: 'vendu'         as FiltreStatut, label: `🏷️ Vendus/Loués${vendusCount > 0 ? ` (${vendusCount})` : ''}` },
          ]).map(s => (
            <button key={s.id} onClick={() => { setFiltreStatut(s.id); if (s.id !== 'pret') setFiltrePretCommercial('tous'); }}
              style={{ padding: '5px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 12, border: filtreStatut === s.id ? 'none' : '1px solid #e5e7eb', background: filtreStatut === s.id ? (s.id === 'pret' ? '#22c55e' : s.id === 'vendu' ? '#7c3aed' : '#374151') : 'white', color: filtreStatut === s.id ? 'white' : '#6b7280', fontWeight: filtreStatut === s.id ? 700 : 400 }}>
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

        {/* Sub-filtre prêts par statut commercial */}
        {filtreStatut === 'pret' && (
          <div style={{ display: 'flex', gap: 8, padding: '8px 24px 10px', background: '#f0fdf4', flexWrap: 'wrap', borderBottom: '1px solid #d1fae5' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', alignSelf: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filtrer :</span>
            {([
              { id: 'tous'     as FiltrePretCommercial, label: `Tous (${pretsCount})`,                                     bg: '#16a34a' },
              { id: 'a-vendre' as FiltrePretCommercial, label: `🏷️ À vendre (${pretsParCommercial.aVendre})`,              bg: '#f97316' },
              { id: 'a-livrer' as FiltrePretCommercial, label: `🚚 À livrer (${pretsParCommercial.aLivrer})`,              bg: '#3b82f6' },
              { id: 'location' as FiltrePretCommercial, label: `🔑 Location (${pretsParCommercial.location})`,             bg: '#7c3aed' },
              { id: 'reserve'  as FiltrePretCommercial, label: `🔒 Réservé (${pretsParCommercial.reserve})`,              bg: '#92400e' },
            ].filter(f => f.id === 'tous' || (
              f.id === 'a-vendre'  ? pretsParCommercial.aVendre  > 0 :
              f.id === 'a-livrer'  ? pretsParCommercial.aLivrer  > 0 :
              f.id === 'location'  ? pretsParCommercial.location > 0 :
              f.id === 'reserve'   ? pretsParCommercial.reserve  > 0 : true
            ))).map(f => (
              <button key={f.id} onClick={() => setFiltrePretCommercial(f.id)}
                style={{ padding: '4px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 12, border: filtrePretCommercial === f.id ? 'none' : `1px solid ${f.bg}40`, background: filtrePretCommercial === f.id ? f.bg : 'white', color: filtrePretCommercial === f.id ? 'white' : f.bg, fontWeight: filtrePretCommercial === f.id ? 700 : 500 }}>
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* Filtre département */}
        {ROAD_MAP_STATIONS.some(s => deptCounts[s.id] > 0) && (
          <div style={{ display: 'flex', gap: 8, padding: '8px 24px 12px', background: 'white', flexWrap: 'wrap', borderBottom: '1px solid #e5e7eb' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', alignSelf: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Départements :</span>
            <button onClick={() => setFiltreDept('tous')}
              style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, border: filtreDept === 'tous' ? 'none' : '1px solid #e5e7eb', background: filtreDept === 'tous' ? '#374151' : 'white', color: filtreDept === 'tous' ? 'white' : '#6b7280', fontWeight: filtreDept === 'tous' ? 700 : 400, cursor: 'pointer' }}>
              Tous
            </button>
            {ROAD_MAP_STATIONS.filter(s => deptCounts[s.id] > 0).map(s => (
              <button key={s.id} onClick={() => setFiltreDept(filtreDept === s.id ? 'tous' : s.id)}
                style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, border: filtreDept === s.id ? 'none' : '1px solid #e5e7eb', background: filtreDept === s.id ? s.color : 'white', color: filtreDept === s.id ? 'white' : '#6b7280', fontWeight: filtreDept === s.id ? 700 : 400, cursor: 'pointer' }}>
                {s.icon} {s.label} <span style={{ opacity: 0.8 }}>({deptCounts[s.id]})</span>
              </button>
            ))}
          </div>
        )}

        {/* Liste style VueAsana (cartes + sections) */}
        {vehicules.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#9ca3af' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Aucun véhicule dans l'inventaire</div>
            <div style={{ fontSize: 14, marginBottom: 20 }}>Cliquez sur <strong style={{ color: '#22c55e' }}>+ Ajouter</strong> ou importez un fichier Excel</div>
          </div>
        ) : (
          <>
            {/* En-têtes stations — sticky */}
            <div style={{
              display: 'flex', alignItems: 'stretch', flexShrink: 0,
              borderBottom: '3px solid #e5e7eb', background: '#f8fafc',
              boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
            }}>
              <div style={{ width: 340, minWidth: 340, flexShrink: 0, padding: '12px 16px', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center' }}>
                Véhicule
              </div>
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${ROAD_MAP_STATIONS.length}, 1fr)`, gap: 0 }}>
                {ROAD_MAP_STATIONS.map(s => (
                  <div key={s.id} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '10px 4px', borderLeft: '1px solid #e5e7eb',
                  }}>
                    <span style={{ fontSize: 20, marginBottom: 3 }}>{s.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: s.color, textAlign: 'center', lineHeight: 1.2 }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Liste scrollable */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filtres.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
                  <div style={{ fontSize: 14 }}>Aucun résultat pour ces filtres</div>
                </div>
              ) : (() => {
                const aPlanifier   = filtres.filter(v => v.statut !== 'archive' && getSectionVehicule(v, itemByInvId[v.id]) === 'a-planifier');
                const enAttente    = filtres.filter(v => v.statut !== 'archive' && getSectionVehicule(v, itemByInvId[v.id]) === 'en-attente');
                const dansLeGarage = filtres.filter(v => v.statut !== 'archive' && getSectionVehicule(v, itemByInvId[v.id]) === 'dans-le-garage');
                const pretsSec     = filtres.filter(v => v.statut !== 'archive' && getSectionVehicule(v, itemByInvId[v.id]) === 'pret');
                const archives     = filtres.filter(v => v.statut === 'archive');
                return (
                  <>
                    {aPlanifier.length > 0 && (
                      <>
                        <SectionHeaderCard label="📋 À planifier" color="#9ca3af" count={aPlanifier.length} />
                        {aPlanifier.map(v => (
                          <CarteVehicule key={v.id} vehicule={v} item={itemByInvId[v.id]} type={v.type}
                            selected={selectedId === v.id}
                            onClick={() => setSelectedId(v.id === selectedId ? null : v.id)} />
                        ))}
                      </>
                    )}
                    {enAttente.length > 0 && (
                      <>
                        <SectionHeaderCard label="⏳ En attente" color="#f59e0b" count={enAttente.length} />
                        {enAttente.map(v => (
                          <CarteVehicule key={v.id} vehicule={v} item={itemByInvId[v.id]} type={v.type}
                            selected={selectedId === v.id}
                            onClick={() => setSelectedId(v.id === selectedId ? null : v.id)} />
                        ))}
                      </>
                    )}
                    {dansLeGarage.length > 0 && (
                      <>
                        <SectionHeaderCard label="🔧 Dans le garage" color="#3b82f6" count={dansLeGarage.length} />
                        {dansLeGarage.map(v => (
                          <CarteVehicule key={v.id} vehicule={v} item={itemByInvId[v.id]} type={v.type}
                            selected={selectedId === v.id}
                            onClick={() => setSelectedId(v.id === selectedId ? null : v.id)} />
                        ))}
                      </>
                    )}
                    {pretsSec.length > 0 && (
                      <>
                        <SectionHeaderCard label="✅ Prêts" color="#22c55e" count={pretsSec.length} />
                        {pretsSec.map(v => (
                          <CarteVehicule key={v.id} vehicule={v} item={itemByInvId[v.id]} type={v.type}
                            selected={selectedId === v.id}
                            onClick={() => setSelectedId(v.id === selectedId ? null : v.id)} />
                        ))}
                      </>
                    )}
                    {archives.length > 0 && (
                      <>
                        <SectionHeaderCard label="📦 Archivés" color="#d1d5db" count={archives.length} />
                        {archives.map(v => (
                          <CarteVehicule key={v.id} vehicule={v} item={itemByInvId[v.id]} type={v.type}
                            selected={selectedId === v.id}
                            onClick={() => setSelectedId(v.id === selectedId ? null : v.id)} />
                        ))}
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          </>
        )}
      </div>

      {selected && (
        <PanneauDetailVehicule
          key={selected.id}
          vehicule={selected}
          item={itemByInvId[selected.id]}
          onClose={() => setSelectedId(null)}
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
