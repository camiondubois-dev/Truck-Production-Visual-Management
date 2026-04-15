import { useState, useEffect, useMemo, useCallback } from 'react';
import { useInventaire } from '../contexts/InventaireContext';
import { supabase } from '../lib/supabase';
import { ROAD_MAP_STATIONS } from '../data/etapes';
import { itemsService } from '../services/itemsService';
import type { Item } from '../types/item.types';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts';
import type { VehiculeInventaire, RoadMapEtape } from '../types/inventaireTypes';

// ── Types ──────────────────────────────────────────────────────
interface Reservoir {
  id: string;
  numero: string;
  type: string;
  etat: string;
  camionId?: string;
}

interface TimeLog {
  garageId: string;
  dureeMinutes: number | null;
}

interface Filters {
  commercial?: 'vendu' | 'reserve' | 'location' | 'non-vendu';
  phase?: 'pret' | 'en-production' | 'disponible';
  variante?: 'Neuf' | 'Usagé';
  station?: string;
  reservoir?: 'avec' | 'sans';
  aging?: string;
  alerte?: 'vendu-pas-pret' | 'ecart-reservoir';
  vendusPret?: 'pret' | 'pas-pret';
}

const FILTER_LABELS: Record<string, string> = {
  commercial: 'Statut commercial',
  phase: 'Phase',
  variante: 'Variante',
  station: 'Station',
  reservoir: 'Réservoir',
  aging: 'Ancienneté',
  alerte: 'Alerte',
};

type VueAnalyseTab = 'general' | 'eau' | 'reservoirs' | 'detail' | 'livraisons';
type PeriodeLivraisons = 'semaine' | 'mois' | '3mois';

// ── Couleurs ───────────────────────────────────────────────────
const COLORS: Record<string, string> = {
  vendu: '#22c55e',
  reserve: '#f59e0b',
  location: '#8b5cf6',
  'non-vendu': '#64748b',
  nonVendu: '#64748b',
  pret: '#22c55e',
  'en-production': '#3b82f6',
  disponible: '#94a3b8',
  avecReservoir: '#0ea5e9',
  sansReservoir: '#334155',
  Neuf: '#6366f1',
  'Usagé': '#f97316',
  avec: '#0ea5e9',
  sans: '#334155',
};

const STATION_COLORS: Record<string, string> = {};
ROAD_MAP_STATIONS.forEach(s => { STATION_COLORS[s.id] = s.color; });

// ── Helpers ────────────────────────────────────────────────────
function formatDuree(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`;
}

function formatJours(minutes: number): string {
  const jours = minutes / (60 * 8);
  if (jours < 1) return formatDuree(minutes);
  return `${jours.toFixed(1)}j`;
}

function getPhase(v: VehiculeInventaire): 'pret' | 'en-production' | 'disponible' {
  if (v.estPret) return 'pret';
  if (v.statut === 'en-production') return 'en-production';
  return 'disponible';
}

function getCommercial(v: VehiculeInventaire): 'vendu' | 'reserve' | 'location' | 'non-vendu' {
  return (v.etatCommercial as any) ?? 'non-vendu';
}

function getStationEnCours(v: VehiculeInventaire): string | null {
  return v.roadMap?.find((s: RoadMapEtape) => s.statut === 'en-cours')?.stationId ?? null;
}

function getProgression(v: VehiculeInventaire): number {
  if (!v.roadMap || v.roadMap.length === 0) return 0;
  return Math.round(v.roadMap.filter((s: RoadMapEtape) => s.statut === 'termine' || s.statut === 'saute').length / v.roadMap.length * 100);
}

function getAgingBin(v: VehiculeInventaire): string {
  const days = (Date.now() - new Date(v.dateEnProduction ?? v.dateImport).getTime()) / 86400000;
  if (days < 7) return '< 7j';
  if (days < 14) return '7-14j';
  if (days < 30) return '14-30j';
  if (days < 60) return '30-60j';
  if (days < 90) return '60-90j';
  return '90j+';
}

const AGING_BINS = ['< 7j', '7-14j', '14-30j', '30-60j', '60-90j', '90j+'];

const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function formatDateArchive(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

// ── Custom Tooltip ─────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1e293b', border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: 8, padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    }}>
      {label && <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginBottom: 6 }}>{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'white' }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: p.color || p.fill }} />
          <span style={{ color: 'rgba(255,255,255,0.7)' }}>{p.name}:</span>
          <span style={{ fontWeight: 700 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, icon, active, onClick }: {
  label: string; value: string | number; sub?: string; color: string; icon: string;
  active?: boolean; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: active ? `${color}25` : `${color}12`,
        border: active ? `2px solid ${color}` : `1px solid ${color}30`,
        borderRadius: 12, padding: '18px 20px',
        display: 'flex', flexDirection: 'column', gap: 6,
        minWidth: 0, cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s',
        transform: active ? 'scale(1.02)' : 'scale(1)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 600, letterSpacing: '0.04em' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color, fontFamily: 'monospace', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>{sub}</div>}
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────
function Section({ title, icon, children, span, badge }: {
  title: string; icon: string; children: React.ReactNode; span?: number; badge?: React.ReactNode;
}) {
  return (
    <div style={{
      background: '#161514', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 14, padding: 24, gridColumn: span ? `span ${span}` : undefined,
      display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      <div style={{
        fontSize: 17, fontWeight: 700, color: 'rgba(255,255,255,0.9)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ flex: 1 }}>{title}</span>
        {badge}
      </div>
      {children}
    </div>
  );
}

// ── Mini Table ─────────────────────────────────────────────────
function MiniTable({ rows, columns, large }: {
  rows: { id: string; cells: (string | React.ReactNode)[] }[];
  columns: string[];
  large?: boolean;
}) {
  const fs = large ? 15 : 13;
  const hfs = large ? 14 : 12;
  const pad = large ? '12px 16px' : '8px 12px';
  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: large ? 600 : 400 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: fs }}>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i} style={{
                textAlign: 'left', padding: pad,
                color: 'rgba(255,255,255,0.5)', fontWeight: 700,
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                position: 'sticky', top: 0, background: '#161514',
                fontSize: hfs, letterSpacing: '0.04em',
              }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} style={{ transition: 'background 0.1s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {r.cells.map((cell, i) => (
                <td key={i} style={{
                  padding: pad, color: 'rgba(255,255,255,0.8)',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                }}>{cell}</td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} style={{ padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
                Aucune donnée
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Badge commercial ──────────────────────────────────────────
function CommercialBadge({ etat }: { etat: string }) {
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    'vendu': { bg: '#22c55e20', color: '#22c55e', label: 'Vendu' },
    'reserve': { bg: '#f59e0b20', color: '#f59e0b', label: 'Réservé' },
    'location': { bg: '#8b5cf620', color: '#8b5cf6', label: 'Location' },
    'non-vendu': { bg: '#64748b20', color: '#64748b', label: 'Non vendu' },
  };
  const c = cfg[etat] ?? cfg['non-vendu'];
  return (
    <span style={{
      background: c.bg, color: c.color, padding: '3px 10px',
      borderRadius: 4, fontWeight: 700, fontSize: 13,
    }}>{c.label}</span>
  );
}

// ── Progress Bar ───────────────────────────────────────────────
function ProgressBar({ value }: { value: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', borderRadius: 3, background: value === 100 ? '#22c55e' : '#3b82f6', transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', minWidth: 36 }}>{value}%</span>
    </div>
  );
}

// ── Type badge (Général view) ─────────────────────────────────
function TypeBadge({ type }: { type: string }) {
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    'eau': { bg: '#f9731620', color: '#f97316', label: 'Eau' },
    'detail': { bg: '#22c55e20', color: '#22c55e', label: 'Détail' },
    'client': { bg: '#3b82f620', color: '#3b82f6', label: 'Client' },
  };
  const c = cfg[type] ?? { bg: '#64748b20', color: '#64748b', label: type };
  return (
    <span style={{ background: c.bg, color: c.color, padding: '3px 8px', borderRadius: 4, fontWeight: 700, fontSize: 12 }}>
      {c.label}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════
// ── COMPOSANT PRINCIPAL ──────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export function VueAnalyse() {
  const { vehicules } = useInventaire();

  const [reservoirs, setReservoirs] = useState<Reservoir[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [loadingExtra, setLoadingExtra] = useState(true);
  const [filters, setFilters] = useState<Filters>({});

  // ── Nouveaux états ────────────────────────────────────────
  const [vueActive, setVueActive] = useState<VueAnalyseTab>('eau');
  const [filtreNumero, setFiltreNumero] = useState('');
  const [periodeActive, setPeriodeActive] = useState<PeriodeLivraisons>('semaine');
  const [archivesItems, setArchivesItems] = useState<Item[]>([]);

  // Charger réservoirs + time logs + archives
  useEffect(() => {
    Promise.all([
      supabase.from('prod_reservoirs').select('*').then(r => r.data ?? []),
      supabase.from('prod_time_logs').select('garage_id, duree_minutes').not('duree_minutes', 'is', null).then(r => r.data ?? []),
    ]).then(([res, logs]) => {
      setReservoirs(res.map((r: any) => ({
        id: r.id, numero: r.numero, type: r.type, etat: r.etat,
        camionId: r.camion_id ?? undefined,
      })));
      setTimeLogs(logs.map((l: any) => ({
        garageId: l.garage_id, dureeMinutes: l.duree_minutes,
      })));
    }).catch(console.error).finally(() => setLoadingExtra(false));
  }, []);

  useEffect(() => {
    itemsService.getAllArchives().then(setArchivesItems).catch(console.error);
  }, []);

  // ── Toggle filtre ─────────────────────────────────────────
  const toggleFilter = useCallback((key: keyof Filters, value: any) => {
    setFilters(prev => {
      if (prev[key] === value) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: value };
    });
  }, []);

  const clearFilters = useCallback(() => setFilters({}), []);
  const hasFilters = Object.keys(filters).length > 0;

  // ── Groupes de camions ────────────────────────────────────
  const camionsEau = useMemo(() =>
    vehicules.filter(v => v.type === 'eau' && v.statut !== 'archive'),
    [vehicules]
  );

  const camionsDetail = useMemo(() =>
    vehicules.filter(v => v.type === 'detail' && v.statut !== 'archive'),
    [vehicules]
  );

  const camionsClient = useMemo(() =>
    vehicules.filter(v => v.type === 'client' && v.statut !== 'archive'),
    [vehicules]
  );

  // ── Base dynamique selon vue active ──────────────────────
  const camionsBase = useMemo(() => {
    if (vueActive === 'eau') return camionsEau;
    if (vueActive === 'detail') return camionsDetail;
    if (vueActive === 'general') return [...camionsEau, ...camionsDetail];
    return camionsEau;
  }, [vueActive, camionsEau, camionsDetail]);

  // ── Appliquer les filtres ─────────────────────────────────
  const camionsFiltres = useMemo(() => {
    let result = camionsBase;
    if (filters.commercial) {
      result = result.filter(v => getCommercial(v) === filters.commercial);
    }
    if (filters.phase) {
      result = result.filter(v => getPhase(v) === filters.phase);
    }
    if (filters.variante) {
      result = result.filter(v => v.variante === filters.variante);
    }
    if (filters.station) {
      result = result.filter(v => getStationEnCours(v) === filters.station);
    }
    if (filters.reservoir) {
      result = result.filter(v => filters.reservoir === 'avec' ? v.aUnReservoir : !v.aUnReservoir);
    }
    if (filters.aging) {
      result = result.filter(v => getPhase(v) === 'en-production' && getAgingBin(v) === filters.aging);
    }
    if (filters.alerte === 'vendu-pas-pret') {
      result = result.filter(v => getCommercial(v) === 'vendu' && !v.estPret);
    }
    if (filters.alerte === 'ecart-reservoir') {
      result = result.filter(v => !v.aUnReservoir && v.statut !== 'archive');
    }
    if (filters.commercial === 'vendu' && filters.vendusPret) {
      if (filters.vendusPret === 'pret') {
        result = result.filter(v => v.estPret);
      } else {
        result = result.filter(v => !v.estPret);
      }
    }
    return result;
  }, [camionsBase, filters]);

  // Compteurs vendus prêts / pas prêts
  const vendusStats = useMemo(() => {
    const vendus = camionsBase.filter(v => getCommercial(v) === 'vendu');
    return {
      total: vendus.length,
      prets: vendus.filter(v => v.estPret).length,
      pasPrets: vendus.filter(v => !v.estPret).length,
    };
  }, [camionsBase]);

  // ── Catégories ────────────────────────────────────────────
  const prets = useMemo(() => camionsFiltres.filter(v => v.estPret), [camionsFiltres]);
  const enProduction = useMemo(() => camionsFiltres.filter(v => v.statut === 'en-production'), [camionsFiltres]);
  const disponibles = useMemo(() => camionsFiltres.filter(v => v.statut === 'disponible' && !v.estPret), [camionsFiltres]);

  // ── Alertes (sur données eau non-filtrées) ────────────────
  const vendusNonPrets = useMemo(() =>
    camionsEau.filter(v => getCommercial(v) === 'vendu' && !v.estPret),
    [camionsEau]
  );
  const camionsSansReservoir = useMemo(() =>
    camionsEau.filter(v => !v.aUnReservoir),
    [camionsEau]
  );
  const reservoirsDisponibles = useMemo(() =>
    reservoirs.filter(r => r.etat === 'disponible'),
    [reservoirs]
  );
  const ecartReservoir = camionsSansReservoir.length - reservoirsDisponibles.length;

  const TYPES_RES = ['2500g', '3750g', '4000g', '5000g'] as const;
  const ecartParType = useMemo(() => {
    const besoinsParType: Record<string, { count: number; camions: VehiculeInventaire[] }> = {};
    TYPES_RES.forEach(t => { besoinsParType[t] = { count: 0, camions: [] }; });
    camionsSansReservoir.forEach(v => {
      if (v.typeReservoirRequis && besoinsParType[v.typeReservoirRequis]) {
        besoinsParType[v.typeReservoirRequis].count++;
        besoinsParType[v.typeReservoirRequis].camions.push(v);
      }
    });
    const dispoParType: Record<string, number> = {};
    TYPES_RES.forEach(t => { dispoParType[t] = 0; });
    reservoirsDisponibles.forEach(r => {
      if (dispoParType[r.type] !== undefined) dispoParType[r.type]++;
    });
    return TYPES_RES.map(type => ({
      type,
      besoin: besoinsParType[type].count,
      disponible: dispoParType[type],
      ecart: besoinsParType[type].count - dispoParType[type],
      camions: besoinsParType[type].camions,
    }));
  }, [camionsSansReservoir, reservoirsDisponibles]);

  const camionsSansTypeSpecifie = useMemo(() =>
    camionsSansReservoir.filter(v => !v.typeReservoirRequis),
    [camionsSansReservoir]
  );
  const hasEcartParType = ecartParType.some(e => e.ecart > 0);

  // ── Données graphiques ────────────────────────────────────
  const phaseData = useMemo(() => [
    { name: 'Prêts', value: prets.length, key: 'pret' as const, color: COLORS.pret },
    { name: 'En production', value: enProduction.length, key: 'en-production' as const, color: COLORS['en-production'] },
    { name: 'Disponibles', value: disponibles.length, key: 'disponible' as const, color: COLORS.disponible },
  ].filter(d => d.value > 0), [prets, enProduction, disponibles]);

  const commercialData = useMemo(() => {
    const counts: Record<string, number> = { vendu: 0, reserve: 0, location: 0, 'non-vendu': 0 };
    camionsFiltres.forEach(v => { counts[getCommercial(v)]++; });
    return [
      { name: 'Vendus', value: counts.vendu, key: 'vendu' as const, color: COLORS.vendu },
      { name: 'Réservés', value: counts.reserve, key: 'reserve' as const, color: COLORS.reserve },
      { name: 'Location', value: counts.location, key: 'location' as const, color: COLORS.location },
      { name: 'Non vendus', value: counts['non-vendu'], key: 'non-vendu' as const, color: COLORS['non-vendu'] },
    ].filter(d => d.value > 0);
  }, [camionsFiltres]);

  const varianteData = useMemo(() => {
    const neufs = camionsFiltres.filter(v => v.variante === 'Neuf').length;
    const usages = camionsFiltres.filter(v => v.variante === 'Usagé').length;
    const autres = camionsFiltres.length - neufs - usages;
    return [
      { name: 'Neuf', value: neufs, key: 'Neuf' as const, color: COLORS.Neuf },
      { name: 'Usagé', value: usages, key: 'Usagé' as const, color: COLORS['Usagé'] },
      ...(autres > 0 ? [{ name: 'Autre', value: autres, key: '' as const, color: '#475569' }] : []),
    ].filter(d => d.value > 0);
  }, [camionsFiltres]);

  const reservoirPieData = useMemo(() => {
    const avec = camionsFiltres.filter(v => v.aUnReservoir).length;
    const sans = camionsFiltres.filter(v => !v.aUnReservoir).length;
    return [
      { name: 'Avec réservoir', value: avec, key: 'avec' as const, color: COLORS.avec },
      { name: 'Sans réservoir', value: sans, key: 'sans' as const, color: COLORS.sans },
    ].filter(d => d.value > 0);
  }, [camionsFiltres]);

  const stationLoad = useMemo(() => {
    return ROAD_MAP_STATIONS.map(station => {
      let enCours = 0, enAttente = 0, planifie = 0;
      camionsFiltres.forEach(v => {
        const step = v.roadMap?.find((s: RoadMapEtape) => s.stationId === station.id);
        if (!step || step.statut === 'saute' || step.statut === 'termine') return;
        if (step.statut === 'en-cours') enCours++;
        else if (step.statut === 'en-attente') enAttente++;
        else if (step.statut === 'planifie') planifie++;
      });
      return {
        station: station.label, stationId: station.id,
        'En cours': enCours, 'En attente': enAttente, 'Planifié': planifie,
        total: enCours + enAttente + planifie,
      };
    });
  }, [camionsFiltres]);

  const agingData = useMemo(() => {
    const bins: Record<string, number> = {};
    AGING_BINS.forEach(b => { bins[b] = 0; });
    camionsFiltres.filter(v => v.statut === 'en-production').forEach(v => { bins[getAgingBin(v)]++; });
    return AGING_BINS.map(b => ({ name: b, Camions: bins[b] }));
  }, [camionsFiltres]);

  const tempsParGarage = useMemo(() => {
    const grouped: Record<string, number[]> = {};
    timeLogs.forEach(l => {
      if (!l.dureeMinutes) return;
      if (!grouped[l.garageId]) grouped[l.garageId] = [];
      grouped[l.garageId].push(l.dureeMinutes);
    });
    return ROAD_MAP_STATIONS.map(station => {
      const durees = grouped[station.id] ?? [];
      const moy = durees.length > 0 ? durees.reduce((a, b) => a + b, 0) / durees.length : 0;
      return {
        station: station.label.replace('Mécanique ', 'Méc. ').replace('Soudure ', 'Soud. '),
        stationId: station.id,
        'Temps moyen (min)': Math.round(moy),
        'Passages': durees.length,
        totalMinutes: durees.reduce((a, b) => a + b, 0),
        color: station.color,
      };
    }).filter(d => d['Temps moyen (min)'] > 0 || d.Passages > 0);
  }, [timeLogs]);

  const reservoirStats = useMemo(() => {
    const parType: Record<string, { total: number; dispo: number; installe: number; peinture: number }> = {};
    reservoirs.forEach(r => {
      if (!parType[r.type]) parType[r.type] = { total: 0, dispo: 0, installe: 0, peinture: 0 };
      parType[r.type].total++;
      if (r.etat === 'disponible') parType[r.type].dispo++;
      else if (r.etat === 'installe') parType[r.type].installe++;
      else if (r.etat === 'en-peinture') parType[r.type].peinture++;
    });
    return {
      total: reservoirs.length,
      disponibles: reservoirsDisponibles.length,
      installes: reservoirs.filter(r => r.etat === 'installe').length,
      enPeinture: reservoirs.filter(r => r.etat === 'en-peinture').length,
      parType,
    };
  }, [reservoirs, reservoirsDisponibles]);

  // ── Tableau camions ───────────────────────────────────────
  const camionsRows = useMemo(() => {
    let list = camionsFiltres;
    if (vueActive === 'general' && filtreNumero.trim()) {
      const q = filtreNumero.trim().toLowerCase();
      list = list.filter(v => v.numero?.toLowerCase().includes(q));
    }
    return list
      .sort((a, b) => {
        const aVnp = getCommercial(a) === 'vendu' && !a.estPret ? 0 : 1;
        const bVnp = getCommercial(b) === 'vendu' && !b.estPret ? 0 : 1;
        if (aVnp !== bVnp) return aVnp - bVnp;
        return getProgression(b) - getProgression(a);
      })
      .map(v => {
        const phase = getPhase(v);
        const stationId = getStationEnCours(v);
        const stationLabel = stationId
          ? ROAD_MAP_STATIONS.find(s => s.id === stationId)?.label ?? stationId
          : '—';
        const progression = getProgression(v);
        const isVenduNonPret = getCommercial(v) === 'vendu' && !v.estPret;
        const numCell = (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {isVenduNonPret && <span title="Vendu mais pas prêt!" style={{ fontSize: 14 }}>🚨</span>}
            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#f97316' }}>#{v.numero}</span>
          </div>
        );
        const phaseCell = (
          <span style={{
            padding: '3px 10px', borderRadius: 4, fontSize: 12, fontWeight: 700,
            background: phase === 'pret' ? '#22c55e20' : phase === 'en-production' ? '#3b82f620' : '#94a3b820',
            color: phase === 'pret' ? '#22c55e' : phase === 'en-production' ? '#3b82f6' : '#94a3b8',
          }}>
            {phase === 'pret' ? '✅ Prêt' : phase === 'en-production' ? '🔧 Production' : '📋 Dispo.'}
          </span>
        );
        const stationCell = phase === 'en-production'
          ? <span style={{ color: '#3b82f6', fontWeight: 600, fontSize: 13 }}>{stationLabel}</span>
          : <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>;
        const progressCell = phase === 'en-production'
          ? <ProgressBar value={progression} />
          : <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>;

        if (vueActive === 'eau') {
          return {
            id: v.id,
            cells: [
              numCell,
              `${v.marque ?? ''} ${v.modele ?? ''}`.trim() || '—',
              v.variante ?? '—',
              phaseCell,
              stationCell,
              progressCell,
              v.aUnReservoir
                ? <span style={{ color: '#0ea5e9', fontWeight: 700 }}>✓ Oui</span>
                : <span style={{ color: 'rgba(255,255,255,0.2)' }}>Non</span>,
              v.typeReservoirRequis
                ? <span style={{ fontWeight: 700, fontSize: 13, color: '#7dd3fc' }}>{v.typeReservoirRequis}</span>
                : <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 13 }}>—</span>,
              <CommercialBadge etat={getCommercial(v)} />,
              v.clientAcheteur || '—',
              v.dateLivraisonPlanifiee || '—',
            ],
          };
        }
        // général + detail: pas de colonnes réservoir, mais ajout Type pour général
        return {
          id: v.id,
          cells: [
            numCell,
            `${v.marque ?? ''} ${v.modele ?? ''}`.trim() || '—',
            ...(vueActive === 'general' ? [<TypeBadge type={v.type} />] : []),
            v.variante ?? '—',
            phaseCell,
            stationCell,
            progressCell,
            <CommercialBadge etat={getCommercial(v)} />,
            v.clientAcheteur || '—',
            v.dateLivraisonPlanifiee || '—',
          ],
        };
      });
  }, [camionsFiltres, vueActive, filtreNumero]);

  const reservoirRows = useMemo(() =>
    reservoirs.map(r => {
      const camion = r.camionId ? camionsEau.find(v => v.id === r.camionId || v.reservoirId === r.id) : null;
      const etatCfg: Record<string, { color: string; label: string }> = {
        'disponible': { color: '#22c55e', label: '✓ Disponible' },
        'installe': { color: '#0ea5e9', label: '🔧 Installé' },
        'en-peinture': { color: '#f59e0b', label: '🎨 Peinture' },
      };
      const ec = etatCfg[r.etat] ?? { color: '#64748b', label: r.etat };
      return {
        id: r.id,
        cells: [
          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0ea5e9', fontSize: 15 }}>{r.numero}</span>,
          <span style={{ fontWeight: 700, fontSize: 15 }}>{r.type}</span>,
          <span style={{ color: ec.color, fontWeight: 700, fontSize: 14 }}>{ec.label}</span>,
          camion
            ? <span style={{ fontFamily: 'monospace', color: '#f97316', fontSize: 15, fontWeight: 600 }}>#{camion.numero}</span>
            : <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>—</span>,
        ],
      };
    }),
    [reservoirs, camionsEau]
  );

  // ── Livraisons data ───────────────────────────────────────
  const livraisonsData = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    let chartData: { label: string; eau: number; detail: number; client: number }[];

    if (periodeActive === 'semaine') {
      const dayOfWeek = now.getDay();
      const daysFromMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startDate = new Date(now);
      startDate.setDate(now.getDate() - daysFromMon);
      startDate.setHours(0, 0, 0, 0);
      const bins = DAYS_FR.map(label => ({ label, eau: 0, detail: 0, client: 0 }));
      archivesItems.forEach(i => {
        if (!i.dateArchive) return;
        const d = new Date(i.dateArchive);
        if (d < startDate || d > now) return;
        const dayIdx = d.getDay() === 0 ? 6 : d.getDay() - 1;
        if (dayIdx >= 0 && dayIdx < 7) {
          const t = i.type as string;
          if (t === 'eau') bins[dayIdx].eau++;
          else if (t === 'detail') bins[dayIdx].detail++;
          else if (t === 'client') bins[dayIdx].client++;
        }
      });
      chartData = bins;
    } else if (periodeActive === 'mois') {
      const s = new Date(now);
      s.setDate(now.getDate() - 27);
      const d2 = s.getDay() === 0 ? 6 : s.getDay() - 1;
      s.setDate(s.getDate() - d2);
      s.setHours(0, 0, 0, 0);
      startDate = s;
      const bins = Array.from({ length: 5 }, (_, w) => ({
        label: w === 4 ? 'Cette sem.' : `Sem. -${4 - w}`,
        eau: 0, detail: 0, client: 0,
      }));
      archivesItems.forEach(i => {
        if (!i.dateArchive) return;
        const d = new Date(i.dateArchive);
        if (d < startDate || d > now) return;
        const msFromStart = d.getTime() - startDate.getTime();
        const weekIdx = Math.min(4, Math.floor(msFromStart / (7 * 24 * 3600 * 1000)));
        if (weekIdx >= 0) {
          const t = i.type as string;
          if (t === 'eau') bins[weekIdx].eau++;
          else if (t === 'detail') bins[weekIdx].detail++;
          else if (t === 'client') bins[weekIdx].client++;
        }
      });
      chartData = bins;
    } else {
      const months = [
        new Date(now.getFullYear(), now.getMonth() - 2, 1),
        new Date(now.getFullYear(), now.getMonth() - 1, 1),
        new Date(now.getFullYear(), now.getMonth(), 1),
      ];
      startDate = months[0];
      const bins = months.map(d => ({
        label: MONTHS_FR[d.getMonth()] + ' ' + d.getFullYear(),
        eau: 0, detail: 0, client: 0,
      }));
      archivesItems.forEach(i => {
        if (!i.dateArchive) return;
        const d = new Date(i.dateArchive);
        if (d < startDate || d > now) return;
        const monthIdx = months.findIndex((md, idx) => {
          const nextMonth = idx < 2 ? months[idx + 1] : new Date(now.getFullYear(), now.getMonth() + 1, 1);
          return d >= md && d < nextMonth;
        });
        if (monthIdx >= 0) {
          const t = i.type as string;
          if (t === 'eau') bins[monthIdx].eau++;
          else if (t === 'detail') bins[monthIdx].detail++;
          else if (t === 'client') bins[monthIdx].client++;
        }
      });
      chartData = bins;
      startDate = months[0];
    }

    const itemsInPeriod = archivesItems.filter(i => {
      if (!i.dateArchive) return false;
      const d = new Date(i.dateArchive);
      return d >= startDate && d <= now;
    });

    const clientsLivres = itemsInPeriod
      .filter(i => i.type === 'client' || (i.nomClient && i.nomClient.trim()))
      .sort((a, b) => new Date(b.dateArchive!).getTime() - new Date(a.dateArchive!).getTime());

    return { chartData, itemsInPeriod, clientsLivres };
  }, [archivesItems, periodeActive]);

  // ── Clickable Pie helper ──────────────────────────────────
  const renderClickablePie = (
    data: { name: string; value: number; key: string; color: string }[],
    filterKey: keyof Filters,
    size: number = 220,
  ) => {
    if (data.length === 0) {
      return (
        <div style={{ height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>
          Aucune donnée
        </div>
      );
    }
    const activeKey = filters[filterKey];
    return (
      <ResponsiveContainer width="100%" height={size}>
        <PieChart>
          <Pie
            data={data} dataKey="value" nameKey="name"
            cx="50%" cy="50%" innerRadius={45} outerRadius={75}
            strokeWidth={0}
            label={({ name, value, percent }: any) => percent >= 0.05 ? `${name} (${value})` : null}
            labelLine={false}
            style={{ cursor: 'pointer' }}
            onClick={(_: any, idx: number) => {
              const d = data[idx];
              if (d?.key) toggleFilter(filterKey, d.key);
            }}
          >
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.color}
                opacity={activeKey && activeKey !== d.key ? 0.25 : 1}
                stroke={activeKey === d.key ? 'white' : 'none'}
                strokeWidth={activeKey === d.key ? 2 : 0}
              />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}
            onClick={(e: any) => {
              const d = data.find(x => x.name === e.value);
              if (d?.key) toggleFilter(filterKey, d.key);
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  // ── Loading ───────────────────────────────────────────────
  if (loadingExtra) {
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        color: 'rgba(255,255,255,0.4)', fontSize: 14, fontFamily: 'monospace',
      }}>
        Chargement de l'analyse...
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════
  // ── RENDER ──────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════

  const TABS: { id: VueAnalyseTab; label: string; icon: string }[] = [
    { id: 'general', label: 'Général', icon: '📊' },
    { id: 'eau', label: "Camions à l'eau", icon: '🚒' },
    { id: 'reservoirs', label: 'Réservoirs', icon: '🛢' },
    { id: 'detail', label: 'Camions détail', icon: '🏷️' },
    { id: 'livraisons', label: 'Livraisons', icon: '📦' },
  ];

  const isTruckView = vueActive === 'general' || vueActive === 'eau' || vueActive === 'detail';

  const tableColumnsEau = ['#', 'Véhicule', 'Var.', 'Phase', 'Station', 'Progression', 'Rés.', 'Rés. requis', 'Commercial', 'Client', 'Livraison'];
  const tableColumnsGeneral = ['#', 'Véhicule', 'Type', 'Var.', 'Phase', 'Station', 'Progression', 'Commercial', 'Client', 'Livraison'];
  const tableColumnsDetail = ['#', 'Véhicule', 'Var.', 'Phase', 'Station', 'Progression', 'Commercial', 'Client', 'Livraison'];

  return (
    <div style={{
      width: '100%', height: '100%',
      overflowY: 'auto', overflowX: 'hidden',
      padding: 24, boxSizing: 'border-box',
    }}>

      {/* ── NAVIGATION TABS ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setVueActive(tab.id); clearFilters(); setFiltreNumero(''); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 18px', borderRadius: 10, cursor: 'pointer',
              fontWeight: 700, fontSize: 14, transition: 'all 0.15s',
              background: vueActive === tab.id ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
              border: vueActive === tab.id ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(255,255,255,0.08)',
              color: vueActive === tab.id ? 'white' : 'rgba(255,255,255,0.5)',
              boxShadow: vueActive === tab.id ? '0 2px 12px rgba(0,0,0,0.3)' : 'none',
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          VUE CAMIONS (général / eau / detail)
      ══════════════════════════════════════════════════════ */}
      {isTruckView && (
        <>
          {/* TITRE + FILTRES ACTIFS */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'white', fontFamily: 'system-ui, sans-serif', letterSpacing: '-0.02em' }}>
                {vueActive === 'general' ? '📊 Analyse — Général'
                  : vueActive === 'eau' ? "🚒 Analyse — Camions à l'eau"
                  : '🏷️ Analyse — Camions détail'}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                {camionsFiltres.length}/{camionsBase.length} camions{hasFilters ? ' (filtré)' : ''}
              </div>
            </div>

            {hasFilters && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                padding: '10px 14px', borderRadius: 10,
                background: 'rgba(139,92,246,0.08)',
                border: '1px solid rgba(139,92,246,0.2)',
              }}>
                <span style={{ fontSize: 11, color: '#8b5cf6', fontWeight: 700, marginRight: 4 }}>
                  FILTRES ACTIFS :
                </span>
                {Object.entries(filters).map(([key, value]) => (
                  <button key={key} onClick={() => toggleFilter(key as keyof Filters, value)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '4px 10px', borderRadius: 6,
                      background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                      color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                    }}
                  >
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>{FILTER_LABELS[key] ?? key}:</span>
                    <span>{String(value)}</span>
                    <span style={{ color: '#ef4444', fontWeight: 700 }}>✕</span>
                  </button>
                ))}
                <button onClick={clearFilters}
                  style={{
                    padding: '4px 12px', borderRadius: 6,
                    background: '#ef444420', border: '1px solid #ef444440',
                    color: '#ef4444', cursor: 'pointer', fontSize: 11, fontWeight: 700, marginLeft: 'auto',
                  }}
                >
                  Tout effacer
                </button>
              </div>
            )}
          </div>

          {/* ALERTES (eau seulement) */}
          {vueActive === 'eau' && (vendusNonPrets.length > 0 || ecartReservoir > 0) && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: vendusNonPrets.length > 0 && ecartReservoir > 0 ? '1fr 1fr' : '1fr',
              gap: 14, marginBottom: 20,
            }}>
              {vendusNonPrets.length > 0 && (
                <div onClick={() => toggleFilter('alerte', 'vendu-pas-pret')}
                  style={{
                    background: filters.alerte === 'vendu-pas-pret' ? '#ef444425' : '#ef444415',
                    border: filters.alerte === 'vendu-pas-pret' ? '2px solid #ef4444' : '1px solid #ef444440',
                    borderRadius: 12, padding: '16px 20px', cursor: 'pointer', transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', gap: 16,
                  }}
                >
                  <div style={{ fontSize: 36 }}>🚨</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#ef4444', marginBottom: 4 }}>
                      {vendusNonPrets.length} camion{vendusNonPrets.length > 1 ? 's' : ''} vendu{vendusNonPrets.length > 1 ? 's' : ''} PAS PRÊT{vendusNonPrets.length > 1 ? 'S' : ''}
                    </div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                      {vendusNonPrets.slice(0, 5).map(v => `#${v.numero}`).join(', ')}
                      {vendusNonPrets.length > 5 ? ` +${vendusNonPrets.length - 5} autres` : ''}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>Cliquer pour filtrer</div>
                  </div>
                </div>
              )}
              {(ecartReservoir > 0 || hasEcartParType) && (
                <div onClick={() => toggleFilter('alerte', 'ecart-reservoir')}
                  style={{
                    background: filters.alerte === 'ecart-reservoir' ? '#f59e0b25' : '#f59e0b15',
                    border: filters.alerte === 'ecart-reservoir' ? '2px solid #f59e0b' : '1px solid #f59e0b40',
                    borderRadius: 12, padding: '16px 20px', cursor: 'pointer', transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <div style={{ fontSize: 36 }}>⚠️</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#f59e0b', marginBottom: 2 }}>Écart réservoirs</div>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                        {camionsSansReservoir.length} camions sans réservoir · {reservoirsDisponibles.length} dispo en stock
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                    {ecartParType.map(e => {
                      const hasGap = e.ecart > 0;
                      const hasBesoin = e.besoin > 0 || e.disponible > 0;
                      return (
                        <div key={e.type} style={{
                          padding: '8px 10px', borderRadius: 8, textAlign: 'center',
                          background: hasGap ? '#ef444418' : hasBesoin ? '#22c55e15' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${hasGap ? '#ef444440' : hasBesoin ? '#22c55e30' : 'rgba(255,255,255,0.06)'}`,
                        }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>{e.type}</div>
                          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>
                            Besoin: <span style={{ color: 'white', fontWeight: 700, fontFamily: 'monospace' }}>{e.besoin}</span>
                          </div>
                          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
                            Dispo: <span style={{ color: '#22c55e', fontWeight: 700, fontFamily: 'monospace' }}>{e.disponible}</span>
                          </div>
                          {hasGap ? (
                            <div style={{ fontSize: 12, fontWeight: 800, color: '#ef4444' }}>-{e.ecart}</div>
                          ) : e.disponible > e.besoin ? (
                            <div style={{ fontSize: 12, fontWeight: 800, color: '#22c55e' }}>+{e.disponible - e.besoin}</div>
                          ) : (
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.2)' }}>OK</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {camionsSansTypeSpecifie.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 12, color: '#f59e0b', fontStyle: 'italic' }}>
                      ⚠ {camionsSansTypeSpecifie.length} camion{camionsSansTypeSpecifie.length > 1 ? 's' : ''} sans type de réservoir spécifié
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 6 }}>Cliquer pour filtrer les camions sans réservoir</div>
                </div>
              )}
            </div>
          )}

          {/* KPI ROW */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fit, minmax(180px, 1fr))`,
            gap: 14, marginBottom: 20,
          }}>
            <KpiCard icon="✅" label="PRÊTS" value={prets.length}
              sub={`${prets.filter(v => getCommercial(v) === 'vendu').length} vendus · ${prets.filter(v => getCommercial(v) !== 'vendu').length} non vendus`}
              color={COLORS.pret} active={filters.phase === 'pret'} onClick={() => toggleFilter('phase', 'pret')} />
            <KpiCard icon="🔧" label="EN PRODUCTION" value={enProduction.length}
              sub={`${enProduction.filter(v => getCommercial(v) === 'vendu').length} vendus · ${enProduction.filter(v => getCommercial(v) !== 'vendu').length} non vendus`}
              color={COLORS['en-production']} active={filters.phase === 'en-production'} onClick={() => toggleFilter('phase', 'en-production')} />
            <KpiCard icon="📋" label="DISPONIBLES" value={disponibles.length}
              sub="À planifier" color={COLORS.disponible} active={filters.phase === 'disponible'} onClick={() => toggleFilter('phase', 'disponible')} />
            {vueActive === 'eau' && (
              <KpiCard icon="🛢" label="RÉSERVOIRS DISPO." value={reservoirsDisponibles.length}
                sub={`${reservoirStats.total} total · ${reservoirStats.installes} installés · ${reservoirStats.enPeinture} peinture`}
                color={COLORS.avec} />
            )}
            <KpiCard icon="💰" label="VENDUS" value={camionsFiltres.filter(v => getCommercial(v) === 'vendu').length}
              sub={`${camionsFiltres.filter(v => getCommercial(v) === 'reserve').length} rés. · ${camionsFiltres.filter(v => getCommercial(v) === 'location').length} loc.`}
              color={COLORS.vendu} active={filters.commercial === 'vendu'} onClick={() => toggleFilter('commercial', 'vendu')} />
            {vueActive === 'general' && (
              <div style={{
                background: '#3b82f612', border: '1px solid #3b82f630',
                borderRadius: 12, padding: '18px 20px',
                display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>🚗</span>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: 600, letterSpacing: '0.04em' }}>
                    CLIENTS EN COURS
                  </span>
                </div>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#3b82f6', fontFamily: 'monospace', lineHeight: 1 }}>
                  {camionsClient.length}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>jobs actifs</div>
              </div>
            )}
          </div>

          {/* GRAPHIQUES — PIE CHARTS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 18 }}>
            <Section title="Par phase" icon="📦"
              badge={filters.phase ? <span style={{ fontSize: 10, background: '#8b5cf620', color: '#8b5cf6', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>FILTRE</span> : undefined}>
              {renderClickablePie(phaseData, 'phase', 200)}
            </Section>
            <Section title="Statut commercial" icon="💰"
              badge={filters.commercial ? <span style={{ fontSize: 10, background: '#8b5cf620', color: '#8b5cf6', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>FILTRE</span> : undefined}>
              {renderClickablePie(commercialData, 'commercial', 200)}
            </Section>
            <Section title="Neuf / Usagé" icon="🏷️"
              badge={filters.variante ? <span style={{ fontSize: 10, background: '#8b5cf620', color: '#8b5cf6', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>FILTRE</span> : undefined}>
              {renderClickablePie(varianteData, 'variante', 200)}
            </Section>
            {vueActive === 'eau' ? (
              <Section title="Réservoirs" icon="🛢"
                badge={filters.reservoir ? <span style={{ fontSize: 10, background: '#8b5cf620', color: '#8b5cf6', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>FILTRE</span> : undefined}>
                {renderClickablePie(reservoirPieData, 'reservoir', 200)}
              </Section>
            ) : (
              <Section title="Clients en cours" icon="🚗">
                <div style={{ height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <div style={{ fontSize: 64, fontWeight: 800, color: '#3b82f6', fontFamily: 'monospace', lineHeight: 1 }}>
                    {camionsClient.length}
                  </div>
                  <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>jobs actifs</div>
                </div>
              </Section>
            )}
          </div>

          {/* CHARGE PAR STATION */}
          <div style={{ marginBottom: 18 }}>
            <Section title="Charge par station (toutes étapes road map)" icon="📊"
              badge={filters.station ? <span style={{ fontSize: 12, background: '#8b5cf620', color: '#8b5cf6', padding: '3px 8px', borderRadius: 4, fontWeight: 700 }}>FILTRE: {filters.station}</span> : undefined}>
              <ResponsiveContainer width="100%" height={420}>
                <BarChart data={stationLoad} layout="vertical" margin={{ left: 10, right: 30 }}
                  onClick={(state: any) => {
                    if (state?.activeLabel) {
                      const station = stationLoad.find(s => s.station === state.activeLabel);
                      if (station?.stationId) toggleFilter('station', station.stationId);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 13 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="station" width={170} tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 600 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }} />
                  <Bar dataKey="En cours" stackId="a" fill="#3b82f6" />
                  <Bar dataKey="En attente" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="Planifié" stackId="a" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Section>
          </div>

          {/* ANCIENNETÉ + TEMPS MOYEN */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
            <Section title="Ancienneté en production" icon="⏱️"
              badge={filters.aging ? <span style={{ fontSize: 10, background: '#8b5cf620', color: '#8b5cf6', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>FILTRE: {filters.aging}</span> : undefined}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={agingData} margin={{ left: 0, right: 20 }}
                  onClick={(state: any) => { if (state?.activeLabel) toggleFilter('aging', state.activeLabel); }}
                  style={{ cursor: 'pointer' }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="Camions" radius={[4, 4, 0, 0]}>
                    {agingData.map((d, i) => (
                      <Cell key={i}
                        fill={filters.aging === d.name ? '#8b5cf6' : '#6366f1'}
                        opacity={filters.aging && filters.aging !== d.name ? 0.3 : 1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Section>
            {tempsParGarage.length > 0 ? (
              <Section title="Temps moyen par garage (historique)" icon="⏳">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={tempsParGarage} margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="station" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
                      label={{ value: 'Minutes', angle: -90, position: 'insideLeft', fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="Temps moyen (min)" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 4 }}>
                  {tempsParGarage.map(d => (
                    <div key={d.stationId} style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                      <span style={{ color: d.color, fontWeight: 700 }}>{d.station}</span>
                      {' · '}moy: {formatDuree(d['Temps moyen (min)'])} · {d.Passages} passages
                      {d.totalMinutes > 0 && <> · total: {formatJours(d.totalMinutes)}</>}
                    </div>
                  ))}
                </div>
              </Section>
            ) : (
              <Section title="Temps moyen par garage" icon="⏳">
                <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
                  Aucun historique disponible
                </div>
              </Section>
            )}
          </div>

          {/* RÉSERVOIRS DÉTAIL (eau seulement) */}
          {vueActive === 'eau' && (
            <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 18, marginBottom: 18 }}>
              <Section title="Réservoirs — Détail" icon="🛢">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ background: '#22c55e15', borderRadius: 10, padding: '16px 18px', textAlign: 'center' }}>
                    <div style={{ fontSize: 36, fontWeight: 800, color: '#22c55e', fontFamily: 'monospace' }}>{reservoirStats.disponibles}</div>
                    <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>Disponibles</div>
                  </div>
                  <div style={{ background: '#0ea5e915', borderRadius: 10, padding: '16px 18px', textAlign: 'center' }}>
                    <div style={{ fontSize: 36, fontWeight: 800, color: '#0ea5e9', fontFamily: 'monospace' }}>{reservoirStats.installes}</div>
                    <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>Installés</div>
                  </div>
                </div>
                {reservoirStats.enPeinture > 0 && (
                  <div style={{ background: '#f59e0b15', borderRadius: 10, padding: '14px 18px', textAlign: 'center' }}>
                    <span style={{ fontSize: 28, fontWeight: 800, color: '#f59e0b', fontFamily: 'monospace' }}>{reservoirStats.enPeinture}</span>
                    <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', marginLeft: 10 }}>en peinture</span>
                  </div>
                )}
                <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)' }}>
                  <div style={{ fontWeight: 700, color: 'rgba(255,255,255,0.85)', marginBottom: 10, fontSize: 16 }}>Par type :</div>
                  {Object.entries(reservoirStats.parType).map(([type, counts]) => (
                    <div key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ fontWeight: 700, fontSize: 16 }}>{type}</span>
                      <div style={{ display: 'flex', gap: 16, fontSize: 15, fontFamily: 'monospace' }}>
                        <span style={{ color: '#22c55e' }}>{counts.dispo} dispo</span>
                        <span style={{ color: '#0ea5e9' }}>{counts.installe} inst.</span>
                        {counts.peinture > 0 && <span style={{ color: '#f59e0b' }}>{counts.peinture} peint.</span>}
                        <span style={{ color: 'rgba(255,255,255,0.4)' }}>{counts.total} total</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.85)', marginBottom: 10 }}>Couverture camions :</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, marginBottom: 8 }}>
                    <span style={{ color: 'rgba(255,255,255,0.7)' }}>Avec réservoir</span>
                    <span style={{ color: '#0ea5e9', fontWeight: 700, fontFamily: 'monospace', fontSize: 18 }}>{camionsEau.filter(v => v.aUnReservoir).length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, marginBottom: 8 }}>
                    <span style={{ color: 'rgba(255,255,255,0.7)' }}>Sans réservoir</span>
                    <span style={{ color: ecartReservoir > 0 ? '#f59e0b' : 'rgba(255,255,255,0.5)', fontWeight: 700, fontFamily: 'monospace', fontSize: 18 }}>{camionsSansReservoir.length}</span>
                  </div>
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.85)', marginBottom: 10 }}>Écart par type de réservoir :</div>
                  {ecartParType.map(e => {
                    const hasGap = e.ecart > 0;
                    const surplus = e.disponible - e.besoin;
                    return (
                      <div key={e.type} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '12px 14px', marginBottom: 8, borderRadius: 8,
                        background: hasGap ? '#ef444412' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${hasGap ? '#ef444430' : 'rgba(255,255,255,0.04)'}`,
                      }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.85)', width: 60 }}>{e.type}</span>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                            <div style={{
                              width: `${e.besoin > 0 ? Math.min(100, (e.disponible / e.besoin) * 100) : 100}%`,
                              height: '100%', borderRadius: 4, background: hasGap ? '#ef4444' : '#22c55e',
                            }} />
                          </div>
                        </div>
                        <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', minWidth: 80, textAlign: 'right' }}>{e.besoin}req / {e.disponible}dsp</span>
                        <span style={{
                          fontSize: 16, fontWeight: 800, fontFamily: 'monospace', minWidth: 40, textAlign: 'right',
                          color: hasGap ? '#ef4444' : surplus > 0 ? '#22c55e' : 'rgba(255,255,255,0.3)',
                        }}>
                          {hasGap ? `-${e.ecart}` : surplus > 0 ? `+${surplus}` : 'OK'}
                        </span>
                      </div>
                    );
                  })}
                  {camionsSansTypeSpecifie.length > 0 && (
                    <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 6, background: '#f59e0b10', border: '1px solid #f59e0b25', fontSize: 13, color: '#f59e0b' }}>
                      ⚠ {camionsSansTypeSpecifie.length} camion{camionsSansTypeSpecifie.length > 1 ? 's' : ''} sans type de réservoir spécifié
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>Ajouter le type dans le Road Map du camion</div>
                    </div>
                  )}
                </div>
              </Section>
              <Section title="Inventaire réservoirs" icon="📋">
                <MiniTable columns={['Numéro', 'Type', 'État', 'Camion']} rows={reservoirRows} large />
              </Section>
            </div>
          )}

          {/* SOUS-FILTRE VENDUS */}
          {filters.commercial === 'vendu' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              padding: '12px 16px', marginBottom: 16, borderRadius: 10,
              background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)',
            }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>
                💰 Vendus ({vendusStats.total}) :
              </span>
              <button onClick={() => toggleFilter('vendusPret', 'pret')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', transition: 'all 0.15s',
                  background: filters.vendusPret === 'pret' ? '#22c55e' : 'rgba(255,255,255,0.06)',
                  color: filters.vendusPret === 'pret' ? '#fff' : 'rgba(255,255,255,0.75)',
                  border: `1px solid ${filters.vendusPret === 'pret' ? '#22c55e' : 'rgba(255,255,255,0.15)'}`,
                }}
              >
                ✅ Prêts ({vendusStats.prets})
              </button>
              <button onClick={() => toggleFilter('vendusPret', 'pas-pret')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', transition: 'all 0.15s',
                  background: filters.vendusPret === 'pas-pret' ? '#ef4444' : 'rgba(255,255,255,0.06)',
                  color: filters.vendusPret === 'pas-pret' ? '#fff' : 'rgba(255,255,255,0.75)',
                  border: `1px solid ${filters.vendusPret === 'pas-pret' ? '#ef4444' : 'rgba(255,255,255,0.15)'}`,
                }}
              >
                ⏳ Pas prêts ({vendusStats.pasPrets})
              </button>
              {filters.vendusPret && (
                <button onClick={() => toggleFilter('vendusPret', filters.vendusPret)}
                  style={{
                    marginLeft: 'auto', padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', background: 'transparent', color: 'rgba(255,255,255,0.5)',
                    border: '1px solid rgba(255,255,255,0.15)',
                  }}
                >
                  ✕ Retirer sous-filtre
                </button>
              )}
            </div>
          )}

          {/* FILTRE NUMÉRO (général seulement) */}
          {vueActive === 'general' && (
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="text"
                placeholder="Filtrer par numéro..."
                value={filtreNumero}
                onChange={e => setFiltreNumero(e.target.value)}
                style={{
                  padding: '8px 14px', borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'white', fontSize: 14, outline: 'none', width: 200,
                }}
              />
              {filtreNumero && (
                <button onClick={() => setFiltreNumero('')}
                  style={{
                    padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                    color: 'rgba(255,255,255,0.6)',
                  }}
                >
                  ✕ Effacer
                </button>
              )}
            </div>
          )}

          {/* TABLEAU DÉTAILLÉ */}
          <Section
            title={`Détail camions ${vueActive === 'general' ? '(eau + détail)' : vueActive === 'eau' ? 'à eau' : 'détail'} (${camionsRows.length}${hasFilters || filtreNumero ? ` / ${camionsBase.length}` : ''})`}
            icon="🚛"
            badge={<span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>🚨 = vendu pas prêt</span>}
          >
            <MiniTable
              columns={vueActive === 'eau' ? tableColumnsEau : vueActive === 'general' ? tableColumnsGeneral : tableColumnsDetail}
              rows={camionsRows}
              large
            />
          </Section>
        </>
      )}

      {/* ══════════════════════════════════════════════════════
          VUE RÉSERVOIRS
      ══════════════════════════════════════════════════════ */}
      {vueActive === 'reservoirs' && (
        <>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'white', fontFamily: 'system-ui, sans-serif', letterSpacing: '-0.02em', marginBottom: 20 }}>
            🛢 Analyse — Réservoirs
          </div>

          {/* KPI réservoirs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
            <KpiCard icon="✅" label="DISPONIBLES" value={reservoirStats.disponibles} sub="Prêts à installer" color="#22c55e" />
            <KpiCard icon="🔧" label="INSTALLÉS" value={reservoirStats.installes} sub="Sur camion" color="#0ea5e9" />
            {reservoirStats.enPeinture > 0 && (
              <KpiCard icon="🎨" label="EN PEINTURE" value={reservoirStats.enPeinture} sub="En cours" color="#f59e0b" />
            )}
            <KpiCard icon="📦" label="TOTAL STOCK" value={reservoirStats.total} sub="Tous états" color="#64748b" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 18, marginBottom: 18 }}>
            <Section title="Réservoirs — Statistiques" icon="🛢">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ background: '#22c55e15', borderRadius: 10, padding: '16px 18px', textAlign: 'center' }}>
                  <div style={{ fontSize: 36, fontWeight: 800, color: '#22c55e', fontFamily: 'monospace' }}>{reservoirStats.disponibles}</div>
                  <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>Disponibles</div>
                </div>
                <div style={{ background: '#0ea5e915', borderRadius: 10, padding: '16px 18px', textAlign: 'center' }}>
                  <div style={{ fontSize: 36, fontWeight: 800, color: '#0ea5e9', fontFamily: 'monospace' }}>{reservoirStats.installes}</div>
                  <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>Installés</div>
                </div>
              </div>
              {reservoirStats.enPeinture > 0 && (
                <div style={{ background: '#f59e0b15', borderRadius: 10, padding: '14px 18px', textAlign: 'center' }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: '#f59e0b', fontFamily: 'monospace' }}>{reservoirStats.enPeinture}</span>
                  <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', marginLeft: 10 }}>en peinture</span>
                </div>
              )}
              <div>
                <div style={{ fontWeight: 700, color: 'rgba(255,255,255,0.85)', marginBottom: 10, fontSize: 16 }}>Par type :</div>
                {Object.entries(reservoirStats.parType).map(([type, counts]) => (
                  <div key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontWeight: 700, fontSize: 16 }}>{type}</span>
                    <div style={{ display: 'flex', gap: 16, fontSize: 15, fontFamily: 'monospace' }}>
                      <span style={{ color: '#22c55e' }}>{counts.dispo} dispo</span>
                      <span style={{ color: '#0ea5e9' }}>{counts.installe} inst.</span>
                      {counts.peinture > 0 && <span style={{ color: '#f59e0b' }}>{counts.peinture} peint.</span>}
                      <span style={{ color: 'rgba(255,255,255,0.4)' }}>{counts.total} total</span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 14 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.85)', marginBottom: 10 }}>Écart par type :</div>
                {ecartParType.map(e => {
                  const hasGap = e.ecart > 0;
                  const surplus = e.disponible - e.besoin;
                  return (
                    <div key={e.type} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '12px 14px', marginBottom: 8, borderRadius: 8,
                      background: hasGap ? '#ef444412' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${hasGap ? '#ef444430' : 'rgba(255,255,255,0.04)'}`,
                    }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.85)', width: 60 }}>{e.type}</span>
                      <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <div style={{
                          width: `${e.besoin > 0 ? Math.min(100, (e.disponible / e.besoin) * 100) : 100}%`,
                          height: '100%', borderRadius: 4, background: hasGap ? '#ef4444' : '#22c55e',
                        }} />
                      </div>
                      <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', minWidth: 80, textAlign: 'right' }}>{e.besoin}req / {e.disponible}dsp</span>
                      <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'monospace', minWidth: 40, textAlign: 'right', color: hasGap ? '#ef4444' : surplus > 0 ? '#22c55e' : 'rgba(255,255,255,0.3)' }}>
                        {hasGap ? `-${e.ecart}` : surplus > 0 ? `+${surplus}` : 'OK'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Section>
            <Section title="Inventaire réservoirs" icon="📋">
              <MiniTable columns={['Numéro', 'Type', 'État', 'Camion']} rows={reservoirRows} large />
            </Section>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════
          VUE LIVRAISONS
      ══════════════════════════════════════════════════════ */}
      {vueActive === 'livraisons' && (
        <>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'white', fontFamily: 'system-ui, sans-serif', letterSpacing: '-0.02em', marginBottom: 20 }}>
            📦 Analyse — Livraisons
          </div>

          {/* Sélecteur de période */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {([
              { id: 'semaine' as const, label: 'Semaine en cours', sub: 'par jour' },
              { id: 'mois' as const, label: '1 mois', sub: 'par semaine' },
              { id: '3mois' as const, label: '3 mois', sub: 'par mois' },
            ]).map(p => (
              <button key={p.id} onClick={() => setPeriodeActive(p.id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '10px 20px', borderRadius: 10, cursor: 'pointer',
                  fontWeight: 700, transition: 'all 0.15s',
                  background: periodeActive === p.id ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                  border: periodeActive === p.id ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(255,255,255,0.08)',
                  color: periodeActive === p.id ? 'white' : 'rgba(255,255,255,0.5)',
                }}
              >
                <span style={{ fontSize: 14 }}>{p.label}</span>
                <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.6, marginTop: 2 }}>{p.sub}</span>
              </button>
            ))}
          </div>

          {/* Résumé */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
            {[
              { label: 'Total livré', value: livraisonsData.itemsInPeriod.length, color: '#ffffff' },
              { label: "Camions eau", value: livraisonsData.itemsInPeriod.filter(i => i.type === 'eau').length, color: '#f97316' },
              { label: 'Camions détail', value: livraisonsData.itemsInPeriod.filter(i => i.type === 'detail').length, color: '#22c55e' },
              { label: 'Clients', value: livraisonsData.itemsInPeriod.filter(i => i.type === 'client').length, color: '#3b82f6' },
            ].map(k => (
              <div key={k.label} style={{
                background: `${k.color}12`, border: `1px solid ${k.color}30`,
                borderRadius: 10, padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: k.color, fontFamily: 'monospace' }}>{k.value}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Graphique */}
          <div style={{ marginBottom: 18 }}>
            <Section title={`Livraisons — ${periodeActive === 'semaine' ? 'Semaine en cours' : periodeActive === 'mois' ? 'Dernier mois' : '3 derniers mois'}`} icon="📊">
              {livraisonsData.itemsInPeriod.length === 0 ? (
                <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
                  Aucune livraison sur cette période
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={livraisonsData.chartData} margin={{ left: 0, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 13 }} />
                    <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }} />
                    <Bar dataKey="eau" name="Camion eau" fill="#f97316" stackId="a" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="detail" name="Camion détail" fill="#22c55e" stackId="a" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="client" name="Client" fill="#3b82f6" stackId="a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Section>
          </div>

          {/* Liste des livraisons clients */}
          {livraisonsData.clientsLivres.length > 0 && (
            <Section title={`Livraisons clients (${livraisonsData.clientsLivres.length})`} icon="🚗">
              <MiniTable
                columns={['#', 'Libellé', 'Client', 'Type', 'Date livraison']}
                rows={livraisonsData.clientsLivres.map(i => ({
                  id: i.id,
                  cells: [
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#f97316' }}>#{i.numero}</span>,
                    i.label || '—',
                    i.nomClient || i.clientAcheteur || '—',
                    <TypeBadge type={i.type} />,
                    i.dateArchive ? formatDateArchive(i.dateArchive) : '—',
                  ],
                }))}
                large
              />
            </Section>
          )}
        </>
      )}

      {/* Spacer bottom */}
      <div style={{ height: 40 }} />
    </div>
  );
}
