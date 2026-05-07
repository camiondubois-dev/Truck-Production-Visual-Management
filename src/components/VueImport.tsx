import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────

type Source = 'couts' | 'encan' | 'exportation' | 'detail' | 'received';

interface VenteRow {
  stock_numero: string | null;
  source: 'encan' | 'exportation' | 'detail' | 'eau';
  source_priorite: 1 | 2 | 3;
  annee_fiscale: number;
  date_vente: string | null;
  so_numero: string | null;
  client: string | null;
  vehicule: string | null;
  description: string | null;
  cout_vente: number | null;
  prix_vente: number | null;
  profit_source: number | null;
  pct_profit_source: number | null;
}

interface CoutRow {
  stock_numero: string;
  statut: string | null;
  user_statut: string | null;
  store: string | null;
  date_achat: string | null;
  age_jours: number | null;
  cost_purchased: number;
  cost_consumed: number | null;
  cost_remaining: number | null;
  projected_deficit: number | null;
  parts_total: number | null;
  parts_vendues: number | null;
  parts_restantes: number | null;
  prix_vente: number;
  remaining_market: number | null;
  gm_pct: number | null;
  updated_at: string;
}

interface ReceivedRow {
  stock_numero: string;
  prix_achat_reel: number;
  date_achat_po: string | null;
}

interface ZoneState {
  file: File | null;
  rows: (VenteRow | CoutRow | ReceivedRow)[];
  status: 'idle' | 'parsing' | 'ready' | 'importing' | 'done' | 'error';
  message: string;
}

interface ImportLog {
  id: string;
  type_import: string;
  source: string;
  annee_fiscale: number | null;
  nom_fichier: string;
  nb_lignes_lu: number;
  nb_inserts: number;
  nb_updates: number;
  nb_ignores: number;
  nb_conflits: number;
  created_at: string;
}

interface ConflitRow {
  id: string;
  stock_numero: string;
  champ: string;
  valeur_bd: number;
  valeur_import: number;
  ecart: number;
  source: string;
  date_import: string;
  resolu: boolean;
  note: string | null;
}

const ZONE_IDLE: ZoneState = { file: null, rows: [], status: 'idle', message: '' };

// ── Helpers ───────────────────────────────────────────────────────────────────

function anneeFiscale(d: Date): number {
  return d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
}

function xlDate(v: unknown): Date | null {
  if (typeof v !== 'number' || v < 1) return null;
  const d = new Date((v - 25569) * 86400 * 1000);
  return isNaN(d.getTime()) ? null : d;
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function safeNum(v: unknown): number | null {
  const f = parseFloat(String(v));
  return isNaN(f) ? null : f;
}

function safeInt(v: unknown): number | null {
  const f = parseInt(String(v), 10);
  return isNaN(f) ? null : f;
}

function cleanTag(s: string): string {
  return s.replace(/\.0+$/, '').trim();
}

function isSONumero(s: string): boolean {
  return /^\d+-\d+$/.test(s);
}

function isTagNumero(s: string): boolean {
  return /^\d{4,6}$/.test(s);
}

function clampPct(v: number | null): number | null {
  if (v === null) return null;
  return Math.min(9999.9999, Math.max(-9999.9999, parseFloat(v.toFixed(4))));
}

// ── Parsers ───────────────────────────────────────────────────────────────────

async function parseXLS(
  source: Source,
  file: File,
  eauStocks: Set<string>
): Promise<VenteRow[] | CoutRow[]> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const ref = ws['!ref'];
  if (!ref) return [];
  const range = XLSX.utils.decode_range(ref);
  const nrows = range.e.r + 1;

  function cv(r: number, c: number): unknown {
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    return cell ? cell.v : null;
  }

  // ── Coûts véhicules ────────────────────────────────────────────────────────
  if (source === 'couts') {
    const rows: CoutRow[] = [];
    for (let r = 10; r < nrows; r++) {
      const stock = cleanTag(String(cv(r, 1) ?? ''));
      if (!stock || !/^\d+$/.test(stock)) continue;
      const costPurchased = safeNum(cv(r, 11));
      if (costPurchased === null) continue;
      const dateAchat = xlDate(cv(r, 5));
      rows.push({
        stock_numero: stock,
        statut: String(cv(r, 2) ?? '').trim() || null,
        user_statut: String(cv(r, 3) ?? '').trim() || null,
        store: cleanTag(String(cv(r, 4) ?? '')) || null,
        date_achat: dateAchat ? toISODate(dateAchat) : null,
        age_jours: safeInt(cv(r, 7)),
        cost_purchased: costPurchased,
        cost_consumed: safeNum(cv(r, 14)),
        cost_remaining: safeNum(cv(r, 17)),
        projected_deficit: safeNum(cv(r, 20)),
        parts_total: safeInt(cv(r, 24)),
        parts_vendues: safeInt(cv(r, 26)),
        parts_restantes: safeInt(cv(r, 28)),
        prix_vente: safeNum(cv(r, 29)) ?? 0,
        remaining_market: safeNum(cv(r, 32)),
        gm_pct: clampPct(safeNum(cv(r, 33))),
        updated_at: new Date().toISOString(),
      });
    }
    return rows;
  }

  // ── Encan (Ritchie Bros) ───────────────────────────────────────────────────
  if (source === 'encan') {
    const rows: VenteRow[] = [];
    let currentSO: string | null = null;
    let currentDate: Date | null = null;
    let lastKnownAF: number | null = null;

    for (let r = 6; r < nrows; r++) {
      const raw0 = cv(r, 0);
      const col0 = cleanTag(String(raw0 ?? ''));

      if (isSONumero(col0)) {
        currentSO = col0;
        currentDate = xlDate(cv(r, 2));
        if (currentDate) lastKnownAF = anneeFiscale(currentDate);
        continue;
      }

      if (!isTagNumero(col0)) continue;

      const prix = safeNum(cv(r, 12));
      const cout = safeNum(cv(r, 25));
      const profit = safeNum(cv(r, 27));
      const pct = safeNum(cv(r, 29));
      if (prix === null && cout === null) continue;

      const rawCol2 = cv(r, 2);
      const col2 = String(rawCol2 ?? '').trim();
      const desc = col2 && xlDate(rawCol2) === null ? col2 : null;

      const af = currentDate
        ? anneeFiscale(currentDate)
        : (lastKnownAF ?? new Date().getFullYear());

      rows.push({
        stock_numero: col0,
        source: 'encan',
        source_priorite: 1,
        annee_fiscale: af,
        date_vente: currentDate ? toISODate(currentDate) : null,
        so_numero: currentSO,
        client: null,
        vehicule: desc ? desc.slice(0, 200) : null,
        description: desc ? desc.slice(0, 500) : null,
        cout_vente: cout,
        prix_vente: prix,
        profit_source: profit,
        pct_profit_source: pct,
      });
    }
    return rows;
  }

  // ── Received Items (prix d'achat réel) ───────────────────────────────────
  if (source === 'received') {
    const best: Record<string, ReceivedRow> = {};
    for (let r = 8; r < nrows; r++) {
      const stock = cleanTag(String(cv(r, 4) ?? ''));
      if (!stock || !/^\d+$/.test(stock)) continue;
      const extPrix = safeNum(cv(r, 13));
      if (!extPrix || extPrix <= 0) continue;
      const prix = safeNum(cv(r, 11));
      if (!prix || prix <= 0) continue;
      const d = xlDate(cv(r, 2));
      const dateStr = d ? toISODate(d) : null;
      if (!best[stock] || (dateStr && (!best[stock].date_achat_po || dateStr > best[stock].date_achat_po!))) {
        best[stock] = { stock_numero: stock, prix_achat_reel: prix, date_achat_po: dateStr };
      }
    }
    return Object.values(best);
  }

  // ── Détail ou Exportation (même format) ───────────────────────────────────
  const rows: VenteRow[] = [];
  const isExport = source === 'exportation';

  for (let r = 6; r < nrows; r++) {
    const d = xlDate(cv(r, 1));
    if (!d) continue;
    const so = String(cv(r, 2) ?? '').trim();
    if (!so) continue;
    const client = String(cv(r, 3) ?? '').trim();
    if (client.toUpperCase().includes('RITCHIE')) continue;

    const tag = cleanTag(String(cv(r, 5) ?? ''));
    const cout = safeNum(cv(r, 15));
    const prix = safeNum(cv(r, 17));
    const profit = safeNum(cv(r, 19));
    const pct = safeNum(cv(r, 20));
    if (prix === null && profit === null) continue;

    const vSource = isExport
      ? 'exportation'
      : (eauStocks.has(tag) ? 'eau' : 'detail');
    const prio = isExport ? 2 : 3;

    rows.push({
      stock_numero: tag || null,
      source: vSource as VenteRow['source'],
      source_priorite: prio as 1 | 2 | 3,
      annee_fiscale: anneeFiscale(d),
      date_vente: toISODate(d),
      so_numero: so,
      client: client || null,
      vehicule: String(cv(r, 10) ?? '').trim() || null,
      description: (String(cv(r, 12) ?? '').trim().slice(0, 500)) || null,
      cout_vente: cout,
      prix_vente: prix,
      profit_source: profit,
      pct_profit_source: pct,
    });
  }
  return rows;
}

// ── Import Supabase ───────────────────────────────────────────────────────────

async function importCouts(rows: CoutRow[], fichier: string, userId: string): Promise<string> {
  const imp = await supabase.from('prod_imports_historique').insert({
    type_import: 'couts-vehicules',
    source: 'couts',
    annee_fiscale: null,
    nom_fichier: fichier,
    nb_lignes_lu: rows.length,
    nb_inserts: 0,
    nb_updates: rows.length,
    nb_ignores: 0,
    importe_par: userId,
  }).select('id').single();

  const importId = imp.data?.id;
  const BATCH = 100;
  let total = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map(r => ({ ...r, import_id: importId }));
    const { error } = await supabase
      .from('prod_couts_vehicule')
      .upsert(batch, { onConflict: 'stock_numero' });
    if (error) throw new Error(error.message);
    total += batch.length;
  }

  return `${total} véhicules mis à jour`;
}

async function importVentes(
  rows: VenteRow[],
  source: 'encan' | 'exportation' | 'detail',
  fichier: string,
  userId: string
): Promise<string> {
  const validRows = rows.filter(r => r.prix_vente !== null && r.stock_numero);
  const ignored = rows.length - validRows.length;

  if (validRows.length === 0) return 'Aucune ligne valide';

  const afs = [...new Set(validRows.map(r => r.annee_fiscale))];

  const imp = await supabase.from('prod_imports_historique').insert({
    type_import: 'ventes',
    source,
    annee_fiscale: afs.length === 1 ? afs[0] : null,
    nom_fichier: fichier,
    nb_lignes_lu: rows.length,
    nb_inserts: 0,
    nb_updates: 0,
    nb_ignores: ignored,
    importe_par: userId,
  }).select('id').single();

  const importId = imp.data?.id;
  const BATCH = 50;
  let totalInserts = 0;
  let totalUpdates = 0;
  let totalIgnores = ignored;

  for (let i = 0; i < validRows.length; i += BATCH) {
    const batch = validRows.slice(i, i + BATCH).map(r => ({ ...r, import_id: importId }));
    const { data, error } = await supabase.rpc('import_vente_avec_priorite', {
      p_records: batch,
    });
    if (error) throw new Error(error.message);
    totalInserts += data?.inserts ?? 0;
    totalUpdates += data?.updates ?? 0;
    totalIgnores += data?.ignores ?? 0;
  }

  await supabase.from('prod_imports_historique').update({
    nb_inserts: totalInserts,
    nb_updates: totalUpdates,
    nb_ignores: totalIgnores,
  }).eq('id', importId);

  return `${totalInserts} inserts · ${totalUpdates} updates · ${totalIgnores} ignorés`;
}

async function importReceived(rows: ReceivedRow[], fichier: string, userId: string): Promise<string> {
  await supabase.from('prod_imports_historique').insert({
    type_import: 'received-items',
    source: 'received-items',
    annee_fiscale: null,
    nom_fichier: fichier,
    nb_lignes_lu: rows.length,
    nb_inserts: rows.length,
    nb_updates: 0,
    nb_ignores: 0,
    importe_par: userId,
  });

  let total = 0;
  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    for (const r of batch) {
      await supabase.from('prod_couts_vehicule').update({
        prix_achat_reel: r.prix_achat_reel,
        date_achat_po: r.date_achat_po,
      }).eq('stock_numero', r.stock_numero);
    }
    total += batch.length;
  }
  return `${total} prix d'achat mis à jour`;
}

// ── Composant ─────────────────────────────────────────────────────────────────

const ZONES: { id: Source; label: string; icon: string; color: string; hint: string }[] = [
  { id: 'received',    label: "Prix d'achat",      icon: '🧾', color: '#a78bfa', hint: 'receiveditems.xls' },
  { id: 'couts',       label: 'Coûts véhicules',   icon: '💰', color: '#f59e0b', hint: 'vehiclevalueanalysis.xls' },
  { id: 'encan',       label: 'Encan',              icon: '🔨', color: '#ef4444', hint: 'ritchi 2024.xls / 2025.xls' },
  { id: 'exportation', label: 'Exportation',        icon: '🌎', color: '#3b82f6', hint: 'salesbyinventorytype-exportation.xls' },
  { id: 'detail',      label: 'Ventes détail',      icon: '🏷️', color: '#22c55e', hint: 'vente details 2024.xls / 2025.xls' },
];

export function VueImport() {
  const { profile } = useAuth();
  const [zones, setZones] = useState<Record<Source, ZoneState>>({
    received: { ...ZONE_IDLE },
    couts: { ...ZONE_IDLE },
    encan: { ...ZONE_IDLE },
    exportation: { ...ZONE_IDLE },
    detail: { ...ZONE_IDLE },
  });
  const [eauStocks, setEauStocks] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<ImportLog[]>([]);
  const [conflits, setConflits] = useState<ConflitRow[]>([]);
  const [draggingOver, setDraggingOver] = useState<Source | null>(null);
  const fileInputRefs = useRef<Record<Source, HTMLInputElement | null>>({
    received: null, couts: null, encan: null, exportation: null, detail: null,
  });

  useEffect(() => {
    supabase.from('prod_inventaire').select('numero').eq('type', 'eau').then(({ data }) => {
      if (data) setEauStocks(new Set(data.map((r: { numero: string }) => r.numero)));
    });
    loadHistory();
    loadConflits();
  }, []);

  async function loadHistory() {
    const { data } = await supabase
      .from('prod_imports_historique')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setHistory(data as ImportLog[]);
  }

  async function loadConflits() {
    const { data } = await supabase
      .from('prod_conflits_import')
      .select('*')
      .eq('resolu', false)
      .order('date_import', { ascending: false })
      .limit(100);
    if (data) setConflits(data as ConflitRow[]);
  }

  async function marquerResolu(id: string) {
    await supabase.from('prod_conflits_import').update({ resolu: true }).eq('id', id);
    setConflits(prev => prev.filter(c => c.id !== id));
  }

  async function marquerTousResolus() {
    const ids = conflits.map(c => c.id);
    await supabase.from('prod_conflits_import').update({ resolu: true }).in('id', ids);
    setConflits([]);
  }

  const updateZone = useCallback((id: Source, patch: Partial<ZoneState>) => {
    setZones(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  async function handleFile(id: Source, file: File) {
    updateZone(id, { file, status: 'parsing', message: 'Lecture du fichier...', rows: [] });
    try {
      const rows = await parseXLS(id, file, eauStocks);
      if (rows.length === 0) {
        updateZone(id, { status: 'error', message: 'Aucune ligne valide trouvée.' });
        return;
      }
      const preview = id === 'couts'
        ? `${rows.length} véhicules`
        : (() => {
            const vrows = rows as VenteRow[];
            const afs = [...new Set(vrows.map(r => r.annee_fiscale))].sort().join(', ');
            const sources = [...new Set(vrows.map(r => r.source))].join(', ');
            return `${rows.length} lignes · AF ${afs} · ${sources}`;
          })();
      updateZone(id, { status: 'ready', rows, message: preview });
    } catch (e) {
      updateZone(id, { status: 'error', message: `Erreur: ${(e as Error).message}` });
    }
  }

  async function handleImport(id: Source) {
    const zone = zones[id];
    if (!zone.rows.length || !profile) return;
    updateZone(id, { status: 'importing', message: 'Import en cours...' });
    try {
      let result: string;
      if (id === 'received') {
        result = await importReceived(zone.rows as ReceivedRow[], zone.file!.name, profile.id);
      } else if (id === 'couts') {
        result = await importCouts(zone.rows as CoutRow[], zone.file!.name, profile.id);
      } else {
        result = await importVentes(
          zone.rows as VenteRow[],
          id as 'encan' | 'exportation' | 'detail',
          zone.file!.name,
          profile.id
        );
      }
      updateZone(id, { status: 'done', message: result });
      loadHistory();
      loadConflits();
    } catch (e) {
      updateZone(id, { status: 'error', message: `Erreur: ${(e as Error).message}` });
    }
  }

  function handleDrop(id: Source, e: React.DragEvent) {
    e.preventDefault();
    setDraggingOver(null);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(id, file);
  }

  function resetZone(id: Source) {
    updateZone(id, { ...ZONE_IDLE });
    if (fileInputRefs.current[id]) fileInputRefs.current[id]!.value = '';
  }

  if (profile?.role !== 'gestion') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.4)' }}>
        Accès réservé au rôle gestion.
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#0f0e0b', padding: '24px 32px', fontFamily: 'system-ui, sans-serif' }}>

      {/* En-tête */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, color: 'white', fontSize: 22, fontWeight: 700 }}>Import de données</h1>
        <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
          Glisse un fichier XLS dans la zone correspondante, puis clique Importer.
        </p>
      </div>

      {/* Zones de dépôt */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 40 }}>
        {ZONES.map(zone => {
          const z = zones[zone.id];
          const isOver = draggingOver === zone.id;

          return (
            <div key={zone.id} style={{
              background: '#1a1917',
              border: `1px solid ${isOver ? zone.color : z.status === 'done' ? '#22c55e33' : z.status === 'error' ? '#ef444433' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 12,
              padding: 20,
              transition: 'border-color 0.2s',
            }}>
              {/* Titre zone */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 22 }}>{zone.icon}</span>
                <div>
                  <div style={{ color: 'white', fontWeight: 700, fontSize: 15 }}>{zone.label}</div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{zone.hint}</div>
                </div>
                {z.file && (
                  <button
                    onClick={() => resetZone(zone.id)}
                    style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }}
                    title="Retirer le fichier"
                  >×</button>
                )}
              </div>

              {/* Zone de dépôt */}
              <div
                onDragOver={e => { e.preventDefault(); setDraggingOver(zone.id); }}
                onDragLeave={() => setDraggingOver(null)}
                onDrop={e => handleDrop(zone.id, e)}
                onClick={() => z.status === 'idle' && fileInputRefs.current[zone.id]?.click()}
                style={{
                  border: `2px dashed ${isOver ? zone.color : 'rgba(255,255,255,0.12)'}`,
                  borderRadius: 8,
                  padding: '18px 16px',
                  textAlign: 'center',
                  cursor: z.status === 'idle' ? 'pointer' : 'default',
                  background: isOver ? `${zone.color}10` : 'transparent',
                  transition: 'all 0.2s',
                  minHeight: 70,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {z.status === 'idle' && (
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                    Glisser un fichier .xls ici ou cliquer pour choisir
                  </span>
                )}
                {z.status === 'parsing' && (
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>Lecture...</span>
                )}
                {(z.status === 'ready' || z.status === 'done') && (
                  <div style={{ textAlign: 'left', width: '100%' }}>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 4 }}>
                      {z.file?.name}
                    </div>
                    <div style={{ color: z.status === 'done' ? '#22c55e' : zone.color, fontSize: 13, fontWeight: 600 }}>
                      {z.message}
                    </div>
                  </div>
                )}
                {z.status === 'importing' && (
                  <span style={{ color: zone.color, fontSize: 13 }}>Import en cours...</span>
                )}
                {z.status === 'error' && (
                  <div style={{ color: '#ef4444', fontSize: 13 }}>{z.message}</div>
                )}
              </div>

              <input
                ref={el => { fileInputRefs.current[zone.id] = el; }}
                type="file"
                accept=".xls,.xlsx"
                style={{ display: 'none' }}
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(zone.id, f);
                }}
              />

              {/* Bouton importer */}
              {z.status === 'ready' && (
                <button
                  onClick={() => handleImport(zone.id)}
                  style={{
                    marginTop: 12, width: '100%',
                    background: zone.color, border: 'none', borderRadius: 8,
                    color: 'white', padding: '10px 0',
                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  Importer {z.rows.length} lignes
                </button>
              )}

              {z.status === 'done' && (
                <button
                  onClick={() => resetZone(zone.id)}
                  style={{
                    marginTop: 12, width: '100%',
                    background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
                    color: 'rgba(255,255,255,0.4)', padding: '8px 0',
                    fontSize: 13, cursor: 'pointer',
                  }}
                >
                  Importer un autre fichier
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Conflits de prix */}
      {conflits.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <h2 style={{ color: '#ef4444', fontSize: 16, fontWeight: 700, margin: 0 }}>
              ⚠️ Conflits de prix ({conflits.length})
            </h2>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
              — Le fichier importé avait une valeur différente du prix protégé en BD
            </span>
            <button
              onClick={marquerTousResolus}
              style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'rgba(255,255,255,0.4)', padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}
            >
              Tout marquer résolu
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['Date', 'Stock #', 'Champ', 'Prix en BD (protégé)', "Prix dans l'import", 'Écart', 'Source', ''].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: h === '' ? 'center' : 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {conflits.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.8)' }}>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                      {new Date(c.date_import).toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 700 }}>{c.stock_numero}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ background: '#ef444420', color: '#ef4444', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                        {c.champ === 'prix_vente' ? 'Prix de vente' : "Prix d'achat"}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 700, color: '#22c55e' }}>
                      {new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(c.valeur_bd)}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.6)' }}>
                      {new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(c.valeur_import)}
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 700, color: c.ecart > 0 ? '#22c55e' : '#ef4444' }}>
                      {c.ecart > 0 ? '+' : ''}{new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(c.ecart)}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{c.source}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <button
                        onClick={() => marquerResolu(c.id)}
                        style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, color: 'rgba(255,255,255,0.4)', padding: '4px 10px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        title="Marquer comme résolu (corrigé dans Supabase)"
                      >
                        ✓ Résolu
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Historique */}
      <div>
        <h2 style={{ color: 'white', fontSize: 16, fontWeight: 700, margin: '0 0 14px' }}>
          Historique des imports
        </h2>
        {history.length === 0 ? (
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Aucun import enregistré.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  {['Date', 'Source', 'Fichier', 'AF', 'Lu', 'Inserts', 'Updates', 'Ignorés', 'Conflits'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map(row => (
                  <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                      {new Date(row.created_at).toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{
                        background: row.source === 'encan' ? '#ef444420' : row.source === 'couts' ? '#f59e0b20' : row.source === 'exportation' ? '#3b82f620' : '#22c55e20',
                        color: row.source === 'encan' ? '#ef4444' : row.source === 'couts' ? '#f59e0b' : row.source === 'exportation' ? '#3b82f6' : '#22c55e',
                        padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700,
                      }}>
                        {row.source}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.nom_fichier}</td>
                    <td style={{ padding: '8px 12px' }}>{row.annee_fiscale ?? '—'}</td>
                    <td style={{ padding: '8px 12px' }}>{row.nb_lignes_lu}</td>
                    <td style={{ padding: '8px 12px', color: '#22c55e' }}>{row.nb_inserts}</td>
                    <td style={{ padding: '8px 12px', color: '#f59e0b' }}>{row.nb_updates}</td>
                    <td style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.3)' }}>{row.nb_ignores}</td>
                    <td style={{ padding: '8px 12px', color: row.nb_conflits > 0 ? '#ef4444' : 'rgba(255,255,255,0.2)', fontWeight: row.nb_conflits > 0 ? 700 : 400 }}>
                      {row.nb_conflits > 0 ? `⚠️ ${row.nb_conflits}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
