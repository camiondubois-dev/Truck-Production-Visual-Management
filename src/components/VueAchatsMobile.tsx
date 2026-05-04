// ════════════════════════════════════════════════════════════════
// Vue Achats Mobile — liste optimisée téléphone + lancement wizard
// ════════════════════════════════════════════════════════════════
import { useMemo, useState } from 'react';
import { useAchats } from '../contexts/AchatContext';
import type { Achat, StatutAchat } from '../types/achatTypes';
import { LABELS_STATUT, COULEURS_STATUT } from '../types/achatTypes';
import { MobileWizardAchat } from './MobileWizardAchat';
import { FicheAchatMobile } from './FicheAchatMobile';
import type { AchatsSession } from '../hooks/useAchatsAuth';

const COULEUR = '#10b981';
const DRAFT_KEY = 'achats_wizard_draft';

type Filtre = 'mes-actions' | 'tous' | 'a-livrer' | 'archive';

export function VueAchatsMobile({ session, onLogout }: { session: AchatsSession; onLogout: () => void }) {
  const { achats, loading } = useAchats();
  const [filtre, setFiltre] = useState<Filtre>('mes-actions');
  const [recherche, setRecherche] = useState('');
  const [showWizard, setShowWizard] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  const aDraft = !!localStorage.getItem(DRAFT_KEY);

  // Filtrage
  const liste = useMemo(() => {
    let list = [...achats];

    // Mes actions = ce qui requiert action de l'utilisateur selon ses rôles
    if (filtre === 'mes-actions') {
      const roles = session.rolesAchat;
      list = list.filter(a => {
        if (a.statut === 'archivee' || a.statut === 'transferee-inventaire') return false;
        // Acheteur principal → évaluation initiale obligatoire
        if (roles.includes('acheteur-principal') && a.statut === 'evaluation-initiale') return true;
        // Évaluateur final
        if (roles.includes('evaluateur-final') && a.statut === 'evaluation-finale') return true;
        // Approbateur
        if ((roles.includes('approbateur-pieces') || roles.includes('approbateur-vente')) && (a.statut === 'a-approuver' || a.statut === 'contre-offre')) return true;
        // Acheteur (créateur) — étapes après approbation
        if (a.acheteurId === session.profileId && ['approuve-a-offrir','offre-faite'].includes(a.statut)) return true;
        // Paiement admin
        if (roles.includes('paiement-admin') && a.statut === 'achete-a-payer-a-ramasser' && !a.paye) return true;
        // Inventaire admin
        if (roles.includes('inventaire-admin') && a.statut === 'arrive') return true;
        return false;
      });
    } else if (filtre === 'a-livrer') {
      list = list.filter(a => ['acceptee','achete-a-payer-a-ramasser','paye-a-ramasser','en-towing','arrive'].includes(a.statut));
    } else if (filtre === 'archive') {
      list = list.filter(a => a.statut === 'archivee' || a.statut === 'transferee-inventaire' || a.statut === 'annulee');
    } else {
      // tous = actifs (non archivés)
      list = list.filter(a => a.statut !== 'archivee' && a.statut !== 'transferee-inventaire');
    }

    // Recherche
    if (recherche.trim()) {
      const q = recherche.trim().toLowerCase();
      list = list.filter(a =>
        a.marque?.toLowerCase().includes(q) ||
        a.modele?.toLowerCase().includes(q) ||
        a.vin?.toLowerCase().includes(q) ||
        a.vendeurNom.toLowerCase().includes(q) ||
        a.source?.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return list;
  }, [achats, filtre, recherche, session]);

  // Counts
  const counts = useMemo(() => {
    const roles = session.rolesAchat;
    const mesActionsCount = achats.filter(a => {
      if (a.statut === 'archivee' || a.statut === 'transferee-inventaire') return false;
      if (roles.includes('acheteur-principal') && a.statut === 'evaluation-initiale') return true;
      if (roles.includes('evaluateur-final') && a.statut === 'evaluation-finale') return true;
      if ((roles.includes('approbateur-pieces') || roles.includes('approbateur-vente')) && (a.statut === 'a-approuver' || a.statut === 'contre-offre')) return true;
      if (a.acheteurId === session.profileId && ['approuve-a-offrir','offre-faite'].includes(a.statut)) return true;
      if (roles.includes('paiement-admin') && a.statut === 'achete-a-payer-a-ramasser' && !a.paye) return true;
      if (roles.includes('inventaire-admin') && a.statut === 'arrive') return true;
      return false;
    }).length;
    return {
      mesActions: mesActionsCount,
      tous: achats.filter(a => a.statut !== 'archivee' && a.statut !== 'transferee-inventaire').length,
      aLivrer: achats.filter(a => ['acceptee','achete-a-payer-a-ramasser','paye-a-ramasser','en-towing','arrive'].includes(a.statut)).length,
    };
  }, [achats, session]);

  const selected = selectedId ? achats.find(a => a.id === selectedId) ?? null : null;

  return (
    <div style={{
      width: '100vw', height: '100dvh',
      background: '#f8fafc',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Header sticky */}
      <div style={{
        flexShrink: 0,
        background: '#0f172a',
        color: 'white',
        padding: '14px 14px 10px env(safe-area-inset-top, 14px)',
        borderBottom: `2px solid ${COULEUR}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span style={{ fontSize: 24 }}>🛒</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>ACHATS</div>
              <div style={{ fontSize: 11, color: COULEUR, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>👤 {session.nom}</div>
            </div>
          </div>
          <button onClick={() => setShowMenu(true)}
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', width: 38, height: 38, borderRadius: 10, color: 'white', fontSize: 18, cursor: 'pointer' }}>
            ⋯
          </button>
        </div>
        {/* Recherche */}
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>🔍</span>
          <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher marque, modèle, VIN, vendeur..."
            style={{ width: '100%', padding: '10px 12px 10px 38px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', fontSize: 14, background: 'rgba(255,255,255,0.06)', color: 'white', outline: 'none', boxSizing: 'border-box' }} />
        </div>
      </div>

      {/* Filtre tabs */}
      <div style={{ flexShrink: 0, display: 'flex', gap: 6, padding: '10px 14px', background: 'white', borderBottom: '1px solid #e5e7eb', overflowX: 'auto' }}>
        <FilterTab active={filtre === 'mes-actions'} onClick={() => setFiltre('mes-actions')} label="🎯 Mes actions" count={counts.mesActions} priority />
        <FilterTab active={filtre === 'tous'}        onClick={() => setFiltre('tous')}        label="📋 Tous"      count={counts.tous} />
        <FilterTab active={filtre === 'a-livrer'}    onClick={() => setFiltre('a-livrer')}    label="🚛 À livrer"  count={counts.aLivrer} />
        <FilterTab active={filtre === 'archive'}     onClick={() => setFiltre('archive')}     label="📦 Archive"   />
      </div>

      {/* Liste */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px 90px', WebkitOverflowScrolling: 'touch' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontFamily: 'monospace' }}>Chargement...</div>
        ) : liste.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{filtre === 'mes-actions' ? '✅' : '🛒'}</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {filtre === 'mes-actions' ? 'Aucune action requise' :
               filtre === 'a-livrer' ? 'Aucun camion à livrer' :
               filtre === 'archive' ? 'Aucun élément archivé' :
               'Aucune opportunité'}
            </div>
            {achats.length === 0 && (
              <div style={{ fontSize: 13, marginTop: 8 }}>Tape sur le bouton + pour créer ta première opportunité</div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {liste.map(a => (
              <CarteAchatMobile key={a.id} a={a} onClick={() => setSelectedId(a.id)} />
            ))}
          </div>
        )}
      </div>

      {/* FAB Nouvelle opportunité */}
      <button onClick={() => setShowWizard(true)}
        style={{
          position: 'fixed',
          bottom: 'calc(env(safe-area-inset-bottom, 0) + 20px)',
          right: 20, zIndex: 50,
          width: 64, height: 64, borderRadius: '50%',
          background: COULEUR, color: 'white',
          border: 'none', cursor: 'pointer',
          fontSize: 32, fontWeight: 300, lineHeight: 1,
          boxShadow: '0 8px 24px rgba(16,185,129,0.45)',
        }}>
        +
      </button>
      {aDraft && !showWizard && (
        <div onClick={() => setShowWizard(true)}
          style={{
            position: 'fixed',
            bottom: 'calc(env(safe-area-inset-bottom, 0) + 95px)',
            right: 20, zIndex: 50,
            background: '#fef3c7', color: '#92400e',
            padding: '6px 12px', borderRadius: 16,
            fontSize: 12, fontWeight: 700,
            border: '1px solid #fcd34d',
            cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}>
          📝 Brouillon en cours
        </div>
      )}

      {/* Wizard */}
      {showWizard && (
        <MobileWizardAchat
          acheteurId={session.profileId}
          onClose={() => setShowWizard(false)}
          onCree={(id) => { setShowWizard(false); setSelectedId(id); }}
        />
      )}

      {/* Fiche détail */}
      {selected && (
        <FicheAchatMobile key={selected.id} achat={selected} session={session} onClose={() => setSelectedId(null)} />
      )}

      {/* Menu (déconnexion + retour app) */}
      {showMenu && (
        <div onClick={() => setShowMenu(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: '100%', background: 'white', borderRadius: '20px 20px 0 0', padding: '20px 16px env(safe-area-inset-bottom, 20px)' }}>
            <div style={{ width: 40, height: 4, background: '#e5e7eb', borderRadius: 2, margin: '0 auto 16px' }} />

            <div style={{ padding: 14, borderRadius: 10, background: '#f8fafc', marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Connecté</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{session.nom}</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                Rôles : {session.rolesAchat.join(', ') || 'aucun'}
              </div>
            </div>

            <a href="/" onClick={() => setShowMenu(false)}
              style={{ display: 'block', padding: 14, borderRadius: 10, background: '#f8fafc', textDecoration: 'none', color: '#374151', fontWeight: 600, marginBottom: 8 }}>
              🏭 Retour app Production
            </a>

            <button onClick={() => { setShowMenu(false); onLogout(); }}
              style={{ width: '100%', padding: 14, borderRadius: 10, border: '1px solid #fca5a5', background: 'white', color: '#dc2626', fontWeight: 700, cursor: 'pointer', fontSize: 15 }}>
              ← Changer d'utilisateur
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterTab({ active, onClick, label, count, priority }: {
  active: boolean; onClick: () => void; label: string; count?: number; priority?: boolean;
}) {
  return (
    <button onClick={onClick}
      style={{
        flexShrink: 0,
        padding: '8px 14px', borderRadius: 20,
        border: active ? `2px solid ${priority ? '#dc2626' : COULEUR}` : '1px solid #e5e7eb',
        background: active ? (priority ? '#fee2e2' : `${COULEUR}15`) : 'white',
        color: active ? (priority ? '#dc2626' : COULEUR) : '#6b7280',
        fontSize: 13, fontWeight: active ? 700 : 500,
        cursor: 'pointer', whiteSpace: 'nowrap',
      }}>
      {label} {count !== undefined && count > 0 && (
        <span style={{ background: priority ? '#dc2626' : COULEUR, color: 'white', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 800, marginLeft: 4 }}>
          {count}
        </span>
      )}
    </button>
  );
}

function CarteAchatMobile({ a, onClick }: { a: Achat; onClick: () => void }) {
  const titre = [a.annee, a.marque, a.modele].filter(Boolean).join(' ') || 'Sans titre';
  const statutCfg = { color: COULEURS_STATUT[a.statut], label: LABELS_STATUT[a.statut] };

  return (
    <div onClick={onClick}
      style={{
        background: 'white', border: '1px solid #e5e7eb',
        borderLeft: `5px solid ${statutCfg.color}`,
        borderRadius: 12, padding: '14px 14px',
        cursor: 'pointer',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {titre}
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
            {a.vendeurNom} · {a.vendeurType}
          </div>
        </div>
        <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: `${statutCfg.color}20`, color: statutCfg.color, whiteSpace: 'nowrap' }}>
          {statutCfg.label.replace(/[^\w\sÀ-ÿ-]/g, '').trim().split(' ').slice(0, 3).join(' ')}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#6b7280', flexWrap: 'wrap' }}>
        {a.kilometrage != null && <span>📏 {a.kilometrage.toLocaleString()} km</span>}
        {a.vin && <span>🔢 {a.vin.slice(-6)}</span>}
        {a.prixDemandeInitial != null && <span style={{ color: '#0f172a', fontWeight: 700 }}>💰 {a.prixDemandeInitial.toLocaleString()} $</span>}
        {a.prixApprouve != null && a.prixApprouve !== a.prixDemandeInitial && <span style={{ color: COULEUR, fontWeight: 700 }}>✓ {a.prixApprouve.toLocaleString()} $</span>}
        {a.destination && (
          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: a.destination === 'pieces' ? '#fef3c7' : '#dcfce7', color: a.destination === 'pieces' ? '#92400e' : '#166534', fontWeight: 700 }}>
            {a.destination === 'pieces' ? '🔧 PIÈCES' : '🏷️ VENTE'}
          </span>
        )}
        {a.paye && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: '#dcfce7', color: '#166534', fontWeight: 700 }}>💰 PAYÉ</span>}
      </div>
    </div>
  );
}
