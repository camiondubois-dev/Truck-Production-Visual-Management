import { useState } from 'react';
import { EauIcon } from './EauIcon';
import { Item, TypeItem, StationProgress, EtatCommercial } from '../types/item.types';
import { TOUTES_STATIONS_COMMUNES, PIPELINE_EAU_USAGE, PIPELINE_EAU_NEUF, PIPELINE_CLIENT_DEFAUT, PIPELINE_DETAIL_DEFAUT } from '../data/mockData';
import { useInventaire } from '../contexts/InventaireContext';
import { useClients } from '../contexts/ClientContext';
import type { VehiculeInventaire } from '../types/inventaireTypes';
import { AutocompleteInput } from './AutocompleteInput';
import { MARQUES_LISTE, MARQUES_CAMIONS, ANNEES_LISTE } from '../data/camionData';

interface FormState {
  type: TypeItem | null;
  variante: 'Neuf' | 'Usagé' | null;
  numero: string;
  annee: string;
  marque: string;
  modele: string;
  nomClient: string;
  telephone: string;
  vehicule: string;
  descriptionTravail: string;
  descriptionTravaux: string;
  urgence: boolean;
  clientAcheteur: string;
  etatCommercial: EtatCommercial;
  notes: string;
  stationsSelectionnees: string[];
  documents: {
    id: string;
    nom: string;
    taille: string;
    dateUpload: string;
    base64: string;
  }[];
  inventaireId?: string;
  clientId?: string;
  email?: string;
}

const FORM_DEFAUT: FormState = {
  type: null, variante: null,
  numero: '', annee: '', marque: '', modele: '',
  nomClient: '', telephone: '', vehicule: '',
  descriptionTravail: '', descriptionTravaux: '',
  urgence: false, clientAcheteur: '',
  etatCommercial: 'non-vendu',
  notes: '',
  stationsSelectionnees: [],
  documents: [],
  inventaireId: undefined,
  clientId: undefined,
  email: '',
};

interface WizardCreationProps {
  initialType?: TypeItem | null;
  onCreate: (item: Item, inventaireId?: string) => void;
  onClose: () => void;
}

const generateId = () => `item-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid #d1d5db',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
};

// ── Sous-composants ───────────────────────────────────────────

function StepIndicator({ numero, label, actif, complete }: {
  numero: number; label: string; actif: boolean; complete: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        fontWeight: 700, fontSize: 13,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: complete ? '#22c55e' : actif ? '#f97316' : '#e5e7eb',
        color: complete || actif ? 'white' : '#9ca3af',
        transition: 'all 0.2s',
      }}>
        {complete ? '✓' : numero}
      </div>
      <span style={{
        fontSize: 10, whiteSpace: 'nowrap',
        color: actif ? '#f97316' : complete ? '#22c55e' : '#9ca3af',
        fontWeight: actif || complete ? 600 : 400,
      }}>
        {label}
      </span>
    </div>
  );
}

function FormRow({ label, required, children, style }: {
  label: string; required?: boolean; children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, ...style }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
        {label}{required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function SectionDocuments({ documents, onAjouter, onSupprimer }: {
  documents: FormState['documents'];
  onAjouter: (doc: FormState['documents'][0]) => void;
  onSupprimer: (id: string) => void;
}) {
  return (
    <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 14, marginTop: 4 }}>
      <div style={{
        fontSize: 13, fontWeight: 700, color: '#374151',
        marginBottom: 4, display: 'flex', justifyContent: 'space-between',
      }}>
        <span>📎 Documents joints</span>
        <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>
          {documents.length}/3 · optionnel
        </span>
      </div>
      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 10 }}>
        Feuille de travail, specs, ou tout autre document PDF.
      </div>
      {documents.map(doc => (
        <div key={doc.id} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 12px', marginBottom: 6, borderRadius: 8,
          border: '1px solid #e5e7eb', background: '#f8fafc',
        }}>
          <span style={{ fontSize: 18 }}>📄</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {doc.nom}
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>{doc.taille}</div>
          </div>
          <button type="button" onClick={() => onSupprimer(doc.id)}
            style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid #fca5a5', background: 'transparent', color: '#ef4444', fontSize: 11, cursor: 'pointer' }}>
            🗑
          </button>
        </div>
      ))}
      {documents.length < 3 && (
        <label style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 8, padding: '10px', borderRadius: 8,
          border: '1.5px dashed #d1d5db', background: 'white',
          color: '#6b7280', fontSize: 13, fontWeight: 500, cursor: 'pointer',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLLabelElement).style.borderColor = '#3b82f6'; (e.currentTarget as HTMLLabelElement).style.color = '#3b82f6'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLLabelElement).style.borderColor = '#d1d5db'; (e.currentTarget as HTMLLabelElement).style.color = '#6b7280'; }}
        >
          <input type="file" accept=".pdf,application/pdf" style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 10 * 1024 * 1024) { alert('Le fichier ne doit pas dépasser 10 MB'); return; }
              const reader = new FileReader();
              reader.onload = () => {
                const base64 = reader.result as string;
                const tailleKB = Math.round(file.size / 1024);
                const taille = tailleKB > 1024 ? `${(tailleKB / 1024).toFixed(1)} MB` : `${tailleKB} KB`;
                onAjouter({ id: `doc-${Date.now()}`, nom: file.name, taille, dateUpload: new Date().toISOString(), base64 });
              };
              reader.readAsDataURL(file);
              e.target.value = '';
            }}
          />
          + Ajouter un document PDF
        </label>
      )}
    </div>
  );
}

// ── Statut commercial ─────────────────────────────────────────

function SectionEtatCommercial({ etatCommercial, clientAcheteur, setF }: {
  etatCommercial: EtatCommercial;
  clientAcheteur: string;
  setF: (p: Partial<FormState>) => void;
}) {
  const statuts: { val: EtatCommercial; label: string; icon: string; color: string }[] = [
    { val: 'non-vendu', label: 'Non vendu', icon: '○', color: '#6b7280' },
    { val: 'reserve',   label: 'Réservé',   icon: '🔒', color: '#f59e0b' },
    { val: 'vendu',     label: 'Vendu',     icon: '✓',  color: '#22c55e' },
  ];

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
        Statut commercial
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {statuts.map(({ val, label, icon, color }) => (
          <button
            key={val}
            type="button"
            onClick={() => setF({ etatCommercial: val, clientAcheteur: val === 'non-vendu' ? '' : clientAcheteur })}
            style={{
              flex: 1, padding: '10px 8px', borderRadius: 8, cursor: 'pointer',
              border: etatCommercial === val ? `2px solid ${color}` : '1px solid #e5e7eb',
              background: etatCommercial === val ? `${color}15` : 'white',
              color: etatCommercial === val ? color : '#9ca3af',
              fontWeight: etatCommercial === val ? 700 : 400,
              fontSize: 12, transition: 'all 0.15s',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}
          >
            <span style={{ fontSize: 18 }}>{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Nom client — seulement si réservé ou vendu */}
      {(etatCommercial === 'reserve' || etatCommercial === 'vendu') && (
        <input
          type="text"
          value={clientAcheteur}
          onChange={e => setF({ clientAcheteur: e.target.value })}
          placeholder="Nom du client (optionnel)"
          style={{ ...inputStyle, marginTop: 10 }}
        />
      )}
    </div>
  );
}

// ── ÉTAPE 0 — Source ─────────────────────────────────────────

function Etape0Source({ onSelectNouveau, onSelectInventaire }: {
  onSelectNouveau: () => void;
  onSelectInventaire: () => void;
}) {
  const { vehicules } = useInventaire();
  const disponibles = vehicules.filter(v => v.statut === 'disponible').length;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <div
        onClick={onSelectInventaire}
        style={{
          padding: 28, borderRadius: 14, cursor: 'pointer', textAlign: 'center',
          border: '2px solid #3b82f633', background: '#3b82f60d',
          transition: 'all 0.15s', position: 'relative',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#3b82f6'; (e.currentTarget as HTMLDivElement).style.background = '#3b82f618'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#3b82f633'; (e.currentTarget as HTMLDivElement).style.background = '#3b82f60d'; }}
      >
        {disponibles > 0 && (
          <div style={{ position: 'absolute', top: 12, right: 12, background: '#22c55e', color: 'white', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>
            {disponibles} dispo
          </div>
        )}
        <div style={{ fontSize: 42, marginBottom: 12 }}>📋</div>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#3b82f6', marginBottom: 8 }}>Depuis l'inventaire</div>
        <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
          Sélectionner un véhicule existant — champs pré-remplis automatiquement
        </div>
        {disponibles === 0 && (
          <div style={{ marginTop: 12, fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>⚠️ Aucun véhicule disponible</div>
        )}
      </div>

      <div
        onClick={onSelectNouveau}
        style={{
          padding: 28, borderRadius: 14, cursor: 'pointer', textAlign: 'center',
          border: '2px solid #f9731633', background: '#f973160d', transition: 'all 0.15s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#f97316'; (e.currentTarget as HTMLDivElement).style.background = '#f9731618'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#f9731633'; (e.currentTarget as HTMLDivElement).style.background = '#f973160d'; }}
      >
        <div style={{ fontSize: 42, marginBottom: 12 }}>✨</div>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#f97316', marginBottom: 8 }}>Nouveau</div>
        <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
          Saisie manuelle — remplir tous les champs manuellement
        </div>
      </div>
    </div>
  );
}

// ── ÉTAPE INVENTAIRE ──────────────────────────────────────────

function EtapeInventaire({ onSelect, initialType }: { 
  onSelect: (v: VehiculeInventaire) => void;
  initialType?: TypeItem | null;
}) {
  const { vehicules } = useInventaire();
  const { clients } = useClients();
  const [recherche, setRecherche] = useState('');
const [filtreType, setFiltreType] = useState<'tous' | 'eau' | 'client' | 'detail'>(
  initialType ?? 'tous'
);

  // Pour eau et détail — depuis prod_inventaire
  const disponiblesInventaire = vehicules.filter(v => {
    if (v.statut !== 'disponible') return false;
    if (v.type === 'client') return false; // ← clients gérés séparément
    if (filtreType !== 'tous' && filtreType !== 'client' && v.type !== filtreType) return false;
    if (recherche) {
      const q = recherche.toLowerCase();
      return (
        v.numero.toLowerCase().includes(q) ||
        v.marque?.toLowerCase().includes(q) ||
        v.modele?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Pour clients — depuis prod_clients
  const clientsFiltres = clients.filter(c => {
    if (!recherche) return true;
    const q = recherche.toLowerCase();
    return (
      c.nom.toLowerCase().includes(q) ||
      c.telephone?.toLowerCase().includes(q)
    );
  });

  const afficherClients = filtreType === 'client' || filtreType === 'tous';
  const afficherInventaire = filtreType !== 'client';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input type="text" placeholder="Rechercher..." value={recherche}
          onChange={e => setRecherche(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: 150 }} />
        {(['tous', 'eau', 'client', 'detail'] as const).map(t => (
          <button key={t} type="button" onClick={() => setFiltreType(t)}
            style={{
              padding: '6px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 11,
              border: filtreType === t ? 'none' : '1px solid #e5e7eb',
              background: filtreType === t ? '#1e293b' : 'white',
              color: filtreType === t ? 'white' : '#6b7280',
              fontWeight: filtreType === t ? 700 : 400,
            }}>
            {t === 'tous' ? 'Tous' : t === 'eau' ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><EauIcon /> Eau</span> : t === 'client' ? '🔧 Client' : '🏷️ Détail'}
          </button>
        ))}
      </div>

      <div style={{ maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>

        {/* ── CLIENTS depuis prod_clients ── */}
        {afficherClients && clientsFiltres.length > 0 && (
          <>
            {filtreType === 'tous' && (
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 2px' }}>
                🔧 Clients
              </div>
            )}
            {clientsFiltres.map(c => (
              <div key={c.id}
                onClick={() => {
                  // Convertir client en VehiculeInventaire virtuel
                  const virtuel: VehiculeInventaire = {
                    id: `client-virtuel-${c.id}`,
                    statut: 'disponible',
                    dateImport: new Date().toISOString(),
                    numero: '',
                    type: 'client',
                    nomClient: c.nom,
                    telephone: c.telephone,
                    email: c.email,
                    clientId: c.id,
                  };
                  onSelect(virtuel);
                }}
                style={{
                  padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                  border: '1px solid #3b82f633', background: '#3b82f608',
                  transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 12,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#3b82f6'; (e.currentTarget as HTMLDivElement).style.background = '#3b82f615'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#3b82f633'; (e.currentTarget as HTMLDivElement).style.background = '#3b82f608'; }}
              >
                <span style={{ fontSize: 22 }}>👤</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#3b82f6', marginBottom: 2 }}>{c.nom}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>
                    {c.telephone && `📞 ${c.telephone}`}
                    {c.email && ` · ✉️ ${c.email}`}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#3b82f6', fontWeight: 700 }}>Sélectionner →</div>
              </div>
            ))}
          </>
        )}

        {/* ── INVENTAIRE eau/détail ── */}
        {afficherInventaire && disponiblesInventaire.length > 0 && (
          <>
            {filtreType === 'tous' && (
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 2px', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                <EauIcon /> Inventaire
              </div>
            )}
            {disponiblesInventaire.map(v => {
              const typeColor = v.type === 'eau' ? '#f97316' : '#22c55e';
              return (
                <div key={v.id} onClick={() => onSelect(v)}
                  style={{
                    padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                    border: `1px solid ${typeColor}33`, background: `${typeColor}08`,
                    transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 12,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = typeColor; (e.currentTarget as HTMLDivElement).style.background = `${typeColor}15`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = `${typeColor}33`; (e.currentTarget as HTMLDivElement).style.background = `${typeColor}08`; }}
                >
                  {v.type === 'eau' ? <EauIcon /> : <span style={{ fontSize: 22 }}>🏷️</span>}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: typeColor }}>#{v.numero}</span>
                      {v.variante && (
                        <span style={{ fontSize: 10, background: '#f1f5f9', color: '#64748b', padding: '1px 6px', borderRadius: 6, fontWeight: 600 }}>{v.variante}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>
                      {v.marque && v.modele ? `${v.marque} ${v.modele}${v.annee ? ` ${v.annee}` : ''}` : '—'}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: typeColor, fontWeight: 700 }}>Sélectionner →</div>
                </div>
              );
            })}
          </>
        )}

        {/* Vide */}
        {(filtreType === 'client' ? clientsFiltres.length === 0 : disponiblesInventaire.length === 0 && (!afficherClients || clientsFiltres.length === 0)) && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
            <div style={{ fontSize: 14 }}>Aucun véhicule disponible</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Etape1({ onSelect }: { onSelect: (type: TypeItem, stations: string[]) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
      {[
        { type: 'eau' as TypeItem, icon: 'EAU_LOGO', label: 'Camion à eau', desc: 'Fabrication & transformation', color: '#f97316' },
        { type: 'client' as TypeItem, icon: '🔧', label: 'Client externe', desc: 'Réparation & service rapide', color: '#3b82f6' },
        { type: 'detail' as TypeItem, icon: '🏷️', label: 'Camion détail', desc: 'Reconditionnement & revente', color: '#22c55e' },
      ].map(({ type, icon, label, desc, color }) => (
        <div key={type} onClick={() => {
          const stations = type === 'client' ? [...PIPELINE_CLIENT_DEFAUT] : type === 'detail' ? [...PIPELINE_DETAIL_DEFAUT] : [];
          onSelect(type, stations);
        }}
          style={{ padding: 20, borderRadius: 12, cursor: 'pointer', textAlign: 'center', border: `2px solid ${color}33`, background: `${color}0d`, transition: 'all 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = color; }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = `${color}33`; }}
        >
          <div style={{ fontSize: 36, marginBottom: 8 }}>{icon === 'EAU_LOGO' ? <EauIcon /> : icon}</div>
          <div style={{ fontWeight: 700, fontSize: 15, color, marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{desc}</div>
        </div>
      ))}
    </div>
  );
}

function Etape2Eau({ onSelect }: { onSelect: (variante: 'Neuf' | 'Usagé') => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {[
        {
          variante: 'Neuf' as const, icon: '✨', color: '#f97316',
          pipeline: [
            'Sous-traitants (optionnel)',
            'Soudure spécialisée',
            'Peinture',
            'Mécanique électrique',
            'Livraison',
          ],
        },
        {
          variante: 'Usagé' as const, icon: '🔄', color: '#ea580c',
          pipeline: [
            'Soudure générale',
            'Sous-traitants',
            'Mécanique moteur',
            'Mécanique générale',
            '→ puis pipeline neuf',
          ],
        },
      ].map(({ variante, icon, color, pipeline }) => (
        <div
          key={variante}
          onClick={() => onSelect(variante)}
          style={{
            padding: 20, borderRadius: 12, cursor: 'pointer',
            border: `2px solid ${color}33`, background: `${color}0d`,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = color; }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = `${color}33`; }}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
          <div style={{ fontWeight: 700, fontSize: 16, color, marginBottom: 12 }}>
            Camion {variante}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, marginBottom: 6, letterSpacing: '0.05em' }}>
            PIPELINE :
          </div>
          {pipeline.map((p, i) => (
            <div key={i} style={{
              fontSize: 12,
              color: p.startsWith('→') ? color
                   : p.includes('optionnel') ? '#f59e0b'
                   : '#374151',
              fontStyle: p.startsWith('→') ? 'italic' : 'normal',
              marginBottom: 4, paddingLeft: 10,
              borderLeft: `2px solid ${p.includes('optionnel') ? '#f59e0b' : color}44`,
            }}>
              {p}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Etape2ClientDetail({ form, setF }: { form: FormState; setF: (p: Partial<FormState>) => void }) {
  const isClient = form.type === 'client';
  const { rechercherClients } = useClients();
  const [suggClients, setSuggClients] = useState<import('../types/clientTypes').Client[]>([]);
  const [showSugg, setShowSugg] = useState(false);
  const [clientExistantId, setClientExistantId] = useState<string | undefined>(form.clientId);

  const handleNomClientChange = (val: string) => {
    setF({ nomClient: val });
    setClientExistantId(undefined);
    if (val.length >= 1) {
      setSuggClients(rechercherClients(val));
      setShowSugg(true);
    } else {
      setShowSugg(false);
    }
  };

  const handleSelectClient = (client: import('../types/clientTypes').Client) => {
    setF({
      nomClient: client.nom,
      telephone: client.telephone ?? '',
      email: client.email ?? '',
      clientId: client.id,
    });
    setClientExistantId(client.id);
    setShowSugg(false);
    setSuggClients([]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {form.inventaireId && (
        <div style={{ padding: '8px 14px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #86efac', fontSize: 12, color: '#166534', fontWeight: 600 }}>
          ✅ Champs pré-remplis depuis l'inventaire — modifiez au besoin
        </div>
      )}

      <div style={{ display: 'flex', gap: 12 }}>
        <FormRow label="Numéro de work order" style={{ flex: 1 }}>
  <input type="text" value={form.numero} onChange={e => setF({ numero: e.target.value })}
    placeholder="WO-2026-001 (optionnel)" style={inputStyle} />
</FormRow>
        {!isClient && (
          <FormRow label="Année" style={{ width: 100 }}>
            <AutocompleteInput value={form.annee} onChange={val => setF({ annee: val })}
              suggestions={ANNEES_LISTE.map(String)} placeholder="2018" />
          </FormRow>
        )}
      </div>

      {isClient ? (
        <>
          <div style={{ position: 'relative' }}>
            <FormRow label="Nom du client">
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={form.nomClient}
                  onChange={e => handleNomClientChange(e.target.value)}
                  onFocus={() => {
                    if (form.nomClient.length >= 1) {
                      setSuggClients(rechercherClients(form.nomClient));
                      setShowSugg(true);
                    } else {
                      setSuggClients(rechercherClients(''));
                      setShowSugg(true);
                    }
                  }}
                  onBlur={() => setTimeout(() => setShowSugg(false), 150)}
                  placeholder="Transport Tremblay..."
                  style={inputStyle}
                />
                {clientExistantId && (
                  <div style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 10, background: '#dcfce7', color: '#166534',
                    padding: '2px 8px', borderRadius: 10, fontWeight: 700,
                  }}>
                    ✓ Client existant
                  </div>
                )}
              </div>
            </FormRow>

            {showSugg && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 99,
                background: 'white', border: '1px solid #e5e7eb', borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto',
                marginTop: 4,
              }}>
                {suggClients.length > 0 ? (
                  <>
                    <div style={{ padding: '6px 12px', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9' }}>
                      Clients existants
                    </div>
                    {suggClients.map(c => (
                      <div
                        key={c.id}
                        onMouseDown={() => handleSelectClient(c)}
                        style={{
                          padding: '10px 12px', cursor: 'pointer',
                          borderBottom: '1px solid #f1f5f9',
                          display: 'flex', flexDirection: 'column', gap: 2,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{c.nom}</div>
                        {c.telephone && <div style={{ fontSize: 11, color: '#6b7280' }}>📞 {c.telephone}</div>}
                        {c.email && <div style={{ fontSize: 11, color: '#6b7280' }}>✉️ {c.email}</div>}
                      </div>
                    ))}
                  </>
                ) : form.nomClient.length > 0 ? (
                  <div style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: 8, color: '#374151' }}>
                    <span style={{ fontSize: 16 }}>✨</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Nouveau client</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>"{form.nomClient}" sera créé automatiquement</div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <FormRow label="Téléphone">
            <input type="text" value={form.telephone} onChange={e => setF({ telephone: e.target.value })}
              placeholder="418-555-0123" style={inputStyle} />
          </FormRow>

          <FormRow label="Email">
            <input type="text" value={form.email ?? ''} onChange={e => setF({ email: e.target.value })}
              placeholder="transport@exemple.com" style={inputStyle} />
          </FormRow>

          <FormRow label="Véhicule du client">
            <input type="text" value={form.vehicule} onChange={e => setF({ vehicule: e.target.value })}
              placeholder="Kenworth T680 2019" style={inputStyle} />
          </FormRow>

          <FormRow label="Description du travail" required>
            <textarea value={form.descriptionTravail} onChange={e => setF({ descriptionTravail: e.target.value })}
              placeholder="Changement freins arrière..." rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </FormRow>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Priorité</span>
            <button type="button" onClick={() => setF({ urgence: !form.urgence })}
              style={{
                padding: '5px 16px', borderRadius: 20,
                border: form.urgence ? '1.5px solid #f59e0b' : '1px solid #e5e7eb',
                background: form.urgence ? '#fef3c7' : '#f9fafb',
                color: form.urgence ? '#92400e' : '#9ca3af',
                fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}>
              {form.urgence ? '⚡ URGENT' : '○ Normal'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 12 }}>
            <FormRow label="Marque" required style={{ flex: 1 }}>
              <AutocompleteInput value={form.marque} onChange={val => setF({ marque: val, modele: '' })}
                suggestions={MARQUES_LISTE} placeholder="Peterbilt" />
            </FormRow>
            <FormRow label="Modèle" required style={{ flex: 1 }}>
              <AutocompleteInput value={form.modele} onChange={val => setF({ modele: val })}
                suggestions={form.marque && MARQUES_CAMIONS[form.marque] ? MARQUES_CAMIONS[form.marque] : Object.values(MARQUES_CAMIONS).flat().sort()}
                placeholder="389" />
            </FormRow>
          </div>
          <FormRow label="Commentaires / Travaux à effectuer">
            <textarea value={form.descriptionTravaux} onChange={e => setF({ descriptionTravaux: e.target.value })}
              placeholder="Ex: Vérifier les coulisses d'huile..." rows={3}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 80, lineHeight: 1.5 }} />
          </FormRow>

          <SectionEtatCommercial
            etatCommercial={form.etatCommercial}
            clientAcheteur={form.clientAcheteur}
            setF={setF}
          />
        </>
      )}

      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 4 }}>Stations requises</div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 10 }}>
          {isClient ? 'Présélection typique pour un job client — ajuste au besoin.' : 'Présélection typique pour un reconditionnement — ajuste au besoin.'}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {TOUTES_STATIONS_COMMUNES.map(station => {
            const selectionne = form.stationsSelectionnees.includes(station.id);
            return (
              <button key={station.id} type="button"
                onClick={() => setF({ stationsSelectionnees: selectionne ? form.stationsSelectionnees.filter(s => s !== station.id) : [...form.stationsSelectionnees, station.id] })}
                style={{
                  padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
                  fontWeight: selectionne ? 700 : 400, fontSize: 12,
                  border: `1.5px solid ${selectionne ? station.color : '#e5e7eb'}`,
                  background: selectionne ? `${station.color}18` : 'white',
                  color: selectionne ? station.color : '#9ca3af',
                  transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 5,
                }}>
                {selectionne && <span style={{ fontSize: 11 }}>✓</span>}
                {station.labelCourt}
              </button>
            );
          })}
        </div>
        {form.stationsSelectionnees.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>Ordre :</span>
            {form.stationsSelectionnees.map((id, idx) => {
              const s = TOUTES_STATIONS_COMMUNES.find(sc => sc.id === id);
              return (
                <span key={id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: s?.color, fontWeight: 600 }}>{s?.labelCourt}</span>
                  {idx < form.stationsSelectionnees.length - 1 && <span style={{ color: '#d1d5db' }}>→</span>}
                </span>
              );
            })}
          </div>
        )}
      </div>

      <SectionDocuments
        documents={form.documents}
        onAjouter={(doc) => setF({ documents: [...form.documents, doc] })}
        onSupprimer={(id) => setF({ documents: form.documents.filter(d => d.id !== id) })}
      />
    </div>
  );
}

function Etape3Eau({ form, setF }: { form: FormState; setF: (p: Partial<FormState>) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {form.inventaireId && (
        <div style={{ padding: '8px 14px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #86efac', fontSize: 12, color: '#166534', fontWeight: 600 }}>
          ✅ Champs pré-remplis depuis l'inventaire — modifiez au besoin
        </div>
      )}

      <div style={{ display: 'flex', gap: 12 }}>
        <FormRow label="Numéro de stock" required style={{ flex: 1 }}>
          <input type="text" value={form.numero} onChange={e => setF({ numero: e.target.value })}
            placeholder="35743" style={inputStyle} />
        </FormRow>
        <FormRow label="Année" style={{ width: 100 }}>
          <AutocompleteInput value={form.annee} onChange={val => setF({ annee: val })}
            suggestions={ANNEES_LISTE.map(String)} placeholder="2024" />
        </FormRow>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <FormRow label="Marque" required style={{ flex: 1 }}>
          <AutocompleteInput value={form.marque} onChange={val => setF({ marque: val, modele: '' })}
            suggestions={MARQUES_LISTE} placeholder="Kenworth" />
        </FormRow>
        <FormRow label="Modèle" required style={{ flex: 1 }}>
          <AutocompleteInput value={form.modele} onChange={val => setF({ modele: val })}
            suggestions={form.marque && MARQUES_CAMIONS[form.marque] ? MARQUES_CAMIONS[form.marque] : Object.values(MARQUES_CAMIONS).flat().sort()}
            placeholder="T-880" />
        </FormRow>
      </div>

      {/* Statut commercial */}
      <SectionEtatCommercial
        etatCommercial={form.etatCommercial}
        clientAcheteur={form.clientAcheteur}
        setF={setF}
      />

      <FormRow label="Notes / Spécifications particulières">
        <textarea value={form.notes} onChange={e => setF({ notes: e.target.value })}
          placeholder="Options spéciales, couleur, équipements..." rows={3}
          style={{ ...inputStyle, resize: 'vertical' }} />
      </FormRow>

      <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '10px 14px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#c2410c', marginBottom: 6 }}>
          Pipeline assigné — Camion {form.variante}
        </div>
        <div style={{ fontSize: 12, color: '#374151' }}>
          {form.variante === 'Neuf'
            ? 'Soudure spécialisée → Peinture → Mécanique électrique → Livraison'
            : 'Soudure générale → Sous-traitants → Mécanique moteur → Mécanique générale → Soudure spécialisée → Peinture → Mécanique électrique → Livraison'}
        </div>
      </div>

      {/* ── STATIONS OPTIONNELLES ── */}
      <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
          Stations optionnelles
        </div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 10 }}>
          Ajouter des étapes supplémentaires si nécessaire pour ce camion.
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {TOUTES_STATIONS_COMMUNES
            .filter(station => {
              if (form.variante === 'Usagé') return false;
              const dejaDans = form.variante === 'Neuf'
                ? PIPELINE_EAU_NEUF
                : PIPELINE_EAU_USAGE;
              return !dejaDans.includes(station.id);
            })
            .map(station => {
              const selectionne = form.stationsSelectionnees.includes(station.id);
              return (
                <button
                  key={station.id}
                  type="button"
                  onClick={() => setF({
                    stationsSelectionnees: selectionne
                      ? form.stationsSelectionnees.filter(s => s !== station.id)
                      : [...form.stationsSelectionnees, station.id],
                  })}
                  style={{
                    padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
                    fontWeight: selectionne ? 700 : 400, fontSize: 12,
                    border: `1.5px solid ${selectionne ? station.color : '#e5e7eb'}`,
                    background: selectionne ? `${station.color}18` : 'white',
                    color: selectionne ? station.color : '#9ca3af',
                    transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  {selectionne && <span style={{ fontSize: 11 }}>✓</span>}
                  {station.labelCourt}
                </button>
              );
            })
          }
        </div>
        {form.stationsSelectionnees.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>Ajoutées :</span>
            {form.stationsSelectionnees.map((id, idx) => {
              const s = TOUTES_STATIONS_COMMUNES.find(sc => sc.id === id);
              return (
                <span key={id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: s?.color, fontWeight: 600 }}>{s?.labelCourt}</span>
                  {idx < form.stationsSelectionnees.length - 1 && <span style={{ color: '#d1d5db' }}>+</span>}
                </span>
              );
            })}
          </div>
        )}
      </div>

      <SectionDocuments
        documents={form.documents}
        onAjouter={(doc) => setF({ documents: [...form.documents, doc] })}
        onSupprimer={(id) => setF({ documents: form.documents.filter(d => d.id !== id) })}
      />
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────

export function CreateWizardModal({ initialType, onCreate, onClose }: WizardCreationProps) {
  const { marquerEnProduction, ajouterVehicule } = useInventaire();
  const { ajouterClient } = useClients();

 const [source, setSource] = useState<'choix' | 'inventaire' | 'nouveau'>('choix');
const [etape, setEtape] = useState(1);
  const [form, setForm] = useState<FormState>({
    ...FORM_DEFAUT,
    type: initialType ?? null,
    stationsSelectionnees: initialType === 'client' ? [...PIPELINE_CLIENT_DEFAUT]
      : initialType === 'detail' ? [...PIPELINE_DETAIL_DEFAUT]
      : [],
  });

  const setF = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }));

  const handleSelectInventaire = (v: VehiculeInventaire) => {
    const stations = v.type === 'client' ? [...PIPELINE_CLIENT_DEFAUT]
      : v.type === 'detail' ? [...PIPELINE_DETAIL_DEFAUT] : [];

    setForm({
      ...FORM_DEFAUT,
      inventaireId: v.id,
      type: v.type,
      variante: v.variante ?? null,
      numero: v.numero,
      annee: v.annee ? String(v.annee) : '',
      marque: v.marque ?? '',
      modele: v.modele ?? '',
      nomClient: v.nomClient ?? '',
      telephone: v.telephone ?? '',
      email: v.email ?? '',
      vehicule: v.vehicule ?? '',
      descriptionTravail: v.descriptionTravail ?? '',
      descriptionTravaux: v.descriptionTravaux ?? '',
      clientAcheteur: v.clientAcheteur ?? '',
      etatCommercial: 'non-vendu',
      notes: v.notes ?? '',
      stationsSelectionnees: stations,
      documents: [],
    });

    setSource('nouveau');
    if (v.type === 'eau') {
      setEtape(v.variante ? 3 : 2);
    } else {
      setEtape(2);
    }
  };

  const handleCreer = async () => {
   if (!form.type) return;
if (form.type !== 'client' && !form.numero) return;

    const id = generateId();
    const now = new Date().toISOString();
    let nouvelItem: Item;

    if (form.type === 'eau') {
      const pipelineBase = form.variante === 'Neuf' ? PIPELINE_EAU_NEUF : PIPELINE_EAU_USAGE;

      const stationsOptionnelles = form.stationsSelectionnees.filter(
        s => !pipelineBase.includes(s)
      );

      const stationsActives = form.variante === 'Neuf'
        ? [...stationsOptionnelles, ...pipelineBase]
        : [...pipelineBase, ...stationsOptionnelles.filter(s => !pipelineBase.includes(s))];

      const progression: StationProgress[] = stationsActives.map(sid => ({ stationId: sid, status: 'non-commence', subTasks: [] }));
    nouvelItem = {
  id, type: 'eau', numero: form.numero,
  label: `${form.marque} ${form.modele} ${form.annee}`.trim(),
  variante: form.variante!, annee: parseInt(form.annee) || undefined,
  marque: form.marque, modele: form.modele,
  etatCommercial: form.etatCommercial,
  clientAcheteur: form.clientAcheteur || undefined,
  notes: form.notes || undefined,
  documents: form.documents.length > 0 ? form.documents : undefined,
  etat: 'en-attente', stationActuelle: stationsActives[0],
  dateCreation: now, stationsActives, progression,
  inventaireId: form.inventaireId || undefined, // ← AJOUTER
};
    } else if (form.type === 'client') {
      const stationsActives = form.stationsSelectionnees.length > 0 ? form.stationsSelectionnees : PIPELINE_CLIENT_DEFAUT;
      const progression: StationProgress[] = stationsActives.map(sid => ({ stationId: sid, status: 'non-commence', subTasks: [] }));
      const label = form.nomClient
        ? `${form.nomClient} — ${form.descriptionTravail}`
        : form.vehicule ? `${form.vehicule} — ${form.descriptionTravail}` : form.descriptionTravail;
     nouvelItem = {
  id, type: 'client', numero: form.numero, label,
  nomClient: form.nomClient || undefined, telephone: form.telephone || undefined,
  descriptionTravail: form.descriptionTravail, vehicule: form.vehicule || undefined,
  urgence: form.urgence,
  documents: form.documents.length > 0 ? form.documents : undefined,
  etat: 'en-attente', stationActuelle: stationsActives[0],
  dateCreation: now, stationsActives, progression,
  inventaireId: form.inventaireId || undefined,
};

      if (!form.clientId && form.nomClient) {
        const nouveauClient = {
          id: `client-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
          nom: form.nomClient,
          telephone: form.telephone || undefined,
          email: form.email || undefined,
          dateCreation: new Date().toISOString(),
        };
        ajouterClient(nouveauClient);
        (nouvelItem as any).clientId = nouveauClient.id;
      } else if (form.clientId) {
        (nouvelItem as any).clientId = form.clientId;
      }
    } else {
      const stationsActives = form.stationsSelectionnees.length > 0 ? form.stationsSelectionnees : PIPELINE_DETAIL_DEFAUT;
      const progression: StationProgress[] = stationsActives.map(sid => ({ stationId: sid, status: 'non-commence', subTasks: [] }));
    nouvelItem = {
  id, type: 'detail', numero: form.numero,
  label: `${form.marque} ${form.modele} ${form.annee}`.trim(),
  annee: parseInt(form.annee) || undefined, marque: form.marque, modele: form.modele,
  etatCommercial: form.etatCommercial,
  clientAcheteur: form.clientAcheteur || undefined,
  descriptionTravaux: form.descriptionTravaux || undefined,
  documents: form.documents.length > 0 ? form.documents : undefined,
  etat: 'en-attente', stationActuelle: stationsActives[0],
  dateCreation: now, stationsActives, progression,
  inventaireId: form.inventaireId || undefined, // ← AJOUTER
};
    }

    // Si pas d'inventaireId réel, créer une entrée prod_inventaire pour le véhicule
    let inventaireId = form.inventaireId;
    const isVirtuel = !inventaireId || inventaireId.startsWith('client-virtuel-');

    if (isVirtuel) {
      const invId = `veh-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
      const stationsActives = nouvelItem.stationsActives ?? [];
      const roadMap = stationsActives.map((sid: string, idx: number) => ({
        id: `rm-${Date.now()}-${Math.random().toString(36).slice(2,5)}-${idx}`,
        stationId: sid,
        statut: 'en-attente' as const,
        priorite: idx + 1,
      }));
      const vehiculeInv = {
        id: invId,
        statut: 'en-production' as const,
        dateImport: now,
        dateEnProduction: now,
        jobId: id,
        numero: form.numero || `C-${Date.now().toString().slice(-6)}`,
        type: form.type as 'eau' | 'client' | 'detail',
        nomClient: form.nomClient || undefined,
        telephone: form.telephone || undefined,
        vehicule: form.vehicule || undefined,
        descriptionTravail: form.descriptionTravail || undefined,
        descriptionTravaux: form.descriptionTravaux || undefined,
        roadMap,
      };
      await ajouterVehicule(vehiculeInv as any);
      inventaireId = invId;
      nouvelItem.inventaireId = invId;
    }

    if (inventaireId && !isVirtuel) {
      await marquerEnProduction(inventaireId, id);
    }

    onCreate(nouvelItem);
    onClose();
  };

  const estDerniereEtape =
    (form.type === 'eau' && etape === 3) ||
    (form.type !== 'eau' && etape === 2);

  const contenuEtape = () => {
    if (source === 'choix') return <Etape0Source onSelectNouveau={() => setSource('nouveau')} onSelectInventaire={() => setSource('inventaire')} />;
    if (source === 'inventaire') return <EtapeInventaire onSelect={handleSelectInventaire} initialType={initialType} />
    if (etape === 1) return <Etape1 onSelect={(type, stations) => { setF({ type, stationsSelectionnees: stations }); setEtape(2); }} />;
    if (etape === 2 && form.type === 'eau') return <Etape2Eau onSelect={(variante) => { setF({ variante }); setEtape(3); }} />;
    if (etape === 2) return <Etape2ClientDetail form={form} setF={setF} />;
    return <Etape3Eau form={form} setF={setF} />;
  };

  const titreModal = source === 'inventaire' ? "Choisir depuis l'inventaire" : 'Nouveau job';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: 'white', borderRadius: 16,
        width: source === 'inventaire' ? 640 : 600,
        maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
        transition: 'width 0.2s',
      }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: source === 'nouveau' ? 20 : 0 }}>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#111827' }}>{titreModal}</div>
            <button type="button" onClick={onClose}
              style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9ca3af', lineHeight: 1 }}>
              ✕
            </button>
          </div>

          {source === 'nouveau' && (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {[
                { num: 1, label: 'Type' },
                { num: 2, label: form.type === 'eau' ? 'Variante' : 'Infos & Stations' },
                ...(form.type === 'eau' ? [{ num: 3, label: 'Infos camion' }] : []),
              ].map((s, i, arr) => (
                <div key={s.num} style={{ display: 'flex', alignItems: 'center', flex: i < arr.length - 1 ? 1 : 0 }}>
                  <StepIndicator numero={s.num} label={s.label} actif={etape === s.num} complete={etape > s.num} />
                  {i < arr.length - 1 && (
                    <div style={{ flex: 1, height: 1, background: etape > s.num ? '#22c55e' : '#e5e7eb', margin: '0 8px', marginBottom: 14, transition: 'background 0.3s' }} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contenu */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {contenuEtape()}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid #e5e7eb',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: '#fafafa',
        }}>
          {source === 'inventaire' ? (
            <button type="button" onClick={() => setSource('choix')}
              style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: 13, color: '#374151' }}>
              ← Retour
            </button>
          ) : source === 'nouveau' && etape > 1 && !form.inventaireId ? (
            <button type="button" onClick={() => setEtape(e => e - 1)}
              style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: 13, color: '#374151' }}>
              ← Retour
            </button>
          ) : source === 'nouveau' && etape > 1 && form.inventaireId ? (
            <button type="button" onClick={() => { setSource('inventaire'); setForm({ ...FORM_DEFAUT }); }}
              style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: 13, color: '#374151' }}>
              ← Changer de véhicule
            </button>
          ) : <div />}

          {source === 'nouveau' && estDerniereEtape && (
            <button
              type="button"
              onClick={handleCreer}
              disabled={form.type !== 'client' && !form.numero}
              style={{
                padding: '10px 28px', borderRadius: 8, border: 'none',
                background: (form.type === 'client' || form.numero) ? '#f97316' : '#fed7aa',
                color: 'white', fontWeight: 700, fontSize: 14,
                cursor: (form.type === 'client' || form.numero) ? 'pointer' : 'not-allowed',
              }}>
              Créer le job ✓
            </button>
          )}

          {source === 'nouveau' && !estDerniereEtape && etape > 1 && (
            <button type="button" onClick={() => setEtape(e => e + 1)}
              style={{ padding: '10px 28px', borderRadius: 8, border: 'none', background: '#1e293b', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              Suivant →
            </button>
          )}

          {(source === 'choix' || (source === 'nouveau' && etape === 1 && !estDerniereEtape)) && <div />}
        </div>
      </div>
    </div>
  );
}