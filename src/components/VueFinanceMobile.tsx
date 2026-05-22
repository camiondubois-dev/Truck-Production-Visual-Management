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

function groupByWeek(rows: { date_vente: string | null; val: number }[]): { label: string; date: string; total: number }[] {
  const map: Record<string, number> = {};
  for (const row of rows) {
    if (!row.date_vente) continue;
    const d = new Date(row.date_vente + 'T12:00:00');
    const day = d.getDay(); // 0=dim
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1)); // lundi de la semaine
    const key = d.toISOString().slice(0, 10);
    map[key] = (map[key] ?? 0) + row.val;
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({ date, label: date.slice(5).replace('-', '/'), total }));
}

/** Récupère la photo d'un camion depuis prod_inventaire (lazy, pour les drawers). */
async function fetchPhotoUrl(stockNumero: string): Promise<string | null> {
  const { data } = await supabase
    .from('prod_inventaire')
    .select('photo_url')
    .eq('numero', stockNumero)
    .maybeSingle();
  return (data as any)?.photo_url ?? null;
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
  marge_profit:      number | null;
  pct_profit:        number | null;
  jours_inventaire:  number | null;
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
  const [rowsCurr,      setRowsCurr]      = useState<VenteRow[]>([]);
  const [rowsPrev,      setRowsPrev]      = useState<VenteRow[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [fy,            setFy]            = useState(currentFY());
  const [viewMode,      setViewMode]      = useState<'list' | 'chart'>('list');
  const [selectedVente, setSelectedVente] = useState<VenteRow | null>(null);
  const [drawerPhoto,   setDrawerPhoto]   = useState<string | null>(null);

  // Fetch photo lazily quand un camion est sélectionné
  useEffect(() => {
    if (!selectedVente) { setDrawerPhoto(null); return; }
    fetchPhotoUrl(selectedVente.stock_numero).then(setDrawerPhoto);
  }, [selectedVente]);

  useEffect(() => {
    setLoading(true);
    const fields = 'annee_fiscale,date_vente,client,stock_numero,marque,modele,annee,type_vente_label,prix_achat_reel,cout_mo,cout_total,prix_vente,marge_profit,pct_profit,jours_inventaire';
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
                {rowsCurr.length} ventes · AF{fy} · Appuie sur un camion pour les détails
              </div>
              {rowsCurr.map(r => {
                const margeColor = (r.marge_profit ?? 0) >= 0 ? GREEN : RED;
                const pct = r.pct_profit ?? 0;
                return (
                  <div
                    key={r.stock_numero}
                    onClick={() => setSelectedVente(r)}
                    style={{
                      background: CARD_BG, border: `1px solid ${BORDER}`,
                      borderRadius: 10, padding: '12px 14px', marginBottom: 8,
                      cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                        <div style={{ fontSize: 11, color: AMBER, fontWeight: 700 }}>#{r.stock_numero}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {r.annee} {r.marque} {r.modele}
                        </div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                          {r.date_vente?.slice(0, 10)} · {r.client ?? '—'}
                        </div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>
                          {r.type_vente_label ?? '—'}
                          {r.jours_inventaire != null && (
                            <span style={{ marginLeft: 8, color: r.jours_inventaire <= 60 ? GREEN : r.jours_inventaire <= 120 ? AMBER : RED, fontWeight: 700 }}>
                              📅 {r.jours_inventaire} j
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{fmt$(r.prix_vente)}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: margeColor }}>{fmt$(r.marge_profit)}</div>
                        <div style={{
                          fontSize: 13, fontWeight: 800, color: margeColor,
                          background: `${margeColor}18`, borderRadius: 6,
                          padding: '2px 7px', marginTop: 3,
                        }}>
                          {pct.toFixed(1)} %
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </>
      )}

      {/* ── Drawer détail vente ── */}
      {selectedVente && (() => {
        const r = selectedVente;
        const margeColor = (r.marge_profit ?? 0) >= 0 ? GREEN : RED;
        const pct = r.pct_profit ?? 0;
        const total = (r.prix_achat_reel ?? 0) + (r.cout_mo ?? 0);
        const jouColor = r.jours_inventaire == null ? 'rgba(255,255,255,0.4)'
          : r.jours_inventaire <= 60  ? GREEN
          : r.jours_inventaire <= 120 ? AMBER : RED;

        return (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)' }}
            onClick={() => setSelectedVente(null)}
          >
            <div
              style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#0f172a', borderRadius: '20px 20px 0 0', padding: '8px 16px 80px', maxHeight: '90dvh', overflowY: 'auto' }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.18)', borderRadius: 2, margin: '10px auto 18px' }} />

              {/* Photo du camion */}
              {drawerPhoto && (
                <div style={{ marginBottom: 14, borderRadius: 12, overflow: 'hidden', maxHeight: 200 }}>
                  <img
                    src={drawerPhoto}
                    alt="Photo camion"
                    style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }}
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              )}

              {/* En-tête */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: AMBER, fontWeight: 800 }}>#{r.stock_numero} · {r.type_vente_label ?? '—'}</div>
                <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.2, marginTop: 2 }}>
                  {[r.annee, r.marque, r.modele].filter(Boolean).join(' ') || '—'}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                  Vendu le {r.date_vente?.slice(0, 10) ?? '—'} · {r.client ?? '—'}
                </div>
              </div>

              {/* % Profitabilité — mis en évidence */}
              <div style={{
                background: `${margeColor}15`, border: `2px solid ${margeColor}55`,
                borderRadius: 14, padding: '16px', marginBottom: 16, textAlign: 'center',
              }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>Profitabilité</div>
                <div style={{ fontSize: 42, fontWeight: 900, color: margeColor, lineHeight: 1 }}>
                  {pct.toFixed(1)} %
                </div>
                <div style={{ fontSize: 13, color: margeColor, fontWeight: 700, marginTop: 6 }}>
                  {fmt$(r.marge_profit)} de profit
                </div>
              </div>

              {/* KPIs coûts */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <KpiCard label="Prix de vente"    value={fmt$(r.prix_vente)}       color="white" />
                <KpiCard label="Coût total"        value={fmt$(r.cout_total ?? total)} />
                <KpiCard label="Coût d'achat"     value={fmt$(r.prix_achat_reel)}  />
                <KpiCard label="Main-d'œuvre"     value={fmt$(r.cout_mo)}          color={AMBER} />
              </div>

              {/* Jours en inventaire */}
              {r.jours_inventaire != null && (
                <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>📅 Jours en inventaire</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: jouColor }}>{r.jours_inventaire} jours</span>
                </div>
              )}

              <button
                onClick={() => setSelectedVente(null)}
                style={{ display: 'block', width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
              >
                Fermer
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Onglet Inventaire ─────────────────────────────────────────────────────────

function TabInventaire() {
  const [rows,        setRows]        = useState<InvRow[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [selectedInv, setSelectedInv] = useState<InvRow | null>(null);
  const [drawerPhoto, setDrawerPhoto] = useState<string | null>(null);
  // Locations actives par stock_numero (revenu cumulé + montant mensuel)
  const [locByStock,  setLocByStock]  = useState<Record<string, { revenuCumule: number; montantMensuel: number; dateDebut: string; client: string | null }>>({});

  // Fetch photo lazily quand un camion est sélectionné
  useEffect(() => {
    if (!selectedInv) { setDrawerPhoto(null); return; }
    fetchPhotoUrl(selectedInv.stock_numero).then(setDrawerPhoto);
  }, [selectedInv]);

  useEffect(() => {
    fetchAll<InvRow>(
      'prod_inventaire_couts',
      'stock_numero,type_vehicule,date_achat,age_jours,cout_achat,cout_total_depense,prix_achat_reel,prix_demande,marque,modele,annee',
      q => q.order('cout_achat', { ascending: false }),
    ).then(data => { setRows(data); setLoading(false); });

    // Locations actives — pour afficher badge + revenu cumulé sur les cards
    supabase
      .from('prod_locations_avec_cumul')
      .select('stock_numero, revenu_cumule, montant_mensuel, date_debut, client')
      .is('date_fin', null)
      .then(({ data }) => {
        const map: typeof locByStock = {};
        for (const r of (data ?? []) as any[]) {
          map[r.stock_numero] = {
            revenuCumule:   Number(r.revenu_cumule ?? 0),
            montantMensuel: Number(r.montant_mensuel ?? 0),
            dateDebut:      r.date_debut,
            client:         r.client ?? null,
          };
        }
        setLocByStock(map);
      });
  }, []);

  const totalAchat   = rows.reduce((s, r) => s + (r.prix_achat_reel   ?? 0), 0);
  const totalMO      = rows.reduce((s, r) => s + (r.cout_total_depense ?? 0), 0);
  const totalInvesti = totalAchat + totalMO;
  const moyAge       = rows.length > 0
    ? Math.round(rows.reduce((s, r) => s + (r.age_jours ?? 0), 0) / rows.length) : 0;

  function ageColor(j: number | null) {
    if (j == null) return 'rgba(255,255,255,0.4)';
    if (j > 365) return RED;
    if (j > 180) return AMBER;
    return GREEN;
  }

  return (
    <div style={{ padding: 16 }}>
      {loading ? <Spinner /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <KpiCard label="En inventaire" value={String(rows.length)} />
            <KpiCard label="Âge moyen"     value={`${moyAge} j`} />
            <KpiCard label="Total investi" value={fmt$(totalInvesti)} color={AMBER}
              sub={`Achat ${fmt$(totalAchat)} + MO ${fmt$(totalMO)}`} />
            <KpiCard label="M.O. dépensée" value={fmt$(totalMO)} />
          </div>

          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>
            {rows.length} camions en stock · Appuie sur un camion pour les détails
          </div>

          {rows.map(r => {
            const achat  = r.prix_achat_reel    ?? 0;
            const mo     = r.cout_total_depense ?? 0;
            const total  = achat + mo;
            const profit = r.prix_demande != null ? r.prix_demande - total : null;
            const pctProj = r.prix_demande != null && r.prix_demande > 0 && profit != null
              ? (profit / r.prix_demande) * 100 : null;
            const profitColor = profit == null ? 'white' : profit >= 0 ? GREEN : RED;
            const loc = locByStock[r.stock_numero];  // location active sur ce camion (ou undefined)

            return (
              <div
                key={r.stock_numero}
                onClick={() => setSelectedInv(r)}
                style={{
                  background: CARD_BG, border: `1px solid ${BORDER}`,
                  borderRadius: 10, padding: '12px 14px', marginBottom: 8,
                  cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                  transition: 'border-color 0.15s',
                }}
              >
                {/* Ligne principale : infos gauche / coûts droite */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 1, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: AMBER, fontWeight: 700 }}>#{r.stock_numero}</span>
                      {r.age_jours != null && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '1px 6px',
                          borderRadius: 8, background: `${ageColor(r.age_jours)}22`,
                          color: ageColor(r.age_jours),
                        }}>
                          {r.age_jours} j
                        </span>
                      )}
                      {loc && (
                        <span style={{
                          fontSize: 10, fontWeight: 800, padding: '1px 6px',
                          borderRadius: 8, background: '#8b5cf622', color: '#a78bfa',
                          letterSpacing: '0.04em',
                        }}>
                          🔁 LOCATION
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.annee} {r.marque} {r.modele}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                      {r.date_achat?.slice(0, 10) ?? '—'}
                      {r.type_vehicule ? ` · ${r.type_vehicule}` : ''}
                    </div>
                    {r.prix_demande != null && (
                      <div style={{ fontSize: 10, color: '#60a5fa', marginTop: 2 }}>
                        Prix dem. {fmt$(r.prix_demande)}
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>Achat {fmt$(achat)}</div>
                    {mo > 0 && <div style={{ fontSize: 11, color: AMBER }}>+ M.O. {fmt$(mo)}</div>}
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'white', borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 4, paddingTop: 4 }}>
                      {fmt$(total)}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>→ détails</div>
                  </div>
                </div>

                {/* Bande profit projeté — centrée, visible uniquement si prix demandé connu */}
                {profit != null && (
                  <div style={{
                    marginTop: 10, paddingTop: 8,
                    borderTop: `1px solid rgba(255,255,255,0.07)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: profitColor }}>
                      {fmt$(profit)}
                    </span>
                    {pctProj != null && (
                      <span style={{
                        fontSize: 13, fontWeight: 800, color: profitColor,
                        background: `${profitColor}20`, borderRadius: 6, padding: '2px 9px',
                      }}>
                        {pctProj.toFixed(1)} %
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)' }}>proj.</span>
                  </div>
                )}

                {/* Bande revenu de location cumulé — visible uniquement si location active */}
                {loc && (
                  <div style={{
                    marginTop: 8, paddingTop: 8,
                    borderTop: `1px solid rgba(139,92,246,0.15)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 8, fontSize: 11,
                  }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>
                      Location · {fmt$(loc.montantMensuel)}/mois
                      {loc.client && <span style={{ marginLeft: 6, color: 'rgba(255,255,255,0.35)' }}>· {loc.client}</span>}
                    </span>
                    <span style={{ fontWeight: 800, fontSize: 13, color: '#a78bfa' }}>
                      + {fmt$(loc.revenuCumule)} cumulé
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* ── Drawer détail camion inventaire ── */}
      {selectedInv && (() => {
        const r = selectedInv;
        const achat  = r.prix_achat_reel    ?? 0;
        const mo     = r.cout_total_depense ?? 0;
        const total  = achat + mo;
        const profit = r.prix_demande ? r.prix_demande - total : null;
        const pct    = r.prix_demande && r.prix_demande > 0 && profit != null
          ? (profit / r.prix_demande) * 100 : null;
        const profitColor = profit == null ? 'white' : profit >= 0 ? GREEN : RED;

        return (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)' }}
            onClick={() => setSelectedInv(null)}
          >
            <div
              style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: '#0f172a', borderRadius: '20px 20px 0 0',
                padding: '8px 16px 80px', maxHeight: '90dvh', overflowY: 'auto',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Poignée */}
              <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.18)', borderRadius: 2, margin: '10px auto 14px' }} />

              {/* Photo du camion */}
              {drawerPhoto && (
                <div style={{ marginBottom: 14, borderRadius: 12, overflow: 'hidden', maxHeight: 200, marginLeft: -16, marginRight: -16 }}>
                  <img
                    src={drawerPhoto}
                    alt="Photo camion"
                    style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }}
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              )}

              {/* En-tête */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: AMBER, fontWeight: 800, marginBottom: 2 }}>#{r.stock_numero}</div>
                  <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.2 }}>
                    {[r.annee, r.marque, r.modele].filter(Boolean).join(' ') || '—'}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                    Type : <span style={{ color: r.type_vehicule === 'eau' ? '#0ea5e9' : '#22c55e', fontWeight: 700 }}>{r.type_vehicule ?? '—'}</span>
                  </div>
                </div>
                {r.age_jours != null && (
                  <div style={{ background: `${ageColor(r.age_jours)}18`, border: `1px solid ${ageColor(r.age_jours)}44`, borderRadius: 10, padding: '8px 12px', textAlign: 'center', flexShrink: 0, marginLeft: 10 }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: ageColor(r.age_jours), lineHeight: 1 }}>{r.age_jours}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>jours stock</div>
                  </div>
                )}
              </div>

              {/* Date achat */}
              {r.date_achat && (
                <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Date d'achat</span>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{r.date_achat.slice(0, 10)}</span>
                </div>
              )}

              {/* Coûts */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <KpiCard label="Coût d'achat"   value={fmt$(achat)} />
                <KpiCard label="M.O. + Pièces"  value={fmt$(mo)}    color={mo > 0 ? AMBER : undefined} />
              </div>
              <div style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid rgba(255,255,255,0.12)`, borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>Total investi</span>
                <span style={{ fontSize: 18, fontWeight: 900, color: 'white' }}>{fmt$(total)}</span>
              </div>

              {/* Prix demandé + profitabilité */}
              {r.prix_demande ? (
                <>
                  <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>Prix demandé</span>
                    <span style={{ fontSize: 18, fontWeight: 900, color: GREEN }}>{fmt$(r.prix_demande)}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                    <KpiCard label="Profit projeté" value={fmt$(profit)} color={profitColor} />
                    <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '12px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>Marge projetée</div>
                      <div style={{ fontSize: 26, fontWeight: 900, color: profitColor, lineHeight: 1 }}>
                        {pct != null ? `${pct.toFixed(1)}%` : '—'}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid rgba(255,255,255,0.08)`, borderRadius: 10, padding: '12px 16px', marginBottom: 16, textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                  Aucun prix demandé — marge non calculable
                </div>
              )}

              <button
                onClick={() => setSelectedInv(null)}
                style={{ display: 'block', width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
              >
                Fermer
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Onglet Pièces ─────────────────────────────────────────────────────────────

function TabPieces() {
  const [rowsCurr, setRowsCurr] = useState<PieceRow[]>([]);
  const [rowsPrev, setRowsPrev] = useState<PieceRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [fy,       setFy]       = useState(currentFY());
  const [viewMode, setViewMode] = useState<'chart' | 'semaines' | 'vendeurs'>('chart');

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

      {/* Toggle graphique / semaines / vendeurs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {(['chart', 'semaines', 'vendeurs'] as const).map(mode => (
          <button key={mode} onClick={() => setViewMode(mode)} style={{
            flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
            background: viewMode === mode ? 'rgba(255,255,255,0.15)' : CARD_BG,
            color: viewMode === mode ? 'white' : 'rgba(255,255,255,0.4)',
            fontSize: 11, fontWeight: 700, cursor: 'pointer',
          }}>
            {mode === 'chart' ? '📅 Mensuel' : mode === 'semaines' ? '📆 Semaines' : '👤 Vendeurs'}
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
          ) : viewMode === 'semaines' ? (() => {
            const semaines = groupByWeek(
              rowsCurr.map(r => ({ date_vente: r.date_vente, val: Math.max(r.sous_total, 0) }))
            );
            // Dernières 16 semaines seulement
            const display = semaines.slice(-16);
            const maxVal  = Math.max(...display.map(s => s.total), 1);
            return (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 10 }}>
                  Ventes brutes par semaine — AF{fy} {semaines.length > 16 ? `(16 dernières sur ${semaines.length})` : ''}
                </div>
                <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 14px 10px' }}>
                  {display.length === 0 && (
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                      Aucune donnée pour cette période
                    </div>
                  )}
                  {display.map(s => {
                    const pct = (s.total / maxVal) * 100;
                    return (
                      <div key={s.date} style={{ marginBottom: 9 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Sem. {s.label}</span>
                          <span style={{ fontSize: 10, color: AMBER, fontWeight: 700 }}>{fmt$(s.total)}</span>
                        </div>
                        <div style={{ height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.max(pct, 1)}%`, height: '100%', background: AMBER, borderRadius: 3, transition: 'width 0.4s' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })() : (
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

// ─── Onglet Plans de vente ─────────────────────────────────────────────────────

interface MobilePlan {
  id: string;
  nom: string;
  statut: 'brouillon' | 'actif' | 'archive';
  date_creation: string;
  date_activation: string | null;
  nb_vehicules: number;
  prix_total_projete: number;
  nb_vendus: number;
  revenus_realises: number;
  vehicules: MobilePlanVeh[];
}

interface MobilePlanVeh {
  stock_numero: string;
  prix_plan: number | null;
  marque: string;
  modele: string;
  annee: number | null;
  vendu: boolean;
  prix_vente_reel: number | null;
  photo_url: string | null;
}

function TabPlans() {
  const [plans,   setPlans]   = useState<MobilePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { charger(); }, []);

  async function charger() {
    setLoading(true);
    const [
      { data: plansData },
      { data: vehData },
      { data: ventesData },
      { data: invData },
    ] = await Promise.all([
      supabase.from('prod_plans_vente').select('*').order('date_creation', { ascending: false }),
      supabase.from('prod_plans_vente_vehicules').select('plan_id, stock_numero, prix_plan'),
      supabase.from('prod_ventes').select('stock_numero, prix_vente, statut'),
      supabase.from('prod_inventaire').select('numero, marque, modele, annee, photo_url'),
    ]);

    if (!plansData) { setLoading(false); return; }

    const venduSet = new Set(
      (ventesData ?? [])
        .filter((v: any) => v.statut === 'vendu')
        .map((v: any) => v.stock_numero)
    );
    const ventesPrix: Record<string, number> = {};
    (ventesData ?? []).forEach((v: any) => { if (v.prix_vente) ventesPrix[v.stock_numero] = v.prix_vente; });

    const invMap: Record<string, { marque: string; modele: string; annee: number | null; photo_url: string | null }> = {};
    (invData ?? []).forEach((r: any) => { invMap[r.numero] = { marque: r.marque ?? '', modele: r.modele ?? '', annee: r.annee ?? null, photo_url: r.photo_url ?? null }; });

    const result: MobilePlan[] = (plansData as any[]).map(p => {
      const planVeh = ((vehData ?? []) as any[]).filter(v => v.plan_id === p.id);
      const vehicules: MobilePlanVeh[] = planVeh.map((v: any) => ({
        stock_numero: v.stock_numero,
        prix_plan: v.prix_plan,
        marque: invMap[v.stock_numero]?.marque ?? '',
        modele: invMap[v.stock_numero]?.modele ?? '',
        annee: invMap[v.stock_numero]?.annee ?? null,
        vendu: venduSet.has(v.stock_numero),
        prix_vente_reel: ventesPrix[v.stock_numero] ?? null,
        photo_url: invMap[v.stock_numero]?.photo_url ?? null,
      }));
      const vendus = vehicules.filter(v => v.vendu);
      return {
        id: p.id,
        nom: p.nom,
        statut: p.statut,
        date_creation: p.date_creation,
        date_activation: p.date_activation,
        nb_vehicules: vehicules.length,
        prix_total_projete: vehicules.reduce((s, v) => s + (v.prix_plan ?? 0), 0),
        nb_vendus: vendus.length,
        revenus_realises: vendus.reduce((s, v) => s + (v.prix_vente_reel ?? 0), 0),
        vehicules,
      };
    });

    setPlans(result);
    setLoading(false);
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>⏳ Chargement…</div>;

  const planActif   = plans.find(p => p.statut === 'actif');
  const brouillons  = plans.filter(p => p.statut === 'brouillon');

  if (plans.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
        Aucun plan de vente créé.<br />
        <span style={{ fontSize: 12 }}>Crée un plan dans l'onglet Plans de vente sur ordinateur.</span>
      </div>
    );
  }

  function PlanCard({ plan }: { plan: MobilePlan }) {
    const reste = plan.prix_total_projete - plan.revenus_realises;
    const pctAvancement = plan.nb_vehicules > 0 ? (plan.nb_vendus / plan.nb_vehicules) * 100 : 0;
    const isOpen = expanded === plan.id;

    const statutColor = plan.statut === 'actif' ? AMBER : plan.statut === 'brouillon' ? '#60a5fa' : 'rgba(255,255,255,0.3)';
    const statutLabel = plan.statut === 'actif' ? '✅ ACTIF' : plan.statut === 'brouillon' ? '📝 BROUILLON' : '📦 ARCHIVÉ';

    return (
      <div style={{
        background: plan.statut === 'actif' ? 'rgba(245,158,11,0.07)' : CARD_BG,
        border: `1px solid ${plan.statut === 'actif' ? 'rgba(245,158,11,0.3)' : BORDER}`,
        borderRadius: 12, marginBottom: 12, overflow: 'hidden',
      }}>
        {/* En-tête */}
        <div
          onClick={() => setExpanded(isOpen ? null : plan.id)}
          style={{ padding: '14px 16px', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
              <div style={{ fontSize: 11, color: statutColor, fontWeight: 800, marginBottom: 2 }}>{statutLabel}</div>
              <div style={{ fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {plan.nom}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                {plan.nb_vendus}/{plan.nb_vehicules} camions vendus
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: AMBER }}>{fmt$(plan.prix_total_projete)}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>projeté</div>
            </div>
          </div>

          {/* Barre de progression */}
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 4, height: 6, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{ height: '100%', width: `${pctAvancement}%`, background: pctAvancement >= 100 ? GREEN : AMBER, borderRadius: 4, transition: 'width 0.4s' }} />
          </div>

          {/* KPIs compacts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { label: 'Réalisé', value: fmt$(plan.revenus_realises), color: GREEN },
              { label: 'Restant', value: fmt$(reste > 0 ? reste : 0),  color: reste > 0 ? RED : GREEN },
              { label: 'Avancement', value: `${Math.round(pctAvancement)} %`, color: pctAvancement >= 100 ? GREEN : AMBER },
            ].map(k => (
              <div key={k.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 10px' }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>{k.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 8 }}>
            {isOpen ? '▲ Masquer les camions' : '▼ Voir les camions'}
          </div>
        </div>

        {/* Liste des camions */}
        {isOpen && (
          <div style={{ borderTop: `1px solid ${BORDER}`, padding: '0 16px 12px' }}>
            {plan.vehicules.map(v => (
              <div key={v.stock_numero} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '9px 0', borderBottom: `1px solid rgba(255,255,255,0.04)`,
                opacity: v.vendu ? 0.55 : 1, gap: 10,
              }}>
                {/* Miniature photo */}
                {v.photo_url && (
                  <img
                    src={v.photo_url}
                    alt=""
                    style={{ width: 48, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: v.vendu ? GREEN : AMBER }}>
                      #{v.stock_numero}
                    </span>
                    {v.vendu && <span style={{ fontSize: 9, fontWeight: 800, background: 'rgba(74,222,128,0.15)', color: GREEN, padding: '1px 5px', borderRadius: 8 }}>VENDU</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {[v.annee, v.marque, v.modele].filter(Boolean).join(' ') || '—'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: v.vendu ? GREEN : 'white' }}>
                    {v.vendu ? fmt$(v.prix_vente_reel) : fmt$(v.prix_plan)}
                  </div>
                  {v.vendu && v.prix_plan && (
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                      prévu {fmt$(v.prix_plan)}
                    </div>
                  )}
                  {!v.vendu && (
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>projeté</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      {/* Plan actif en tête */}
      {planActif && (
        <>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Plan actif
          </div>
          <PlanCard plan={planActif} />
        </>
      )}

      {!planActif && (
        <div style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#93c5fd' }}>
          Aucun plan actif. Active un plan depuis l'ordinateur pour l'afficher ici.
        </div>
      )}

      {/* Brouillons */}
      {brouillons.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '16px 0 10px' }}>
            Brouillons ({brouillons.length})
          </div>
          {brouillons.map(p => <PlanCard key={p.id} plan={p} />)}
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
          🔧 Ventes de pièces<br />
          📋 Plans de vente
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

type Tab = 'ventes' | 'inventaire' | 'pieces' | 'plans' | 'info';
const TABS: { id: Tab; emoji: string; label: string }[] = [
  { id: 'ventes',     emoji: '📊', label: 'Ventes'     },
  { id: 'inventaire', emoji: '🏭', label: 'Inventaire' },
  { id: 'pieces',     emoji: '🔧', label: 'Pièces'     },
  { id: 'plans',      emoji: '📋', label: 'Plans'      },
  { id: 'info',       emoji: '⚙️', label: 'Info'       },
];

// ─── Composant principal ───────────────────────────────────────────────────────

export function VueFinanceMobile({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('ventes');

  const titles: Record<Tab, string> = {
    ventes:     'Rapport de ventes',
    inventaire: 'Inventaire & Projection',
    pieces:     'Ventes de pièces',
    plans:      'Plans de vente',
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
        {tab === 'plans'      && <TabPlans />}
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
