import { useState, useEffect, useMemo } from 'react';
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

// ── Couleurs ───────────────────────────────────────────────────
const COLORS = {
  vendu: '#22c55e',
  reserve: '#f59e0b',
  location: '#8b5cf6',
  nonVendu: '#64748b',
  pret: '#22c55e',
  enProduction: '#3b82f6',
  disponible: '#94a3b8',
  avecReservoir: '#0ea5e9',
  sansReservoir: '#334155',
  neuf: '#6366f1',
  usage: '#f97316',
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
  const jours = minutes / (60 * 8); // 8h workday
  if (jours < 1) return formatDuree(minutes);
  return `${jours.toFixed(1)}j`;
}

// Custom tooltip for charts
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1e293b', border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: 8, padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    }}>
      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginBottom: 6 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'white' }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: p.color }} />
          <span style={{ color: 'rgba(255,255,255,0.7)' }}>{p.name}:</span>
          <span style={{ fontWeight: 700 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// Pie label
function renderPieLabel({ name, value, percent }: any) {
  if (percent < 0.05) return null;
  return `${name} (${value})`;
}

// ── KPI Card ──────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, icon }: {
  label: string; value: string | number; sub?: string; color: string; icon: string;
}) {
  return (
    <div style={{
      background: `${color}12`, border: `1px solid ${color}30`,
      borderRadius: 12, padding: '18px 20px',
      display: 'flex', flexDirection: 'column', gap: 6,
      minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 600, letterSpacing: '0.04em' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color, fontFamily: 'monospace', lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{sub}</div>
      )}
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────
function Section({ title, icon, children, span }: {
  title: string; icon: string; children: React.ReactNode; span?: number;
}) {
  return (
    <div style={{
      background: '#161514', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 14, padding: 24, gridColumn: span ? `span ${span}` : undefined,
      display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      <div style={{
        fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.85)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

// ── Truck list mini table ─────────────────────────────────────
function MiniTable({ rows, columns }: {
  rows: { id: string; cells: (string | React.ReactNode)[] }[];
  columns: string[];
}) {
  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 320 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i} style={{
                textAlign: 'left', padding: '6px 10px',
                color: 'rgba(255,255,255,0.4)', fontWeight: 600,
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                position: 'sticky', top: 0, background: '#161514',
                fontSize: 11, letterSpacing: '0.04em',
              }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              {r.cells.map((cell, i) => (
                <td key={i} style={{
                  padding: '7px 10px', color: 'rgba(255,255,255,0.75)',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
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

// ══════════════════════════════════════════════════════════════
// ── COMPOSANT PRINCIPAL ──────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export function VueAnalyse() {
  const { vehicules } = useInventaire();

  const [reservoirs, setReservoirs] = useState<Reservoir[]>([]);
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [loadingExtra, setLoadingExtra] = useState(true);

  // Charger réservoirs + time logs depuis Supabase
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

  // ── Filtrer camions à eau ─────────────────────────────────
  const camionsEau = useMemo(() =>
    vehicules.filter(v => v.type === 'eau' && v.statut !== 'archive'),
    [vehicules]
  );

  // ── Catégories principales ────────────────────────────────
  const prets = useMemo(() => camionsEau.filter(v => v.estPret), [camionsEau]);
  const enProduction = useMemo(() => camionsEau.filter(v => v.statut === 'en-production'), [camionsEau]);
  const disponibles = useMemo(() => camionsEau.filter(v => v.statut === 'disponible' && !v.estPret), [camionsEau]);

  // ── Statut commercial ─────────────────────────────────────
  const commercialCount = useMemo(() => {
    const count = { vendu: 0, reserve: 0, location: 0, nonVendu: 0 };
    camionsEau.forEach(v => {
      const ec = v.etatCommercial ?? 'non-vendu';
      if (ec === 'vendu') count.vendu++;
      else if (ec === 'reserve') count.reserve++;
      else if (ec === 'location') count.location++;
      else count.nonVendu++;
    });
    return count;
  }, [camionsEau]);

  // ── Données PIE : Prêts vendu vs non-vendu ────────────────
  const pretsCommercial = useMemo(() => {
    const vendus = prets.filter(v => v.etatCommercial === 'vendu').length;
    const reserves = prets.filter(v => v.etatCommercial === 'reserve').length;
    const locations = prets.filter(v => v.etatCommercial === 'location').length;
    const nonVendus = prets.length - vendus - reserves - locations;
    return [
      { name: 'Vendus', value: vendus, color: COLORS.vendu },
      { name: 'Réservés', value: reserves, color: COLORS.reserve },
      { name: 'Location', value: locations, color: COLORS.location },
      { name: 'Non vendus', value: nonVendus, color: COLORS.nonVendu },
    ].filter(d => d.value > 0);
  }, [prets]);

  // ── Données PIE : En production vendu vs non-vendu ────────
  const prodCommercial = useMemo(() => {
    const vendus = enProduction.filter(v => v.etatCommercial === 'vendu').length;
    const reserves = enProduction.filter(v => v.etatCommercial === 'reserve').length;
    const locations = enProduction.filter(v => v.etatCommercial === 'location').length;
    const nonVendus = enProduction.length - vendus - reserves - locations;
    return [
      { name: 'Vendus', value: vendus, color: COLORS.vendu },
      { name: 'Réservés', value: reserves, color: COLORS.reserve },
      { name: 'Location', value: locations, color: COLORS.location },
      { name: 'Non vendus', value: nonVendus, color: COLORS.nonVendu },
    ].filter(d => d.value > 0);
  }, [enProduction]);

  // ── Réservoirs ────────────────────────────────────────────
  const reservoirStats = useMemo(() => {
    const disponiblesR = reservoirs.filter(r => r.etat === 'disponible');
    const installes = reservoirs.filter(r => r.etat === 'installe');
    const enPeinture = reservoirs.filter(r => r.etat === 'en-peinture');
    const parType: Record<string, number> = {};
    reservoirs.forEach(r => { parType[r.type] = (parType[r.type] || 0) + 1; });
    const camionsAvecReservoir = camionsEau.filter(v => v.aUnReservoir).length;
    const camionsSansReservoir = camionsEau.filter(v => !v.aUnReservoir && v.statut !== 'archive').length;
    return {
      total: reservoirs.length,
      disponibles: disponiblesR.length,
      installes: installes.length,
      enPeinture: enPeinture.length,
      parType,
      camionsAvecReservoir,
      camionsSansReservoir,
    };
  }, [reservoirs, camionsEau]);

  // ── Variante neuf/usagé ───────────────────────────────────
  const varianteData = useMemo(() => {
    const neufs = camionsEau.filter(v => v.variante === 'Neuf').length;
    const usages = camionsEau.filter(v => v.variante === 'Usagé').length;
    const autres = camionsEau.length - neufs - usages;
    return [
      { name: 'Neuf', value: neufs, color: COLORS.neuf },
      { name: 'Usagé', value: usages, color: COLORS.usage },
      ...(autres > 0 ? [{ name: 'Autre', value: autres, color: '#475569' }] : []),
    ].filter(d => d.value > 0);
  }, [camionsEau]);

  // ── Progression par station (combien en-cours/en-attente) ─
  const stationLoad = useMemo(() => {
    return ROAD_MAP_STATIONS.map(station => {
      let enCours = 0;
      let enAttente = 0;
      let termine = 0;
      camionsEau.forEach(v => {
        const step = v.roadMap?.find((s: RoadMapEtape) => s.stationId === station.id);
        if (!step) return;
        if (step.statut === 'en-cours') enCours++;
        else if (step.statut === 'en-attente') enAttente++;
        else if (step.statut === 'termine') termine++;
      });
      return {
        station: station.label.replace('Mécanique ', 'Méc. ').replace('Soudure ', 'Soud. '),
        stationId: station.id,
        'En cours': enCours,
        'En attente': enAttente,
        'Terminé': termine,
      };
    });
  }, [camionsEau]);

  // ── Temps moyen par garage (time_logs) ────────────────────
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
      const total = durees.reduce((a, b) => a + b, 0);
      return {
        station: station.label.replace('Mécanique ', 'Méc. ').replace('Soudure ', 'Soud. '),
        stationId: station.id,
        'Temps moyen (min)': Math.round(moy),
        'Passages': durees.length,
        totalMinutes: total,
        color: station.color,
      };
    }).filter(d => d['Temps moyen (min)'] > 0 || d.Passages > 0);
  }, [timeLogs]);

  // ── Aging : jours depuis import ───────────────────────────
  const agingData = useMemo(() => {
    const now = Date.now();
    const bins = [
      { label: '< 7j', min: 0, max: 7, count: 0 },
      { label: '7-14j', min: 7, max: 14, count: 0 },
      { label: '14-30j', min: 14, max: 30, count: 0 },
      { label: '30-60j', min: 30, max: 60, count: 0 },
      { label: '60-90j', min: 60, max: 90, count: 0 },
      { label: '90j+', min: 90, max: Infinity, count: 0 },
    ];
    enProduction.forEach(v => {
      const days = (now - new Date(v.dateEnProduction ?? v.dateImport).getTime()) / 86400000;
      const bin = bins.find(b => days >= b.min && days < b.max);
      if (bin) bin.count++;
    });
    return bins.map(b => ({ name: b.label, Camions: b.count }));
  }, [enProduction]);

  // ── Liste des camions prêts ───────────────────────────────
  const pretsRows = useMemo(() =>
    prets.map(v => ({
      id: v.id,
      cells: [
        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#f97316' }}>#{v.numero}</span>,
        `${v.marque ?? ''} ${v.modele ?? ''}`.trim() || '—',
        v.variante ?? '—',
        v.aUnReservoir
          ? <span style={{ color: COLORS.avecReservoir, fontWeight: 700 }}>✓ Oui</span>
          : <span style={{ color: 'rgba(255,255,255,0.3)' }}>Non</span>,
        (() => {
          const ec = v.etatCommercial ?? 'non-vendu';
          const cfg: Record<string, { bg: string; color: string; label: string }> = {
            'vendu': { bg: '#22c55e20', color: '#22c55e', label: 'Vendu' },
            'reserve': { bg: '#f59e0b20', color: '#f59e0b', label: 'Réservé' },
            'location': { bg: '#8b5cf620', color: '#8b5cf6', label: 'Location' },
            'non-vendu': { bg: '#64748b20', color: '#64748b', label: 'Non vendu' },
          };
          const c = cfg[ec] ?? cfg['non-vendu'];
          return (
            <span style={{
              background: c.bg, color: c.color, padding: '2px 8px',
              borderRadius: 4, fontWeight: 700, fontSize: 11,
            }}>{c.label}</span>
          );
        })(),
        v.clientAcheteur || '—',
      ],
    })),
    [prets]
  );

  // ── Liste camions en production ───────────────────────────
  const prodRows = useMemo(() =>
    enProduction.map(v => {
      const etapeEnCours = v.roadMap?.find((s: RoadMapEtape) => s.statut === 'en-cours');
      const stationLabel = etapeEnCours
        ? ROAD_MAP_STATIONS.find(s => s.id === etapeEnCours.stationId)?.label ?? etapeEnCours.stationId
        : '—';
      const progression = v.roadMap && v.roadMap.length > 0
        ? Math.round(v.roadMap.filter((s: RoadMapEtape) => s.statut === 'termine' || s.statut === 'saute').length / v.roadMap.length * 100)
        : 0;
      return {
        id: v.id,
        cells: [
          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#f97316' }}>#{v.numero}</span>,
          `${v.marque ?? ''} ${v.modele ?? ''}`.trim() || '—',
          <span style={{ color: etapeEnCours ? '#3b82f6' : 'rgba(255,255,255,0.3)', fontWeight: 600 }}>{stationLabel}</span>,
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{ width: `${progression}%`, height: '100%', borderRadius: 3, background: progression === 100 ? '#22c55e' : '#3b82f6', transition: 'width 0.3s' }} />
            </div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace', minWidth: 32 }}>{progression}%</span>
          </div>,
          v.aUnReservoir
            ? <span style={{ color: COLORS.avecReservoir, fontWeight: 700 }}>✓</span>
            : <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>,
          (() => {
            const ec = v.etatCommercial ?? 'non-vendu';
            const cfg: Record<string, { color: string; label: string }> = {
              'vendu': { color: '#22c55e', label: '✓ Vendu' },
              'reserve': { color: '#f59e0b', label: '🔒 Rés.' },
              'location': { color: '#8b5cf6', label: '🔑 Loc.' },
              'non-vendu': { color: '#64748b', label: '—' },
            };
            const c = cfg[ec] ?? cfg['non-vendu'];
            return <span style={{ color: c.color, fontWeight: 700, fontSize: 11 }}>{c.label}</span>;
          })(),
        ],
      };
    }),
    [enProduction]
  );

  // ── Liste réservoirs ──────────────────────────────────────
  const reservoirRows = useMemo(() =>
    reservoirs.map(r => {
      const camion = r.camionId ? camionsEau.find(v => v.id === r.camionId || v.reservoirId === r.id) : null;
      const etatCfg: Record<string, { color: string; label: string }> = {
        'disponible': { color: '#22c55e', label: '✓ Disponible' },
        'installe': { color: '#0ea5e9', label: '🔧 Installé' },
        'en-peinture': { color: '#f59e0b', label: '🎨 En peinture' },
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
      {/* ── TITRE ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          fontSize: 24, fontWeight: 800, color: 'white',
          fontFamily: 'system-ui, sans-serif', letterSpacing: '-0.02em',
        }}>
          📊 Analyse — Camions à eau
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
          {camionsEau.length} camions actifs · Données en temps réel
        </div>
      </div>

      {/* ── KPI ROW ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 14, marginBottom: 24,
      }}>
        <KpiCard icon="✅" label="PRÊTS" value={prets.length}
          sub={`${prets.filter(v => v.etatCommercial === 'vendu').length} vendus`}
          color={COLORS.pret} />
        <KpiCard icon="🔧" label="EN PRODUCTION" value={enProduction.length}
          sub={`${enProduction.filter(v => v.etatCommercial === 'vendu').length} vendus`}
          color={COLORS.enProduction} />
        <KpiCard icon="📋" label="DISPONIBLES" value={disponibles.length}
          sub="À planifier"
          color={COLORS.disponible} />
        <KpiCard icon="🛢" label="RÉSERVOIRS DISPO." value={reservoirStats.disponibles}
          sub={`${reservoirStats.total} total · ${reservoirStats.installes} installés`}
          color={COLORS.avecReservoir} />
        <KpiCard icon="💰" label="VENDUS (total)" value={commercialCount.vendu}
          sub={`${commercialCount.reserve} réservés · ${commercialCount.location} location`}
          color={COLORS.vendu} />
      </div>

      {/* ── GRAPHIQUES ROW 1 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18, marginBottom: 18 }}>

        {/* PIE : Prêts — Commercial */}
        <Section title="Camions prêts — Statut commercial" icon="✅">
          {pretsCommercial.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pretsCommercial} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                  label={renderPieLabel} labelLine={false}
                  strokeWidth={0}
                >
                  {pretsCommercial.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>
              Aucun camion prêt
            </div>
          )}
        </Section>

        {/* PIE : En production — Commercial */}
        <Section title="En production — Statut commercial" icon="🔧">
          {prodCommercial.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={prodCommercial} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                  label={renderPieLabel} labelLine={false}
                  strokeWidth={0}
                >
                  {prodCommercial.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>
              Aucun camion en production
            </div>
          )}
        </Section>

        {/* PIE : Neuf vs Usagé */}
        <Section title="Répartition Neuf / Usagé" icon="🏷️">
          {varianteData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={varianteData} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                  label={renderPieLabel} labelLine={false}
                  strokeWidth={0}
                >
                  {varianteData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>
              Aucune donnée
            </div>
          )}
        </Section>
      </div>

      {/* ── GRAPHIQUES ROW 2 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>

        {/* BAR : Charge par station */}
        <Section title="Charge par station (camions à eau)" icon="📊">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stationLoad} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
              <YAxis type="category" dataKey="station" width={100}
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }} />
              <Bar dataKey="En cours" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
              <Bar dataKey="En attente" stackId="a" fill="#f59e0b" />
              <Bar dataKey="Terminé" stackId="a" fill="#22c55e" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Section>

        {/* BAR : Ancienneté en production */}
        <Section title="Ancienneté en production" icon="⏱️">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={agingData} margin={{ left: 0, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="Camions" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Section>
      </div>

      {/* ── TEMPS MOYEN PAR GARAGE ── */}
      {tempsParGarage.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <Section title="Temps moyen par garage (historique)" icon="⏳" span={2}>
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
                <div key={d.stationId} style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                  <span style={{ color: d.color, fontWeight: 700 }}>{d.station}</span>
                  {' · '}moy: {formatDuree(d['Temps moyen (min)'])} · {d.Passages} passages
                  {d.totalMinutes > 0 && <> · total: {formatJours(d.totalMinutes)}</>}
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* ── RÉSERVOIRS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 18, marginBottom: 18 }}>
        <Section title="Réservoirs — Vue d'ensemble" icon="🛢">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
            <div style={{ background: '#22c55e15', borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#22c55e', fontFamily: 'monospace' }}>
                {reservoirStats.disponibles}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Disponibles</div>
            </div>
            <div style={{ background: '#0ea5e915', borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#0ea5e9', fontFamily: 'monospace' }}>
                {reservoirStats.installes}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Installés</div>
            </div>
            {reservoirStats.enPeinture > 0 && (
              <div style={{ background: '#f59e0b15', borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#f59e0b', fontFamily: 'monospace' }}>
                  {reservoirStats.enPeinture}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>En peinture</div>
              </div>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.8 }}>
            <strong style={{ color: 'rgba(255,255,255,0.7)' }}>Par type :</strong>
            {Object.entries(reservoirStats.parType).map(([type, count]) => (
              <div key={type} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{type}</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>{count}</span>
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>Camions <strong>avec</strong> réservoir</span>
              <span style={{ color: COLORS.avecReservoir, fontWeight: 700 }}>{reservoirStats.camionsAvecReservoir}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Camions <strong>sans</strong> réservoir</span>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>{reservoirStats.camionsSansReservoir}</span>
            </div>
          </div>
        </Section>

        <Section title="Inventaire réservoirs" icon="📋">
          <MiniTable
            columns={['Numéro', 'Type', 'État', 'Camion']}
            rows={reservoirRows}
          />
        </Section>
      </div>

      {/* ── TABLEAUX DÉTAILLÉS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 18, marginBottom: 18 }}>
        <Section title={`Camions prêts (${prets.length})`} icon="✅">
          <MiniTable
            columns={['#', 'Véhicule', 'Variante', 'Réservoir', 'Statut', 'Client']}
            rows={pretsRows}
          />
        </Section>

        <Section title={`En production (${enProduction.length})`} icon="🔧">
          <MiniTable
            columns={['#', 'Véhicule', 'Station actuelle', 'Progression', 'Rés.', 'Commercial']}
            rows={prodRows}
          />
        </Section>
      </div>
    </div>
  );
}
