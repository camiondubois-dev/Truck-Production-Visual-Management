// ════════════════════════════════════════════════════════════════
// LocationsManager — Modal de gestion des contrats de location
// CRUD complet : créer, éditer, terminer, supprimer
// ════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { locationService, type LocationAvecCumul } from '../services/locationService';
import { vendeurService, type Vendeur } from '../services/vendeurService';

const fmt$ = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);

interface FormState {
  id?:            string;
  stockNumero:    string;
  client:         string;
  vendeurId:      string;
  dateDebut:      string;
  dateFin:        string;
  montantMensuel: string;
  notes:          string;
}

const FORM_VIDE: FormState = {
  stockNumero: '', client: '', vendeurId: '',
  dateDebut: new Date().toISOString().slice(0, 10),
  dateFin: '', montantMensuel: '', notes: '',
};

export function LocationsManager({ onClose, stockInitial }: { onClose: () => void; stockInitial?: string }) {
  const [locations, setLocations] = useState<LocationAvecCumul[]>([]);
  const [vendeurs,  setVendeurs]  = useState<Vendeur[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [form,      setForm]      = useState<FormState>(FORM_VIDE);
  const [editMode,  setEditMode]  = useState<'create' | 'edit' | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [erreur,    setErreur]    = useState<string | null>(null);
  const [filtre,    setFiltre]    = useState<'tous' | 'actifs' | 'termines'>('actifs');

  // Si stockInitial est fourni → ouvre directement le formulaire de création pré-rempli
  useEffect(() => {
    if (stockInitial) {
      setForm({ ...FORM_VIDE, stockNumero: stockInitial, dateDebut: new Date().toISOString().slice(0, 10) });
      setEditMode('create');
    }
  }, [stockInitial]);

  const charger = async () => {
    setLoading(true);
    try {
      const [locs, vds] = await Promise.all([
        locationService.getAll(),
        vendeurService.getAll(),
      ]);
      setLocations(locs);
      setVendeurs(vds);
    } catch (e: any) {
      console.error(e);
      setErreur(e.message ?? 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { charger(); }, []);

  const filtrees = locations.filter(l =>
    filtre === 'tous'     ? true :
    filtre === 'actifs'   ? l.actif :
    /* termines */          !l.actif
  );

  const ouvrirCreation = () => {
    setForm({ ...FORM_VIDE, dateDebut: new Date().toISOString().slice(0, 10) });
    setEditMode('create');
    setErreur(null);
  };

  const ouvrirEdition = (l: LocationAvecCumul) => {
    setForm({
      id:             l.id,
      stockNumero:    l.stockNumero,
      client:         l.client ?? '',
      vendeurId:      l.vendeurId ?? '',
      dateDebut:      l.dateDebut,
      dateFin:        l.dateFin ?? '',
      montantMensuel: String(l.montantMensuel),
      notes:          l.notes ?? '',
    });
    setEditMode('edit');
    setErreur(null);
  };

  const fermerForm = () => { setEditMode(null); setErreur(null); };

  const sauvegarder = async () => {
    setErreur(null);
    if (!form.stockNumero.trim())     { setErreur('Numéro de stock requis'); return; }
    if (!form.dateDebut)              { setErreur('Date de début requise'); return; }
    const montant = parseFloat(form.montantMensuel);
    if (!Number.isFinite(montant) || montant <= 0) { setErreur('Montant mensuel invalide'); return; }

    setSaving(true);
    try {
      if (editMode === 'create') {
        await locationService.creer({
          stockNumero:    form.stockNumero.trim(),
          client:         form.client.trim() || null,
          vendeurId:      form.vendeurId || null,
          dateDebut:      form.dateDebut,
          montantMensuel: montant,
          notes:          form.notes.trim() || null,
        });
      } else if (editMode === 'edit' && form.id) {
        await locationService.modifier(form.id, {
          client:         form.client.trim() || null,
          vendeurId:      form.vendeurId || null,
          dateDebut:      form.dateDebut,
          dateFin:        form.dateFin || null,
          montantMensuel: montant,
          notes:          form.notes.trim() || null,
        });
      }
      await charger();
      fermerForm();
    } catch (e: any) {
      console.error(e);
      const msg = e?.message?.includes('uq_locations_actif_unique')
        ? 'Ce camion a déjà un contrat actif. Termine-le d\'abord (mets une date de fin).'
        : (e?.message ?? 'Erreur sauvegarde');
      setErreur(msg);
    } finally {
      setSaving(false);
    }
  };

  const terminer = async (l: LocationAvecCumul) => {
    if (!confirm(`Terminer la location du camion #${l.stockNumero} aujourd'hui ?`)) return;
    try {
      await locationService.terminer(l.id);
      await charger();
    } catch (e: any) {
      alert('Erreur : ' + (e.message ?? e));
    }
  };

  const supprimer = async (l: LocationAvecCumul) => {
    if (!confirm(`Supprimer le contrat #${l.stockNumero} ? Cette action est définitive.`)) return;
    try {
      await locationService.supprimer(l.id);
      await charger();
    } catch (e: any) {
      alert('Erreur : ' + (e.message ?? e));
    }
  };

  const vendeurNom = (id: string | null) =>
    id ? (vendeurs.find(v => v.id === id)?.nom ?? '—') : '—';

  // ─── Formulaire ───────────────────────────────────────────────
  if (editMode) {
    return (
      <Overlay onClose={fermerForm}>
        <Modal>
          <Header titre={editMode === 'create' ? '➕ Nouveau contrat de location' : `✏️ Contrat #${form.stockNumero}`} onClose={fermerForm} />
          <div style={{ padding: 20, display: 'grid', gap: 14 }}>
            <Champ label="Numéro de stock *">
              <input
                type="text"
                value={form.stockNumero}
                onChange={e => setForm(f => ({ ...f, stockNumero: e.target.value }))}
                disabled={editMode === 'edit'}
                style={inputStyle}
                placeholder="Ex: 35313"
              />
            </Champ>
            <Champ label="Client (loueur)">
              <input
                type="text"
                value={form.client}
                onChange={e => setForm(f => ({ ...f, client: e.target.value }))}
                style={inputStyle}
                placeholder="Nom du client"
              />
            </Champ>
            <Champ label="Vendeur">
              <select
                value={form.vendeurId}
                onChange={e => setForm(f => ({ ...f, vendeurId: e.target.value }))}
                style={inputStyle}
              >
                <option value="">— Aucun —</option>
                {vendeurs.filter(v => v.actif).map(v => (
                  <option key={v.id} value={v.id}>{v.nom}</option>
                ))}
              </select>
            </Champ>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Champ label="Date de début *">
                <input
                  type="date"
                  value={form.dateDebut}
                  onChange={e => setForm(f => ({ ...f, dateDebut: e.target.value }))}
                  style={inputStyle}
                />
              </Champ>
              {editMode === 'edit' && (
                <Champ label="Date de fin (vide = en cours)">
                  <input
                    type="date"
                    value={form.dateFin}
                    onChange={e => setForm(f => ({ ...f, dateFin: e.target.value }))}
                    style={inputStyle}
                  />
                </Champ>
              )}
            </div>
            <Champ label="Montant mensuel ($) *">
              <input
                type="number"
                step="0.01"
                value={form.montantMensuel}
                onChange={e => setForm(f => ({ ...f, montantMensuel: e.target.value }))}
                style={inputStyle}
                placeholder="Ex: 2500"
              />
            </Champ>
            <Champ label="Notes">
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                style={{ ...inputStyle, height: 60, resize: 'vertical' }}
                placeholder="Optionnel"
              />
            </Champ>

            {erreur && (
              <div style={{ padding: 10, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 8, color: '#fca5a5', fontSize: 13 }}>
                ⚠️ {erreur}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button onClick={fermerForm} disabled={saving} style={{ ...btnStyle, background: 'rgba(255,255,255,0.06)' }}>
                Annuler
              </button>
              <button onClick={sauvegarder} disabled={saving} style={{ ...btnStyle, background: '#8b5cf6', flex: 1 }}>
                {saving ? 'Sauvegarde…' : (editMode === 'create' ? 'Créer' : 'Sauvegarder')}
              </button>
            </div>
          </div>
        </Modal>
      </Overlay>
    );
  }

  // ─── Liste ────────────────────────────────────────────────────
  return (
    <Overlay onClose={onClose}>
      <Modal large>
        <Header titre="🔁 Gestion des locations" onClose={onClose} />
        <div style={{ padding: 16, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['actifs', 'termines', 'tous'] as const).map(f => (
              <button key={f} onClick={() => setFiltre(f)} style={{
                padding: '8px 14px', borderRadius: 8, border: 'none',
                background: filtre === f ? '#8b5cf6' : 'rgba(255,255,255,0.08)',
                color: 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                textTransform: 'capitalize',
              }}>
                {f}
              </button>
            ))}
          </div>
          <button onClick={ouvrirCreation} style={{ ...btnStyle, background: '#22c55e', padding: '8px 16px' }}>
            + Nouveau contrat
          </button>
        </div>

        <div style={{ padding: 16, maxHeight: '60vh', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: 30 }}>Chargement…</div>
          ) : filtrees.length === 0 ? (
            <div style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: 30 }}>
              Aucun contrat {filtre === 'actifs' ? 'actif' : filtre === 'termines' ? 'terminé' : ''}.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, textTransform: 'uppercase' }}>
                  <th style={thStyle}>Stock</th>
                  <th style={thStyle}>Client</th>
                  <th style={thStyle}>Vendeur</th>
                  <th style={thStyle}>Début</th>
                  <th style={thStyle}>Fin</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Mensuel</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Mois</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Cumulé</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {filtrees.map(l => (
                  <tr key={l.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={tdStyle}><span style={{ color: l.actif ? '#a78bfa' : 'rgba(255,255,255,0.4)', fontWeight: 700 }}>#{l.stockNumero}</span></td>
                    <td style={tdStyle}>{l.client ?? '—'}</td>
                    <td style={tdStyle}>{vendeurNom(l.vendeurId)}</td>
                    <td style={tdStyle}>{l.dateDebut}</td>
                    <td style={tdStyle}>{l.dateFin ?? <span style={{ color: '#a78bfa', fontWeight: 700 }}>En cours</span>}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt$(l.montantMensuel)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{l.moisEcoules}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: '#22c55e', fontWeight: 700 }}>{fmt$(l.revenuCumule)}</td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                      <button onClick={() => ouvrirEdition(l)} title="Éditer" style={iconBtn}>✏️</button>
                      {l.actif && <button onClick={() => terminer(l)} title="Terminer aujourd'hui" style={iconBtn}>⏹️</button>}
                      <button onClick={() => supprimer(l)} title="Supprimer" style={iconBtn}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Modal>
    </Overlay>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      {children}
    </div>
  );
}

function Modal({ children, large }: { children: React.ReactNode; large?: boolean }) {
  return (
    <div onClick={e => e.stopPropagation()} style={{
      width: '100%', maxWidth: large ? 980 : 480,
      maxHeight: '90vh', background: '#1a1a2e',
      border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, overflow: 'hidden',
      display: 'flex', flexDirection: 'column', color: 'white',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {children}
    </div>
  );
}

function Header({ titre, onClose }: { titre: string; onClose: () => void }) {
  return (
    <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 800 }}>{titre}</div>
      <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: 14, cursor: 'pointer' }}>✕</button>
    </div>
  );
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'white',
  fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box',
};

const btnStyle: React.CSSProperties = {
  padding: '10px 16px', borderRadius: 10, border: 'none', color: 'white',
  fontWeight: 700, fontSize: 14, cursor: 'pointer',
};

const thStyle: React.CSSProperties = {
  padding: '8px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.1)',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 10px', color: 'rgba(255,255,255,0.85)',
};

const iconBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 6, padding: '4px 8px', cursor: 'pointer', marginLeft: 4, fontSize: 14,
};
