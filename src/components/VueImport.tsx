import { useState, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  parseHitracCSV, loadInventaireActif, calculateDiff, executeImport, restoreImport, listImports,
  type DiffSummary, type DiffRow, type ImportResult, type ImportLogEntry,
} from '../services/hitracImportService';

type Step = 'upload' | 'preview' | 'confirming' | 'done';

export function VueImport() {
  const { profile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>('');
  const [diff, setDiff] = useState<DiffSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [filterKind, setFilterKind] = useState<'all' | 'maj_mo' | 'maj_achat' | 'protege' | 'absent_hitrac' | 'identique'>('all');
  const [imports, setImports] = useState<ImportLogEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const isGestion = profile?.role === 'gestion';

  useEffect(() => {
    if (isGestion) listImports().then(setImports).catch(console.error);
  }, [isGestion, result]);

  if (!isGestion) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
        Accès réservé aux gestionnaires.
      </div>
    );
  }

  const handleFile = async (file: File) => {
    setError(null);
    setLoading(true);
    setFilename(file.name);
    try {
      const text = await file.text();
      const hitrac = parseHitracCSV(text);
      if (hitrac.length === 0) {
        throw new Error("Aucune donnée HITRAC trouvée dans le fichier. Vérifiez le format.");
      }
      const db = await loadInventaireActif();
      const d = calculateDiff(db, hitrac);
      setDiff(d);
      setStep('preview');
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setStep('upload');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!diff) return;
    setStep('confirming');
    setError(null);
    try {
      const r = await executeImport({
        diff, filename,
        userEmail: profile?.email, userNom: profile?.nom,
      });
      setResult(r);
      setStep('done');
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setStep('preview');
    }
  };

  const handleRestore = async (importId: string) => {
    if (!confirm('Restaurer cet import ? Les valeurs prix_achat_reel et cout_mo des camions modifiés vont revenir à leur état précédent.')) return;
    try {
      const n = await restoreImport(importId, profile?.nom ?? 'admin');
      alert(`✅ ${n} camions restaurés à leur état précédent.`);
      listImports().then(setImports);
    } catch (e: any) {
      alert(`Erreur : ${e?.message ?? String(e)}`);
    }
  };

  const reset = () => {
    setStep('upload'); setDiff(null); setError(null); setFilename(''); setResult(null); setFilterKind('all');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div style={{
      width: '100%', height: '100%', overflowY: 'auto',
      background: '#f8fafc', padding: '24px',
      boxSizing: 'border-box',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            📥 Import HITRAC — Coûts inventaire actif
          </h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 6 }}>
            Met à jour <strong>prix_achat_reel</strong> et <strong>cout_mo</strong> sur les camions <strong>à l'eau</strong> et <strong>détail</strong> en statut <strong>inventaire</strong> à partir d'un rapport HITRAC <code>vehiclecostdetail.csv</code>.
          </p>
        </div>

        {/* Étape : Upload */}
        {step === 'upload' && (
          <div style={{
            background: 'white', borderRadius: 14, padding: 32,
            border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <label htmlFor="hitrac-file" style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 12, padding: '60px 24px', borderRadius: 12,
              border: '2px dashed #d1d5db', background: '#fafafa',
              cursor: loading ? 'wait' : 'pointer', color: '#6b7280',
              transition: 'all 0.15s',
            }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLLabelElement).style.borderColor = '#3b82f6'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLLabelElement).style.borderColor = '#d1d5db'; }}
            >
              <span style={{ fontSize: 48 }}>📊</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#374151' }}>
                {loading ? 'Analyse en cours...' : 'Déposez le fichier HITRAC ou cliquez pour parcourir'}
              </span>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>
                Format attendu : <code>vehiclecostdetail.csv</code> (exporté de HITRAC)
              </span>
              <input
                id="hitrac-file" ref={fileRef} type="file" accept=".csv,text/csv"
                disabled={loading}
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </label>

            {error && <ErrorBox msg={error} />}

            <div style={{ marginTop: 18, padding: 14, borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a', fontSize: 12, color: '#92400e' }}>
              <strong>Règles appliquées :</strong>
              <ul style={{ margin: '6px 0 0 0', paddingLeft: 20 }}>
                <li>Cible : camions <strong>eau</strong> ou <strong>détail</strong>, statut <strong>inventaire</strong></li>
                <li><code>prix_achat_reel</code> : écrit seulement si DB est vide ou ≤ $10 (placeholder)</li>
                <li><code>cout_mo</code> : toujours écrasé par HITRAC, sauf si HITRAC = 0 et DB &gt; 0 (on garde DB)</li>
                <li>Camions absents de HITRAC : ignorés</li>
                <li>Stock# présent dans HITRAC mais absent de la DB : ignoré</li>
              </ul>
            </div>
          </div>
        )}

        {/* Étape : Preview */}
        {step === 'preview' && diff && (
          <PreviewView
            diff={diff}
            filterKind={filterKind}
            setFilterKind={setFilterKind}
            onCancel={reset}
            onConfirm={handleConfirm}
            error={error}
          />
        )}

        {/* Étape : Confirming */}
        {step === 'confirming' && (
          <div style={{ background: 'white', borderRadius: 14, padding: 60, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#374151' }}>Backup et mise à jour en cours…</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 6 }}>Ne fermez pas cette page.</div>
          </div>
        )}

        {/* Étape : Done */}
        {step === 'done' && result && (
          <div style={{ background: 'white', borderRadius: 14, padding: 40, textAlign: 'center', border: '1px solid #86efac' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#166534', margin: 0 }}>Import terminé</h2>
            <div style={{ fontSize: 14, color: '#374151', marginTop: 16, lineHeight: 1.8 }}>
              <div><strong>{result.nb_camions_analyses}</strong> camions analysés</div>
              <div><strong style={{ color: '#16a34a' }}>{result.nb_achats_modifies}</strong> prix d'achat ajoutés</div>
              <div><strong style={{ color: '#16a34a' }}>{result.nb_mo_modifies}</strong> coûts de main d'œuvre mis à jour</div>
              {result.nb_achats_proteges > 0 && (
                <div><strong style={{ color: '#d97706' }}>{result.nb_achats_proteges}</strong> prix d'achat protégés (déjà remplis en DB)</div>
              )}
            </div>
            <div style={{ marginTop: 24, fontSize: 12, color: '#9ca3af' }}>
              Backup créé. En cas de problème, utilise la section "Historique" ci-dessous pour restaurer.
            </div>
            <button onClick={reset} style={primaryBtn}>Nouvel import</button>
          </div>
        )}

        {/* Historique des imports (toujours visible en bas) */}
        <div style={{ marginTop: 32 }}>
          <button onClick={() => setShowHistory(s => !s)} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 8,
            background: 'white', border: '1px solid #e5e7eb',
            cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#374151',
          }}>
            {showHistory ? '▾' : '▸'} Historique des imports ({imports.length})
          </button>

          {showHistory && (
            <div style={{ marginTop: 12, background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              {imports.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Aucun import HITRAC enregistré.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                      <th style={th}>Date</th>
                      <th style={th}>Utilisateur</th>
                      <th style={th}>Fichier</th>
                      <th style={th}>Camions</th>
                      <th style={th}>Achats</th>
                      <th style={th}>M.O.</th>
                      <th style={th}>Statut</th>
                      <th style={th}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {imports.map(i => (
                      <tr key={i.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={td}>{new Date(i.created_at).toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td style={td}>{i.user_nom ?? '—'}</td>
                        <td style={{ ...td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.filename ?? '—'}</td>
                        <td style={td}>{i.nb_camions_analyses}</td>
                        <td style={td}>{i.nb_achats_modifies}</td>
                        <td style={td}>{i.nb_mo_modifies}</td>
                        <td style={td}>
                          {i.status === 'restored' ? (
                            <span style={{ padding: '2px 8px', borderRadius: 4, background: '#fef3c7', color: '#92400e', fontWeight: 700 }}>↩ Restauré</span>
                          ) : (
                            <span style={{ padding: '2px 8px', borderRadius: 4, background: '#dcfce7', color: '#166534', fontWeight: 700 }}>✓ Appliqué</span>
                          )}
                        </td>
                        <td style={td}>
                          {i.status === 'completed' && (
                            <button onClick={() => handleRestore(i.id)} style={{
                              padding: '4px 10px', borderRadius: 6, background: '#fef3c7', color: '#92400e',
                              border: '1px solid #fde68a', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                            }}>↩ Restaurer</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ─── Vue Preview ─────────────────────────────────────────────────────

function PreviewView({ diff, filterKind, setFilterKind, onCancel, onConfirm, error }: {
  diff: DiffSummary;
  filterKind: 'all' | DiffRow['kind'];
  setFilterKind: (k: any) => void;
  onCancel: () => void;
  onConfirm: () => void;
  error: string | null;
}) {
  const filtered = useMemo(() => {
    if (filterKind === 'all') return diff.rows;
    return diff.rows.filter(r => r.kind === filterKind);
  }, [diff, filterKind]);

  // Tri : changements d'abord, puis par stock
  const sorted = useMemo(() => {
    const order: Record<DiffRow['kind'], number> = {
      'maj_achat_et_mo': 0, 'maj_achat': 1, 'maj_mo': 2, 'protege': 3, 'absent_hitrac': 4, 'identique': 5,
    };
    return [...filtered].sort((a, b) => {
      if (order[a.kind] !== order[b.kind]) return order[a.kind] - order[b.kind];
      return a.stock_numero.localeCompare(b.stock_numero);
    });
  }, [filtered]);

  const aChanges = diff.achats_a_ajouter + diff.mo_a_modifier;
  const hasAnomaly = diff.total_db > 0 && aChanges / diff.total_db > 0.5;

  return (
    <div>
      {/* Bandeau résumé */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12,
        background: 'white', borderRadius: 14, padding: 16, marginBottom: 16,
        border: '1px solid #e5e7eb',
      }}>
        <StatCard label="Camions analysés" value={diff.total_db} color="#0f172a" />
        <StatCard label="Trouvés HITRAC"   value={diff.trouves_dans_hitrac} color="#16a34a" />
        <StatCard label="Absents HITRAC"   value={diff.absents_de_hitrac} color="#6b7280" />
        <StatCard label="Achats à ajouter" value={diff.achats_a_ajouter} color="#16a34a" highlight />
        <StatCard label="M.O. à modifier"  value={diff.mo_a_modifier} color="#3b82f6" highlight />
        <StatCard label="Achats protégés"  value={diff.achats_proteges} color="#d97706" />
        <StatCard label="Identiques"       value={diff.identiques} color="#9ca3af" />
      </div>

      {hasAnomaly && (
        <div style={{
          padding: 14, borderRadius: 10, background: '#fef2f2', border: '2px solid #fca5a5',
          color: '#991b1b', fontSize: 13, marginBottom: 16, fontWeight: 700,
        }}>
          ⚠️ <strong>Anomalie possible :</strong> Plus de 50% des camions changent. Vérifie que tu importes le bon fichier avant de confirmer.
        </div>
      )}

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <FilterChip active={filterKind === 'all'}            onClick={() => setFilterKind('all')}            label={`Tous (${diff.rows.length})`} />
        <FilterChip active={filterKind === 'maj_achat'}      onClick={() => setFilterKind('maj_achat')}      label={`Achats ajoutés (${diff.achats_a_ajouter})`} color="#16a34a" />
        <FilterChip active={filterKind === 'maj_mo'}         onClick={() => setFilterKind('maj_mo')}         label={`M.O. modifiés (${diff.mo_a_modifier})`} color="#3b82f6" />
        <FilterChip active={filterKind === 'protege'}        onClick={() => setFilterKind('protege')}        label={`Protégés (${diff.achats_proteges})`} color="#d97706" />
        <FilterChip active={filterKind === 'absent_hitrac'}  onClick={() => setFilterKind('absent_hitrac')}  label={`Absents HITRAC (${diff.absents_de_hitrac})`} color="#6b7280" />
        <FilterChip active={filterKind === 'identique'}      onClick={() => setFilterKind('identique')}      label={`Identiques (${diff.identiques})`} color="#9ca3af" />
      </div>

      {/* Tableau */}
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, background: '#0f172a', color: 'white', zIndex: 1 }}>
              <tr>
                <th style={thDark}>Stock #</th>
                <th style={thDark}>Type</th>
                <th style={thDark}>Camion</th>
                <th style={thDark}>Achat DB</th>
                <th style={thDark}>Achat HITRAC</th>
                <th style={thDark}>→ Nouveau</th>
                <th style={thDark}>M.O. DB</th>
                <th style={thDark}>M.O. HITRAC</th>
                <th style={thDark}>→ Nouveau</th>
                <th style={thDark}>Action</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(r => <DiffRowView key={r.stock_numero} row={r} />)}
            </tbody>
          </table>
        </div>
      </div>

      {error && <ErrorBox msg={error} />}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={secondaryBtn}>← Annuler</button>
        <button onClick={onConfirm} style={confirmBtn} disabled={diff.achats_a_ajouter + diff.mo_a_modifier === 0}>
          ✅ Backup + Confirmer l'import ({diff.achats_a_ajouter + diff.mo_a_modifier} changements)
        </button>
      </div>
    </div>
  );
}

// ─── Sous-composants ─────────────────────────────────────────────────

function DiffRowView({ row }: { row: DiffRow }) {
  const fmt = (n: number | null) => n == null ? '—' : `$${Math.round(n).toLocaleString('fr-CA')}`;

  const rowBg =
    row.kind === 'maj_achat_et_mo' ? '#f0fdf4' :
    row.kind === 'maj_achat' ? '#f0fdf4' :
    row.kind === 'maj_mo' ? '#eff6ff' :
    row.kind === 'protege' ? '#fffbeb' :
    row.kind === 'absent_hitrac' ? '#f9fafb' :
    'white';

  const actionLabel =
    row.kind === 'maj_achat_et_mo' ? '✓ MAJ achat + MO' :
    row.kind === 'maj_achat' ? '✓ MAJ achat' :
    row.kind === 'maj_mo' ? '✓ MAJ M.O.' :
    row.kind === 'protege' ? '🛡 Protégé' :
    row.kind === 'absent_hitrac' ? '— Absent' :
    '= Identique';

  const actionColor =
    row.kind.startsWith('maj') ? '#16a34a' :
    row.kind === 'protege' ? '#d97706' :
    '#6b7280';

  return (
    <tr style={{ background: rowBg, borderBottom: '1px solid #f3f4f6' }}>
      <td style={{ ...td, fontFamily: 'monospace', fontWeight: 800 }}>{row.stock_numero}</td>
      <td style={td}>{row.type === 'eau' ? '💧' : '🏷️'}</td>
      <td style={{ ...td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</td>
      <td style={tdNum}>{fmt(row.achat_db)}</td>
      <td style={tdNum}>{fmt(row.achat_hitrac)}</td>
      <td style={{ ...tdNum, fontWeight: row.achat_nouvelle !== null ? 800 : 400, color: row.achat_nouvelle !== null ? '#16a34a' : '#9ca3af' }}>
        {row.achat_nouvelle === null ? '—' : fmt(row.achat_nouvelle)}
      </td>
      <td style={tdNum}>{fmt(row.mo_db)}</td>
      <td style={tdNum}>{fmt(row.mo_hitrac)}</td>
      <td style={{ ...tdNum, fontWeight: row.mo_nouvelle !== null ? 800 : 400, color: row.mo_nouvelle !== null ? '#3b82f6' : '#9ca3af' }}>
        {row.mo_nouvelle === null ? '—' : fmt(row.mo_nouvelle)}
      </td>
      <td style={{ ...td, fontWeight: 700, color: actionColor }}>{actionLabel}</td>
    </tr>
  );
}

function StatCard({ label, value, color, highlight }: { label: string; value: number; color: string; highlight?: boolean }) {
  return (
    <div style={{
      padding: '8px 12px',
      borderRadius: 8,
      background: highlight ? `${color}10` : 'transparent',
      borderLeft: `4px solid ${color}`,
    }}>
      <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1.2, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function FilterChip({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color?: string }) {
  const c = color ?? '#0f172a';
  return (
    <button onClick={onClick} style={{
      padding: '6px 12px', borderRadius: 16, fontSize: 12, fontWeight: active ? 700 : 500,
      border: active ? `2px solid ${c}` : '1px solid #e5e7eb',
      background: active ? `${c}15` : 'white', color: active ? c : '#6b7280',
      cursor: 'pointer', whiteSpace: 'nowrap',
    }}>{label}</button>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div style={{
      marginTop: 14, padding: 14, borderRadius: 8,
      background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b',
      fontSize: 13, fontWeight: 600,
    }}>
      ❌ {msg}
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────

const th: React.CSSProperties = {
  padding: '8px 10px', textAlign: 'left', fontSize: 11, color: '#6b7280',
  fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
};
const thDark: React.CSSProperties = {
  padding: '10px 10px', textAlign: 'left', fontSize: 11, color: 'white',
  fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
};
const td: React.CSSProperties = { padding: '7px 10px', verticalAlign: 'middle' };
const tdNum: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: 'monospace' };

const primaryBtn: React.CSSProperties = {
  marginTop: 20, padding: '11px 22px', borderRadius: 8,
  background: '#3b82f6', color: 'white', border: 'none',
  fontWeight: 700, fontSize: 14, cursor: 'pointer',
};
const secondaryBtn: React.CSSProperties = {
  padding: '11px 18px', borderRadius: 8,
  background: 'white', border: '1px solid #e5e7eb',
  color: '#374151', fontWeight: 700, fontSize: 13, cursor: 'pointer',
};
const confirmBtn: React.CSSProperties = {
  padding: '11px 22px', borderRadius: 8,
  background: '#16a34a', color: 'white', border: 'none',
  fontWeight: 700, fontSize: 14, cursor: 'pointer',
};
