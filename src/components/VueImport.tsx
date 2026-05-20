import { useState, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  // Coûts
  parseHitracCSV, loadInventaireActif, calculateDiff, executeImport, restoreImport, listImports,
  type DiffSummary, type DiffRow, type ImportResult, type ImportLogEntry,
  // Ventes
  parseSalesByInventoryType, parseSalesByCustomer, loadVentesExistantes, calculateVenteDiff, executeVenteImport,
  type VenteRow, type VenteDiffSummary, type VenteDiffRow, type VenteImportResult, type VenteWizardKind,
} from '../services/hitracImportService';
import {
  parsePiecesCSV, loadPiecesExistantes, calculatePiecesDiff, executePiecesImport,
  type PieceRow, type PiecesDiff, type PiecesImportResult,
} from '../services/piecesImportService';

type TabId = 'couts' | 'ventes_eau_detail' | 'ventes_exportation' | 'ventes_encan' | 'ventes_pieces';

const TABS: { id: TabId; label: string; icon: string; color: string }[] = [
  { id: 'couts',                label: 'Coûts HITRAC',           icon: '📥', color: '#3b82f6' },
  { id: 'ventes_eau_detail',    label: 'Ventes Eau / Détail',    icon: '💧', color: '#0ea5e9' },
  { id: 'ventes_exportation',   label: 'Ventes Exportation',     icon: '🌍', color: '#7c3aed' },
  { id: 'ventes_encan',         label: 'Ventes Encan',           icon: '🔨', color: '#f59e0b' },
  { id: 'ventes_pieces',        label: 'Ventes Pièces',          icon: '🔧', color: '#10b981' },
];

export function VueImport() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<TabId>('couts');

  if (profile?.role !== 'gestion') {
    return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>Accès réservé aux gestionnaires.</div>;
  }

  return (
    <div style={{
      width: '100%', height: '100%', overflowY: 'auto',
      background: '#f8fafc', boxSizing: 'border-box',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Onglets sticky */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: '#0f172a', padding: '14px 24px',
        display: 'flex', gap: 6, overflowX: 'auto',
        borderBottom: '2px solid #1e293b',
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
            padding: '9px 16px', borderRadius: 8,
            background: tab === t.id ? `${t.color}25` : 'rgba(255,255,255,0.05)',
            border: tab === t.id ? `1px solid ${t.color}` : '1px solid rgba(255,255,255,0.1)',
            color: tab === t.id ? t.color : 'rgba(255,255,255,0.6)',
            cursor: 'pointer', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
          }}>
            <span style={{ fontSize: 16 }}>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: 24 }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          {tab === 'couts'              && <CoutsImporter />}
          {tab === 'ventes_eau_detail'  && <VentesImporter wizard="eau_detail" />}
          {tab === 'ventes_exportation' && <VentesImporter wizard="exportation" />}
          {tab === 'ventes_encan'       && <VentesImporter wizard="encan" />}
          {tab === 'ventes_pieces'      && <PiecesImporter />}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// ─── IMPORTER COÛTS (vehiclecostdetail.csv) ────────────────────────
// ════════════════════════════════════════════════════════════════════

function CoutsImporter() {
  const { profile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'confirming' | 'done'>('upload');
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState('');
  const [diff, setDiff] = useState<DiffSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [filterKind, setFilterKind] = useState<'all' | DiffRow['kind']>('all');
  const [imports, setImports] = useState<ImportLogEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => { listImports('hitrac_couts').then(setImports).catch(console.error); }, [result]);

  const handleFile = async (file: File) => {
    setError(null); setLoading(true); setFilename(file.name);
    try {
      const text = await file.text();
      const h = parseHitracCSV(text);
      if (h.length === 0) throw new Error("Aucune donnée HITRAC trouvée. Vérifie le format.");
      const db = await loadInventaireActif();
      setDiff(calculateDiff(db, h));
      setStep('preview');
    } catch (e: any) { setError(e?.message ?? String(e)); setStep('upload'); }
    finally { setLoading(false); }
  };

  const handleConfirm = async () => {
    if (!diff) return;
    setStep('confirming'); setError(null);
    try {
      const r = await executeImport({ diff, filename, userEmail: profile?.email, userNom: profile?.nom });
      setResult(r); setStep('done');
    } catch (e: any) { setError(e?.message ?? String(e)); setStep('preview'); }
  };

  const handleRestore = async (id: string) => {
    if (!confirm('Restaurer ? Les prix_achat_reel et cout_mo des camions vont revenir à leur état précédent.')) return;
    try { const n = await restoreImport(id, profile?.nom ?? 'admin'); alert(`✅ ${n} camions restaurés.`); listImports('hitrac_couts').then(setImports); }
    catch (e: any) { alert(`Erreur : ${e?.message ?? String(e)}`); }
  };

  const reset = () => { setStep('upload'); setDiff(null); setError(null); setFilename(''); setResult(null); setFilterKind('all'); if (fileRef.current) fileRef.current.value = ''; };

  return (
    <div>
      <PageHeader icon="📥" title="Import HITRAC — Coûts inventaire actif"
        description={<>Met à jour <strong>prix_achat_reel</strong> et <strong>cout_mo</strong> sur les camions <strong>eau</strong> et <strong>détail</strong> en statut <strong>inventaire</strong> à partir du rapport <code>vehiclecostdetail.csv</code>.</>} />

      {step === 'upload' && <UploadZone loading={loading} fileRef={fileRef} onFile={handleFile} accept=".csv" hintFile="vehiclecostdetail.csv" />}
      {step === 'upload' && error && <ErrorBox msg={error} />}
      {step === 'upload' && (
        <RulesBox title="Règles appliquées :" items={[
          <>Cible : camions <strong>eau</strong> ou <strong>détail</strong>, statut <strong>inventaire</strong></>,
          <><code>prix_achat_reel</code> : écrit seulement si DB est vide ou ≤ $10 (placeholder)</>,
          <><code>cout_mo</code> : toujours écrasé par HITRAC, sauf si HITRAC = 0 et DB &gt; 0 (on garde DB)</>,
          <>Camions absents de HITRAC : ignorés</>,
          <>Stock# présent dans HITRAC mais absent de la DB : ignoré</>,
        ]} />
      )}

      {step === 'preview' && diff && (
        <CoutsPreview diff={diff} filterKind={filterKind} setFilterKind={setFilterKind} onCancel={reset} onConfirm={handleConfirm} error={error} />
      )}

      {step === 'confirming' && <ProcessingBox />}

      {step === 'done' && result && (
        <SuccessBox onReset={reset}>
          <div><strong>{result.nb_camions_analyses}</strong> camions analysés</div>
          <div><strong style={{ color: '#16a34a' }}>{result.nb_achats_modifies}</strong> prix d'achat ajoutés</div>
          <div><strong style={{ color: '#16a34a' }}>{result.nb_mo_modifies}</strong> coûts de main d'œuvre mis à jour</div>
          {result.nb_achats_proteges > 0 && <div><strong style={{ color: '#d97706' }}>{result.nb_achats_proteges}</strong> prix d'achat protégés</div>}
        </SuccessBox>
      )}

      <HistoryPanel
        title="Historique — Imports Coûts"
        imports={imports}
        showHistory={showHistory}
        setShowHistory={setShowHistory}
        onRestore={handleRestore}
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// ─── IMPORTER VENTES (3 wizards) ────────────────────────────────────
// ════════════════════════════════════════════════════════════════════

function VentesImporter({ wizard }: { wizard: VenteWizardKind }) {
  const { profile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'confirming' | 'done'>('upload');
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState('');
  const [diff, setDiff] = useState<VenteDiffSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VenteImportResult | null>(null);
  const [imports, setImports] = useState<ImportLogEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const typeImport = `hitrac_ventes_${wizard}`;
  const wizardCfg = WIZARD_CONFIG[wizard];

  useEffect(() => { listImports(typeImport).then(setImports).catch(console.error); }, [result, typeImport]);

  const handleFile = async (file: File) => {
    setError(null); setLoading(true); setFilename(file.name);
    try {
      const text = await file.text();
      const ventes: VenteRow[] = wizard === 'encan' ? parseSalesByCustomer(text) : parseSalesByInventoryType(text);
      if (ventes.length === 0) throw new Error("Aucune vente trouvée dans le fichier. Vérifie le format HITRAC.");

      // Pour eau/detail : filtrer aux inventory type 9000 seulement (Vehicle For Sale)
      let filtres = ventes;
      if (wizard === 'eau_detail') {
        filtres = ventes.filter(v => v.inventory_type?.startsWith('9000'));
        if (filtres.length === 0) throw new Error("Aucune ligne Vehicle For Sale (9000) trouvée. Tu as peut-être chargé un fichier exportation par erreur ?");
      } else if (wizard === 'exportation') {
        filtres = ventes.filter(v => v.inventory_type?.startsWith('9025'));
        if (filtres.length === 0) throw new Error("Aucune ligne Export Vehicles (9025) trouvée. Tu as peut-être chargé un fichier autre par erreur ?");
      }

      const stockNums = filtres.map(v => v.stock_numero);
      const db = await loadVentesExistantes(stockNums);
      setDiff(calculateVenteDiff(filtres, db, wizard));
      setStep('preview');
    } catch (e: any) { setError(e?.message ?? String(e)); setStep('upload'); }
    finally { setLoading(false); }
  };

  const handleConfirm = async () => {
    if (!diff) return;
    setStep('confirming'); setError(null);
    try {
      const r = await executeVenteImport({ diff, wizard, filename, userEmail: profile?.email, userNom: profile?.nom });
      setResult(r); setStep('done');
    } catch (e: any) { setError(e?.message ?? String(e)); setStep('preview'); }
  };

  const reset = () => { setStep('upload'); setDiff(null); setError(null); setFilename(''); setResult(null); if (fileRef.current) fileRef.current.value = ''; };

  return (
    <div>
      <PageHeader icon={wizardCfg.icon} title={`Import HITRAC — ${wizardCfg.title}`} description={wizardCfg.desc} />

      {step === 'upload' && <UploadZone loading={loading} fileRef={fileRef} onFile={handleFile} accept=".csv" hintFile={wizardCfg.expectedFile} color={wizardCfg.color} />}
      {step === 'upload' && error && <ErrorBox msg={error} />}
      {step === 'upload' && <RulesBox title="Règles appliquées :" items={wizardCfg.rules} />}

      {step === 'preview' && diff && (
        <VentesPreview diff={diff} wizard={wizard} onCancel={reset} onConfirm={handleConfirm} error={error} />
      )}

      {step === 'confirming' && <ProcessingBox />}

      {step === 'done' && result && (
        <SuccessBox onReset={reset}>
          <div><strong style={{ color: '#16a34a' }}>{result.nb_creees}</strong> camions créés</div>
          <div><strong style={{ color: '#3b82f6' }}>{result.nb_mises_a_jour}</strong> camions mis à jour</div>
          {result.nb_changements_source > 0 && <div><strong style={{ color: '#d97706' }}>{result.nb_changements_source}</strong> changements de source (encan/export prend priorité)</div>}
        </SuccessBox>
      )}

      <HistoryPanel
        title={`Historique — ${wizardCfg.title}`}
        imports={imports}
        showHistory={showHistory}
        setShowHistory={setShowHistory}
        // Pas de restore pour les ventes (logique différente — à implémenter si besoin)
      />
    </div>
  );
}

const WIZARD_CONFIG: Record<VenteWizardKind, {
  icon: string; color: string; title: string;
  desc: React.ReactNode;
  expectedFile: string;
  rules: React.ReactNode[];
}> = {
  eau_detail: {
    icon: '💧🏷️', color: '#0ea5e9',
    title: 'Ventes Eau / Détail',
    desc: <>Bascule les camions vendus du statut <strong>inventaire</strong> à <strong>vendu</strong> à partir du rapport <code>salesbyinventorytype.csv</code> (Inventory Type 9000). La source reste <strong>eau</strong> ou <strong>détail</strong> (définie par l'app de production).</>,
    expectedFile: 'salesbyinventorytype.csv (Type 9000)',
    rules: [
      <>Cible : lignes <strong>Inventory Type 9000 — Vehicle For Sale</strong> du fichier</>,
      <><code>source</code> en DB : <strong>inchangée</strong> (eau ou détail déjà défini par l'app)</>,
      <>Stock# présent dans le rapport mais absent de la DB : <strong>ignoré</strong> (camion non géré en production)</>,
      <>Stock# déjà en statut <strong>vendu</strong> : MAJ des champs si changement (date, prix, client)</>,
    ],
  },
  exportation: {
    icon: '🌍', color: '#7c3aed',
    title: 'Ventes Exportation',
    desc: <>Importe les camions vendus à l'exportation à partir du rapport <code>salesbyinventorytype.csv</code> (Inventory Type 9025). La source devient <strong>exportation</strong>.</>,
    expectedFile: 'salesbyinventorytype.csv (Type 9025)',
    rules: [
      <>Cible : lignes <strong>Inventory Type 9025 — Export Vehicles</strong> du fichier</>,
      <><code>source</code> : forcée à <strong>exportation</strong> (même si camion était eau/détail/encan)</>,
      <>Stock# absent de la DB : <strong>créé automatiquement</strong></>,
      <>Pas de camions à l'eau en exportation</>,
    ],
  },
  encan: {
    icon: '🔨', color: '#f59e0b',
    title: 'Ventes Encan',
    desc: <>Importe les ventes via encanteurs (Ritchie Bros, etc.) à partir du rapport <code>salesbycustomer.csv</code> filtré sur le client encanteur. La source devient <strong>encan</strong>.</>,
    expectedFile: 'salesbycustomer.csv (filtré sur encanteur)',
    rules: [
      <>Cible : <strong>seulement les camions</strong> (descriptions "Vehicle For Sale" ou "Export Vehicles")</>,
      <><strong>Ignore</strong> les pièces (suffixe <code>-X</code>) et les capital assets</>,
      <><code>source</code> : forcée à <strong>encan</strong> (l'encan a priorité sur toute autre source)</>,
      <>Stock# absent de la DB : <strong>créé automatiquement</strong></>,
    ],
  },
};

// ────────────────────────────────────────────────────────────────────
// ─── PREVIEW Coûts (existant) ──────────────────────────────────────
// ────────────────────────────────────────────────────────────────────

function CoutsPreview({ diff, filterKind, setFilterKind, onCancel, onConfirm, error }: {
  diff: DiffSummary;
  filterKind: 'all' | DiffRow['kind'];
  setFilterKind: (k: any) => void;
  onCancel: () => void;
  onConfirm: () => void;
  error: string | null;
}) {
  const filtered = useMemo(() => filterKind === 'all' ? diff.rows : diff.rows.filter(r => r.kind === filterKind), [diff, filterKind]);
  const sorted = useMemo(() => {
    const order: Record<DiffRow['kind'], number> = { 'maj_achat_et_mo': 0, 'maj_achat': 1, 'maj_mo': 2, 'protege': 3, 'absent_hitrac': 4, 'identique': 5 };
    return [...filtered].sort((a, b) => order[a.kind] - order[b.kind] || a.stock_numero.localeCompare(b.stock_numero));
  }, [filtered]);

  const total = diff.achats_a_ajouter + diff.mo_a_modifier;
  const hasAnomaly = diff.total_db > 0 && total / diff.total_db > 0.5;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, background: 'white', borderRadius: 14, padding: 16, marginBottom: 16, border: '1px solid #e5e7eb' }}>
        <StatCard label="Camions analysés" value={diff.total_db} color="#0f172a" />
        <StatCard label="Trouvés HITRAC" value={diff.trouves_dans_hitrac} color="#16a34a" />
        <StatCard label="Absents HITRAC" value={diff.absents_de_hitrac} color="#6b7280" />
        <StatCard label="Achats à ajouter" value={diff.achats_a_ajouter} color="#16a34a" highlight />
        <StatCard label="M.O. à modifier" value={diff.mo_a_modifier} color="#3b82f6" highlight />
        <StatCard label="Achats protégés" value={diff.achats_proteges} color="#d97706" />
        <StatCard label="Identiques" value={diff.identiques} color="#9ca3af" />
      </div>

      {hasAnomaly && <AnomalyBox />}

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <FilterChip active={filterKind === 'all'} onClick={() => setFilterKind('all')} label={`Tous (${diff.rows.length})`} />
        <FilterChip active={filterKind === 'maj_achat'} onClick={() => setFilterKind('maj_achat')} label={`Achats ajoutés (${diff.achats_a_ajouter})`} color="#16a34a" />
        <FilterChip active={filterKind === 'maj_mo'} onClick={() => setFilterKind('maj_mo')} label={`M.O. modifiés (${diff.mo_a_modifier})`} color="#3b82f6" />
        <FilterChip active={filterKind === 'protege'} onClick={() => setFilterKind('protege')} label={`Protégés (${diff.achats_proteges})`} color="#d97706" />
        <FilterChip active={filterKind === 'absent_hitrac'} onClick={() => setFilterKind('absent_hitrac')} label={`Absents HITRAC (${diff.absents_de_hitrac})`} color="#6b7280" />
        <FilterChip active={filterKind === 'identique'} onClick={() => setFilterKind('identique')} label={`Identiques (${diff.identiques})`} color="#9ca3af" />
      </div>

      <div style={tableContainer}>
        <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
          <table style={tableStyle}>
            <thead style={tableHeadSticky}>
              <tr>
                <th style={thDark}>Stock #</th><th style={thDark}>Type</th><th style={thDark}>Camion</th>
                <th style={thDark}>Achat DB</th><th style={thDark}>Achat HITRAC</th><th style={thDark}>→ Nouveau</th>
                <th style={thDark}>M.O. DB</th><th style={thDark}>M.O. HITRAC</th><th style={thDark}>→ Nouveau</th>
                <th style={thDark}>Action</th>
              </tr>
            </thead>
            <tbody>{sorted.map(r => <CoutsDiffRowView key={r.stock_numero} row={r} />)}</tbody>
          </table>
        </div>
      </div>

      {error && <ErrorBox msg={error} />}
      <ActionsBar onCancel={onCancel} onConfirm={onConfirm} confirmLabel={`✅ Backup + Confirmer (${total} changements)`} confirmDisabled={total === 0} />
    </div>
  );
}

function CoutsDiffRowView({ row }: { row: DiffRow }) {
  const fmt = (n: number | null) => n == null ? '—' : `$${Math.round(n).toLocaleString('fr-CA')}`;
  const rowBg = row.kind === 'maj_achat_et_mo' || row.kind === 'maj_achat' ? '#f0fdf4' : row.kind === 'maj_mo' ? '#eff6ff' : row.kind === 'protege' ? '#fffbeb' : row.kind === 'absent_hitrac' ? '#f9fafb' : 'white';
  const actionLabel = row.kind === 'maj_achat_et_mo' ? '✓ MAJ achat + MO' : row.kind === 'maj_achat' ? '✓ MAJ achat' : row.kind === 'maj_mo' ? '✓ MAJ M.O.' : row.kind === 'protege' ? '🛡 Protégé' : row.kind === 'absent_hitrac' ? '— Absent' : '= Identique';
  const actionColor = row.kind.startsWith('maj') ? '#16a34a' : row.kind === 'protege' ? '#d97706' : '#6b7280';
  return (
    <tr style={{ background: rowBg, borderBottom: '1px solid #f3f4f6' }}>
      <td style={{ ...td, fontFamily: 'monospace', fontWeight: 800 }}>{row.stock_numero}</td>
      <td style={td}>{row.type === 'eau' ? '💧' : '🏷️'}</td>
      <td style={{ ...td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</td>
      <td style={tdNum}>{fmt(row.achat_db)}</td><td style={tdNum}>{fmt(row.achat_hitrac)}</td>
      <td style={{ ...tdNum, fontWeight: row.achat_nouvelle !== null ? 800 : 400, color: row.achat_nouvelle !== null ? '#16a34a' : '#9ca3af' }}>{row.achat_nouvelle === null ? '—' : fmt(row.achat_nouvelle)}</td>
      <td style={tdNum}>{fmt(row.mo_db)}</td><td style={tdNum}>{fmt(row.mo_hitrac)}</td>
      <td style={{ ...tdNum, fontWeight: row.mo_nouvelle !== null ? 800 : 400, color: row.mo_nouvelle !== null ? '#3b82f6' : '#9ca3af' }}>{row.mo_nouvelle === null ? '—' : fmt(row.mo_nouvelle)}</td>
      <td style={{ ...td, fontWeight: 700, color: actionColor }}>{actionLabel}</td>
    </tr>
  );
}

// ────────────────────────────────────────────────────────────────────
// ─── PREVIEW Ventes ────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────

function VentesPreview({ diff, wizard, onCancel, onConfirm, error }: {
  diff: VenteDiffSummary;
  wizard: VenteWizardKind;
  onCancel: () => void;
  onConfirm: () => void;
  error: string | null;
}) {
  const [filter, setFilter] = useState<'all' | VenteDiffRow['action']>('all');
  const filtered = useMemo(() => filter === 'all' ? diff.rows : diff.rows.filter(r => r.action === filter), [diff, filter]);
  const order: Record<VenteDiffRow['action'], number> = { 'creer': 0, 'maj_inventaire_vers_vendu': 1, 'changer_source': 2, 'maj_vendu': 3, 'identique': 4, 'ignore_pas_en_db': 5 };
  const sorted = useMemo(() => [...filtered].sort((a,b) => order[a.action]-order[b.action] || a.stock_numero.localeCompare(b.stock_numero)), [filtered]);

  const total = diff.a_creer + diff.a_maj_inv_vers_vendu + diff.a_maj_vendu + diff.a_changer_source;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, background: 'white', borderRadius: 14, padding: 16, marginBottom: 16, border: '1px solid #e5e7eb' }}>
        <StatCard label="Lignes du rapport" value={diff.total_lignes} color="#0f172a" />
        <StatCard label="À créer" value={diff.a_creer} color="#16a34a" highlight />
        <StatCard label="Inv → Vendu" value={diff.a_maj_inv_vers_vendu} color="#3b82f6" highlight />
        <StatCard label="MAJ vendu" value={diff.a_maj_vendu} color="#0ea5e9" />
        <StatCard label="Source changée" value={diff.a_changer_source} color="#d97706" />
        <StatCard label="Identiques" value={diff.identiques} color="#9ca3af" />
        {diff.ignores > 0 && <StatCard label="Ignorés (pas en DB)" value={diff.ignores} color="#ef4444" />}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <FilterChip active={filter==='all'} onClick={() => setFilter('all')} label={`Toutes (${diff.rows.length})`} />
        <FilterChip active={filter==='creer'} onClick={() => setFilter('creer')} label={`Créer (${diff.a_creer})`} color="#16a34a" />
        <FilterChip active={filter==='maj_inventaire_vers_vendu'} onClick={() => setFilter('maj_inventaire_vers_vendu')} label={`Inv→Vendu (${diff.a_maj_inv_vers_vendu})`} color="#3b82f6" />
        <FilterChip active={filter==='changer_source'} onClick={() => setFilter('changer_source')} label={`Source changée (${diff.a_changer_source})`} color="#d97706" />
        <FilterChip active={filter==='maj_vendu'} onClick={() => setFilter('maj_vendu')} label={`MAJ vendu (${diff.a_maj_vendu})`} color="#0ea5e9" />
        <FilterChip active={filter==='identique'} onClick={() => setFilter('identique')} label={`Identique (${diff.identiques})`} color="#9ca3af" />
        {diff.ignores > 0 && <FilterChip active={filter==='ignore_pas_en_db'} onClick={() => setFilter('ignore_pas_en_db')} label={`Ignorés (${diff.ignores})`} color="#ef4444" />}
      </div>

      <div style={tableContainer}>
        <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
          <table style={tableStyle}>
            <thead style={tableHeadSticky}>
              <tr>
                <th style={thDark}>Stock #</th><th style={thDark}>Camion</th>
                <th style={thDark}>Date</th><th style={thDark}>Client</th>
                <th style={thDark}>Coût</th><th style={thDark}>Vente</th><th style={thDark}>Profit</th><th style={thDark}>%</th>
                <th style={thDark}>Source</th><th style={thDark}>Action</th>
              </tr>
            </thead>
            <tbody>{sorted.map(r => <VenteDiffRowView key={`${r.stock_numero}-${r.vente.so_numero ?? ''}`} row={r} />)}</tbody>
          </table>
        </div>
      </div>

      {error && <ErrorBox msg={error} />}
      <ActionsBar onCancel={onCancel} onConfirm={onConfirm} confirmLabel={`✅ Backup + Confirmer (${total} changements)`} confirmDisabled={total === 0} />
    </div>
  );
}

function VenteDiffRowView({ row }: { row: VenteDiffRow }) {
  const fmt = (n: number) => `$${Math.round(n).toLocaleString('fr-CA')}`;
  const rowBg = row.action === 'creer' ? '#f0fdf4' : row.action === 'maj_inventaire_vers_vendu' ? '#eff6ff' : row.action === 'changer_source' ? '#fffbeb' : row.action === 'ignore_pas_en_db' ? '#fef2f2' : 'white';
  const actionLabels: Record<VenteDiffRow['action'], { label: string; color: string }> = {
    'creer':                       { label: '+ Créer',         color: '#16a34a' },
    'maj_inventaire_vers_vendu':   { label: 'Inv → Vendu',     color: '#3b82f6' },
    'changer_source':              { label: '🔄 Source',       color: '#d97706' },
    'maj_vendu':                   { label: '✓ MAJ vendu',     color: '#0ea5e9' },
    'identique':                   { label: '= Identique',     color: '#6b7280' },
    'ignore_pas_en_db':            { label: '✕ Ignoré',        color: '#ef4444' },
  };
  const a = actionLabels[row.action];
  const sourceCell = row.source_actuelle && row.source_actuelle !== row.source_nouvelle
    ? <span>{row.source_actuelle} → <strong>{row.source_nouvelle}</strong></span>
    : <strong>{row.source_nouvelle}</strong>;

  return (
    <tr style={{ background: rowBg, borderBottom: '1px solid #f3f4f6' }}>
      <td style={{ ...td, fontFamily: 'monospace', fontWeight: 800 }}>{row.stock_numero}</td>
      <td style={{ ...td, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</td>
      <td style={td}>{row.vente.date_vente}</td>
      <td style={{ ...td, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.vente.client ?? '—'}</td>
      <td style={tdNum}>{fmt(row.vente.line_cost)}</td>
      <td style={tdNum}>{fmt(row.vente.line_total)}</td>
      <td style={{ ...tdNum, color: row.vente.line_profit >= 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>{fmt(row.vente.line_profit)}</td>
      <td style={tdNum}>{row.vente.pct_profit.toFixed(1)}%</td>
      <td style={td}>{sourceCell}</td>
      <td style={{ ...td, fontWeight: 700, color: a.color }}>{a.label}</td>
    </tr>
  );
}

// ════════════════════════════════════════════════════════════════════
// ─── SOUS-COMPOSANTS PARTAGÉS ───────────────────────────────────────
// ════════════════════════════════════════════════════════════════════

function PageHeader({ icon, title, description }: { icon: string; title: string; description: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 28 }}>{icon}</span> {title}
      </h1>
      <p style={{ fontSize: 13, color: '#6b7280', marginTop: 6, lineHeight: 1.6 }}>{description}</p>
    </div>
  );
}

function UploadZone({ loading, fileRef, onFile, accept, hintFile, color }: { loading: boolean; fileRef: React.RefObject<HTMLInputElement>; onFile: (f: File) => void; accept: string; hintFile: string; color?: string }) {
  const c = color ?? '#3b82f6';
  return (
    <div style={{ background: 'white', borderRadius: 14, padding: 32, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <label htmlFor="hitrac-file" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '60px 24px', borderRadius: 12, border: `2px dashed ${loading ? c : '#d1d5db'}`, background: '#fafafa', cursor: loading ? 'wait' : 'pointer', color: '#6b7280', transition: 'all 0.15s' }}
        onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLLabelElement).style.borderColor = c; }}
        onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLLabelElement).style.borderColor = '#d1d5db'; }}>
        <span style={{ fontSize: 48 }}>📊</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#374151' }}>{loading ? 'Analyse en cours...' : 'Déposez le fichier ou cliquez pour parcourir'}</span>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>Format attendu : <code>{hintFile}</code></span>
        <input id="hitrac-file" ref={fileRef} type="file" accept={accept} disabled={loading} style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      </label>
    </div>
  );
}

function RulesBox({ title, items }: { title: string; items: React.ReactNode[] }) {
  return (
    <div style={{ marginTop: 18, padding: 14, borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a', fontSize: 12, color: '#92400e' }}>
      <strong>{title}</strong>
      <ul style={{ margin: '6px 0 0 0', paddingLeft: 20 }}>
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return <div style={{ marginTop: 14, padding: 14, borderRadius: 8, background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', fontSize: 13, fontWeight: 600 }}>❌ {msg}</div>;
}

function AnomalyBox() {
  return <div style={{ padding: 14, borderRadius: 10, background: '#fef2f2', border: '2px solid #fca5a5', color: '#991b1b', fontSize: 13, marginBottom: 16, fontWeight: 700 }}>⚠️ <strong>Anomalie possible :</strong> Plus de 50% des camions changent. Vérifie le fichier avant de confirmer.</div>;
}

function ProcessingBox() {
  return <div style={{ background: 'white', borderRadius: 14, padding: 60, textAlign: 'center' }}><div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div><div style={{ fontSize: 18, fontWeight: 700, color: '#374151' }}>Backup et mise à jour en cours…</div><div style={{ fontSize: 13, color: '#6b7280', marginTop: 6 }}>Ne fermez pas cette page.</div></div>;
}

function SuccessBox({ children, onReset }: { children: React.ReactNode; onReset: () => void }) {
  return (
    <div style={{ background: 'white', borderRadius: 14, padding: 40, textAlign: 'center', border: '1px solid #86efac' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: '#166534', margin: 0 }}>Import terminé</h2>
      <div style={{ fontSize: 14, color: '#374151', marginTop: 16, lineHeight: 1.8 }}>{children}</div>
      <div style={{ marginTop: 24, fontSize: 12, color: '#9ca3af' }}>Backup créé. En cas de problème, voir l'historique ci-dessous.</div>
      <button onClick={onReset} style={primaryBtn}>Nouvel import</button>
    </div>
  );
}

function StatCard({ label, value, color, highlight }: { label: string; value: number; color: string; highlight?: boolean }) {
  return (
    <div style={{ padding: '8px 12px', borderRadius: 8, background: highlight ? `${color}10` : 'transparent', borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1.2, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function FilterChip({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color?: string }) {
  const c = color ?? '#0f172a';
  return (
    <button onClick={onClick} style={{ padding: '6px 12px', borderRadius: 16, fontSize: 12, fontWeight: active ? 700 : 500, border: active ? `2px solid ${c}` : '1px solid #e5e7eb', background: active ? `${c}15` : 'white', color: active ? c : '#6b7280', cursor: 'pointer', whiteSpace: 'nowrap' }}>{label}</button>
  );
}

function ActionsBar({ onCancel, onConfirm, confirmLabel, confirmDisabled }: { onCancel: () => void; onConfirm: () => void; confirmLabel: string; confirmDisabled?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
      <button onClick={onCancel} style={secondaryBtn}>← Annuler</button>
      <button onClick={onConfirm} style={{ ...confirmBtn, opacity: confirmDisabled ? 0.5 : 1, cursor: confirmDisabled ? 'not-allowed' : 'pointer' }} disabled={confirmDisabled}>{confirmLabel}</button>
    </div>
  );
}

function HistoryPanel({ title, imports, showHistory, setShowHistory, onRestore }: {
  title: string;
  imports: ImportLogEntry[];
  showHistory: boolean;
  setShowHistory: (s: boolean) => void;
  onRestore?: (id: string) => void;
}) {
  return (
    <div style={{ marginTop: 32 }}>
      <button onClick={() => setShowHistory(!showHistory)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8, background: 'white', border: '1px solid #e5e7eb', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#374151' }}>
        {showHistory ? '▾' : '▸'} {title} ({imports.length})
      </button>
      {showHistory && (
        <div style={{ marginTop: 12, background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          {imports.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Aucun import enregistré.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                <th style={th}>Date</th><th style={th}>Utilisateur</th><th style={th}>Fichier</th>
                <th style={th}>Analysés</th><th style={th}>Détails</th><th style={th}>Statut</th>
                {onRestore && <th style={th}>Action</th>}
              </tr></thead>
              <tbody>
                {imports.map(i => (
                  <tr key={i.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={td}>{new Date(i.created_at).toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td style={td}>{i.user_nom ?? '—'}</td>
                    <td style={{ ...td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.filename ?? '—'}</td>
                    <td style={td}>{i.nb_camions_analyses}</td>
                    <td style={{ ...td, fontSize: 11, color: '#6b7280' }}>{i.notes ?? `${i.nb_achats_modifies} achats / ${i.nb_mo_modifies} MO`}</td>
                    <td style={td}>{i.status === 'restored' ? <span style={statusRestored}>↩ Restauré</span> : <span style={statusOk}>✓ Appliqué</span>}</td>
                    {onRestore && <td style={td}>{i.status === 'completed' && <button onClick={() => onRestore(i.id)} style={restoreBtn}>↩ Restaurer</button>}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────

const th: React.CSSProperties = { padding: '8px 10px', textAlign: 'left', fontSize: 11, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' };
const thDark: React.CSSProperties = { padding: '10px 10px', textAlign: 'left', fontSize: 11, color: 'white', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' };
const td: React.CSSProperties = { padding: '7px 10px', verticalAlign: 'middle' };
const tdNum: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: 'monospace' };
const tableContainer: React.CSSProperties = { background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: 16 };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 12 };
const tableHeadSticky: React.CSSProperties = { position: 'sticky', top: 0, background: '#0f172a', color: 'white', zIndex: 1 };
const primaryBtn: React.CSSProperties = { marginTop: 20, padding: '11px 22px', borderRadius: 8, background: '#3b82f6', color: 'white', border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer' };
const secondaryBtn: React.CSSProperties = { padding: '11px 18px', borderRadius: 8, background: 'white', border: '1px solid #e5e7eb', color: '#374151', fontWeight: 700, fontSize: 13, cursor: 'pointer' };
const confirmBtn: React.CSSProperties = { padding: '11px 22px', borderRadius: 8, background: '#16a34a', color: 'white', border: 'none', fontWeight: 700, fontSize: 14 };
const statusRestored: React.CSSProperties = { padding: '2px 8px', borderRadius: 4, background: '#fef3c7', color: '#92400e', fontWeight: 700 };
const statusOk: React.CSSProperties = { padding: '2px 8px', borderRadius: 4, background: '#dcfce7', color: '#166534', fontWeight: 700 };
const restoreBtn: React.CSSProperties = { padding: '4px 10px', borderRadius: 6, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', cursor: 'pointer', fontSize: 11, fontWeight: 700 };

// ════════════════════════════════════════════════════════════════════
// ─── IMPORTER VENTES PIÈCES (export Hightrack CSV par vendeur) ──────
// ════════════════════════════════════════════════════════════════════

// Vendeurs disponibles pour l'import pièces
const VENDEURS_IMPORT = [
  { code: 'avaliquette', nom: 'Alex Valiquette' },
  { code: 'brainville',  nom: 'Bernard Rainville' },
  { code: 'jchamps',     nom: 'Jimmy Champs' },
  { code: 'xgemme',      nom: 'Xavier Gemme' },
  { code: 'pdoiron',     nom: 'Patrick Doiron' },
];

function PiecesImporter() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [vendeurCode, setVendeurCode] = useState('');   // code du vendeur sélectionné
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState('');
  const [parsed, setParsed] = useState<PieceRow[]>([]);
  const [diff, setDiff] = useState<PiecesDiff | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PiecesImportResult | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);

  const vendeurNom = VENDEURS_IMPORT.find(v => v.code === vendeurCode)?.nom ?? '';

  async function handleFile(file: File) {
    if (!vendeurCode) { setError('Veuillez d\'abord choisir le vendeur.'); return; }
    setError(null);
    setLoading(true);
    setFilename(file.name);
    try {
      const text = await file.text();
      const { rows, errors: pErrors, diagnostic } = parsePiecesCSV(text);
      if (rows.length === 0) {
        const msg = pErrors.length > 0 ? pErrors.join(' ') : 'Aucune ligne valide trouvée dans le fichier.';
        setError(msg + (diagnostic ? `\n\n🔍 ${diagnostic}` : ''));
        setLoading(false); return;
      }
      // Écraser le vendeur de chaque ligne avec le vendeur sélectionné
      const rowsTagged = rows.map(r => ({ ...r, vendeur: vendeurCode }));
      setParseErrors(pErrors);
      setParsed(rowsTagged);
      const existants = await loadPiecesExistantes();
      setDiff(calculatePiecesDiff(rowsTagged, existants));
      setStep('preview');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    }
    setLoading(false);
  }

  async function handleConfirm() {
    if (!diff) return;
    setLoading(true);
    const res = await executePiecesImport([...diff.nouveaux, ...diff.doublons], filename);
    setResult(res);
    setStep('done');
    setLoading(false);
  }

  function reset() {
    setStep('upload'); setError(null); setParsed([]); setDiff(null);
    setResult(null); setParseErrors([]); setVendeurCode('');
    if (fileRef.current) fileRef.current.value = '';
  }

  const totalNet = parsed.reduce((s, r) => s + r.sous_total, 0);
  const fmt$ = (n: number) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 2 }).format(n);

  // ── Étape 1 : Choisir vendeur + Upload ──
  if (step === 'upload') return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', padding: 32 }}>
        <h2 style={{ margin: '0 0 4px', color: '#0f172a', fontSize: 20, fontWeight: 700 }}>🔧 Import Ventes Pièces</h2>
        <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: 14 }}>Export Hightrack · Sales Orders (CSV)</p>

        {/* Sélection du vendeur */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>
            1. Ce rapport appartient à quel vendeur ?
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {VENDEURS_IMPORT.map(v => (
              <button
                key={v.code}
                onClick={() => setVendeurCode(v.code)}
                style={{
                  padding: '10px 18px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  background: vendeurCode === v.code ? '#10b981' : '#f8fafc',
                  border: vendeurCode === v.code ? '2px solid #10b981' : '2px solid #e5e7eb',
                  color: vendeurCode === v.code ? 'white' : '#374151',
                  transition: 'all 0.15s',
                }}
              >{v.nom}</button>
            ))}
          </div>
        </div>

        {/* Zone de dépôt du fichier */}
        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>
          2. Téléverser le fichier CSV
        </div>
        <div
          onClick={() => vendeurCode ? fileRef.current?.click() : setError('Choisissez d\'abord le vendeur.')}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          style={{
            border: `2px dashed ${vendeurCode ? '#10b981' : '#d1d5db'}`,
            borderRadius: 12, padding: '36px 24px', textAlign: 'center',
            cursor: vendeurCode ? 'pointer' : 'not-allowed',
            background: vendeurCode ? '#f0fdf4' : '#f9fafb',
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
          <div style={{ color: vendeurCode ? '#065f46' : '#9ca3af', fontWeight: 700, fontSize: 15 }}>
            {vendeurCode
              ? `Cliquer ou glisser le rapport de ${vendeurNom}`
              : 'Choisissez d\'abord le vendeur ci-dessus'}
          </div>
        </div>
        <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

        {loading && <div style={{ marginTop: 16, color: '#10b981', fontWeight: 600 }}>Analyse en cours…</div>}
        {error && (
          <div style={{ marginTop: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px' }}>
            {error.split('\n').map((line, i) => (
              <div key={i} style={{ color: i === 0 ? '#dc2626' : '#6b7280', fontWeight: i === 0 ? 700 : 400, fontSize: i === 0 ? 13 : 11, marginTop: i > 0 ? 6 : 0 }}>{line}</div>
            ))}
            <div style={{ marginTop: 10, fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>
              💡 Si modifié dans Excel : Fichier → Enregistrer sous → CSV UTF-8 (délimité par des virgules)
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ── Étape 2 : Prévisualisation ──
  if (step === 'preview' && diff) return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <span style={{ background: '#10b98120', color: '#10b981', padding: '6px 14px', borderRadius: 8, fontWeight: 700, fontSize: 14 }}>
            {vendeurNom}
          </span>
          <span style={{ color: '#64748b', fontSize: 13 }}>{filename}</span>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            { label: 'Total lignes',  val: String(parsed.length),       color: '#0f172a' },
            { label: 'Nouvelles',     val: String(diff.nouveaux.length), color: '#16a34a' },
            { label: 'Mises à jour',  val: String(diff.doublons.length), color: '#f59e0b' },
            { label: 'Net total',     val: fmt$(totalNet),               color: totalNet >= 0 ? '#16a34a' : '#ef4444' },
          ].map(k => (
            <div key={k.label} style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 18px', border: '1px solid #e5e7eb', minWidth: 110 }}>
              <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{k.label}</div>
              <div style={{ color: k.color, fontSize: 18, fontWeight: 700 }}>{k.val}</div>
            </div>
          ))}
        </div>

        {parseErrors.length > 0 && (
          <div style={{ background: '#fef3c7', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#92400e' }}>
            <strong>{parseErrors.length} avertissement(s) :</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 16 }}>{parseErrors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}</ul>
            {parseErrors.length > 5 && <div>…et {parseErrors.length - 5} autres.</div>}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button style={secondaryBtn} onClick={reset}>← Recommencer</button>
          <button
            style={{ ...confirmBtn, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
            onClick={handleConfirm} disabled={loading}
          >
            {loading ? 'Import en cours…' : `✓ Importer ${diff.nouveaux.length + diff.doublons.length} factures pour ${vendeurNom}`}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Étape 3 : Résultat ──
  if (step === 'done' && result) return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e5e7eb', padding: 32 }}>
        {result.errors.length > 0 ? (
          <>
            <div style={{ fontSize: 36, marginBottom: 8 }}>❌</div>
            <h2 style={{ color: '#ef4444', margin: '0 0 8px' }}>Erreur d'import</h2>
            <ul style={{ color: '#ef4444', fontSize: 13 }}>{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </>
        ) : (
          <>
            <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
            <h2 style={{ color: '#16a34a', margin: '0 0 8px' }}>Import réussi — {vendeurNom}</h2>
            <p style={{ color: '#374151', fontSize: 14 }}>
              <strong>{result.inserted}</strong> factures importées depuis <em>{filename}</em>.
            </p>
          </>
        )}
        <button style={{ ...primaryBtn, marginTop: 16, background: '#10b981' }} onClick={reset}>
          Importer un autre rapport
        </button>
      </div>
    </div>
  );

  return null;
}
