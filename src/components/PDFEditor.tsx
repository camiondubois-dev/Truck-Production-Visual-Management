import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Document, Page } from 'react-pdf';
import * as fabric from 'fabric';
import { PDFDocument } from 'pdf-lib';
import '../lib/pdfWorker';   // effet de bord : configure le worker pdf.js
import { SignaturePad } from './SignaturePad';
import type { DocumentVehicule, DocumentAnnotations } from '../types/inventaireTypes';

type Outil = 'select' | 'text' | 'check' | 'date' | 'sign';
type Mode  = 'detecting' | 'form' | 'annot';

// Forme stockée par page (mode annotation) : dimensions d'affichage + objets Fabric.
interface PageData { w: number; h: number; objects: any | null; }

const OUTILS: { id: Outil; label: string; emoji: string }[] = [
  { id: 'select', label: 'Sélection', emoji: '👆' },
  { id: 'text',   label: 'Texte',     emoji: '🔤' },
  { id: 'check',  label: 'Coche',     emoji: '✔️' },
  { id: 'date',   label: 'Date',      emoji: '📅' },
  { id: 'sign',   label: 'Signature', emoji: '🖊️' },
];

export function PDFEditor({ doc, onSave, onRemplacerFichier, onClose }: {
  doc: DocumentVehicule;
  onSave: (annotations: DocumentAnnotations) => Promise<void>;
  onRemplacerFichier?: (blob: Blob) => Promise<void>;
  onClose: () => void;
}) {
  const [numPages, setNumPages]   = useState(0);
  const [pageNum, setPageNum]     = useState(1);      // 1-based
  const [outil, setOutil]         = useState<Outil>('select');
  const [containerW, setContainerW] = useState(800);
  const [zoom, setZoom]           = useState(1);        // 1 = ajusté à la largeur
  const [mode, setMode]           = useState<Mode>('detecting');
  const [saving, setSaving]       = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showSign, setShowSign]   = useState(false);
  const [dirty, setDirty]         = useState(false);
  const [showClosePrompt, setShowClosePrompt] = useState(false);
  const [erreur, setErreur]       = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);

  const displayW = Math.round(containerW * zoom);

  const wrapRef    = useRef<HTMLDivElement>(null);  // mesure largeur dispo
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const fabricRef  = useRef<fabric.Canvas | null>(null);
  const fabricPage = useRef<number | null>(null);  // index 0-based que le canvas détient réellement
  const outilRef   = useRef<Outil>('select');
  const pagesRef   = useRef<Record<number, PageData>>({});  // index 0-based
  const renduDims  = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const pdfProxy   = useRef<any>(null);   // PDFDocumentProxy pdf.js (mode formulaire)

  outilRef.current = outil;
  const pageIdx = pageNum - 1;

  // Source du PDF : URL Supabase (format actuel) OU base64 (ancien format).
  // Épinglée une seule fois : sauvegarder (qui change doc.url) ne recharge pas la vue.
  const [fileSource] = useState<string | null>(() =>
    doc.url
      ? doc.url
      : doc.base64
        ? (doc.base64.startsWith('data:') ? doc.base64 : `data:application/pdf;base64,${doc.base64}`)
        : null
  );

  // ── Mesure de la largeur disponible (responsive tablette/mobile) ──
  useEffect(() => {
    const maj = () => {
      const dispo = wrapRef.current?.clientWidth ?? 800;
      setContainerW(Math.max(280, Math.min(dispo - 4, 1100)));
    };
    maj();
    window.addEventListener('resize', maj);
    return () => window.removeEventListener('resize', maj);
  }, []);

  // Verrou de défilement de l'arrière-plan pendant l'édition (évite le rebond
  // iOS qui peut donner l'impression que l'éditeur se ferme).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // ── Détection du type de PDF au chargement (a-t-il de vrais champs ?) ──
  const onDocLoad = async (pdf: any) => {
    pdfProxy.current = pdf;
    setNumPages(pdf.numPages);
    setChargement(false);
    try {
      const champs = await pdf.getFieldObjects();
      const aDesChamps = !!champs && Object.keys(champs).length > 0;
      setMode(aDesChamps && !!onRemplacerFichier ? 'form' : 'annot');
    } catch {
      setMode('annot');
    }
  };

  // ════════════════ MODE ANNOTATION (Fabric) ════════════════

  const flushPage = useCallback(() => {
    const f = fabricRef.current;
    if (!f || fabricPage.current == null) return;
    pagesRef.current[fabricPage.current] = { w: f.getWidth(), h: f.getHeight(), objects: f.toJSON() };
  }, []);

  const ajouterTextbox = (texte: string, x: number, y: number, couleur = '#111827', taille = 16) => {
    const f = fabricRef.current;
    if (!f) return;
    const tb = new fabric.Textbox(texte, {
      left: x, top: y, fontSize: taille, fill: couleur,
      fontFamily: 'Helvetica, Arial, sans-serif', editable: true,
      width: Math.min(220, renduDims.current.w * 0.6),
    });
    f.add(tb);
    f.setActiveObject(tb);
    if (texte === 'Texte') { tb.enterEditing(); tb.selectAll(); }
    f.requestRenderAll();
    setDirty(true);
  };

  const ajouterSignature = async (dataUrl: string) => {
    const f = fabricRef.current;
    if (!f) return;
    const img = await fabric.Image.fromURL(dataUrl);
    const cible = Math.min(200, renduDims.current.w * 0.4);
    const scale = cible / (img.width ?? cible);
    img.set({ left: renduDims.current.w * 0.3, top: renduDims.current.h * 0.4, scaleX: scale, scaleY: scale });
    f.add(img);
    f.setActiveObject(img);
    f.requestRenderAll();
    setDirty(true);
    setOutil('select');
  };

  const onPageRendu = useCallback(() => {
    const holder = wrapRef.current?.querySelector('canvas.react-pdf__Page__canvas') as HTMLCanvasElement | null;
    if (!holder || !overlayRef.current) return;
    const w = holder.clientWidth;
    const h = holder.clientHeight;
    renduDims.current = { w, h };

    if (fabricRef.current) { flushPage(); fabricRef.current.dispose(); fabricRef.current = null; }
    const f = new fabric.Canvas(overlayRef.current, {
      width: w, height: h, backgroundColor: 'transparent',
      selection: true, preserveObjectStacking: true, allowTouchScrolling: true,
    });
    fabricRef.current = f;
    fabricPage.current = pageIdx;

    f.on('mouse:down', (opt) => {
      const t = outilRef.current;
      if (t === 'select' || opt.target) return;
      const p = f.getScenePoint(opt.e);
      if (t === 'text')  ajouterTextbox('Texte', p.x, p.y);
      if (t === 'check') ajouterTextbox('✔', p.x, p.y, '#16a34a', 26);
      if (t === 'date')  ajouterTextbox(new Date().toLocaleDateString('fr-CA'), p.x, p.y);
      if (t === 'text' || t === 'check' || t === 'date') setOutil('select');
    });
    f.on('object:modified', () => setDirty(true));

    const data = pagesRef.current[pageIdx];
    if (data?.objects) {
      f.loadFromJSON(data.objects).then(() => {
        if (data.w && Math.abs(data.w - w) > 1) {
          const fac = w / data.w;
          f.getObjects().forEach((o: any) => {
            o.left *= fac; o.top *= fac; o.scaleX *= fac; o.scaleY *= fac;
            if (o.fontSize) o.fontSize *= fac;
            if (o.type === 'textbox' && o.width) o.width *= fac;
            o.setCoords();
          });
        }
        f.requestRenderAll();
      });
    }
  }, [pageIdx]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const f = fabricRef.current;
      if (!f) return;
      const actif = f.getActiveObject();
      if ((e.key === 'Delete' || e.key === 'Backspace') && actif && !(actif as any).isEditing) {
        f.remove(actif); f.requestRenderAll(); setDirty(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => () => { fabricRef.current?.dispose(); }, []);

  useEffect(() => {
    const pages = doc.annotations?.pages;
    if (pages) {
      const init: Record<number, PageData> = {};
      for (const [k, v] of Object.entries(pages)) {
        const pd = v as any;
        init[Number(k)] = pd?.objects !== undefined ? pd : { w: 0, h: 0, objects: pd };
      }
      pagesRef.current = init;
    }
  }, [doc.annotations]);

  const changerPage = (delta: number) => {
    if (mode === 'annot') flushPage();
    setPageNum(p => Math.min(numPages, Math.max(1, p + delta)));
  };

  const supprimerActif = () => {
    const f = fabricRef.current;
    const actif = f?.getActiveObject();
    if (f && actif) { f.remove(actif); f.requestRenderAll(); setDirty(true); }
  };

  // Sauvegarde mode annotation : couche JSON (PDF reste « vivant »)
  const sauverAnnotations = async (): Promise<boolean> => {
    flushPage();
    setSaving(true); setErreur(null);
    try {
      const pages: Record<number, unknown> = {};
      for (const [k, v] of Object.entries(pagesRef.current)) {
        if (v.objects && v.objects.objects && v.objects.objects.length > 0) pages[Number(k)] = v;
      }
      await onSave({ version: 1, pages, updatedAt: new Date().toISOString() });
      setDirty(false);
      return true;
    } catch (e: any) {
      setErreur(e?.message ?? 'Erreur lors de la sauvegarde.');
      return false;
    } finally { setSaving(false); }
  };

  // ════════════════ MODE FORMULAIRE (vrais champs AcroForm) ════════════════

  // saveDocument() de pdf.js bake les valeurs saisies DANS le vrai PDF.
  const genererPdfRempli = async (): Promise<Blob> => {
    const bytes = await pdfProxy.current.saveDocument();
    return new Blob([bytes], { type: 'application/pdf' });
  };

  const sauverFormulaire = async (): Promise<boolean> => {
    if (!pdfProxy.current || !onRemplacerFichier) return false;
    setSaving(true); setErreur(null);
    try {
      const blob = await genererPdfRempli();
      await onRemplacerFichier(blob);
      setDirty(false);
      return true;
    } catch (e: any) {
      setErreur(e?.message ?? 'Erreur lors de la sauvegarde.');
      return false;
    } finally { setSaving(false); }
  };

  // ── Sauvegarde / Export selon le mode ──
  const sauvegarder = (): Promise<boolean> => (mode === 'form' ? sauverFormulaire() : sauverAnnotations());

  const exporter = async () => {
    setExporting(true); setErreur(null);
    try {
      let blob: Blob;
      if (mode === 'form') {
        blob = await genererPdfRempli();
      } else {
        flushPage();
        if (!fileSource) throw new Error('Document sans fichier source.');
        const bytes = await fetch(fileSource).then(r => r.arrayBuffer());
        const pdfDoc = await PDFDocument.load(bytes);
        const pages = pdfDoc.getPages();
        for (const [k, v] of Object.entries(pagesRef.current)) {
          const idx = Number(k);
          if (!v.objects || !v.objects.objects || v.objects.objects.length === 0) continue;
          if (idx >= pages.length) continue;
          const off = new fabric.StaticCanvas(undefined, { width: v.w || 800, height: v.h || 1000 });
          await off.loadFromJSON(v.objects);
          off.renderAll();
          const dataUrl = off.toDataURL({ format: 'png', multiplier: 2 });
          off.dispose();
          const png = await pdfDoc.embedPng(dataUrl);
          const page = pages[idx];
          page.drawImage(png, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
        }
        const out = await pdfDoc.save();
        blob = new Blob([out], { type: 'application/pdf' });
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.nom.replace(/\.pdf$/i, '') + '_rempli.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setErreur(e?.message ?? "Erreur lors de l'export.");
    } finally { setExporting(false); }
  };

  // Fermeture : si des modifications non sauvegardées → demander d'enregistrer.
  const fermer = () => {
    if (dirty) { setShowClosePrompt(true); return; }
    onClose();
  };
  const enregistrerEtFermer = async () => {
    const ok = await sauvegarder();
    if (ok) { setShowClosePrompt(false); onClose(); }
  };

  // ─────────────────────────────────────────────────────────────
  // Portail vers <body> : l'éditeur s'affiche TOUJOURS en plein écran, même
  // ouvert depuis une carte/un panneau ayant un transform (sinon piégé dedans).
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, height: '100dvh', zIndex: 2500, background: '#1f2937', display: 'flex', flexDirection: 'column', overscrollBehavior: 'contain' }}>
      {/* Barre supérieure — paddingTop = sous l'encoche/barre d'état iPhone (safe-area) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', paddingTop: 'calc(10px + env(safe-area-inset-top))', background: '#111827', borderBottom: '1px solid #374151', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <button onClick={fermer} style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: '#374151', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>✕ Fermer</button>
          <div style={{ color: 'white', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.nom}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={exporter} disabled={exporting || mode === 'detecting'} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #4b5563', background: 'transparent', color: 'white', fontSize: 13, fontWeight: 600, cursor: exporting ? 'wait' : 'pointer' }}>
            {exporting ? '⏳…' : '⬇️ Exporter PDF'}
          </button>
          <button onClick={sauvegarder} disabled={saving || mode === 'detecting'} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: dirty ? '#22c55e' : '#16a34a', color: 'white', fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>
            {saving ? '⏳…' : dirty ? '💾 Sauvegarder' : '✓ Sauvegardé'}
          </button>
        </div>
      </div>

      {/* Barre de zoom — fiable sur mobile (boutons + / −) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '6px 14px', background: '#111827', borderBottom: '1px solid #374151' }}>
        <button onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))} disabled={zoom <= 0.5}
          style={{ width: 42, height: 38, borderRadius: 8, border: 'none', background: '#374151', color: 'white', fontSize: 22, fontWeight: 700, cursor: 'pointer' }}>−</button>
        <button onClick={() => setZoom(1)}
          style={{ minWidth: 64, height: 38, borderRadius: 8, border: 'none', background: '#374151', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          {Math.round(zoom * 100)}%
        </button>
        <button onClick={() => setZoom(z => Math.min(3, +(z + 0.25).toFixed(2)))} disabled={zoom >= 3}
          style={{ width: 42, height: 38, borderRadius: 8, border: 'none', background: '#374151', color: 'white', fontSize: 22, fontWeight: 700, cursor: 'pointer' }}>+</button>
      </div>

      {/* Barre d'outils — selon le mode */}
      {mode === 'annot' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#1f2937', borderBottom: '1px solid #374151', flexWrap: 'wrap' }}>
          {OUTILS.map(o => (
            <button key={o.id}
              onClick={() => { if (o.id === 'sign') { setShowSign(true); } else { setOutil(o.id); } }}
              style={{
                padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: outil === o.id ? '2px solid #3b82f6' : '1px solid #4b5563',
                background: outil === o.id ? '#1e3a8a' : '#374151', color: 'white',
              }}>
              {o.emoji} {o.label}
            </button>
          ))}
          <div style={{ width: 1, height: 24, background: '#4b5563', margin: '0 4px' }} />
          <button onClick={supprimerActif} style={{ padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid #7f1d1d', background: '#374151', color: '#fca5a5' }}>
            🗑 Supprimer
          </button>
        </div>
      )}
      {mode === 'form' && (
        <div style={{ padding: '8px 14px', background: '#1f2937', borderBottom: '1px solid #374151', fontSize: 12, color: '#93c5fd' }}>
          ✏️ Formulaire détecté — remplis les champs et coche les cases directement dans le PDF, puis <strong>Sauvegarder</strong>.
        </div>
      )}

      {erreur && (
        <div style={{ padding: '8px 14px', background: '#7f1d1d', color: '#fecaca', fontSize: 12 }}>⚠️ {erreur}</div>
      )}

      {/* Zone PDF */}
      <div
        ref={wrapRef}
        onInput={() => { if (mode === 'form') setDirty(true); }}
        onChangeCapture={() => { if (mode === 'form') setDirty(true); }}
        style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', padding: 16, overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
      >
        {!fileSource ? (
          <div style={{ color: '#fecaca', maxWidth: 460, textAlign: 'center', padding: 40, alignSelf: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Ce document n'a pas de fichier lisible</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
              Il a probablement été ajouté avant la mise à jour du stockage des PDF.
              Supprime-le et ré-importe-le pour pouvoir le remplir.
            </div>
          </div>
        ) : (
          <div style={{ position: 'relative', width: displayW, height: 'fit-content' }}>
            <Document
              file={fileSource}
              onLoadSuccess={onDocLoad}
              onLoadError={(e) => { setErreur('Impossible de charger le PDF : ' + e.message); setChargement(false); }}
              loading={<div style={{ color: 'white', padding: 40 }}>⏳ Chargement du PDF…</div>}
            >
              {mode !== 'detecting' && (
                <Page
                  key={pageNum}
                  pageNumber={pageNum}
                  width={displayW}
                  renderTextLayer={false}
                  renderAnnotationLayer={mode === 'form'}
                  renderForms={mode === 'form'}
                  onRenderSuccess={mode === 'annot' ? onPageRendu : undefined}
                />
              )}
            </Document>
            {/* Canvas d'annotation (uniquement mode annotation) */}
            {mode === 'annot' && (
              <div style={{ position: 'absolute', top: 0, left: 0 }}>
                <canvas ref={overlayRef} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation pages */}
      {numPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '10px', paddingBottom: 'calc(10px + env(safe-area-inset-bottom))', background: '#111827', borderTop: '1px solid #374151' }}>
          <button onClick={() => changerPage(-1)} disabled={pageNum <= 1} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: pageNum <= 1 ? '#374151' : '#3b82f6', color: 'white', fontSize: 14, fontWeight: 600, cursor: pageNum <= 1 ? 'default' : 'pointer' }}>← Préc.</button>
          <span style={{ color: 'white', fontSize: 14, fontWeight: 600 }}>Page {pageNum} / {numPages}</span>
          <button onClick={() => changerPage(1)} disabled={pageNum >= numPages} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: pageNum >= numPages ? '#374151' : '#3b82f6', color: 'white', fontSize: 14, fontWeight: 600, cursor: pageNum >= numPages ? 'default' : 'pointer' }}>Suiv. →</button>
        </div>
      )}

      {showSign && (
        <SignaturePad
          onConfirm={(d) => { setShowSign(false); ajouterSignature(d); }}
          onCancel={() => setShowSign(false)}
        />
      )}

      {chargement && !erreur && fileSource && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', pointerEvents: 'none' }}>⏳ Chargement…</div>
      )}

      {/* Dialogue : enregistrer avant de fermer ? */}
      {showClosePrompt && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 22, width: 'min(420px, 96vw)', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#111827', marginBottom: 6 }}>💾 Enregistrer les modifications ?</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 18, lineHeight: 1.5 }}>
              Tu as des modifications non sauvegardées sur ce document.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={enregistrerEtFermer} disabled={saving}
                style={{ padding: '13px', borderRadius: 10, border: 'none', background: '#22c55e', color: 'white', fontSize: 15, fontWeight: 800, cursor: saving ? 'wait' : 'pointer' }}>
                {saving ? '⏳ Enregistrement…' : '✓ Enregistrer et fermer'}
              </button>
              <button onClick={() => { setShowClosePrompt(false); onClose(); }} disabled={saving}
                style={{ padding: '13px', borderRadius: 10, border: '1px solid #fca5a5', background: 'white', color: '#dc2626', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                Fermer sans enregistrer
              </button>
              <button onClick={() => setShowClosePrompt(false)} disabled={saving}
                style={{ padding: '12px', borderRadius: 10, border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
