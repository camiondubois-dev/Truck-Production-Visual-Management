// ════════════════════════════════════════════════════════════════
// Labor Log Import Service — Phase 2 du module Main-d'œuvre
//
// Parse les exports iTrack "Labor Log By Employee" (CSV) et alimente
// 3 tables : prod_employes (auto-create) + prod_work_orders (upsert)
// + prod_heures_employes (remplacement par période).
// ════════════════════════════════════════════════════════════════

import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────

/** Statut du camion référencé par un WO interne, après cross-check DB */
export type CamionStatut =
  | 'inventaire'       // dans prod_inventaire, pas (encore) vendu
  | 'vendu'            // dans prod_ventes statut='vendu' ou prod_inventaire etat_commercial='vendu'
  | 'inconnu'          // numéro valide mais introuvable dans les bases
  | 'travaux_pieces';  // pas un vrai numéro de stock (PIECES-X, 33214-1, # TEMPORAIRE...)

export interface LaborEntry {
  employeCode:     string;         // ex: 'atormis'
  woNumero:        string;         // ex: '1-32513'
  statutBrut:      string;         // 'Open' | 'Closed'
  typeBrut:        string;         // 'Build Order (Internal)' | 'Service Order (External)' | ...
  typeNormalise:   'interne' | 'externe';
  statutNormalise: 'ouvert' | 'ferme';
  customerOrPart:  string;         // si interne → stock_numero, si externe → nom client
  heures:          number;
  // Enrichi après cross-check DB (uniquement pour les WO internes)
  camionStatut?:   CamionStatut;
  camionMarque?:   string | null;
  camionModele?:   string | null;
  camionAnnee?:    number | null;
}

export interface LaborLogParse {
  entries:      LaborEntry[];      // dédupliquées par (employeCode, woNumero)
  totalLignes:  number;             // nb lignes lues dans le CSV (avant dedupe)
  periodeDebut: string | null;     // 'YYYY-MM-DD'
  periodeFin:   string | null;     // 'YYYY-MM-DD'
  erreurs:      string[];
}

export interface LaborDiff {
  // Employés
  employesNouveaux:  string[];        // codes iTrac inconnus dans prod_employes
  employesConnus:    number;          // codes déjà mappés
  // WO
  wosNouveaux:       number;          // wo_numero pas encore dans prod_work_orders
  wosExistants:      number;
  // Heures
  heuresExistantes:  number;          // déjà dans la période (seront remplacées)
  heuresAImporter:   number;
  totalHeuresImport: number;          // somme des heures à insérer
}

export interface LaborImportResult {
  employesCrees:      number;
  wosCrees:           number;
  wosMisAJour:        number;
  heuresSupprimees:   number;
  heuresInserees:     number;
  erreurs:            string[];
}

// ─── Parser CSV ────────────────────────────────────────────────────

/** Parser CSV minimaliste qui supporte les chaînes multilignes entre guillemets. */
function parseCSVRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (c === '"' && next === '"') { field += '"'; i++; }
      else if (c === '"')             { inQuotes = false; }
      else                            { field += c; }
    } else {
      if (c === '"')                  { inQuotes = true; }
      else if (c === ',')             { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && next === '\n') i++;
        row.push(field); field = '';
        if (row.some(f => f.length > 0)) rows.push(row);
        row = [];
      } else { field += c; }
    }
  }

  if (field || row.length > 0) {
    row.push(field);
    if (row.some(f => f.length > 0)) rows.push(row);
  }
  return rows;
}

/** Normalise un nombre français ("29,37" → 29.37, "0,00" → 0). */
function parseFr(n: string): number {
  if (!n) return 0;
  const v = parseFloat(n.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(v) ? v : 0;
}

/** Parse un export Labor Log iTrack en LaborLogParse. */
export function parseLaborLog(csvText: string): LaborLogParse {
  const rows = parseCSVRows(csvText);
  const entries: LaborEntry[] = [];
  const erreurs: string[] = [];
  let periodeDebut: string | null = null;
  let periodeFin:   string | null = null;
  const seen = new Set<string>();
  let totalLignes = 0;

  for (const row of rows) {
    // Extraire la période depuis le premier champ (info répétée à chaque ligne)
    if (!periodeDebut && row[0]) {
      const dates = row[0].match(/\d{4}-\d{2}-\d{2}/g);
      if (dates && dates.length >= 2) {
        periodeDebut = dates[0];
        periodeFin   = dates[1];
      }
    }

    const employe        = (row[7]  ?? '').trim();
    const woNumero       = (row[8]  ?? '').trim();
    const statut         = (row[9]  ?? '').trim();
    const typeBrut       = (row[10] ?? '').trim();
    const customerOrPart = (row[11] ?? '').trim();
    const heuresStr      = (row[12] ?? '').trim();

    // Ignorer les lignes qui ne contiennent pas de données utiles
    if (!employe || !woNumero || !typeBrut) continue;
    // Ignorer les lignes qui sont juste les labels d'en-tête
    if (employe === 'Work Order' || woNumero === 'Work Order') continue;

    totalLignes++;

    // Dédupe par (employé + WO) — l'iTrack répète les mêmes lignes
    const key = `${employe.toLowerCase()}|${woNumero}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const typeNormalise: 'interne' | 'externe' =
      typeBrut.toLowerCase().includes('(internal)') ? 'interne' : 'externe';
    const statutNormalise: 'ouvert' | 'ferme' =
      statut.toLowerCase().startsWith('clos') ? 'ferme' : 'ouvert';

    entries.push({
      employeCode:     employe,
      woNumero,
      statutBrut:      statut,
      typeBrut,
      typeNormalise,
      statutNormalise,
      customerOrPart,
      heures:          parseFr(heuresStr),
    });
  }

  if (!periodeDebut || !periodeFin) {
    erreurs.push('⚠️ Période non détectée dans le fichier. Vérifie le format.');
  }
  if (entries.length === 0) {
    erreurs.push('⚠️ Aucune entrée détectée. Le format du fichier est-il correct ?');
  }

  return { entries, totalLignes, periodeDebut, periodeFin, erreurs };
}

// ─── Enrichissement : cross-check avec prod_inventaire + prod_ventes ───
// Pour les WO internes, détermine si le numéro réfère à un camion en
// inventaire, vendu, inconnu, ou si c'est juste un travail de pièces.

/** Test si un texte ressemble à un vrai numéro de stock de camion */
function estNumeroStockCamion(s: string): boolean {
  return /^\d{4,}$/.test(s.trim());
}

export async function enrichirAvecCamions(entries: LaborEntry[]): Promise<LaborEntry[]> {
  // Collecter les numéros de stock candidats parmi les WO internes
  const numerosValides = Array.from(new Set(
    entries
      .filter(e => e.typeNormalise === 'interne')
      .map(e => e.customerOrPart.trim())
      .filter(estNumeroStockCamion)
  ));

  // Fetch en parallèle les 2 bases
  let invMap = new Map<string, { marque: string | null; modele: string | null; annee: number | null; vendu: boolean }>();
  let venduSet = new Set<string>();

  if (numerosValides.length > 0) {
    const [invRes, venRes] = await Promise.all([
      supabase
        .from('prod_inventaire')
        .select('numero, marque, modele, annee, etat_commercial')
        .in('numero', numerosValides),
      supabase
        .from('prod_ventes')
        .select('stock_numero, statut')
        .in('stock_numero', numerosValides),
    ]);
    for (const r of (invRes.data ?? []) as any[]) {
      invMap.set(r.numero, {
        marque: r.marque ?? null,
        modele: r.modele ?? null,
        annee:  r.annee  ?? null,
        vendu:  r.etat_commercial === 'vendu',
      });
    }
    for (const r of (venRes.data ?? []) as any[]) {
      if (r.statut === 'vendu') venduSet.add(r.stock_numero);
    }
  }

  return entries.map(e => {
    if (e.typeNormalise !== 'interne') return e;

    const num = e.customerOrPart.trim();
    if (!estNumeroStockCamion(num)) {
      return { ...e, camionStatut: 'travaux_pieces' as CamionStatut };
    }
    const inv = invMap.get(num);
    if (inv) {
      const isVendu = inv.vendu || venduSet.has(num);
      return {
        ...e,
        camionStatut: isVendu ? ('vendu' as CamionStatut) : ('inventaire' as CamionStatut),
        camionMarque: inv.marque,
        camionModele: inv.modele,
        camionAnnee:  inv.annee,
      };
    }
    if (venduSet.has(num)) {
      return { ...e, camionStatut: 'vendu' as CamionStatut };
    }
    return { ...e, camionStatut: 'inconnu' as CamionStatut };
  });
}

// Helpers d'affichage pour le statut camion
export const CAMION_STATUT_LABELS: Record<CamionStatut, string> = {
  inventaire:     'En inventaire',
  vendu:          'Camion vendu',
  inconnu:        'Stock inconnu',
  travaux_pieces: 'Travaux / pièces',
};

export const CAMION_STATUT_COLORS: Record<CamionStatut, string> = {
  inventaire:     '#3b82f6',
  vendu:          '#22c55e',
  inconnu:        '#ef4444',
  travaux_pieces: '#9ca3af',
};

export const CAMION_STATUT_EMOJIS: Record<CamionStatut, string> = {
  inventaire:     '📦',
  vendu:          '✅',
  inconnu:        '❓',
  travaux_pieces: '🔧',
};

// ─── Diff : compare avec l'état actuel de la base ─────────────────

export async function buildLaborDiff(parse: LaborLogParse): Promise<LaborDiff> {
  const employeCodes = Array.from(new Set(parse.entries.map(e => e.employeCode.toLowerCase())));
  const woNumeros    = Array.from(new Set(parse.entries.map(e => e.woNumero)));

  // 1. Employés existants (matchés par code_hitrac, case-insensitive)
  const { data: emps } = await supabase
    .from('prod_employes')
    .select('code_hitrac');
  const employesConnusSet = new Set(
    (emps ?? [])
      .filter((e: any) => e.code_hitrac)
      .map((e: any) => (e.code_hitrac as string).toLowerCase())
  );
  const employesNouveaux = employeCodes
    .filter(c => !employesConnusSet.has(c))
    .map(c => parse.entries.find(e => e.employeCode.toLowerCase() === c)!.employeCode);
  const employesConnus = employeCodes.length - employesNouveaux.length;

  // 2. WO existants
  const { data: wos } = await supabase
    .from('prod_work_orders')
    .select('wo_numero')
    .in('wo_numero', woNumeros);
  const wosExistantsSet = new Set((wos ?? []).map((w: any) => w.wo_numero));
  const wosExistants = wosExistantsSet.size;
  const wosNouveaux  = woNumeros.length - wosExistants;

  // 3. Heures déjà dans cette période (qui seront remplacées)
  let heuresExistantes = 0;
  if (parse.periodeDebut && parse.periodeFin) {
    const { count } = await supabase
      .from('prod_heures_employes')
      .select('id', { count: 'exact', head: true })
      .gte('date', parse.periodeDebut)
      .lte('date', parse.periodeFin);
    heuresExistantes = count ?? 0;
  }

  return {
    employesNouveaux,
    employesConnus,
    wosNouveaux,
    wosExistants,
    heuresExistantes,
    heuresAImporter:   parse.entries.length,
    totalHeuresImport: parse.entries.reduce((s, e) => s + e.heures, 0),
  };
}

// ─── Import : exécute l'import en cascade ─────────────────────────

export async function executeLaborImport(
  parse: LaborLogParse,
  sourceFichier: string,
): Promise<LaborImportResult> {
  const result: LaborImportResult = {
    employesCrees: 0, wosCrees: 0, wosMisAJour: 0,
    heuresSupprimees: 0, heuresInserees: 0, erreurs: [],
  };

  if (!parse.periodeDebut || !parse.periodeFin) {
    result.erreurs.push('Période manquante — import annulé.');
    return result;
  }

  // ─── 1. Auto-créer les employés inconnus ─────────────────────────
  const allCodes = Array.from(new Set(parse.entries.map(e => e.employeCode)));
  const { data: empsExistants } = await supabase
    .from('prod_employes')
    .select('id, code_hitrac');
  const empsByCode: Record<string, string> = {};
  for (const e of (empsExistants ?? []) as any[]) {
    if (e.code_hitrac) empsByCode[e.code_hitrac.toLowerCase()] = e.id;
  }

  const empsACreer = allCodes.filter(c => !empsByCode[c.toLowerCase()]);
  for (const code of empsACreer) {
    const { data, error } = await supabase
      .from('prod_employes')
      .insert({
        nom:          code,             // user va renommer dans Employés
        code_hitrac:  code,
        taux_horaire: 0,
        actif:        true,
        notes:        '⚠️ Auto-créé par import — taux à compléter',
      })
      .select('id')
      .single();
    if (error) {
      result.erreurs.push(`Échec création employé ${code}: ${error.message}`);
    } else if (data) {
      empsByCode[code.toLowerCase()] = data.id;
      result.employesCrees++;
    }
  }

  // ─── 2. Upsert des Work Orders ───────────────────────────────────
  const woMap = new Map<string, LaborEntry>();
  for (const e of parse.entries) {
    if (!woMap.has(e.woNumero)) woMap.set(e.woNumero, e);
  }

  // Quels WO existent déjà ?
  const { data: wosExistants } = await supabase
    .from('prod_work_orders')
    .select('wo_numero')
    .in('wo_numero', Array.from(woMap.keys()));
  const wosExistantsSet = new Set((wosExistants ?? []).map((w: any) => w.wo_numero));

  for (const e of woMap.values()) {
    const isInterne = e.typeNormalise === 'interne';
    const woPayload = {
      wo_numero:      e.woNumero,
      type:           e.typeNormalise,
      stock_numero:   isInterne ? e.customerOrPart : null,
      client:         isInterne ? null : e.customerOrPart,
      description:    e.typeBrut,
      statut:         e.statutNormalise,
      date_ouverture: parse.periodeDebut, // par défaut, on prend la période
      source_fichier: sourceFichier,
    };
    if (wosExistantsSet.has(e.woNumero)) {
      const { error } = await supabase
        .from('prod_work_orders')
        .update({
          // On ne touche pas date_ouverture / montant_facture / cout_pieces (déjà saisis manuellement peut-être)
          statut:         woPayload.statut,
          stock_numero:   woPayload.stock_numero,
          client:         woPayload.client,
          description:    woPayload.description,
          source_fichier: woPayload.source_fichier,
        })
        .eq('wo_numero', e.woNumero);
      if (error) result.erreurs.push(`Update WO ${e.woNumero}: ${error.message}`);
      else result.wosMisAJour++;
    } else {
      const { error } = await supabase.from('prod_work_orders').insert(woPayload);
      if (error) result.erreurs.push(`Insert WO ${e.woNumero}: ${error.message}`);
      else result.wosCrees++;
    }
  }

  // ─── 3. Heures : supprimer celles de la période, puis insérer ────
  const { count: deletedCount, error: delErr } = await supabase
    .from('prod_heures_employes')
    .delete({ count: 'exact' })
    .gte('date', parse.periodeDebut)
    .lte('date', parse.periodeFin);
  if (delErr) {
    result.erreurs.push(`Suppression heures: ${delErr.message}`);
  } else {
    result.heuresSupprimees = deletedCount ?? 0;
  }

  // Insertion en batch (chunks de 500)
  const heuresPayload = parse.entries.map(e => ({
    employe_id:     empsByCode[e.employeCode.toLowerCase()],
    wo_numero:      e.woNumero,
    date:           parse.periodeFin,    // on date à la FIN de période
    heures:         e.heures,
    source_fichier: sourceFichier,
  })).filter(h => !!h.employe_id);  // skip si l'auto-création a échoué

  const CHUNK = 500;
  for (let i = 0; i < heuresPayload.length; i += CHUNK) {
    const slice = heuresPayload.slice(i, i + CHUNK);
    const { error } = await supabase.from('prod_heures_employes').insert(slice);
    if (error) result.erreurs.push(`Insert heures batch ${i}: ${error.message}`);
    else result.heuresInserees += slice.length;
  }

  return result;
}
