// ════════════════════════════════════════════════════════════════
// VueBilanHebdo — Onglet "Bilan hebdomadaire"
// Tableau de bord stratégique — comparaison deux semaines
// ════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { locationService, type LocationAvecCumul } from '../services/locationService';
import { LocationsManager } from './LocationsManager';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const fmt$ = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);

const fmtPct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)} %`;

function currentFY(): number {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}

function getWeekBounds() {
  const now  = new Date();
  const dow  = now.getDay();
  const daysToMon = dow === 0 ? 6 : dow - 1;
  const mon  = new Date(now); mon.setDate(now.getDate() - daysToMon); mon.setHours(0, 0, 0, 0);
  const prev = new Date(mon); prev.setDate(mon.getDate() - 7);
  const monPrev = new Date(prev);
  const fmt  = (d: Date) => d.toISOString().slice(0, 10);
  return {
    monday:     fmt(mon),
    prevMonday: fmt(prev),
    today:      fmt(now),
    monDate:    mon,
    prevMonDate: monPrev,
  };
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function labelSemaine(monday: Date): string {
  const vendredi = new Date(monday); vendredi.setDate(monday.getDate() + 4);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
  const fmt = (d: Date) => d.toLocaleDateString('fr-CA', opts);
  return `${fmt(monday)} → ${fmt(vendredi)}`;
}

// ─── Types locaux ──────────────────────────────────────────────────────────────

interface PipelineRow {
  id: string;
  numero: string;
  marque?: string;
  modele?: string;
  annee?: number;
  etat_commercial: string;
  client_acheteur?: string;
  vendeur_nom?: string;
  paiement_depot: boolean;
  paiement_complet: boolean;
  paiement_po: boolean;
  en_financement: boolean;
  montant_depot?: number;
  date_depot?: string;
  mode_paiement_depot?: string;
  prix_demande?: number;
  livraison_asap: boolean;
}

interface VenteWeekRow {
  date_vente: string;
  prix_vente: number;
  marge_profit: number;
  stock_numero: string;
  vehicule: string;
  client: string;
  jours_inventaire: number | null;
}

interface PieceWeekRow {
  sous_total: number;
  date_vente: string;
}

interface DepotWeekRow {
  id: string;
  numero: string;
  marque?: string;
  modele?: string;
  annee?: number;
  client_acheteur?: string;
  montant_depot: number;
  date_depot: string;
  mode_paiement_depot?: string;
  vendeur_nom?: string;
}

// ─── Sous-composants ───────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, marginTop: 28 }}>
      {children}
    </div>
  );
}

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color, background: bg }}>
      {label}
    </span>
  );
}

function badgeStatut(row: PipelineRow) {
  if (row.en_financement) return <Badge label="🏦 Financement" color="#1d4ed8" bg="#dbeafe" />;
  if (row.paiement_po)    return <Badge label="📋 PO reçu"     color="#065f46" bg="#d1fae5" />;
  if (row.paiement_depot) return <Badge label="💵 Dépôt reçu"  color="#92400e" bg="#fef3c7" />;
  return                         <Badge label="⏳ En attente"   color="#6b7280" bg="#f3f4f6" />;
}

// ─── Composant principal ───────────────────────────────────────────────────────

export function VueBilanHebdo() {
  const { monday, prevMonday, today, monDate, prevMonDate } = getWeekBounds();
  const fy = currentFY();

  // ── State ─────────────────────────────────────────────────────
  const [loading,      setLoading]      = useState(true);
  const [pipeline,     setPipeline]     = useState<PipelineRow[]>([]);
  const [partis,       setPartis]       = useState<PipelineRow[]>([]);
  const [ventesWeek,   setVentesWeek]   = useState<VenteWeekRow[]>([]);
  const [ventesPrev,   setVentesPrev]   = useState<VenteWeekRow[]>([]);
  const [piecesWeek,   setPiecesWeek]   = useState<PieceWeekRow[]>([]);
  const [piecesPrev,   setPiecesPrev]   = useState<PieceWeekRow[]>([]);
  const [depotsWeek,   setDepotsWeek]   = useState<DepotWeekRow[]>([]);
  const [depotsPrev,   setDepotsPrev]   = useState<DepotWeekRow[]>([]);
  const [ytdVentes,    setYtdVentes]    = useState({ ca: 0, marge: 0, nb: 0 });
  const [ytdPieces,    setYtdPieces]    = useState({ ca: 0, nb: 0 });
  const [locations,    setLocations]    = useState<LocationAvecCumul[]>([]);
  // Camions marqués en location dans prod_inventaire (peut ou non avoir de contrat)
  const [campsInvLoc,  setCampsInvLoc]  = useState<{ numero: string; marque: string|null; modele: string|null; annee: number|null; client_acheteur: string|null }[]>([]);
  const [showLocManager,    setShowLocManager]    = useState(false);
  const [stockPrerempli,    setStockPrerempli]    = useState<string | undefined>(undefined);

  // ── Chargement ────────────────────────────────────────────────
  useEffect(() => { charger(); }, []);

  async function charger() {
    setLoading(true);
    try {
      // 1. Vendeurs
      const { data: vds } = await supabase.from('prod_vendeurs').select('id, nom');
      const vendMap: Record<string, string> = {};
      (vds ?? []).forEach((v: any) => { vendMap[v.id] = v.nom; });

      // 2. Pipeline "Argent à venir" — TOUT camion avec signal commercial actif
      // Un camion entre dans le pipeline dès qu'il a UN de ces signaux :
      //   - etat_commercial = 'reserve' ou 'vendu'
      //   - paiement_depot  = true (dépôt reçu mais sale pas encore finalisée)
      //   - paiement_po     = true (PO reçu)
      //   - en_financement  = true (en attente de financement)
      // ET paiement_complet = false (pas encore complètement payé)
      // Les LOCATIONS sont gérées dans leur propre section — jamais ici.
      const { data: invData } = await supabase
        .from('prod_inventaire')
        .select('id, numero, marque, modele, annee, etat_commercial, client_acheteur, vendeur_id, paiement_depot, paiement_complet, paiement_po, en_financement, montant_depot, date_depot, mode_paiement_depot, livraison_asap')
        .in('type', ['eau', 'detail'])
        .eq('paiement_complet', false)
        .neq('etat_commercial', 'location')
        .or('etat_commercial.eq.reserve,etat_commercial.eq.vendu,paiement_depot.eq.true,paiement_po.eq.true,en_financement.eq.true');

      // 3. Partis (payés complet, 60 derniers jours) — vendus uniquement (pas locations)
      const { data: partisData } = await supabase
        .from('prod_inventaire')
        .select('id, numero, marque, modele, annee, etat_commercial, client_acheteur, vendeur_id, paiement_depot, paiement_complet, paiement_po, en_financement, montant_depot, date_depot, mode_paiement_depot, livraison_asap')
        .in('etat_commercial', ['vendu'])
        .in('type', ['eau', 'detail'])
        .eq('paiement_complet', true)
        .gte('updated_at', new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString());

      // 4. Prix demandé + statut prod_ventes (pour filtrer les ventes déjà finalisées)
      const numeros = [...(invData ?? []), ...(partisData ?? [])].map((r: any) => r.numero);
      let prixMap: Record<string, number> = {};
      const vendusFinalises = new Set<string>();
      if (numeros.length > 0) {
        const { data: prixData } = await supabase
          .from('prod_ventes')
          .select('stock_numero, prix_demande, statut')
          .in('stock_numero', numeros);
        (prixData ?? []).forEach((r: any) => {
          if (r.prix_demande) prixMap[r.stock_numero] = r.prix_demande;
          // Une ligne dans prod_ventes avec statut='vendu' = vente finalisée
          // → on retire ces camions du pipeline (peu importe paiement_complet de prod_inventaire)
          if (r.statut === 'vendu') vendusFinalises.add(r.stock_numero);
        });
      }

      const toRow = (r: any): PipelineRow => ({
        ...r,
        vendeur_nom: r.vendeur_id ? vendMap[r.vendeur_id] : undefined,
        prix_demande: prixMap[r.numero],
        en_financement: r.en_financement ?? false,
      });

      // Retirer du pipeline les camions dont la vente est déjà finalisée
      // (prod_ventes.statut = 'vendu') — désync avec prod_inventaire.paiement_complet
      const pipelineFiltre = (invData ?? []).filter((r: any) => !vendusFinalises.has(r.numero));

      setPipeline(pipelineFiltre.map(toRow));
      setPartis((partisData ?? []).map(toRow));

      // 5. Pièces cette semaine
      const { data: pwData } = await supabase
        .from('prod_ventes_pieces')
        .select('sous_total, date_vente')
        .gte('date_vente', monday);
      setPiecesWeek(pwData ?? []);

      // 6. Pièces semaine précédente
      const { data: ppData } = await supabase
        .from('prod_ventes_pieces')
        .select('sous_total, date_vente')
        .gte('date_vente', prevMonday)
        .lt('date_vente', monday);
      setPiecesPrev(ppData ?? []);

      // 7. Camions vendus financier — cette semaine
      const { data: vwData } = await supabase
        .from('prod_rapport_profitabilite')
        .select('date_vente, prix_vente, marge_profit, stock_numero, vehicule, client, jours_inventaire')
        .gte('date_vente', monday);
      setVentesWeek(vwData ?? []);

      // 8. Camions vendus financier — semaine précédente
      const { data: vpData } = await supabase
        .from('prod_rapport_profitabilite')
        .select('date_vente, prix_vente, marge_profit, stock_numero, vehicule, client, jours_inventaire')
        .gte('date_vente', prevMonday)
        .lt('date_vente', monday);
      setVentesPrev(vpData ?? []);

      // 9. Dépôts reçus — cette semaine (date_depot)
      const { data: dwData } = await supabase
        .from('prod_inventaire')
        .select('id, numero, marque, modele, annee, client_acheteur, vendeur_id, montant_depot, date_depot, mode_paiement_depot')
        .eq('paiement_depot', true)
        .gte('date_depot', monday)
        .in('type', ['eau', 'detail']);
      setDepotsWeek((dwData ?? []).map((r: any) => ({
        ...r, vendeur_nom: r.vendeur_id ? vendMap[r.vendeur_id] : undefined,
      })));

      // 10. Dépôts reçus — semaine précédente
      const { data: dpData } = await supabase
        .from('prod_inventaire')
        .select('id, numero, marque, modele, annee, client_acheteur, vendeur_id, montant_depot, date_depot, mode_paiement_depot')
        .eq('paiement_depot', true)
        .gte('date_depot', prevMonday)
        .lt('date_depot', monday)
        .in('type', ['eau', 'detail']);
      setDepotsPrev((dpData ?? []).map((r: any) => ({
        ...r, vendeur_nom: r.vendeur_id ? vendMap[r.vendeur_id] : undefined,
      })));

      // 11. YTD Ventes
      const { data: ytdVData } = await supabase
        .from('prod_rapport_profitabilite')
        .select('prix_vente, marge_profit')
        .eq('annee_fiscale', fy);
      const ytdV = (ytdVData ?? []).reduce((acc: any, r: any) => ({
        ca: acc.ca + (r.prix_vente ?? 0),
        marge: acc.marge + (r.marge_profit ?? 0),
        nb: acc.nb + 1,
      }), { ca: 0, marge: 0, nb: 0 });
      setYtdVentes(ytdV);

      // 12. YTD Pièces
      const { data: ytdPData } = await supabase
        .from('prod_ventes_pieces')
        .select('sous_total')
        .eq('annee_fiscale', fy);
      const ytdP = (ytdPData ?? []).reduce((acc: any, r: any) => ({
        ca: acc.ca + Math.max(r.sous_total, 0),
        nb: acc.nb + 1,
      }), { ca: 0, nb: 0 });
      setYtdPieces(ytdP);

      // 12. Locations actives (revenu cumulé) + camions marqués 'location' dans inventaire
      try {
        const [locs, { data: invLoc }] = await Promise.all([
          locationService.getActifs(),
          supabase
            .from('prod_inventaire')
            .select('numero, marque, modele, annee, client_acheteur')
            .eq('etat_commercial', 'location')
            .neq('statut', 'archive'),
        ]);
        setLocations(locs);
        setCampsInvLoc((invLoc ?? []) as any);
      } catch (e) {
        console.warn('[VueBilanHebdo] Locations non chargées (table prod_locations manquante ?):', e);
        setLocations([]);
        setCampsInvLoc([]);
      }

    } catch (err) {
      console.error('[VueBilanHebdo] Erreur chargement:', err);
    } finally {
      setLoading(false);
    }
  }

  // ── Calculs ───────────────────────────────────────────────────
  // Cette semaine
  const piecesCA_W    = piecesWeek.reduce((s, r) => s + Math.max(r.sous_total, 0), 0);
  const ventesCA_W    = ventesWeek.reduce((s, r) => s + (r.prix_vente ?? 0), 0);
  const ventesMarge_W = ventesWeek.reduce((s, r) => s + (r.marge_profit ?? 0), 0);
  const avecJoursW    = ventesWeek.filter(r => r.jours_inventaire != null);
  const avgJoursW     = avecJoursW.length > 0 ? Math.round(avecJoursW.reduce((s, r) => s + (r.jours_inventaire ?? 0), 0) / avecJoursW.length) : null;
  const avecJoursP    = ventesPrev.filter(r => r.jours_inventaire != null);
  const avgJoursP     = avecJoursP.length > 0 ? Math.round(avecJoursP.reduce((s, r) => s + (r.jours_inventaire ?? 0), 0) / avecJoursP.length) : null;
  const depotsCA_W    = depotsWeek.reduce((s, r) => s + (r.montant_depot ?? 0), 0);

  // Revenu de location — prorata par jour (montant_mensuel / 30 × jours actifs dans la semaine)
  const calcLocationsSemaine = (debutSem: string, finSem: string) => {
    const d1 = new Date(debutSem).getTime();
    const d2 = new Date(finSem).getTime();
    return locations.reduce((s, l) => {
      const debutContrat = new Date(l.dateDebut).getTime();
      const finContrat   = l.dateFin ? new Date(l.dateFin).getTime() : d2;
      // Intersection contrat × semaine
      const debutInter = Math.max(debutContrat, d1);
      const finInter   = Math.min(finContrat, d2);
      if (finInter <= debutInter) return s;
      const jours = (finInter - debutInter) / (1000 * 60 * 60 * 24);
      return s + (l.montantMensuel * jours / 30);
    }, 0);
  };
  const locationsCA_W   = calcLocationsSemaine(monday, today);
  const locationsCumule = locations.reduce((s, l) => s + (l.revenuCumule ?? 0), 0);
  const totalW          = piecesCA_W + depotsCA_W + ventesCA_W + locationsCA_W;

  // Semaine précédente
  const piecesCA_P    = piecesPrev.reduce((s, r) => s + Math.max(r.sous_total, 0), 0);
  const ventesCA_P    = ventesPrev.reduce((s, r) => s + (r.prix_vente ?? 0), 0);
  const depotsCA_P    = depotsPrev.reduce((s, r) => s + (r.montant_depot ?? 0), 0);
  const locationsCA_P = calcLocationsSemaine(prevMonday, monday);
  const totalP        = piecesCA_P + depotsCA_P + ventesCA_P + locationsCA_P;

  const delta = (curr: number, prev: number) =>
    prev > 0 ? fmtPct((curr - prev) / prev * 100) : null;

  // Pipeline
  const argAVenir = pipeline.reduce((s, r) => {
    const prix  = r.prix_demande ?? 0;
    const depot = r.paiement_depot ? (r.montant_depot ?? 0) : 0;
    return s + Math.max(prix - depot, 0);
  }, 0);

  // Catégorisation :
  // - 'reserve' explicite → réservés
  // - tout le reste du pipeline (vendu OU signal commercial sans statut explicite) → vendus non payés
  const reservesPipeline = pipeline.filter(r => r.etat_commercial === 'reserve');
  const vendusPipeline   = pipeline.filter(r => r.etat_commercial !== 'reserve');

  // ── Rendu ─────────────────────────────────────────────────────
  if (loading) {
    return <div style={{ padding: 40, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>⏳ Chargement…</div>;
  }

  const TH = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
    <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: right ? 'right' : 'left', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      {children}
    </th>
  );
  const TD = ({ children, right, bold, color, colSpan }: { children: React.ReactNode; right?: boolean; bold?: boolean; color?: string; colSpan?: number }) => (
    <td colSpan={colSpan} style={{ padding: '10px 12px', fontSize: 13, textAlign: right ? 'right' : 'left', fontWeight: bold ? 700 : 400, color: color ?? 'rgba(255,255,255,0.85)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      {children}
    </td>
  );

  // ── Cellule de comparaison ─────────────────────────────────────
  function CmpRow({ icon, label, curr, prev, currSub, prevSub }: {
    icon: string; label: string;
    curr: number; prev: number;
    currSub?: string; prevSub?: string;
  }) {
    const d = delta(curr, prev);
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Cette semaine */}
        <div style={{ padding: '14px 20px', background: 'rgba(255,255,255,0.03)' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>{icon} {label}</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: curr > 0 ? 'white' : 'rgba(255,255,255,0.3)' }}>{fmt$(curr)}</div>
          {currSub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{currSub}</div>}
        </div>
        {/* Semaine précédente */}
        <div style={{ padding: '14px 20px', background: 'transparent', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginBottom: 2 }}>Semaine préc.</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'rgba(255,255,255,0.4)' }}>{fmt$(prev)}</div>
          {d && (
            <div style={{ fontSize: 11, marginTop: 2, color: d.startsWith('+') ? '#4ade80' : '#f87171', fontWeight: 700 }}>
              {d} vs sem. préc.
            </div>
          )}
          {prevSub && !d && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>{prevSub}</div>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: 'white' }}>

      {/* ── En-tête ────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>📅 BILAN HEBDOMADAIRE</div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>
          Cette semaine : {labelSemaine(monDate)}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
          Semaine préc. : {labelSemaine(prevMonDate)}
        </div>
      </div>

      {/* ── Comparaison deux semaines ───────────────────────────── */}
      <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, overflow: 'hidden', marginBottom: 24 }}>
        {/* En-têtes colonnes */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'rgba(255,255,255,0.06)' }}>
          <div style={{ padding: '10px 20px', fontSize: 12, fontWeight: 800, color: 'white' }}>📅 CETTE SEMAINE</div>
          <div style={{ padding: '10px 20px', fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.4)', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>SEMAINE PRÉCÉDENTE</div>
        </div>

        <CmpRow
          icon="🔧" label="Pièces vendues"
          curr={piecesCA_W} prev={piecesCA_P}
          currSub={`${piecesWeek.length} facture${piecesWeek.length !== 1 ? 's' : ''}`}
          prevSub={`${piecesPrev.length} facture${piecesPrev.length !== 1 ? 's' : ''}`}
        />
        <CmpRow
          icon="🚚" label="Camions vendus (financier)"
          curr={ventesCA_W} prev={ventesCA_P}
          currSub={ventesCA_W > 0 ? `${ventesWeek.length} camion${ventesWeek.length !== 1 ? 's' : ''} · Marge ${fmt$(ventesMarge_W)}` : `${ventesWeek.length} camion`}
          prevSub={`${ventesPrev.length} camion${ventesPrev.length !== 1 ? 's' : ''}`}
        />
        <CmpRow
          icon="💵" label="Dépôts reçus"
          curr={depotsCA_W} prev={depotsCA_P}
          currSub={`${depotsWeek.length} dépôt${depotsWeek.length !== 1 ? 's' : ''}`}
          prevSub={`${depotsPrev.length} dépôt${depotsPrev.length !== 1 ? 's' : ''}`}
        />
        <CmpRow
          icon="🔁" label="Revenu de location"
          curr={locationsCA_W} prev={locationsCA_P}
          currSub={locations.length > 0
            ? `${locations.length} contrat${locations.length !== 1 ? 's' : ''} actif${locations.length !== 1 ? 's' : ''} · Cumulé total ${fmt$(locationsCumule)}`
            : 'Aucun contrat actif'}
          prevSub={undefined}
        />

        {/* Jours en inventaire moyen */}
        {(avgJoursW != null || avgJoursP != null) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ padding: '14px 20px', background: 'rgba(255,255,255,0.03)' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>📅 Jours en inv. moyen</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: avgJoursW == null ? 'rgba(255,255,255,0.3)' : avgJoursW <= 60 ? '#4ade80' : avgJoursW <= 120 ? '#f59e0b' : '#ef4444' }}>
                {avgJoursW != null ? `${avgJoursW} j` : '—'}
              </div>
              {ventesWeek.length > 0 && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{ventesWeek.length} camion{ventesWeek.length !== 1 ? 's' : ''}</div>}
            </div>
            <div style={{ padding: '14px 20px', background: 'transparent', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginBottom: 2 }}>Semaine préc.</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: 'rgba(255,255,255,0.4)' }}>
                {avgJoursP != null ? `${avgJoursP} j` : '—'}
              </div>
            </div>
          </div>
        )}

        {/* Total */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'rgba(245,158,11,0.08)', borderTop: '1px solid rgba(245,158,11,0.2)' }}>
          <div style={{ padding: '14px 20px' }}>
            <div style={{ fontSize: 11, color: 'rgba(245,158,11,0.8)', marginBottom: 2, fontWeight: 700 }}>💰 TOTAL ARGENT REÇU</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#f59e0b' }}>{fmt$(totalW)}</div>
          </div>
          <div style={{ padding: '14px 20px', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 2, fontWeight: 700 }}>SEMAINE PRÉCÉDENTE</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: 'rgba(255,255,255,0.4)' }}>{fmt$(totalP)}</div>
            {totalP > 0 && (
              <div style={{ fontSize: 12, marginTop: 2, color: totalW >= totalP ? '#4ade80' : '#f87171', fontWeight: 700 }}>
                {delta(totalW, totalP)} vs sem. préc.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Détail : Camions vendus cette semaine ───────────────── */}
      <SectionTitle>🚚 Camions vendus cette semaine ({ventesWeek.length})</SectionTitle>
      {ventesWeek.length === 0 ? (
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, padding: '10px 0', marginBottom: 8 }}>Aucun camion vendu dans le système financier cette semaine.</div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid rgba(74,222,128,0.15)', marginBottom: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <TH>#Stock</TH>
                <TH>Véhicule</TH>
                <TH>Client</TH>
                <TH right>Prix vente</TH>
                <TH right>Marge</TH>
                <TH right>Jours inv.</TH>
                <TH>Date vente</TH>
              </tr>
            </thead>
            <tbody>
              {ventesWeek.map(r => (
                <tr key={r.stock_numero}>
                  <TD bold color="#4ade80">#{r.stock_numero}</TD>
                  <TD>{r.vehicule || '—'}</TD>
                  <TD>{r.client || '—'}</TD>
                  <TD right bold color="#4ade80">{fmt$(r.prix_vente)}</TD>
                  <TD right color={r.marge_profit > 0 ? '#4ade80' : '#f87171'}>{fmt$(r.marge_profit)}</TD>
                  <TD right color={r.jours_inventaire == null ? undefined : r.jours_inventaire <= 60 ? '#4ade80' : r.jours_inventaire <= 120 ? '#f59e0b' : '#ef4444'}>
                    {r.jours_inventaire != null ? `${r.jours_inventaire} j` : '—'}
                  </TD>
                  <TD>{fmtDate(r.date_vente)}</TD>
                </tr>
              ))}
              <tr style={{ background: 'rgba(74,222,128,0.06)' }}>
                <TD bold colSpan={3}>TOTAL</TD>
                <TD right bold color="#4ade80">{fmt$(ventesCA_W)}</TD>
                <TD right bold color="#4ade80">{fmt$(ventesMarge_W)}</TD>
                <TD right bold color={avgJoursW == null ? undefined : avgJoursW <= 60 ? '#4ade80' : avgJoursW <= 120 ? '#f59e0b' : '#ef4444'}>
                  {avgJoursW != null ? `moy. ${avgJoursW} j` : '—'}
                </TD>
                <TD>{''}</TD>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ── Détail : Dépôts reçus cette semaine ─────────────────── */}
      <SectionTitle>💵 Dépôts reçus cette semaine ({depotsWeek.length})</SectionTitle>
      {depotsWeek.length === 0 ? (
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, padding: '10px 0', marginBottom: 8 }}>Aucun dépôt enregistré cette semaine.</div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid rgba(245,158,11,0.2)', marginBottom: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <TH>#Stock</TH>
                <TH>Camion</TH>
                <TH>Client</TH>
                <TH right>Montant dépôt</TH>
                <TH>Mode</TH>
                <TH>Date</TH>
              </tr>
            </thead>
            <tbody>
              {depotsWeek.map(r => (
                <tr key={r.id}>
                  <TD bold color="#f59e0b">#{r.numero}</TD>
                  <TD>{[r.annee, r.marque, r.modele].filter(Boolean).join(' ') || '—'}</TD>
                  <TD>{r.client_acheteur ?? '—'}</TD>
                  <TD right bold color="#f59e0b">{fmt$(r.montant_depot)}</TD>
                  <TD>{r.mode_paiement_depot ?? '—'}</TD>
                  <TD>{fmtDate(r.date_depot)}</TD>
                </tr>
              ))}
              <tr style={{ background: 'rgba(245,158,11,0.06)' }}>
                <TD bold colSpan={3}>TOTAL DÉPÔTS</TD>
                <TD right bold color="#f59e0b">{fmt$(depotsCA_W)}</TD>
                <TD>{''}</TD>
                <TD>{''}</TD>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pipeline — Argent à venir ────────────────────────────── */}
      <SectionTitle>💵 Argent à venir — Vendus non payés ({vendusPipeline.length})</SectionTitle>
      {vendusPipeline.length === 0 ? (
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, padding: '12px 0' }}>Aucun camion vendu en attente de paiement.</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
            {[
              { label: 'Camions en attente',  value: String(vendusPipeline.length), color: undefined },
              { label: 'Dépôts reçus',        value: fmt$(vendusPipeline.filter(r => r.paiement_depot).reduce((s, r) => s + (r.montant_depot ?? 0), 0)), color: '#f59e0b' },
              { label: 'Solde total à venir', value: fmt$(argAVenir), color: '#f87171' },
            ].map(k => (
              <div key={k.label} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 18px' }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{k.label}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: k.color ?? 'white' }}>{k.value}</div>
              </div>
            ))}
          </div>
          <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <TH>#Stock</TH>
                  <TH>Camion</TH>
                  <TH>Client</TH>
                  <TH>Vendeur</TH>
                  <TH right>Prix convenu</TH>
                  <TH right>Dépôt reçu</TH>
                  <TH>Mode</TH>
                  <TH right>Solde à venir</TH>
                  <TH>Statut</TH>
                </tr>
              </thead>
              <tbody>
                {vendusPipeline.map(r => {
                  const prix  = r.prix_demande ?? 0;
                  const depot = r.paiement_depot ? (r.montant_depot ?? 0) : 0;
                  const solde = Math.max(prix - depot, 0);
                  return (
                    <tr key={r.id}>
                      <TD bold color="#f59e0b">#{r.numero}</TD>
                      <TD>{[r.annee, r.marque, r.modele].filter(Boolean).join(' ') || '—'}</TD>
                      <TD>{r.client_acheteur ?? '—'}</TD>
                      <TD>{r.vendeur_nom ?? '—'}</TD>
                      <TD right bold>{fmt$(prix || null)}</TD>
                      <TD right color="#f59e0b">{r.paiement_depot ? fmt$(r.montant_depot) : '—'}</TD>
                      <TD>{r.mode_paiement_depot ?? '—'}</TD>
                      <TD right bold color="#f87171">{fmt$(solde || null)}</TD>
                      <TD>{badgeStatut(r)}</TD>
                    </tr>
                  );
                })}
                <tr style={{ background: 'rgba(248,113,113,0.08)' }}>
                  <TD bold colSpan={7 as any}>TOTAL À RECEVOIR</TD>
                  <TD right bold color="#f87171">{fmt$(argAVenir)}</TD>
                  <TD>{''}</TD>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Locations en cours — revenus cumulés ─────────────────── */}
      {(() => {
        // Index des contrats par stock_numero pour matcher avec l'inventaire
        const contratsByStock: Record<string, LocationAvecCumul> = {};
        for (const l of locations) contratsByStock[l.stockNumero] = l;

        // Liste fusionnée : tous les camions où etat_commercial='location' DANS L'INVENTAIRE,
        // plus les contrats existants qui ne seraient pas (encore) marqués dans l'inventaire.
        const stocksInv = new Set(campsInvLoc.map(c => c.numero));
        const lignes: Array<{
          stockNumero: string;
          client:      string | null;
          marque:      string | null;
          modele:      string | null;
          annee:       number | null;
          contrat:     LocationAvecCumul | null;
        }> = [];

        // 1. Camions marqués 'location' dans inventaire (avec ou sans contrat)
        for (const c of campsInvLoc) {
          const contrat = contratsByStock[c.numero] ?? null;
          lignes.push({
            stockNumero: c.numero,
            client:      contrat?.client ?? c.client_acheteur,
            marque:      c.marque, modele: c.modele, annee: c.annee,
            contrat,
          });
        }
        // 2. Contrats actifs dont le camion n'a PAS etat_commercial='location' (incohérence)
        for (const l of locations) {
          if (!stocksInv.has(l.stockNumero)) {
            lignes.push({
              stockNumero: l.stockNumero, client: l.client,
              marque: null, modele: null, annee: null, contrat: l,
            });
          }
        }

        const avecContrat = lignes.filter(li => li.contrat);
        const sansContrat = lignes.filter(li => !li.contrat);
        const totalRevenuLocations = avecContrat.reduce((s, li) => s + (li.contrat!.revenuCumule ?? 0), 0);
        const totalMensuel         = avecContrat.reduce((s, li) => s + (li.contrat!.montantMensuel ?? 0), 0);

        return (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, marginBottom: 10 }}>
              <SectionTitle>🔁 Locations en cours ({lignes.length})</SectionTitle>
              <button onClick={() => { setStockPrerempli(undefined); setShowLocManager(true); }} style={{
                padding: '8px 14px', borderRadius: 8, border: 'none',
                background: '#8b5cf6', color: 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}>
                Gérer les contrats
              </button>
            </div>

            {lignes.length === 0 ? (
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, padding: '12px 0' }}>
                Aucun camion en location actuellement.
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
                  {[
                    { label: 'Camions en location',      value: String(lignes.length),    color: undefined },
                    { label: 'Contrats à compléter',     value: String(sansContrat.length), color: sansContrat.length > 0 ? '#f59e0b' : undefined },
                    { label: 'Revenu mensuel récurrent', value: fmt$(totalMensuel),       color: '#8b5cf6' },
                    { label: 'Revenu cumulé total',      value: fmt$(totalRevenuLocations), color: '#22c55e' },
                  ].map(k => (
                    <div key={k.label} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 18px' }}>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{k.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: k.color ?? 'white' }}>{k.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <TH>#Stock</TH>
                        <TH>Camion</TH>
                        <TH>Client</TH>
                        <TH>Début</TH>
                        <TH right>Mensuel</TH>
                        <TH right>Mois</TH>
                        <TH right>Cumulé</TH>
                        <TH>Action</TH>
                      </tr>
                    </thead>
                    <tbody>
                      {lignes.map(li => (
                        <tr key={li.stockNumero}>
                          <TD bold color="#8b5cf6">#{li.stockNumero}</TD>
                          <TD>{[li.annee, li.marque, li.modele].filter(Boolean).join(' ') || '—'}</TD>
                          <TD>{li.client ?? '—'}</TD>
                          <TD>{li.contrat?.dateDebut ?? '—'}</TD>
                          <TD right>{li.contrat ? fmt$(li.contrat.montantMensuel) : '—'}</TD>
                          <TD right>{li.contrat ? String(li.contrat.moisEcoules) : '—'}</TD>
                          <TD right bold color={li.contrat ? '#22c55e' : '#f59e0b'}>
                            {li.contrat ? fmt$(li.contrat.revenuCumule) : '⚠️ Contrat manquant'}
                          </TD>
                          <TD>
                            {li.contrat ? (
                              <button onClick={() => { setStockPrerempli(undefined); setShowLocManager(true); }} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                Voir
                              </button>
                            ) : (
                              <button onClick={() => { setStockPrerempli(li.stockNumero); setShowLocManager(true); }} style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: '#f59e0b', color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                                + Ajouter contrat
                              </button>
                            )}
                          </TD>
                        </tr>
                      ))}
                      <tr style={{ background: 'rgba(34,197,94,0.08)' }}>
                        <TD bold colSpan={6 as any}>TOTAL CUMULÉ</TD>
                        <TD right bold color="#22c55e">{fmt$(totalRevenuLocations)}</TD>
                        <TD>{''}</TD>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        );
      })()}

      {/* Modal de gestion des locations */}
      {showLocManager && (
        <LocationsManager
          onClose={() => { setShowLocManager(false); setStockPrerempli(undefined); charger(); }}
          stockInitial={stockPrerempli}
        />
      )}

      {/* ── Réservés & En financement ───────────────────────────── */}
      {reservesPipeline.length > 0 && (
        <>
          <SectionTitle>🔒 Réservés & En financement ({reservesPipeline.length})</SectionTitle>
          <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <TH>#Stock</TH>
                  <TH>Camion</TH>
                  <TH>Client</TH>
                  <TH>Vendeur</TH>
                  <TH right>Prix demandé</TH>
                  <TH>Statut</TH>
                  <TH>ASAP</TH>
                </tr>
              </thead>
              <tbody>
                {reservesPipeline.map(r => (
                  <tr key={r.id}>
                    <TD bold color="#f59e0b">#{r.numero}</TD>
                    <TD>{[r.annee, r.marque, r.modele].filter(Boolean).join(' ') || '—'}</TD>
                    <TD>{r.client_acheteur ?? '—'}</TD>
                    <TD>{r.vendeur_nom ?? '—'}</TD>
                    <TD right>{fmt$(r.prix_demande ?? null)}</TD>
                    <TD>{badgeStatut(r)}</TD>
                    <TD>{r.livraison_asap ? '🔥' : ''}</TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Camions vendus & partis ──────────────────────────────── */}
      {partis.length > 0 && (
        <>
          <SectionTitle>✅ Vendus & payés (60 derniers jours — {partis.length})</SectionTitle>
          <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <TH>#Stock</TH>
                  <TH>Camion</TH>
                  <TH>Client</TH>
                  <TH>Vendeur</TH>
                  <TH right>Prix</TH>
                  <TH>Mode paiement</TH>
                </tr>
              </thead>
              <tbody>
                {partis.map(r => (
                  <tr key={r.id}>
                    <TD bold color="#4ade80">#{r.numero}</TD>
                    <TD>{[r.annee, r.marque, r.modele].filter(Boolean).join(' ') || '—'}</TD>
                    <TD>{r.client_acheteur ?? '—'}</TD>
                    <TD>{r.vendeur_nom ?? '—'}</TD>
                    <TD right bold>{fmt$(r.prix_demande ?? null)}</TD>
                    <TD>{r.mode_paiement_depot ?? '—'}</TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── Analyse globale AF courant ───────────────────────────── */}
      <SectionTitle>📊 Analyse globale — AF {fy} (à ce jour)</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 8 }}>
        {[
          { label: '🚚 CA camions YTD',    value: fmt$(ytdVentes.ca),    sub: `${ytdVentes.nb} camion${ytdVentes.nb !== 1 ? 's' : ''}`, color: undefined },
          { label: '📈 Marge YTD',         value: fmt$(ytdVentes.marge), sub: ytdVentes.ca > 0 ? `${(ytdVentes.marge / ytdVentes.ca * 100).toFixed(1)} %` : undefined, color: ytdVentes.marge > 0 ? '#4ade80' : '#f87171' },
          { label: '🔧 Pièces YTD (brut)', value: fmt$(ytdPieces.ca),   sub: `${ytdPieces.nb} factures`, color: undefined },
          { label: '💰 Total revenus YTD', value: fmt$(ytdVentes.ca + ytdPieces.ca), sub: undefined, color: '#f59e0b' },
        ].map(k => (
          <div key={k.label} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: k.color ?? 'white', lineHeight: 1 }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{k.sub}</div>}
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {[
          { label: '🔒 En pipeline (vendus+réservés)', value: String(pipeline.length), color: undefined },
          { label: '💵 À recevoir (pipeline)',         value: fmt$(argAVenir),         color: '#f87171' },
          { label: '🏦 Financement en cours',          value: String(pipeline.filter(r => r.en_financement).length), color: undefined },
          { label: '📋 PO reçus',                     value: String(pipeline.filter(r => r.paiement_po).length), color: undefined },
        ].map(k => (
          <div key={k.label} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: k.color ?? 'white', lineHeight: 1 }}>{k.value}</div>
          </div>
        ))}
      </div>

    </div>
  );
}
