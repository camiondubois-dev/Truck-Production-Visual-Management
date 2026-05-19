import { supabase } from '../lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────

export interface HitracAggregate {
  stock_numero: string;
  prix_achat_reel: number;   // Σ Vehicle Purchase Cost
  cout_mo: number;           // Σ Vehicle Work Order Cost
  nb_lignes: number;         // Nombre de lignes HITRAC pour ce camion
}

export interface DbVehicule {
  stock_numero: string;
  prix_achat_reel: number | null;
  cout_mo: number | null;
  /** Dans prod_ventes la colonne s'appelle `source` (valeurs : 'eau' | 'detail' | 'encan' | 'exportation') */
  source: 'eau' | 'detail' | string;
  marque: string | null;
  modele: string | null;
  annee: number | null;
}

export type ChangeKind = 'identique' | 'maj_mo' | 'maj_achat' | 'maj_achat_et_mo' | 'protege' | 'absent_hitrac';

export interface DiffRow {
  stock_numero: string;
  // Identité
  type: string;
  label: string;
  // Achat
  achat_db: number | null;
  achat_hitrac: number;
  achat_nouvelle: number | null;  // valeur qui sera écrite (null = pas de changement)
  achat_protege: boolean;          // true = on garde DB malgré différence
  // MO
  mo_db: number | null;
  mo_hitrac: number;
  mo_nouvelle: number | null;      // valeur qui sera écrite
  // Synthèse
  kind: ChangeKind;
}

export interface DiffSummary {
  total_db: number;
  trouves_dans_hitrac: number;
  absents_de_hitrac: number;
  achats_a_ajouter: number;
  achats_proteges: number;
  mo_a_modifier: number;
  identiques: number;
  rows: DiffRow[];
}

// ─── Règles d'import ─────────────────────────────────────────────────

const PLACEHOLDER_ACHAT_MAX = 10.0;  // Seuil pour traiter un achat DB comme placeholder bidon
const FLOAT_EPSILON = 0.01;

function isPlaceholder(val: number | null): boolean {
  return val === null || val <= PLACEHOLDER_ACHAT_MAX;
}

// ─── Parsing CSV HITRAC ──────────────────────────────────────────────
// Le fichier vehiclecostdetail.csv a un format atypique :
//  - Chaque ligne contient les "en-têtes" répétés + les données
//  - Les colonnes utiles : "Stock # XXXXX", "Vehicle Purchase Cost" | "Vehicle Work Order Cost", "X XXX,XX"
//  - On parse par regex ligne par ligne, on tolère le format québécois (espace = milliers, virgule = décimal)

function parseAmount(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  // HITRAC utilise deux formats selon le rapport :
  //  - QC : "3 000,00"   (espace = milliers, virgule = décimal)
  //  - US : "231,380.13" (virgule = milliers, point = décimal)
  const s = String(raw).trim().replace(/\s/g, '');
  if (!s) return null;
  const hasComma = s.includes(',');
  const hasPeriod = s.includes('.');
  let normalized: string;
  if (hasComma && hasPeriod) {
    normalized = s.replace(/,/g, '');
  } else if (hasComma) {
    normalized = s.replace(',', '.');
  } else {
    normalized = s;
  }
  const n = parseFloat(normalized);
  return isNaN(n) ? null : n;
}

export function parseHitracCSV(text: string): HitracAggregate[] {
  const lines = text.split(/\r?\n/);
  const sums = new Map<string, { purchase: number; wo: number; n: number }>();

  const stockRegex = /Stock # (\d+)/;
  // "Vehicle Purchase Cost","3 000,00" ou "Vehicle Work Order Cost","629,24"
  const purchaseRegex = /"Vehicle Purchase Cost","([\d\s,.-]+)"/;
  const woRegex       = /"Vehicle Work Order Cost","([\d\s,.-]+)"/;

  for (const line of lines) {
    const sm = line.match(stockRegex);
    if (!sm) continue;
    const stock = sm[1];

    const pm = line.match(purchaseRegex);
    const wm = line.match(woRegex);
    if (!pm && !wm) continue;

    let entry = sums.get(stock);
    if (!entry) { entry = { purchase: 0, wo: 0, n: 0 }; sums.set(stock, entry); }

    if (pm) {
      const v = parseAmount(pm[1]);
      if (v != null) entry.purchase += v;
    }
    if (wm) {
      const v = parseAmount(wm[1]);
      if (v != null) entry.wo += v;
    }
    entry.n++;
  }

  const out: HitracAggregate[] = [];
  for (const [stock, v] of sums.entries()) {
    out.push({
      stock_numero: stock,
      prix_achat_reel: Math.round(v.purchase * 100) / 100,
      cout_mo:         Math.round(v.wo       * 100) / 100,
      nb_lignes:       v.n,
    });
  }
  return out;
}

// ─── Charger l'inventaire actif depuis Supabase ─────────────────────

export async function loadInventaireActif(): Promise<DbVehicule[]> {
  const { data, error } = await supabase
    .from('prod_ventes')
    .select('stock_numero, prix_achat_reel, cout_mo, source, marque, modele, annee')
    .eq('statut', 'inventaire')
    .in('source', ['eau', 'detail']);

  if (error) throw error;
  return (data ?? []) as DbVehicule[];
}

// ─── Calcul du diff (aperçu) ────────────────────────────────────────

export function calculateDiff(db: DbVehicule[], hitrac: HitracAggregate[]): DiffSummary {
  const hitracMap = new Map<string, HitracAggregate>();
  for (const h of hitrac) hitracMap.set(h.stock_numero, h);

  let trouves = 0, absents = 0;
  let achatsAdd = 0, achatsProtege = 0, moMod = 0, identiques = 0;
  const rows: DiffRow[] = [];

  for (const v of db) {
    const h = hitracMap.get(v.stock_numero);
    const label = [v.annee, v.marque, v.modele].filter(Boolean).join(' ') || '(sans titre)';

    if (!h) {
      absents++;
      rows.push({
        stock_numero: v.stock_numero,
        type: v.source, label,
        achat_db: v.prix_achat_reel, achat_hitrac: 0, achat_nouvelle: null, achat_protege: false,
        mo_db: v.cout_mo, mo_hitrac: 0, mo_nouvelle: null,
        kind: 'absent_hitrac',
      });
      continue;
    }

    trouves++;

    // Règle Achat : si DB est placeholder (null ou ≤ $10), écraser. Sinon, protéger.
    let achatNouvelle: number | null = null;
    let achatProtege = false;
    if (isPlaceholder(v.prix_achat_reel) && h.prix_achat_reel > PLACEHOLDER_ACHAT_MAX) {
      achatNouvelle = h.prix_achat_reel;
      achatsAdd++;
    } else if (!isPlaceholder(v.prix_achat_reel) && Math.abs((v.prix_achat_reel ?? 0) - h.prix_achat_reel) > FLOAT_EPSILON) {
      achatProtege = true;
      achatsProtege++;
    }

    // Règle MO : toujours écraser (sauf si HITRAC = 0 ET DB non vide, on garde DB)
    let moNouvelle: number | null = null;
    const dbMoNum = v.cout_mo ?? 0;
    if (h.cout_mo === 0 && v.cout_mo !== null && v.cout_mo > 0) {
      // Cas spécial : HITRAC dit 0 mais DB a déjà un coût → on laisse DB
      moNouvelle = null;
    } else if (Math.abs(dbMoNum - h.cout_mo) > FLOAT_EPSILON) {
      moNouvelle = h.cout_mo;
      moMod++;
    }

    // Synthèse kind
    let kind: ChangeKind;
    if (achatProtege) kind = 'protege';
    else if (achatNouvelle !== null && moNouvelle !== null) kind = 'maj_achat_et_mo';
    else if (achatNouvelle !== null) kind = 'maj_achat';
    else if (moNouvelle !== null)    kind = 'maj_mo';
    else { kind = 'identique'; identiques++; }

    rows.push({
      stock_numero: v.stock_numero, type: v.type, label,
      achat_db: v.prix_achat_reel, achat_hitrac: h.prix_achat_reel, achat_nouvelle: achatNouvelle, achat_protege: achatProtege,
      mo_db: v.cout_mo, mo_hitrac: h.cout_mo, mo_nouvelle: moNouvelle,
      kind,
    });
  }

  return {
    total_db: db.length,
    trouves_dans_hitrac: trouves,
    absents_de_hitrac: absents,
    achats_a_ajouter: achatsAdd,
    achats_proteges: achatsProtege,
    mo_a_modifier: moMod,
    identiques,
    rows,
  };
}

// ─── Exécution de l'import (backup + UPDATE) ────────────────────────

export interface ImportResult {
  import_id: string;
  nb_camions_analyses: number;
  nb_achats_modifies: number;
  nb_mo_modifies: number;
  nb_achats_proteges: number;
}

export async function executeImport({
  diff,
  filename,
  userEmail,
  userNom,
}: {
  diff: DiffSummary;
  filename: string;
  userEmail?: string;
  userNom?: string;
}): Promise<ImportResult> {
  // 1. Filtrer les lignes qui vont effectivement changer
  const lignesAModifier = diff.rows.filter(
    r => r.achat_nouvelle !== null || r.mo_nouvelle !== null
  );

  if (lignesAModifier.length === 0) {
    throw new Error('Aucun changement à appliquer.');
  }

  // 2. Créer l'entrée dans le journal
  const { data: logRow, error: logErr } = await supabase
    .from('prod_imports_log')
    .insert({
      type_import: 'hitrac_couts',
      filename,
      user_email: userEmail ?? null,
      user_nom: userNom ?? null,
      nb_camions_analyses: diff.total_db,
      nb_achats_modifies: diff.achats_a_ajouter,
      nb_mo_modifies: diff.mo_a_modifier,
      nb_achats_proteges: diff.achats_proteges,
      status: 'completed',
    })
    .select('id')
    .single();

  if (logErr || !logRow) throw logErr ?? new Error('Création du log échouée');
  const importId = logRow.id as string;

  // 3. Backup des valeurs AVANT modification (pour les lignes qu'on modifie)
  const backupRows = lignesAModifier.map(r => ({
    import_id: importId,
    stock_numero: r.stock_numero,
    prix_achat_reel: r.achat_db,
    cout_mo: r.mo_db,
    prix_demande: null,  // pas modifié par cet import
  }));

  const { error: backupErr } = await supabase
    .from('prod_ventes_backup')
    .insert(backupRows);

  if (backupErr) {
    // Cleanup : si le backup échoue, on supprime le log
    await supabase.from('prod_imports_log').delete().eq('id', importId);
    throw backupErr;
  }

  // 4. Exécuter les UPDATE un par un (Supabase ne supporte pas UPDATE en batch avec WHERE différent)
  let nbAchatsModif = 0, nbMoModif = 0;
  for (const r of lignesAModifier) {
    const update: { prix_achat_reel?: number; cout_mo?: number } = {};
    if (r.achat_nouvelle !== null) { update.prix_achat_reel = r.achat_nouvelle; nbAchatsModif++; }
    if (r.mo_nouvelle    !== null) { update.cout_mo         = r.mo_nouvelle;    nbMoModif++; }
    const { error } = await supabase
      .from('prod_ventes')
      .update(update)
      .eq('stock_numero', r.stock_numero)
      .eq('statut', 'inventaire');
    if (error) {
      console.error(`[hitracImport] UPDATE échec pour #${r.stock_numero}:`, error);
      // On continue avec les autres — le backup permet de tout restaurer si nécessaire
    }
  }

  return {
    import_id: importId,
    nb_camions_analyses: diff.total_db,
    nb_achats_modifies: nbAchatsModif,
    nb_mo_modifies: nbMoModif,
    nb_achats_proteges: diff.achats_proteges,
  };
}

// ─── Restauration depuis un backup ───────────────────────────────────

export async function restoreImport(importId: string, userNom: string): Promise<number> {
  // Charger les lignes de backup
  const { data: backups, error: backupErr } = await supabase
    .from('prod_ventes_backup')
    .select('stock_numero, prix_achat_reel, cout_mo')
    .eq('import_id', importId);

  if (backupErr) throw backupErr;
  if (!backups || backups.length === 0) throw new Error('Aucun backup trouvé pour cet import.');

  // Restaurer les valeurs originales
  let nbRestored = 0;
  for (const b of backups as any[]) {
    const { error } = await supabase
      .from('prod_ventes')
      .update({
        prix_achat_reel: b.prix_achat_reel,
        cout_mo: b.cout_mo,
      })
      .eq('stock_numero', b.stock_numero)
      .eq('statut', 'inventaire');
    if (!error) nbRestored++;
  }

  // Marquer le log comme restauré
  await supabase
    .from('prod_imports_log')
    .update({
      status: 'restored',
      restored_at: new Date().toISOString(),
      restored_by: userNom,
    })
    .eq('id', importId);

  return nbRestored;
}

// ─── Lister les imports passés ───────────────────────────────────────

export interface ImportLogEntry {
  id: string;
  created_at: string;
  type_import: string;
  user_nom: string | null;
  user_email: string | null;
  filename: string | null;
  nb_camions_analyses: number;
  nb_achats_modifies: number;
  nb_mo_modifies: number;
  nb_achats_proteges: number;
  status: 'completed' | 'restored';
  restored_at: string | null;
  restored_by: string | null;
  notes: string | null;
}

export async function listImports(typeImport?: string): Promise<ImportLogEntry[]> {
  let q = supabase.from('prod_imports_log').select('*').order('created_at', { ascending: false }).limit(50);
  if (typeImport) q = q.eq('type_import', typeImport);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ImportLogEntry[];
}


// ════════════════════════════════════════════════════════════════════
// ─── IMPORT VENTES (HITRAC) ─────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════

export type VenteWizardKind = 'eau_detail' | 'exportation' | 'encan';

/** Une ligne de vente parsée d'un rapport HITRAC */
export interface VenteRow {
  stock_numero: string;
  date_vente: string;        // ISO date 'YYYY-MM-DD'
  so_numero: string | null;
  client: string | null;
  vehicule: string | null;   // year/make/model
  description: string | null;
  line_cost: number;         // cout_vente (achat + MO confirmés)
  line_total: number;        // prix_vente
  line_profit: number;       // profit_source
  pct_profit: number;        // pct_profit_source
  inventory_type: string | null;  // "9000: Vehicle For Sale" ou "9025: Export Vehicles"
}

// ─── Calcul de l'année fiscale (juillet → juin) ─────────────────────
// Convention : FY est nommé par l'année de départ. Juillet 2025 → juin 2026 = FY2025.
export function anneeFiscale(dateStr: string): number {
  const d = new Date(dateStr);
  const month = d.getMonth(); // 0 = jan, 6 = jul
  const year = d.getFullYear();
  return month >= 6 ? year : year - 1;
}

// ─── Parser CSV ventes par inventory type (9000 ou 9025) ────────────
//
// Format HITRAC : chaque ligne contient les en-têtes répétés + données.
// Position des champs (séparateurs `","`):
//   ... | INVENTORY_TYPE_LABEL | DATE | SO# | CUSTOMER | TAG# | QTY | YEAR_MAKE_MODEL | DESC | COST | TOTAL | PROFIT | PCT | ...
//
// On utilise une regex robuste pour extraire ces 12 champs consécutifs.

const INVENTORY_TYPE_LINE_REGEX =
  /"(9\d{3}:\s*[^"]+)",(\d{4}-\d{2}-\d{2}),"([^"]+)","([^"]+)","(\d+)",(\d+),"([^"]*)","([^"]*)","([\d\s,.-]+)","([\d\s,.-]+)","([\d\s,.-]+)",([\d.\-]+)/;

export function parseSalesByInventoryType(text: string): VenteRow[] {
  const lines = text.split(/\r?\n/);
  const out: VenteRow[] = [];
  const seen = new Set<string>(); // dédup par (stock+SO)
  for (const line of lines) {
    const m = line.match(INVENTORY_TYPE_LINE_REGEX);
    if (!m) continue;
    const [, invType, date, so, client, stock, , vehicule, description, cost, total, profit, pct] = m;
    const key = `${stock}|${so}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const row: VenteRow = {
      stock_numero: stock.trim(),
      date_vente: date,
      so_numero: so?.trim() || null,
      client: client?.trim() || null,
      vehicule: vehicule?.trim() || null,
      description: description?.trim() || null,
      line_cost:  parseAmount(cost)   ?? 0,
      line_total: parseAmount(total)  ?? 0,
      line_profit:parseAmount(profit) ?? 0,
      pct_profit: parseFloat(pct.replace(',', '.')) || 0,
      inventory_type: invType?.trim() || null,
    };
    out.push(row);
  }
  return out;
}

// ─── Parser CSV ventes par client (encan) ───────────────────────────
//
// Format différent : groupé par client. Chaque ligne contient :
//   ... | CUSTOMER_INFO | BILLING_ADDR | SO# | DATE | USER | SHIPPING_ADDR | STOCK# | DESCRIPTION | ADJ | SUBTOTAL | COST | PROFIT | PCT | ...
// On ignore :
//   - Lignes avec stock# commençant par "CC-" (summary)
//   - Stock# avec suffixe "-X" (pièces : Body/Bed)
//   - Description commençant par "Body / Bed" ou "Materiel Roulant" (parts/capital assets)

const CUSTOMER_LINE_REGEX =
  /"(\d+:\s*[^"]+)","Billing Address:[^"]*","([^"]+)",(\d{4}-\d{2}-\d{2}),"([^"]+)","Shipping Address:[^"]*","([^"]+)","([^"]+)","([\d\s,.\-]+)","([\d\s,.\-]+)","([\d\s,.\-]+)","([\d\s,.\-]+)","([\d,.\-]+)"/;

export function parseSalesByCustomer(text: string): VenteRow[] {
  const lines = text.split(/\r?\n/);
  const out: VenteRow[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const m = line.match(CUSTOMER_LINE_REGEX);
    if (!m) continue;
    // Captures: [_, customerInfo, so, date, user, stock, desc, adj, sale, cost, profit, pct]
    const [, customerInfo, so, date, , stock, desc, , , cost, profit, pct] = m;

    // Filtres
    if (stock.startsWith('CC-')) continue; // ligne summary
    if (stock.includes('-')) continue;     // pièce (ex: "34762-5")
    if (!/^\d+$/.test(stock)) continue;    // stock# doit être numérique

    // Description : on garde seulement les camions
    const d = desc?.trim() ?? '';
    const isVehicle = /^(Vehicle For Sale|Export Vehicles)\b/i.test(d);
    if (!isVehicle) continue; // skip Body/Bed, Materiel Roulant cour, etc.

    const key = `${stock}|${so}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      stock_numero: stock.trim(),
      date_vente: date,
      so_numero: so?.trim() || null,
      client: customerInfo?.trim() || null,
      vehicule: d,
      description: d,
      line_cost:   parseAmount(cost)   ?? 0,
      line_total:  0,  // pas directement disponible — on calcule depuis cost + profit
      line_profit: parseAmount(profit) ?? 0,
      pct_profit:  parseFloat(pct.replace(',', '.')) || 0,
      inventory_type: null,
    });
  }
  // Calcul de line_total = line_cost + line_profit (puisque c'est ce que HITRAC affiche)
  for (const r of out) r.line_total = r.line_cost + r.line_profit;
  return out;
}


// ─── Charger les ventes existantes (pour diff) ──────────────────────

export interface DbVente {
  stock_numero: string;
  statut: string;
  source: string;
  prix_vente: number | null;
  date_vente: string | null;
  client: string | null;
  prix_achat_reel: number | null;
  cout_mo: number | null;
  marque: string | null;
  modele: string | null;
  annee: number | null;
}

export async function loadVentesExistantes(stockNumeros: string[]): Promise<DbVente[]> {
  if (stockNumeros.length === 0) return [];
  const { data, error } = await supabase
    .from('prod_ventes')
    .select('stock_numero, statut, source, prix_vente, date_vente, client, prix_achat_reel, cout_mo, marque, modele, annee')
    .in('stock_numero', stockNumeros);
  if (error) throw error;
  return (data ?? []) as DbVente[];
}


// ─── Diff ventes ────────────────────────────────────────────────────

export type VenteAction = 'creer' | 'maj_inventaire_vers_vendu' | 'maj_vendu' | 'changer_source' | 'identique' | 'ignore_pas_en_db';

export interface VenteDiffRow {
  stock_numero: string;
  vente: VenteRow;
  db: DbVente | null;
  source_actuelle: string | null;
  source_nouvelle: string;
  action: VenteAction;
  label: string;
}

export interface VenteDiffSummary {
  total_lignes: number;
  a_creer: number;
  a_maj_inv_vers_vendu: number;
  a_maj_vendu: number;
  a_changer_source: number;
  identiques: number;
  ignores: number;
  rows: VenteDiffRow[];
}

export function calculateVenteDiff(
  ventes: VenteRow[],
  db: DbVente[],
  wizard: VenteWizardKind,
): VenteDiffSummary {
  const byStock = new Map<string, DbVente>();
  for (const v of db) byStock.set(v.stock_numero, v);

  // Source visée selon wizard
  const sourceVisee: Record<VenteWizardKind, string | 'preserve'> = {
    eau_detail: 'preserve', // on ne change pas (eau ou detail déjà en DB)
    exportation: 'exportation',
    encan: 'encan',
  };
  const cible = sourceVisee[wizard];

  let aCreer = 0, aMajInv = 0, aMajVendu = 0, aChangerSource = 0, identiques = 0, ignores = 0;
  const rows: VenteDiffRow[] = [];

  for (const v of ventes) {
    const dbRow = byStock.get(v.stock_numero) ?? null;
    const label = v.vehicule ?? `(${v.stock_numero})`;

    let action: VenteAction;
    let sourceNouvelle: string;

    if (!dbRow) {
      if (wizard === 'eau_detail') {
        // Règle Q3 : eau/detail, si pas en DB → ignore
        action = 'ignore_pas_en_db';
        sourceNouvelle = '—';
        ignores++;
      } else {
        // Export/encan : on crée
        action = 'creer';
        sourceNouvelle = cible as string;
        aCreer++;
      }
    } else {
      // Camion existe en DB
      const sourceActuelle = dbRow.source;
      const finalSource = cible === 'preserve' ? sourceActuelle : (cible as string);

      if (dbRow.statut === 'inventaire') {
        action = 'maj_inventaire_vers_vendu';
        sourceNouvelle = finalSource;
        aMajInv++;
      } else if (dbRow.statut === 'vendu') {
        // Déjà vendu — vérifier si source change ou autre champ diff
        const sourceChange = finalSource !== sourceActuelle;
        const prixDiff = (dbRow.prix_vente ?? 0) !== v.line_total;
        const dateDiff = dbRow.date_vente !== v.date_vente;
        if (sourceChange) {
          action = 'changer_source';
          sourceNouvelle = finalSource;
          aChangerSource++;
        } else if (prixDiff || dateDiff) {
          action = 'maj_vendu';
          sourceNouvelle = finalSource;
          aMajVendu++;
        } else {
          action = 'identique';
          sourceNouvelle = finalSource;
          identiques++;
        }
      } else {
        action = 'identique';
        sourceNouvelle = finalSource;
        identiques++;
      }
    }

    rows.push({
      stock_numero: v.stock_numero,
      vente: v,
      db: dbRow,
      source_actuelle: dbRow?.source ?? null,
      source_nouvelle: sourceNouvelle,
      action,
      label,
    });
  }

  return {
    total_lignes: ventes.length,
    a_creer: aCreer,
    a_maj_inv_vers_vendu: aMajInv,
    a_maj_vendu: aMajVendu,
    a_changer_source: aChangerSource,
    identiques,
    ignores,
    rows,
  };
}


// ─── Exécution import ventes ────────────────────────────────────────

export interface VenteImportResult {
  import_id: string;
  nb_creees: number;
  nb_mises_a_jour: number;
  nb_changements_source: number;
}

export async function executeVenteImport({
  diff,
  wizard,
  filename,
  userEmail,
  userNom,
}: {
  diff: VenteDiffSummary;
  wizard: VenteWizardKind;
  filename: string;
  userEmail?: string;
  userNom?: string;
}): Promise<VenteImportResult> {
  const lignesAModifier = diff.rows.filter(r =>
    r.action === 'creer' ||
    r.action === 'maj_inventaire_vers_vendu' ||
    r.action === 'maj_vendu' ||
    r.action === 'changer_source'
  );
  if (lignesAModifier.length === 0) {
    throw new Error('Aucun changement à appliquer.');
  }

  const typeImport = `hitrac_ventes_${wizard}`;

  // 1. Log
  const { data: logRow, error: logErr } = await supabase
    .from('prod_imports_log')
    .insert({
      type_import: typeImport,
      filename,
      user_email: userEmail ?? null,
      user_nom: userNom ?? null,
      nb_camions_analyses: diff.total_lignes,
      nb_achats_modifies: diff.a_creer,
      nb_mo_modifies: diff.a_maj_inv_vers_vendu + diff.a_maj_vendu + diff.a_changer_source,
      nb_achats_proteges: 0,
      status: 'completed',
      notes: `Wizard: ${wizard}. ${diff.a_creer} créés, ${diff.a_maj_inv_vers_vendu} inv→vendu, ${diff.a_maj_vendu} maj vendu, ${diff.a_changer_source} source changée.`,
    })
    .select('id').single();

  if (logErr || !logRow) throw logErr ?? new Error('Création log échouée');
  const importId = logRow.id as string;

  // 2. Backup des lignes existantes (avant écrasement)
  const backupRows = lignesAModifier
    .filter(r => r.db !== null)
    .map(r => ({
      import_id: importId,
      stock_numero: r.stock_numero,
      prix_achat_reel: r.db!.prix_achat_reel,
      cout_mo: r.db!.cout_mo,
      prix_demande: null,
    }));
  if (backupRows.length > 0) {
    const { error: bErr } = await supabase.from('prod_ventes_backup').insert(backupRows);
    if (bErr) {
      await supabase.from('prod_imports_log').delete().eq('id', importId);
      throw bErr;
    }
  }

  // 3. Appliquer les changements
  let nbCreees = 0, nbMaj = 0, nbSrcChg = 0;

  for (const r of lignesAModifier) {
    const v = r.vente;
    const af = anneeFiscale(v.date_vente);

    if (r.action === 'creer') {
      // INSERT
      const sourcePriorite = r.source_nouvelle === 'encan' ? 1 : r.source_nouvelle === 'exportation' ? 2 : 3;
      const { error } = await supabase.from('prod_ventes').insert({
        stock_numero: v.stock_numero,
        statut: 'vendu',
        source: r.source_nouvelle,
        source_priorite: sourcePriorite,
        annee_fiscale: af,
        date_vente: v.date_vente,
        so_numero: v.so_numero,
        client: v.client,
        vehicule: v.vehicule,
        description: v.description,
        cout_vente: v.line_cost,
        prix_vente: v.line_total,
        profit_source: v.line_profit,
        pct_profit_source: v.pct_profit,
      });
      if (!error) nbCreees++;
      else console.error(`[ventes import] Création #${v.stock_numero} échec:`, error);
    } else {
      // UPDATE
      const update: any = {
        statut: 'vendu',
        annee_fiscale: af,
        date_vente: v.date_vente,
        so_numero: v.so_numero,
        client: v.client,
        cout_vente: v.line_cost,
        prix_vente: v.line_total,
        profit_source: v.line_profit,
        pct_profit_source: v.pct_profit,
      };
      // On change source seulement si pas 'preserve' (wizard eau_detail) et que c'est différent
      if (wizard !== 'eau_detail' && r.source_nouvelle !== r.source_actuelle) {
        update.source = r.source_nouvelle;
        update.source_priorite = r.source_nouvelle === 'encan' ? 1 : 2;
      }
      const { error } = await supabase.from('prod_ventes').update(update).eq('stock_numero', v.stock_numero);
      if (!error) {
        nbMaj++;
        if (r.action === 'changer_source') nbSrcChg++;
      } else {
        console.error(`[ventes import] MAJ #${v.stock_numero} échec:`, error);
      }
    }
  }

  return {
    import_id: importId,
    nb_creees: nbCreees,
    nb_mises_a_jour: nbMaj,
    nb_changements_source: nbSrcChg,
  };
}
