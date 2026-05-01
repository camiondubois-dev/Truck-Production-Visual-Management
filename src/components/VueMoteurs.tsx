import { useMemo, useState } from 'react';
import { useMoteurs } from '../contexts/MoteurContext';
import { ENGINE_ETAPES, ENGINE_SLOTS, ENGINE_ZONES, getEngineSlot, getEngineEtape } from '../data/engineStations';
import { etapeEnCoursMoteur, prochaineEtapeMoteur, etapesRestantesMoteur, progressionMoteur } from '../types/engineTypes';
import type { Moteur, ProprietaireMoteur, StatutMoteur } from '../types/engineTypes';
import { WizardMoteur } from './WizardMoteur';
import { PanneauDetailMoteur } from './PanneauDetailMoteur';

type FiltreStatut = 'tous' | StatutMoteur;
type FiltreProprietaire = 'tous' | ProprietaireMoteur;

const STATUT_CONFIG: Record<StatutMoteur, { label: string; color: string; bg: string }> = {
  'en-attente': { label: 'En attente', color: '#92400e', bg: '#fef3c7' },
  'en-cours':   { label: 'En cours',   color: '#1e40af', bg: '#dbeafe' },
  'pret':       { label: 'Prêt',       color: '#166534', bg: '#dcfce7' },
  'archive':    { label: 'Archivé',    color: '#6b7280', bg: '#f3f4f6' },
};

const PROPRIO_LABEL: Record<ProprietaireMoteur, string> = {
  'interne':     'Interne',
  'client':      'Client',
  'exportation': 'Exportation',
  'inventaire':  'Inventaire',
};

export function VueMoteurs({ mobile = false, onClose }: { mobile?: boolean; onClose?: () => void } = {}) {
  const { moteurs, loading } = useMoteurs();
  const [filtreStatut, setFiltreStatut] = useState<FiltreStatut>('tous');
  const [filtreProprietaire, setFiltreProprietaire] = useState<FiltreProprietaire>('tous');
  const [filtreEtapeRequise, setFiltreEtapeRequise] = useState<string>('tous');
  const [filtreSlot, setFiltreSlot] = useState<string>('tous');
  const [recherche, setRecherche] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);

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

  // Filtrage
  const filtres = useMemo(() => {
    let result = [...moteurs];
    if (filtreStatut !== 'tous') result = result.filter(m => m.statut === filtreStatut);
    if (filtreProprietaire !== 'tous') result = result.filter(m => m.proprietaire === filtreProprietaire);
    if (filtreEtapeRequise !== 'tous') {
      result = result.filter(m =>
        m.roadMap.some(e => e.etapeId === filtreEtapeRequise && e.statut !== 'termine' && e.statut !== 'saute')
      );
    }
    if (filtreSlot !== 'tous') result = result.filter(m => m.posteCourant === filtreSlot);

    if (recherche.trim()) {
      const q = recherche.trim().toLowerCase();
      result = result.filter(m =>
        m.stkNumero?.toLowerCase().includes(q) ||
        m.workOrder?.toLowerCase().includes(q) ||
        m.descriptionMoteur?.toLowerCase().includes(q) ||
        m.nomClient?.toLowerCase().includes(q) ||
        m.notes?.toLowerCase().includes(q) ||
        m.etatCommercial?.toLowerCase().includes(q)
      );
    }

    // Tri : prêts en haut (pour livraison), puis en cours, puis en attente, puis archives
    const ordreStatut: Record<StatutMoteur, number> = { 'pret': 0, 'en-cours': 1, 'en-attente': 2, 'archive': 3 };
    result.sort((a, b) => {
      const da = ordreStatut[a.statut] - ordreStatut[b.statut];
      if (da !== 0) return da;
      return a.stkNumero.localeCompare(b.stkNumero);
    });

    return result;
  }, [moteurs, filtreStatut, filtreProprietaire, filtreEtapeRequise, filtreSlot, recherche]);

  const selected = selectedId ? moteurs.find(m => m.id === selectedId) ?? null : null;

  if (loading) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontSize: 14 }}>
        Chargement des moteurs...
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f8fafc' }}>

      {/* ── KPI strip ──────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        background: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: mobile ? '12px 14px' : '14px 24px',
        display: 'flex', alignItems: 'center', gap: mobile ? 8 : 16, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 'auto' }}>
          {mobile && onClose && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: '#6b7280', padding: 4 }}>←</button>
          )}
          <span style={{ fontSize: mobile ? 20 : 24 }}>🛠️</span>
          <div>
            <div style={{ fontSize: mobile ? 16 : 18, fontWeight: 800, color: '#111827' }}>{mobile ? 'Moteurs' : 'Inventaire Moteurs'}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {filtres.length} moteur{filtres.length > 1 ? 's' : ''}
            </div>
          </div>
        </div>

        <KPI value={kpis.enAttente}  label="En attente" color="#f59e0b" />
        <KPI value={kpis.enCours}    label="En cours"   color="#3b82f6" />
        <KPI value={kpis.prets}      label="Prêts"      color="#22c55e" highlight />
        <KPI value={kpis.archives}   label="Archivés"   color="#6b7280" />

        <button onClick={() => setShowWizard(true)}
          style={{
            background: '#7c3aed', color: 'white', border: 'none', borderRadius: 10,
            padding: '10px 18px', fontWeight: 700, fontSize: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
          + Nouveau moteur
        </button>
      </div>

      {/* ── Filtres ───────────────────────────────────── */}
      <div style={{
        flexShrink: 0, background: 'white', borderBottom: '1px solid #e5e7eb',
        padding: '10px 24px', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center',
      }}>
        {/* Recherche */}
        <div style={{ position: 'relative', minWidth: 240, flex: '1 1 240px', maxWidth: 360 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}>🔍</span>
          <input value={recherche} onChange={e => setRecherche(e.target.value)}
            placeholder="STK# / W/O / description / client / notes..."
            style={{
              width: '100%', padding: '8px 12px 8px 36px', borderRadius: 8,
              border: '1px solid #e5e7eb', fontSize: 13, outline: 'none', boxSizing: 'border-box',
              background: '#f8fafc',
            }} />
        </div>

        {/* Statut */}
        <SelectFiltre label="Statut" value={filtreStatut} onChange={v => setFiltreStatut(v as FiltreStatut)}
          options={[
            ['tous', 'Tous statuts'],
            ['en-attente', 'En attente'],
            ['en-cours', 'En cours'],
            ['pret', 'Prêt'],
            ['archive', 'Archivé'],
          ]} />

        {/* Propriétaire */}
        <SelectFiltre label="Propriétaire" value={filtreProprietaire} onChange={v => setFiltreProprietaire(v as FiltreProprietaire)}
          options={[
            ['tous', 'Tous'],
            ['interne', 'Interne'],
            ['client', 'Client'],
            ['exportation', 'Exportation'],
            ['inventaire', 'Inventaire'],
          ]} />

        {/* Étape à faire */}
        <SelectFiltre label="Étape à faire" value={filtreEtapeRequise} onChange={setFiltreEtapeRequise}
          options={[
            ['tous', 'Toutes étapes'],
            ...ENGINE_ETAPES.map(e => [e.id, `${e.icon} ${e.label}`] as [string, string]),
          ]} />

        {/* Emplacement */}
        <SelectFiltre label="Emplacement" value={filtreSlot} onChange={setFiltreSlot}
          options={[
            ['tous', 'Tous'],
            ...ENGINE_SLOTS.map(s => [s.id, s.label] as [string, string]),
          ]} />

        {(filtreStatut !== 'tous' || filtreProprietaire !== 'tous' || filtreEtapeRequise !== 'tous' || filtreSlot !== 'tous' || recherche) && (
          <button onClick={() => { setFiltreStatut('tous'); setFiltreProprietaire('tous'); setFiltreEtapeRequise('tous'); setFiltreSlot('tous'); setRecherche(''); }}
            style={{ background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: '#6b7280', cursor: 'pointer' }}>
            ✕ Effacer filtres
          </button>
        )}
      </div>

      {/* ── Liste ──────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {filtres.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af', fontSize: 14 }}>
            {moteurs.length === 0
              ? 'Aucun moteur dans la base. Cliquez sur « + Nouveau moteur » pour commencer.'
              : 'Aucun moteur ne correspond aux filtres.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 1400, margin: '0 auto' }}>
            {filtres.map(m => (
              <CarteMoteur key={m.id} m={m} mobile={mobile} onClick={() => setSelectedId(m.id)} />
            ))}
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

// ── KPI block ────────────────────────────────────────────────────
function KPI({ value, label, color, highlight }: { value: number; label: string; color: string; highlight?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px',
      borderRadius: 8, background: highlight ? `${color}15` : 'transparent',
      border: highlight ? `1px solid ${color}40` : '1px solid transparent',
    }}>
      <span style={{ fontSize: 24, fontWeight: 900, color, lineHeight: 1, fontFamily: 'system-ui' }}>{value}</span>
      <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>{label}</span>
    </div>
  );
}

// ── Select filtre ────────────────────────────────────────────────
function SelectFiltre({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: [string, string][];
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>{label}:</span>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{
          padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb',
          fontSize: 13, background: 'white', cursor: 'pointer', outline: 'none',
        }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

// ── Carte moteur (ligne) ─────────────────────────────────────────
function CarteMoteur({ m, onClick, mobile }: { m: Moteur; onClick: () => void; mobile?: boolean }) {
  const enCours = etapeEnCoursMoteur(m);
  const prochaine = prochaineEtapeMoteur(m);
  const restantes = etapesRestantesMoteur(m);
  const pct = progressionMoteur(m);
  const slot = m.posteCourant ? getEngineSlot(m.posteCourant) : null;
  const statutCfg = STATUT_CONFIG[m.statut];

  // Étape affichée : en cours > prochaine > rien
  const etapeShown = enCours ?? prochaine;
  const etapeMeta = etapeShown ? getEngineEtape(etapeShown.etapeId) : null;

  return (
    <div onClick={onClick}
      style={{
        background: 'white', border: '1px solid #e5e7eb',
        borderLeft: `5px solid ${statutCfg.color}`,
        borderRadius: 10, padding: mobile ? '10px 12px' : '14px 16px', cursor: 'pointer',
        display: 'grid',
        gridTemplateColumns: mobile ? 'auto 1fr' : 'auto 1fr auto auto auto',
        gap: mobile ? 10 : 16, alignItems: 'center',
        transition: 'all 0.15s',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'; (e.currentTarget as HTMLDivElement).style.transform = 'none'; }}
    >
      {/* Photo / icône */}
      <div style={{
        width: 60, height: 60, borderRadius: 8, flexShrink: 0,
        background: m.photoUrl ? `url(${m.photoUrl}) center/cover` : '#f3f4f6',
        border: '1px solid #e5e7eb',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 28,
      }}>
        {!m.photoUrl && '🛠️'}
      </div>

      {/* Identification + description */}
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: '#111827' }}>
            #{m.stkNumero}
          </span>
          {m.workOrder && (
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#6b7280', background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>
              W/O {m.workOrder}
            </span>
          )}
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: statutCfg.bg, color: statutCfg.color, textTransform: 'uppercase' }}>
            {statutCfg.label}
          </span>
          {m.etatCommercial && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: '#fef3c7', color: '#92400e' }}>
              {m.etatCommercial}
            </span>
          )}
        </div>
        <div style={{ fontSize: 13, color: '#374151', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {m.descriptionMoteur || <em style={{ color: '#9ca3af' }}>Pas de description</em>}
        </div>
        <div style={{ fontSize: 11, color: '#9ca3af', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <span>{PROPRIO_LABEL[m.proprietaire]}{m.nomClient ? ` · ${m.nomClient}` : ''}</span>
          {m.notes && <span title={m.notes} style={{ color: '#dc2626', fontWeight: 600 }}>⚠ {m.notes.slice(0, 60)}{m.notes.length > 60 ? '…' : ''}</span>}
        </div>

        {/* Mobile : résumé étape + progression + emplacement en bas */}
        {mobile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6, paddingTop: 6, borderTop: '1px solid #f1f5f9' }}>
            {etapeShown && etapeMeta && (
              <div style={{ fontSize: 11, fontWeight: 600, color: etapeMeta.color }}>
                {enCours ? '🚛 ' : '⏭ '}{etapeMeta.icon} {etapeMeta.label}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ flex: 1, height: 4, borderRadius: 2, background: '#e5e7eb', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#22c55e' : pct >= 50 ? '#3b82f6' : '#f59e0b' }} />
              </div>
              <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, color: '#374151' }}>{pct}%</span>
            </div>
            {slot && (
              <div style={{ fontSize: 11, color: '#7c3aed', fontWeight: 700 }}>📍 {slot.label}</div>
            )}
          </div>
        )}
      </div>

      {/* Desktop : Étape en cours / prochaine */}
      {!mobile && <div style={{ minWidth: 160, textAlign: 'right' }}>
        {etapeShown && etapeMeta ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {enCours ? '🚛 En cours' : '⏭ Prochaine'}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: etapeMeta.color }}>
              {etapeMeta.icon} {etapeMeta.label}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#22c55e', fontWeight: 700 }}>
            {m.statut === 'pret' ? '✅ Toutes étapes faites' : '—'}
          </div>
        )}
      </div>}

      {/* Desktop : Progression */}
      {!mobile && <div style={{ minWidth: 110, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
        <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Progression
        </div>
        <div style={{ width: 100, height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#22c55e' : pct >= 50 ? '#3b82f6' : '#f59e0b' }} />
        </div>
        <div style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: '#374151' }}>
          {pct}% · {restantes.length} restante{restantes.length > 1 ? 's' : ''}
        </div>
      </div>}

      {/* Desktop : Emplacement */}
      {!mobile && <div style={{ minWidth: 130, textAlign: 'right' }}>
        <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Emplacement
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: slot ? '#7c3aed' : '#9ca3af' }}>
          {slot ? `📍 ${slot.label}` : '—'}
        </div>
        {ENGINE_ZONES.find(z => z.id === slot?.zone) && (
          <div style={{ fontSize: 10, color: '#9ca3af' }}>
            {ENGINE_ZONES.find(z => z.id === slot?.zone)?.label}
          </div>
        )}
      </div>}
    </div>
  );
}
