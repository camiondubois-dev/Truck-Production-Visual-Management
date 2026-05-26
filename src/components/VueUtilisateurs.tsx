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
  id:           string;
  email:        string;
  nom:          string | null;
  role:         Role;
  departement:  string | null;
  actif:        boolean;
}

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
  const [users, setUsers]       = useState<Utilisateur[]>([]);
  const [loading, setLoading]   = useState(true);
  const [erreur, setErreur]     = useState<string | null>(null);
  const [editing, setEditing]   = useState<Utilisateur | null>(null);
  const [recherche, setRecherche] = useState('');
  const [filtreRole, setFiltreRole] = useState<'tous' | Role>('tous');

  const charger = async () => {
    setLoading(true);
    setErreur(null);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, nom, role, departement, actif')
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

  const monId = profile.id;

  return (
    <div style={{
      padding: 24, height: '100%', overflowY: 'auto', background: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>🔑 SUPER-ADMIN</div>
        <h1 style={{ margin: 0, fontSize: 24, color: '#111827' }}>Gestion des utilisateurs</h1>
        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
          Changer les rôles, activer/désactiver les comptes. <strong>Action sensible.</strong>
        </div>
      </div>

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
