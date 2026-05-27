// ════════════════════════════════════════════════════════════════
// Agendrix Import Service — Module Main-d'œuvre
//
// Parse le rapport "Entrées de temps" Agendrix (.xlsx) et alimente
// prod_agendrix_heures (remplacement complet par semaine).
//
// Identification des employés : via no_employe_acomba (Numéro
// d'employé dans Agendrix = même code que Acomba).
// ════════════════════════════════════════════════════════════════

import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────

export type AgendrixType = 'quart' | 'conge_paye' | 'conge_non_paye' | 'banque_heures';
export type AgendrixTypeConge =
  | 'ferie'
  | 'vacances'
  | 'maladie'
  | 'absence_solde'
  | 'cnesst'
  | 'temps_accumule'
  | null;

export interface AgendrixEntree {
  noEmployeAcomba: string;   // '82-1558', '1387', '' si inconnu
  prenom: string;
  nomAgendrix: string;
  date: string;              // 'YYYY-MM-DD'
  type: AgendrixType;
  typeConge: AgendrixTypeConge;
  heures: number;
  succursale: string;
  positionEmploye: string;
}

export interface AgendrixParse {
  entrees: AgendrixEntree[];
  semaineDebut: string;      // 'YYYY-MM-DD'
  semaineFin: string;        // 'YYYY-MM-DD'
  nbEmployes: number;
  sansCle: string[];         // prénom+nom des employés sans numéro Acomba
  erreurs: string[];
}

export interface AgendrixImportResult {
  nbEntrees: number;
  nbEmployesLies: number;
  nbEmployesNonLies: number;
  sansCle: string[];
  semaine: string;
}

// ─── Analytics ────────────────────────────────────────────────────

export interface AgendrixAnalyseEmploye {
  noEmployeAcomba: string;
  prenom: string | null;
  nomAgendrix: string | null;
  employeId: string | null;
  nomComplet: string | null;        // depuis prod_employes
  tauxHoraire: number | null;
  salaireHebdo: number | null;
  succursale: string | null;
  hQuart: number;
  hFerie: number;
  hVacancesPaye: number;
  hMaladiePaye: number;
  hCongePayeAutre: number;
  hAbsentTotal: number;             // congés NON payés (absentéisme)
  hBanque: number;
  hTotalPaye: number;               // quart + tous congés payés
  coutPrevu: number;                // hTotalPaye × taux | salaire_hebdo si salarié
  estSalarieSansPointage?: boolean; // vrai si salarié fixe absent de l'export Agendrix
}

// ─── Helpers de normalisation ─────────────────────────────────────

/** Supprime les accents pour la comparaison */
function deaccent(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function normalizeType(raw: string): AgendrixType {
  const r = deaccent(raw?.trim() ?? '');
  if (r === 'quart') return 'quart';
  if (r.includes('non pay')) return 'conge_non_paye';
  if (r.includes('pay')) return 'conge_paye';
  if (r.includes('banque')) return 'banque_heures';
  return 'quart'; // fallback sécuritaire
}

function normalizeTypeConge(raw: string): AgendrixTypeConge {
  if (!raw || raw.trim() === '') return null;
  const r = deaccent(raw.trim());
  if (r.includes('cnesst'))                       return 'cnesst';
  if (r.includes('ferie') || r === 'feri')        return 'ferie';
  if (r.includes('vacan'))                        return 'vacances';
  if (r.includes('solde') || r.includes('absence')) return 'absence_solde';
  if (r.includes('maladie'))                      return 'maladie';
  if (r.includes('accumul') || r.includes('temps accum')) return 'temps_accumule';
  return null;
}

function parseNoEmploye(val: unknown): string {
  if (val == null || val === '') return '';
  if (typeof val === 'number') return String(Math.round(val));
  return String(val).trim();
}

function parseHeures(val: unknown): number {
  if (typeof val === 'number') return Math.max(0, val);
  if (typeof val === 'string') {
    const n = parseFloat(val.replace(',', '.'));
    return isNaN(n) ? 0 : Math.max(0, n);
  }
  return 0;
}

function parseXLSXDate(val: unknown): string | null {
  if (val instanceof Date) {
    // Ajuster pour éviter les problèmes de fuseau horaire
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof val === 'string') {
    const match = val.match(/(\d{4})-(\d{2})-(\d{2})/);
    return match ? match[0] : null;
  }
  return null;
}

// ─── Parsing ──────────────────────────────────────────────────────

/**
 * Parse le rapport Agendrix "Entrées de temps" (.xlsx).
 * Utilise uniquement la feuille "Sommaire" (toutes succursales).
 */
export async function parseAgendrixXLSX(file: File): Promise<AgendrixParse> {
  const erreurs: string[] = [];

  // Lecture du fichier
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

  // On prend le Sommaire (première feuille ou celle nommée Sommaire/Summary)
  const sheetName = wb.SheetNames.find(n =>
    n.toLowerCase().includes('sommaire') || n.toLowerCase().includes('summary')
  ) ?? wb.SheetNames[0];

  if (!sheetName) throw new Error('Aucune feuille trouvée dans le fichier Excel.');

  const ws = wb.Sheets[sheetName];
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: true,
    defval: null,
  }) as unknown[][];

  if (rawRows.length < 7) throw new Error('Le fichier semble vide ou mal formaté.');

  // ── Extraction des dates de la semaine depuis la ligne d'entête ──
  // Row 0 : ['Date', '2026-05-17 à 2026-05-23', ...]
  const headerDateRaw = String(rawRows[0]?.[1] ?? '');
  const datesFound = headerDateRaw.match(/\d{4}-\d{2}-\d{2}/g);
  let semaineDebut = '';
  let semaineFin   = '';
  if (datesFound && datesFound.length >= 2) {
    semaineDebut = datesFound[0];
    semaineFin   = datesFound[1];
  } else if (datesFound && datesFound.length === 1) {
    semaineDebut = semaineFin = datesFound[0];
  } else {
    erreurs.push(`Impossible de lire la période depuis l'en-tête : "${headerDateRaw}"`);
  }

  // ── Lignes de données : à partir de l'index 6 (row 5 = headers, row 6+ = data) ──
  const dataRows = rawRows.slice(6).filter(r => r && r[0] != null);

  // Colonnes (0-based) :
  // 0:Prénom 1:Nom 2:No_employé 3:Type 4:Type_congé 5:Date 6:Début 7:Fin
  // 8:Pause_non_payée 9:Pause_payée 10:Succursale 11:Position 12:Term_in 13:Term_out 14:Total(h)

  const entrees: AgendrixEntree[] = [];
  const employesVus = new Set<string>();
  const sansCle: string[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const prenom     = String(row[0] ?? '').trim();
    const nom        = String(row[1] ?? '').trim();
    const noAcomba   = parseNoEmploye(row[2]);
    const typeRaw    = String(row[3] ?? '').trim();
    const congeRaw   = String(row[4] ?? '').trim();
    const dateRaw    = row[5];
    const heures     = parseHeures(row[14]);
    const succursale = String(row[10] ?? '').trim();
    const position   = String(row[11] ?? '').trim();

    if (!prenom && !nom) continue;
    if (heures === 0 && typeRaw === 'Quart') continue; // Quart à 0h = inutile

    const dateStr = parseXLSXDate(dateRaw);
    if (!dateStr) {
      erreurs.push(`Ligne ${i + 7} : date invalide pour ${prenom} ${nom}`);
      continue;
    }

    const type      = normalizeType(typeRaw);
    const typeConge = normalizeTypeConge(congeRaw);

    const cle = noAcomba || `${prenom}_${nom}`;
    if (!employesVus.has(cle)) {
      employesVus.add(cle);
      if (!noAcomba) {
        sansCle.push(`${prenom} ${nom}`);
      }
    }

    entrees.push({
      noEmployeAcomba: noAcomba,
      prenom,
      nomAgendrix: nom,
      date: dateStr,
      type,
      typeConge,
      heures,
      succursale,
      positionEmploye: position,
    });
  }

  return {
    entrees,
    semaineDebut,
    semaineFin,
    nbEmployes: employesVus.size,
    sansCle,
    erreurs,
  };
}

// ─── Import ───────────────────────────────────────────────────────

/**
 * Insère les entrées Agendrix dans prod_agendrix_heures.
 * Remplace TOUTES les entrées de la semaine (DELETE → INSERT).
 */
export async function executeAgendrixImport(
  parse: AgendrixParse,
  filename: string,
  userNom?: string | null,
): Promise<AgendrixImportResult> {

  if (!parse.semaineDebut) throw new Error('Semaine de début non détectée. Vérifiez le fichier.');
  if (parse.entrees.length === 0) throw new Error('Aucune entrée valide trouvée dans le fichier.');

  // 1. Charger les employés pour résoudre employe_id via no_employe_acomba ou nom
  const { data: empsRaw } = await supabase
    .from('prod_employes')
    .select('id, no_employe_acomba, nom_complet, nom');

  // Index par numéro Acomba
  const empMap: Record<string, string> = {};
  // Normalisation nom (même algo que getAgendrixAnalyse)
  const normNomImport = (s: string) =>
    s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[''`´]/g, "'").replace(/\s+/g, ' ').trim();

  // Index par nom normalisé → id
  const empByNomImport: Record<string, string> = {};
  for (const e of (empsRaw ?? []) as any[]) {
    if (e.no_employe_acomba) empMap[String(e.no_employe_acomba).trim()] = e.id;
    const nomFull = normNomImport(e.nom_complet ?? e.nom ?? '');
    if (nomFull) empByNomImport[nomFull] = e.id;
  }

  // Résolution : numéro → nom (PRENOM NOM) → nom (NOM PRENOM)
  function resolveEmployeId(noAcomba: string, prenom: string | null, nomAg: string | null): string | null {
    const byNum = empMap[noAcomba.trim()];
    if (byNum) return byNum;
    if (prenom || nomAg) {
      const v1 = normNomImport(`${prenom ?? ''} ${nomAg ?? ''}`);
      const v2 = normNomImport(`${nomAg ?? ''} ${prenom ?? ''}`);
      return empByNomImport[v1] ?? empByNomImport[v2] ?? null;
    }
    return null;
  }

  // 2. Supprimer les entrées existantes pour cette semaine
  const { error: delErr } = await supabase
    .from('prod_agendrix_heures')
    .delete()
    .eq('semaine_debut', parse.semaineDebut);
  if (delErr) throw new Error(`Erreur suppression semaine : ${delErr.message}`);

  // 3. Préparer et insérer les nouvelles entrées
  const rows = parse.entrees.map(e => ({
    employe_id:        resolveEmployeId(e.noEmployeAcomba, e.prenom ?? null, e.nomAgendrix ?? null),
    no_employe_acomba: e.noEmployeAcomba,
    prenom:            e.prenom || null,
    nom_agendrix:      e.nomAgendrix || null,
    semaine_debut:     parse.semaineDebut,
    date_entree:       e.date,
    type:              e.type,
    type_conge:        e.typeConge,
    heures:            e.heures,
    succursale:        e.succursale || null,
    position_employe:  e.positionEmploye || null,
  }));

  const { error: insErr } = await supabase
    .from('prod_agendrix_heures')
    .insert(rows);
  if (insErr) throw new Error(`Erreur insertion : ${insErr.message}`);

  // 4. Log dans prod_imports_log
  const nbLies    = rows.filter(r => r.employe_id !== null).length;
  const nbNonLies = rows.filter(r => r.employe_id === null).length;

  await supabase.from('prod_imports_log').insert({
    type_import:        'agendrix_heures',
    filename,
    user_nom:           userNom ?? null,
    nb_camions_analyses: parse.nbEmployes,
    notes:              `Semaine ${parse.semaineDebut}→${parse.semaineFin} · ${rows.length} entrées · ${nbLies} liés · ${nbNonLies} non liés`,
    status:             'completed',
  });

  return {
    nbEntrees:         rows.length,
    nbEmployesLies:    nbLies,
    nbEmployesNonLies: nbNonLies,
    sansCle:           parse.sansCle,
    semaine:           parse.semaineDebut,
  };
}

// ─── Analytics ────────────────────────────────────────────────────

/** Retourne la liste des semaines importées (les plus récentes en premier). */
export async function getAgendrixSemaines(): Promise<string[]> {
  const { data } = await supabase
    .from('prod_agendrix_heures')
    .select('semaine_debut')
    .order('semaine_debut', { ascending: false });

  if (!data) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const r of data as any[]) {
    if (!seen.has(r.semaine_debut)) {
      seen.add(r.semaine_debut);
      result.push(r.semaine_debut);
    }
  }
  return result;
}

/** Retourne l'analyse agrégée par employé pour une semaine donnée. */
export async function getAgendrixAnalyse(semaine: string): Promise<AgendrixAnalyseEmploye[]> {
  // Entrées brutes de la semaine
  const { data: rows } = await supabase
    .from('prod_agendrix_heures')
    .select('*')
    .eq('semaine_debut', semaine);

  // Employés pour les taux (actif requis pour les injectés fantômes)
  const { data: emps } = await supabase
    .from('prod_employes')
    .select('id, nom_complet, nom, no_employe_acomba, taux_horaire, salaire_hebdomadaire, actif');

  const empById: Record<string, { nomComplet: string | null; taux: number | null; hebdo: number | null }> = {};
  // Index par no_employe_acomba
  const empByNoAcomba: Record<string, string> = {};
  // Index par nom normalisé (pour les contracteurs sans numéro Acomba)
  const empByNom: Record<string, string> = {};

  // Normalise un nom : majuscules, apostrophes uniformes, espaces multiples
  const normNom = (s: string) =>
    s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[''`´]/g, "'").replace(/\s+/g, ' ').trim();

  for (const e of (emps ?? []) as any[]) {
    empById[e.id] = {
      nomComplet: e.nom_complet ?? e.nom ?? null,
      taux:       e.taux_horaire ?? null,
      hebdo:      e.salaire_hebdomadaire ?? null,
    };
    if (e.no_employe_acomba) {
      empByNoAcomba[String(e.no_employe_acomba).trim()] = e.id;
    }
    // Indexer aussi par nom normalisé (fallback pour contracteurs sans numéro)
    const nomFull = normNom(e.nom_complet ?? e.nom ?? '');
    if (nomFull) empByNom[nomFull] = e.id;
  }

  // Résolution nom : essaie "PRENOM NOM" et "NOM PRENOM"
  const resolveByNom = (prenom: string | null, nomAg: string | null): string | null => {
    if (!prenom && !nomAg) return null;
    const v1 = normNom(`${prenom ?? ''} ${nomAg ?? ''}`);
    const v2 = normNom(`${nomAg ?? ''} ${prenom ?? ''}`);
    return empByNom[v1] ?? empByNom[v2] ?? null;
  };

  // Agrégation par no_employe_acomba (ou prenom_nom si pas de clé)
  type Agg = {
    noAcomba: string; prenom: string | null; nomAg: string | null;
    employeId: string | null; succursales: Record<string, number>;
    hQuart: number; hFerie: number; hVacPaye: number; hMalPaye: number;
    hCPayeAutre: number; hAbsent: number; hBanque: number;
  };
  const map = new Map<string, Agg>();

  for (const r of (rows ?? []) as any[]) {
    const key = r.no_employe_acomba || `_${r.prenom}_${r.nom_agendrix}`;
    let agg = map.get(key);
    if (!agg) {
      agg = {
        noAcomba: r.no_employe_acomba, prenom: r.prenom, nomAg: r.nom_agendrix,
        employeId: r.employe_id, succursales: {},
        hQuart: 0, hFerie: 0, hVacPaye: 0, hMalPaye: 0,
        hCPayeAutre: 0, hAbsent: 0, hBanque: 0,
      };
    }

    const h = Number(r.heures ?? 0);
    if (r.succursale) agg.succursales[r.succursale] = (agg.succursales[r.succursale] ?? 0) + h;

    switch (r.type) {
      case 'quart':
        agg.hQuart += h; break;
      case 'conge_paye':
        if (r.type_conge === 'ferie')         agg.hFerie += h;
        else if (r.type_conge === 'vacances') agg.hVacPaye += h;
        else if (r.type_conge === 'maladie')  agg.hMalPaye += h;
        else                                  agg.hCPayeAutre += h;
        break;
      case 'conge_non_paye':
        agg.hAbsent += h; break;
      case 'banque_heures':
        agg.hBanque += h; break;
    }

    map.set(key, agg);
  }

  // Transformer en tableau avec coûts
  const result: AgendrixAnalyseEmploye[] = [];
  for (const agg of map.values()) {
    // Si l'import n'a pas pu lier l'employé (employe_id = null) :
    // 1. Essai par no_employe_acomba
    // 2. Essai par nom (pour contracteurs sans numéro Acomba, ex: ylitalien)
    const resolvedId = agg.employeId
      ?? (agg.noAcomba ? empByNoAcomba[String(agg.noAcomba).trim()] ?? null : null)
      ?? resolveByNom(agg.prenom, agg.nomAg);
    const emp = resolvedId ? empById[resolvedId] : null;
    const taux  = emp?.taux ?? null;
    const hebdo = emp?.hebdo ?? null;
    const hTotalPaye = agg.hQuart + agg.hFerie + agg.hVacPaye + agg.hMalPaye + agg.hCPayeAutre;

    let coutPrevu = 0;
    if (hebdo != null && hebdo > 0) {
      // Salarié : coût fixe hebdomadaire
      coutPrevu = hebdo;
    } else if (taux != null && taux > 0) {
      // Horaire : heures payées × taux
      coutPrevu = hTotalPaye * taux;
    }

    // Succursale principale (la plus d'heures)
    let succPrincipale: string | null = null;
    let maxH = 0;
    for (const [s, h] of Object.entries(agg.succursales)) {
      if (h > maxH) { maxH = h; succPrincipale = s; }
    }

    result.push({
      noEmployeAcomba: agg.noAcomba,
      prenom:          agg.prenom,
      nomAgendrix:     agg.nomAg,
      employeId:       resolvedId,
      nomComplet:      emp?.nomComplet ?? null,
      tauxHoraire:     taux,
      salaireHebdo:    hebdo,
      succursale:      succPrincipale,
      hQuart:          agg.hQuart,
      hFerie:          agg.hFerie,
      hVacancesPaye:   agg.hVacPaye,
      hMaladiePaye:    agg.hMalPaye,
      hCongePayeAutre: agg.hCPayeAutre,
      hAbsentTotal:    agg.hAbsent,
      hBanque:         agg.hBanque,
      hTotalPaye,
      coutPrevu,
    });
  }

  // ── Injection des salariés fixes absents de l'export Agendrix ──
  // Ces employés ont un salaire_hebdomadaire > 0 mais ne pointent pas leurs heures.
  // Leur coût est réel chaque semaine → on les affiche avec 0 h mais coutPrevu = salaire_hebdo.
  const empIdsPresents = new Set(result.map(r => r.employeId).filter(Boolean));
  for (const e of (emps ?? []) as any[]) {
    if (!e.actif) continue;                          // inactif → ignoré
    if (empIdsPresents.has(e.id)) continue;          // déjà dans l'export Agendrix
    const hebdo: number | null = e.salaire_hebdomadaire ?? null;
    if (!hebdo || hebdo <= 0) continue;              // pas salarié fixe → ignoré (horaire = 0 h = 0 $)
    result.push({
      noEmployeAcomba:        e.no_employe_acomba ?? '',
      prenom:                 null,
      nomAgendrix:            null,
      employeId:              e.id,
      nomComplet:             e.nom_complet ?? e.nom ?? null,
      tauxHoraire:            e.taux_horaire ?? null,
      salaireHebdo:           hebdo,
      succursale:             null,
      hQuart:                 0,
      hFerie:                 0,
      hVacancesPaye:          0,
      hMaladiePaye:           0,
      hCongePayeAutre:        0,
      hAbsentTotal:           0,
      hBanque:                0,
      hTotalPaye:             0,
      coutPrevu:              hebdo,
      estSalarieSansPointage: true,
    });
  }

  // Tri : employés Agendrix (heures > 0) en premier, salariés fixes ensuite
  return result.sort((a, b) => {
    if (a.estSalarieSansPointage !== b.estSalarieSansPointage)
      return a.estSalarieSansPointage ? 1 : -1;
    return (b.hQuart + b.hFerie) - (a.hQuart + a.hFerie);
  });
}

/**
 * Retourne le coût total réel (Agendrix) pour une période donnée.
 * Cherche toutes les semaines Agendrix qui chevauchent la période from→to.
 * Si from/to sont null → toutes les semaines disponibles.
 */
export async function getAgendrixCoutPeriode(
  from: string | null,
  to:   string | null,
): Promise<{ cout: number; coutAvecCharges: number; nbSemaines: number } | null> {
  // Agendrix = semaines dim→sam ; iTrack = semaines lun→dim
  // Une semaine Agendrix qui commence jusqu'à 6 jours avant `from` peut quand même chevaucher la période.
  // Ex: iTrack semaine 18-24 mai, Agendrix semaine_debut 17 mai → chevauche (17+6=23 ≥ 18)
  const fromAdjusted = from
    ? new Date(new Date(from).getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    : null;

  let q = supabase.from('prod_agendrix_heures').select('semaine_debut');
  if (fromAdjusted) q = q.gte('semaine_debut', fromAdjusted);
  if (to)           q = q.lte('semaine_debut', to);

  const { data } = await q;
  if (!data || data.length === 0) return null;

  // Semaines uniques
  const semaines = [...new Set((data as any[]).map(r => r.semaine_debut as string))];

  // Analyser chaque semaine et sommer les coûts prévus
  const analyses = await Promise.all(semaines.map(s => getAgendrixAnalyse(s)));
  const cout = analyses.flat().reduce((s, e) => s + e.coutPrevu, 0);

  return {
    cout,
    coutAvecCharges: cout * 1.23,
    nbSemaines: semaines.length,
  };
}
