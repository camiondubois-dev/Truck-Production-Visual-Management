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
import {
  employeService, workOrderService, heuresService,
  periodeBounds, type PreriodeOption,
  type Employe, type WoCoutMo, type HeureEmploye,
} from '../services/mainOeuvreService';
import { supabase } from '../lib/supabase';

/** Test si un texte ressemble à un vrai numéro de stock de camion */
const estVraiStockCamion = (s: string | null | undefined): boolean =>
  !!s && /^\d{4,}$/.test(s.trim());

// ─── Helpers d'affichage ──────────────────────────────────────────

const fmt$ = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);
const fmtH = (n: number | null | undefined) =>
  n == null ? '—' : `${new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 1 }).format(n)} h`;

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
  const [periode,    setPeriode]    = useState<PreriodeOption>('mois');
  const [loading,    setLoading]    = useState(true);
  const [employes,   setEmployes]   = useState<Employe[]>([]);
  const [woCouts,    setWoCouts]    = useState<WoCoutMo[]>([]);
  const [heures,     setHeures]     = useState<HeureEmploye[]>([]);
  const [filtreType, setFiltreType] = useState<'tous' | 'interne' | 'externe'>('tous');
  // Metadata camions (marque/modèle/année + statut vendu) pour enrichir le tableau Par camion
  const [invMeta, setInvMeta] = useState<Record<string, { marque: string | null; modele: string | null; annee: number | null; vendu: boolean }>>({});

  const bounds = useMemo(() => periodeBounds(periode), [periode]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [emps, wos, hrs] = await Promise.all([
          employeService.getAll(),
          workOrderService.getCoutsByWo(),
          heuresService.getAll(bounds.from ?? undefined, bounds.to ?? undefined),
        ]);
        setEmployes(emps);
        setWoCouts(wos);
        setHeures(hrs);

        // Fetch métadonnées camion pour tous les vrais numéros de stock présents
        // + statut vendu (via prod_inventaire.etat_commercial OU prod_ventes.statut)
        const stocksValides = Array.from(new Set(
          wos
            .filter(w => w.type === 'interne' && estVraiStockCamion(w.stockNumero))
            .map(w => w.stockNumero!)
        ));
        if (stocksValides.length > 0) {
          const [invRes, venRes] = await Promise.all([
            supabase
              .from('prod_inventaire')
              .select('numero, marque, modele, annee, etat_commercial')
              .in('numero', stocksValides),
            supabase
              .from('prod_ventes')
              .select('stock_numero, statut')
              .in('stock_numero', stocksValides),
          ]);
          // Set des stocks marqués vendu dans prod_ventes
          const venduSet = new Set<string>();
          for (const r of (venRes.data ?? []) as any[]) {
            if (r.statut === 'vendu') venduSet.add(r.stock_numero);
          }
          const map: typeof invMeta = {};
          for (const r of (invRes.data ?? []) as any[]) {
            const venduInv = r.etat_commercial === 'vendu';
            map[r.numero] = {
              marque: r.marque ?? null,
              modele: r.modele ?? null,
              annee:  r.annee  ?? null,
              vendu:  venduInv || venduSet.has(r.numero),
            };
          }
          // Pour les stocks pas trouvés dans prod_inventaire mais présents dans prod_ventes
          for (const num of venduSet) {
            if (!map[num]) {
              map[num] = { marque: null, modele: null, annee: null, vendu: true };
            }
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
      inventaire: make(),
      vendu:      make(),
      travaux:    make(),
      inconnu:    make(),
    };

    for (const w of woCouts) {
      if (bounds.from && !wosActifs.has(w.woNumero)) continue;
      const nbEntries = entriesByWo.get(w.woNumero) ?? 0;

      if (w.type === 'interne') {
        interne.heures += w.totalHeures;
        interne.wos.add(w.woNumero);
        interne.entries += nbEntries;

        // Sous-catégorisation interne
        let cat: keyof typeof cats;
        if (!w.stockNumero) {
          cat = 'inconnu';
        } else if (!estVraiStockCamion(w.stockNumero)) {
          cat = 'travaux';
        } else {
          const meta = invMeta[w.stockNumero];
          if (!meta)         cat = 'inconnu';
          else if (meta.vendu) cat = 'vendu';
          else                 cat = 'inventaire';
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
        inventaire: { ...cats.inventaire, nbWo: cats.inventaire.wos.size },
        vendu:      { ...cats.vendu,      nbWo: cats.vendu.wos.size },
        travaux:    { ...cats.travaux,    nbWo: cats.travaux.wos.size },
        inconnu:    { ...cats.inconnu,    nbWo: cats.inconnu.wos.size },
      },
    };
  }, [woCouts, heures, bounds, invMeta]);

  // ─── KPIs globaux ──
  const kpis = useMemo(() => {
    const totalHeures = heures.reduce((s, h) => s + h.heures, 0);
    const totalCout   = heures.reduce((s, h) => {
      const e = empById[h.employeId];
      return s + (e ? h.heures * e.tauxHoraire : 0);
    }, 0);
    const wosInternes = parWo.filter(w => w.type === 'interne').length;
    const wosExternes = parWo.filter(w => w.type === 'externe').length;
    // Revenu MO facturable = somme(heures × taux_facturation) sur tous les WO
    const revenuMoTotal    = parWo.reduce((s, w) => s + w.revenuMoCalcule, 0);
    const revenuMoInterne  = parWo.filter(w => w.type === 'interne').reduce((s, w) => s + w.revenuMoCalcule, 0);
    const revenuMoExterne  = parWo.filter(w => w.type === 'externe').reduce((s, w) => s + w.revenuMoCalcule, 0);
    const profitMoTotal    = parWo.reduce((s, w) => s + w.profitMo, 0);
    return { totalHeures, totalCout, wosInternes, wosExternes,
             revenuMoTotal, revenuMoInterne, revenuMoExterne, profitMoTotal };
  }, [heures, parWo, empById]);

  // ─── Sanity check : employés sans taux ──
  const empSansTaux = useMemo(
    () => employes.filter(e => e.actif && (e.tauxHoraire ?? 0) === 0).length,
    [employes]
  );

  // ─── Rendu ──
  return (
    <div style={{ color: C.text, fontFamily: 'system-ui, sans-serif' }}>

      {/* Sélecteur de période */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 11, color: C.muted, letterSpacing: '0.05em', marginRight: 4 }}>PÉRIODE :</div>
        {(['semaine', 'mois', 'trimestre', 'annee_fiscale', 'tout'] as const).map(p => (
          <button key={p} onClick={() => setPeriode(p)}
            style={{
              padding: '6px 14px', borderRadius: 18, border: 'none',
              background: periode === p ? C.amber : C.card,
              color: periode === p ? C.bg : C.muted,
              fontWeight: periode === p ? 800 : 600, fontSize: 12, cursor: 'pointer',
              textTransform: 'capitalize',
            }}>
            {p === 'annee_fiscale' ? 'Année fiscale' : p}
          </button>
        ))}
        <span style={{ marginLeft: 8, fontSize: 11, color: C.faded }}>
          {bounds.label}{bounds.from && bounds.to ? ` (${bounds.from} → ${bounds.to})` : ''}
        </span>
      </div>

      {empSansTaux > 0 && (
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
          <Section titre="📊 Vue d'ensemble">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
              <Kpi label="Heures totales" value={fmtH(kpis.totalHeures)} color={C.blue} sub={`${kpis.wosInternes + kpis.wosExternes} WO actifs`} />
              <Kpi label="Coût M.O. réel" value={fmt$(kpis.totalCout)} color={C.amber} sub={`${employes.filter(e => e.actif).length} employés actifs`} />
              <Kpi label="Revenu M.O. facturable" value={fmt$(kpis.revenuMoTotal)} color={C.green} sub={`Interne: ${fmt$(kpis.revenuMoInterne)} · Externe: ${fmt$(kpis.revenuMoExterne)}`} />
              <Kpi label="Profit sur M.O." value={fmt$(kpis.profitMoTotal)} color={kpis.profitMoTotal >= 0 ? C.green : C.red} sub={`Revenu facturable − coût réel`} />
            </div>
          </Section>

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

              {/* 4 sous-blocs : breakdown des INTERNES */}
              {apercu.interne.heures > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 8, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    🏭 Détail des heures internes par destination
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    <BlocCat titre="EN INVENTAIRE"     emoji="📦" couleur={C.blue}   data={apercu.cats.inventaire} />
                    <BlocCat titre="CAMION VENDU"      emoji="✅" couleur={C.green}  data={apercu.cats.vendu} />
                    <BlocCat titre="TRAVAUX / PIÈCES"  emoji="🔧" couleur="#9ca3af" data={apercu.cats.travaux} />
                    <BlocCat titre="STOCK INCONNU"     emoji="❓" couleur={C.red}    data={apercu.cats.inconnu} />
                  </div>
                  {apercu.cats.inconnu.heures > 0 && (
                    <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(239,68,68,0.10)', border: `1px solid ${C.red}40`, borderRadius: 8, color: C.red, fontSize: 12 }}>
                      ⚠️ <strong>{fmtH(apercu.cats.inconnu.heures)}</strong> de travail sur des stocks inconnus
                      ({apercu.cats.inconnu.nbWo} WO). Numéro(s) numérique(s) absent(s) de <code>prod_inventaire</code> et <code>prod_ventes</code>.
                      À vérifier — peut-être un nouveau camion pas encore créé.
                    </div>
                  )}
                </>
              )}
            </Section>
          )}

          {/* ═══ Par employé ═══ */}
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
    </div>
  );
}

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

function Kpi({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 16px' }}>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: color ?? C.text }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.faded, marginTop: 4 }}>{sub}</div>}
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
