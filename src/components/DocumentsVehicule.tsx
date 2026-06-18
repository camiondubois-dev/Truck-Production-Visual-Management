import { useState, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useInventaire } from '../contexts/InventaireContext';
import type { DocumentVehicule } from '../types/inventaireTypes';

// Lazy : fabric + pdf-lib + react-pdf hors du bundle principal
const PDFEditor = lazy(() => import('./PDFEditor').then(m => ({ default: m.PDFEditor })));

/**
 * Composant UNIQUE pour les documents d'un camion.
 * Source de vérité unique : prod_inventaire.documents (via le contexte).
 * Au clic → ouvre l'éditeur (modifiable, sauvegarde en base). Jamais en lecture seule.
 *
 * Utilisé partout (suivi vente, livraison, plancher, département, terrain, fiche)
 * pour que « un PDF inséré dans le camion » soit visible et éditable de n'importe où.
 */
export function DocumentsVehicule({ vehiculeId, variant = 'badge', vide }: {
  vehiculeId: string;
  variant?: 'badge' | 'liste';
  vide?: React.ReactNode;   // rendu quand 0 document (badge)
}) {
  const { vehicules, sauverAnnotationsDocument, remplacerFichierDocument } = useInventaire();
  const v = vehicules.find(x => x.id === vehiculeId);
  const docs = v?.documents ?? [];

  const [docAEditer, setDocAEditer] = useState<DocumentVehicule | null>(null);
  const [picker, setPicker] = useState(false);

  const ouvrir = (doc: DocumentVehicule) => { setPicker(false); setDocAEditer(doc); };

  const onBadgeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (docs.length === 0) return;
    if (docs.length === 1) ouvrir(docs[0]);
    else setPicker(true);
  };

  const editeur = docAEditer && v && (
    <Suspense fallback={<div style={{ position: 'fixed', inset: 0, zIndex: 2500, background: '#1f2937', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>⏳ Chargement de l'éditeur…</div>}>
      <PDFEditor
        doc={docAEditer}
        onSave={async (annotations) => {
          await sauverAnnotationsDocument(v.id, docAEditer.id, annotations);
          setDocAEditer(prev => prev ? { ...prev, annotations } : prev);
        }}
        onRemplacerFichier={async (blob) => {
          const { url } = await remplacerFichierDocument(v.id, docAEditer.id, blob);
          setDocAEditer(prev => prev ? { ...prev, url, base64: undefined } : prev);
        }}
        onClose={() => setDocAEditer(null)}
      />
    </Suspense>
  );

  const pickerModal = picker && createPortal(
    <div onClick={() => setPicker(false)} style={{ position: 'fixed', inset: 0, zIndex: 2400, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 12, minWidth: 260, maxWidth: 360, overflow: 'hidden', boxShadow: '0 16px 48px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '12px 16px', fontWeight: 700, fontSize: 14, color: '#111827', borderBottom: '1px solid #f1f5f9' }}>📎 Documents ({docs.length})</div>
        {docs.map(d => (
          <button key={d.id} onClick={() => ouvrir(d)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '11px 16px', background: 'white', border: 'none', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#1e293b' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'white'; }}>
            <span style={{ fontSize: 18 }}>📄</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nom}</span>
          </button>
        ))}
      </div>
    </div>,
    document.body
  );

  // ── Variante LISTE (panneaux/modals) ──
  if (variant === 'liste') {
    return (
      <>
        {docs.length === 0 ? (
          <div style={{ fontSize: 12, color: '#9ca3af' }}>Aucun document.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {docs.map(d => (
              <button key={d.id} onClick={(e) => { e.stopPropagation(); ouvrir(d); }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#f8fafc', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>📄</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nom}</span>
                {d.annotations?.pages && Object.keys(d.annotations.pages).length > 0 && <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 700 }}>✍️</span>}
                <span style={{ fontSize: 11, color: '#3b82f6', fontWeight: 700, flexShrink: 0 }}>✏️ Modifier</span>
              </button>
            ))}
          </div>
        )}
        {editeur}
        {pickerModal}
      </>
    );
  }

  // ── Variante BADGE (cellules/vignettes) ──
  if (docs.length === 0) return <>{vide ?? <span style={{ color: '#cbd5e1' }}>—</span>}</>;

  return (
    <>
      <button onClick={onBadgeClick} title={docs.map(d => d.nom).join(' · ')}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6,
          color: '#b91c1c', fontSize: 'clamp(12px, 1.1vw, 15px)', fontWeight: 700,
          padding: '3px 7px', cursor: 'pointer', lineHeight: 1, whiteSpace: 'nowrap',
        }}>
        📄{docs.length > 1 && <span>{docs.length}</span>}
      </button>
      {editeur}
      {pickerModal}
    </>
  );
}
