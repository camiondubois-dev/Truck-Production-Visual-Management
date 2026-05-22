// ════════════════════════════════════════════════════════════════
// Bilan Hebdomadaire — version Mobile (Finance app)
// Vue dense optimisée pour iPhone, scroll vertical, sections pliables,
// camions cliquables qui ouvrent un drawer détail.
// ════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const AMBER  = '#f59e0b';
const GREEN  = '#4ade80';
const RED    = '#f87171';
const PURPLE = '#a78bfa';
const BLUE   = '#60a5fa';
const CARD_BG = 'rgba(255,255,255,0.05)';
const BORDER  = 'rgba(255,255,255,0.08)';

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmt$ = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);

const fmtPct = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)} %`;

function getWeekBounds() {
  const now  = new Date();
  const dow  = now.getDay();
  const daysToMon = dow === 0 ? 6 : dow - 1;
  const mon  = new Date(now); mon.setDate(now.getDate() - daysToMon); mon.setHours(0, 0, 0, 0);
  const prev = new Date(mon); prev.setDate(mon.getDate() - 7);
  const fmt  = (d: Date) => d.toISOString().slice(0, 10);
  return {
    monday:     fmt(mon),
    prevMonday: fmt(prev),
    today:      fmt(now),
    monDate:    mon,
  };
}

function labelSemaine(d: Date) {
  const fin = new Date(d); fin.setDate(d.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return `${d.toLocaleDateString('fr-CA', opts)} → ${fin.toLocaleDateString('fr-CA', opts)}`;
}

function currentFY(): number {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PipelineRow {
  id: string;
  numero: string;
  marque: string | null;
  modele: string | null;
  annee: number | null;
  etat_commercial: string;
  client_acheteur: string | null;
  paiement_depot: boolean;
  paiement_po: boolean;
  en_financement: boolean;
  montant_depot: number | null;
  mode_paiement_depot: string | null;
  prix_demande: number | null;
}

interface PartiRow {
  stock_numero: string;
  date_vente: string | null;
  vehicule: string | null;
  marque: string | null;
  modele: string | null;
  annee: number | null;
  client: string | null;
  prix_vente: number | null;
  marge_profit: number | null;
  pct_profit: number | null;
}

interface LocationRow {
  id: string;
  stock_numero: string;
  client: string | null;
  date_debut: string;
  montant_mensuel: number;
  mois_ecoules: number;
  revenu_cumule: number;
}

interface DepotWeekRow {
  numero: string;
  marque: string | null;
  modele: string | null;
  annee: number | null;
  client_acheteur: string | null;
  montant_depot: number | null;
  date_depot: string | null;
  mode_paiement_depot: string | null;
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function TabBilanHebdoMobile() {
  const { monday, prevMonday, today, monDate } = getWeekBounds();
  const fy = currentFY();

  const [loading, setLoading] = useState(true);
  const [pipeline, setPipeline] = useState<PipelineRow[]>([]);
  const [partis, setPartis] = useState<PartiRow[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [depotsWeek, setDepotsWeek] = useState<DepotWeekRow[]>([]);
  const [piecesCAweek, setPiecesCAweek] = useState({ curr: 0, prev: 0, nbCurr: 0, nbPrev: 0 });
  const [ventesCAweek, setVentesCAweek] = useState({ curr: 0, prev: 0, margeCurr: 0, nbCurr: 0, nbPrev: 0 });
  const [depotsCAweek, setDepotsCAweek] = useState({ curr: 0, prev: 0, nbCurr: 0, nbPrev: 0 });
  const [ytd, setYtd] = useState({ caVentes: 0, margeVentes: 0, nbVentes: 0, caPieces: 0, nbPieces: 0 });

  // ─── Drawer (détail camion) ──
  // Le drawer fait son propre fetch (photo + coûts) à partir du stockNumero.
  // On lui passe juste le contexte initial (avec prix/depot connus du bilan).
  const [selectedCamion, setSelectedCamion] = useState<{
    stockNumero: string;
    contexte:    'pipeline' | 'parti' | 'location' | 'depot';
    initialInfo: Record<string, string | number | boolean | null>;
  } | null>(null);

  useEffect(() => { charger(); }, []);

  async function charger() {
    setLoading(true);
    try {
      const [pipeRes, partisRes, locsRes, depotsRes, piecesWres, piecesPres, ventesWres, ventesPres, ytdVres, ytdPres] = await Promise.all([
        // Pipeline
        supabase
          .from('prod_inventaire')
          .select('id, numero, marque, modele, annee, etat_commercial, client_acheteur, paiement_depot, paiement_po, en_financement, montant_depot, mode_paiement_depot')
          .in('type', ['eau', 'detail'])
          .eq('paiement_complet', false)
          .neq('etat_commercial', 'location')
          .or('etat_commercial.eq.reserve,etat_commercial.eq.vendu,paiement_depot.eq.true,paiement_po.eq.true,en_financement.eq.true'),
        // Vendus & payés (60j) — prod_rapport_profitabilite
        supabase
          .from('prod_rapport_profitabilite')
          .select('stock_numero, date_vente, vehicule, marque, modele, annee, client, prix_vente, marge_profit, pct_profit')
          .gte('date_vente', new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString().slice(0, 10))
          .order('date_vente', { ascending: false }),
        // Locations actives
        supabase
          .from('prod_locations_avec_cumul')
          .select('id, stock_numero, client, date_debut, montant_mensuel, mois_ecoules, revenu_cumule')
          .is('date_fin', null)
          .order('date_debut', { ascending: false }),
        // Dépôts reçus cette semaine
        supabase
          .from('prod_inventaire')
          .select('numero, marque, modele, annee, client_acheteur, montant_depot, date_depot, mode_paiement_depot')
          .eq('paiement_depot', true)
          .gte('date_depot', monday),
        // Pièces cette semaine
        supabase.from('prod_ventes_pieces').select('sous_total').gte('date_vente', monday),
        // Pièces semaine précédente
        supabase.from('prod_ventes_pieces').select('sous_total').gte('date_vente', prevMonday).lt('date_vente', monday),
        // Ventes camions cette semaine
        supabase.from('prod_rapport_profitabilite').select('prix_vente, marge_profit').gte('date_vente', monday),
        // Ventes camions semaine précédente
        supabase.from('prod_rapport_profitabilite').select('prix_vente, marge_profit').gte('date_vente', prevMonday).lt('date_vente', monday),
        // YTD ventes
        supabase.from('prod_rapport_profitabilite').select('prix_vente, marge_profit').eq('annee_fiscale', fy),
        // YTD pièces
        supabase.from('prod_ventes_pieces').select('sous_total').eq('annee_fiscale', fy),
      ]);

      setPipeline((pipeRes.data ?? []) as any);

      // Filtrer les ventes déjà finalisées (cohérence avec bilan desktop)
      const numerosPipeline = (pipeRes.data ?? []).map((r: any) => r.numero);
      let vendusFinalises = new Set<string>();
      if (numerosPipeline.length > 0) {
        const { data } = await supabase
          .from('prod_ventes')
          .select('stock_numero, statut')
          .in('stock_numero', numerosPipeline);
        for (const r of (data ?? []) as any[]) {
          if (r.statut === 'vendu') vendusFinalises.add(r.stock_numero);
        }
        setPipeline(prev => prev.filter(r => !vendusFinalises.has(r.numero)));
      }

      setPartis((partisRes.data ?? []) as any);
      setLocations((locsRes.data ?? []) as any);
      setDepotsWeek((depotsRes.data ?? []) as any);

      const sumPieces = (rows: any[]) => rows.reduce((s, r) => s + Math.max(r.sous_total, 0), 0);
      setPiecesCAweek({
        curr: sumPieces(piecesWres.data ?? []),
        prev: sumPieces(piecesPres.data ?? []),
        nbCurr: (piecesWres.data ?? []).length,
        nbPrev: (piecesPres.data ?? []).length,
      });

      const sumVentes = (rows: any[]) => rows.reduce((s, r) => s + (r.prix_vente ?? 0), 0);
      const sumMarge  = (rows: any[]) => rows.reduce((s, r) => s + (r.marge_profit ?? 0), 0);
      setVentesCAweek({
        curr: sumVentes(ventesWres.data ?? []),
        prev: sumVentes(ventesPres.data ?? []),
        margeCurr: sumMarge(ventesWres.data ?? []),
        nbCurr: (ventesWres.data ?? []).length,
        nbPrev: (ventesPres.data ?? []).length,
      });

      // Dépôts cette semaine vs précédente (recalcul depuis dates)
      const sumDepotsCurr = (depotsRes.data ?? []).reduce((s, r) => s + (r.montant_depot ?? 0), 0);
      // Pour la semaine préc., refaire un fetch — léger
      const { data: depotsPrev } = await supabase
        .from('prod_inventaire')
        .select('montant_depot')
        .eq('paiement_depot', true)
        .gte('date_depot', prevMonday).lt('date_depot', monday);
      setDepotsCAweek({
        curr: sumDepotsCurr,
        prev: (depotsPrev ?? []).reduce((s, r: any) => s + (r.montant_depot ?? 0), 0),
        nbCurr: (depotsRes.data ?? []).length,
        nbPrev: (depotsPrev ?? []).length,
      });

      // YTD
      setYtd({
        caVentes:    sumVentes(ytdVres.data ?? []),
        margeVentes: sumMarge(ytdVres.data ?? []),
        nbVentes:    (ytdVres.data ?? []).length,
        caPieces:    sumPieces(ytdPres.data ?? []),
        nbPieces:    (ytdPres.data ?? []).length,
      });
    } catch (e) {
      console.error('[BilanHebdoMobile]', e);
    } finally {
      setLoading(false);
    }
  }

  // ─── Calculs ──
  const delta = (curr: number, prev: number) =>
    prev > 0 ? (curr - prev) / prev * 100 : null;

  // Revenu location cette semaine (prorata)
  const calcLocSemaine = (d1s: string, d2s: string) => {
    const d1 = new Date(d1s).getTime();
    const d2 = new Date(d2s).getTime();
    return locations.reduce((s, l) => {
      const debutContrat = new Date(l.date_debut).getTime();
      const debutInter = Math.max(debutContrat, d1);
      const finInter   = d2;
      if (finInter <= debutInter) return s;
      const jours = (finInter - debutInter) / (1000 * 60 * 60 * 24);
      return s + (l.montant_mensuel * jours / 30);
    }, 0);
  };
  const locCAweek      = calcLocSemaine(monday, today);
  const locCApreviousW = calcLocSemaine(prevMonday, monday);
  const locCumuleTotal = locations.reduce((s, l) => s + (l.revenu_cumule ?? 0), 0);

  // TOTAL semaine
  const totalSemaine = piecesCAweek.curr + ventesCAweek.curr + depotsCAweek.curr + locCAweek;
  const totalSemainePrev = piecesCAweek.prev + ventesCAweek.prev + depotsCAweek.prev + locCApreviousW;
  const deltaTotal = delta(totalSemaine, totalSemainePrev);

  // Pipeline
  const totalSoldeAVenir = pipeline.reduce((s, r) => {
    const prix = r.prix_demande ?? 0;
    const dep  = r.paiement_depot ? (r.montant_depot ?? 0) : 0;
    return s + Math.max(prix - dep, 0);
  }, 0);
  const totalDepotsPipeline = pipeline.reduce((s, r) => s + (r.paiement_depot ? (r.montant_depot ?? 0) : 0), 0);

  // Partis (60j)
  const totalCAvendus60j = partis.reduce((s, r) => s + (r.prix_vente ?? 0), 0);
  const totalMargeVendus60j = partis.reduce((s, r) => s + (r.marge_profit ?? 0), 0);

  // ─── Récupérer prix_demande pour les camions du pipeline ──
  const [pricesMap, setPricesMap] = useState<Record<string, number>>({});
  useEffect(() => {
    if (pipeline.length === 0) return;
    const stocks = pipeline.map(p => p.numero);
    supabase
      .from('prod_ventes')
      .select('stock_numero, prix_demande')
      .in('stock_numero', stocks)
      .then(({ data }) => {
        const map: Record<string, number> = {};
        for (const r of (data ?? []) as any[]) {
          if (r.prix_demande) map[r.stock_numero] = r.prix_demande;
        }
        setPricesMap(map);
      });
  }, [pipeline.length]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
        Chargement du bilan…
      </div>
    );
  }

  // ─── Drawer helpers : ouvre un camion avec son contexte ──
  const ouvrirPipelineRow = (r: PipelineRow) => {
    const prix = pricesMap[r.numero] ?? r.prix_demande ?? null;
    const depot = r.paiement_depot ? (r.montant_depot ?? 0) : 0;
    setSelectedCamion({
      stockNumero: r.numero,
      contexte: 'pipeline',
      initialInfo: {
        client:         r.client_acheteur,
        etat_commercial: r.etat_commercial,
        prix_demande:   prix,
        montant_depot:  depot,
        mode_paiement_depot: r.mode_paiement_depot,
        paiement_po:    r.paiement_po,
        en_financement: r.en_financement,
        marque: r.marque, modele: r.modele, annee: r.annee,
      },
    });
  };

  const ouvrirParti = (r: PartiRow) => {
    setSelectedCamion({
      stockNumero: r.stock_numero,
      contexte: 'parti',
      initialInfo: {
        client:      r.client,
        date_vente:  r.date_vente,
        prix_vente:  r.prix_vente,
        marge_profit: r.marge_profit,
        pct_profit:  r.pct_profit,
        vehicule:    r.vehicule,
        marque: r.marque, modele: r.modele, annee: r.annee,
      },
    });
  };

  const ouvrirLocation = (l: LocationRow) => {
    setSelectedCamion({
      stockNumero: l.stock_numero,
      contexte: 'location',
      initialInfo: {
        client:          l.client,
        date_debut:      l.date_debut,
        montant_mensuel: l.montant_mensuel,
        mois_ecoules:    l.mois_ecoules,
        revenu_cumule:   l.revenu_cumule,
      },
    });
  };

  const ouvrirDepotW = (d: DepotWeekRow) => {
    setSelectedCamion({
      stockNumero: d.numero,
      contexte: 'depot',
      initialInfo: {
        client:        d.client_acheteur,
        montant_depot: d.montant_depot,
        date_depot:    d.date_depot,
        mode_paiement: d.mode_paiement_depot,
        marque: d.marque, modele: d.modele, annee: d.annee,
      },
    });
  };

  // ─── Rendu ──
  return (
    <div style={{ padding: '12px 14px 80px', maxWidth: 600, margin: '0 auto' }}>

      {/* ── HERO : Total cette semaine ── */}
      <div style={{
        background: `linear-gradient(135deg, ${AMBER}22 0%, ${AMBER}08 100%)`,
        border: `1px solid ${AMBER}44`,
        borderRadius: 18, padding: 20, marginBottom: 16,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em', marginBottom: 4 }}>
          💰 TOTAL ARGENT REÇU
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>
          {labelSemaine(monDate)}
        </div>
        <div style={{ fontSize: 38, fontWeight: 900, color: AMBER, lineHeight: 1, letterSpacing: '-0.02em' }}>
          {fmt$(totalSemaine)}
        </div>
        {deltaTotal != null && (
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 8, color: deltaTotal >= 0 ? GREEN : RED }}>
            {deltaTotal >= 0 ? '▲' : '▼'} {fmtPct(deltaTotal)} vs sem. préc. ({fmt$(totalSemainePrev)})
          </div>
        )}
      </div>

      {/* ── Cartes comparaison hebdo ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        <MiniCard
          icon="🔧" label="Pièces"
          curr={piecesCAweek.curr} prev={piecesCAweek.prev}
          sub={`${piecesCAweek.nbCurr} fact.`} color={GREEN}
        />
        <MiniCard
          icon="🚚" label="Camions vendus"
          curr={ventesCAweek.curr} prev={ventesCAweek.prev}
          sub={ventesCAweek.nbCurr > 0 ? `${ventesCAweek.nbCurr} · Marge ${fmt$(ventesCAweek.margeCurr)}` : '0 camion'} color={GREEN}
        />
        <MiniCard
          icon="💵" label="Dépôts reçus"
          curr={depotsCAweek.curr} prev={depotsCAweek.prev}
          sub={`${depotsCAweek.nbCurr} dépôt${depotsCAweek.nbCurr > 1 ? 's' : ''}`} color={AMBER}
        />
        <MiniCard
          icon="🔁" label="Locations"
          curr={locCAweek} prev={locCApreviousW}
          sub={locations.length > 0 ? `${locations.length} contrat${locations.length > 1 ? 's' : ''}` : 'Aucun contrat'} color={PURPLE}
        />
      </div>

      {/* ── Dépôts reçus cette semaine (cliquable) ── */}
      {depotsWeek.length > 0 && (
        <SectionRepliable titre="💵 Dépôts reçus cette semaine" badge={`${depotsWeek.length}`} couleur={AMBER}>
          {depotsWeek.map(d => (
            <CarteCamion
              key={d.numero}
              onClick={() => ouvrirDepotW(d)}
              titre={`#${d.numero}`}
              titreCouleur={AMBER}
              sousTitre={[d.annee, d.marque, d.modele].filter(Boolean).join(' ') || '—'}
              ligne1={d.client_acheteur ?? '—'}
              droite={fmt$(d.montant_depot)}
              droiteCouleur={AMBER}
              droiteSousTexte={d.mode_paiement_depot ?? '—'}
            />
          ))}
        </SectionRepliable>
      )}

      {/* ── Pipeline ── */}
      {pipeline.length > 0 && (
        <SectionRepliable titre="📦 Argent à venir" badge={`${pipeline.length}`} couleur={RED}
          resume={[
            { label: 'Solde total', value: fmt$(totalSoldeAVenir), color: RED },
            { label: 'Dépôts',      value: fmt$(totalDepotsPipeline), color: AMBER },
          ]}
        >
          {pipeline.map(r => {
            const prix = pricesMap[r.numero] ?? r.prix_demande ?? null;
            const dep  = r.paiement_depot ? (r.montant_depot ?? 0) : 0;
            const solde = prix != null ? Math.max(prix - dep, 0) : null;
            const statusLabel = r.paiement_depot ? 'Dépôt' : r.paiement_po ? 'PO' : r.en_financement ? 'Financement' : r.etat_commercial === 'reserve' ? 'Réservé' : 'En attente';
            const statusColor = r.paiement_depot ? AMBER : r.paiement_po ? GREEN : r.en_financement ? BLUE : 'rgba(255,255,255,0.4)';
            return (
              <CarteCamion
                key={r.id}
                onClick={() => ouvrirPipelineRow(r)}
                titre={`#${r.numero}`}
                titreCouleur={AMBER}
                sousTitre={[r.annee, r.marque, r.modele].filter(Boolean).join(' ') || '—'}
                ligne1={r.client_acheteur ?? '—'}
                badge={{ label: statusLabel, color: statusColor }}
                droite={fmt$(solde)}
                droiteCouleur={RED}
                droiteSousTexte={dep > 0 ? `dépôt ${fmt$(dep)}` : `prix ${fmt$(prix)}`}
              />
            );
          })}
        </SectionRepliable>
      )}

      {/* ── Locations en cours ── */}
      {locations.length > 0 && (
        <SectionRepliable titre="🔁 Locations en cours" badge={`${locations.length}`} couleur={PURPLE}
          resume={[
            { label: 'Mensuel',  value: fmt$(locations.reduce((s, l) => s + l.montant_mensuel, 0)), color: PURPLE },
            { label: 'Cumulé',   value: fmt$(locCumuleTotal), color: GREEN },
          ]}
        >
          {locations.map(l => (
            <CarteCamion
              key={l.id}
              onClick={() => ouvrirLocation(l)}
              titre={`#${l.stock_numero}`}
              titreCouleur={PURPLE}
              sousTitre={l.client ?? '—'}
              ligne1={`Depuis ${l.date_debut} · ${l.mois_ecoules} mois`}
              droite={fmt$(l.revenu_cumule)}
              droiteCouleur={GREEN}
              droiteSousTexte={`${fmt$(l.montant_mensuel)}/mois`}
            />
          ))}
        </SectionRepliable>
      )}

      {/* ── Vendus & payés (60j) ── */}
      {partis.length > 0 && (
        <SectionRepliable titre="✅ Vendus & payés (60j)" badge={`${partis.length}`} couleur={GREEN}
          defaultOuvert={false}
          resume={[
            { label: 'CA',     value: fmt$(totalCAvendus60j), color: GREEN },
            { label: 'Marge',  value: fmt$(totalMargeVendus60j), color: totalMargeVendus60j >= 0 ? GREEN : RED },
          ]}
        >
          {partis.map(r => {
            const margeColor = (r.marge_profit ?? 0) >= 0 ? GREEN : RED;
            return (
              <CarteCamion
                key={r.stock_numero}
                onClick={() => ouvrirParti(r)}
                titre={`#${r.stock_numero}`}
                titreCouleur={GREEN}
                sousTitre={r.vehicule ?? [r.annee, r.marque, r.modele].filter(Boolean).join(' ') ?? '—'}
                ligne1={r.client ?? '—'}
                ligne2={r.date_vente ?? ''}
                droite={fmt$(r.prix_vente)}
                droiteCouleur={GREEN}
                droiteSousTexte={
                  r.marge_profit != null
                    ? `Marge ${fmt$(r.marge_profit)} (${r.pct_profit?.toFixed(1)} %)`
                    : '—'
                }
                droiteSousCouleur={margeColor}
              />
            );
          })}
        </SectionRepliable>
      )}

      {/* ── YTD (Année fiscale) ── */}
      <div style={{
        background: CARD_BG, border: `1px solid ${BORDER}`,
        borderRadius: 14, padding: 16, marginBottom: 16,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.06em', marginBottom: 12 }}>
          📊 ANNÉE FISCALE {fy} — À CE JOUR
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <YtdCell label="🚚 CA camions" value={fmt$(ytd.caVentes)} sub={`${ytd.nbVentes} camions`} />
          <YtdCell label="📈 Marge" value={fmt$(ytd.margeVentes)} sub={ytd.caVentes > 0 ? `${(ytd.margeVentes / ytd.caVentes * 100).toFixed(1)} %` : undefined} color={ytd.margeVentes >= 0 ? GREEN : RED} />
          <YtdCell label="🔧 Pièces" value={fmt$(ytd.caPieces)} sub={`${ytd.nbPieces} factures`} />
          <YtdCell label="💰 Total" value={fmt$(ytd.caVentes + ytd.caPieces)} bold color={AMBER} />
        </div>
      </div>

      {/* ── Drawer détail camion ── */}
      {selectedCamion && (
        <DrawerCamion data={selectedCamion} onClose={() => setSelectedCamion(null)} />
      )}
    </div>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function MiniCard({ icon, label, curr, prev, sub, color }: {
  icon: string; label: string; curr: number; prev: number; sub: string; color: string;
}) {
  const deltaPct = prev > 0 ? (curr - prev) / prev * 100 : null;
  return (
    <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
        <span style={{ marginRight: 4 }}>{icon}</span>{label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 900, color: curr > 0 ? color : 'rgba(255,255,255,0.35)', lineHeight: 1.1, marginBottom: 4 }}>
        {fmt$(curr)}
      </div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{sub}</div>
      {deltaPct != null && (
        <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4, color: deltaPct >= 0 ? GREEN : RED }}>
          {deltaPct >= 0 ? '▲' : '▼'} {fmtPct(deltaPct)}
        </div>
      )}
    </div>
  );
}

function SectionRepliable({
  titre, badge, couleur, children, resume, defaultOuvert,
}: {
  titre: string; badge: string; couleur: string; children: React.ReactNode;
  resume?: Array<{ label: string; value: string; color?: string }>;
  defaultOuvert?: boolean;
}) {
  const [ouvert, setOuvert] = useState(defaultOuvert ?? true);
  return (
    <div style={{
      background: CARD_BG, border: `1px solid ${BORDER}`,
      borderRadius: 14, marginBottom: 14, overflow: 'hidden',
    }}>
      <button
        onClick={() => setOuvert(o => !o)}
        style={{
          width: '100%', padding: '14px 16px', background: 'transparent', border: 'none',
          color: 'white', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          fontFamily: 'inherit',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {titre}
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 10,
            background: `${couleur}22`, color: couleur, flexShrink: 0,
          }}>{badge}</span>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
          {ouvert ? '▼' : '▶'}
        </span>
      </button>

      {/* Résumé visible même replié */}
      {resume && resume.length > 0 && (
        <div style={{
          display: 'flex', gap: 14, padding: '0 16px 12px',
          flexWrap: 'wrap', borderTop: ouvert ? 'none' : '1px solid rgba(255,255,255,0.05)',
        }}>
          {resume.map(r => (
            <div key={r.label}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>{r.label}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: r.color ?? 'white' }}>{r.value}</div>
            </div>
          ))}
        </div>
      )}

      {ouvert && (
        <div style={{ padding: '4px 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {children}
        </div>
      )}
    </div>
  );
}

function CarteCamion({
  titre, titreCouleur, sousTitre, ligne1, ligne2, droite, droiteCouleur, droiteSousTexte, droiteSousCouleur, badge, onClick,
}: {
  titre: string; titreCouleur: string; sousTitre: string;
  ligne1: string; ligne2?: string;
  droite: string; droiteCouleur: string; droiteSousTexte?: string; droiteSousCouleur?: string;
  badge?: { label: string; color: string };
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 10, padding: '10px 12px',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: 10, cursor: onClick ? 'pointer' : 'default',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: titreCouleur }}>{titre}</span>
          {badge && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 6,
              background: `${badge.color}22`, color: badge.color,
            }}>{badge.label}</span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {sousTitre}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {ligne1}
          {ligne2 && <span style={{ marginLeft: 6, color: 'rgba(255,255,255,0.3)' }}>· {ligne2}</span>}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: droiteCouleur }}>{droite}</div>
        {droiteSousTexte && (
          <div style={{ fontSize: 10, color: droiteSousCouleur ?? 'rgba(255,255,255,0.4)', marginTop: 2 }}>
            {droiteSousTexte}
          </div>
        )}
      </div>
    </div>
  );
}

function YtdCell({ label, value, sub, color, bold }: {
  label: string; value: string; sub?: string; color?: string; bold?: boolean;
}) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: bold ? 18 : 16, fontWeight: bold ? 900 : 800, color: color ?? 'white' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

/** Fiche complète d'un camion : photo + identité + coûts + section contextuelle */
function DrawerCamion({ data, onClose }: {
  data: {
    stockNumero: string;
    contexte: 'pipeline' | 'parti' | 'location' | 'depot';
    initialInfo: Record<string, any>;
  };
  onClose: () => void;
}) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [identite, setIdentite] = useState<{
    marque: string | null; modele: string | null; annee: number | null;
    type: string | null; variante: string | null;
    date_achat: string | null; date_vva: string | null;
    client_acheteur: string | null;
  } | null>(null);
  const [couts, setCouts] = useState<{
    prix_achat_reel: number | null;
    cout_total_depense: number | null;  // total M.O. dépensée
    cout_achat: number | null;
    prix_demande: number | null;
    age_jours: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [photoRes, identRes, coutsRes] = await Promise.all([
        supabase.from('prod_inventaire').select('photo_url').eq('numero', data.stockNumero).maybeSingle(),
        supabase.from('prod_inventaire')
          .select('marque, modele, annee, type, variante, date_achat, date_vva, client_acheteur')
          .eq('numero', data.stockNumero).maybeSingle(),
        supabase.from('prod_inventaire_couts')
          .select('prix_achat_reel, cout_total_depense, cout_achat, prix_demande, age_jours')
          .eq('stock_numero', data.stockNumero).maybeSingle(),
      ]);
      if (cancelled) return;
      setPhoto((photoRes.data as any)?.photo_url ?? null);
      setIdentite(identRes.data as any);
      setCouts(coutsRes.data as any);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [data.stockNumero]);

  // ─── Calculs financiers ──
  const prixAchat   = couts?.prix_achat_reel    ?? couts?.cout_achat ?? 0;
  const mo          = couts?.cout_total_depense ?? 0;
  const totalInvesti = prixAchat + mo;
  const prixDemande = couts?.prix_demande ?? (data.initialInfo.prix_demande as number | null) ?? null;
  const prixVente   = (data.initialInfo.prix_vente as number | null) ?? null;
  const margeReelle = prixVente != null ? prixVente - totalInvesti : null;
  const margeProj   = prixDemande != null ? prixDemande - totalInvesti : null;
  const pctReel     = prixVente != null && prixVente > 0 && margeReelle != null ? (margeReelle / prixVente) * 100 : null;
  const pctProj     = prixDemande != null && prixDemande > 0 && margeProj != null ? (margeProj / prixDemande) * 100 : null;

  // Solde à venir (pipeline)
  const montantDepot = (data.initialInfo.montant_depot as number | null) ?? 0;
  const soldeAVenir  = prixDemande != null ? Math.max(prixDemande - montantDepot, 0) : null;

  // ─── Construction du label titre ──
  const annee  = identite?.annee  ?? data.initialInfo.annee  ?? null;
  const marque = identite?.marque ?? data.initialInfo.marque ?? null;
  const modele = identite?.modele ?? data.initialInfo.modele ?? null;
  const titre = [annee, marque, modele].filter(Boolean).join(' ') || 'Camion';

  const ctxColor = data.contexte === 'pipeline' ? RED : data.contexte === 'parti' ? GREEN : data.contexte === 'location' ? PURPLE : AMBER;
  const ctxLabel = data.contexte === 'pipeline' ? 'EN ATTENTE DE PAIEMENT' : data.contexte === 'parti' ? 'VENDU & PAYÉ' : data.contexte === 'location' ? 'EN LOCATION' : 'DÉPÔT REÇU';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'flex-end',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', background: '#1a1a2e',
          borderRadius: '20px 20px 0 0',
          maxHeight: '92vh', overflowY: 'auto',
          color: 'white',
        }}
      >
        {/* Poignée */}
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)', margin: '10px auto 0' }} />

        {/* Photo */}
        {photo ? (
          <img src={photo} alt={titre} style={{
            width: '100%', height: 200, objectFit: 'cover',
            marginTop: 10,
          }} />
        ) : (
          <div style={{
            width: '100%', height: 100, marginTop: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.2)', fontSize: 13, background: 'rgba(255,255,255,0.02)',
          }}>
            📷 Aucune photo
          </div>
        )}

        <div style={{ padding: '16px 20px 32px' }}>
          {/* Bouton fermer flottant */}
          <button onClick={onClose} style={{
            position: 'absolute', top: 24, right: 16,
            width: 36, height: 36, borderRadius: '50%', border: 'none',
            background: 'rgba(0,0,0,0.5)', color: 'white',
            cursor: 'pointer', fontSize: 16, zIndex: 1,
            backdropFilter: 'blur(8px)',
          }}>✕</button>

          {/* En-tête : badge contexte + numero + titre */}
          <div style={{
            display: 'inline-block', fontSize: 10, fontWeight: 800, letterSpacing: '0.05em',
            background: `${ctxColor}22`, color: ctxColor,
            padding: '4px 10px', borderRadius: 8, marginBottom: 10,
          }}>
            {ctxLabel}
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: AMBER, lineHeight: 1, marginBottom: 4 }}>
            #{data.stockNumero}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: 16 }}>
            {titre}
          </div>

          {loading ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
              Chargement des détails…
            </div>
          ) : (
            <>
              {/* ─── Identité ── */}
              <Section titre="Identité">
                <Ligne label="Client / Acheteur" value={
                  (data.initialInfo.client as string | null) ??
                  identite?.client_acheteur ?? '—'
                } bold />
                {identite?.type && <Ligne label="Type" value={identite.type} />}
                {identite?.variante && <Ligne label="Variante" value={identite.variante} />}
                {identite?.date_achat && <Ligne label="Date achat" value={identite.date_achat.slice(0, 10)} />}
                {couts?.age_jours != null && (
                  <Ligne label="Âge en inventaire" value={`${couts.age_jours} j`}
                    color={couts.age_jours <= 60 ? GREEN : couts.age_jours <= 120 ? AMBER : RED} />
                )}
              </Section>

              {/* ─── Coûts ── */}
              <Section titre="Coûts (depuis la base)">
                <Ligne label="Prix d'achat réel" value={fmt$(prixAchat)} />
                <Ligne label="Coût M.O. dépensé" value={fmt$(mo)} color={mo > 0 ? AMBER : undefined} />
                <Ligne label="TOTAL INVESTI" value={fmt$(totalInvesti)} bold />
              </Section>

              {/* ─── Section contextuelle ── */}
              {data.contexte === 'pipeline' && (
                <Section titre="Vente en attente">
                  <Ligne label="État commercial" value={String(data.initialInfo.etat_commercial ?? '—').toUpperCase()} />
                  <Ligne label="Prix demandé" value={fmt$(prixDemande)} bold />
                  <Ligne label="Dépôt reçu"
                    value={montantDepot > 0 ? fmt$(montantDepot) : '—'}
                    color={montantDepot > 0 ? AMBER : undefined}
                    bold={montantDepot > 0}
                  />
                  {data.initialInfo.mode_paiement_depot && (
                    <Ligne label="Mode paiement" value={String(data.initialInfo.mode_paiement_depot)} />
                  )}
                  <Ligne label="PO reçu" value={data.initialInfo.paiement_po ? '✅ Oui' : 'Non'} />
                  <Ligne label="En financement" value={data.initialInfo.en_financement ? '✅ Oui' : 'Non'} />
                  <Ligne label="SOLDE À VENIR" value={fmt$(soldeAVenir)} color={RED} bold />
                  {margeProj != null && (
                    <>
                      <Ligne label="Marge projetée" value={fmt$(margeProj)} color={margeProj >= 0 ? GREEN : RED} bold />
                      {pctProj != null && (
                        <Ligne label="% marge projetée" value={`${pctProj.toFixed(1)} %`}
                          color={pctProj >= 10 ? GREEN : pctProj >= 5 ? AMBER : RED} />
                      )}
                    </>
                  )}
                </Section>
              )}

              {data.contexte === 'parti' && (
                <Section titre="Vente finalisée">
                  <Ligne label="Date vente" value={String(data.initialInfo.date_vente ?? '—')} />
                  <Ligne label="Prix de vente" value={fmt$(prixVente)} color={GREEN} bold />
                  <Ligne label="Marge réelle" value={fmt$(margeReelle ?? data.initialInfo.marge_profit as number)}
                    color={((margeReelle ?? (data.initialInfo.marge_profit as number)) ?? 0) >= 0 ? GREEN : RED} bold />
                  {(pctReel ?? data.initialInfo.pct_profit) != null && (
                    <Ligne label="% marge réelle"
                      value={`${((pctReel ?? data.initialInfo.pct_profit) as number).toFixed(1)} %`}
                      color={((pctReel ?? data.initialInfo.pct_profit) as number) >= 10 ? GREEN : ((pctReel ?? data.initialInfo.pct_profit) as number) >= 5 ? AMBER : RED}
                    />
                  )}
                </Section>
              )}

              {data.contexte === 'location' && (
                <Section titre="Contrat de location">
                  <Ligne label="Date début" value={String(data.initialInfo.date_debut)} />
                  <Ligne label="Montant mensuel" value={fmt$(data.initialInfo.montant_mensuel as number)} color={PURPLE} bold />
                  <Ligne label="Mois écoulés" value={String(data.initialInfo.mois_ecoules)} />
                  <Ligne label="Revenu cumulé" value={fmt$(data.initialInfo.revenu_cumule as number)} color={GREEN} bold />
                  {prixDemande != null && (
                    <Ligne label="Prix demandé (si vendu)" value={fmt$(prixDemande)} />
                  )}
                </Section>
              )}

              {data.contexte === 'depot' && (
                <Section titre="Dépôt reçu">
                  <Ligne label="Montant" value={fmt$(data.initialInfo.montant_depot as number)} color={AMBER} bold />
                  <Ligne label="Date" value={String(data.initialInfo.date_depot ?? '—')} />
                  <Ligne label="Mode paiement" value={String(data.initialInfo.mode_paiement ?? '—')} />
                  {prixDemande != null && (
                    <>
                      <Ligne label="Prix demandé total" value={fmt$(prixDemande)} bold />
                      <Ligne label="Solde restant" value={fmt$(Math.max(prixDemande - (data.initialInfo.montant_depot as number ?? 0), 0))} color={RED} bold />
                    </>
                  )}
                </Section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
        color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase',
        marginBottom: 8,
      }}>{titre}</div>
      <div style={{
        background: 'rgba(255,255,255,0.04)', borderRadius: 10,
        padding: '4px 12px',
      }}>
        {children}
      </div>
    </div>
  );
}

function Ligne({ label, value, color, bold }: {
  label: string; value: string; color?: string; bold?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{label}</span>
      <span style={{
        fontSize: bold ? 15 : 13,
        fontWeight: bold ? 800 : 600,
        color: color ?? 'white',
        textAlign: 'right',
      }}>{value}</span>
    </div>
  );
}
