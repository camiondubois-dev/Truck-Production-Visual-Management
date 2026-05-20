// ════════════════════════════════════════════════════════════════
// VueBilanHebdo — Onglet "Bilan hebdomadaire"
// Tableau de bord stratégique hebdomadaire
// ════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

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
  const mon  = new Date(now); mon.setDate(now.getDate() - daysToMon); mon.setHours(0,0,0,0);
  const prev = new Date(mon); prev.setDate(mon.getDate() - 7);
  const fmt  = (d: Date) => d.toISOString().slice(0, 10);
  return { monday: fmt(mon), prevMonday: fmt(prev), today: fmt(now), monDate: mon };
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function labelSemaine(monday: Date): string {
  const vendredi = new Date(monday); vendredi.setDate(monday.getDate() + 4);
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
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

interface SoldeRow {
  id: string;
  date_saisie: string;
  solde: number;
  saisi_par?: string;
  notes?: string;
}

interface VenteWeekRow {
  date_vente: string;
  prix_vente: number;
  marge_profit: number;
  stock_numero: string;
  vehicule: string;
  client: string;
}

interface PieceWeekRow {
  sous_total: number;
  date_vente: string;
  vendeur?: string;
}

// ─── Sous-composants ───────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, marginTop: 28 }}>
      {children}
    </div>
  );
}

function KpiBox({ label, value, sub, color, delta }: { label: string; value: string; sub?: string; color?: string; delta?: string }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: color ?? 'white', lineHeight: 1 }}>{value}</div>
      {delta && (
        <div style={{ fontSize: 11, marginTop: 4, color: delta.startsWith('+') ? '#4ade80' : delta.startsWith('-') ? '#f87171' : 'rgba(255,255,255,0.4)' }}>
          {delta} vs sem. passée
        </div>
      )}
      {sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{sub}</div>}
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
  const { monday, prevMonday, today, monDate } = getWeekBounds();
  const fy = currentFY();

  // ── State ─────────────────────────────────────────────────────
  const [loading,       setLoading]       = useState(true);
  const [pipeline,      setPipeline]      = useState<PipelineRow[]>([]);
  const [partis,        setPartis]        = useState<PipelineRow[]>([]);
  const [ventesWeek,    setVentesWeek]    = useState<VenteWeekRow[]>([]);
  const [piecesWeek,    setPiecesWeek]    = useState<PieceWeekRow[]>([]);
  const [piecesPrev,    setPiecesPrev]    = useState<PieceWeekRow[]>([]);
  const [ytdVentes,     setYtdVentes]     = useState({ ca: 0, marge: 0, nb: 0 });
  const [ytdPieces,     setYtdPieces]     = useState({ ca: 0, nb: 0 });
  const [soldes,        setSoldes]        = useState<SoldeRow[]>([]);
  const [nouveauSolde,  setNouveauSolde]  = useState('');
  const [notesSolde,    setNotesSolde]    = useState('');
  const [savingSolde,   setSavingSolde]   = useState(false);
  const [vendeurs,      setVendeurs]      = useState<Record<string, string>>({}); // id → nom

  // ── Chargement ────────────────────────────────────────────────
  useEffect(() => { charger(); }, []);

  async function charger() {
    setLoading(true);
    try {
      // 1. Vendeurs (pour afficher le nom dans pipeline)
      const { data: vds } = await supabase.from('prod_vendeurs').select('id, nom');
      const vendMap: Record<string, string> = {};
      (vds ?? []).forEach((v: any) => { vendMap[v.id] = v.nom; });
      setVendeurs(vendMap);

      // 2. Pipeline opérationnel (réservé ou vendu, pas encore payé complet)
      const { data: invData } = await supabase
        .from('prod_inventaire')
        .select('id, numero, marque, modele, annee, etat_commercial, client_acheteur, vendeur_id, paiement_depot, paiement_complet, paiement_po, en_financement, montant_depot, date_depot, mode_paiement_depot, livraison_asap')
        .in('etat_commercial', ['reserve', 'vendu', 'location'])
        .in('type', ['eau', 'detail'])
        .eq('paiement_complet', false);

      // 3. Camions vendus et partis (paiement complet, ce mois)
      const { data: partisData } = await supabase
        .from('prod_inventaire')
        .select('id, numero, marque, modele, annee, etat_commercial, client_acheteur, vendeur_id, paiement_depot, paiement_complet, paiement_po, en_financement, montant_depot, date_depot, mode_paiement_depot, livraison_asap')
        .in('etat_commercial', ['vendu', 'location'])
        .in('type', ['eau', 'detail'])
        .eq('paiement_complet', true)
        .gte('updated_at', new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString());

      // 4. Prix demandé depuis prod_ventes (pour les camions du pipeline)
      const numeros = [...(invData ?? []), ...(partisData ?? [])].map((r: any) => r.numero);
      let prixMap: Record<string, number> = {};
      if (numeros.length > 0) {
        const { data: prixData } = await supabase
          .from('prod_ventes')
          .select('stock_numero, prix_demande')
          .in('stock_numero', numeros);
        (prixData ?? []).forEach((r: any) => {
          if (r.prix_demande) prixMap[r.stock_numero] = r.prix_demande;
        });
      }

      const toRow = (r: any): PipelineRow => ({
        ...r,
        vendeur_nom: r.vendeur_id ? vendMap[r.vendeur_id] : undefined,
        prix_demande: prixMap[r.numero],
        en_financement: r.en_financement ?? false,
      });

      setPipeline((invData ?? []).map(toRow));
      setPartis((partisData ?? []).map(toRow));

      // 5. Pièces cette semaine
      const { data: pwData } = await supabase
        .from('prod_ventes_pieces')
        .select('sous_total, date_vente, vendeur')
        .gte('date_vente', monday);
      setPiecesWeek(pwData ?? []);

      // 6. Pièces semaine passée
      const { data: ppData } = await supabase
        .from('prod_ventes_pieces')
        .select('sous_total, date_vente')
        .gte('date_vente', prevMonday)
        .lt('date_vente', monday);
      setPiecesPrev(ppData ?? []);

      // 7. Camions vendus financier cette semaine
      const { data: vwData } = await supabase
        .from('prod_rapport_profitabilite')
        .select('date_vente, prix_vente, marge_profit, stock_numero, vehicule, client')
        .gte('date_vente', monday);
      setVentesWeek(vwData ?? []);

      // 8. YTD Ventes financier
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

      // 9. YTD Pièces
      const { data: ytdPData } = await supabase
        .from('prod_ventes_pieces')
        .select('sous_total')
        .eq('annee_fiscale', fy);
      const ytdP = (ytdPData ?? []).reduce((acc: any, r: any) => ({
        ca: acc.ca + Math.max(r.sous_total, 0),
        nb: acc.nb + 1,
      }), { ca: 0, nb: 0 });
      setYtdPieces(ytdP);

      // 10. Soldes banque
      const { data: soldeData } = await supabase
        .from('prod_solde_banque')
        .select('*')
        .order('date_saisie', { ascending: false })
        .limit(5);
      setSoldes(soldeData ?? []);

    } catch (err) {
      console.error('[VueBilanHebdo] Erreur chargement:', err);
    } finally {
      setLoading(false);
    }
  }

  const sauvegarderSolde = async () => {
    const montant = parseFloat(nouveauSolde.replace(/\s/g, '').replace(/,/g, '.'));
    if (!montant) return;
    setSavingSolde(true);
    try {
      await supabase.from('prod_solde_banque').insert({
        date_saisie: today,
        solde: montant,
        notes: notesSolde || null,
      });
      setNouveauSolde('');
      setNotesSolde('');
      charger();
    } finally {
      setSavingSolde(false);
    }
  };

  // ── Calculs ───────────────────────────────────────────────────
  const piecesCA     = piecesWeek.reduce((s, r) => s + Math.max(r.sous_total, 0), 0);
  const piecesPrevCA = piecesPrev.reduce((s, r) => s + Math.max(r.sous_total, 0), 0);
  const piecesDelta  = piecesPrevCA > 0 ? ((piecesCA - piecesPrevCA) / piecesPrevCA * 100) : null;
  const ventesCA     = ventesWeek.reduce((s, r) => s + (r.prix_vente ?? 0), 0);
  const ventesMarge  = ventesWeek.reduce((s, r) => s + (r.marge_profit ?? 0), 0);

  // Pipeline argent à venir
  const argAVenir = pipeline.reduce((s, r) => {
    const prix = r.prix_demande ?? 0;
    const depot = r.paiement_depot ? (r.montant_depot ?? 0) : 0;
    return s + Math.max(prix - depot, 0);
  }, 0);
  const totalDepots = pipeline.filter(r => r.paiement_depot).reduce((s, r) => s + (r.montant_depot ?? 0), 0);

  const dernierSolde = soldes[0];
  const soldeProjete = dernierSolde ? dernierSolde.solde + argAVenir : null;

  const vendusPipeline   = pipeline.filter(r => r.etat_commercial === 'vendu' || r.etat_commercial === 'location');
  const reservesPipeline = pipeline.filter(r => r.etat_commercial === 'reserve');

  // ── Rendu ─────────────────────────────────────────────────────
  if (loading) {
    return <div style={{ padding: 40, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>⏳ Chargement…</div>;
  }

  const TH = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
    <th style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: right ? 'right' : 'left', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      {children}
    </th>
  );
  const TD = ({ children, right, bold, color }: { children: React.ReactNode; right?: boolean; bold?: boolean; color?: string }) => (
    <td style={{ padding: '10px 12px', fontSize: 13, textAlign: right ? 'right' : 'left', fontWeight: bold ? 700 : 400, color: color ?? 'rgba(255,255,255,0.85)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      {children}
    </td>
  );

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: 'white' }}>

      {/* ── En-tête semaine ────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>📅 BILAN HEBDOMADAIRE</div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>{labelSemaine(monDate)}</div>
      </div>

      {/* ── KPIs semaine ────────────────────────────────────────── */}
      <SectionTitle>📈 Cette semaine</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 8 }}>
        <KpiBox
          label="🔧 Pièces — CA brut"
          value={fmt$(piecesCA)}
          sub={`${piecesWeek.length} factures`}
          delta={piecesDelta != null ? fmtPct(piecesDelta) : undefined}
        />
        <KpiBox
          label="🚚 Camions vendus (système financier)"
          value={fmt$(ventesCA)}
          sub={`${ventesWeek.length} camion${ventesWeek.length !== 1 ? 's' : ''} · Marge ${fmt$(ventesMarge)}`}
          color={ventesCA > 0 ? '#4ade80' : 'white'}
        />
        <KpiBox
          label="💰 Total semaine"
          value={fmt$(piecesCA + ventesCA)}
          color="#f59e0b"
        />
        <KpiBox
          label="💵 Dépôts reçus cette semaine"
          value={fmt$(totalDepots)}
          sub={`${pipeline.filter(r => r.paiement_depot && r.date_depot && r.date_depot >= monday).length} dépôt(s)`}
        />
      </div>

      {/* Détail camions vendus cette semaine */}
      {ventesWeek.length > 0 && (
        <div style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: 10, padding: '12px 16px', marginTop: 8 }}>
          {ventesWeek.map(r => (
            <div key={r.stock_numero} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 12 }}>
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>#{r.stock_numero} — {r.vehicule} · {r.client}</span>
              <span style={{ fontWeight: 700, color: '#4ade80' }}>{fmt$(r.prix_vente)}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Solde compte banque ─────────────────────────────────── */}
      <SectionTitle>🏦 Solde compte banque</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        <KpiBox
          label={dernierSolde ? `Dernier solde · ${fmtDate(dernierSolde.date_saisie)}` : 'Aucun solde saisi'}
          value={dernierSolde ? fmt$(dernierSolde.solde) : '—'}
          sub={dernierSolde?.notes ?? undefined}
        />
        <KpiBox label="+ Argent à venir" value={fmt$(argAVenir)} color="#f59e0b" />
        <KpiBox label="= Solde projeté" value={fmt$(soldeProjete)} color="#4ade80" bold />
      </div>

      {/* Saisie nouveau solde */}
      <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 16, marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 10 }}>
          Saisir le solde de cette semaine
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="number" min="0" step="1000"
            value={nouveauSolde}
            onChange={e => setNouveauSolde(e.target.value)}
            placeholder="Solde du compte $"
            style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: 'white', fontSize: 14, outline: 'none' }}
          />
          <input
            type="text"
            value={notesSolde}
            onChange={e => setNotesSolde(e.target.value)}
            placeholder="Notes (optionnel)"
            style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: 13, outline: 'none' }}
          />
          <button onClick={sauvegarderSolde} disabled={!nouveauSolde || savingSolde}
            style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: nouveauSolde ? '#f59e0b' : 'rgba(255,255,255,0.1)', color: nouveauSolde ? 'white' : 'rgba(255,255,255,0.3)', fontWeight: 700, fontSize: 13, cursor: nouveauSolde ? 'pointer' : 'not-allowed' }}>
            {savingSolde ? '...' : '💾 Sauvegarder'}
          </button>
        </div>
        {/* Historique des 5 dernières saisies */}
        {soldes.length > 1 && (
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {soldes.slice(1).map(s => (
              <span key={s.id} style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.05)', padding: '3px 10px', borderRadius: 20 }}>
                {fmtDate(s.date_saisie)} → {fmt$(s.solde)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Pipeline — Argent à venir ────────────────────────────── */}
      <SectionTitle>💵 Argent à venir — Vendus non payés ({vendusPipeline.length})</SectionTitle>
      {vendusPipeline.length === 0 ? (
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, padding: '12px 0' }}>Aucun camion vendu en attente de paiement.</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
            <KpiBox label="Camions en attente" value={String(vendusPipeline.length)} />
            <KpiBox label="Dépôts reçus" value={fmt$(vendusPipeline.filter(r => r.paiement_depot).reduce((s, r) => s + (r.montant_depot ?? 0), 0))} />
            <KpiBox label="Total à recevoir" value={fmt$(argAVenir)} color="#f87171" bold />
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
        <KpiBox label="🚚 CA camions YTD"    value={fmt$(ytdVentes.ca)}    sub={`${ytdVentes.nb} camion${ytdVentes.nb !== 1 ? 's' : ''}`} />
        <KpiBox label="📈 Marge YTD"         value={fmt$(ytdVentes.marge)} color={ytdVentes.marge > 0 ? '#4ade80' : '#f87171'}
          sub={ytdVentes.ca > 0 ? `${(ytdVentes.marge / ytdVentes.ca * 100).toFixed(1)} %` : undefined} />
        <KpiBox label="🔧 Pièces YTD (brut)" value={fmt$(ytdPieces.ca)}   sub={`${ytdPieces.nb} factures`} />
        <KpiBox label="💰 Total revenus YTD" value={fmt$(ytdVentes.ca + ytdPieces.ca)} color="#f59e0b" bold />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <KpiBox label="🔒 En pipeline (vendus+réservés)" value={String(pipeline.length)} />
        <KpiBox label="💵 À recevoir (pipeline)"         value={fmt$(argAVenir)} color="#f87171" />
        <KpiBox label="🏦 Financement en cours"          value={String(pipeline.filter(r => r.en_financement).length)} />
        <KpiBox label="📋 PO reçus"                      value={String(pipeline.filter(r => r.paiement_po).length)} />
      </div>

    </div>
  );
}
