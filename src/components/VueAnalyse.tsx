import { useState, useEffect, useMemo, useCallback } from 'react';
import { useInventaire } from '../contexts/InventaireContext';
import { supabase } from '../lib/supabase';
import { ROAD_MAP_STATIONS } from '../data/etapes';
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

// ── Filtres interactifs ──────────────────────────────────────
interface Filters {
  commercial?: 'vendu' | 'reserve' | 'location' | 'non-vendu';
  phase?: 'pret' | 'en-production' | 'disponible';
  variante?: 'Neuf' | 'Usagé';
  station?: string;
  reservoir?: 'avec' | 'sans';
  aging?: string;         // bin label
  alerte?: 'vendu-pas-pret' | 'ecart-reservoir';
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

// ── Badge commercial réutilisable ──────────────────────────────
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

// ══════════════════════════════════════════════════════════════
// ── COMPOSANT PRINCIPAL ──────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export function VueAnalyse() {
  const { vehicules } = useInventaire();

  const [reservoirs, setReservoirs] = useState<Reservoir[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [loadingExtra, setLoadingExtra] = useState(true);
  const [filters, setFilters] = useState<Filters>({});

  // Charger réservoirs + time logs
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

  // ── Toggle un filtre (cliquer 2x = retirer) ───────────────
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

  // ── Camions à eau (non archivés) ──────────────────────────
  const camionsEau = useMemo(() =>
    vehicules.filter(v => v.type === 'eau' && v.statut !== 'archive'),
    [vehicules]
  );

  // ── Appliquer les filtres ─────────────────────────────────
  const camionsFiltres = useMemo(() => {
    let result = camionsEau;
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
    return result;
  }, [camionsEau, filters]);

  // ── Catégories principales ────────────────────────────────
  const prets = useMemo(() => camionsFiltres.filter(v => v.estPret), [camionsFiltres]);
  const enProduction = useMemo(() => camionsFiltres.filter(v => v.statut === 'en-production'), [camionsFiltres]);
  const disponibles = useMemo(() => camionsFiltres.filter(v => v.statut === 'disponible' && !v.estPret), [camionsFiltres]);

  // ── ALERTES (calculées sur données NON filtrées) ──────────
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

  // ── Écart par TYPE de réservoir ───────────────────────────
  const TYPES_RES = ['2500g', '3750g', '4000g', '5000g'] as const;
  const ecartParType = useMemo(() => {
    // Camions sans réservoir avec un type requis spécifié
    const besoinsParType: Record<string, { count: number; camions: VehiculeInventaire[] }> = {};
    const sansTypeSpecifie: VehiculeInventaire[] = [];
    TYPES_RES.forEach(t => { besoinsParType[t] = { count: 0, camions: [] }; });

    camionsSansReservoir.forEach(v => {
      if (v.typeReservoirRequis && besoinsParType[v.typeReservoirRequis]) {
        besoinsParType[v.typeReservoirRequis].count++;
        besoinsParType[v.typeReservoirRequis].camions.push(v);
      } else {
        sansTypeSpecifie.push(v);
      }
    });

    // Réservoirs disponibles par type
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

  // PIE : Phase (prêt / en-production / disponible)
  const phaseData = useMemo(() => [
    { name: 'Prêts', value: prets.length, key: 'pret' as const, color: COLORS.pret },
    { name: 'En production', value: enProduction.length, key: 'en-production' as const, color: COLORS['en-production'] },
    { name: 'Disponibles', value: disponibles.length, key: 'disponible' as const, color: COLORS.disponible },
  ].filter(d => d.value > 0), [prets, enProduction, disponibles]);

  // PIE : Commercial
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

  // PIE : Variante
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

  // PIE : Réservoirs
  const reservoirPieData = useMemo(() => {
    const avec = camionsFiltres.filter(v => v.aUnReservoir).length;
    const sans = camionsFiltres.filter(v => !v.aUnReservoir).length;
    return [
      { name: 'Avec réservoir', value: avec, key: 'avec' as const, color: COLORS.avec },
      { name: 'Sans réservoir', value: sans, key: 'sans' as const, color: COLORS.sans },
    ].filter(d => d.value > 0);
  }, [camionsFiltres]);

  // BAR : Charge par station (toutes les étapes road_map non-sautées)
  const stationLoad = useMemo(() => {
    return ROAD_MAP_STATIONS.map(station => {
      let enCours = 0;
      let enAttente = 0;
      let planifie = 0;
      let termine = 0;
      camionsFiltres.forEach(v => {
        const step = v.roadMap?.find((s: RoadMapEtape) => s.stationId === station.id);
        if (!step || step.statut === 'saute') return;
        if (step.statut === 'en-cours') enCours++;
        else if (step.statut === 'en-attente') enAttente++;
        else if (step.statut === 'planifie') planifie++;
        else if (step.statut === 'termine') termine++;
      });
      return {
        station: station.label,
        stationId: station.id,
        'En cours': enCours,
        'En attente': enAttente,
        'Planifié': planifie,
        'Terminé': termine,
        total: enCours + enAttente + planifie + termine,
      };
    });
  }, [camionsFiltres]);

  // BAR : Aging
  const agingData = useMemo(() => {
    const bins: Record<string, number> = {};
    AGING_BINS.forEach(b => { bins[b] = 0; });
    const productionCamions = camionsFiltres.filter(v => v.statut === 'en-production');
    productionCamions.forEach(v => { bins[getAgingBin(v)]++; });
    return AGING_BINS.map(b => ({ name: b, Camions: bins[b] }));
  }, [camionsFiltres]);

  // BAR : Temps moyen par garage
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

  // ── Réservoirs stats ──────────────────────────────────────
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

  // ── Tableaux ──────────────────────────────────────────────

  const camionsRows = useMemo(() =>
    camionsFiltres
      .sort((a, b) => {
        // Vendus non prêts en premier
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
        return {
          id: v.id,
          cells: [
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {isVenduNonPret && <span title="Vendu mais pas prêt!" style={{ fontSize: 14 }}>🚨</span>}
              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#f97316' }}>#{v.numero}</span>
            </div>,
            `${v.marque ?? ''} ${v.modele ?? ''}`.trim() || '—',
            v.variante ?? '—',
            <span style={{
              padding: '3px 10px', borderRadius: 4, fontSize: 12, fontWeight: 700,
              background: phase === 'pret' ? '#22c55e20' : phase === 'en-production' ? '#3b82f620' : '#94a3b820',
              color: phase === 'pret' ? '#22c55e' : phase === 'en-production' ? '#3b82f6' : '#94a3b8',
            }}>
              {phase === 'pret' ? '✅ Prêt' : phase === 'en-production' ? '🔧 Production' : '📋 Dispo.'}
            </span>,
            phase === 'en-production'
              ? <span style={{ color: '#3b82f6', fontWeight: 600, fontSize: 13 }}>{stationLabel}</span>
              : <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>,
            phase === 'en-production' ? <ProgressBar value={progression} /> : <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>,
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
      }),
    [camionsFiltres]
  );

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
          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0ea5e9' }}>{r.numero}</span>,
          <span style={{ fontWeight: 600 }}>{r.type}</span>,
          <span style={{ color: ec.color, fontWeight: 700, fontSize: 11 }}>{ec.label}</span>,
          camion
            ? <span style={{ fontFamily: 'monospace', color: '#f97316' }}>#{camion.numero}</span>
            : <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>,
        ],
      };
    }),
    [reservoirs, camionsEau]
  );

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

  return (
    <div style={{
      width: '100%', height: '100%',
      overflowY: 'auto', overflowX: 'hidden',
      padding: 24, boxSizing: 'border-box',
    }}>
      {/* ── TITRE + FILTRES ACTIFS ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
          <div style={{
            fontSize: 24, fontWeight: 800, color: 'white',
            fontFamily: 'system-ui, sans-serif', letterSpacing: '-0.02em',
          }}>
            📊 Analyse — Camions à eau
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
            {camionsFiltres.length}/{camionsEau.length} camions
            {hasFilters ? ' (filtré)' : ''}
          </div>
        </div>

        {/* Barre de filtres actifs */}
        {hasFilters && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
            padding: '10px 14px', borderRadius: 10,
            background: 'rgba(139, 92, 246, 0.08)',
            border: '1px solid rgba(139, 92, 246, 0.2)',
          }}>
            <span style={{ fontSize: 11, color: '#8b5cf6', fontWeight: 700, marginRight: 4 }}>
              FILTRES ACTIFS :
            </span>
            {Object.entries(filters).map(([key, value]) => (
              <button
                key={key}
                onClick={() => toggleFilter(key as keyof Filters, value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px', borderRadius: 6,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'rgba(255,255,255,0.8)', cursor: 'pointer',
                  fontSize: 11, fontWeight: 600,
                }}
              >
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>{FILTER_LABELS[key] ?? key}:</span>
                <span>{String(value)}</span>
                <span style={{ color: '#ef4444', fontWeight: 700 }}>✕</span>
              </button>
            ))}
            <button
              onClick={clearFilters}
              style={{
                padding: '4px 12px', borderRadius: 6,
                background: '#ef444420', border: '1px solid #ef444440',
                color: '#ef4444', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                marginLeft: 'auto',
              }}
            >
              Tout effacer
            </button>
          </div>
        )}
      </div>

      {/* ── ALERTES ── */}
      {(vendusNonPrets.length > 0 || ecartReservoir > 0) && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: vendusNonPrets.length > 0 && ecartReservoir > 0 ? '1fr 1fr' : '1fr',
          gap: 14, marginBottom: 20,
        }}>
          {vendusNonPrets.length > 0 && (
            <div
              onClick={() => toggleFilter('alerte', 'vendu-pas-pret')}
              style={{
                background: filters.alerte === 'vendu-pas-pret' ? '#ef444425' : '#ef444415',
                border: filters.alerte === 'vendu-pas-pret' ? '2px solid #ef4444' : '1px solid #ef444440',
                borderRadius: 12, padding: '16px 20px',
                cursor: 'pointer', transition: 'all 0.2s',
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
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
                  Cliquer pour filtrer
                </div>
              </div>
            </div>
          )}

          {(ecartReservoir > 0 || hasEcartParType) && (
            <div
              onClick={() => toggleFilter('alerte', 'ecart-reservoir')}
              style={{
                background: filters.alerte === 'ecart-reservoir' ? '#f59e0b25' : '#f59e0b15',
                border: filters.alerte === 'ecart-reservoir' ? '2px solid #f59e0b' : '1px solid #f59e0b40',
                borderRadius: 12, padding: '16px 20px',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ fontSize: 36 }}>⚠️</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#f59e0b', marginBottom: 2 }}>
                    Écart réservoirs
                  </div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                    {camionsSansReservoir.length} camions sans réservoir · {reservoirsDisponibles.length} dispo en stock
                  </div>
                </div>
              </div>
              {/* Détail par type */}
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
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
                        {e.type}
                      </div>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>
                        Besoin: <span style={{ color: 'white', fontWeight: 700, fontFamily: 'monospace' }}>{e.besoin}</span>
                      </div>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
                        Dispo: <span style={{ color: '#22c55e', fontWeight: 700, fontFamily: 'monospace' }}>{e.disponible}</span>
                      </div>
                      {hasGap ? (
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#ef4444' }}>
                          -{e.ecart}
                        </div>
                      ) : e.disponible > e.besoin ? (
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#22c55e' }}>
                          +{e.disponible - e.besoin}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.2)' }}>
                          OK
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {camionsSansTypeSpecifie.length > 0 && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#f59e0b', fontStyle: 'italic' }}>
                  ⚠ {camionsSansTypeSpecifie.length} camion{camionsSansTypeSpecifie.length > 1 ? 's' : ''} sans type de réservoir spécifié dans le road map
                </div>
              )}
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 6 }}>
                Cliquer pour filtrer les camions sans réservoir
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── KPI ROW ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 14, marginBottom: 20,
      }}>
        <KpiCard icon="✅" label="PRÊTS" value={prets.length}
          sub={`${prets.filter(v => getCommercial(v) === 'vendu').length} vendus · ${prets.filter(v => getCommercial(v) !== 'vendu').length} non vendus`}
          color={COLORS.pret}
          active={filters.phase === 'pret'}
          onClick={() => toggleFilter('phase', 'pret')} />
        <KpiCard icon="🔧" label="EN PRODUCTION" value={enProduction.length}
          sub={`${enProduction.filter(v => getCommercial(v) === 'vendu').length} vendus · ${enProduction.filter(v => getCommercial(v) !== 'vendu').length} non vendus`}
          color={COLORS['en-production']}
          active={filters.phase === 'en-production'}
          onClick={() => toggleFilter('phase', 'en-production')} />
        <KpiCard icon="📋" label="DISPONIBLES" value={disponibles.length}
          sub="À planifier"
          color={COLORS.disponible}
          active={filters.phase === 'disponible'}
          onClick={() => toggleFilter('phase', 'disponible')} />
        <KpiCard icon="🛢" label="RÉSERVOIRS DISPO." value={reservoirsDisponibles.length}
          sub={`${reservoirStats.total} total · ${reservoirStats.installes} installés · ${reservoirStats.enPeinture} peinture`}
          color={COLORS.avec} />
        <KpiCard icon="💰" label="VENDUS" value={camionsFiltres.filter(v => getCommercial(v) === 'vendu').length}
          sub={`${camionsFiltres.filter(v => getCommercial(v) === 'reserve').length} rés. · ${camionsFiltres.filter(v => getCommercial(v) === 'location').length} loc.`}
          color={COLORS.vendu}
          active={filters.commercial === 'vendu'}
          onClick={() => toggleFilter('commercial', 'vendu')} />
      </div>

      {/* ── GRAPHIQUES ROW 1 : 4 PIEs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 18 }}>
        <Section title="Par phase" icon="📦"
          badge={filters.phase ? <span style={{ fontSize: 10, background: '#8b5cf620', color: '#8b5cf6', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>FILTRE</span> : undefined}
        >
          {renderClickablePie(phaseData, 'phase', 200)}
        </Section>

        <Section title="Statut commercial" icon="💰"
          badge={filters.commercial ? <span style={{ fontSize: 10, background: '#8b5cf620', color: '#8b5cf6', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>FILTRE</span> : undefined}
        >
          {renderClickablePie(commercialData, 'commercial', 200)}
        </Section>

        <Section title="Neuf / Usagé" icon="🏷️"
          badge={filters.variante ? <span style={{ fontSize: 10, background: '#8b5cf620', color: '#8b5cf6', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>FILTRE</span> : undefined}
        >
          {renderClickablePie(varianteData, 'variante', 200)}
        </Section>

        <Section title="Réservoirs" icon="🛢"
          badge={filters.reservoir ? <span style={{ fontSize: 10, background: '#8b5cf620', color: '#8b5cf6', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>FILTRE</span> : undefined}
        >
          {renderClickablePie(reservoirPieData, 'reservoir', 200)}
        </Section>
      </div>

      {/* ── CHARGE PAR STATION (pleine largeur) ── */}
      <div style={{ marginBottom: 18 }}>
        <Section title="Charge par station (toutes étapes road map)" icon="📊"
          badge={filters.station ? <span style={{ fontSize: 12, background: '#8b5cf620', color: '#8b5cf6', padding: '3px 8px', borderRadius: 4, fontWeight: 700 }}>FILTRE: {filters.station}</span> : undefined}
        >
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
              <YAxis type="category" dataKey="station" width={170}
                tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 600 }} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }} />
              <Bar dataKey="En cours" stackId="a" fill="#3b82f6" />
              <Bar dataKey="En attente" stackId="a" fill="#f59e0b" />
              <Bar dataKey="Planifié" stackId="a" fill="#8b5cf6" />
              <Bar dataKey="Terminé" stackId="a" fill="#22c55e" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Section>
      </div>

      {/* ── GRAPHIQUES ROW 2 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>

        {/* BAR : Aging */}
        <Section title="Ancienneté en production" icon="⏱️"
          badge={filters.aging ? <span style={{ fontSize: 10, background: '#8b5cf620', color: '#8b5cf6', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>FILTRE: {filters.aging}</span> : undefined}
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={agingData} margin={{ left: 0, right: 20 }}
              onClick={(state: any) => {
                if (state?.activeLabel) toggleFilter('aging', state.activeLabel);
              }}
              style={{ cursor: 'pointer' }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="Camions" radius={[4, 4, 0, 0]}>
                {agingData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={filters.aging === d.name ? '#8b5cf6' : '#6366f1'}
                    opacity={filters.aging && filters.aging !== d.name ? 0.3 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Section>
      </div>

      {/* ── TEMPS MOYEN PAR GARAGE ── */}
      {tempsParGarage.length > 0 && (
        <div style={{ marginBottom: 18 }}>
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
        </div>
      )}

      {/* ── RÉSERVOIRS DÉTAIL ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: 18, marginBottom: 18 }}>
        <Section title="Réservoirs — Détail" icon="🛢">
          {/* Compteurs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: '#22c55e15', borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#22c55e', fontFamily: 'monospace' }}>
                {reservoirStats.disponibles}
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Disponibles</div>
            </div>
            <div style={{ background: '#0ea5e915', borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#0ea5e9', fontFamily: 'monospace' }}>
                {reservoirStats.installes}
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Installés</div>
            </div>
          </div>
          {reservoirStats.enPeinture > 0 && (
            <div style={{ background: '#f59e0b15', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#f59e0b', fontFamily: 'monospace' }}>
                {reservoirStats.enPeinture}
              </span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginLeft: 8 }}>en peinture</span>
            </div>
          )}

          {/* Par type */}
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>
            <div style={{ fontWeight: 700, color: 'rgba(255,255,255,0.8)', marginBottom: 8, fontSize: 14 }}>Par type :</div>
            {Object.entries(reservoirStats.parType).map(([type, counts]) => (
              <div key={type} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{type}</span>
                <div style={{ display: 'flex', gap: 14, fontSize: 13, fontFamily: 'monospace' }}>
                  <span style={{ color: '#22c55e' }}>{counts.dispo} dispo</span>
                  <span style={{ color: '#0ea5e9' }}>{counts.installe} inst.</span>
                  {counts.peinture > 0 && <span style={{ color: '#f59e0b' }}>{counts.peinture} peint.</span>}
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>{counts.total} total</span>
                </div>
              </div>
            ))}
          </div>

          {/* Couverture globale */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.8)', marginBottom: 8 }}>
              Couverture camions :
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>Avec réservoir</span>
              <span style={{ color: '#0ea5e9', fontWeight: 700, fontFamily: 'monospace' }}>
                {camionsEau.filter(v => v.aUnReservoir).length}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>Sans réservoir</span>
              <span style={{ color: ecartReservoir > 0 ? '#f59e0b' : 'rgba(255,255,255,0.5)', fontWeight: 700, fontFamily: 'monospace' }}>
                {camionsSansReservoir.length}
              </span>
            </div>
          </div>

          {/* Écart PAR TYPE */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.8)', marginBottom: 8 }}>
              Écart par type de réservoir :
            </div>
            {ecartParType.map(e => {
              const hasGap = e.ecart > 0;
              const surplus = e.disponible - e.besoin;
              return (
                <div key={e.type} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', marginBottom: 6, borderRadius: 8,
                  background: hasGap ? '#ef444412' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${hasGap ? '#ef444430' : 'rgba(255,255,255,0.04)'}`,
                }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.8)', width: 55 }}>
                    {e.type}
                  </span>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{
                        width: `${e.besoin > 0 ? Math.min(100, (e.disponible / e.besoin) * 100) : 100}%`,
                        height: '100%', borderRadius: 4,
                        background: hasGap ? '#ef4444' : '#22c55e',
                      }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', minWidth: 70, textAlign: 'right' }}>
                    {e.besoin}req / {e.disponible}dsp
                  </span>
                  <span style={{
                    fontSize: 14, fontWeight: 800, fontFamily: 'monospace', minWidth: 35, textAlign: 'right',
                    color: hasGap ? '#ef4444' : surplus > 0 ? '#22c55e' : 'rgba(255,255,255,0.3)',
                  }}>
                    {hasGap ? `-${e.ecart}` : surplus > 0 ? `+${surplus}` : 'OK'}
                  </span>
                </div>
              );
            })}
            {camionsSansTypeSpecifie.length > 0 && (
              <div style={{
                marginTop: 8, padding: '8px 12px', borderRadius: 6,
                background: '#f59e0b10', border: '1px solid #f59e0b25',
                fontSize: 13, color: '#f59e0b',
              }}>
                ⚠ {camionsSansTypeSpecifie.length} camion{camionsSansTypeSpecifie.length > 1 ? 's' : ''} sans type de réservoir spécifié
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 3 }}>
                  Ajouter le type dans le Road Map du camion
                </div>
              </div>
            )}
          </div>
        </Section>

        <Section title="Inventaire réservoirs" icon="📋">
          <MiniTable
            columns={['Numéro', 'Type', 'État', 'Camion']}
            rows={reservoirRows}
            large
          />
        </Section>
      </div>

      {/* ── TABLEAU DÉTAILLÉ CAMIONS ── */}
      <Section title={`Détail camions à eau (${camionsFiltres.length}${hasFilters ? ` / ${camionsEau.length}` : ''})`} icon="🚛"
        badge={
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
            🚨 = vendu pas prêt
          </span>
        }
      >
        <MiniTable
          columns={['#', 'Véhicule', 'Var.', 'Phase', 'Station', 'Progression', 'Rés.', 'Rés. requis', 'Commercial', 'Client', 'Livraison']}
          rows={camionsRows}
          large
        />
      </Section>

      {/* Spacer bottom */}
      <div style={{ height: 40 }} />
    </div>
  );
}
