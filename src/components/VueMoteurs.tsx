import { useMemo, useState, useEffect } from 'react';
import { useMoteurs } from '../contexts/MoteurContext';
import { supabase } from '../lib/supabase';
import { ENGINE_ETAPES, ENGINE_SLOTS, getEngineSlot, getEngineEtape } from '../data/engineStations';
import { etapeEnCoursMoteur, prochaineEtapeMoteur, etapesRestantesMoteur, progressionMoteur } from '../types/engineTypes';
import type { Moteur, ProprietaireMoteur, StatutMoteur } from '../types/engineTypes';
import { WizardMoteur } from './WizardMoteur';
import { PanneauDetailMoteur } from './PanneauDetailMoteur';
import { FiltreBtn, SectionHeaderCard } from './VueAsana';

type FiltreStatut = 'tous' | StatutMoteur;
type FiltreProprietaire = 'tous' | ProprietaireMoteur;

const STATUT_CONFIG: Record<StatutMoteur, { label: string; color: string; bg: string; icon: string }> = {
  'en-attente': { label: 'En attente', color: '#f59e0b', bg: '#fef3c7', icon: '⏳' },
  'en-cours':   { label: 'En cours',   color: '#3b82f6', bg: '#dbeafe', icon: '🚛' },
  'pret':       { label: 'Prêt',       color: '#22c55e', bg: '#dcfce7', icon: '✅' },
  'archive':    { label: 'Archivé',    color: '#6b7280', bg: '#f3f4f6', icon: '📦' },
};

const PROPRIO_LABEL: Record<ProprietaireMoteur, string> = {
  'interne':     'Interne',
  'client':      'Client',
  'exportation': 'Exportation',
  'inventaire':  'Inventaire',
};

const COULEUR_MOTEUR = '#7c3aed';

export function VueMoteurs({ mobile = false, onClose }: { mobile?: boolean; onClose?: () => void } = {}) {
  const { moteurs, loading } = useMoteurs();

  const [filtreStatut, setFiltreStatut] = useState<FiltreStatut>('tous');
  const [filtreProprietaire, setFiltreProprietaire] = useState<FiltreProprietaire>('tous');
  const [filtreEtapeRequise, setFiltreEtapeRequise] = useState<string>('tous');
  const [filtreSlot, setFiltreSlot] = useState<string>('tous');
  const [filtreMarque, setFiltreMarque] = useState<string>('tous');
  const [filtreModele, setFiltreModele] = useState<string>('tous');
  const [filtreEpa, setFiltreEpa] = useState<string>('tous');
  const [filtreGhg, setFiltreGhg] = useState<string>('tous');
  const [filtreAnnee, setFiltreAnnee] = useState<string>('tous');
  const [hpMin, setHpMin] = useState<string>('');
  const [hpMax, setHpMax] = useState<string>('');
  const [filtreEmploye, setFiltreEmploye] = useState<string>('tous'); // 'tous' / 'aucun' / employeId
  const [recherche, setRecherche] = useState('');

  // ── Liste des employés (avec nom) chargés depuis profiles ────
  const [employes, setEmployes] = useState<{ id: string; nom: string; departement?: string; role?: string }[]>([]);
  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, nom, departement, role, actif')
      .eq('actif', true)
      .then(({ data }) => {
        const list = (data ?? [])
          .filter(p => p.role === 'employe' || p.role === 'gestion')
          .map(p => ({ id: p.id, nom: p.nom ?? 'Sans nom', departement: p.departement ?? undefined, role: p.role }));
        // Tri : mécanos moteur d'abord
        list.sort((a, b) => {
          const prio = (p: typeof a) =>
            p.departement === 'mecanique-moteur' ? 0 :
            p.role === 'employe'                 ? 1 : 2;
          const pa = prio(a), pb = prio(b);
          if (pa !== pb) return pa - pb;
          return a.nom.localeCompare(b.nom);
        });
        setEmployes(list);
      });
  }, []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [showFiltresAvances, setShowFiltresAvances] = useState(false);

  // KPIs
  const kpis = useMemo(() => {
    const actifs = moteurs.filter(m => m.statut !== 'archive');
    return {
      total: actifs.length,
      enAttente: actifs.filter(m => m.statut === 'en-attente').length,
      enCours: actifs.filter(m => m.statut === 'en-cours').length,
      prets: actifs.filter(m => m.statut === 'pret').length,
      archives: moteurs.filter(m => m.statut === 'archive').length,
    };
  }, [moteurs]);

  // Listes uniques pour les dropdowns
  const valeursDistinctes = useMemo(() => {
    const marques = new Set<string>();
    const modeles = new Set<string>();
    const epas    = new Set<string>();
    const ghgs    = new Set<string>();
    const annees  = new Set<number>();
    for (const m of moteurs) {
      if (m.marque) marques.add(m.marque);
      if (m.modele) modeles.add(m.modele);
      if (m.epa)    epas.add(m.epa);
      if (m.ghg)    ghgs.add(m.ghg);
      if (m.annee)  annees.add(m.annee);
    }
    return {
      marques: [...marques].sort(),
      modeles: [...modeles].sort(),
      epas:    [...epas].sort(),
      ghgs:    [...ghgs].sort(),
      annees:  [...annees].sort((a, b) => b - a),
    };
  }, [moteurs]);

  // Compte de moteurs par employé (assigné OU étapes faites/en-cours)
  const countsParEmploye = useMemo(() => {
    const c: Record<string, { total: number; enCours: number; termine: number }> = {};
    for (const m of moteurs) {
      const empIds = new Set<string>();
      if (m.employeCourant) empIds.add(m.employeCourant);
      for (const e of m.roadMap) if (e.employeId) empIds.add(e.employeId);

      for (const id of empIds) {
        if (!c[id]) c[id] = { total: 0, enCours: 0, termine: 0 };
        c[id].total++;
        if (m.statut === 'en-cours' && (m.employeCourant === id || m.roadMap.some(e => e.employeId === id && e.statut === 'en-cours'))) {
          c[id].enCours++;
        }
        if (m.roadMap.some(e => e.employeId === id && e.statut === 'termine')) {
          c[id].termine++;
        }
      }
    }
    return c;
  }, [moteurs]);

  // Comptes par étape requise (pour les filtres FiltreBtn)
  const countsParEtape = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of ENGINE_ETAPES) {
      c[e.id] = moteurs.filter(m =>
        m.statut !== 'archive' &&
        m.roadMap.some(s => s.etapeId === e.id && s.statut !== 'termine' && s.statut !== 'saute')
      ).length;
    }
    return c;
  }, [moteurs]);

  // Comptes propriétaire
  const countsProprio = useMemo(() => {
    const c: Record<ProprietaireMoteur, number> = { interne: 0, client: 0, exportation: 0, inventaire: 0 };
    for (const m of moteurs.filter(m => m.statut !== 'archive')) {
      c[m.proprietaire]++;
    }
    return c;
  }, [moteurs]);

  // Filtrage
  const filtres = useMemo(() => {
    let result = [...moteurs];
    if (filtreStatut !== 'tous')        result = result.filter(m => m.statut === filtreStatut);
    if (filtreProprietaire !== 'tous')  result = result.filter(m => m.proprietaire === filtreProprietaire);
    if (filtreEtapeRequise !== 'tous') {
      result = result.filter(m =>
        m.roadMap.some(e => e.etapeId === filtreEtapeRequise && e.statut !== 'termine' && e.statut !== 'saute')
      );
    }
    if (filtreSlot !== 'tous') {
      if (filtreSlot === 'aucun') result = result.filter(m => !m.posteCourant);
      else result = result.filter(m => m.posteCourant === filtreSlot);
    }
    if (filtreEmploye !== 'tous') {
      if (filtreEmploye === 'aucun') {
        // Aucun employé attitré ET aucune étape avec employeId
        result = result.filter(m =>
          !m.employeCourant && !m.roadMap.some(e => !!e.employeId)
        );
      } else {
        // L'employé est attitré OU a au moins une étape (tous statuts) avec son employeId
        result = result.filter(m =>
          m.employeCourant === filtreEmploye ||
          m.roadMap.some(e => e.employeId === filtreEmploye)
        );
      }
    }
    if (filtreMarque !== 'tous') result = result.filter(m => m.marque === filtreMarque);
    if (filtreModele !== 'tous') result = result.filter(m => m.modele === filtreModele);
    if (filtreEpa !== 'tous')    result = result.filter(m => m.epa === filtreEpa);
    if (filtreGhg !== 'tous')    result = result.filter(m => m.ghg === filtreGhg);
    if (filtreAnnee !== 'tous')  result = result.filter(m => String(m.annee) === filtreAnnee);

    const hpMinNum = hpMin.trim() ? parseInt(hpMin) : null;
    const hpMaxNum = hpMax.trim() ? parseInt(hpMax) : null;
    if (hpMinNum !== null) result = result.filter(m => (m.puissanceHp ?? 0) >= hpMinNum);
    if (hpMaxNum !== null) result = result.filter(m => (m.puissanceHp ?? Number.MAX_SAFE_INTEGER) <= hpMaxNum);

    if (recherche.trim()) {
      const q = recherche.trim().toLowerCase();
      result = result.filter(m =>
        m.stkNumero?.toLowerCase().includes(q) ||
        m.workOrder?.toLowerCase().includes(q) ||
        m.descriptionMoteur?.toLowerCase().includes(q) ||
        m.marque?.toLowerCase().includes(q) ||
        m.modele?.toLowerCase().includes(q) ||
        m.serie?.toLowerCase().includes(q) ||
        m.codeMoteur?.toLowerCase().includes(q) ||
        m.nomClient?.toLowerCase().includes(q) ||
        m.notes?.toLowerCase().includes(q) ||
        m.etatCommercial?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [moteurs, filtreStatut, filtreProprietaire, filtreEtapeRequise, filtreSlot, filtreEmploye, filtreMarque, filtreModele, filtreEpa, filtreGhg, filtreAnnee, hpMin, hpMax, recherche]);

  // Sections par statut pour l'affichage
  const sections = useMemo(() => {
    return {
      enCours:   filtres.filter(m => m.statut === 'en-cours'),
      enAttente: filtres.filter(m => m.statut === 'en-attente'),
      prets:     filtres.filter(m => m.statut === 'pret'),
      archives:  filtres.filter(m => m.statut === 'archive'),
    };
  }, [filtres]);

  const selected = selectedId ? moteurs.find(m => m.id === selectedId) ?? null : null;

  const filtresActifs = filtreStatut !== 'tous' || filtreProprietaire !== 'tous' || filtreEtapeRequise !== 'tous' || filtreSlot !== 'tous' || filtreEmploye !== 'tous' || filtreMarque !== 'tous' || filtreModele !== 'tous' || filtreEpa !== 'tous' || filtreGhg !== 'tous' || filtreAnnee !== 'tous' || hpMin || hpMax || recherche;

  const reinitialiser = () => {
    setFiltreStatut('tous'); setFiltreProprietaire('tous'); setFiltreEtapeRequise('tous'); setFiltreSlot('tous');
    setFiltreEmploye('tous');
    setFiltreMarque('tous'); setFiltreModele('tous'); setFiltreEpa('tous'); setFiltreGhg('tous'); setFiltreAnnee('tous');
    setHpMin(''); setHpMax(''); setRecherche('');
  };

  if (loading) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontFamily: 'monospace', fontSize: 14 }}>
        Chargement des moteurs...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: '#f8fafc' }}>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        marginRight: selected && !mobile ? 460 : 0, transition: 'margin-right 0.3s ease',
      }}>
        {/* ── En-tête ─────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: mobile ? '12px 14px' : '14px 24px',
          borderBottom: '2px solid #e5e7eb', background: 'white', flexShrink: 0,
          gap: 12, flexWrap: mobile ? 'wrap' : 'nowrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {mobile && onClose && (
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#6b7280', padding: 4 }}>←</button>
              )}
              <span style={{ fontSize: 26 }}>🛠️</span>
              <h1 style={{ fontSize: mobile ? 17 : 20, fontWeight: 700, color: COULEUR_MOTEUR, margin: 0 }}>Moteurs</h1>
            </div>
            <StatPill label="En attente" value={kpis.enAttente} color="#f59e0b" />
            <StatPill label="En cours"   value={kpis.enCours}   color="#3b82f6" />
            <StatPill label="Prêts"      value={kpis.prets}     color="#22c55e" />
            {!mobile && <StatPill label="Archivés" value={kpis.archives} color="#6b7280" />}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <input type="text" placeholder="Rechercher #, W/O, marque, modèle..."
              value={recherche} onChange={e => setRecherche(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #e5e7eb', fontSize: 13, width: mobile ? 160 : 240, outline: 'none', flex: mobile ? 1 : undefined, minWidth: 140 }} />
            <button onClick={() => setShowWizard(true)}
              style={{ background: COULEUR_MOTEUR, color: 'white', border: 'none', borderRadius: 8, padding: mobile ? '8px 12px' : '8px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              + Nouveau
            </button>
          </div>
        </div>

        {/* ── Barre de filtres principale ────────────────────── */}
        <div style={{
          display: 'flex', gap: 6, padding: mobile ? '8px 14px' : '10px 20px',
          borderBottom: '1px solid #e5e7eb', background: 'white', flexWrap: 'wrap', flexShrink: 0,
        }}>
          <FiltreBtn active={filtreStatut === 'tous'}       onClick={() => setFiltreStatut('tous')}       label={`Tous (${kpis.total})`} />
          <FiltreBtn active={filtreStatut === 'en-cours'}   onClick={() => setFiltreStatut('en-cours')}   label={`🚛 En cours (${kpis.enCours})`}     color="#3b82f6" />
          <FiltreBtn active={filtreStatut === 'pret'}       onClick={() => setFiltreStatut('pret')}       label={`✅ Prêts (${kpis.prets})`}          color="#22c55e" />
          <FiltreBtn active={filtreStatut === 'en-attente'} onClick={() => setFiltreStatut('en-attente')} label={`⏳ En attente (${kpis.enAttente})`} color="#f59e0b" />
          <FiltreBtn active={filtreStatut === 'archive'}    onClick={() => setFiltreStatut('archive')}    label={`📦 Archivés (${kpis.archives})`}    color="#6b7280" />

          <div style={{ width: 1, background: '#e5e7eb', margin: '0 4px', alignSelf: 'stretch' }} />

          {/* Étapes à faire */}
          {ENGINE_ETAPES.map(e => {
            const nb = countsParEtape[e.id];
            if (nb === 0) return null;
            return (
              <FiltreBtn key={e.id} active={filtreEtapeRequise === e.id} onClick={() => setFiltreEtapeRequise(filtreEtapeRequise === e.id ? 'tous' : e.id)}
                label={`${e.icon} ${e.label} (${nb})`} color={e.color} />
            );
          })}
        </div>

        {/* ── Filtre Employé (mécano) ────────────────────────── */}
        <div style={{
          display: 'flex', gap: 6, padding: mobile ? '6px 14px 8px' : '8px 20px 10px',
          borderBottom: '1px solid #e5e7eb', background: 'white', flexWrap: 'wrap', flexShrink: 0, alignItems: 'center',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>
            👤 Employé :
          </span>
          <FiltreBtn active={filtreEmploye === 'tous'} onClick={() => setFiltreEmploye('tous')} label="Tous" />
          <FiltreBtn active={filtreEmploye === 'aucun'} onClick={() => setFiltreEmploye('aucun')}
            label={`— Aucun assigné —`} color="#9ca3af" />
          {(() => {
            // Mécanos moteur d'abord, puis ceux ayant des moteurs liés (autres)
            const mecanos = employes.filter(e => e.departement === 'mecanique-moteur');
            const autresAvecMoteurs = employes.filter(e => e.departement !== 'mecanique-moteur' && countsParEmploye[e.id]);
            return (
              <>
                {mecanos.map(e => {
                  const c = countsParEmploye[e.id];
                  const total = c?.total ?? 0;
                  const enCours = c?.enCours ?? 0;
                  return (
                    <FiltreBtn key={e.id} active={filtreEmploye === e.id} onClick={() => setFiltreEmploye(filtreEmploye === e.id ? 'tous' : e.id)}
                      label={`${e.nom}${total > 0 ? ` (${total}${enCours > 0 ? ` · ${enCours} 🚛` : ''})` : ''}`}
                      color={enCours > 0 ? '#3b82f6' : '#7c3aed'} />
                  );
                })}
                {autresAvecMoteurs.length > 0 && mecanos.length > 0 && (
                  <div style={{ width: 1, background: '#e5e7eb', margin: '0 4px', alignSelf: 'stretch' }} />
                )}
                {autresAvecMoteurs.map(e => {
                  const c = countsParEmploye[e.id];
                  return (
                    <FiltreBtn key={e.id} active={filtreEmploye === e.id} onClick={() => setFiltreEmploye(filtreEmploye === e.id ? 'tous' : e.id)}
                      label={`${e.nom} (${c.total})`} color="#64748b" />
                  );
                })}
              </>
            );
          })()}
        </div>

        {/* ── Filtres propriétaire ───────────────────────────── */}
        <div style={{
          display: 'flex', gap: 6, padding: mobile ? '6px 14px 8px' : '8px 20px 10px',
          borderBottom: '1px solid #e5e7eb', background: '#fafbfc', flexWrap: 'wrap', flexShrink: 0, alignItems: 'center',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>
            Propriétaire :
          </span>
          <FiltreBtn active={filtreProprietaire === 'tous'}        onClick={() => setFiltreProprietaire('tous')}        label="Tous" />
          <FiltreBtn active={filtreProprietaire === 'interne'}     onClick={() => setFiltreProprietaire('interne')}     label={`🏢 Interne (${countsProprio.interne})`}         color="#64748b" />
          <FiltreBtn active={filtreProprietaire === 'client'}      onClick={() => setFiltreProprietaire('client')}      label={`👤 Client (${countsProprio.client})`}            color="#3b82f6" />
          <FiltreBtn active={filtreProprietaire === 'exportation'} onClick={() => setFiltreProprietaire('exportation')} label={`✈ Exportation (${countsProprio.exportation})`}   color="#7c3aed" />
          <FiltreBtn active={filtreProprietaire === 'inventaire'}  onClick={() => setFiltreProprietaire('inventaire')}  label={`📦 Inventaire (${countsProprio.inventaire})`}    color="#22c55e" />

          <div style={{ flex: 1 }} />

          <button onClick={() => setShowFiltresAvances(s => !s)}
            style={{
              padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700,
              border: `1px solid ${showFiltresAvances ? COULEUR_MOTEUR : '#e5e7eb'}`,
              background: showFiltresAvances ? `${COULEUR_MOTEUR}15` : 'white',
              color: showFiltresAvances ? COULEUR_MOTEUR : '#6b7280',
              cursor: 'pointer',
            }}>
            ⚙ Filtres avancés {showFiltresAvances ? '▲' : '▼'}
          </button>

          {filtresActifs && (
            <button onClick={reinitialiser}
              style={{ padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: '1px solid #fca5a5', background: 'white', color: '#dc2626', cursor: 'pointer' }}>
              ✕ Effacer
            </button>
          )}
        </div>

        {/* ── Filtres avancés (collapsible) ──────────────────── */}
        {showFiltresAvances && (
          <div style={{
            display: 'flex', gap: 12, padding: '10px 20px', borderBottom: '1px solid #e5e7eb',
            background: '#f8fafc', flexWrap: 'wrap', flexShrink: 0, alignItems: 'center',
          }}>
            {valeursDistinctes.marques.length > 0 && (
              <SelectMini label="Marque" value={filtreMarque} onChange={setFiltreMarque}
                options={[['tous', `Toutes (${valeursDistinctes.marques.length})`], ...valeursDistinctes.marques.map(m => [m, m] as [string, string])]} />
            )}
            {valeursDistinctes.modeles.length > 0 && (
              <SelectMini label="Modèle" value={filtreModele} onChange={setFiltreModele}
                options={[['tous', 'Tous'], ...valeursDistinctes.modeles.map(m => [m, m] as [string, string])]} />
            )}
            {valeursDistinctes.epas.length > 0 && (
              <SelectMini label="EPA" value={filtreEpa} onChange={setFiltreEpa}
                options={[['tous', 'Tous'], ...valeursDistinctes.epas.map(e => [e, e] as [string, string])]} />
            )}
            {valeursDistinctes.ghgs.length > 0 && (
              <SelectMini label="GHG" value={filtreGhg} onChange={setFiltreGhg}
                options={[['tous', 'Tous'], ...valeursDistinctes.ghgs.map(g => [g, g] as [string, string])]} />
            )}
            {valeursDistinctes.annees.length > 0 && (
              <SelectMini label="Année" value={filtreAnnee} onChange={setFiltreAnnee}
                options={[['tous', 'Toutes'], ...valeursDistinctes.annees.map(a => [String(a), String(a)] as [string, string])]} />
            )}
            <SelectMini label="Emplacement" value={filtreSlot} onChange={setFiltreSlot}
              options={[
                ['tous', 'Tous'],
                ['aucun', 'Aucun (à placer)'],
                ...ENGINE_SLOTS.map(s => [s.id, s.label] as [string, string]),
              ]} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>HP :</span>
              <input type="number" value={hpMin} onChange={e => setHpMin(e.target.value)} placeholder="min"
                style={{ width: 56, padding: '5px 8px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 12, outline: 'none', background: 'white' }} />
              <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>
              <input type="number" value={hpMax} onChange={e => setHpMax(e.target.value)} placeholder="max"
                style={{ width: 56, padding: '5px 8px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 12, outline: 'none', background: 'white' }} />
            </div>
          </div>
        )}

        {/* ── Liste des moteurs ──────────────────────────────── */}
        {moteurs.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#9ca3af' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🛠️</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Aucun moteur pour l'instant</div>
            <div style={{ fontSize: 14 }}>Clique sur « + Nouveau » pour commencer</div>
          </div>
        ) : filtres.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#9ca3af' }}>
            <div style={{ fontSize: 14, marginBottom: 12 }}>Aucun moteur ne correspond aux filtres.</div>
            <button onClick={reinitialiser} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #fca5a5', background: 'white', color: '#dc2626', fontWeight: 600, cursor: 'pointer' }}>
              ✕ Effacer les filtres
            </button>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {/* Bandeau résumé quand filtré par employé */}
            {filtreEmploye !== 'tous' && filtreEmploye !== 'aucun' && (() => {
              const emp = employes.find(e => e.id === filtreEmploye);
              const c = countsParEmploye[filtreEmploye];
              if (!emp) return null;
              return (
                <div style={{ padding: '12px 20px', background: '#ede9fe', borderBottom: '1px solid #c4b5fd', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 18 }}>👤</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#6d28d9' }}>{emp.nom}</span>
                  <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#6d28d9' }}>
                    <span>🚛 <strong>{c?.enCours ?? 0}</strong> en cours</span>
                    <span>✅ <strong>{c?.termine ?? 0}</strong> étapes terminées</span>
                    <span>📋 <strong>{c?.total ?? 0}</strong> moteurs au total</span>
                  </div>
                </div>
              );
            })()}

            {sections.enCours.length > 0 && (
              <>
                <SectionHeaderCard label="🚛 En cours" color="#3b82f6" count={sections.enCours.length} />
                {sections.enCours.map(m => (
                  <CarteMoteur key={m.id} m={m} mobile={mobile} selected={selectedId === m.id}
                    employeIdHighlight={filtreEmploye !== 'tous' && filtreEmploye !== 'aucun' ? filtreEmploye : undefined}
                    onClick={() => setSelectedId(m.id === selectedId ? null : m.id)} />
                ))}
              </>
            )}
            {sections.prets.length > 0 && (
              <>
                <SectionHeaderCard label="✅ Prêts à livrer" color="#22c55e" count={sections.prets.length} />
                {sections.prets.map(m => (
                  <CarteMoteur key={m.id} m={m} mobile={mobile} selected={selectedId === m.id}
                    employeIdHighlight={filtreEmploye !== 'tous' && filtreEmploye !== 'aucun' ? filtreEmploye : undefined}
                    onClick={() => setSelectedId(m.id === selectedId ? null : m.id)} />
                ))}
              </>
            )}
            {sections.enAttente.length > 0 && (
              <>
                <SectionHeaderCard label="⏳ En attente" color="#f59e0b" count={sections.enAttente.length} />
                {sections.enAttente.map(m => (
                  <CarteMoteur key={m.id} m={m} mobile={mobile} selected={selectedId === m.id}
                    employeIdHighlight={filtreEmploye !== 'tous' && filtreEmploye !== 'aucun' ? filtreEmploye : undefined}
                    onClick={() => setSelectedId(m.id === selectedId ? null : m.id)} />
                ))}
              </>
            )}
            {sections.archives.length > 0 && (
              <>
                <SectionHeaderCard label="📦 Archivés" color="#6b7280" count={sections.archives.length} />
                {sections.archives.map(m => (
                  <CarteMoteur key={m.id} m={m} mobile={mobile} selected={selectedId === m.id}
                    employeIdHighlight={filtreEmploye !== 'tous' && filtreEmploye !== 'aucun' ? filtreEmploye : undefined}
                    onClick={() => setSelectedId(m.id === selectedId ? null : m.id)} />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Wizard création ────────────────────────────── */}
      {showWizard && <WizardMoteur onClose={() => setShowWizard(false)} onCree={(id) => { setShowWizard(false); setSelectedId(id); }} />}

      {/* ── Panneau détail ─────────────────────────────── */}
      {selected && <PanneauDetailMoteur moteur={selected} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

// ── StatPill ─────────────────────────────────────────────────────
function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 12, color: '#6b7280' }}>{label}</span>
      <span style={{ background: color, color: 'white', fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 10, minWidth: 20, textAlign: 'center' }}>
        {value}
      </span>
    </div>
  );
}

// ── Select mini (filtres avancés) ────────────────────────────────
function SelectMini({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: [string, string][];
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>{label} :</span>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 12, background: 'white', cursor: 'pointer', outline: 'none' }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

// ── Carte moteur ─────────────────────────────────────────────────
function CarteMoteur({ m, onClick, mobile, selected, employeIdHighlight }: {
  m: Moteur; onClick: () => void; mobile?: boolean; selected?: boolean;
  employeIdHighlight?: string;
}) {
  const enCours = etapeEnCoursMoteur(m);
  const prochaine = prochaineEtapeMoteur(m);
  const restantes = etapesRestantesMoteur(m);
  const pct = progressionMoteur(m);
  const slot = m.posteCourant ? getEngineSlot(m.posteCourant) : null;
  const statutCfg = STATUT_CONFIG[m.statut];
  const etapeShown = enCours ?? prochaine;
  const etapeMeta = etapeShown ? getEngineEtape(etapeShown.etapeId) : null;

  return (
    <div onClick={onClick}
      style={{
        display: 'flex', alignItems: 'stretch',
        background: selected ? `${COULEUR_MOTEUR}06` : 'white',
        borderBottom: '1px solid #e5e7eb',
        borderLeft: `4px solid ${statutCfg.color}`,
        cursor: 'pointer', transition: 'all 0.15s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
      onMouseEnter={e => { if (!selected) { (e.currentTarget as HTMLDivElement).style.background = '#f0f4ff'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; } }}
      onMouseLeave={e => { if (!selected) { (e.currentTarget as HTMLDivElement).style.background = 'white'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; } }}
    >
      {/* Photo + numéro + description */}
      <div style={{ width: mobile ? 'auto' : 340, minWidth: mobile ? 0 : 340, flex: mobile ? 1 : '0 0 auto', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 50, height: 50, borderRadius: 8, flexShrink: 0,
          background: m.photoUrl ? `url(${m.photoUrl}) center/cover` : `${COULEUR_MOTEUR}15`,
          border: `1px solid ${m.photoUrl ? '#e5e7eb' : `${COULEUR_MOTEUR}40`}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
        }}>
          {!m.photoUrl && '🛠️'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 800, color: COULEUR_MOTEUR }}>
              #{m.stkNumero}
            </span>
            {m.workOrder && (
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#6b7280', background: '#f3f4f6', padding: '1px 5px', borderRadius: 3 }}>
                W/O {m.workOrder}
              </span>
            )}
            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 3, background: statutCfg.bg, color: statutCfg.color, textTransform: 'uppercase' }}>
              {statutCfg.icon} {statutCfg.label}
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#374151', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', overflow: 'hidden' }}>
            {m.marque && <span style={{ color: COULEUR_MOTEUR, fontWeight: 800 }}>{m.marque}</span>}
            {m.modele && <span>{m.modele}</span>}
            {m.serie && <span style={{ color: '#6b7280', fontSize: 11, fontFamily: 'monospace' }}>{m.serie}</span>}
            {m.annee && <span style={{ color: '#6b7280', fontSize: 11 }}>({m.annee})</span>}
            {m.epa && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: '#dbeafe', color: '#1e40af', fontWeight: 700 }}>{m.epa}</span>}
            {m.ghg && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: '#dcfce7', color: '#166534', fontWeight: 700 }}>{m.ghg}</span>}
            {m.puissanceHp && <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 700, fontFamily: 'monospace' }}>{m.puissanceHp} HP</span>}
            {!m.marque && !m.descriptionMoteur && <em style={{ color: '#9ca3af' }}>Pas de description</em>}
          </div>
          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span>{PROPRIO_LABEL[m.proprietaire]}{m.nomClient ? ` · ${m.nomClient}` : ''}</span>
            {m.etatCommercial && <span style={{ color: '#92400e', fontWeight: 600 }}>· {m.etatCommercial}</span>}
            {m.notes && <span title={m.notes} style={{ color: '#dc2626', fontWeight: 600 }}>⚠ {m.notes.slice(0, 40)}{m.notes.length > 40 ? '…' : ''}</span>}
          </div>

          {/* Détail employé filtré : ce qu'il a fait / fait sur ce moteur */}
          {employeIdHighlight && (() => {
            const empEtapes = m.roadMap.filter(e => e.employeId === employeIdHighlight);
            const estCourant = m.employeCourant === employeIdHighlight;
            if (empEtapes.length === 0 && !estCourant) return null;
            return (
              <div style={{ marginTop: 4, padding: '4px 8px', background: '#f5f3ff', borderLeft: '3px solid #7c3aed', borderRadius: 3, display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 10 }}>
                {estCourant && !empEtapes.some(e => e.statut === 'en-cours') && (
                  <span style={{ color: '#6d28d9', fontWeight: 700 }}>👤 Attitré (pas démarré)</span>
                )}
                {empEtapes.map(e => {
                  const meta = getEngineEtape(e.etapeId);
                  if (!meta) return null;
                  const cfg =
                    e.statut === 'en-cours' ? { bg: '#dbeafe', color: '#1e40af', icon: '🚛' } :
                    e.statut === 'termine'  ? { bg: '#dcfce7', color: '#166534', icon: '✅' } :
                    e.statut === 'saute'    ? { bg: '#fef3c7', color: '#92400e', icon: '⏭' } :
                                              { bg: '#f3f4f6', color: '#6b7280', icon: '⏸' };
                  return (
                    <span key={e.id} style={{ padding: '1px 6px', borderRadius: 3, background: cfg.bg, color: cfg.color, fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {cfg.icon} {meta.icon} {meta.label}
                      {e.dureeMinutes !== undefined && (
                        <span style={{ marginLeft: 4, opacity: 0.8 }}>
                          {e.dureeMinutes >= 60 ? `${Math.floor(e.dureeMinutes / 60)}h${e.dureeMinutes % 60 ? ` ${e.dureeMinutes % 60}min` : ''}` : `${e.dureeMinutes}min`}
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Étape + Progression + Emplacement (desktop seulement) */}
      {!mobile && (
        <>
          <div style={{ flex: 1, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Étape */}
            <div style={{ minWidth: 180, flex: 1 }}>
              <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                Étape
              </div>
              {etapeShown && etapeMeta ? (
                <div style={{ fontSize: 12, fontWeight: 700, color: etapeMeta.color }}>
                  {enCours ? '🚛 ' : '⏭ '}{etapeMeta.icon} {etapeMeta.label}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: m.statut === 'pret' ? '#22c55e' : '#9ca3af', fontWeight: 700 }}>
                  {m.statut === 'pret' ? '✅ Toutes faites' : '—'}
                </div>
              )}
            </div>

            {/* Progression */}
            <div style={{ minWidth: 110 }}>
              <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Progression
              </div>
              <div style={{ width: 100, height: 5, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#22c55e' : pct >= 50 ? '#3b82f6' : '#f59e0b' }} />
              </div>
              <div style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, color: '#374151', marginTop: 2 }}>
                {pct}% · {restantes.length} reste
              </div>
            </div>

            {/* Emplacement */}
            <div style={{ minWidth: 140 }}>
              <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                Emplacement
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: slot ? COULEUR_MOTEUR : '#9ca3af' }}>
                {slot ? `📍 ${slot.label}` : '— Aucun'}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Mobile : étape + progression + emplacement empilés à droite */}
      {mobile && (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '8px 12px', borderLeft: '1px solid #f1f5f9', minWidth: 90, gap: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', fontFamily: 'monospace' }}>{pct}%</div>
          {etapeMeta && (
            <div style={{ fontSize: 10, color: etapeMeta.color, fontWeight: 600 }}>
              {etapeMeta.icon}
            </div>
          )}
          {slot && (
            <div style={{ fontSize: 9, color: COULEUR_MOTEUR, fontWeight: 700 }}>📍 {slot.label.slice(0, 8)}</div>
          )}
        </div>
      )}
    </div>
  );
}
