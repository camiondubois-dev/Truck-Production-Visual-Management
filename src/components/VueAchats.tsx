import { useMemo, useState } from 'react';
import { useAchats } from '../contexts/AchatContext';
import type { Achat, StatutAchat, DestinationAchat, TypeVendeur } from '../types/achatTypes';
import { LABELS_STATUT, COULEURS_STATUT } from '../types/achatTypes';
import { WizardAchat } from './WizardAchat';
import { FicheAchat } from './FicheAchat';

const COULEUR_ACHAT = '#10b981';

type FiltreStatut = 'tous' | 'actifs' | StatutAchat;
type FiltreDest   = 'tous' | DestinationAchat | 'non-defini';

export function VueAchats() {
  const { achats, loading } = useAchats();
  const [filtreStatut, setFiltreStatut] = useState<FiltreStatut>('actifs');
  const [filtreDest, setFiltreDest] = useState<FiltreDest>('tous');
  const [filtreVendeurType, setFiltreVendeurType] = useState<'tous' | TypeVendeur>('tous');
  const [recherche, setRecherche] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  // KPIs
  const kpis = useMemo(() => {
    const a = achats.filter(x => x.statut !== 'archivee' && x.statut !== 'annulee');
    return {
      total: achats.length,
      actifs: a.length,
      evaluation: a.filter(x => x.statut === 'evaluation-initiale' || x.statut === 'evaluation-finale').length,
      aApprouver: a.filter(x => x.statut === 'a-approuver').length,
      aOffrir: a.filter(x => x.statut === 'approuve-a-offrir' || x.statut === 'offre-faite' || x.statut === 'contre-offre').length,
      achetes: a.filter(x => ['achete-a-payer-a-ramasser','paye-a-ramasser','en-towing','arrive'].includes(x.statut)).length,
      transferes: achats.filter(x => x.statut === 'transferee-inventaire').length,
    };
  }, [achats]);

  // Filtres
  const filtres = useMemo(() => {
    let list = [...achats];
    if (filtreStatut === 'actifs') {
      list = list.filter(x => x.statut !== 'archivee' && x.statut !== 'annulee' && x.statut !== 'transferee-inventaire');
    } else if (filtreStatut !== 'tous') {
      list = list.filter(x => x.statut === filtreStatut);
    }
    if (filtreDest !== 'tous') {
      if (filtreDest === 'non-defini') list = list.filter(x => !x.destination);
      else list = list.filter(x => x.destination === filtreDest);
    }
    if (filtreVendeurType !== 'tous') list = list.filter(x => x.vendeurType === filtreVendeurType);
    if (recherche.trim()) {
      const q = recherche.trim().toLowerCase();
      list = list.filter(x =>
        x.marque?.toLowerCase().includes(q) ||
        x.modele?.toLowerCase().includes(q) ||
        x.vin?.toLowerCase().includes(q) ||
        x.vendeurNom.toLowerCase().includes(q) ||
        x.source?.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return list;
  }, [achats, filtreStatut, filtreDest, filtreVendeurType, recherche]);

  const selected = selectedId ? achats.find(a => a.id === selectedId) ?? null : null;

  if (loading) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontFamily: 'monospace', fontSize: 14 }}>
        Chargement des achats...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: '#f8fafc' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── Header ──────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 24px', borderBottom: '2px solid #e5e7eb', background: 'white',
          flexShrink: 0, gap: 12, flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 26 }}>🛒</span>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: COULEUR_ACHAT, margin: 0 }}>Achats</h1>
            </div>
            <KPI value={kpis.actifs}      label="Actifs"        color="#3b82f6" />
            <KPI value={kpis.evaluation}  label="En évaluation" color="#f59e0b" />
            <KPI value={kpis.aApprouver}  label="À approuver"   color="#8b5cf6" />
            <KPI value={kpis.aOffrir}     label="À offrir"      color="#0ea5e9" />
            <KPI value={kpis.achetes}     label="Achetés"       color="#10b981" highlight />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="text" placeholder="Rechercher marque/modèle/VIN/vendeur..."
              value={recherche} onChange={e => setRecherche(e.target.value)}
              style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #e5e7eb', fontSize: 13, width: 240, outline: 'none' }} />
            <button onClick={() => setShowWizard(true)}
              style={{ background: COULEUR_ACHAT, color: 'white', border: 'none', borderRadius: 8, padding: '8px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              + Nouvelle opportunité
            </button>
          </div>
        </div>

        {/* ── Filtres ─────────────────────────────────────── */}
        <div style={{
          display: 'flex', gap: 12, padding: '10px 20px', borderBottom: '1px solid #e5e7eb',
          background: 'white', flexWrap: 'wrap', flexShrink: 0, alignItems: 'center',
        }}>
          <SelectFiltre label="Statut" value={filtreStatut} onChange={v => setFiltreStatut(v as FiltreStatut)}
            options={[
              ['actifs', 'Actifs (non archivés)'],
              ['tous', 'Tous'],
              ['evaluation-initiale', 'Évaluation initiale'],
              ['evaluation-finale', 'Évaluation finale'],
              ['a-approuver', 'À approuver'],
              ['approuve-a-offrir', 'Approuvé — à offrir'],
              ['offre-faite', 'Offre faite'],
              ['contre-offre', 'Contre-offre'],
              ['acceptee', 'Acceptée'],
              ['refusee', 'Refusée'],
              ['achete-a-payer-a-ramasser', 'Acheté à payer/ramasser'],
              ['paye-a-ramasser', 'Payé à ramasser'],
              ['en-towing', 'En towing'],
              ['arrive', 'Arrivé'],
              ['transferee-inventaire', 'Transféré inventaire'],
              ['annulee', 'Annulée'],
              ['archivee', 'Archivée'],
            ]} />
          <SelectFiltre label="Destination" value={filtreDest} onChange={v => setFiltreDest(v as FiltreDest)}
            options={[
              ['tous', 'Toutes'],
              ['non-defini', 'Non définie'],
              ['pieces', '🔧 Pièces'],
              ['vente-detail', '🏷️ Vente détails'],
            ]} />
          <SelectFiltre label="Type vendeur" value={filtreVendeurType} onChange={v => setFiltreVendeurType(v as 'tous' | TypeVendeur)}
            options={[
              ['tous', 'Tous'],
              ['particulier', 'Particulier'],
              ['concessionnaire', 'Concessionnaire'],
              ['encan', 'Encan'],
              ['flotte', 'Flotte'],
              ['autre', 'Autre'],
            ]} />
          {(filtreStatut !== 'actifs' || filtreDest !== 'tous' || filtreVendeurType !== 'tous' || recherche) && (
            <button onClick={() => { setFiltreStatut('actifs'); setFiltreDest('tous'); setFiltreVendeurType('tous'); setRecherche(''); }}
              style={{ padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: '1px solid #fca5a5', background: 'white', color: '#dc2626', cursor: 'pointer' }}>
              ✕ Effacer
            </button>
          )}
        </div>

        {/* ── Liste ────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {filtres.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🛒</div>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                {achats.length === 0 ? 'Aucune opportunité d\'achat pour l\'instant' : 'Aucun résultat'}
              </div>
              <div style={{ fontSize: 14 }}>
                {achats.length === 0 && 'Clique sur « + Nouvelle opportunité » pour commencer'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 1400, margin: '0 auto' }}>
              {filtres.map(a => (
                <CarteAchat key={a.id} a={a} onClick={() => setSelectedId(a.id)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {showWizard && <WizardAchat onClose={() => setShowWizard(false)} onCree={(id) => { setShowWizard(false); setSelectedId(id); }} />}
      {selected && <FicheAchat key={selected.id} achat={selected} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

// ── KPI ─────────────────────────────────────────────────────
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

function SelectFiltre({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: [string, string][];
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>{label}:</span>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, background: 'white', cursor: 'pointer', outline: 'none' }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

// ── Carte achat ─────────────────────────────────────────────
function CarteAchat({ a, onClick }: { a: Achat; onClick: () => void }) {
  const titre = [a.annee, a.marque, a.modele].filter(Boolean).join(' ') || 'Sans titre';
  const statutCfg = { color: COULEURS_STATUT[a.statut], label: LABELS_STATUT[a.statut] };

  return (
    <div onClick={onClick}
      style={{
        background: 'white', border: '1px solid #e5e7eb',
        borderLeft: `5px solid ${statutCfg.color}`,
        borderRadius: 10, padding: '14px 16px', cursor: 'pointer',
        display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 16, alignItems: 'center',
        transition: 'all 0.15s', boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'; }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{titre}</span>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: `${statutCfg.color}20`, color: statutCfg.color }}>
            {statutCfg.label}
          </span>
          {a.destination === 'pieces' && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#fef3c7', color: '#92400e' }}>
              🔧 PIÈCES
            </span>
          )}
          {a.destination === 'vente-detail' && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: '#dcfce7', color: '#166534' }}>
              🏷️ VENTE DÉTAIL
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>
          Vendeur : <strong>{a.vendeurNom}</strong> · {a.vendeurType}
          {a.vin && <> · VIN : {a.vin}</>}
          {a.kilometrage && <> · {a.kilometrage.toLocaleString()} km</>}
        </div>
      </div>

      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Prix demandé</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
          {a.prixDemandeInitial != null ? `${a.prixDemandeInitial.toLocaleString()} $` : '—'}
        </div>
      </div>

      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Prix approuvé</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: a.prixApprouve ? '#10b981' : '#9ca3af' }}>
          {a.prixApprouve != null ? `${a.prixApprouve.toLocaleString()} $` : '—'}
        </div>
      </div>

      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Créé</div>
        <div style={{ fontSize: 12, color: '#374151' }}>
          {new Date(a.createdAt).toLocaleDateString('fr-CA', { day: '2-digit', month: 'short', year: 'numeric' })}
        </div>
      </div>
    </div>
  );
}
