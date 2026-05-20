// ════════════════════════════════════════════════════════════════
// Finance Mobile — Vue principale (lecture seule)
// Tabs : 📊 Ventes · 🏭 Inventaire · 🔧 Pièces · ⚙️ Info
// ════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { nomVendeur } from '../services/piecesImportService';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const AMBER    = '#f59e0b';
const BG       = '#0f172a';
const CARD_BG  = 'rgba(255,255,255,0.05)';
const BORDER   = 'rgba(255,255,255,0.08)';
const PAGE_SZ  = 500;

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmt$ = (n: number | null | undefined) =>
  n == null
    ? '—'
    : new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);

const fmtPct = (n: number | null | undefined) =>
  n == null ? '—' : `${Number(n).toFixed(1)} %`;

function currentFY(): number {
  const now = new Date();
  const m   = now.getMonth(); // 0-based; 6 = juillet
  const y   = now.getFullYear();
  return m >= 6 ? y : y - 1;
}

/** Pagine automatiquement pour contourner la limite 1000 lignes de Supabase. */
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
  annee_fiscale:   number | null;
  date_vente:      string | null;
  client:          string | null;
  stock_numero:    string;
  marque:          string | null;
  modele:          string | null;
  annee:           number | null;
  type_vente_label: string | null;
  prix_achat_reel: number | null;
  cout_mo:         number | null;
  cout_total:      number | null;
  prix_vente:      number | null;
  marge_profit:    number | null;
  pct_profit:      number | null;
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
  client:          string | null;
}

// ─── Composants communs ────────────────────────────────────────────────────────

function KpiCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      background: CARD_BG, border: `1px solid ${BORDER}`,
      borderRadius: 12, padding: '14px 16px',
    }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: color ?? 'white', lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ textAlign: 'center', padding: 48, color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
      ⏳ Chargement…
    </div>
  );
}

function FySelector({ fy, onChange }: { fy: number; onChange: (y: number) => void }) {
  const cur = currentFY();
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      {[cur - 1, cur].map(y => (
        <button key={y} onClick={() => onChange(y)} style={{
          flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
          background: fy === y ? AMBER : CARD_BG,
          color: fy === y ? '#000' : 'rgba(255,255,255,0.6)',
          fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'all 0.15s',
        }}>
          {fy === y ? '★ ' : ''}AF {y}
        </button>
      ))}
    </div>
  );
}

// ─── Onglet Ventes ─────────────────────────────────────────────────────────────

function TabVentes() {
  const [rows,    setRows]    = useState<VenteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fy,      setFy]      = useState(currentFY());

  useEffect(() => {
    setLoading(true);
    fetchAll<VenteRow>(
      'prod_rapport_profitabilite',
      'annee_fiscale,date_vente,client,stock_numero,marque,modele,annee,type_vente_label,prix_achat_reel,cout_mo,cout_total,prix_vente,marge_profit,pct_profit',
      q => q.eq('annee_fiscale', fy).order('date_vente', { ascending: false }),
    ).then(data => { setRows(data); setLoading(false); });
  }, [fy]);

  const totalCA    = rows.reduce((s, r) => s + (r.prix_vente    ?? 0), 0);
  const totalMarge = rows.reduce((s, r) => s + (r.marge_profit  ?? 0), 0);
  const pctMoy     = totalCA > 0 ? (totalMarge / totalCA * 100) : 0;

  return (
    <div style={{ padding: 16 }}>
      <FySelector fy={fy} onChange={setFy} />

      {loading ? <Spinner /> : (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <KpiCard label="Camions vendus"  value={String(rows.length)} />
            <KpiCard label="Marge moyenne"   value={fmtPct(pctMoy)}
              color={pctMoy > 10 ? '#4ade80' : pctMoy > 5 ? AMBER : '#f87171'} />
            <KpiCard label="CA total"        value={fmt$(totalCA)} />
            <KpiCard label="Marge totale"    value={fmt$(totalMarge)}
              color={totalMarge >= 0 ? '#4ade80' : '#f87171'} />
          </div>

          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>
            {rows.length} ventes · AF{fy}
          </div>

          {/* Liste des ventes */}
          {rows.map(r => (
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
                    {r.date_vente ? r.date_vente.slice(0, 10) : '—'} · {r.client ?? '—'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{fmt$(r.prix_vente)}</div>
                  <div style={{
                    fontSize: 12, fontWeight: 600,
                    color: (r.marge_profit ?? 0) >= 0 ? '#4ade80' : '#f87171',
                  }}>
                    {fmt$(r.marge_profit)}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                    {fmtPct(r.pct_profit)} · {r.type_vente_label ?? '—'}
                  </div>
                </div>
              </div>
            </div>
          ))}
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

  const totalAchat = rows.reduce((s, r) => s + (r.prix_achat_reel     ?? 0), 0);
  const totalMO    = rows.reduce((s, r) => s + (r.cout_total_depense   ?? 0), 0);
  const moyAge     = rows.length > 0
    ? Math.round(rows.reduce((s, r) => s + (r.age_jours ?? 0), 0) / rows.length)
    : 0;

  return (
    <div style={{ padding: 16 }}>
      {loading ? <Spinner /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <KpiCard label="En inventaire"   value={String(rows.length)} />
            <KpiCard label="Âge moyen"       value={`${moyAge} j`} />
            <KpiCard label="Coûts d'achat"   value={fmt$(totalAchat)} />
            <KpiCard label="M.O. dépensée"   value={fmt$(totalMO)} color={AMBER} />
          </div>

          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>
            {rows.length} camions en stock
          </div>

          {rows.map(r => (
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
                    {r.date_achat ? r.date_achat.slice(0, 10) : '—'}
                    {r.type_vehicule ? ` · ${r.type_vehicule}` : ''}
                    {r.age_jours != null ? ` · ${r.age_jours} j` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{fmt$(r.prix_achat_reel)}</div>
                  {(r.cout_total_depense ?? 0) > 0 && (
                    <div style={{ fontSize: 11, color: AMBER }}>
                      +{fmt$(r.cout_total_depense)} M.O.
                    </div>
                  )}
                  {r.prix_demande != null && (
                    <div style={{ fontSize: 11, color: '#60a5fa' }}>
                      Dem. {fmt$(r.prix_demande)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ─── Onglet Pièces ─────────────────────────────────────────────────────────────

function TabPieces() {
  const [rows,    setRows]    = useState<PieceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fy,      setFy]      = useState(currentFY());

  useEffect(() => {
    setLoading(true);
    fetchAll<PieceRow>(
      'prod_ventes_pieces',
      'document_numero,vendeur,sous_total,date_vente,annee_fiscale,client',
      q => q.eq('annee_fiscale', fy),
    ).then(data => { setRows(data); setLoading(false); });
  }, [fy]);

  const brut    = rows.reduce((s, r) => s + Math.max(r.sous_total, 0), 0);
  const retours = rows.reduce((s, r) => s + Math.min(r.sous_total, 0), 0);
  const net     = rows.reduce((s, r) => s + r.sous_total, 0);
  const nbRet   = rows.filter(r => r.sous_total < 0).length;

  // Regrouper par vendeur, trié par total décroissant
  const byVendeur = rows.reduce<Record<string, { nb: number; total: number }>>((acc, r) => {
    const k = r.vendeur ?? '(aucun)';
    if (!acc[k]) acc[k] = { nb: 0, total: 0 };
    acc[k].nb++;
    acc[k].total += r.sous_total;
    return acc;
  }, {});

  const vendeurs = Object.entries(byVendeur).sort((a, b) => b[1].total - a[1].total);
  const maxTotal = vendeurs.length > 0 ? Math.max(...vendeurs.map(([, v]) => v.total)) : 1;

  return (
    <div style={{ padding: 16 }}>
      <FySelector fy={fy} onChange={setFy} />

      {loading ? <Spinner /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <KpiCard label="Factures"      value={String(rows.length)} />
            <KpiCard label={`Net AF${fy}`} value={fmt$(net)} color={net >= 0 ? '#4ade80' : '#f87171'} />
            <KpiCard label="Ventes brutes" value={fmt$(brut)} />
            <KpiCard label={`Retours (${nbRet})`} value={fmt$(retours)} color="#f87171" />
          </div>

          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'rgba(255,255,255,0.7)' }}>
            Par vendeur
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
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontSize: 15, fontWeight: 700,
                      color: stat.total >= 0 ? '#4ade80' : '#f87171',
                    }}>
                      {fmt$(stat.total)}
                    </div>
                  </div>
                </div>
                {/* Barre proportionnelle */}
                <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
                  <div style={{
                    height: '100%', borderRadius: 2, transition: 'width 0.4s',
                    background: stat.total >= 0 ? '#4ade80' : '#f87171',
                    width: `${Math.max(pct, 2)}%`,
                  }} />
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

// ─── Onglet Info ───────────────────────────────────────────────────────────────

function TabInfo({ onLogout }: { onLogout: () => void }) {
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <img
        src="/logo-camions-dubois-_-noir-bleu-1.png"
        alt="Camions Dubois"
        style={{ height: 48, filter: 'brightness(0) invert(1)', alignSelf: 'center', marginBottom: 8 }}
      />

      <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Module</div>
        <div style={{ fontSize: 17, fontWeight: 800 }}>📊 Finance Mobile</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
          Lecture seule · Session temporaire (ferme l'onglet = verrouillé)
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

      <button
        onClick={onLogout}
        style={{
          padding: '16px', borderRadius: 12, border: 'none',
          background: 'rgba(220,38,38,0.15)', color: '#fca5a5',
          fontSize: 15, fontWeight: 700, cursor: 'pointer',
        }}
      >
        🔒 Verrouiller l'application
      </button>

      <a href="/" style={{
        textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12, textDecoration: 'none',
      }}>
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
      {/* ── Barre supérieure ─────────────────────────────────── */}
      <div style={{
        background: 'rgba(0,0,0,0.35)',
        borderBottom: `1px solid ${BORDER}`,
        padding: '11px 16px',
        display: 'flex', alignItems: 'center', gap: 10,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 20 }}>📊</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.06em', color: AMBER }}>
            FINANCES
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
            {titles[tab]} · Lecture seule
          </div>
        </div>
      </div>

      {/* ── Contenu ────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 76 }}>
        {tab === 'ventes'     && <TabVentes />}
        {tab === 'inventaire' && <TabInventaire />}
        {tab === 'pieces'     && <TabPieces />}
        {tab === 'info'       && <TabInfo onLogout={onLogout} />}
      </div>

      {/* ── Navigation en bas ──────────────────────────────────── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#0d1525',
        borderTop: `1px solid ${BORDER}`,
        display: 'flex',
        paddingBottom: 'env(safe-area-inset-bottom)',
        flexShrink: 0,
        zIndex: 100,
      }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, border: 'none', background: 'transparent',
              color: tab === t.id ? AMBER : 'rgba(255,255,255,0.4)',
              padding: '12px 0 10px',
              cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              transition: 'color 0.15s',
              borderTop: tab === t.id ? `2px solid ${AMBER}` : '2px solid transparent',
            }}
          >
            <span style={{ fontSize: 22 }}>{t.emoji}</span>
            <span style={{ fontSize: 10, fontWeight: 600 }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
