// ════════════════════════════════════════════════════════════════
// VueUtilisateurs — Gestion des utilisateurs et de leurs rôles
//
// EXCLUSIF AU RÔLE 'admin' (super-admin)
// Permet de :
//   - Voir tous les utilisateurs et leurs rôles
//   - Changer le rôle d'un utilisateur (avec confirmation)
//   - Activer/désactiver un compte
// ════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { type Role, ROLE_LABELS } from '../lib/permissions';

interface Utilisateur {
  id:              string;
  email:           string;
  nom:             string | null;
  role:            Role;
  departement:     string | null;
  actif:           boolean;
  onglets_import:  string | null;
}

// ── Presets pour la restriction d'onglets d'import ──────────────────────────
const IMPORT_PRESETS: { label: string; value: string | null }[] = [
  { label: '🔓 Tous les onglets',           value: null },
  { label: '📅 Agendrix seulement',          value: 'agendrix' },
  { label: '📥 Tout sauf Agendrix',
    value: 'couts,ventes_eau_detail,ventes_exportation,ventes_encan,ventes_pieces,labor_log' },
];

/** Rôles qui ont accès à l'onglet Import (selon canImport dans permissions.ts) */
const ROLES_IMPORT: Role[] = ['admin', 'gestion', 'vendeur'];


const ROLE_COULEURS: Record<Role, string> = {
  admin:         '#dc2626',  // rouge — exclusif
  gestion:       '#22c55e',
  planification: '#0ea5e9',
  vendeur:       '#a78bfa',
  employe:       '#6b7280',
  tv:            '#f59e0b',
};

const ROLE_EMOJIS: Record<Role, string> = {
  admin:         '🔑',
  gestion:       '👔',
  planification: '📋',
  vendeur:       '💰',
  employe:       '🔧',
  tv:            '📺',
};

export function VueUtilisateurs() {
  const { profile } = useAuth();
  const [users, setUsers]         = useState<Utilisateur[]>([]);
  const [loading, setLoading]     = useState(true);
  const [erreur, setErreur]       = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');
  const [filtreRole, setFiltreRole] = useState<'tous' | Role>('tous');
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser]     = useState({ id: '', email: '', nom: '', role: 'employe' as Role });

  const charger = async () => {
    setLoading(true);
    setErreur(null);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, nom, role, departement, actif, onglets_import')
        .order('role', { ascending: true })
        .order('nom',  { ascending: true });
      if (error) throw error;
      setUsers((data ?? []) as Utilisateur[]);
    } catch (e: any) {
      setErreur(e.message ?? 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { charger(); }, []);

  // ─── Garde d'accès : admin uniquement ─────────────────────────
  if (profile?.role !== 'admin') {
    return (
      <div style={{
        padding: 40, height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 12,
        background: '#f8fafc', color: '#6b7280', fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <div style={{ fontSize: 56 }}>🔒</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#374151' }}>Accès Super-Admin requis</div>
        <div style={{ fontSize: 14, textAlign: 'center', maxWidth: 400 }}>
          La gestion des utilisateurs est exclusive au rôle <strong>admin</strong>.<br/>
          Seul un super-administrateur peut changer les rôles des autres comptes.
        </div>
      </div>
    );
  }

  // ─── Liste filtrée ──
  const filtres = useMemo(() => {
    let r = users;
    if (filtreRole !== 'tous') r = r.filter(u => u.role === filtreRole);
    const q = recherche.trim().toLowerCase();
    if (q) {
      r = r.filter(u =>
        u.email.toLowerCase().includes(q) ||
        (u.nom ?? '').toLowerCase().includes(q)
      );
    }
    return r;
  }, [users, filtreRole, recherche]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { tous: users.length };
    for (const u of users) c[u.role] = (c[u.role] ?? 0) + 1;
    return c;
  }, [users]);

  const changerRole = async (u: Utilisateur, nouveauRole: Role) => {
    if (nouveauRole === u.role) return;
    const msg = `Changer le rôle de ${u.nom ?? u.email} de "${ROLE_LABELS[u.role]}" à "${ROLE_LABELS[nouveauRole]}" ?`;
    if (nouveauRole === 'admin') {
      if (!confirm(`⚠️ ATTENTION ⚠️\n\nTu es sur le point d'accorder les droits ADMIN à ${u.nom ?? u.email}.\nCet utilisateur pourra :\n- Modifier tous les rôles (y compris le tien)\n- Accéder à toutes les données financières\n- Gérer les utilisateurs\n\nConfirmer ?`)) return;
    } else if (!confirm(msg)) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: nouveauRole })
        .eq('id', u.id);
      if (error) throw error;
      await charger();
    } catch (e: any) {
      alert('Erreur : ' + (e.message ?? e));
    }
  };

  const toggleActif = async (u: Utilisateur) => {
    if (!confirm(`${u.actif ? 'Désactiver' : 'Réactiver'} le compte de ${u.nom ?? u.email} ?`)) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ actif: !u.actif })
        .eq('id', u.id);
      if (error) throw error;
      await charger();
    } catch (e: any) {
      alert('Erreur : ' + (e.message ?? e));
    }
  };

  const changerOngletsImport = async (u: Utilisateur, valeur: string | null) => {
    if (valeur === u.onglets_import) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ onglets_import: valeur })
        .eq('id', u.id);
      if (error) throw error;
      await charger();
    } catch (e: any) {
      alert('Erreur : ' + (e.message ?? e));
    }
  };

  const creerProfil = async () => {
    const { id, email, nom, role } = newUser;
    if (!id.trim() || !email.trim()) {
      alert('UUID et email sont obligatoires.');
      return;
    }
    try {
      const { error } = await supabase
        .from('profiles')
        .insert({ id: id.trim(), email: email.trim().toLowerCase(), nom: nom.trim() || null, role, actif: true });
      if (error) {
        // Afficher un message clair selon le type d'erreur
        if (error.code === '42501' || error.message?.includes('row-level security')) {
          alert('❌ Accès refusé par Supabase (RLS).\n\nTu dois d\'abord exécuter le fichier SQL :\nsql/2026-05-26_fix_rls_admin_et_trigger_profil.sql\n\ndans Supabase → SQL Editor.');
        } else if (error.code === '23503') {
          alert('❌ UUID invalide.\n\nCet UUID n\'existe pas dans Supabase Auth.\nVa dans Supabase → Authentication → Users,\ntrouve l\'utilisateur et copie son UUID exact.');
        } else if (error.code === '23505') {
          alert('⚠️ Ce profil existe déjà dans la table profiles.\n\nRafraîchis la liste, il devrait apparaître.');
        } else {
          alert('❌ Erreur Supabase :\n\nCode : ' + error.code + '\nMessage : ' + error.message);
        }
        return;
      }
      setShowCreate(false);
      setNewUser({ id: '', email: '', nom: '', role: 'employe' });
      await charger();
    } catch (e: any) {
      alert('Erreur inattendue : ' + (e.message ?? String(e)));
    }
  };

  const monId = profile.id;

  return (
    <div style={{
      padding: 24, height: '100%', overflowY: 'auto', background: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>🔑 SUPER-ADMIN</div>
          <h1 style={{ margin: 0, fontSize: 24, color: '#111827' }}>Gestion des utilisateurs</h1>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            Changer les rôles, activer/désactiver les comptes. <strong>Action sensible.</strong>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(v => !v)}
          style={{
            padding: '9px 18px', background: '#2563eb', color: 'white',
            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
            cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          ➕ Créer un profil
        </button>
      </div>

      {/* ── Formulaire création manuelle de profil ── */}
      {showCreate && (
        <div style={{
          background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10,
          padding: 16, marginBottom: 16,
        }}>
          <div style={{ fontWeight: 700, color: '#1e40af', marginBottom: 10, fontSize: 14 }}>
            ➕ Créer un profil manuellement
          </div>
          <div style={{ fontSize: 12, color: '#3b82f6', marginBottom: 12, lineHeight: 1.5 }}>
            Pour créer un nouveau compte :<br/>
            1. Va dans <strong>Supabase → Authentication → Users → Add user</strong><br/>
            2. Entre l'email et un mot de passe temporaire<br/>
            3. Copie l'<strong>UUID</strong> affiché et colle-le ci-dessous
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>UUID (Supabase Auth)</label>
              <input
                value={newUser.id}
                onChange={e => setNewUser(v => ({ ...v, id: e.target.value }))}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                style={{ padding: '6px 10px', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 12, fontFamily: 'monospace', width: 300 }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Email</label>
              <input
                value={newUser.email}
                onChange={e => setNewUser(v => ({ ...v, email: e.target.value }))}
                placeholder="prenom@camiondubois.com"
                style={{ padding: '6px 10px', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 12, width: 220 }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Nom complet</label>
              <input
                value={newUser.nom}
                onChange={e => setNewUser(v => ({ ...v, nom: e.target.value }))}
                placeholder="Prénom Nom"
                style={{ padding: '6px 10px', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 12, width: 160 }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Rôle initial</label>
              <select
                value={newUser.role}
                onChange={e => setNewUser(v => ({ ...v, role: e.target.value as Role }))}
                style={{ padding: '6px 10px', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 12 }}
              >
                {(['admin', 'gestion', 'planification', 'vendeur', 'employe', 'tv'] as Role[]).map(r => (
                  <option key={r} value={r}>{ROLE_EMOJIS[r]} {ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <button
              onClick={creerProfil}
              style={{ padding: '7px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              Créer
            </button>
            <button
              onClick={() => setShowCreate(false)}
              style={{ padding: '7px 12px', background: 'transparent', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div style={{ background: 'white', borderRadius: 10, padding: 12, marginBottom: 16, border: '1px solid #e5e7eb', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
          placeholder="🔍 Rechercher par email ou nom…"
          style={{ flex: 1, minWidth: 200, padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 13, outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <FiltreBtn label={`Tous (${counts.tous})`} actif={filtreRole === 'tous'} onClick={() => setFiltreRole('tous')} />
          {(['admin', 'gestion', 'planification', 'vendeur', 'employe', 'tv'] as Role[]).map(r => counts[r] > 0 && (
            <FiltreBtn key={r}
              label={`${ROLE_EMOJIS[r]} ${ROLE_LABELS[r]} (${counts[r]})`}
              actif={filtreRole === r}
              onClick={() => setFiltreRole(r)}
              color={ROLE_COULEURS[r]}
            />
          ))}
        </div>
      </div>

      {erreur && (
        <div style={{ padding: 12, background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, color: '#991b1b', fontSize: 13, marginBottom: 16 }}>
          ⚠️ {erreur}
        </div>
      )}

      {/* Liste */}
      <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Chargement…</div>
        ) : filtres.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
            Aucun utilisateur ne correspond aux filtres.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb', color: '#6b7280', fontSize: 11, textTransform: 'uppercase' }}>
                <th style={th}>Statut</th>
                <th style={th}>Nom / Email</th>
                <th style={th}>Département</th>
                <th style={th}>Rôle actuel</th>
                <th style={th}>Changer rôle</th>
                <th style={th}>Accès Import</th>
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtres.map(u => {
                const estMoi = u.id === monId;
                return (
                  <tr key={u.id} style={{ borderTop: '1px solid #f3f4f6', opacity: u.actif ? 1 : 0.55 }}>
                    <td style={td}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                        background: u.actif ? '#dcfce7' : '#f3f4f6',
                        color:      u.actif ? '#166534' : '#6b7280',
                      }}>
                        {u.actif ? '✅ Actif' : '⏸ Inactif'}
                      </span>
                    </td>
                    <td style={td}>
                      <div style={{ fontWeight: 700, color: '#111827' }}>
                        {u.nom ?? '(sans nom)'}
                        {estMoi && <span style={{ marginLeft: 8, fontSize: 10, background: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>TOI</span>}
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace' }}>{u.email}</div>
                    </td>
                    <td style={{ ...td, color: '#6b7280' }}>{u.departement ?? '—'}</td>
                    <td style={td}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                        background: `${ROLE_COULEURS[u.role]}22`, color: ROLE_COULEURS[u.role],
                      }}>
                        {ROLE_EMOJIS[u.role]} {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td style={td}>
                      <select
                        value={u.role}
                        onChange={ev => changerRole(u, ev.target.value as Role)}
                        disabled={estMoi}
                        title={estMoi ? 'Tu ne peux pas changer ton propre rôle' : ''}
                        style={{
                          padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: 6,
                          fontSize: 12, background: estMoi ? '#f3f4f6' : 'white',
                          cursor: estMoi ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {(['admin', 'gestion', 'planification', 'vendeur', 'employe', 'tv'] as Role[]).map(r => (
                          <option key={r} value={r}>{ROLE_EMOJIS[r]} {ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                    </td>
                    <td style={td}>
                      {ROLES_IMPORT.includes(u.role) ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <select
                            value={IMPORT_PRESETS.find(p => p.value === u.onglets_import) ? (u.onglets_import ?? '__null__') : '__custom__'}
                            onChange={ev => {
                              const val = ev.target.value;
                              if (val === '__null__')   changerOngletsImport(u, null);
                              else if (val !== '__custom__') changerOngletsImport(u, val);
                            }}
                            style={{
                              padding: '4px 7px', border: '1px solid #e5e7eb', borderRadius: 6,
                              fontSize: 11, background: 'white', cursor: 'pointer', maxWidth: 200,
                            }}
                          >
                            {IMPORT_PRESETS.map(p => (
                              <option key={p.value ?? '__null__'} value={p.value ?? '__null__'}>
                                {p.label}
                              </option>
                            ))}
                            {/* Affiche "Personnalisé" si la valeur ne correspond à aucun preset */}
                            {!IMPORT_PRESETS.some(p => p.value === u.onglets_import) && (
                              <option value="__custom__">✏️ Personnalisé</option>
                            )}
                          </select>
                          {/* Champ texte libre si valeur personnalisée */}
                          {!IMPORT_PRESETS.some(p => p.value === u.onglets_import) && (
                            <input
                              type="text"
                              defaultValue={u.onglets_import ?? ''}
                              placeholder="ex: agendrix,labor_log"
                              onBlur={ev => changerOngletsImport(u, ev.target.value.trim() || null)}
                              style={{
                                padding: '3px 6px', border: '1px solid #f59e0b', borderRadius: 4,
                                fontSize: 11, fontFamily: 'monospace', width: '100%', maxWidth: 200,
                              }}
                            />
                          )}
                          {/* Lien direct */}
                          {u.onglets_import !== null && (
                            <div style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                              🔗 #{u.onglets_import.split(',')[0].trim()}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#d1d5db', fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                      {!estMoi && (
                        <button onClick={() => toggleActif(u)} style={iconBtn}
                          title={u.actif ? 'Désactiver' : 'Réactiver'}>
                          {u.actif ? '⏸' : '▶'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function FiltreBtn({ label, actif, onClick, color }: { label: string; actif: boolean; onClick: () => void; color?: string }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 12px', borderRadius: 18, border: 'none',
      background: actif ? (color ?? '#3b82f6') : '#f3f4f6',
      color: actif ? 'white' : '#6b7280',
      fontWeight: actif ? 700 : 500, fontSize: 12, cursor: 'pointer',
    }}>{label}</button>
  );
}

const th: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontWeight: 600 };
const td: React.CSSProperties = { padding: '12px' };
const iconBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  fontSize: 16, padding: '4px 8px', marginLeft: 4,
};
