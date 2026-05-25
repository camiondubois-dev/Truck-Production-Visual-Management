// ════════════════════════════════════════════════════════════════
// VueEmployes — Gestion des employés du module Main-d'œuvre
//
// CRUD complet : créer, éditer, désactiver, supprimer.
// Le taux_horaire entré ici servira à calculer le coût M.O. réel
// dans les analyses de profitabilité.
// ════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react';
import { employeService, type Employe, DEPARTEMENTS_SUGGEREES } from '../services/mainOeuvreService';

const fmt$ = (n: number) =>
  new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 2 }).format(n);

type FormState = {
  id?:          string;
  nom:          string;
  codeHitrac:   string;
  departement:  string;
  tauxHoraire:  string;
  notes:        string;
};

const FORM_VIDE: FormState = {
  nom: '', codeHitrac: '', departement: '', tauxHoraire: '', notes: '',
};

export function VueEmployes() {
  const [employes, setEmployes] = useState<Employe[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [filtre,   setFiltre]   = useState<'tous' | 'actifs' | 'inactifs'>('actifs');
  const [filtreDept, setFiltreDept] = useState<string>('');
  const [recherche, setRecherche] = useState('');
  const [editForm, setEditForm] = useState<FormState | null>(null);
  const [editMode, setEditMode] = useState<'create' | 'edit' | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [erreur,   setErreur]   = useState<string | null>(null);

  const charger = async () => {
    setLoading(true);
    try {
      const data = await employeService.getAll();
      setEmployes(data);
    } catch (e: any) {
      setErreur(e.message ?? 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { charger(); }, []);

  const departements = useMemo(() => {
    const set = new Set<string>();
    for (const e of employes) if (e.departement) set.add(e.departement);
    return Array.from(set).sort();
  }, [employes]);

  const filtres = useMemo(() => {
    let r = employes;
    if (filtre === 'actifs')   r = r.filter(e => e.actif);
    if (filtre === 'inactifs') r = r.filter(e => !e.actif);
    if (filtreDept) r = r.filter(e => e.departement === filtreDept);
    const q = recherche.trim().toLowerCase();
    if (q) r = r.filter(e =>
      e.nom.toLowerCase().includes(q) ||
      (e.codeHitrac ?? '').toLowerCase().includes(q)
    );
    return r;
  }, [employes, filtre, filtreDept, recherche]);

  const totaux = useMemo(() => {
    const actifsList = employes.filter(e => e.actif);
    const tauxMoyen = actifsList.length > 0
      ? actifsList.reduce((s, e) => s + e.tauxHoraire, 0) / actifsList.length
      : 0;
    return {
      total:   employes.length,
      actifs:  actifsList.length,
      inactifs: employes.length - actifsList.length,
      tauxMoyen,
    };
  }, [employes]);

  // ─── Edition ──
  const ouvrirCreation = () => {
    setEditForm({ ...FORM_VIDE });
    setEditMode('create');
    setErreur(null);
  };

  const ouvrirEdition = (e: Employe) => {
    setEditForm({
      id:          e.id,
      nom:         e.nom,
      codeHitrac:  e.codeHitrac ?? '',
      departement: e.departement ?? '',
      tauxHoraire: String(e.tauxHoraire),
      notes:       e.notes ?? '',
    });
    setEditMode('edit');
    setErreur(null);
  };

  const fermerForm = () => { setEditMode(null); setEditForm(null); setErreur(null); };

  const sauvegarder = async () => {
    if (!editForm) return;
    setErreur(null);
    if (!editForm.nom.trim()) { setErreur('Nom requis'); return; }
    const taux = parseFloat(editForm.tauxHoraire);
    if (!Number.isFinite(taux) || taux < 0) { setErreur('Taux horaire invalide'); return; }

    setSaving(true);
    try {
      if (editMode === 'create') {
        await employeService.creer({
          nom:          editForm.nom,
          codeHitrac:   editForm.codeHitrac.trim() || null,
          departement:  editForm.departement.trim() || null,
          tauxHoraire:  taux,
          notes:        editForm.notes.trim() || null,
        });
      } else if (editMode === 'edit' && editForm.id) {
        await employeService.modifier(editForm.id, {
          nom:          editForm.nom,
          codeHitrac:   editForm.codeHitrac.trim() || null,
          departement:  editForm.departement.trim() || null,
          tauxHoraire:  taux,
          notes:        editForm.notes.trim() || null,
        });
      }
      await charger();
      fermerForm();
    } catch (e: any) {
      const msg = e?.message?.includes('duplicate key')
        ? 'Ce code iTrac est déjà utilisé par un autre employé.'
        : (e?.message ?? 'Erreur sauvegarde');
      setErreur(msg);
    } finally {
      setSaving(false);
    }
  };

  const toggleActif = async (e: Employe) => {
    try {
      await employeService.modifier(e.id, { actif: !e.actif });
      await charger();
    } catch (err: any) {
      alert('Erreur : ' + (err.message ?? err));
    }
  };

  const supprimer = async (e: Employe) => {
    if (!confirm(`Supprimer définitivement ${e.nom} ? Cette action est irréversible.\n(Ne fonctionnera pas s'il y a des heures pointées pour cet employé.)`)) return;
    try {
      await employeService.supprimer(e.id);
      await charger();
    } catch (err: any) {
      alert(`Impossible de supprimer : ${err.message ?? err}\n\nAstuce : si l'employé a des heures pointées, désactive-le plutôt.`);
    }
  };

  // ─── Rendu : formulaire ──
  if (editMode && editForm) {
    return (
      <div style={{ padding: 24, height: '100%', overflowY: 'auto', background: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <button onClick={fermerForm} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize: 13 }}>← Retour</button>
            <h2 style={{ margin: 0, fontSize: 20, color: '#111827' }}>
              {editMode === 'create' ? '➕ Nouvel employé' : `✏️ ${editForm.nom}`}
            </h2>
          </div>

          <div style={{ background: 'white', borderRadius: 12, padding: 24, border: '1px solid #e5e7eb', display: 'grid', gap: 16 }}>
            <Champ label="Nom complet *">
              <input
                type="text"
                value={editForm.nom}
                onChange={ev => setEditForm({ ...editForm, nom: ev.target.value })}
                style={inputStyle}
                placeholder="Ex: Dany Leblanc"
                autoFocus
              />
            </Champ>

            <Champ label="Code iTrac (utilisé dans les exports CSV)">
              <input
                type="text"
                value={editForm.codeHitrac}
                onChange={ev => setEditForm({ ...editForm, codeHitrac: ev.target.value })}
                style={inputStyle}
                placeholder="Ex: dleblanc, DL01"
              />
            </Champ>

            <Champ label="Département">
              <input
                type="text"
                list="dept-suggestions"
                value={editForm.departement}
                onChange={ev => setEditForm({ ...editForm, departement: ev.target.value })}
                style={inputStyle}
                placeholder="Ex: Mécanique"
              />
              <datalist id="dept-suggestions">
                {DEPARTEMENTS_SUGGEREES.map(d => <option key={d} value={d} />)}
              </datalist>
            </Champ>

            <Champ label="Taux horaire ($/h) — coût employeur réel (avec charges) *">
              <input
                type="number"
                step="0.01"
                min="0"
                value={editForm.tauxHoraire}
                onChange={ev => setEditForm({ ...editForm, tauxHoraire: ev.target.value })}
                style={inputStyle}
                placeholder="Ex: 45.50"
              />
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                💡 Conseil : salaire horaire × ~1.35 pour inclure les charges (CSST, RRQ, AE, vacances).
              </div>
            </Champ>

            <Champ label="Notes">
              <textarea
                value={editForm.notes}
                onChange={ev => setEditForm({ ...editForm, notes: ev.target.value })}
                style={{ ...inputStyle, height: 60, resize: 'vertical' }}
                placeholder="Optionnel"
              />
            </Champ>

            {erreur && (
              <div style={{ padding: 12, background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, color: '#991b1b', fontSize: 13 }}>
                ⚠️ {erreur}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button onClick={fermerForm} disabled={saving} style={{ ...btnStyle, background: 'white', color: '#374151', border: '1px solid #e5e7eb' }}>
                Annuler
              </button>
              <button onClick={sauvegarder} disabled={saving} style={{ ...btnStyle, background: '#22c55e', color: 'white', flex: 1 }}>
                {saving ? 'Sauvegarde…' : (editMode === 'create' ? '➕ Créer' : '💾 Sauvegarder')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Rendu : liste ──
  return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto', background: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>👥 MAIN-D'ŒUVRE</div>
          <h1 style={{ margin: 0, fontSize: 24, color: '#111827' }}>Employés</h1>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            Gestion des employés et de leur taux horaire. Sert au calcul du vrai coût main-d'œuvre par camion.
          </div>
        </div>
        <button onClick={ouvrirCreation} style={{ ...btnStyle, background: '#22c55e', color: 'white' }}>
          ➕ Nouvel employé
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        <Kpi label="Total" value={String(totaux.total)} />
        <Kpi label="Actifs"    value={String(totaux.actifs)}   color="#22c55e" />
        <Kpi label="Inactifs"  value={String(totaux.inactifs)} color="#9ca3af" />
        <Kpi label="Taux moyen" value={fmt$(totaux.tauxMoyen)} color="#f59e0b" />
      </div>

      {/* Filtres */}
      <div style={{ background: 'white', borderRadius: 10, padding: 12, marginBottom: 16, border: '1px solid #e5e7eb', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
          placeholder="🔍 Rechercher par nom ou code iTrac…"
          style={{ flex: 1, minWidth: 200, padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13, outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          {(['actifs', 'tous', 'inactifs'] as const).map(f => (
            <button key={f} onClick={() => setFiltre(f)} style={{
              padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: filtre === f ? '#3b82f6' : '#f3f4f6',
              color:      filtre === f ? 'white' : '#6b7280',
              fontSize: 12, fontWeight: 600, textTransform: 'capitalize',
            }}>{f}</button>
          ))}
        </div>
        {departements.length > 0 && (
          <select value={filtreDept} onChange={e => setFiltreDept(e.target.value)}
            style={{ padding: '7px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12, background: 'white', cursor: 'pointer' }}>
            <option value="">Tous départements</option>
            {departements.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
      </div>

      {/* Liste */}
      <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Chargement…</div>
        ) : filtres.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
            {recherche || filtreDept ? 'Aucun employé ne correspond aux filtres.' : 'Aucun employé. Clique ➕ pour en créer un.'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb', color: '#6b7280', fontSize: 11, textTransform: 'uppercase' }}>
                <th style={th}>Statut</th>
                <th style={th}>Nom</th>
                <th style={th}>Code iTrac</th>
                <th style={th}>Département</th>
                <th style={{ ...th, textAlign: 'right' }}>Taux/h</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {filtres.map(e => (
                <tr key={e.id} style={{ borderTop: '1px solid #f3f4f6', opacity: e.actif ? 1 : 0.55 }}>
                  <td style={td}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                      background: e.actif ? '#dcfce7' : '#f3f4f6',
                      color:      e.actif ? '#166534' : '#6b7280',
                    }}>
                      {e.actif ? '✅ Actif' : '⏸ Inactif'}
                    </span>
                  </td>
                  <td style={{ ...td, fontWeight: 700, color: '#111827' }}>{e.nom}</td>
                  <td style={{ ...td, fontFamily: 'monospace', color: '#6b7280' }}>{e.codeHitrac ?? '—'}</td>
                  <td style={td}>{e.departement ?? '—'}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#f59e0b' }}>{fmt$(e.tauxHoraire)}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <button onClick={() => ouvrirEdition(e)} style={iconBtn} title="Éditer">✏️</button>
                    <button onClick={() => toggleActif(e)} style={iconBtn} title={e.actif ? 'Désactiver' : 'Réactiver'}>
                      {e.actif ? '⏸' : '▶'}
                    </button>
                    <button onClick={() => supprimer(e)} style={{ ...iconBtn, color: '#ef4444' }} title="Supprimer">🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Sous-composants ─────────────────────────────────────────────

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: '#374151', marginBottom: 6, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: color ?? '#111827' }}>{value}</div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb',
  borderRadius: 8, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box',
  outline: 'none', background: 'white',
};

const btnStyle: React.CSSProperties = {
  padding: '10px 16px', borderRadius: 8, border: 'none',
  fontWeight: 700, fontSize: 13, cursor: 'pointer',
};

const th: React.CSSProperties = {
  padding: '10px 12px', textAlign: 'left', fontWeight: 600,
};
const td: React.CSSProperties = {
  padding: '12px',
};
const iconBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  fontSize: 16, padding: '4px 8px', marginLeft: 4,
};
