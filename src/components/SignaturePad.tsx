import { useRef, useEffect, useState } from 'react';

/**
 * Pavé de signature — dessin au doigt (tactile) ou à la souris.
 * Retourne un PNG transparent (dataURL) via onConfirm.
 */
export function SignaturePad({ onConfirm, onCancel }: {
  onConfirm: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dessine   = useRef(false);
  const [vide, setVide] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Résolution interne 2x pour une signature nette
    const ratio = 2;
    canvas.width  = canvas.clientWidth  * ratio;
    canvas.height = canvas.clientHeight * ratio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.strokeStyle = '#111827';
  }, []);

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    dessine.current = true;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e: React.PointerEvent) => {
    if (!dessine.current) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setVide(false);
  };
  const end = () => { dessine.current = false; };

  const effacer = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setVide(true);
  };

  const confirmer = () => {
    if (vide) return;
    onConfirm(canvasRef.current!.toDataURL('image/png'));
  };

  return (
    <div onClick={e => e.stopPropagation()} style={{
      position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 20, width: 'min(520px, 96vw)', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 4 }}>🖊️ Signature</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>Signez avec le doigt ou la souris</div>
        <canvas
          ref={canvasRef}
          onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end}
          style={{ width: '100%', height: 200, border: '2px dashed #d1d5db', borderRadius: 10, touchAction: 'none', background: '#fafafa', cursor: 'crosshair', display: 'block' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, gap: 8 }}>
          <button onClick={effacer} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Effacer
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onCancel} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontSize: 13, cursor: 'pointer' }}>
              Annuler
            </button>
            <button onClick={confirmer} disabled={vide} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: vide ? '#e5e7eb' : '#3b82f6', color: vide ? '#9ca3af' : 'white', fontSize: 13, fontWeight: 700, cursor: vide ? 'not-allowed' : 'pointer' }}>
              ✓ Ajouter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
