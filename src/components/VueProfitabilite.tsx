import { useState, useEffect, useMemo, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { supabase } from '../lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

interface VenteRapport {
  id: string;
  source: string;
  annee_fiscale: number;
  date_vente: string | null;
  so_numero: string | null;
  client: string | null;
  stock_numero: string;
  vehicule: string | null;
  annee: number | null;
  marque: string | null;
  modele: string | null;
  type_vente_label: string;
  date_achat: string | null;
  prix_achat_reel: number | null;
  cout_mo: number | null;
  cout_total: number | null;
  prix_vente: number;
  marge_profit: number | null;
  pct_profit: number | null;
  type?: string;
}

interface InventaireRow {
  stock_numero: string;
  statut: string | null;
  type_vehicule: string;
  date_achat: string | null;
  age_jours: number | null;
  cout_achat: number;
  cout_total_depense: number | null;
  budget_restant: number | null;
  projected_deficit: number | null;
  remaining_market: number | null;
  prix_achat_reel: number | null;
  prix_demande: number | null;
  marque?: string;
  modele?: string;
  annee?: number;
  type?: string;
}

interface InvMeta {
  numero: string;
  marque: string | null;
  modele: string | null;
  annee: number | null;
  type: string | null;
}

interface PlanResume {
  id: string;
  nom: string;
  statut: 'brouillon' | 'actif' | 'archive';
  date_creation: string;
  date_activation: string | null;
  nb_vehicules: number;
  prix_total_projete: number;
  nb_vendus: number;
  revenus_realises: number;
}

interface PlanVehicule {
  id: string;
  plan_id: string;
  stock_numero: string;
  prix_plan: number | null;
  marque?: string;
  modele?: string;
  annee?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt$(n: number | null | undefined, decimals = 0): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency', currency: 'CAD',
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  }).format(n);
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${n > 0 ? '+' : ''}${n.toFixed(1)} %`;
}

function profitColor(v: number | null | undefined): string {
  if (v == null) return 'rgba(255,255,255,0.5)';
  return v >= 0 ? '#22c55e' : '#ef4444';
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)].sort() as T[];
}

function fmtDate(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('fr-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Filtres ───────────────────────────────────────────────────────────────────

function Select({
  label, options, value, onChange,
}: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: '#1a1917', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 8, color: value ? 'white' : 'rgba(255,255,255,0.4)',
        padding: '7px 28px 7px 12px', fontSize: 13, cursor: 'pointer',
        fontFamily: 'system-ui, sans-serif', appearance: 'none',
        backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'8\' viewBox=\'0 0 12 8\'%3E%3Cpath d=\'M1 1l5 5 5-5\' stroke=\'rgba(255,255,255,0.3)\' stroke-width=\'1.5\' fill=\'none\'/%3E%3C/svg%3E")',
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
      }}
    >
      <option value="">{label}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div style={{
      background: '#1a1917', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10, padding: '14px 20px', flex: 1, minWidth: 140,
    }}>
      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</div>
      <div style={{ color: color || 'white', fontSize: 20, fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ── Badge statut ──────────────────────────────────────────────────────────────

function StatutBadge({ statut }: { statut: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    brouillon: { bg: '#6b728020', color: '#9ca3af', label: 'Brouillon' },
    actif:     { bg: '#22c55e20', color: '#22c55e', label: 'Actif' },
    archive:   { bg: '#1e293b',   color: '#475569', label: 'Archivé' },
  };
  const s = map[statut] ?? map.brouillon;
  return (
    <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
      {s.label}
    </span>
  );
}

// ── Modal création plan ────────────────────────────────────────────────────────

function ModalCreerPlan({
  stocks,
  simPrix,
  rows,
  invMeta,
  onClose,
  onCreated,
}: {
  stocks: string[];
  simPrix: Record<string, string>;
  rows: InventaireRow[];
  invMeta: InvMeta[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [nom, setNom] = useState('');
  const [desc, setDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const metaMap = Object.fromEntries(invMeta.map(m => [m.numero, m]));
  const rowMap = Object.fromEntries(rows.map(r => [r.stock_numero, r]));

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function creer() {
    if (!nom.trim()) return;
    setSaving(true);
    setErreur('');
    const { data: plan, error } = await supabase
      .from('prod_plans_vente')
      .insert({ nom: nom.trim(), description: desc.trim() || null, statut: 'brouillon' })
      .select()
      .single();
    if (error || !plan) {
      setErreur(error?.message ?? 'Erreur inconnue — as-tu roulé le SQL 2026-05-05_plans_vente.sql dans Supabase?');
      setSaving(false);
      return;
    }

    const vehicules = stocks.map(stock => {
      const row = rowMap[stock];
      const simVal = simPrix[stock];
      const prix = simVal ? parseFloat(simVal) || null : (row?.prix_demande ?? null);
      return { plan_id: plan.id, stock_numero: stock, prix_plan: prix };
    });
    await supabase.from('prod_plans_vente_vehicules').insert(vehicules);
    onCreated(plan.id);
  }

  const total = stocks.reduce((s, stock) => {
    const simVal = simPrix[stock];
    const row = rowMap[stock];
    const prix = simVal ? parseFloat(simVal) || 0 : (row?.prix_demande ?? 0);
    return s + prix;
  }, 0);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999,
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#1a1917', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 14, padding: 28, width: 460, maxWidth: '90vw',
      }}>
        <div style={{ color: 'white', fontSize: 17, fontWeight: 700, marginBottom: 20 }}>
          Enregistrer comme plan de vente
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16, padding: '10px 14px', background: '#f59e0b10', border: '1px solid #f59e0b30', borderRadius: 8 }}>
          <div style={{ color: '#f59e0b', fontSize: 13 }}>
            <strong>{stocks.length}</strong> véhicule{stocks.length > 1 ? 's' : ''} sélectionné{stocks.length > 1 ? 's' : ''}
          </div>
          {total > 0 && (
            <div style={{ color: '#f59e0b', fontSize: 13, marginLeft: 'auto' }}>
              Prix total: <strong>{fmt$(total)}</strong>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>
            NOM DU PLAN *
          </label>
          <input
            ref={inputRef}
            value={nom}
            onChange={e => setNom(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') creer(); if (e.key === 'Escape') onClose(); }}
            placeholder="ex: Liquidation printemps 2026"
            style={{
              width: '100%', boxSizing: 'border-box',
              background: '#0f0e0b', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8, color: 'white', padding: '9px 12px',
              fontSize: 14, fontFamily: 'system-ui, sans-serif',
            }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>
            DESCRIPTION (optionnel)
          </label>
          <input
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="Notes sur ce plan..."
            style={{
              width: '100%', boxSizing: 'border-box',
              background: '#0f0e0b', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 8, color: 'white', padding: '9px 12px',
              fontSize: 13, fontFamily: 'system-ui, sans-serif',
            }}
          />
        </div>

        {erreur && (
          <div style={{ background: '#ef444415', border: '1px solid #ef444440', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#ef4444', fontSize: 12 }}>
            ⚠️ {erreur}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'rgba(255,255,255,0.5)', padding: '9px 20px', fontSize: 13, cursor: 'pointer' }}>
            Annuler
          </button>
          <button
            onClick={creer}
            disabled={!nom.trim() || saving}
            style={{ background: nom.trim() ? '#f59e0b' : '#6b7280', border: 'none', borderRadius: 8, color: 'white', padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: nom.trim() ? 'pointer' : 'not-allowed' }}
          >
            {saving ? 'Enregistrement...' : 'Créer le plan'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Vue Ventes ────────────────────────────────────────────────────────────────

function VueVentes({ invMeta }: { invMeta: InvMeta[] }) {
  const [rows, setRows] = useState<VenteRapport[]>([]);
  const [loading, setLoading] = useState(true);
  const [fType, setFType] = useState('');
  const [fMarque, setFMarque] = useState('');
  const [fModele, setFModele] = useState('');
  const [fAnnee, setFAnnee] = useState('');
  const [fStock, setFStock] = useState('');
  const [sortCol, setSortCol] = useState<string>('date_vente');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    supabase.from('prod_rapport_profitabilite').select('*').then(({ data }) => {
      if (!data) return;
      const metaMap = Object.fromEntries(invMeta.map(m => [m.numero, m]));
      const enriched = data.map((r: VenteRapport) => ({
        ...r,
        marque: r.marque ?? metaMap[r.stock_numero]?.marque ?? '',
        modele: r.modele ?? metaMap[r.stock_numero]?.modele ?? '',
        annee: r.annee ?? metaMap[r.stock_numero]?.annee ?? undefined,
        type: r.type_vente_label ?? metaMap[r.stock_numero]?.type,
      }));
      setRows(enriched);
      setLoading(false);
    });
  }, [invMeta]);

  const filtered = useMemo(() => {
    let r = rows;
    if (fType) r = r.filter(x => x.type_vente_label === fType || x.type === fType);
    if (fMarque) r = r.filter(x => x.marque === fMarque);
    if (fModele) r = r.filter(x => x.modele === fModele);
    if (fAnnee) r = r.filter(x => String(x.annee_fiscale) === fAnnee);
    if (fStock) r = r.filter(x => x.stock_numero.includes(fStock));
    return [...r].sort((a, b) => {
      const va = (a as Record<string, unknown>)[sortCol] ?? '';
      const vb = (b as Record<string, unknown>)[sortCol] ?? '';
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, fType, fMarque, fModele, fAnnee, fStock, sortCol, sortDir]);

  const totalVente = filtered.reduce((s, r) => s + (r.prix_vente ?? 0), 0);
  const totalProfit = filtered.reduce((s, r) => s + (r.marge_profit ?? 0), 0);
  const margeMoy = totalVente > 0 ? (totalProfit / totalVente) * 100 : 0;

  const profitParMarque = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(r => {
      const m = r.marque || (r.vehicule?.split(' ')[1] ?? 'Autre');
      map[m] = (map[m] ?? 0) + (r.marge_profit ?? 0);
    });
    return Object.entries(map)
      .map(([name, profit]) => ({ name, profit: Math.round(profit) }))
      .sort((a, b) => Math.abs(b.profit) - Math.abs(a.profit))
      .slice(0, 12);
  }, [filtered]);

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  }

  const Th = ({ col, label }: { col: string; label: string }) => (
    <th onClick={() => toggleSort(col)} style={{ padding: '10px 12px', textAlign: 'right', color: sortCol === col ? '#f59e0b' : 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}>
      {label} {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  );

  if (loading) return <div style={{ color: 'rgba(255,255,255,0.4)', padding: 32 }}>Chargement...</div>;

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <Select label="Type de vente" options={unique(rows.map(r => r.type_vente_label))} value={fType} onChange={setFType} />
        <Select label="Marque" options={unique(rows.map(r => r.marque ?? ''))} value={fMarque} onChange={setFMarque} />
        <Select label="Modèle" options={unique(rows.map(r => r.modele ?? ''))} value={fModele} onChange={setFModele} />
        <Select label="Année fiscale" options={unique(rows.map(r => String(r.annee_fiscale)))} value={fAnnee} onChange={setFAnnee} />
        <input
          placeholder="Stock #"
          value={fStock}
          onChange={e => setFStock(e.target.value)}
          style={{ background: '#1a1917', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'white', padding: '7px 12px', fontSize: 13, fontFamily: 'system-ui, sans-serif', width: 100 }}
        />
        {(fType || fMarque || fModele || fAnnee || fStock) && (
          <button onClick={() => { setFType(''); setFMarque(''); setFModele(''); setFAnnee(''); setFStock(''); }}
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'rgba(255,255,255,0.5)', padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}>
            Effacer filtres
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <KpiCard label="Ventes" value={String(filtered.length)} />
        <KpiCard label="Vente total" value={fmt$(totalVente)} />
        <KpiCard label="Profit total" value={fmt$(totalProfit)} color={profitColor(totalProfit)} />
        <KpiCard label="Marge de profit" value={fmtPct(margeMoy)} color={profitColor(margeMoy)} />
      </div>

      {profitParMarque.length > 0 && (
        <div style={{ background: '#1a1917', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '16px 20px', marginBottom: 24 }}>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Profit $ / Marque</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={profitParMarque} margin={{ top: 4, right: 16, left: 16, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} tickFormatter={v => `${Math.round(v / 1000)}k`} />
              <Tooltip contentStyle={{ background: '#1a1917', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'white' }} formatter={(v: number) => [fmt$(v), 'Profit']} />
              <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                {profitParMarque.map((entry, i) => <Cell key={i} fill={entry.profit >= 0 ? '#f59e0b' : '#ef4444'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 12 }}>Stock #</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 12 }}>Marque</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 12 }}>Modèle</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 12 }}>Type</th>
              <Th col="annee_fiscale" label="AF" />
              <Th col="prix_achat_reel" label="Coût achat" />
              <Th col="cout_mo" label="M.O." />
              <Th col="prix_vente" label="Prix vente" />
              <Th col="marge_profit" label="Profit" />
              <Th col="pct_profit" label="Marge %" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.8)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '9px 12px', fontWeight: 600 }}>{r.stock_numero}</td>
                  <td style={{ padding: '9px 12px' }}>{r.marque || '—'}</td>
                  <td style={{ padding: '9px 12px' }}>{r.modele || '—'}</td>
                  <td style={{ padding: '9px 12px' }}>
                    <span style={{
                      background: r.type_vente_label === 'Encan' ? '#ef444420' : r.type_vente_label === 'Exportation' ? '#3b82f620' : r.type_vente_label === 'Camion a eau' ? '#0ea5e920' : '#22c55e20',
                      color: r.type_vente_label === 'Encan' ? '#ef4444' : r.type_vente_label === 'Exportation' ? '#3b82f6' : r.type_vente_label === 'Camion a eau' ? '#0ea5e9' : '#22c55e',
                      padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                    }}>{r.type_vente_label}</span>
                  </td>
                  <td style={{ padding: '9px 12px', textAlign: 'right' }}>{r.annee_fiscale}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right' }}>{fmt$(r.prix_achat_reel)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right' }}>{fmt$(r.cout_mo)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 600 }}>{fmt$(r.prix_vente)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: profitColor(r.marge_profit) }}>{fmt$(r.marge_profit)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: profitColor(r.pct_profit) }}>{fmtPct(r.pct_profit)}</td>
                </tr>
              ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, padding: '24px 12px', textAlign: 'center' }}>Aucun résultat</div>
        )}
      </div>
    </div>
  );
}

// ── Vue Inventaire / Projection ───────────────────────────────────────────────

function VueInventaire({
  invMeta,
  onGoToPlans,
}: {
  invMeta: InvMeta[];
  onGoToPlans: () => void;
}) {
  const [rows, setRows] = useState<InventaireRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [simPrix, setSimPrix] = useState<Record<string, string>>({});
  const [simCouts, setSimCouts] = useState<Record<string, string>>({});
  const [editAchat, setEditAchat] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fType, setFType] = useState('');
  const [fMarque, setFMarque] = useState('');
  const [fModele, setFModele] = useState('');
  const [fAnnee, setFAnnee] = useState('');
  const [fStock, setFStock] = useState('');
  const [fAvecPrix, setFAvecPrix] = useState(false);
  const [sortCol, setSortCol] = useState<string>('stock_numero');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showModal, setShowModal] = useState(false);

  function toggleSelect(stock: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(stock) ? next.delete(stock) : next.add(stock);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected(prev =>
      prev.size === filtered.length
        ? new Set()
        : new Set(filtered.map(r => r.stock_numero))
    );
  }

  useEffect(() => {
    supabase.from('prod_inventaire_couts').select('*').then(({ data }) => {
      if (!data) return;
      const metaMap = Object.fromEntries(invMeta.map(m => [m.numero, m]));
      const enriched = (data as InventaireRow[]).map(r => ({
        ...r,
        marque: metaMap[r.stock_numero]?.marque ?? '',
        modele: metaMap[r.stock_numero]?.modele ?? '',
        annee: metaMap[r.stock_numero]?.annee ?? undefined,
        type: metaMap[r.stock_numero]?.type ?? r.type_vehicule,
      }));
      setRows(enriched);
      setLoading(false);
    });
  }, [invMeta]);

  async function savePrixDemande(stock: string, value: string) {
    const prix = parseFloat(value) || null;
    await supabase.from('prod_couts_vehicule')
      .update({ prix_demande: prix })
      .eq('stock_numero', stock);
    setRows(prev => prev.map(r => r.stock_numero === stock ? { ...r, prix_demande: prix } : r));
  }

  async function savePrixAchat(stock: string, value: string) {
    const prix = parseFloat(value) || null;
    // Protégé : on n'écrase pas si déjà en BD (même règle que l'import)
    const row = rows.find(r => r.stock_numero === stock);
    if (row?.prix_achat_reel && row.prix_achat_reel > 0 && !value) return; // pas d'effacement
    await supabase.from('prod_couts_vehicule')
      .update({ prix_achat_reel: prix })
      .eq('stock_numero', stock);
    // Recalcule cout_total_depense localement (cost_purchased - prix_achat_reel)
    setRows(prev => prev.map(r => {
      if (r.stock_numero !== stock) return r;
      const newCoutAchat = prix;
      // cout_total_depense = on ne peut pas le recalculer sans cost_purchased → reload
      return { ...r, prix_achat_reel: prix, cout_achat: prix ?? r.cout_achat };
    }));
    // Reload pour avoir cout_total_depense recalculé par la vue
    const { data } = await supabase.from('prod_inventaire_couts')
      .select('*').eq('stock_numero', stock).single();
    if (data) {
      setRows(prev => prev.map(r => r.stock_numero === stock ? { ...r, ...(data as InventaireRow) } : r));
    }
    setEditAchat(prev => { const n = { ...prev }; delete n[stock]; return n; });
  }

  function getSimPrix(stock: string, row: InventaireRow): number | null {
    const v = simPrix[stock];
    if (v !== undefined) return parseFloat(v) || null;
    if (row.prix_demande && row.prix_demande > 0) return row.prix_demande;
    return row.remaining_market && row.remaining_market > 0 ? row.remaining_market : null;
  }

  function getSimCouts(stock: string): number {
    const v = simCouts[stock];
    return v !== undefined ? (parseFloat(v) || 0) : 0;
  }

  function profitProj(row: InventaireRow): number | null {
    const prix = getSimPrix(row.stock_numero, row);
    if (!prix) return null;
    const total = (row.cout_achat ?? 0) + (row.cout_total_depense ?? 0) + getSimCouts(row.stock_numero);
    return prix - total;
  }

  function margeProj(row: InventaireRow): number | null {
    const prix = getSimPrix(row.stock_numero, row);
    const p = profitProj(row);
    if (!prix || p == null) return null;
    return (p / prix) * 100;
  }

  const filtered = useMemo(() => {
    let r = rows;
    if (fType) r = r.filter(x => x.type_vehicule === fType || x.type === fType);
    if (fMarque) r = r.filter(x => x.marque === fMarque);
    if (fModele) r = r.filter(x => x.modele === fModele);
    if (fAnnee) r = r.filter(x => String(x.annee) === fAnnee);
    if (fStock) r = r.filter(x => x.stock_numero.includes(fStock));
    if (fAvecPrix) r = r.filter(x => x.prix_demande && x.prix_demande > 0);
    return [...r].sort((a, b) => {
      const va = (a as Record<string, unknown>)[sortCol] ?? 0;
      const vb = (b as Record<string, unknown>)[sortCol] ?? 0;
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, fType, fMarque, fModele, fAnnee, fStock, fAvecPrix, sortCol, sortDir]);

  const totCoutAchat = filtered.reduce((s, r) => s + (r.cout_achat ?? 0), 0);
  const totMO = filtered.reduce((s, r) => s + (r.cout_total_depense ?? 0), 0);
  const totProfitProj = filtered.reduce((s, r) => s + (profitProj(r) ?? 0), 0);
  const totPrixSim = filtered.reduce((s, r) => s + (getSimPrix(r.stock_numero, r) ?? 0), 0);
  const margeProjMoy = totPrixSim > 0 ? (totProfitProj / totPrixSim) * 100 : 0;

  const selectedRows = filtered.filter(r => selected.has(r.stock_numero));
  const selProfitProj = selectedRows.reduce((s, r) => s + (profitProj(r) ?? 0), 0);
  const selPrixSim = selectedRows.reduce((s, r) => s + (getSimPrix(r.stock_numero, r) ?? 0), 0);
  const selMarge = selPrixSim > 0 ? (selProfitProj / selPrixSim) * 100 : 0;

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  }

  const Th = ({ col, label, right = true }: { col: string; label: string; right?: boolean }) => (
    <th onClick={() => toggleSort(col)} style={{ padding: '10px 12px', textAlign: right ? 'right' : 'left', color: sortCol === col ? '#f59e0b' : 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}>
      {label} {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  );

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 6, color: 'white', padding: '4px 8px',
    fontSize: 13, fontFamily: 'system-ui, sans-serif', width: 100,
    textAlign: 'right',
  };

  if (loading) return <div style={{ color: 'rgba(255,255,255,0.4)', padding: 32 }}>Chargement...</div>;

  const hasActiveFilters = fType || fMarque || fModele || fAnnee || fStock || fAvecPrix;

  return (
    <div>
      {/* Filtres */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
        <Select label="Type" options={unique(rows.map(r => r.type_vehicule).filter(Boolean))} value={fType} onChange={setFType} />
        <Select label="Marque" options={unique(rows.map(r => r.marque ?? '').filter(Boolean))} value={fMarque} onChange={setFMarque} />
        <Select label="Modèle" options={unique(rows.map(r => r.modele ?? '').filter(Boolean))} value={fModele} onChange={setFModele} />
        <Select label="Année" options={unique(rows.map(r => String(r.annee ?? '')).filter(Boolean))} value={fAnnee} onChange={setFAnnee} />
        <input
          placeholder="Stock #"
          value={fStock}
          onChange={e => setFStock(e.target.value)}
          style={{ background: '#1a1917', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'white', padding: '7px 12px', fontSize: 13, fontFamily: 'system-ui, sans-serif', width: 100 }}
        />
        {/* Toggle: avec prix seulement */}
        <button
          onClick={() => setFAvecPrix(v => !v)}
          style={{
            background: fAvecPrix ? '#22c55e20' : 'transparent',
            border: `1px solid ${fAvecPrix ? '#22c55e' : 'rgba(255,255,255,0.12)'}`,
            borderRadius: 8, color: fAvecPrix ? '#22c55e' : 'rgba(255,255,255,0.5)',
            padding: '7px 14px', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          {fAvecPrix ? '✓ ' : ''}Avec prix demandé
        </button>
        {hasActiveFilters && (
          <button onClick={() => { setFType(''); setFMarque(''); setFModele(''); setFAnnee(''); setFStock(''); setFAvecPrix(false); }}
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'rgba(255,255,255,0.5)', padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}>
            Effacer filtres
          </button>
        )}
        <button
          onClick={() => { setSimPrix({}); setSimCouts({}); }}
          style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'rgba(255,255,255,0.4)', padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}
          title="Réinitialiser les saisies locales (ne supprime pas les prix sauvegardés)"
        >
          Réinitialiser sim.
        </button>
      </div>

      {/* Info */}
      <div style={{ background: '#22c55e10', border: '1px solid #22c55e25', borderRadius: 8, padding: '10px 16px', marginBottom: 20, fontSize: 13, color: '#22c55e' }}>
        Le <strong>Prix demandé</strong> se sauvegarde automatiquement en base de données quand tu quittes le champ. Les <strong>Coûts à venir</strong> sont locaux à cette session.
      </div>

      {/* KPIs globaux */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: selected.size > 0 ? 12 : 24 }}>
        <KpiCard label="Véhicules" value={String(filtered.length)} sub={fAvecPrix ? 'avec prix demandé' : undefined} />
        <KpiCard label="Coût d'achat total" value={fmt$(totCoutAchat)} />
        <KpiCard label="M.O. + Pièces total" value={fmt$(totMO)} />
        <KpiCard label="Profit projeté" value={fmt$(totProfitProj)} color={profitColor(totProfitProj)} />
        <KpiCard label="Marge projetée" value={fmtPct(margeProjMoy)} color={profitColor(margeProjMoy)} />
      </div>

      {/* KPIs sélection */}
      {selected.size > 0 && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24, padding: '12px 16px', background: '#f59e0b08', border: '1px solid #f59e0b40', borderRadius: 10, alignItems: 'center' }}>
          <div style={{ color: '#f59e0b', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>
            {selected.size} sélectionné{selected.size > 1 ? 's' : ''} →
          </div>
          <KpiCard label="Prix demandé (sél.)" value={fmt$(selPrixSim)} />
          <KpiCard label="Profit projeté (sél.)" value={fmt$(selProfitProj)} color={profitColor(selProfitProj)} />
          <KpiCard label="Marge (sél.)" value={fmtPct(selMarge)} color={profitColor(selMarge)} />
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button
              onClick={() => setShowModal(true)}
              style={{ background: '#f59e0b', border: 'none', borderRadius: 8, color: 'white', padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              📋 Enregistrer comme plan
            </button>
            <button
              onClick={() => setSelected(new Set())}
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'rgba(255,255,255,0.4)', padding: '9px 14px', fontSize: 12, cursor: 'pointer' }}
            >
              Désélectionner
            </button>
          </div>
        </div>
      )}

      {/* Tableau */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <th style={{ padding: '10px 12px', width: 36 }}>
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  onChange={toggleSelectAll}
                  style={{ cursor: 'pointer', accentColor: '#f59e0b' }}
                  title="Sélectionner tout"
                />
              </th>
              <Th col="stock_numero" label="# INV" right={false} />
              <th style={{ padding: '10px 12px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 12 }}>Marque</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 12 }}>Modèle</th>
              <Th col="annee" label="Année" />
              <th style={{ padding: '10px 12px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 12 }}>Type</th>
              <Th col="age_jours" label="Âge (j)" />
              <th style={{ padding: '10px 12px', textAlign: 'right', color: '#a78bfa', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>
                Coût achat 💾
              </th>
              <Th col="cout_total_depense" label="M.O.+Pièces" />
              <th style={{ padding: '10px 12px', textAlign: 'right', color: '#f59e0b', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>
                Coûts à venir ✏️
              </th>
              <th style={{ padding: '10px 12px', textAlign: 'right', color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap', borderLeft: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
                Coût total
              </th>
              <th style={{ padding: '10px 12px', textAlign: 'right', color: '#22c55e', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
                Prix demandé 💾
              </th>
              <Th col="profit_proj" label="Profit projeté" />
              <Th col="marge_proj" label="Marge %" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const pp = profitProj(r);
              const mp = margeProj(r);
              const coutsAVenir = getSimCouts(r.stock_numero);
              const prixDemande = r.prix_demande;
              const simVal = simPrix[r.stock_numero];
              const displayPrix = simVal !== undefined ? simVal : (prixDemande ? String(prixDemande) : '');
              const isSelected = selected.has(r.stock_numero);
              const hasPrix = prixDemande && prixDemande > 0;

              return (
                <tr key={r.stock_numero}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.8)', background: isSelected ? '#f59e0b10' : 'transparent', cursor: 'pointer' }}
                  onClick={() => toggleSelect(r.stock_numero)}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isSelected ? '#f59e0b10' : 'transparent'; }}
                >
                  <td style={{ padding: '9px 12px', width: 36 }} onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(r.stock_numero)} style={{ cursor: 'pointer', accentColor: '#f59e0b' }} />
                  </td>
                  <td style={{ padding: '9px 12px', fontWeight: 600 }}>{r.stock_numero}</td>
                  <td style={{ padding: '9px 12px' }}>{r.marque || '—'}</td>
                  <td style={{ padding: '9px 12px' }}>{r.modele || '—'}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right' }}>{r.annee ?? '—'}</td>
                  <td style={{ padding: '9px 12px' }}>
                    <span style={{
                      background: r.type_vehicule === 'eau' ? '#0ea5e920' : r.type_vehicule === 'detail' ? '#22c55e20' : '#6b728020',
                      color: r.type_vehicule === 'eau' ? '#0ea5e9' : r.type_vehicule === 'detail' ? '#22c55e' : '#9ca3af',
                      padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                    }}>{r.type_vehicule}</span>
                  </td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: (r.age_jours ?? 0) > 365 ? '#ef4444' : (r.age_jours ?? 0) > 180 ? '#f59e0b' : 'rgba(255,255,255,0.6)' }}>
                    {r.age_jours ?? '—'}
                  </td>
                  <td style={{ padding: '9px 12px', textAlign: 'right' }}>{fmt$(r.cout_achat)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right' }}>{fmt$(r.cout_total_depense)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                    <input
                      type="number"
                      style={inputStyle}
                      placeholder="0"
                      value={simCouts[r.stock_numero] ?? ''}
                      onChange={e => setSimCouts(prev => ({ ...prev, [r.stock_numero]: e.target.value }))}
                    />
                  </td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: 'rgba(255,255,255,0.9)', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
                    {fmt$((r.cout_achat ?? 0) + (r.cout_total_depense ?? 0) + coutsAVenir)}
                  </td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', borderLeft: '1px solid rgba(255,255,255,0.08)' }} onClick={e => e.stopPropagation()}>
                    <input
                      type="number"
                      style={{
                        ...inputStyle,
                        borderColor: hasPrix ? '#22c55e60' : simPrix[r.stock_numero] ? '#f59e0b50' : 'rgba(255,255,255,0.12)',
                        background: hasPrix ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.05)',
                      }}
                      placeholder="Prix..."
                      value={displayPrix}
                      onChange={e => setSimPrix(prev => ({ ...prev, [r.stock_numero]: e.target.value }))}
                      onBlur={e => {
                        const val = e.target.value || (prixDemande ? String(prixDemande) : '');
                        savePrixDemande(r.stock_numero, val);
                        // Si on a saisi, clear le sim local (la DB est maintenant la source)
                        if (e.target.value !== '') setSimPrix(prev => { const n = { ...prev }; delete n[r.stock_numero]; return n; });
                      }}
                      title={hasPrix ? `Sauvegardé: ${fmt$(prixDemande)}` : 'Entrer un prix pour sauvegarder'}
                    />
                  </td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: profitColor(pp) }}>{fmt$(pp)}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: profitColor(mp) }}>{fmtPct(mp)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid rgba(255,255,255,0.15)', background: '#1a1917' }}>
              <td />
              <td colSpan={6} style={{ padding: '11px 12px', color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 700 }}>
                TOTAL — {filtered.length} véhicules
              </td>
              <td style={{ padding: '11px 12px', textAlign: 'right', color: 'white', fontWeight: 700 }}>
                {fmt$(filtered.reduce((s, r) => s + (r.cout_achat ?? 0), 0))}
              </td>
              <td style={{ padding: '11px 12px', textAlign: 'right', color: 'white', fontWeight: 700 }}>
                {fmt$(filtered.reduce((s, r) => s + (r.cout_total_depense ?? 0), 0))}
              </td>
              <td style={{ padding: '11px 12px', textAlign: 'right', color: 'white', fontWeight: 700 }}>
                {fmt$(filtered.reduce((s, r) => s + getSimCouts(r.stock_numero), 0))}
              </td>
              <td style={{ padding: '11px 12px', textAlign: 'right', color: 'white', fontWeight: 700, borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
                {fmt$(filtered.reduce((s, r) => s + (r.cout_achat ?? 0) + (r.cout_total_depense ?? 0) + getSimCouts(r.stock_numero), 0))}
              </td>
              <td style={{ padding: '11px 12px', textAlign: 'right', color: '#22c55e', fontWeight: 700, borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
                {fmt$(filtered.reduce((s, r) => s + (getSimPrix(r.stock_numero, r) ?? 0), 0))}
              </td>
              <td style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 700, color: profitColor(totProfitProj) }}>
                {fmt$(totProfitProj)}
              </td>
              <td style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 700, color: profitColor(margeProjMoy) }}>
                {fmtPct(margeProjMoy)}
              </td>
            </tr>
          </tfoot>
        </table>
        {filtered.length === 0 && (
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, padding: '24px 12px', textAlign: 'center' }}>Aucun résultat</div>
        )}
      </div>

      {/* Modal création plan */}
      {showModal && (
        <ModalCreerPlan
          stocks={[...selected]}
          simPrix={simPrix}
          rows={rows}
          invMeta={invMeta}
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            setSelected(new Set());
            onGoToPlans();
          }}
        />
      )}
    </div>
  );
}

// ── Vue Plans de vente ────────────────────────────────────────────────────────

function VuePlans({ invMeta }: { invMeta: InvMeta[] }) {
  const [plans, setPlans] = useState<PlanResume[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [vehicules, setVehicules] = useState<PlanVehicule[]>([]);
  const [loadingV, setLoadingV] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);

  const metaMap = Object.fromEntries(invMeta.map(m => [m.numero, m]));

  async function chargerPlans() {
    // Requêtes directes sur les tables (la vue GROUP BY n'est pas exposée via l'API)
    const [{ data: plansData }, { data: vehData }, { data: ventesData }] = await Promise.all([
      supabase.from('prod_plans_vente').select('*').order('date_creation', { ascending: false }),
      supabase.from('prod_plans_vente_vehicules').select('plan_id, stock_numero, prix_plan'),
      supabase.from('prod_ventes').select('stock_numero, prix_vente'),
    ]);

    if (!plansData) { setLoading(false); return; }

    const venteStocks = new Set((ventesData ?? []).map((v: { stock_numero: string }) => v.stock_numero));
    const ventesPrix = Object.fromEntries(
      (ventesData ?? []).map((v: { stock_numero: string; prix_vente: number }) => [v.stock_numero, v.prix_vente])
    );

    const resume: PlanResume[] = plansData.map((p: { id: string; nom: string; statut: 'brouillon' | 'actif' | 'archive'; date_creation: string; date_activation: string | null }) => {
      const planVeh = (vehData ?? []).filter((v: { plan_id: string }) => v.plan_id === p.id) as { stock_numero: string; prix_plan: number | null }[];
      const vendus = planVeh.filter(v => venteStocks.has(v.stock_numero));
      return {
        id: p.id,
        nom: p.nom,
        statut: p.statut,
        date_creation: p.date_creation,
        date_activation: p.date_activation,
        nb_vehicules: planVeh.length,
        prix_total_projete: planVeh.reduce((s, v) => s + (v.prix_plan ?? 0), 0),
        nb_vendus: vendus.length,
        revenus_realises: vendus.reduce((s, v) => s + (ventesPrix[v.stock_numero] ?? 0), 0),
      };
    });

    setPlans(resume);
    setLoading(false);
  }

  useEffect(() => { chargerPlans(); }, []);

  async function expandPlan(planId: string) {
    if (expanded === planId) { setExpanded(null); return; }
    setExpanded(planId);
    setLoadingV(true);
    const { data } = await supabase
      .from('prod_plans_vente_vehicules')
      .select('*')
      .eq('plan_id', planId);
    if (data) {
      setVehicules((data as PlanVehicule[]).map(v => ({
        ...v,
        marque: metaMap[v.stock_numero]?.marque ?? '',
        modele: metaMap[v.stock_numero]?.modele ?? '',
        annee: metaMap[v.stock_numero]?.annee ?? undefined,
      })));
    }
    setLoadingV(false);
  }

  async function activerPlan(plan: PlanResume) {
    if (!confirm(`Activer "${plan.nom}" ? Cela va remplacer le prix demandé de ${plan.nb_vehicules} véhicule${plan.nb_vehicules > 1 ? 's' : ''}.`)) return;
    setActivating(plan.id);

    // Charger les véhicules du plan
    const { data: veh } = await supabase
      .from('prod_plans_vente_vehicules')
      .select('stock_numero, prix_plan')
      .eq('plan_id', plan.id);

    if (veh) {
      // Mettre à jour prix_demande pour chaque stock
      await Promise.all(
        (veh as { stock_numero: string; prix_plan: number | null }[]).map(v =>
          supabase.from('prod_couts_vehicule')
            .update({ prix_demande: v.prix_plan })
            .eq('stock_numero', v.stock_numero)
        )
      );
    }

    // Marquer le plan actif, archiver les autres plans actifs
    await supabase.from('prod_plans_vente')
      .update({ statut: 'archive' })
      .eq('statut', 'actif');
    await supabase.from('prod_plans_vente')
      .update({ statut: 'actif', date_activation: new Date().toISOString() })
      .eq('id', plan.id);

    setActivating(null);
    chargerPlans();
  }

  async function archiverPlan(planId: string) {
    await supabase.from('prod_plans_vente').update({ statut: 'archive' }).eq('id', planId);
    chargerPlans();
  }

  async function supprimerPlan(planId: string, nom: string) {
    if (!confirm(`Supprimer le plan "${nom}" ? Cette action est irréversible.`)) return;
    await supabase.from('prod_plans_vente').delete().eq('id', planId);
    if (expanded === planId) setExpanded(null);
    chargerPlans();
  }

  if (loading) return <div style={{ color: 'rgba(255,255,255,0.4)', padding: 32 }}>Chargement...</div>;

  if (plans.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Aucun plan de vente</div>
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
          Sélectionne des véhicules dans l'onglet <strong>Inventaire & Projection</strong> et clique "Enregistrer comme plan".
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 20 }}>
        {plans.length} plan{plans.length > 1 ? 's' : ''} · Activer un plan remplace les prix demandés en masse et archive le plan précédemment actif.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {plans.map(plan => {
          const pctVendu = plan.nb_vehicules > 0 ? (plan.nb_vendus / plan.nb_vehicules) * 100 : 0;
          const isExp = expanded === plan.id;

          return (
            <div key={plan.id} style={{
              background: '#1a1917',
              border: `1px solid ${plan.statut === 'actif' ? '#22c55e50' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 12,
              overflow: 'hidden',
            }}>
              {/* En-tête du plan */}
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', cursor: 'pointer' }}
                onClick={() => expandPlan(plan.id)}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ color: 'white', fontSize: 15, fontWeight: 700 }}>{plan.nom}</span>
                    <StatutBadge statut={plan.statut} />
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
                    Créé le {fmtDate(plan.date_creation)}
                    {plan.date_activation && ` · Activé le ${fmtDate(plan.date_activation)}`}
                  </div>
                </div>

                {/* Stats rapides */}
                <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600 }}>VÉHICULES</div>
                    <div style={{ color: 'white', fontSize: 16, fontWeight: 700 }}>{plan.nb_vehicules}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600 }}>PRIX PROJETÉ</div>
                    <div style={{ color: '#f59e0b', fontSize: 16, fontWeight: 700 }}>{fmt$(plan.prix_total_projete)}</div>
                  </div>
                  {plan.nb_vendus > 0 && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600 }}>RÉALISÉ</div>
                      <div style={{ color: '#22c55e', fontSize: 16, fontWeight: 700 }}>{fmt$(plan.revenus_realises)}</div>
                    </div>
                  )}
                  {/* Barre de progression */}
                  {plan.nb_vehicules > 0 && (
                    <div style={{ width: 80 }}>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                        {plan.nb_vendus}/{plan.nb_vehicules} vendu{plan.nb_vendus > 1 ? 's' : ''}
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 4, height: 6 }}>
                        <div style={{ background: '#22c55e', borderRadius: 4, height: 6, width: `${pctVendu}%`, transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                  {plan.statut === 'brouillon' && (
                    <button
                      onClick={() => activerPlan(plan)}
                      disabled={activating === plan.id}
                      style={{ background: '#22c55e', border: 'none', borderRadius: 8, color: 'white', padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      {activating === plan.id ? '...' : '⚡ Activer'}
                    </button>
                  )}
                  {plan.statut === 'actif' && (
                    <button
                      onClick={() => archiverPlan(plan.id)}
                      style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'rgba(255,255,255,0.5)', padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}
                    >
                      Archiver
                    </button>
                  )}
                  {plan.statut === 'archive' && (
                    <button
                      onClick={() => supprimerPlan(plan.id, plan.nom)}
                      style={{ background: 'transparent', border: '1px solid #ef444440', borderRadius: 8, color: '#ef4444', padding: '7px 14px', fontSize: 12, cursor: 'pointer' }}
                    >
                      Supprimer
                    </button>
                  )}
                </div>

                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 18 }}>{isExp ? '▲' : '▼'}</span>
              </div>

              {/* Détail des véhicules */}
              {isExp && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '0 0 8px' }}>
                  {loadingV ? (
                    <div style={{ color: 'rgba(255,255,255,0.3)', padding: '16px 20px', fontSize: 13 }}>Chargement...</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                          <th style={{ padding: '8px 20px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 11 }}>Stock #</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 11 }}>Marque</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 11 }}>Modèle</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 11 }}>Année</th>
                          <th style={{ padding: '8px 20px', textAlign: 'right', color: '#f59e0b', fontWeight: 600, fontSize: 11 }}>Prix du plan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vehicules.map(v => (
                          <tr key={v.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td style={{ padding: '7px 20px', fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>{v.stock_numero}</td>
                            <td style={{ padding: '7px 12px', color: 'rgba(255,255,255,0.6)' }}>{v.marque || '—'}</td>
                            <td style={{ padding: '7px 12px', color: 'rgba(255,255,255,0.6)' }}>{v.modele || '—'}</td>
                            <td style={{ padding: '7px 12px', textAlign: 'right', color: 'rgba(255,255,255,0.6)' }}>{v.annee ?? '—'}</td>
                            <td style={{ padding: '7px 20px', textAlign: 'right', fontWeight: 700, color: '#f59e0b' }}>{fmt$(v.prix_plan)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                          <td colSpan={4} style={{ padding: '8px 20px', color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 700 }}>TOTAL</td>
                          <td style={{ padding: '8px 20px', textAlign: 'right', fontWeight: 700, color: '#f59e0b' }}>
                            {fmt$(vehicules.reduce((s, v) => s + (v.prix_plan ?? 0), 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export function VueProfitabilite() {
  const [tab, setTab] = useState<'ventes' | 'inventaire' | 'plans'>('ventes');
  const [invMeta, setInvMeta] = useState<InvMeta[]>([]);

  useEffect(() => {
    supabase.from('prod_inventaire').select('numero, marque, modele, annee, type').then(({ data }) => {
      if (data) setInvMeta(data as InvMeta[]);
    });
  }, []);

  const TABS = [
    { id: 'ventes' as const,     label: 'Rapport Vente',         icon: '📊' },
    { id: 'inventaire' as const, label: 'Inventaire & Projection', icon: '🔭' },
    { id: 'plans' as const,      label: 'Plans de vente',         icon: '📋' },
  ];

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#0f0e0b', padding: '24px 32px', fontFamily: 'system-ui, sans-serif' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, color: 'white', fontSize: 22, fontWeight: 700 }}>Analyse financière</h1>
          <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Ventes · Inventaire · Plans de vente</p>
        </div>
        <div style={{ display: 'flex', gap: 6, marginLeft: 24 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: tab === t.id ? '#f59e0b20' : 'transparent',
                border: `1px solid ${tab === t.id ? '#f59e0b' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: 8, color: tab === t.id ? '#f59e0b' : 'rgba(255,255,255,0.5)',
                padding: '8px 16px', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'ventes' && <VueVentes invMeta={invMeta} />}
      {tab === 'inventaire' && <VueInventaire invMeta={invMeta} onGoToPlans={() => setTab('plans')} />}
      {tab === 'plans' && <VuePlans invMeta={invMeta} />}
    </div>
  );
}
