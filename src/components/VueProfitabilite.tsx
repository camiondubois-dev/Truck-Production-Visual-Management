import { useState, useEffect, useMemo, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, LabelList, ComposedChart, Line,
} from 'recharts';
import { supabase } from '../lib/supabase';
import { nomVendeur } from '../services/piecesImportService';
import type { PieceRow } from '../services/piecesImportService';
import { VueBilanHebdo } from './VueBilanHebdo';

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
  cout_total_investi: number | null;
  projected_deficit: number | null;
  remaining_market: number | null;
  prix_achat_reel: number | null;
  prix_demande: number | null;
  marque?: string;
  modele?: string;
  annee?: number;
  type?: string;
  // Statut paiement (depuis prod_inventaire)
  etat_commercial?: string;
  paiement_complet?: boolean;
  paiement_depot?: boolean;
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
  const [fDateDu, setFDateDu] = useState('');
  const [fDateAu, setFDateAu] = useState('');
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
    if (fDateDu) r = r.filter(x => x.date_vente != null && x.date_vente >= fDateDu);
    if (fDateAu) r = r.filter(x => x.date_vente != null && x.date_vente <= fDateAu);
    return [...r].sort((a, b) => {
      const va = (a as Record<string, unknown>)[sortCol] ?? '';
      const vb = (b as Record<string, unknown>)[sortCol] ?? '';
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, fType, fMarque, fModele, fAnnee, fStock, fDateDu, fDateAu, sortCol, sortDir]);

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
      .slice(0, 10);
  }, [filtered]);

  const parType = useMemo(() => {
    const typeColor: Record<string, string> = {
      'Encan':       '#ef4444',  // rouge
      'Exportation': '#f59e0b',  // ambre
      'Camion a eau':'#06b6d4',  // cyan (eau)
      'Vente detail':'#22c55e',  // vert
    };
    const map: Record<string, { vente: number; profit: number; nb: number }> = {};
    filtered.forEach(r => {
      const t = r.type_vente_label;
      if (!map[t]) map[t] = { vente: 0, profit: 0, nb: 0 };
      map[t].vente += r.prix_vente ?? 0;
      map[t].profit += r.marge_profit ?? 0;
      map[t].nb += 1;
    });
    return Object.entries(map).map(([name, v]) => ({
      name, color: typeColor[name] ?? '#9ca3af',
      vente: Math.round(v.vente), profit: Math.round(v.profit), nb: v.nb,
    }));
  }, [filtered]);

  const parAnnee = useMemo(() => {
    const map: Record<string, { vente: number; profit: number; nb: number }> = {};
    filtered.forEach(r => {
      const a = String(r.annee_fiscale);
      if (!map[a]) map[a] = { vente: 0, profit: 0, nb: 0 };
      map[a].vente += r.prix_vente ?? 0;
      map[a].profit += r.marge_profit ?? 0;
      map[a].nb += 1;
    });
    return Object.entries(map)
      .map(([annee, v]) => ({ annee, vente: Math.round(v.vente), profit: Math.round(v.profit), nb: v.nb }))
      .sort((a, b) => a.annee.localeCompare(b.annee));
  }, [filtered]);

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  }

  const stickyTh: React.CSSProperties = { position: 'sticky', top: 0, zIndex: 2, background: '#141311', boxShadow: '0 1px 0 rgba(255,255,255,0.08)' };

  const Th = ({ col, label }: { col: string; label: string }) => (
    <th onClick={() => toggleSort(col)} style={{ ...stickyTh, padding: '10px 12px', textAlign: 'right', color: sortCol === col ? '#f59e0b' : 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Du</span>
          <input
            type="date"
            value={fDateDu}
            onChange={e => setFDateDu(e.target.value)}
            style={{ background: '#1a1917', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'white', padding: '7px 10px', fontSize: 13, fontFamily: 'system-ui, sans-serif', colorScheme: 'dark' }}
          />
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Au</span>
          <input
            type="date"
            value={fDateAu}
            onChange={e => setFDateAu(e.target.value)}
            style={{ background: '#1a1917', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'white', padding: '7px 10px', fontSize: 13, fontFamily: 'system-ui, sans-serif', colorScheme: 'dark' }}
          />
        </div>
        {(fType || fMarque || fModele || fAnnee || fStock || fDateDu || fDateAu) && (
          <button onClick={() => { setFType(''); setFMarque(''); setFModele(''); setFAnnee(''); setFStock(''); setFDateDu(''); setFDateAu(''); }}
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

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'stretch' }}>

        {/* ── 1. Profit / Marque — barres horizontales ── */}
        <div style={{ flex: 1, minWidth: 0, background: '#1a1917', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px' }}>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Profit / Marque</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart layout="vertical" data={profitParMarque} margin={{ top: 0, right: 52, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} width={76} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const v = payload[0].value as number;
                return (
                  <div style={{ background: 'rgba(8,7,5,0.97)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 28px rgba(0,0,0,0.65)', fontSize: 12 }}>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 4 }}>{payload[0].payload.name}</div>
                    <div style={{ color: v >= 0 ? '#f59e0b' : '#ef4444', fontWeight: 800, fontSize: 15 }}>{fmt$(v)}</div>
                  </div>
                );
              }} />
              <Bar dataKey="profit" radius={[0, 5, 5, 0]} maxBarSize={16}>
                <LabelList dataKey="profit" position="right" style={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} formatter={(v: number) => `${Math.round(v / 1000)}k`} />
                {profitParMarque.map((e, i) => <Cell key={i} fill={e.profit >= 0 ? '#f59e0b' : '#ef4444'} fillOpacity={0.88} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ── 2. Par type de vente — donut + légende ── */}
        <div style={{ flex: 1, minWidth: 0, background: '#1a1917', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Par type de vente</div>
          <ResponsiveContainer width="100%" height={168}>
            <PieChart>
              <Pie
                data={parType} cx="50%" cy="50%"
                innerRadius={54} outerRadius={78}
                dataKey="vente" paddingAngle={4} strokeWidth={0}
                onClick={(d) => setFType(fType === d.name ? '' : d.name)}
                style={{ cursor: 'pointer' }}
              >
                {parType.map((e, i) => (
                  <Cell key={i} fill={e.color} fillOpacity={fType && fType !== e.name ? 0.25 : 1} />
                ))}
              </Pie>
              <Tooltip cursor={false} content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                const marge = d.vente > 0 ? ((d.profit / d.vente) * 100).toFixed(1) : '—';
                return (
                  <div style={{ background: 'rgba(8,7,5,0.97)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 28px rgba(0,0,0,0.65)', fontSize: 12, minWidth: 170 }}>
                    <div style={{ color: d.color, fontWeight: 700, marginBottom: 6, fontSize: 13 }}>{d.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}><span style={{ color: 'rgba(255,255,255,0.4)' }}>Vente totale</span><span style={{ fontWeight: 700 }}>{fmt$(d.vente)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 3 }}><span style={{ color: 'rgba(255,255,255,0.4)' }}>Profit</span><span style={{ fontWeight: 700, color: d.profit >= 0 ? '#22c55e' : '#ef4444' }}>{fmt$(d.profit)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 3 }}><span style={{ color: 'rgba(255,255,255,0.4)' }}>Marge</span><span style={{ fontWeight: 700, color: d.profit >= 0 ? '#22c55e' : '#ef4444' }}>{marge} %</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 3 }}><span style={{ color: 'rgba(255,255,255,0.4)' }}>Nb ventes</span><span style={{ fontWeight: 700 }}>{d.nb}</span></div>
                  </div>
                );
              }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 9, marginTop: -4, marginBottom: 6, letterSpacing: '0.04em' }}>
            CLIQUER POUR FILTRER
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, justifyContent: 'center' }}>
            {[...parType].sort((a, b) => b.vente - a.vente).map(t => (
              <div
                key={t.name}
                onClick={() => setFType(fType === t.name ? '' : t.name)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', borderRadius: 6, padding: '3px 4px', background: fType === t.name ? `${t.color}18` : 'transparent', transition: 'background 0.15s', opacity: fType && fType !== t.name ? 0.4 : 1 }}
              >
                <div style={{ width: 8, height: 8, borderRadius: 2, background: t.color, flexShrink: 0 }} />
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: 600 }}>{fmt$(t.vente)}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: t.profit >= 0 ? '#22c55e' : '#ef4444', minWidth: 72, textAlign: 'right' }}>{fmt$(t.profit)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── 3. Quantité / Année fiscale ── */}
        <div style={{ flex: 1, minWidth: 0, background: '#1a1917', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Quantité / Année</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={parAnnee} margin={{ top: 22, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="annee" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div style={{ background: 'rgba(8,7,5,0.97)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 28px rgba(0,0,0,0.65)', fontSize: 12 }}>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, marginBottom: 6 }}>AF {label}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>Nombre de ventes</span>
                      <span style={{ fontWeight: 800, color: '#f59e0b', fontSize: 15 }}>{d.nb}</span>
                    </div>
                  </div>
                );
              }} />
              <Bar dataKey="nb" fill="#f59e0b" fillOpacity={0.88} radius={[6, 6, 0, 0]} maxBarSize={52}>
                <LabelList dataKey="nb" position="top" style={{ fill: 'white', fontSize: 13, fontWeight: 800 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ── 4. Vente & Profit / Année fiscale — graphique combiné ── */}
        <div style={{ flex: 1, minWidth: 0, background: '#1a1917', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Vente & Profit / Année</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                <span style={{ width: 20, height: 2, background: '#f59e0b', display: 'inline-block', borderRadius: 2 }} /> Vente
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                <span style={{ width: 10, height: 10, background: '#22c55e', display: 'inline-block', borderRadius: 2 }} /> Profit
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={parAnnee} margin={{ top: 22, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="annee" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="vente" hide />
              <YAxis yAxisId="profit" hide orientation="right" />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const d = (payload[0]?.payload ?? payload[1]?.payload) as typeof parAnnee[0];
                const marge = d.vente > 0 ? ((d.profit / d.vente) * 100).toFixed(1) : '—';
                return (
                  <div style={{ background: 'rgba(8,7,5,0.97)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '10px 14px', boxShadow: '0 8px 28px rgba(0,0,0,0.65)', fontSize: 12, minWidth: 180 }}>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, marginBottom: 6 }}>AF {label}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 3 }}>
                      <span style={{ color: '#f59e0b' }}>Vente totale</span>
                      <span style={{ fontWeight: 700, color: '#f59e0b' }}>{fmt$(d.vente)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 3 }}>
                      <span style={{ color: d.profit >= 0 ? '#22c55e' : '#ef4444' }}>Profit total</span>
                      <span style={{ fontWeight: 700, color: d.profit >= 0 ? '#22c55e' : '#ef4444' }}>{fmt$(d.profit)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>Marge</span>
                      <span style={{ fontWeight: 700, color: d.profit >= 0 ? '#22c55e' : '#ef4444' }}>{marge} %</span>
                    </div>
                  </div>
                );
              }} />
              {/* Profit — barres vertes/rouges */}
              <Bar yAxisId="profit" dataKey="profit" radius={[6, 6, 0, 0]} maxBarSize={52}>
                <LabelList dataKey="profit" position="top" style={{ fill: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: 700 }} formatter={(v: number) => `${Math.round(v / 1000)}k`} />
                {parAnnee.map((e, i) => (
                  <Cell key={i} fill={e.profit >= 0 ? '#22c55e' : '#ef4444'} fillOpacity={0.85} />
                ))}
              </Bar>
              {/* Vente totale — ligne ambre */}
              <Line yAxisId="vente" dataKey="vente" stroke="#f59e0b" strokeWidth={2.5} dot={{ fill: '#f59e0b', r: 4, strokeWidth: 0 }} activeDot={{ r: 6, fill: '#f59e0b', strokeWidth: 0 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <th style={{ ...stickyTh, padding: '10px 12px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>Stock #</th>
              <th style={{ ...stickyTh, padding: '10px 12px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>Marque</th>
              <th style={{ ...stickyTh, padding: '10px 12px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>Modèle</th>
              <th style={{ ...stickyTh, padding: '10px 12px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>Type</th>
              <Th col="annee_fiscale" label="AF" />
              <Th col="prix_achat_reel" label="Coût achat" />
              <Th col="cout_mo" label="M.O." />
              <Th col="cout_total" label="Coût total" />
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
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: 'rgba(255,255,255,0.6)' }}>{fmt$(r.cout_total)}</td>
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
  const [filterToSelection, setFilterToSelection] = useState(false);
  const [quickInput, setQuickInput] = useState('');
  const [quickError, setQuickError] = useState('');
  const quickRef = useRef<HTMLInputElement>(null);
  const [fType, setFType] = useState('');
  const [fMarque, setFMarque] = useState('');
  const [fModele, setFModele] = useState('');
  const [fAnnee, setFAnnee] = useState('');
  const [fStock, setFStock] = useState('');
  const [fAvecPrix, setFAvecPrix] = useState(false);
  const [fPaiement, setFPaiement] = useState<'' | 'paye' | 'depot' | 'pipeline'>('');
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

  function handleQuickAdd(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const val = quickInput.trim();
    if (!val) return;
    const found = rows.find(r => r.stock_numero === val);
    if (!found) {
      setQuickError(`# ${val} introuvable`);
      setTimeout(() => setQuickError(''), 2000);
      return;
    }
    setSelected(prev => new Set([...prev, val]));
    setQuickInput('');
    setQuickError('');
    quickRef.current?.focus();
  }

  function removeFromSelection(stock: string) {
    setSelected(prev => { const n = new Set(prev); n.delete(stock); return n; });
  }

  function clearSelection() {
    setSelected(new Set());
    setFilterToSelection(false);
  }

  useEffect(() => {
    Promise.all([
      supabase.from('prod_inventaire_couts').select('*'),
      supabase.from('prod_inventaire').select('numero, etat_commercial, paiement_complet, paiement_depot'),
    ]).then(([{ data }, { data: invPay }]) => {
      if (!data) return;
      const metaMap = Object.fromEntries(invMeta.map(m => [m.numero, m]));
      const payMap: Record<string, { etat_commercial: string; paiement_complet: boolean; paiement_depot: boolean }> = {};
      (invPay ?? []).forEach((r: any) => { payMap[r.numero] = r; });
      const enriched = (data as InventaireRow[]).map(r => ({
        ...r,
        marque: metaMap[r.stock_numero]?.marque ?? '',
        modele: metaMap[r.stock_numero]?.modele ?? '',
        annee: metaMap[r.stock_numero]?.annee ?? undefined,
        type: metaMap[r.stock_numero]?.type ?? r.type_vehicule,
        etat_commercial: payMap[r.stock_numero]?.etat_commercial,
        paiement_complet: payMap[r.stock_numero]?.paiement_complet ?? false,
        paiement_depot: payMap[r.stock_numero]?.paiement_depot ?? false,
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
    if (filterToSelection && selected.size > 0) {
      r = r.filter(x => selected.has(x.stock_numero));
    } else {
      if (fType) r = r.filter(x => x.type_vehicule === fType || x.type === fType);
      if (fMarque) r = r.filter(x => x.marque === fMarque);
      if (fModele) r = r.filter(x => x.modele === fModele);
      if (fAnnee) r = r.filter(x => String(x.annee) === fAnnee);
      if (fStock) r = r.filter(x => x.stock_numero.includes(fStock));
      if (fAvecPrix) r = r.filter(x => x.prix_demande && x.prix_demande > 0);
      if (fPaiement === 'paye')     r = r.filter(x => x.paiement_complet);
      if (fPaiement === 'depot')    r = r.filter(x => x.paiement_depot && !x.paiement_complet);
      if (fPaiement === 'pipeline') r = r.filter(x => ['reserve', 'vendu', 'location'].includes(x.etat_commercial ?? '') && !x.paiement_complet);
    }
    return [...r].sort((a, b) => {
      const va = (a as Record<string, unknown>)[sortCol] ?? 0;
      const vb = (b as Record<string, unknown>)[sortCol] ?? 0;
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, filterToSelection, selected, fType, fMarque, fModele, fAnnee, fStock, fAvecPrix, sortCol, sortDir]);

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

  const stickyTh: React.CSSProperties = { position: 'sticky', top: 0, zIndex: 2, background: '#0f0e0b' };

  const Th = ({ col, label, right = true }: { col: string; label: string; right?: boolean }) => (
    <th onClick={() => toggleSort(col)} style={{ ...stickyTh, padding: '10px 12px', textAlign: right ? 'right' : 'left', color: sortCol === col ? '#f59e0b' : 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}>
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

  const hasActiveFilters = fType || fMarque || fModele || fAnnee || fStock || fAvecPrix || fPaiement;

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
        {/* Filtre paiement */}
        {(['', 'pipeline', 'depot', 'paye'] as const).map(v => {
          const labels: Record<string, string> = { '': 'Tous', pipeline: '🔒 Pipeline', depot: '💵 Dépôt reçu', paye: '✅ Payés complet' };
          const colors: Record<string, string> = { '': 'rgba(255,255,255,0.12)', pipeline: '#8b5cf6', depot: '#f59e0b', paye: '#22c55e' };
          const active = fPaiement === v;
          return (
            <button
              key={v}
              onClick={() => setFPaiement(v)}
              style={{
                background: active ? `${colors[v]}25` : 'transparent',
                border: `1px solid ${active ? colors[v] : 'rgba(255,255,255,0.12)'}`,
                borderRadius: 8, color: active ? colors[v] : 'rgba(255,255,255,0.5)',
                padding: '7px 14px', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              {labels[v]}
            </button>
          );
        })}
        {hasActiveFilters && (
          <button onClick={() => { setFType(''); setFMarque(''); setFModele(''); setFAnnee(''); setFStock(''); setFAvecPrix(false); setFPaiement(''); }}
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

      {/* ── Sélection rapide ── */}
      <div style={{ background: '#1a1917', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>Sélection rapide :</span>
          <div style={{ position: 'relative' }}>
            <input
              ref={quickRef}
              value={quickInput}
              onChange={e => { setQuickInput(e.target.value); setQuickError(''); }}
              onKeyDown={handleQuickAdd}
              placeholder="# Stock + Enter"
              style={{
                background: 'rgba(255,255,255,0.07)', border: `1px solid ${quickError ? '#ef4444' : 'rgba(255,255,255,0.15)'}`,
                borderRadius: 7, color: 'white', padding: '6px 10px', fontSize: 13,
                fontFamily: 'system-ui, sans-serif', width: 140, outline: 'none',
              }}
            />
            {quickError && (
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#ef4444', color: 'white', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 5, whiteSpace: 'nowrap', zIndex: 10 }}>
                {quickError}
              </div>
            )}
          </div>
          {/* Chips des stocks sélectionnés */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', flex: 1 }}>
            {[...selected].map(stock => (
              <span key={stock} style={{
                background: '#f59e0b20', border: '1px solid #f59e0b60',
                borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 700,
                color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4,
              }}>
                {stock}
                <span onClick={() => removeFromSelection(stock)} style={{ cursor: 'pointer', opacity: 0.7, fontSize: 13, lineHeight: 1 }}>×</span>
              </span>
            ))}
            {selected.size === 0 && (
              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, fontStyle: 'italic' }}>Aucun camion sélectionné</span>
            )}
          </div>
          {/* Boutons mode sélection */}
          {selected.size > 0 && (
            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexShrink: 0 }}>
              <button
                onClick={() => setFilterToSelection(v => !v)}
                style={{
                  background: filterToSelection ? '#f59e0b' : 'rgba(245,158,11,0.1)',
                  border: `1px solid ${filterToSelection ? '#f59e0b' : 'rgba(245,158,11,0.4)'}`,
                  borderRadius: 7, color: filterToSelection ? 'white' : '#f59e0b',
                  padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {filterToSelection ? '✓ Sélection seulement' : 'Voir sélection seulement'}
              </button>
              <button
                onClick={clearSelection}
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, color: 'rgba(255,255,255,0.35)', padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}
              >
                Effacer
              </button>
            </div>
          )}
        </div>
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
              onClick={clearSelection}
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'rgba(255,255,255,0.4)', padding: '9px 14px', fontSize: 12, cursor: 'pointer' }}
            >
              Désélectionner
            </button>
          </div>
        </div>
      )}

      {/* Tableau */}
      <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 340px)', minHeight: 200 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <th style={{ ...stickyTh, padding: '10px 12px', width: 36 }}>
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  onChange={toggleSelectAll}
                  style={{ cursor: 'pointer', accentColor: '#f59e0b' }}
                  title="Sélectionner tout"
                />
              </th>
              <Th col="stock_numero" label="# INV" right={false} />
              <th style={{ ...stickyTh, padding: '10px 12px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 12 }}>Marque</th>
              <th style={{ ...stickyTh, padding: '10px 12px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 12 }}>Modèle</th>
              <Th col="annee" label="Année" />
              <th style={{ ...stickyTh, padding: '10px 12px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 12 }}>Type</th>
              <Th col="age_jours" label="Âge (j)" />
              <th style={{ ...stickyTh, padding: '10px 12px', textAlign: 'right', color: '#a78bfa', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>
                Coût achat 💾
              </th>
              <Th col="cout_total_depense" label="M.O.+Pièces" />
              <th style={{ ...stickyTh, padding: '10px 12px', textAlign: 'right', color: '#f59e0b', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>
                Coûts à venir ✏️
              </th>
              <th style={{ ...stickyTh, padding: '10px 12px', textAlign: 'right', color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap', borderLeft: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
                Coût total
              </th>
              <th style={{ ...stickyTh, padding: '10px 12px', textAlign: 'right', color: '#22c55e', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
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

              // Color coding paiement
              const isPaye    = r.paiement_complet;
              const hasDepot  = r.paiement_depot && !r.paiement_complet;
              const isPipeline = ['reserve', 'vendu', 'location'].includes(r.etat_commercial ?? '') && !r.paiement_complet;
              const rowBg = isSelected ? '#f59e0b10'
                : isPaye    ? 'rgba(74,222,128,0.07)'
                : hasDepot  ? 'rgba(245,158,11,0.07)'
                : isPipeline ? 'rgba(139,92,246,0.05)'
                : 'transparent';
              const rowBorderLeft = isPaye    ? '3px solid #4ade80'
                : hasDepot  ? '3px solid #f59e0b'
                : isPipeline ? '3px solid #8b5cf6'
                : '3px solid transparent';

              return (
                <tr key={r.stock_numero}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.8)', background: rowBg, cursor: 'pointer', borderLeft: rowBorderLeft }}
                  onClick={() => toggleSelect(r.stock_numero)}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = isPaye ? 'rgba(74,222,128,0.12)' : hasDepot ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.03)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = rowBg; }}
                >
                  <td style={{ padding: '9px 12px', width: 36 }} onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(r.stock_numero)} style={{ cursor: 'pointer', accentColor: '#f59e0b' }} />
                  </td>
                  <td style={{ padding: '9px 12px', fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {r.stock_numero}
                      {isPaye    && <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 10, background: 'rgba(74,222,128,0.2)', color: '#4ade80' }}>PAYÉ</span>}
                      {hasDepot  && <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 10, background: 'rgba(245,158,11,0.2)', color: '#f59e0b' }}>DÉPÔT</span>}
                      {isPipeline && !hasDepot && <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 10, background: 'rgba(139,92,246,0.2)', color: '#a78bfa' }}>PIPELINE</span>}
                    </div>
                  </td>
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

// ── Vue Ventes Pièces ─────────────────────────────────────────────────────────

function VuePieces() {
  const [rows, setRows] = useState<PieceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVendeurs, setSelectedVendeurs] = useState<Set<string>>(new Set());
  const [fAnnee, setFAnnee] = useState('');
  const [fDateDu, setFDateDu] = useState('');
  const [fDateAu, setFDateAu] = useState('');
  const [sortCol, setSortCol] = useState('date_vente');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    // Supabase limite à 1000 lignes par défaut — on pagine pour tout récupérer
    (async () => {
      const PAGE = 1000;
      let all: PieceRow[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('prod_ventes_pieces')
          .select('*')
          .range(from, from + PAGE - 1);
        if (error || !data || data.length === 0) break;
        all = all.concat(data as PieceRow[]);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      setRows(all);
      setLoading(false);
    })();
  }, []);

  const allVendeurs = useMemo(() => unique(rows.map(r => nomVendeur(r.vendeur))), [rows]);

  function toggleVendeur(v: string) {
    setSelectedVendeurs(prev => {
      const next = new Set(prev);
      next.has(v) ? next.delete(v) : next.add(v);
      return next;
    });
  }

  const filtered = useMemo(() => {
    let r = rows;
    if (selectedVendeurs.size > 0)
      r = r.filter(x => selectedVendeurs.has(nomVendeur(x.vendeur)));
    if (fAnnee) r = r.filter(x => String(x.annee_fiscale) === fAnnee);
    if (fDateDu) r = r.filter(x => x.date_vente >= fDateDu);
    if (fDateAu) r = r.filter(x => x.date_vente <= fDateAu);
    return [...r].sort((a, b) => {
      const va = (a as Record<string, unknown>)[sortCol] ?? '';
      const vb = (b as Record<string, unknown>)[sortCol] ?? '';
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, selectedVendeurs, fAnnee, fDateDu, fDateAu, sortCol, sortDir]);

  const totalNet   = filtered.reduce((s, r) => s + (r.sous_total ?? 0), 0);
  const ventes     = filtered.filter(r => (r.sous_total ?? 0) > 0);
  const retours    = filtered.filter(r => (r.sous_total ?? 0) < 0);
  const totalPos   = ventes.reduce((s, r) => s + r.sous_total, 0);
  const nbFactures = ventes.length;
  const nbRetours  = retours.length;
  const totalRetours = retours.reduce((s, r) => s + r.sous_total, 0); // valeur négative

  // Graphique par vendeur (ventes nettes)
  const parVendeur = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(r => {
      const v = nomVendeur(r.vendeur);
      map[v] = (map[v] ?? 0) + (r.sous_total ?? 0);
    });
    return Object.entries(map)
      .map(([name, total]) => ({ name, total: Math.round(total) }))
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  // Retours par vendeur (toujours sur tous les rows, pas seulement filtered)
  const retoursParVendeur = useMemo(() => {
    // Appliquer tous les filtres sauf le chip vendeur pour avoir le tableau complet
    let base = rows;
    if (fAnnee) base = base.filter(x => String(x.annee_fiscale) === fAnnee);
    if (fDateDu) base = base.filter(x => x.date_vente >= fDateDu);
    if (fDateAu) base = base.filter(x => x.date_vente <= fDateAu);

    const map: Record<string, { nb: number; montant: number }> = {};
    base.filter(r => (r.sous_total ?? 0) < 0).forEach(r => {
      const v = nomVendeur(r.vendeur);
      if (!map[v]) map[v] = { nb: 0, montant: 0 };
      map[v].nb++;
      map[v].montant += r.sous_total ?? 0;
    });
    return Object.entries(map)
      .map(([nom, s]) => ({ nom, nb: s.nb, montant: s.montant }))
      .sort((a, b) => a.montant - b.montant); // du plus grand retour au plus petit
  }, [rows, fAnnee, fDateDu, fDateAu]);

  // Graphique par mois (format YYYY-MM)
  const parMois = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(r => {
      const mois = r.date_vente?.slice(0, 7) ?? '?';
      map[mois] = (map[mois] ?? 0) + (r.sous_total ?? 0);
    });
    return Object.entries(map)
      .map(([mois, total]) => ({ mois, total: Math.round(total) }))
      .sort((a, b) => a.mois.localeCompare(b.mois));
  }, [filtered]);

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  }

  const stickyTh: React.CSSProperties = {
    position: 'sticky', top: 0, zIndex: 2,
    background: '#141311', boxShadow: '0 1px 0 rgba(255,255,255,0.08)',
  };
  const Th = ({ col, label }: { col: string; label: string }) => (
    <th onClick={() => toggleSort(col)} style={{
      ...stickyTh, padding: '10px 12px', textAlign: 'right',
      color: sortCol === col ? '#10b981' : 'rgba(255,255,255,0.4)',
      fontWeight: 600, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none',
    }}>
      {label} {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  );

  if (loading) return <div style={{ color: 'rgba(255,255,255,0.4)', padding: 32 }}>Chargement…</div>;

  const hasFilters = selectedVendeurs.size > 0 || fAnnee || fDateDu || fDateAu;

  return (
    <div>
      {/* ── Filtres ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>

        {/* Chips vendeurs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: 600 }}>Vendeur :</span>
          <button
            onClick={() => setSelectedVendeurs(new Set())}
            style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: selectedVendeurs.size === 0 ? '#10b981' : 'rgba(255,255,255,0.06)',
              border: selectedVendeurs.size === 0 ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.12)',
              color: selectedVendeurs.size === 0 ? 'white' : 'rgba(255,255,255,0.5)',
            }}
          >Tous</button>
          {allVendeurs.map(v => (
            <button key={v} onClick={() => toggleVendeur(v)} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: selectedVendeurs.has(v) ? '#10b98120' : 'rgba(255,255,255,0.06)',
              border: selectedVendeurs.has(v) ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.12)',
              color: selectedVendeurs.has(v) ? '#10b981' : 'rgba(255,255,255,0.5)',
            }}>{v}</button>
          ))}
        </div>

        {/* Année fiscale */}
        <Select
          label="Année fiscale"
          options={unique(rows.map(r => String(r.annee_fiscale)))}
          value={fAnnee}
          onChange={setFAnnee}
        />

        {/* Plage de dates */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Du</span>
          <input type="date" value={fDateDu} onChange={e => setFDateDu(e.target.value)}
            style={{ background: '#1a1917', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'white', padding: '7px 10px', fontSize: 13, colorScheme: 'dark' }} />
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Au</span>
          <input type="date" value={fDateAu} onChange={e => setFDateAu(e.target.value)}
            style={{ background: '#1a1917', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'white', padding: '7px 10px', fontSize: 13, colorScheme: 'dark' }} />
        </div>

        {hasFilters && (
          <button onClick={() => { setSelectedVendeurs(new Set()); setFAnnee(''); setFDateDu(''); setFDateAu(''); }}
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'rgba(255,255,255,0.5)', padding: '7px 14px', fontSize: 13, cursor: 'pointer' }}>
            Effacer filtres
          </button>
        )}
      </div>

      {/* ── KPIs ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <KpiCard label="Factures" value={String(nbFactures)} />
        <KpiCard label="Ventes brutes" value={fmt$(totalPos)} />
        <KpiCard label="Net (avoirs inclus)" value={fmt$(totalNet)} color={totalNet >= 0 ? '#10b981' : '#ef4444'} />
        <KpiCard label="Moy. / facture" value={nbFactures > 0 ? fmt$(totalPos / nbFactures) : '—'} />
        <KpiCard label="Nb retours" value={String(nbRetours)} color={nbRetours > 0 ? '#ef4444' : 'rgba(255,255,255,0.5)'} />
        <KpiCard label="Total retours $" value={fmt$(totalRetours)} color="#ef4444" />
      </div>

      {/* ── Graphiques ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>

        {/* Par vendeur */}
        <div style={{ flex: 1, minWidth: 260, background: '#1a1917', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Ventes net / Vendeur</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart layout="vertical" data={parVendeur} margin={{ right: 100, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11 }} width={100} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => fmt$(v)} contentStyle={{ background: '#1e1c18', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'white', fontSize: 12 }} />
              <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                {parVendeur.map((e, i) => <Cell key={i} fill={e.total >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.85} />)}
                <LabelList dataKey="total" position="right" formatter={(v: number) => fmt$(v)} style={{ fill: 'rgba(255,255,255,0.6)', fontSize: 10 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Par mois */}
        <div style={{ flex: 2, minWidth: 300, background: '#1a1917', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 16 }}>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Ventes net / Mois</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={parMois} margin={{ right: 8, left: 4, bottom: 20, top: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="mois" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} angle={-35} textAnchor="end" />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v: number) => fmt$(v)} contentStyle={{ background: '#1e1c18', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'white', fontSize: 12 }} />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {parMois.map((e, i) => <Cell key={i} fill={e.total >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.85} />)}
                <LabelList dataKey="total" position="top" formatter={(v: number) => `${Math.round(v / 1000)}k`} style={{ fill: 'rgba(255,255,255,0.5)', fontSize: 9 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Analyse des retours ── */}
      <div style={{ background: '#1a1917', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: 16, marginBottom: 24 }}>
        <div style={{ color: '#ef4444', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
          Analyse des retours {selectedVendeurs.size > 0 ? '— sélection' : '— tous les vendeurs'}
        </div>
        {retoursParVendeur.length === 0 ? (
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Aucun retour dans la période sélectionnée.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <th style={{ padding: '6px 12px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 11 }}>Vendeur</th>
                <th style={{ padding: '6px 12px', textAlign: 'right', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 11 }}>Nb retours</th>
                <th style={{ padding: '6px 12px', textAlign: 'right', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 11 }}>Montant retourné</th>
                <th style={{ padding: '6px 12px', textAlign: 'right', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 11 }}>% des ventes</th>
              </tr>
            </thead>
            <tbody>
              {retoursParVendeur.map(r => {
                const ventesVendeur = parVendeur.find(v => v.name === r.nom)?.total ?? 0;
                const pct = ventesVendeur > 0 ? Math.abs(r.montant) / (ventesVendeur + Math.abs(r.montant)) * 100 : 0;
                return (
                  <tr key={r.nom} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.04)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{r.nom}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#ef4444', fontWeight: 700 }}>{r.nb}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#ef4444', fontWeight: 700 }}>{fmt$(r.montant)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: pct > 10 ? '#ef4444' : pct > 5 ? '#f59e0b' : 'rgba(255,255,255,0.5)' }}>
                      {pct.toFixed(1)} %
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <td style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontSize: 12 }}>TOTAL SÉLECTION</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#ef4444', fontWeight: 700 }}>{nbRetours}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', color: '#ef4444', fontWeight: 700 }}>{fmt$(totalRetours)}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
                  {totalPos > 0 ? (Math.abs(totalRetours) / totalPos * 100).toFixed(1) + ' %' : '—'}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* ── Tableau détail ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <th style={{ ...stickyTh, padding: '10px 12px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 12 }}>Date</th>
            <th style={{ ...stickyTh, padding: '10px 12px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 12 }}>Doc #</th>
            <th style={{ ...stickyTh, padding: '10px 12px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 12 }}>Client</th>
            <th style={{ ...stickyTh, padding: '10px 12px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 12 }}>Vendeur</th>
            <Th col="annee_fiscale" label="AF" />
            <Th col="sous_total" label="Montant" />
          </tr>
        </thead>
        <tbody>
          {filtered.map(r => (
            <tr key={r.document_numero}
              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.8)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <td style={{ padding: '9px 12px' }}>{r.date_vente}</td>
              <td style={{ padding: '9px 12px', fontWeight: 600, fontFamily: 'monospace' }}>{r.document_numero}</td>
              <td style={{ padding: '9px 12px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.client || '—'}</td>
              <td style={{ padding: '9px 12px' }}>
                <span style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                  {nomVendeur(r.vendeur)}
                </span>
              </td>
              <td style={{ padding: '9px 12px', textAlign: 'right' }}>{r.annee_fiscale}</td>
              <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: (r.sous_total ?? 0) < 0 ? '#ef4444' : 'rgba(255,255,255,0.9)' }}>
                {fmt$(r.sous_total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length === 0 && (
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, padding: '24px 12px', textAlign: 'center' }}>Aucun résultat</div>
      )}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────

export function VueProfitabilite() {
  const [tab, setTab] = useState<'ventes' | 'inventaire' | 'plans' | 'pieces' | 'encombre'>('ventes');
  const [invMeta, setInvMeta] = useState<InvMeta[]>([]);

  useEffect(() => {
    supabase.from('prod_inventaire').select('numero, marque, modele, annee, type').then(({ data }) => {
      if (data) setInvMeta(data as InvMeta[]);
    });
  }, []);

  const TABS = [
    { id: 'ventes' as const,     label: 'Rapport Vente',           icon: '📊' },
    { id: 'inventaire' as const, label: 'Inventaire & Projection', icon: '🔭' },
    { id: 'plans' as const,      label: 'Plans de vente',          icon: '📋' },
    { id: 'pieces' as const,     label: 'Ventes Pièces',           icon: '🔧' },
    { id: 'encombre' as const,   label: 'Bilan hebdomadaire',       icon: '📅' },
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

      {tab === 'ventes'     && <VueVentes invMeta={invMeta} />}
      {tab === 'inventaire' && <VueInventaire invMeta={invMeta} onGoToPlans={() => setTab('plans')} />}
      {tab === 'plans'      && <VuePlans invMeta={invMeta} />}
      {tab === 'pieces'     && <VuePieces />}
      {tab === 'encombre'   && <VueBilanHebdo />}
    </div>
  );
}
