// ════════════════════════════════════════════════════════════════
// VueMainOeuvre — Analytics du module Main-d'œuvre
// (rendu comme sous-onglet de Profitabilité)
//
// 4 sections empilées :
//   1. KPIs globaux (période choisie)
//   2. Top employés (heures + coût)
//   3. Par Work Order (profit calculé)
//   4. Par camion (cumul heures + coût M.O. réel)
// ════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { canSeeEmployesDetails } from '../lib/permissions';
import {
  employeService, workOrderService, heuresService,
  periodeBounds, type PreriodeOption,
  type Employe, type WoCoutMo, type HeureEmploye,
} from '../services/mainOeuvreService';
import {
  getAgendrixSemaines, getAgendrixAnalyse, getAgendrixCoutPeriode,
  type AgendrixAnalyseEmploye,
} from '../services/agendrixImportService';
import { supabase } from '../lib/supabase';

/** Test si un texte ressemble à un vrai numéro de stock de camion */
const estVraiStockCamion = (s: string | null | undefined): boolean =>
  !!s && /^\d{4,}$/.test(s.trim());

// ─── Helpers d'affichage ──────────────────────────────────────────

const fmt$ = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);
const fmtH = (n: number | null | undefined) =>
  n == null ? '—' : `${new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 1 }).format(n)} h`;

// Taux de facturation interne M.O. ($/h utilisé pour calculer le revenu WO interne)
const TAUX_MO_FACTURATION = 140;

// Style : reste cohérent avec la palette dark de Profitabilité
const C = {
  bg:        '#0f0e0b',
  card:      'rgba(255,255,255,0.04)',
  border:    'rgba(255,255,255,0.08)',
  text:      'white',
  muted:     'rgba(255,255,255,0.5)',
  faded:     'rgba(255,255,255,0.3)',
  amber:     '#f59e0b',
  green:     '#22c55e',
  red:       '#ef4444',
  blue:      '#60a5fa',
  purple:    '#a78bfa',
};

// ─── Composant principal ──────────────────────────────────────────

export function VueMainOeuvre() {
  const { profile } = useAuth();
  const peutVoirDetailEmploye = canSeeEmployesDetails(profile);
  const [onglet,     setOnglet]     = useState<'itrack' | 'agendrix'>('itrack');
  const [periode,    setPeriode]    = useState<PreriodeOption>('semaine_passee');
  const [loading,         setLoading]         = useState(true);
  const [employes,        setEmployes]        = useState<Employe[]>([]);
  const [woCouts,         setWoCouts]         = useState<WoCoutMo[]>([]);
  const [heures,          setHeures]          = useState<HeureEmploye[]>([]);
  const [filtreType,      setFiltreType]      = useState<'tous' | 'interne' | 'externe'>('tous');
  const [coutAgendrix,    setCoutAgendrix]    = useState<{ cout: number; coutAvecCharges: number; nbSemaines: number } | null>(null);
  // Metadata camions + moteurs (marque/modèle/année + statut vendu)
  type MetaEntry = { marque: string | null; modele: string | null; annee: number | null; vendu: boolean; type: 'camion' | 'moteur' };
  const [invMeta, setInvMeta] = useState<Record<string, MetaEntry>>({});

  const bounds = useMemo(() => periodeBounds(periode), [periode]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [emps, wos, hrs, coutAg] = await Promise.all([
          employeService.getAll(),
          workOrderService.getCoutsByWo(),
          heuresService.getAll(bounds.from ?? undefined, bounds.to ?? undefined),
          getAgendrixCoutPeriode(bounds.from, bounds.to),
        ]);
        setCoutAgendrix(coutAg);
        setEmployes(emps);
        setWoCouts(wos);
        setHeures(hrs);

        // Fetch métadonnées camion + moteur pour toutes les références internes
        const refsInternes = Array.from(new Set(
          wos.filter(w => w.type === 'interne' && w.stockNumero).map(w => w.stockNumero!)
        ));
        const stocksValides = refsInternes.filter(estVraiStockCamion);

        if (refsInternes.length > 0) {
          const [invRes, venRes, motRes] = await Promise.all([
            stocksValides.length > 0
              ? supabase.from('prod_inventaire').select('numero, marque, modele, annee, etat_commercial').in('numero', stocksValides)
              : Promise.resolve({ data: [] as any[] }),
            stocksValides.length > 0
              ? supabase.from('prod_ventes').select('stock_numero, statut').in('stock_numero', stocksValides)
              : Promise.resolve({ data: [] as any[] }),
            supabase.from('prod_moteurs').select('stk_numero, marque, modele, annee, etat_commercial').in('stk_numero', refsInternes),
          ]);
          const venduSet = new Set<string>();
          for (const r of (venRes.data ?? []) as any[]) {
            if (r.statut === 'vendu') venduSet.add(r.stock_numero);
          }
          const map: typeof invMeta = {};
          // Camions d'abord (priorité)
          for (const r of (invRes.data ?? []) as any[]) {
            const venduInv = r.etat_commercial === 'vendu';
            map[r.numero] = {
              marque: r.marque ?? null, modele: r.modele ?? null, annee: r.annee ?? null,
              vendu: venduInv || venduSet.has(r.numero),
              type: 'camion',
            };
          }
          for (const num of venduSet) {
            if (!map[num]) {
              map[num] = { marque: null, modele: null, annee: null, vendu: true, type: 'camion' };
            }
          }
          // Moteurs (seulement si pas déjà classé en camion)
          for (const r of (motRes.data ?? []) as any[]) {
            if (map[r.stk_numero]) continue;
            map[r.stk_numero] = {
              marque: r.marque ?? null, modele: r.modele ?? null, annee: r.annee ?? null,
              vendu: r.etat_commercial === 'vendu',
              type: 'moteur',
            };
          }
          setInvMeta(map);
        } else {
          setInvMeta({});
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [periode]);

  // ─── Index utilitaires ──
  const empById = useMemo(() => {
    const m: Record<string, Employe> = {};
    for (const e of employes) m[e.id] = e;
    return m;
  }, [employes]);

  // ─── Calculs : par employé sur la période ──
  const parEmploye = useMemo(() => {
    const map = new Map<string, { id: string; nom: string; taux: number; heures: number; cout: number; nbWo: Set<string> }>();
    for (const h of heures) {
      const e = empById[h.employeId];
      if (!e) continue;
      const cur = map.get(e.id) ?? { id: e.id, nom: e.nom, taux: e.tauxHoraire, heures: 0, cout: 0, nbWo: new Set<string>() };
      cur.heures += h.heures;
      cur.cout   += h.heures * e.tauxHoraire;
      if (h.woNumero) cur.nbWo.add(h.woNumero);
      map.set(e.id, cur);
    }
    return Array.from(map.values())
      .map(r => ({ ...r, nbWo: r.nbWo.size }))
      .sort((a, b) => b.heures - a.heures);
  }, [heures, empById]);

  // ─── Calculs : par WO ──
  const parWo = useMemo(() => {
    // Filtrer par type
    let rows = woCouts;
    if (filtreType !== 'tous') rows = rows.filter(r => r.type === filtreType);
    // Garder uniquement les WO qui ont des heures sur la période (sauf si "tout")
    if (bounds.from || bounds.to) {
      const wosActifs = new Set(heures.map(h => h.woNumero).filter(Boolean));
      rows = rows.filter(r => wosActifs.has(r.woNumero));
    }
    return rows.sort((a, b) => b.totalHeures - a.totalHeures);
  }, [woCouts, filtreType, heures, bounds]);

  // ─── Calculs : séparer vrais camions vs travaux génériques (pièces, temp, etc.) ──
  const { parCamion, parTravaux } = useMemo(() => {
    const wosActifs = new Set(heures.map(h => h.woNumero).filter(Boolean));
    type Agg = { stockNumero?: string; reference?: string; nbWo: number; heures: number; cout: number; revenu: number; profit: number };
    const camionsMap = new Map<string, Agg>();
    const travauxMap = new Map<string, Agg>();

    for (const w of woCouts) {
      if (w.type !== 'interne' || !w.stockNumero) continue;
      if (bounds.from && !wosActifs.has(w.woNumero)) continue;

      const key = w.stockNumero;
      const isCamion = estVraiStockCamion(key);
      const map = isCamion ? camionsMap : travauxMap;
      const cur: Agg = map.get(key) ?? {
        ...(isCamion ? { stockNumero: key } : { reference: key }),
        nbWo: 0, heures: 0, cout: 0, revenu: 0, profit: 0,
      };
      cur.nbWo++;
      cur.heures += w.totalHeures;
      cur.cout   += w.coutMoReel;
      cur.revenu += w.revenuMoCalcule;
      cur.profit += w.profitMo;
      map.set(key, cur);
    }
    return {
      parCamion: Array.from(camionsMap.values())
        .map(c => ({ stockNumero: c.stockNumero!, nbWo: c.nbWo, heures: c.heures, cout: c.cout, revenu: c.revenu, profit: c.profit }))
        .sort((a, b) => b.cout - a.cout),
      parTravaux: Array.from(travauxMap.values())
        .map(c => ({ reference: c.reference!, nbWo: c.nbWo, heures: c.heures, cout: c.cout, revenu: c.revenu, profit: c.profit }))
        .sort((a, b) => b.cout - a.cout),
    };
  }, [woCouts, heures, bounds]);

  // ─── Catégorisation détaillée des heures internes (comme dans l'import preview) ──
  const apercu = useMemo(() => {
    // Index : nb entrées (employé×WO) par WO
    const entriesByWo = new Map<string, number>();
    for (const h of heures) {
      if (!h.woNumero) continue;
      entriesByWo.set(h.woNumero, (entriesByWo.get(h.woNumero) ?? 0) + 1);
    }

    const wosActifs = new Set(heures.map(h => h.woNumero).filter(Boolean));
    const make = () => ({ heures: 0, wos: new Set<string>(), entries: 0 });
    const interne = make();
    const externe = make();
    const cats = {
      inventaire:        make(),
      vendu:             make(),
      moteur_inventaire: make(),
      moteur_vendu:      make(),
      travaux:           make(),
      inconnu:           make(),
    };

    for (const w of woCouts) {
      if (bounds.from && !wosActifs.has(w.woNumero)) continue;
      const nbEntries = entriesByWo.get(w.woNumero) ?? 0;

      if (w.type === 'interne') {
        interne.heures += w.totalHeures;
        interne.wos.add(w.woNumero);
        interne.entries += nbEntries;

        // Sous-catégorisation interne (camion / moteur / travaux / inconnu)
        let cat: keyof typeof cats;
        if (!w.stockNumero) {
          cat = 'inconnu';
        } else {
          const meta = invMeta[w.stockNumero];
          if (meta) {
            if (meta.type === 'moteur') cat = meta.vendu ? 'moteur_vendu' : 'moteur_inventaire';
            else                         cat = meta.vendu ? 'vendu'        : 'inventaire';
          } else if (!estVraiStockCamion(w.stockNumero)) {
            cat = 'travaux';
          } else {
            cat = 'inconnu';
          }
        }
        cats[cat].heures += w.totalHeures;
        cats[cat].wos.add(w.woNumero);
        cats[cat].entries += nbEntries;
      } else {
        externe.heures += w.totalHeures;
        externe.wos.add(w.woNumero);
        externe.entries += nbEntries;
      }
    }
    return {
      interne: { ...interne, nbWo: interne.wos.size },
      externe: { ...externe, nbWo: externe.wos.size },
      cats: {
        inventaire:        { ...cats.inventaire,        nbWo: cats.inventaire.wos.size },
        vendu:             { ...cats.vendu,             nbWo: cats.vendu.wos.size },
        moteur_inventaire: { ...cats.moteur_inventaire, nbWo: cats.moteur_inventaire.wos.size },
        moteur_vendu:      { ...cats.moteur_vendu,      nbWo: cats.moteur_vendu.wos.size },
        travaux:           { ...cats.travaux,           nbWo: cats.travaux.wos.size },
        inconnu:           { ...cats.inconnu,           nbWo: cats.inconnu.wos.size },
      },
    };
  }, [woCouts, heures, bounds, invMeta]);

  // ─── KPIs globaux ──
  const kpis = useMemo(() => {
    const totalHeures = heures.reduce((s, h) => s + h.heures, 0);
    const wosInternes = parWo.filter(w => w.type === 'interne').length;
    const wosExternes = parWo.filter(w => w.type === 'externe').length;

    // Revenu WO = total heures iTrack × taux fixe de facturation M.O.
    const revenuWo = totalHeures * TAUX_MO_FACTURATION;

    // ── Coût M.O. réel : tous les employés actifs × coût hebdo × nb semaines ──
    // Horaire régulier → 40 h × taux / sem
    // Salarié          → salaire_hebdomadaire / sem
    // Contracteur      → heures iTrack réelles × taux (pas de 40h fixe)
    const nbJours = bounds.from && bounds.to
      ? Math.round(
          (new Date(bounds.to).getTime() - new Date(bounds.from).getTime())
          / (1000 * 60 * 60 * 24)
        ) + 1
      : 7;
    const nbSemaines = Math.max(nbJours / 7, 1);

    // Index : heures iTrack par employé (pour contracteurs)
    const heuresParEmp = new Map<string, number>();
    for (const h of heures) {
      heuresParEmp.set(h.employeId, (heuresParEmp.get(h.employeId) ?? 0) + h.heures);
    }

    const coutPayroll = employes
      .filter(e => e.actif)
      .reduce((s, e) => {
        const estContracteur = (e.notes ?? '').toLowerCase().includes('contracteur');
        if (estContracteur) {
          // Contracteur : heures iTrack réelles × taux (pas de 40h estimé)
          return s + (heuresParEmp.get(e.id) ?? 0) * (e.tauxHoraire ?? 0);
        }
        const hebdo = (e.salaireHebdomadaire ?? 0) > 0
          ? (e.salaireHebdomadaire ?? 0)
          : 40 * (e.tauxHoraire ?? 0);
        return s + hebdo * nbSemaines;
      }, 0);

    return { totalHeures, wosInternes, wosExternes, revenuWo, coutPayroll, nbSemaines };
  }, [heures, parWo, employes, bounds]);

  // ─── Sanity check : employés sans taux ──
  const empSansTaux = useMemo(
    () => employes.filter(e => e.actif && (e.tauxHoraire ?? 0) === 0).length,
    [employes]
  );

  // ─── Rendu ──
  return (
    <div style={{ color: C.text, fontFamily: 'system-ui, sans-serif' }}>

      {/* Sous-onglets : iTrack vs Agendrix */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {([
          { id: 'itrack'   as const, label: '⏰ M.O. iTrack',       color: C.purple },
          { id: 'agendrix' as const, label: '📅 Agendrix / Absences', color: '#f97316' },
        ]).map(o => (
          <button key={o.id} onClick={() => setOnglet(o.id)} style={{
            padding: '8px 20px', borderRadius: 20, border: 'none',
            background: onglet === o.id ? o.color : C.card,
            color:      onglet === o.id ? C.bg    : C.muted,
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
            boxShadow: onglet === o.id ? `0 0 0 2px ${o.color}` : 'none',
            transition: 'all 0.15s',
          }}>{o.label}</button>
        ))}
      </div>

      {/* ════ Onglet Agendrix ════ */}
      {onglet === 'agendrix' && <SectionAgendrix peutVoirDetail={peutVoirDetailEmploye} />}

      {/* ════ Onglet iTrack (contenu existant) ════ */}
      {onglet === 'itrack' && <>

      {/* Sélecteur de période */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.05em', marginRight: 4 }}>PÉRIODE :</div>
        {([
          { id: 'semaine_passee' as const, label: 'Semaine passée'   },
          { id: 'semaine'        as const, label: 'Semaine en cours' },
          { id: 'mois'           as const, label: 'Mois'             },
          { id: 'trimestre'      as const, label: 'Trimestre'        },
          { id: 'annee_fiscale'  as const, label: 'Année fiscale'    },
          { id: 'tout'           as const, label: 'Tout'             },
        ]).map(p => (
          <button key={p.id} onClick={() => setPeriode(p.id)}
            style={{
              padding: '6px 14px', borderRadius: 18, border: 'none',
              background: periode === p.id ? C.amber : C.card,
              color: periode === p.id ? C.bg : C.muted,
              fontWeight: periode === p.id ? 800 : 600, fontSize: 12, cursor: 'pointer',
            }}>
            {p.label}
          </button>
        ))}
        <span style={{ marginLeft: 8, fontSize: 11, color: C.faded }}>
          {bounds.label}{bounds.from && bounds.to ? ` (${bounds.from} → ${bounds.to})` : ''}
        </span>
      </div>

      {empSansTaux > 0 && peutVoirDetailEmploye && (
        <div style={{ background: 'rgba(245,158,11,0.1)', border: `1px solid ${C.amber}`, borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 12, color: C.amber }}>
          ⚠️ <strong>{empSansTaux} employés actifs ont un taux horaire = 0 $/h.</strong> Leur travail ne sera pas compté dans le coût M.O.
          Va dans <em>Administration → Employés (M.O.)</em> pour les ajuster.
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>Chargement…</div>
      ) : (
        <>
          {/* ═══ KPIs globaux ═══ */}
          {(() => {
            // Coût réel = tous les employés actifs × coût hebdo × nb semaines (depuis table employés)
            // Si Agendrix chargé pour la période : on utilise ses chiffres réels (plus précis)
            const coutReel        = coutAgendrix?.cout         ?? kpis.coutPayroll;
            const coutAvecCharges = coutAgendrix?.coutAvecCharges ?? (kpis.coutPayroll * 1.23);
            const pct             = coutReel > 0 ? (kpis.revenuWo / coutReel) * 100 : 0;
            const nbActifs        = employes.filter(e => e.actif).length;
            const sourceLabel     = coutAgendrix
              ? `Agendrix réel · ${coutAgendrix.nbSemaines} sem. · +23 % : ${fmt$(coutAvecCharges)}`
              : `${nbActifs} empl. actifs · ${kpis.nbSemaines.toFixed(1)} sem. · +23 % : ${fmt$(coutAvecCharges)}`;
            return (
              <Section titre="📊 Vue d'ensemble">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                  <Kpi label="Heures totales" value={fmtH(kpis.totalHeures)} color={C.blue} sub={`${kpis.wosInternes + kpis.wosExternes} WO actifs`} />

                  {/* ── 1. Coût M.O. réel = employés actifs × (salaire ou 40h×taux) × nb semaines ── */}
                  <Kpi
                    label="Coût M.O. réel"
                    value={fmt$(coutReel)}
                    color={C.amber}
                    sub={`${nbActifs} employés actifs`}
                    sub2={sourceLabel}
                  />

                  {/* ── 2. Revenu WO = heures iTrack × 140 $/h ── */}
                  <Kpi
                    label="Revenu WO (iTrack)"
                    value={fmt$(kpis.revenuWo)}
                    color={C.green}
                    sub={`${fmtH(kpis.totalHeures)} × ${TAUX_MO_FACTURATION} $/h`}
                  />

                  {/* ── 3. % Revenu vs Coût M.O. réel ── */}
                  <Kpi
                    label="% Revenu vs Coût M.O."
                    value={coutReel > 0 ? `${pct.toFixed(0)} %` : '—'}
                    color={pct >= 100 ? C.green : C.red}
                    sub={`${fmt$(kpis.revenuWo)} ÷ ${fmt$(coutReel)}`}
                  />
                </div>
              </Section>
            );
          })()}

          {/* ═══ Répartition Interne / Externe + sous-catégories ═══ */}
          {(apercu.interne.heures > 0 || apercu.externe.heures > 0) && (
            <Section titre="🏭 Répartition des heures">
              {/* 2 gros blocs : INTERNE | EXTERNE */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <BlocGros
                  titre="🏭 INTERNE (camions)" couleur="#3b82f6"
                  bg="rgba(59,130,246,0.10)" border="rgba(59,130,246,0.35)"
                  heures={apercu.interne.heures} sousTexte={`${apercu.interne.entries} entrées · ${apercu.interne.nbWo} WO`}
                />
                <BlocGros
                  titre="🔧 EXTERNE (clients)" couleur="#ec4899"
                  bg="rgba(236,72,153,0.10)" border="rgba(236,72,153,0.35)"
                  heures={apercu.externe.heures} sousTexte={`${apercu.externe.entries} entrées · ${apercu.externe.nbWo} WO`}
                />
              </div>

              {/* Sous-blocs : breakdown des INTERNES */}
              {apercu.interne.heures > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 8, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    🏭 Détail des heures internes par destination
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                    <BlocCat titre="CAMION EN INV."    emoji="📦"  couleur={C.blue}   data={apercu.cats.inventaire} />
                    <BlocCat titre="CAMION VENDU"      emoji="✅"  couleur={C.green}  data={apercu.cats.vendu} />
                    <BlocCat titre="MOTEUR EN INV."    emoji="🔩"  couleur={C.purple} data={apercu.cats.moteur_inventaire} />
                    <BlocCat titre="MOTEUR VENDU"      emoji="⚙️" couleur={C.amber}  data={apercu.cats.moteur_vendu} />
                    <BlocCat titre="TRAVAUX / PIÈCES"  emoji="🔧"  couleur="#9ca3af" data={apercu.cats.travaux} />
                    <BlocCat titre="STOCK INCONNU"     emoji="❓"  couleur={C.red}    data={apercu.cats.inconnu} />
                  </div>
                  {apercu.cats.inconnu.heures > 0 && (
                    <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(239,68,68,0.10)', border: `1px solid ${C.red}40`, borderRadius: 8, color: C.red, fontSize: 12 }}>
                      ⚠️ <strong>{fmtH(apercu.cats.inconnu.heures)}</strong> de travail sur des stocks inconnus
                      ({apercu.cats.inconnu.nbWo} WO). Numéro(s) absent(s) de <code>prod_inventaire</code>, <code>prod_ventes</code> ET <code>prod_moteurs</code>.
                      À vérifier — peut-être un nouveau camion/moteur pas encore créé.
                    </div>
                  )}
                </>
              )}
            </Section>
          )}

          {/* ═══ Par employé (visible uniquement aux super-admins) ═══ */}
          {peutVoirDetailEmploye && (
            <Section titre="👥 Par employé">
              {parEmploye.length === 0 ? (
                <Vide message="Aucune heure pointée sur cette période." />
              ) : (
                <Table headers={['Employé', 'Taux/h', 'Heures', 'Coût', 'Nb WO', '% des heures']}>
                  {parEmploye.map(r => {
                    const pct = kpis.totalHeures > 0 ? (r.heures / kpis.totalHeures) * 100 : 0;
                    return (
                      <Row key={r.id}>
                        <Td bold>{r.nom}</Td>
                        <Td right color={r.taux === 0 ? C.red : undefined}>{fmt$(r.taux)}</Td>
                        <Td right bold>{fmtH(r.heures)}</Td>
                        <Td right bold color={C.amber}>{fmt$(r.cout)}</Td>
                        <Td right>{r.nbWo}</Td>
                        <Td right color={C.faded}>{pct.toFixed(1)} %</Td>
                      </Row>
                    );
                  })}
                </Table>
              )}
            </Section>
          )}

          {/* Message pour gestion (pas admin) qui explique que les données employés sont masquées */}
          {!peutVoirDetailEmploye && (
            <div style={{
              background: 'rgba(168,139,250,0.10)', border: `1px solid #a78bfa40`,
              borderRadius: 8, padding: '12px 16px', marginBottom: 28, fontSize: 12, color: C.muted,
            }}>
              🔒 <strong>Détails par employé masqués.</strong> Les taux horaires et salaires
              individuels sont confidentiels et réservés au super-admin. Tu vois ici les
              <strong> coûts agrégés par WO et par camion</strong>, ainsi que le coût total
              de main-d'œuvre, mais pas la ventilation par personne.
            </div>
          )}

          {/* ═══ Par Work Order ═══ */}
          <Section titre="🔧 Par Work Order">
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {(['tous', 'interne', 'externe'] as const).map(t => (
                <button key={t} onClick={() => setFiltreType(t)}
                  style={{
                    padding: '5px 12px', borderRadius: 14, border: 'none',
                    background: filtreType === t ? C.blue : C.card,
                    color: filtreType === t ? C.bg : C.muted,
                    fontWeight: filtreType === t ? 800 : 600, fontSize: 11, cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}>{t}</button>
              ))}
            </div>

            {parWo.length === 0 ? (
              <Vide message="Aucun WO actif sur cette période." />
            ) : (
              <Table headers={['WO', 'Type', 'Stock / Client', 'Heures', 'Taux/h', 'Coût M.O.', 'Revenu M.O.', 'Profit M.O.']}>
                {parWo.map(r => {
                  const ref = r.type === 'interne' ? r.stockNumero : r.client;
                  return (
                    <Row key={r.woNumero}>
                      <Td><span style={{ fontFamily: 'monospace', color: C.amber, fontWeight: 700 }}>{r.woNumero}</span></Td>
                      <Td>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                          background: r.type === 'interne' ? '#3b82f622' : '#ec489922',
                          color:      r.type === 'interne' ? '#60a5fa'   : '#f9a8d4',
                        }}>{r.type}</span>
                      </Td>
                      <Td color={ref ? undefined : C.faded}>{ref ?? '—'}</Td>
                      <Td right>{fmtH(r.totalHeures)}</Td>
                      <Td right color={C.faded}>{fmt$(r.tauxFacturation)}</Td>
                      <Td right bold color={C.amber}>{fmt$(r.coutMoReel)}</Td>
                      <Td right bold color={C.green}>{fmt$(r.revenuMoCalcule)}</Td>
                      <Td right bold color={r.profitMo >= 0 ? C.green : C.red}>{fmt$(r.profitMo)}</Td>
                    </Row>
                  );
                })}
              </Table>
            )}
          </Section>

          {/* ═══ Par camion (interne, vrais numéros de stock seulement) ═══ */}
          <Section titre="🏭 Par camion — coût M.O. réel cumulé">
            {parCamion.length === 0 ? (
              <Vide message="Aucune heure de travail sur un camion réel pendant cette période." />
            ) : (
              <Table headers={['# Stock', 'Statut', 'Camion', 'Nb WO', 'Heures', 'Coût M.O.', 'Revenu M.O.', 'Profit M.O.']}>
                {parCamion.map(r => {
                  const meta = invMeta[r.stockNumero];
                  const desc = meta
                    ? [meta.annee, meta.marque, meta.modele].filter(Boolean).join(' ')
                    : '';
                  const inconnu = !meta;
                  return (
                    <Row key={r.stockNumero}>
                      <Td bold><span style={{ color: C.blue }}>#{r.stockNumero}</span></Td>
                      <Td>
                        {inconnu ? (
                          <span style={badgeStyle('#ef4444')}>❓ Inconnu</span>
                        ) : meta.vendu ? (
                          <span style={badgeStyle(C.green)}>✅ Vendu</span>
                        ) : (
                          <span style={badgeStyle(C.blue)}>📦 En inventaire</span>
                        )}
                      </Td>
                      <Td color={desc ? undefined : C.faded}>{desc || '— pas dans prod_inventaire'}</Td>
                      <Td right>{r.nbWo}</Td>
                      <Td right bold>{fmtH(r.heures)}</Td>
                      <Td right bold color={C.amber}>{fmt$(r.cout)}</Td>
                      <Td right bold color={C.green}>{fmt$(r.revenu)}</Td>
                      <Td right bold color={r.profit >= 0 ? C.green : C.red}>{fmt$(r.profit)}</Td>
                    </Row>
                  );
                })}
              </Table>
            )}
            <div style={{ fontSize: 11, color: C.faded, marginTop: 8, fontStyle: 'italic' }}>
              💡 Uniquement les vrais numéros de stock (≥4 chiffres purs). Coût = heures pointées × taux horaire =
              <strong> vrai</strong> coût de production (peut différer du <code>cout_mo</code> importé Hitrac).
            </div>
          </Section>

          {/* ═══ Travaux génériques (pièces, temporaire, etc.) ═══ */}
          {parTravaux.length > 0 && (
            <Section titre="🔧 Travaux génériques (pièces / temporaire / autres)">
              <Table headers={['Référence', 'Nb WO', 'Heures', 'Coût M.O.', 'Revenu M.O.', 'Profit M.O.']}>
                {parTravaux.map(r => (
                  <Row key={r.reference}>
                    <Td bold><span style={{ color: C.muted, fontFamily: 'monospace' }}>{r.reference}</span></Td>
                    <Td right>{r.nbWo}</Td>
                    <Td right bold>{fmtH(r.heures)}</Td>
                    <Td right bold color={C.amber}>{fmt$(r.cout)}</Td>
                    <Td right bold color={C.green}>{fmt$(r.revenu)}</Td>
                    <Td right bold color={r.profit >= 0 ? C.green : C.red}>{fmt$(r.profit)}</Td>
                  </Row>
                ))}
              </Table>
              <div style={{ fontSize: 11, color: C.faded, marginTop: 8, fontStyle: 'italic' }}>
                💡 Ces WO internes ne sont pas liés à un camion spécifique (suffixe <code>-1</code>, préfixe <code>PIECES-</code>,
                texte libre, etc.). C'est du travail sur des pièces génériques ou des projets temporaires.
              </div>
            </Section>
          )}
        </>
      )}

      {/* Fermeture onglet iTrack */}
      </>}

    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ─── Section Agendrix / Absentéisme ────────────────────────────
// ════════════════════════════════════════════════════════════════

function SectionAgendrix({ peutVoirDetail }: { peutVoirDetail: boolean }) {
  const [semaines,        setSemaines]        = useState<string[]>([]);
  const [semaine,         setSemaine]         = useState<string | null>(null);
  const [analyse,         setAnalyse]         = useState<AgendrixAnalyseEmploye[]>([]);
  const [loading,         setLoading]         = useState(false);
  const [loadingSemaines, setLoadingSemaines] = useState(true);

  // Charger la liste des semaines disponibles
  useEffect(() => {
    getAgendrixSemaines().then(s => {
      setSemaines(s);
      if (s.length > 0) setSemaine(s[0]);
      setLoadingSemaines(false);
    });
  }, []);

  // Charger l'analyse quand la semaine change
  useEffect(() => {
    if (!semaine) return;
    setLoading(true);
    getAgendrixAnalyse(semaine).then(a => {
      setAnalyse(a);
      setLoading(false);
    });
  }, [semaine]);

  const fmtDate = (d: string) => {
    if (!d) return '—';
    const [y, m, j] = d.split('-');
    return `${j}/${m}/${y}`;
  };

  // KPIs globaux de la semaine
  const kpis = useMemo(() => {
    const hQuartTotal   = analyse.reduce((s, e) => s + e.hQuart, 0);
    const hCongePayeTotal = analyse.reduce((s, e) => s + e.hFerie + e.hVacancesPaye + e.hMaladiePaye + e.hCongePayeAutre, 0);
    const hAbsentTotal  = analyse.reduce((s, e) => s + e.hAbsentTotal, 0);
    const hPayeTotal    = analyse.reduce((s, e) => s + e.hTotalPaye, 0);
    const coutTotal     = analyse.reduce((s, e) => s + e.coutPrevu, 0);
    const nbSansLien    = analyse.filter(e => !e.employeId).length;
    const nbSansTaux    = analyse.filter(e => e.employeId && !e.salaireHebdo && !(e.tauxHoraire ?? 0)).length;
    const hAttendues    = hQuartTotal + hCongePayeTotal + hAbsentTotal; // toutes heures enregistrées
    const pctAbsent     = hAttendues > 0 ? (hAbsentTotal / hAttendues) * 100 : 0;
    return { hQuartTotal, hCongePayeTotal, hAbsentTotal, hPayeTotal, coutTotal, nbSansLien, nbSansTaux, pctAbsent };
  }, [analyse]);

  if (loadingSemaines) {
    return <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>Chargement…</div>;
  }

  if (semaines.length === 0) {
    return (
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📅</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Aucun rapport Agendrix importé</div>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>
          Va dans <strong>Import → Agendrix</strong> pour importer le rapport hebdomadaire.
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Sélecteur de semaine */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.05em' }}>SEMAINE :</div>
        {semaines.slice(0, 8).map(s => (
          <button key={s} onClick={() => setSemaine(s)} style={{
            padding: '6px 14px', borderRadius: 18, border: 'none',
            background: semaine === s ? '#f97316' : C.card,
            color:      semaine === s ? C.bg      : C.muted,
            fontWeight: semaine === s ? 800 : 600, fontSize: 12, cursor: 'pointer',
          }}>{fmtDate(s)}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>Chargement…</div>
      ) : (
        <>
          {/* KPIs */}
          <Section titre="📊 Vue d'ensemble — semaine">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
              <Kpi label="Heures travaillées" value={`${kpis.hQuartTotal.toFixed(1)} h`} color={C.blue} sub={`${analyse.length} employés`} />
              <Kpi label="Congés payés" value={`${kpis.hCongePayeTotal.toFixed(1)} h`} color={C.purple} sub="Férié · Vacances · Maladie" />
              <Kpi label="Absences (non payé)" value={`${kpis.hAbsentTotal.toFixed(1)} h`} color={C.red} sub={`${kpis.pctAbsent.toFixed(1)} % absentéisme`} />
              <Kpi label="Coût prévu" value={fmt$(kpis.coutTotal)} color={C.amber} sub="Agendrix × taux | salarié fixe" />
              {kpis.nbSansLien > 0 && <Kpi label="Non liés Acomba" value={String(kpis.nbSansLien)} color={C.red} sub="Pas dans la table de référence" />}
              {kpis.nbSansTaux > 0 && peutVoirDetail && <Kpi label="Sans taux" value={String(kpis.nbSansTaux)} color={C.amber} sub="Coût prévu = 0" />}
            </div>
          </Section>

          {/* Légende des types d'absence */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', fontSize: 11 }}>
            {[
              { label: '🔵 Quart',          color: C.blue   },
              { label: '🟣 Férié payé',     color: C.purple },
              { label: '🟢 Vacances payées',color: C.green  },
              { label: '🟡 Maladie payée',  color: C.amber  },
              { label: '🔴 Absence non payée', color: C.red },
            ].map(l => (
              <span key={l.label} style={{ background: `${l.color}20`, color: l.color, padding: '3px 10px', borderRadius: 10, fontWeight: 700 }}>{l.label}</span>
            ))}
          </div>

          {/* Tableau par employé */}
          <Section titre="👤 Détail par employé">
            <div style={{ overflowX: 'auto', borderRadius: 8, border: `1px solid ${C.border}` }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: C.card }}>
                    <th style={TH}>Employé</th>
                    <th style={TH}>Succursale</th>
                    <th style={{ ...TH, textAlign: 'right' }}>🔵 Quart</th>
                    <th style={{ ...TH, textAlign: 'right' }}>🟣 Férié</th>
                    <th style={{ ...TH, textAlign: 'right' }}>🟢 Vac.</th>
                    <th style={{ ...TH, textAlign: 'right' }}>🟡 Mal.</th>
                    <th style={{ ...TH, textAlign: 'right' }}>🔴 Absent</th>
                    <th style={{ ...TH, textAlign: 'right' }}>Total payé</th>
                    {peutVoirDetail && <th style={{ ...TH, textAlign: 'right' }}>Coût prévu</th>}
                  </tr>
                </thead>
                <tbody>
                  {analyse.map((e, i) => {
                    const nomAffiche = e.nomComplet ?? `${e.prenom ?? ''} ${e.nomAgendrix ?? ''}`.trim();
                    const hasAbsent  = e.hAbsentTotal > 0;
                    const nonLie     = !e.employeId;
                    return (
                      <tr key={i} style={{ borderTop: `1px solid ${C.border}`, background: hasAbsent ? 'rgba(239,68,68,0.04)' : 'transparent' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 700 }}>
                          <div style={{ color: nonLie ? C.muted : C.text }}>{nomAffiche || '—'}</div>
                          {nonLie && <div style={{ fontSize: 10, color: C.red }}>⚠️ non lié Acomba</div>}
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 11, color: C.muted }}>{e.succursale ?? '—'}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: C.blue }}>
                          {e.hQuart > 0 ? `${e.hQuart.toFixed(1)} h` : '—'}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: C.purple }}>
                          {e.hFerie > 0 ? `${e.hFerie.toFixed(1)} h` : '—'}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: C.green }}>
                          {e.hVacancesPaye > 0 ? `${e.hVacancesPaye.toFixed(1)} h` : '—'}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: C.amber }}>
                          {e.hMaladiePaye > 0 ? `${e.hMaladiePaye.toFixed(1)} h` : '—'}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: e.hAbsentTotal > 0 ? 800 : 500, color: e.hAbsentTotal > 0 ? C.red : C.faded }}>
                          {e.hAbsentTotal > 0 ? `${e.hAbsentTotal.toFixed(1)} h` : '—'}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: C.text }}>
                          {`${e.hTotalPaye.toFixed(1)} h`}
                        </td>
                        {peutVoirDetail && (
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: C.amber }}>
                            {e.coutPrevu > 0 ? fmt$(e.coutPrevu) : <span style={{ color: C.faded }}>—</span>}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                {/* Total */}
                <tfoot>
                  <tr style={{ borderTop: `2px solid ${C.border}`, background: C.card }}>
                    <td style={{ padding: '10px 12px', fontWeight: 800, color: C.text }} colSpan={2}>TOTAL</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: C.blue }}>{kpis.hQuartTotal.toFixed(1)} h</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: C.purple }}>{analyse.reduce((s,e)=>s+e.hFerie,0).toFixed(1)} h</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: C.green }}>{analyse.reduce((s,e)=>s+e.hVacancesPaye,0).toFixed(1)} h</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: C.amber }}>{analyse.reduce((s,e)=>s+e.hMaladiePaye,0).toFixed(1)} h</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: C.red }}>{kpis.hAbsentTotal.toFixed(1)} h</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: C.text }}>{kpis.hPayeTotal.toFixed(1)} h</td>
                    {peutVoirDetail && <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: C.amber }}>{fmt$(kpis.coutTotal)}</td>}
                  </tr>
                </tfoot>
              </table>
            </div>
          </Section>

          {/* Absentéisme détaillé */}
          {kpis.hAbsentTotal > 0 && (
            <Section titre={`🔴 Absentéisme — ${kpis.pctAbsent.toFixed(1)} % cette semaine`}>
              <Table headers={['Employé', 'Succursale', 'Vacances N.P.', 'Maladie N.P.', 'Abs. solde', 'CNESST', 'Total absent']}>
                {analyse.filter(e => e.hAbsentTotal > 0).map((e, i) => {
                  const nomAffiche = e.nomComplet ?? `${e.prenom ?? ''} ${e.nomAgendrix ?? ''}`.trim();
                  return (
                    <Row key={i}>
                      <Td bold>{nomAffiche || '—'}</Td>
                      <Td>{e.succursale ?? '—'}</Td>
                      <Td right color={C.red}>{e.hAbsentTotal > 0 ? `${e.hAbsentTotal.toFixed(1)} h` : '—'}</Td>
                      <Td right color={C.red}>—</Td>
                      <Td right color={C.red}>—</Td>
                      <Td right color={C.red}>—</Td>
                      <Td right bold color={C.red}>{e.hAbsentTotal.toFixed(1)} h</Td>
                    </Row>
                  );
                })}
              </Table>
              <div style={{ fontSize: 11, color: C.faded, marginTop: 8, fontStyle: 'italic' }}>
                💡 % absentéisme = heures absentes non payées / (heures quart + congés payés + absences non payées)
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}

const TH: React.CSSProperties = {
  padding: '10px 12px', textAlign: 'left',
  fontSize: 10, fontWeight: 700, color: C.muted,
  textTransform: 'uppercase', letterSpacing: '0.05em',
};

// ─── Sous-composants ──────────────────────────────────────────────

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 12, letterSpacing: '0.02em' }}>{titre}</div>
      {children}
    </div>
  );
}

function BlocGros({ titre, couleur, bg, border, heures, sousTexte }: {
  titre: string; couleur: string; bg: string; border: string; heures: number; sousTexte: string;
}) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '14px 18px' }}>
      <div style={{ fontSize: 11, color: couleur, fontWeight: 700, letterSpacing: '0.04em' }}>{titre}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: couleur, marginTop: 4 }}>{fmtH(heures)}</div>
      <div style={{ fontSize: 11, color: couleur, opacity: 0.8, marginTop: 2 }}>{sousTexte}</div>
    </div>
  );
}

function BlocCat({ titre, emoji, couleur, data }: {
  titre: string; emoji: string; couleur: string;
  data: { heures: number; nbWo: number; entries: number };
}) {
  return (
    <div style={{
      background: `${couleur}15`, border: `1px solid ${couleur}40`,
      borderRadius: 8, padding: 10,
    }}>
      <div style={{ fontSize: 10, color: couleur, fontWeight: 700 }}>{emoji} {titre}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: C.text, marginTop: 4 }}>{fmtH(data.heures)}</div>
      <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
        {data.nbWo} WO · {data.entries} entrée{data.entries !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

function Kpi({ label, value, color, sub, sub2 }: { label: string; value: string; color?: string; sub?: string; sub2?: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 16px' }}>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: color ?? C.text }}>{value}</div>
      {sub  && <div style={{ fontSize: 10, color: C.faded,  marginTop: 4 }}>{sub}</div>}
      {sub2 && <div style={{ fontSize: 10, color: C.amber,  marginTop: 2 }}>{sub2}</div>}
    </div>
  );
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div style={{ overflowX: 'auto', borderRadius: 8, border: `1px solid ${C.border}` }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: C.card }}>
            {headers.map((h, i) => (
              <th key={i} style={{
                padding: '10px 12px',
                textAlign: i === 0 ? 'left' : 'right',
                fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <tr style={{ borderTop: `1px solid ${C.border}` }}>{children}</tr>;
}

function Td({ children, right, bold, color }: { children: React.ReactNode; right?: boolean; bold?: boolean; color?: string }) {
  return (
    <td style={{
      padding: '10px 12px',
      textAlign: right ? 'right' : 'left',
      fontWeight: bold ? 700 : 500,
      color: color ?? C.text,
    }}>{children}</td>
  );
}

function Vide({ message }: { message: string }) {
  return (
    <div style={{ padding: 24, textAlign: 'center', color: C.faded, fontSize: 13, background: C.card, borderRadius: 8 }}>
      {message}
    </div>
  );
}

function badgeStyle(color: string): React.CSSProperties {
  return {
    fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
    background: `${color}22`, color, whiteSpace: 'nowrap',
  };
}
