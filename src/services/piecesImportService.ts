import { supabase } from '../lib/supabase';
import { anneeFiscale } from './hitracImportService';

// ─── Mapping codes Hightrack → noms réels ─────────────────────────────────────

export const VENDEURS: Record<string, string> = {
  'avaliquette': 'Alex Valiquette',
  'brainville':  'Bernard Rainville',
  'jchamps':     'Jimmy Champs',
  'xgemme':      'Xavier Gemme',
  'pdoiron':     'Patrick Doiron',
};

// Alias iTrack → code canonique (variantes de noms dans le rapport Counterperson)
const VENDEUR_ALIAS: Record<string, string> = {
  'dgemme - pieces': 'xgemme',
  'dgemme-pieces':   'xgemme',
  'dgemme':          'xgemme',
};

export function nomVendeur(code: string): string {
  if (!code) return '(sans vendeur)';
  return VENDEURS[code.toLowerCase()] ?? code;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PieceRow {
  document_numero: string;
  date_vente:      string;   // YYYY-MM-DD
  client:          string;
  client_numero:   string;
  vendeur:         string;   // code Hightrack ou '' si vide
  sous_total:      number;   // peut être négatif (avoir/retour)
  annee_fiscale:   number;
}

export interface PiecesDiff {
  nouveaux:  PieceRow[];
  doublons:  PieceRow[];   // document_numero déjà en BD
}

export interface PiecesImportResult {
  inserted: number;
  updated:  number;
  errors:   string[];
}

// ─── Parser CSV ───────────────────────────────────────────────────────────────
// Format Hightrack :
//   "Source Name","Customer Company Name","Balance","Closed","Date",
//   "Document #","Document Type","Salesperson","Subtotal","Customer Number","Store #"

function detectDelimiter(line: string): string {
  // Compte les virgules vs points-virgules hors guillemets pour détecter le séparateur
  let commas = 0, semis = 0, inQ = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') inQ = !inQ;
    else if (!inQ && line[i] === ',') commas++;
    else if (!inQ && line[i] === ';') semis++;
  }
  return semis > commas ? ';' : ',';
}

function parseCSVLine(line: string, delimiter = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export type ModeFichierPieces = 'counterperson' | 'salesperson';

export interface ParsePiecesResult {
  rows:         PieceRow[];
  errors:       string[];
  diagnostic?:  string;
  modeFichier:  ModeFichierPieces;
  nbExclus:     number;         // lignes filtrées (vendeur non reconnu)
  exclusDetails: { code: string; nb: number; total: number }[];  // détail des exclusions
}

// Codes valides des vendeurs au comptoir
const VENDEURS_CONNUS = new Set(Object.keys(VENDEURS));

export function parsePiecesCSV(text: string): ParsePiecesResult {
  // Retirer le BOM UTF-8 et UTF-16 si présent
  let content = text;
  if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
  content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);

  const vide: ParsePiecesResult = { rows: [], errors: ['Fichier vide — aucune ligne détectée.'], modeFichier: 'salesperson', nbExclus: 0, exclusDetails: [] };
  if (lines.length < 2) return vide;

  // Détection automatique du séparateur (virgule ou point-virgule)
  const delimiter = detectDelimiter(lines[0]);

  const errors: string[] = [];
  const rows: PieceRow[] = [];
  const exclusMap: Record<string, { nb: number; total: number }> = {};

  // Vérification entête
  const header = parseCSVLine(lines[0], delimiter).map(h => h.toLowerCase().trim().replace(/^"|"$/g, ''));
  const idxDate        = header.findIndex(h => h === 'date');
  const idxDoc         = header.findIndex(h => h.includes('document'));
  const idxSub         = header.findIndex(h => h.includes('subtotal') || h.includes('total'));
  const idxClient      = header.findIndex(h => h.includes('customer company') || h.includes('company'));
  const idxClientN     = header.findIndex(h => h.includes('customer number') || h.includes('number'));

  // Nouveau format : Counterperson > Salesperson
  const idxCounter     = header.findIndex(h => h === 'counterperson');
  const idxSalesperson = header.findIndex(h => h === 'salesperson');
  const modeFichier: ModeFichierPieces = idxCounter >= 0 ? 'counterperson' : 'salesperson';
  const idxVendeur = modeFichier === 'counterperson' ? idxCounter : idxSalesperson;

  const diagnostic = `Mode: ${modeFichier} · Séparateur: "${delimiter}" · Colonnes: [${header.join(' | ')}]`;

  if (idxDate < 0 || idxDoc < 0 || idxSub < 0) {
    return {
      rows: [], errors: [
        `Colonnes requises introuvables. ${diagnostic}`,
        'Astuce : si le fichier a été ouvert dans Excel, le réenregistrer en format CSV UTF-8.',
      ],
      modeFichier, nbExclus: 0, exclusDetails: [], diagnostic,
    };
  }

  for (let i = 1; i < lines.length; i++) {
    const cols     = parseCSVLine(lines[i], delimiter);
    const date     = (cols[idxDate]    ?? '').trim();
    const docNum   = (cols[idxDoc]     ?? '').trim();
    const vendeurRaw = (cols[idxVendeur] ?? '').trim().toLowerCase();
    const vendeur    = VENDEUR_ALIAS[vendeurRaw] ?? vendeurRaw;
    const subtotal = (cols[idxSub]     ?? '').trim();
    const client   = (cols[idxClient]  ?? '').trim();
    const clientNum = (cols[idxClientN] ?? '').trim();

    if (!date || !docNum) {
      errors.push(`Ligne ${i + 1} ignorée : date ou document # manquant.`);
      continue;
    }

    const sousTotal = parseFloat(subtotal.replace(',', '.'));
    if (isNaN(sousTotal)) {
      errors.push(`Ligne ${i + 1} (doc ${docNum}) : montant invalide "${subtotal}".`);
      continue;
    }

    // En mode Counterperson : filtrer aux vendeurs connus seulement
    if (modeFichier === 'counterperson' && !VENDEURS_CONNUS.has(vendeur)) {
      if (!exclusMap[vendeur]) exclusMap[vendeur] = { nb: 0, total: 0 };
      exclusMap[vendeur].nb++;
      exclusMap[vendeur].total += sousTotal;
      continue;
    }

    rows.push({
      document_numero: docNum,
      date_vente:      date,
      client,
      client_numero:   clientNum,
      vendeur,
      sous_total:      sousTotal,
      annee_fiscale:   anneeFiscale(date),
    });
  }

  const exclusDetails = Object.entries(exclusMap)
    .sort((a, b) => Math.abs(b[1].total) - Math.abs(a[1].total))
    .map(([code, v]) => ({ code, ...v }));

  return { rows, errors, diagnostic, modeFichier, nbExclus: exclusDetails.reduce((s, e) => s + e.nb, 0), exclusDetails };
}

// ─── Base de données ──────────────────────────────────────────────────────────

export async function loadPiecesExistantes(): Promise<Set<string>> {
  const { data } = await supabase
    .from('prod_ventes_pieces')
    .select('document_numero');
  return new Set((data ?? []).map((r: { document_numero: string }) => r.document_numero));
}

export function calculatePiecesDiff(parsed: PieceRow[], existants: Set<string>): PiecesDiff {
  return {
    nouveaux: parsed.filter(r => !existants.has(r.document_numero)),
    doublons: parsed.filter(r =>  existants.has(r.document_numero)),
  };
}

export async function executePiecesImport(
  rows: PieceRow[],
  sourceFichier: string,
): Promise<PiecesImportResult> {
  if (rows.length === 0) return { inserted: 0, updated: 0, errors: [] };

  const payload = rows.map(r => ({
    ...r,
    source_fichier: sourceFichier,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('prod_ventes_pieces')
    .upsert(payload, { onConflict: 'document_numero' });

  if (error) return { inserted: 0, updated: 0, errors: [error.message] };
  return { inserted: rows.length, updated: 0, errors: [] };
}
