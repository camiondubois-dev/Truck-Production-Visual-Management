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
  type: 'eau' | 'detail' | string;
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

function parseAmount(raw: string): number {
  // "3 000,00" → 3000.00
  return parseFloat(raw.replace(/\s/g, '').replace(',', '.'));
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
      if (!isNaN(v)) entry.purchase += v;
    }
    if (wm) {
      const v = parseAmount(wm[1]);
      if (!isNaN(v)) entry.wo += v;
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
    .select('stock_numero, prix_achat_reel, cout_mo, type, marque, modele, annee')
    .eq('statut', 'inventaire')
    .in('type', ['eau', 'detail']);

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
        type: v.type, label,
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
}

export async function listImports(): Promise<ImportLogEntry[]> {
  const { data, error } = await supabase
    .from('prod_imports_log')
    .select('*')
    .eq('type_import', 'hitrac_couts')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as ImportLogEntry[];
}
