// ════════════════════════════════════════════════════════════════
// Finance Mobile — Vue principale (lecture seule)
// Tabs : 📊 Ventes · 🏭 Inventaire · 🔧 Pièces · ⚙️ Info
// ════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { nomVendeur } from '../services/piecesImportService';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const AMBER   = '#f59e0b';
const GREEN   = '#4ade80';
const RED     = '#f87171';
const BG      = '#0f172a';
const CARD_BG = 'rgba(255,255,255,0.05)';
const BORDER  = 'rgba(255,255,255,0.08)';
const PAGE_SZ = 500;

// Mois dans l'ordre fiscal (juil → juin)
const FY_MONTHS = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];
const MONTH_LABELS: Record<number, string> = {
  1:'Jan', 2:'Fév', 3:'Mar', 4:'Avr', 5:'Mai', 6:'Jun',
  7:'Jul', 8:'Aoû', 9:'Sep', 10:'Oct', 11:'Nov', 12:'Déc',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmt$ = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);

const fmtPct = (n: number | null | undefined) =>
  n == null ? '—' : `${Number(n).toFixed(1)} %`;

const fmtK = (n: number) =>
  n === 0 ? '—' : Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(0)}k` : `${n.toFixed(0)}`;

function currentFY(): number {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}

function groupByMonth(rows: { date_vente: string | null; val: number }[]): Record<number, number> {
  const r: Record<number, number> = {};
  for (const row of rows) {
    if (!row.date_vente) continue;
    const m = parseInt(row.date_vente.slice(5, 7));
    r[m] = (r[m] ?? 0) + row.val;
  }
  return r;
}

async function fetchAll<T>(
  table: string,
  fields: string,
  applyFilter: (q: ReturnType<typeof supabase.from>) => any,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await applyFilter(
      supabase.from(table).select(fields),
    ).range(from, from + PAGE_SZ - 1);
    if (error || !data) break;
    rows.push(...(data as T[]));
    if (data.length < PAGE_SZ) break;
    from += PAGE_SZ;
  }
  return rows;
}

// ─── Types ─────────────────────────────────────────────────────────────────────
interface VenteRow {
  annee_fiscale:    number | null;
  date_vente:       string | null;
  client:           string | null;
  stock_numero:     string;
  marque:           string | null;
  modele:           string | null;
  annee:            number | null;
  type_vente_label: string | null;
  prix_achat_reel:  number | null;
  cout_mo:          number | null;
  cout_total:       number | null;
  prix_vente:       number | null;
  marge_profit:     number | null;
  pct_profit:       number | null;
}

interface InvRow {
  stock_numero:       string;
  type_vehicule:      string | null;
  date_achat:         string | null;
  age_jours:          number | null;
  cout_achat:         number | null;
  cout_total_depense: number | null;
  prix_achat_reel:    number | null;
  prix_demande:       number | null;
  marque:             string | null;
  modele:             string | null;
  annee:              number | null;
}

interface PieceRow {
  document_numero: string;
  vendeur:         string | null;
  sous_total:      number;
  date_vente:      string;
  annee_fiscale:   number | null;
}

// ─── Composants communs ────────────────────────────────────────────────────────

function KpiCard({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: color ?? 'white', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Spinner() {
  return <div style={{ textAlign: 'center', padding: 48, color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>⏳ Chargement…</div>;
}

function FySelector({ fy, onChange }: { fy: number; onChange: (y: number) => void }) {
  const cur = currentFY();
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
      {[cur - 1, cur].map(y => (
        <button key={y} onClick={() => onChange(y)} style={{
          flex: 1, padding: '9px 0', borderRadius: 10, border: 'none',
          background: fy === y ? AMBER : CARD_BG,
          color: fy === y ? '#000' : 'rgba(255,255,255,0.55)',
          fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
        }}>
          {fy === y ? '★ ' : ''}AF {y}
        </button>
      ))}
    </div>
  );
}

// ─── Graphique comparatif par mois (2 AF côte à côte) ─────────────────────────

function ComparisonChart({
  prev, curr, fyPrev, fyCurr,
}: {
  prev: Record<number, number>;
  curr: Record<number, number>;
  fyPrev: number;
  fyCurr: number;
}) {
  const allVals = FY_MONTHS.flatMap(m => [Math.abs(prev[m] ?? 0), Math.abs(curr[m] ?? 0)]);
  const maxVal  = Math.max(...allVals, 1);

  return (
    <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 14px 10px' }}>
      {/* Légende */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 11 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 12, height: 8, borderRadius: 2, background: 'rgba(255,255,255,0.25)' }} />
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>AF{fyPrev}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 12, height: 8, borderRadius: 2, background: AMBER }} />
          <span style={{ color: AMBER }}>AF{fyCurr}</span>
        </div>
      </div>

      {/* Barres par mois */}
      {FY_MONTHS.map(m => {
        const v1 = prev[m] ?? 0;
        const v2 = curr[m] ?? 0;
        const pct1 = Math.abs(v1) / maxVal * 100;
        const pct2 = Math.abs(v2) / maxVal * 100;
        const hasData = v1 !== 0 || v2 !== 0;

        return (
          <div key={m} style={{ marginBottom: 7 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>
              {MONTH_LABELS[m]}
            </div>
            {/* Bar AF précédent */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <div style={{ flex: 1, height: 9, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${pct1}%`, height: '100%', background: 'rgba(255,255,255,0.25)', borderRadius: 3, transition: 'width 0.4s' }} />
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', width: 38, textAlign: 'right' }}>
                {hasData ? fmtK(v1) : ''}
              </div>
            </div>
            {/* Bar AF courant */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ flex: 1, height: 9, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${pct2}%`, height: '100%', background: AMBER, borderRadius: 3, transition: 'width 0.4s' }} />
              </div>
              <div style={{ fontSize: 10, color: AMBER, width: 38, textAlign: 'right' }}>
                {hasData ? fmtK(v2) : ''}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Onglet Ventes ─────────────────────────────────────────────────────────────

function TabVentes() {
  const [rowsCurr, setRowsCurr] = useState<VenteRow[]>([]);
  const [rowsPrev, setRowsPrev] = useState<VenteRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [fy,       setFy]       = useState(currentFY());
  const [viewMode, setViewMode] = useState<'list' | 'chart'>('list');

  useEffect(() => {
    setLoading(true);
    const fields = 'annee_fiscale,date_vente,client,stock_numero,marque,modele,annee,type_vente_label,prix_achat_reel,cout_mo,cout_total,prix_vente,marge_profit,pct_profit';
    Promise.all([
      fetchAll<VenteRow>('prod_rapport_profitabilite', fields, q => q.eq('annee_fiscale', fy).order('date_vente', { ascending: false })),
      fetchAll<VenteRow>('prod_rapport_profitabilite', fields, q => q.eq('annee_fiscale', fy - 1)),
    ]).then(([curr, prev]) => {
      setRowsCurr(curr);
      setRowsPrev(prev);
      setLoading(false);
    });
  }, [fy]);

  const totalCA    = rowsCurr.reduce((s, r) => s + (r.prix_vente   ?? 0), 0);
  const totalMarge = rowsCurr.reduce((s, r) => s + (r.marge_profit ?? 0), 0);
  const pctMoy     = totalCA > 0 ? (totalMarge / totalCA * 100) : 0;

  const monthlyCA   = groupByMonth(rowsCurr.map(r => ({ date_vente: r.date_vente, val: r.prix_vente   ?? 0 })));
  const monthlyPrev = groupByMonth(rowsPrev.map(r => ({ date_vente: r.date_vente, val: r.prix_vente   ?? 0 })));

  return (
    <div style={{ padding: 16 }}>
      <FySelector fy={fy} onChange={setFy} />

      {/* Toggle liste / graphique */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {(['list', 'chart'] as const).map(mode => (
          <button key={mode} onClick={() => setViewMode(mode)} style={{
            flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
            background: viewMode === mode ? 'rgba(255,255,255,0.15)' : CARD_BG,
            color: viewMode === mode ? 'white' : 'rgba(255,255,255,0.4)',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>
            {mode === 'list' ? '☰ Liste' : '📊 Graphique'}
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <KpiCard label="Camions vendus"  value={String(rowsCurr.length)} />
            <KpiCard label="Marge moyenne"   value={fmtPct(pctMoy)}
              color={pctMoy > 10 ? GREEN : pctMoy > 5 ? AMBER : RED} />
            <KpiCard label="CA total"        value={fmt$(totalCA)} />
            <KpiCard label="Marge totale"    value={fmt$(totalMarge)}
              color={totalMarge >= 0 ? GREEN : RED} />
          </div>

          {viewMode === 'chart' ? (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 10 }}>
                CA par mois — AF{fy - 1} vs AF{fy}
              </div>
              <ComparisonChart prev={monthlyPrev} curr={monthlyCA} fyPrev={fy - 1} fyCurr={fy} />
            </>
          ) : (
            <>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>
                {rowsCurr.length} ventes · AF{fy}
              </div>
              {rowsCurr.map(r => {
                const margeColor = (r.marge_profit ?? 0) >= 0 ? GREEN : RED;
                const total = (r.prix_achat_reel ?? 0) + (r.cout_mo ?? 0);
                return (
                  <div key={r.stock_numero} style={{
                    background: CARD_BG, border: `1px solid ${BORDER}`,
                    borderRadius: 10, padding: '12px 14px', marginBottom: 8,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                        <div style={{ fontSize: 11, color: AMBER, fontWeight: 700 }}>#{r.stock_numero}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {r.annee} {r.marque} {r.modele}
                        </div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                          {r.date_vente?.slice(0, 10)} · {r.client ?? '—'}
                        </div>
                        {/* Coûts détaillés */}
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 3, display: 'flex', gap: 8 }}>
                          <span>Achat {fmt$(r.prix_achat_reel)}</span>
                          <span>M.O. {fmt$(r.cout_mo)}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{fmt$(r.prix_vente)}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: margeColor }}>
                          {fmt$(r.marge_profit)}
                        </div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                          {fmtPct(r.pct_profit)} · {r.type_vente_label ?? '—'}
                        </div>
                        {total > 0 && (
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>
                            Coût total {fmt$(total)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── Onglet Inventaire ─────────────────────────────────────────────────────────

function TabInventaire() {
  const [rows,    setRows]    = useState<InvRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll<InvRow>(
      'prod_inventaire_couts',
      'stock_numero,type_vehicule,date_achat,age_jours,cout_achat,cout_total_depense,prix_achat_reel,prix_demande,marque,modele,annee',
      q => q.order('cout_achat', { ascending: false }),
    ).then(data => { setRows(data); setLoading(false); });
  }, []);

  const totalAchat   = rows.reduce((s, r) => s + (r.prix_achat_reel     ?? 0), 0);
  const totalMO      = rows.reduce((s, r) => s + (r.cout_total_depense   ?? 0), 0);
  const totalInvesti = totalAchat + totalMO;
  const moyAge       = rows.length > 0
    ? Math.round(rows.reduce((s, r) => s + (r.age_jours ?? 0), 0) / rows.length) : 0;

  return (
    <div style={{ padding: 16 }}>
      {loading ? <Spinner /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <KpiCard label="En inventaire"  value={String(rows.length)} />
            <KpiCard label="Âge moyen"      value={`${moyAge} j`} />
            <KpiCard label="Total investi"  value={fmt$(totalInvesti)} color={AMBER}
              sub={`Achat ${fmt$(totalAchat)} + MO ${fmt$(totalMO)}`} />
            <KpiCard label="M.O. dépensée"  value={fmt$(totalMO)} />
          </div>

          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>
            {rows.length} camions en stock
          </div>

          {rows.map(r => {
            const achat = r.prix_achat_reel    ?? 0;
            const mo    = r.cout_total_depense ?? 0;
            const total = achat + mo;

            return (
              <div key={r.stock_numero} style={{
                background: CARD_BG, border: `1px solid ${BORDER}`,
                borderRadius: 10, padding: '12px 14px', marginBottom: 8,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                    <div style={{ fontSize: 11, color: AMBER, fontWeight: 700 }}>#{r.stock_numero}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.annee} {r.marque} {r.modele}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                      {r.date_achat?.slice(0, 10) ?? '—'}
                      {r.type_vehicule ? ` · ${r.type_vehicule}` : ''}
                      {r.age_jours != null ? ` · ${r.age_jours} j` : ''}
                    </div>
                    {r.prix_demande != null && (
                      <div style={{ fontSize: 10, color: '#60a5fa', marginTop: 2 }}>
                        Prix dem. {fmt$(r.prix_demande)}
                      </div>
                    )}
                  </div>

                  {/* Colonne droite : achat + MO + total */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                      Achat {fmt$(achat)}
                    </div>
                    {mo > 0 && (
                      <div style={{ fontSize: 11, color: AMBER }}>
                        + M.O. {fmt$(mo)}
                      </div>
                    )}
                    <div style={{
                      fontSize: 14, fontWeight: 800, color: 'white',
                      borderTop: '1px solid rgba(255,255,255,0.1)',
                      marginTop: 4, paddingTop: 4,
                    }}>
                      {fmt$(total)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// ─── Onglet Pièces ─────────────────────────────────────────────────────────────

function TabPieces() {
  const [rowsCurr, setRowsCurr] = useState<PieceRow[]>([]);
  const [rowsPrev, setRowsPrev] = useState<PieceRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [fy,       setFy]       = useState(currentFY());
  const [viewMode, setViewMode] = useState<'chart' | 'vendeurs'>('chart');

  useEffect(() => {
    setLoading(true);
    const fields = 'document_numero,vendeur,sous_total,date_vente,annee_fiscale';
    Promise.all([
      fetchAll<PieceRow>('prod_ventes_pieces', fields, q => q.eq('annee_fiscale', fy)),
      fetchAll<PieceRow>('prod_ventes_pieces', fields, q => q.eq('annee_fiscale', fy - 1)),
    ]).then(([curr, prev]) => {
      setRowsCurr(curr);
      setRowsPrev(prev);
      setLoading(false);
    });
  }, [fy]);

  const brut    = rowsCurr.reduce((s, r) => s + Math.max(r.sous_total, 0), 0);
  const retours = rowsCurr.reduce((s, r) => s + Math.min(r.sous_total, 0), 0);
  const net     = rowsCurr.reduce((s, r) => s + r.sous_total, 0);
  const nbRet   = rowsCurr.filter(r => r.sous_total < 0).length;

  const monthlyVentes = groupByMonth(rowsCurr.map(r => ({ date_vente: r.date_vente, val: Math.max(r.sous_total, 0) })));
  const monthlyPrev   = groupByMonth(rowsPrev.map(r => ({ date_vente: r.date_vente, val: Math.max(r.sous_total, 0) })));

  // Par vendeur
  const byVendeur = rowsCurr.reduce<Record<string, { nb: number; total: number }>>((acc, r) => {
    const k = r.vendeur ?? '(aucun)';
    if (!acc[k]) acc[k] = { nb: 0, total: 0 };
    acc[k].nb++;
    acc[k].total += r.sous_total;
    return acc;
  }, {});
  const vendeurs  = Object.entries(byVendeur).sort((a, b) => b[1].total - a[1].total);
  const maxTotal  = vendeurs.length > 0 ? Math.max(...vendeurs.map(([, v]) => v.total)) : 1;

  return (
    <div style={{ padding: 16 }}>
      <FySelector fy={fy} onChange={setFy} />

      {/* Toggle graphique / vendeurs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {(['chart', 'vendeurs'] as const).map(mode => (
          <button key={mode} onClick={() => setViewMode(mode)} style={{
            flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
            background: viewMode === mode ? 'rgba(255,255,255,0.15)' : CARD_BG,
            color: viewMode === mode ? 'white' : 'rgba(255,255,255,0.4)',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>
            {mode === 'chart' ? '📊 Graphique' : '👤 Vendeurs'}
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <KpiCard label="Factures"      value={String(rowsCurr.length)} />
            <KpiCard label={`Net AF${fy}`} value={fmt$(net)} color={net >= 0 ? GREEN : RED} />
            <KpiCard label="Ventes brutes" value={fmt$(brut)} />
            <KpiCard label={`Retours (${nbRet})`} value={fmt$(retours)} color={RED} />
          </div>

          {viewMode === 'chart' ? (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 10 }}>
                Ventes brutes par mois — AF{fy - 1} vs AF{fy}
              </div>
              <ComparisonChart prev={monthlyPrev} curr={monthlyVentes} fyPrev={fy - 1} fyCurr={fy} />
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 10 }}>
                Par vendeur · AF{fy}
              </div>
              {vendeurs.map(([code, stat]) => {
                const pct = maxTotal > 0 ? (stat.total / maxTotal * 100) : 0;
                return (
                  <div key={code} style={{
                    background: CARD_BG, border: `1px solid ${BORDER}`,
                    borderRadius: 10, padding: '12px 14px', marginBottom: 8,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{nomVendeur(code)}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{stat.nb} factures</div>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: stat.total >= 0 ? GREEN : RED }}>
                        {fmt$(stat.total)}
                      </div>
                    </div>
                    <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
                      <div style={{ height: '100%', borderRadius: 2, background: stat.total >= 0 ? GREEN : RED, width: `${Math.max(pct, 2)}%`, transition: 'width 0.4s' }} />
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── Onglet Info ───────────────────────────────────────────────────────────────

function TabInfo({ onLogout }: { onLogout: () => void }) {
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <img src="/logo-camions-dubois-_-noir-bleu-1.png" alt="Camions Dubois"
        style={{ height: 48, filter: 'brightness(0) invert(1)', alignSelf: 'center', marginBottom: 8 }} />

      <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Module</div>
        <div style={{ fontSize: 17, fontWeight: 800 }}>📊 Finance Mobile</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
          Lecture seule · Session temporaire
        </div>
      </div>

      <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>Données disponibles</div>
        <div style={{ fontSize: 13, lineHeight: '26px' }}>
          📊 Rapport de ventes (camions)<br />
          🏭 Inventaire &amp; projection<br />
          🔧 Ventes de pièces
        </div>
      </div>

      <button onClick={onLogout} style={{
        padding: '16px', borderRadius: 12, border: 'none',
        background: 'rgba(220,38,38,0.15)', color: '#fca5a5',
        fontSize: 15, fontWeight: 700, cursor: 'pointer',
      }}>
        🔒 Verrouiller l'application
      </button>

      <a href="/" style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12, textDecoration: 'none' }}>
        ← Retour app principale
      </a>
    </div>
  );
}

// ─── Navigation ────────────────────────────────────────────────────────────────

type Tab = 'ventes' | 'inventaire' | 'pieces' | 'info';
const TABS: { id: Tab; emoji: string; label: string }[] = [
  { id: 'ventes',     emoji: '📊', label: 'Ventes'     },
  { id: 'inventaire', emoji: '🏭', label: 'Inventaire' },
  { id: 'pieces',     emoji: '🔧', label: 'Pièces'     },
  { id: 'info',       emoji: '⚙️', label: 'Info'       },
];

// ─── Composant principal ───────────────────────────────────────────────────────

export function VueFinanceMobile({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('ventes');

  const titles: Record<Tab, string> = {
    ventes:     'Rapport de ventes',
    inventaire: 'Inventaire & Projection',
    pieces:     'Ventes de pièces',
    info:       'Information',
  };

  return (
    <div style={{
      width: '100vw', height: '100dvh', overflow: 'hidden',
      background: BG, color: 'white',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Barre supérieure */}
      <div style={{
        background: 'rgba(0,0,0,0.35)', borderBottom: `1px solid ${BORDER}`,
        padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
      }}>
        <span style={{ fontSize: 20 }}>📊</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.06em', color: AMBER }}>FINANCES</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{titles[tab]} · Lecture seule</div>
        </div>
      </div>

      {/* Contenu */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 76 }}>
        {tab === 'ventes'     && <TabVentes />}
        {tab === 'inventaire' && <TabInventaire />}
        {tab === 'pieces'     && <TabPieces />}
        {tab === 'info'       && <TabInfo onLogout={onLogout} />}
      </div>

      {/* Navigation en bas */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#0d1525', borderTop: `1px solid ${BORDER}`,
        display: 'flex', paddingBottom: 'env(safe-area-inset-bottom)',
        flexShrink: 0, zIndex: 100,
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, border: 'none', background: 'transparent',
            color: tab === t.id ? AMBER : 'rgba(255,255,255,0.4)',
            padding: '12px 0 10px', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            transition: 'color 0.15s',
            borderTop: tab === t.id ? `2px solid ${AMBER}` : '2px solid transparent',
          }}>
            <span style={{ fontSize: 22 }}>{t.emoji}</span>
            <span style={{ fontSize: 10, fontWeight: 600 }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
