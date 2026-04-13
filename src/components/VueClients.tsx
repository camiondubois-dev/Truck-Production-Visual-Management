import { useState, useRef, useEffect } from 'react';
import { useClients } from '../contexts/ClientContext';
import { searchTable } from '../services/searchService';
import { useGarage } from '../hooks/useGarage';
import type { Client } from '../types/clientTypes';

const generateClientId = () => `client-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 6,
  border: '1px solid #d1d5db', fontSize: 13, outline: 'none',
  boxSizing: 'border-box',
};

export function VueClients() {
  const { clients, ajouterClient, importerClients, mettreAJourClient, supprimerClient } = useClients();
  const { items } = useGarage();
  const CLIENTS_COLS = ['nom', 'contact', 'telephone', 'email', 'salesperson', 'numero_compte', 'notes'];

  const [recherche, setRecherche] = useState('');
  const [searchResults, setSearchResults] = useState<Client[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showModalAjout, setShowModalAjout] = useState(false);
  const [erreurImport, setErreurImport] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!recherche.trim()) {
        setSearchResults(null);
        return;
      }
      const results = await searchTable('prod_clients', recherche, CLIENTS_COLS);
      setSearchResults(results as Client[]);
    }, 300);
    return () => clearTimeout(timer);
  }, [recherche]);

  const filtres = searchResults !== null ? searchResults : clients;

  const selected = clients.find(c => c.id === selectedId) ?? null;

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

      const nouveaux: Client[] = rows
        .filter(row => row.nom)
        .map(row => ({
          id: generateClientId(),
          numeroCompte: row.numero_compte ? String(row.numero_compte) : undefined,
          nom: String(row.nom),
          telephone: row.telephone ? String(row.telephone) : undefined,
          email: row.email ? String(row.email) : undefined,
          adresse: row.adresse ? String(row.adresse) : undefined,
          contact: row.contact ? String(row.contact) : undefined,
          salesperson: row.salesperson ? String(row.salesperson) : undefined,
          notes: row.notes ? String(row.notes) : undefined,
          dateCreation: new Date().toISOString(),
        }));

      if (nouveaux.length === 0) {
        setErreurImport('Aucun client valide trouvé. Vérifiez que la colonne "nom" existe.');
        return;
      }

      await importerClients(nouveaux);
    } catch (err) {
      setErreurImport('Erreur lors de la lecture du fichier Excel.');
    }
    e.target.value = '';
  };

  const jobsParClient = (clientId: string) =>
    items.filter(i => i.clientId === clientId);

  return (
    <div style={{ display: 'flex', height: '100%', background: '#f8fafc', overflow: 'hidden' }}>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        marginRight: selected ? 420 : 0, transition: 'margin-right 0.3s ease',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px', borderBottom: '2px solid #e5e7eb', background: 'white',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28 }}>👤</span>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#374151', margin: 0 }}>Clients</h1>
            <span style={{ background: '#3b82f6', color: 'white', fontSize: 13, fontWeight: 700, padding: '2px 10px', borderRadius: 12 }}>
              {clients.length} client{clients.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input type="text" placeholder="Rechercher..." value={recherche}
              onChange={e => setRecherche(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #e5e7eb', fontSize: 13, width: 200, outline: 'none' }} />
            <button onClick={() => setShowModalAjout(true)}
              style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#3b82f6', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              + Ajouter
            </button>
            <button onClick={() => fileRef.current?.click()}
              style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#1e293b', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              📥 Importer Excel
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }} onChange={handleImportExcel} />
          </div>
        </div>

        {erreurImport && (
          <div style={{ margin: '12px 24px 0', padding: '10px 16px', borderRadius: 8, background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', fontSize: 13, fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            ⚠️ {erreurImport}
            <button onClick={() => setErreurImport(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b', fontSize: 16 }}>✕</button>
          </div>
        )}

        {/* Table */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {clients.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: '#9ca3af' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>👤</div>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Aucun client pour l'instant</div>
              <div style={{ fontSize: 14, marginBottom: 20 }}>
                Cliquez sur <strong style={{ color: '#3b82f6' }}>+ Ajouter</strong> ou importez un fichier Excel
              </div>
              <div style={{ fontSize: 12, color: '#d1d5db' }}>
                Colonnes Excel : numero_compte, nom, telephone, email, contact, salesperson, adresse, notes
              </div>
            </div>
          ) : filtres.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
              <div style={{ fontSize: 14 }}>Aucun résultat pour cette recherche</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'white', zIndex: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  {['#', 'Nom', 'Contact', 'Téléphone', 'Email', 'Vendeur', 'Jobs', 'Date'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtres.map(c => {
                  const jobs = jobsParClient(c.id);
                  const jobsTermines = jobs.filter(j => j.etat === 'termine').length;
                  const jobsActifs = jobs.filter(j => j.etat !== 'termine').length;
                  const isSelected = selectedId === c.id;

                  return (
                    <tr key={c.id} onClick={() => setSelectedId(isSelected ? null : c.id)}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: isSelected ? '#eff6ff' : 'white',
                        borderLeft: isSelected ? '3px solid #3b82f6' : '3px solid transparent',
                        cursor: 'pointer', transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f8fafc'; }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'white'; }}
                    >
                      <td style={{ padding: '14px 16px', fontSize: 12, fontFamily: 'monospace', color: '#6b7280' }}>
                        {c.numeroCompte ?? '—'}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{c.nom}</div>
                        {c.adresse && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{c.adresse}</div>}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 13, color: '#6b7280' }}>
                        {c.contact ?? '—'}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 13, color: '#6b7280' }}>
                        {c.telephone ?? '—'}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 13, color: '#6b7280' }}>
                        {c.email ?? '—'}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 13, color: '#6b7280' }}>
                        {c.salesperson ?? '—'}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {jobsActifs > 0 && (
                            <span style={{ fontSize: 11, background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
                              {jobsActifs} actif{jobsActifs > 1 ? 's' : ''}
                            </span>
                          )}
                          {jobsTermines > 0 && (
                            <span style={{ fontSize: 11, background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
                              {jobsTermines} terminé{jobsTermines > 1 ? 's' : ''}
                            </span>
                          )}
                          {jobs.length === 0 && (
                            <span style={{ fontSize: 11, color: '#d1d5db' }}>Aucun job</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>
                          {new Date(c.dateCreation).toLocaleDateString('fr-CA')}
                        </span>
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
        <PanneauDetailClient
          client={selected}
          jobs={jobsParClient(selected.id)}
          onClose={() => setSelectedId(null)}
          onMettreAJour={mettreAJourClient}
          onSupprimer={() => { supprimerClient(selected.id); setSelectedId(null); }}
        />
      )}

      {showModalAjout && (
        <ModalAjoutClient
          onAjouter={async (c) => { await ajouterClient(c); setShowModalAjout(false); }}
          onClose={() => setShowModalAjout(false)}
        />
      )}
    </div>
  );
}

// ── Modal ajout client ────────────────────────────────────────

function ModalAjoutClient({ onAjouter, onClose }: {
  onAjouter: (c: Client) => Promise<void>;
  onClose: () => void;
}) {
  const [nom, setNom] = useState('');
  const [numeroCompte, setNumeroCompte] = useState('');
  const [telephone, setTelephone] = useState('');
  const [email, setEmail] = useState('');
  const [adresse, setAdresse] = useState('');
  const [contact, setContact] = useState('');
  const [salesperson, setSalesperson] = useState('');
  const [notes, setNotes] = useState('');

  const handleSauvegarder = async () => {
    if (!nom.trim()) return;
    await onAjouter({
      id: generateClientId(),
      numeroCompte: numeroCompte || undefined,
      nom: nom.trim(),
      telephone: telephone || undefined,
      email: email || undefined,
      adresse: adresse || undefined,
      contact: contact || undefined,
      salesperson: salesperson || undefined,
      notes: notes || undefined,
      dateCreation: new Date().toISOString(),
    });
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, width: 520, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}>

        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#111827' }}>👤 Nouveau client</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9ca3af' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 2 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Nom *</label>
              <input type="text" value={nom} onChange={e => setNom(e.target.value)}
                placeholder="Transport Tremblay" style={inputStyle} autoFocus />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Numéro de compte</label>
              <input type="text" value={numeroCompte} onChange={e => setNumeroCompte(e.target.value)}
                placeholder="8192" style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Téléphone</label>
              <input type="text" value={telephone} onChange={e => setTelephone(e.target.value)}
                placeholder="418-555-0123" style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Email</label>
              <input type="text" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="info@exemple.com" style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Contact</label>
              <input type="text" value={contact} onChange={e => setContact(e.target.value)}
                placeholder="Patrick Marcoux" style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Salesperson</label>
              <input type="text" value={salesperson} onChange={e => setSalesperson(e.target.value)}
                placeholder="rbeaudry" style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Adresse</label>
            <input type="text" value={adresse} onChange={e => setAdresse(e.target.value)}
              placeholder="123 rue Principale, Québec" style={inputStyle} />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Client régulier, paie à 30 jours..." rows={3}
              style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', background: '#fafafa' }}>
          <button onClick={onClose}
            style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: 13, color: '#374151' }}>
            Annuler
          </button>
          <button onClick={handleSauvegarder} disabled={!nom.trim()}
            style={{ padding: '10px 28px', borderRadius: 8, border: 'none', background: nom.trim() ? '#3b82f6' : '#e5e7eb', color: nom.trim() ? 'white' : '#9ca3af', fontWeight: 700, fontSize: 14, cursor: nom.trim() ? 'pointer' : 'not-allowed' }}>
            Ajouter le client
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Panneau détail client ─────────────────────────────────────

function PanneauDetailClient({ client, jobs, onClose, onMettreAJour, onSupprimer }: {
  client: Client;
  jobs: any[];
  onClose: () => void;
  onMettreAJour: (id: string, patch: Partial<Client>) => Promise<void>;
  onSupprimer: () => void;
}) {
  const [edition, setEdition] = useState(false);
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);
  const [form, setForm] = useState({
    nom: client.nom,
    numeroCompte: client.numeroCompte ?? '',
    telephone: client.telephone ?? '',
    email: client.email ?? '',
    adresse: client.adresse ?? '',
    contact: client.contact ?? '',
    salesperson: client.salesperson ?? '',
    notes: client.notes ?? '',
  });

  const jobsActifs   = jobs.filter(j => j.etat !== 'termine');
  const jobsTermines = jobs.filter(j => j.etat === 'termine');

  const handleSauvegarder = async () => {
    await onMettreAJour(client.id, {
      nom: form.nom,
      numeroCompte: form.numeroCompte || undefined,
      telephone: form.telephone || undefined,
      email: form.email || undefined,
      adresse: form.adresse || undefined,
      contact: form.contact || undefined,
      salesperson: form.salesperson || undefined,
      notes: form.notes || undefined,
    });
    setEdition(false);
  };

  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, width: 420, height: '100dvh',
      background: 'white', borderLeft: '1px solid #e5e7eb',
      boxShadow: '-4px 0 24px rgba(0,0,0,0.1)', overflowY: 'auto', zIndex: 150,
    }}>
      <div style={{ padding: 24 }}>
        <button onClick={onClose}
          style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>
          ✕
        </button>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          {client.numeroCompte && (
            <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#9ca3af', marginBottom: 4 }}>
              Compte #{client.numeroCompte}
            </div>
          )}
          <div style={{ fontSize: 26, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{client.nom}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {jobsActifs.length > 0 && (
              <span style={{ fontSize: 12, background: '#dbeafe', color: '#1e40af', padding: '3px 10px', borderRadius: 10, fontWeight: 700 }}>
                {jobsActifs.length} job{jobsActifs.length > 1 ? 's' : ''} actif{jobsActifs.length > 1 ? 's' : ''}
              </span>
            )}
            {jobsTermines.length > 0 && (
              <span style={{ fontSize: 12, background: '#dcfce7', color: '#166534', padding: '3px 10px', borderRadius: 10, fontWeight: 700 }}>
                {jobsTermines.length} terminé{jobsTermines.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Infos ou édition */}
        {!edition ? (
          <div style={{ marginBottom: 20, padding: 14, borderRadius: 10, background: '#f8fafc', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Coordonnées
              </div>
              <button onClick={() => setEdition(true)}
                style={{ fontSize: 11, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                ✏️ Modifier
              </button>
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 2 }}>
              {client.telephone   && <div>📞 {client.telephone}</div>}
              {client.email       && <div>✉️ {client.email}</div>}
              {client.adresse     && <div>📍 {client.adresse}</div>}
              {client.contact     && <div>👤 Contact : {client.contact}</div>}
              {client.salesperson && <div>💼 Vendeur : {client.salesperson}</div>}
              {client.notes       && (
                <div style={{ marginTop: 8, padding: '8px 10px', background: '#fef9c3', borderRadius: 6, fontSize: 12, color: '#713f12' }}>
                  📝 {client.notes}
                </div>
              )}
              {!client.telephone && !client.email && !client.adresse && !client.contact && !client.salesperson && !client.notes && (
                <div style={{ color: '#d1d5db', fontStyle: 'italic' }}>Aucune coordonnée</div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 20, padding: 14, borderRadius: 10, background: '#f8fafc', border: '1px solid #3b82f6', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Modifier les coordonnées
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 2 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>Nom *</label>
                <input type="text" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>N° compte</label>
                <input type="text" value={form.numeroCompte} onChange={e => setForm(f => ({ ...f, numeroCompte: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>Téléphone</label>
                <input type="text" value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>Email</label>
                <input type="text" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>Contact</label>
                <input type="text" value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>Salesperson</label>
                <input type="text" value={form.salesperson} onChange={e => setForm(f => ({ ...f, salesperson: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>Adresse</label>
              <input type="text" value={form.adresse} onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEdition(false)}
                style={{ flex: 1, padding: '8px', borderRadius: 6, border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>
                Annuler
              </button>
              <button onClick={handleSauvegarder}
                style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: '#3b82f6', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
                Sauvegarder
              </button>
            </div>
          </div>
        )}

        {/* Historique jobs */}
        {jobs.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Historique — {jobs.length} job{jobs.length > 1 ? 's' : ''}
            </div>
            {[...jobsActifs, ...jobsTermines].map(j => {
              const etatCfg = {
                'en-attente': { bg: '#fef3c7', color: '#92400e', label: 'En attente' },
                'en-slot':    { bg: '#dbeafe', color: '#1e40af', label: 'En slot' },
                'termine':    { bg: '#dcfce7', color: '#166534', label: 'Terminé' },
              }[j.etat] || { bg: '#f3f4f6', color: '#374151', label: j.etat };
              return (
                <div key={j.id} style={{
                  padding: '10px 12px', borderRadius: 8, marginBottom: 8,
                  border: '1px solid #e5e7eb', background: '#f8fafc',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      #{j.numero} — {j.descriptionTravail ?? j.label}
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                      {new Date(j.dateCreation).toLocaleDateString('fr-CA')}
                      {j.vehicule && ` · ${j.vehicule}`}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, background: etatCfg.bg, color: etatCfg.color, padding: '2px 8px', borderRadius: 10, fontWeight: 700, flexShrink: 0 }}>
                    {etatCfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {jobs.length === 0 && (
          <div style={{ marginBottom: 20, textAlign: 'center', padding: '20px 0', color: '#9ca3af', fontSize: 13, fontStyle: 'italic' }}>
            Aucun job pour ce client
          </div>
        )}

        {/* Supprimer */}
        <div style={{ borderTop: '1px solid #fee2e2', paddingTop: 16 }}>
          {!confirmerSuppression ? (
            <button onClick={() => setConfirmerSuppression(true)}
              style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #fca5a5', background: 'transparent', color: '#ef4444', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              🗑 Supprimer ce client
            </button>
          ) : (
            <div style={{ background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#991b1b', marginBottom: 6 }}>⚠️ Confirmer la suppression?</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14 }}>
                L'historique des jobs sera conservé mais le client sera retiré de la base.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setConfirmerSuppression(false)}
                  style={{ flex: 1, padding: '8px', borderRadius: 6, border: '1px solid #d1d5db', background: 'white', color: '#374151', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>
                  Annuler
                </button>
                <button onClick={onSupprimer}
                  style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: '#ef4444', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
                  🗑 Supprimer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}