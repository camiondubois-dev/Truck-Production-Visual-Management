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

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export function parsePiecesCSV(text: string): { rows: PieceRow[]; errors: string[] } {
  // Retirer le BOM UTF-8 si présent
  const content = text.startsWith('﻿') ? text.slice(1) : text;
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  if (lines.length < 2) return { rows: [], errors: ['Fichier vide ou invalide.'] };

  const errors: string[] = [];
  const rows: PieceRow[] = [];

  // Vérification entête
  const header = parseCSVLine(lines[0]).map(h => h.toLowerCase());
  const idxDate    = header.findIndex(h => h === 'date');
  const idxDoc     = header.findIndex(h => h.includes('document #') || h.includes('document#'));
  const idxVendeur = header.findIndex(h => h.includes('salesperson'));
  const idxSub     = header.findIndex(h => h.includes('subtotal'));
  const idxClient  = header.findIndex(h => h.includes('customer company'));
  const idxClientN = header.findIndex(h => h.includes('customer number'));

  if (idxDate < 0 || idxDoc < 0 || idxSub < 0) {
    return { rows: [], errors: ['Colonnes manquantes — vérifier que c\'est un export Hightrack valide.'] };
  }

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const date      = (cols[idxDate]    ?? '').trim();
    const docNum    = (cols[idxDoc]     ?? '').trim();
    const vendeur   = (cols[idxVendeur] ?? '').trim();
    const subtotal  = (cols[idxSub]     ?? '').trim();
    const client    = (cols[idxClient]  ?? '').trim();
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

  return { rows, errors };
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
