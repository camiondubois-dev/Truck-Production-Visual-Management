import { useState, useRef, useEffect } from 'react';
import type { FinancialData } from '../hooks/useFinancialData';

// ─── Helpers ──────────────────────────────────────────────────────

function fmt(n: number | null, opts: { short?: boolean } = {}): string {
  if (n === null || n === undefined) return '—';
  if (opts.short) {
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1_000)}K`;
    return `$${Math.round(n).toLocaleString('fr-CA')}`;
  }
  return `$${Math.round(n).toLocaleString('fr-CA')}`;
}

function profitColor(profit: number): string {
  if (profit > 0) return '#22c55e';
  if (profit < 0) return '#ef4444';
  return '#9ca3af';
}

// ─── Compact bandeau (single line — VueAsana / VueLivraisons) ────

interface CompactBandeauProps {
  data: FinancialData;
  dark?: boolean; // true = dark bg (VueLivraisons), false = white bg (VueAsana)
}

export function CompactBandeau({ data, dark = false }: CompactBandeauProps) {
  const { prix_achat_reel, cout_mo, prix_demande } = data;
  const total = (prix_achat_reel ?? 0) + (cout_mo ?? 0);
  const profit = prix_demande !== null ? prix_demande - total : null;
  const pct = profit !== null && total > 0 ? (profit / prix_demande!) * 100 : null;

  const bg = dark ? 'rgba(0,0,0,0.35)' : 'rgba(245,158,11,0.06)';
  const border = dark ? 'rgba(245,158,11,0.25)' : 'rgba(245,158,11,0.2)';
  const labelColor = dark ? 'rgba(255,255,255,0.45)' : '#9ca3af';
  const valueColor = dark ? 'rgba(255,255,255,0.9)' : '#1e293b';

  return (
    <div style={{
      display: 'flex', gap: 0,
      background: bg,
      borderTop: `1px solid ${border}`,
      fontSize: 11,
      flexShrink: 0,
    }}>
      <Bloc label="Achat" value={fmt(prix_achat_reel, { short: true })} labelColor={labelColor} valueColor={valueColor} border={border} />
      <Bloc label="M.O." value={fmt(cout_mo, { short: true })} labelColor={labelColor} valueColor={valueColor} border={border} />
      <Bloc label="Total" value={fmt(total, { short: true })} labelColor={labelColor} valueColor={valueColor} border={border} bold />
      {prix_demande !== null && (
        <>
          <Bloc label="Demandé" value={fmt(prix_demande, { short: true })} labelColor={labelColor} valueColor={valueColor} border={border} />
          <Bloc
            label="Profit"
            value={profit !== null ? `${profit >= 0 ? '+' : ''}${fmt(profit, { short: true })}${pct !== null ? ` (${Math.round(pct)}%)` : ''}` : '—'}
            labelColor={labelColor}
            valueColor={profit !== null ? profitColor(profit) : valueColor}
            border={border}
          />
        </>
      )}
    </div>
  );
}

function Bloc({ label, value, labelColor, valueColor, border, bold }: {
  label: string; value: string; labelColor: string; valueColor: string; border: string; bold?: boolean;
}) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '4px 4px 5px',
      borderRight: `1px solid ${border}`,
    }}>
      <span style={{ fontSize: 9, color: labelColor, textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.3 }}>
        {label}
      </span>
      <span style={{ fontSize: 11, fontWeight: bold ? 800 : 600, color: valueColor, lineHeight: 1.3, whiteSpace: 'nowrap' }}>
        {value}
      </span>
    </div>
  );
}


// ─── Full bandeau (SuiviVente / Inventaire) ───────────────────────
// Layout 2 lignes :
// Ligne 1 : Achat | M.O. | Total investi
// Ligne 2 : Prix demandé (editable) | Profit projeté

interface FullBandeauProps {
  data: FinancialData;
  onSavePrixDemande?: (stockNumero: string, prix: number | null) => Promise<void>;
  onLocalPrixDemande?: (stockNumero: string, prix: number | null) => void;
  dark?: boolean;
}

export function FullBandeau({ data, onSavePrixDemande, onLocalPrixDemande, dark = false }: FullBandeauProps) {
  const { stock_numero, prix_achat_reel, cout_mo, prix_demande } = data;
  // prix_achat_reel = prix payé pour le camion (achat)
  // total investi = achat + M.O.
  const total = (prix_achat_reel ?? 0) + (cout_mo ?? 0);
  const profit = prix_demande !== null ? prix_demande - total : null;
  const pct = profit !== null && total > 0 ? (profit / total) * 100 : null;

  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(prix_demande !== null ? String(Math.round(prix_demande)) : '');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync if external data changes
  useEffect(() => {
    if (!editing) {
      setInputVal(prix_demande !== null ? String(Math.round(prix_demande)) : '');
    }
  }, [prix_demande, editing]);

  const handleEdit = () => {
    setEditing(true);
    setTimeout(() => { inputRef.current?.select(); }, 50);
  };

  const handleSave = async () => {
    const parsed = inputVal.replace(/\s|,/g, '');
    const num = parsed === '' ? null : Number(parsed);
    if (parsed !== '' && isNaN(num as number)) {
      setInputVal(prix_demande !== null ? String(Math.round(prix_demande)) : '');
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      onLocalPrixDemande?.(stock_numero, num);
      await onSavePrixDemande?.(stock_numero, num);
    } catch {
      /* restore */
      setInputVal(prix_demande !== null ? String(Math.round(prix_demande)) : '');
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setInputVal(prix_demande !== null ? String(Math.round(prix_demande)) : '');
      setEditing(false);
    }
  };

  const bg = dark ? 'rgba(0,0,0,0.45)' : '#fffbeb';
  const border = dark ? 'rgba(245,158,11,0.3)' : '#fde68a';
  const labelColor = dark ? 'rgba(255,255,255,0.45)' : '#92400e';
  const valueColor = dark ? 'rgba(255,255,255,0.9)' : '#1e293b';
  const divider = dark ? 'rgba(245,158,11,0.2)' : '#fde68a';

  return (
    <div style={{
      background: bg,
      borderTop: `2px solid ${border}`,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Ligne 1 : coûts */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${divider}` }}>
        <FullBloc label="Achat" value={fmt(prix_achat_reel)} labelColor={labelColor} valueColor={valueColor} border={divider} />
        <FullBloc label="M.O." value={fmt(cout_mo)} labelColor={labelColor} valueColor={valueColor} border={divider} />
        <FullBloc label="Total investi" value={fmt(total)} labelColor={labelColor} valueColor={'#f59e0b'} border={divider} bold />
      </div>

      {/* Ligne 2 : prix demandé + profit */}
      <div style={{ display: 'flex' }}>
        {/* Prix demandé — éditable si callback fourni */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          padding: '5px 10px',
          borderRight: `1px solid ${divider}`,
        }}>
          <span style={{ fontSize: 9, color: labelColor, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
            Prix demandé
          </span>
          {onSavePrixDemande && editing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 11, color: labelColor }}>$</span>
              <input
                ref={inputRef}
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleSave}
                disabled={saving}
                style={{
                  fontSize: 13, fontWeight: 700, color: valueColor,
                  background: 'transparent',
                  border: 'none', borderBottom: `1.5px solid #f59e0b`,
                  outline: 'none', width: 100,
                  padding: '0 2px',
                }}
              />
            </div>
          ) : (
            <div
              onClick={onSavePrixDemande ? handleEdit : undefined}
              title={onSavePrixDemande ? 'Cliquer pour modifier' : undefined}
              style={{
                fontSize: 13, fontWeight: 700, color: valueColor,
                cursor: onSavePrixDemande ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              {fmt(prix_demande)}
              {onSavePrixDemande && (
                <span style={{ fontSize: 9, color: labelColor }}>✏️</span>
              )}
            </div>
          )}
        </div>

        {/* Profit projeté */}
        <div style={{
          flex: 1.5, display: 'flex', flexDirection: 'column',
          padding: '5px 10px',
        }}>
          <span style={{ fontSize: 9, color: labelColor, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
            Profit projeté
          </span>
          {profit !== null ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: profitColor(profit) }}>
                {profit >= 0 ? '+' : ''}{fmt(profit)}
              </span>
              {pct !== null && (
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: profitColor(profit),
                  background: profit >= 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                  padding: '1px 6px', borderRadius: 4,
                }}>
                  {Math.round(pct)}%
                </span>
              )}
            </div>
          ) : (
            <span style={{ fontSize: 12, color: labelColor }}>—</span>
          )}
        </div>
      </div>
    </div>
  );
}

function FullBloc({ label, value, labelColor, valueColor, border, bold }: {
  label: string; value: string; labelColor: string; valueColor: string; border: string; bold?: boolean;
}) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      padding: '5px 10px',
      borderRight: `1px solid ${border}`,
    }}>
      <span style={{ fontSize: 9, color: labelColor, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
        {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: bold ? 800 : 600, color: valueColor }}>
        {value}
      </span>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════
// ── FinanceSection (panneau détail desktop ET mobile) ────────────
// Coût d'achat | M.O. | Total investi
// Prix de vente projeté (éditable) | Profit projeté
// ═══════════════════════════════════════════════════════════════════

export function FinanceSection({ data, onSavePrix, onLocalPrix }: {
  data: FinancialData;
  onSavePrix: (prix: number | null) => Promise<void>;
  onLocalPrix: (prix: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(data.prix_demande !== null ? String(Math.round(data.prix_demande)) : '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setInputVal(data.prix_demande !== null ? String(Math.round(data.prix_demande)) : '');
  }, [data.prix_demande, editing]);

  const achat = data.prix_achat_reel;
  const mo = data.cout_mo;
  const total = (achat ?? 0) + (mo ?? 0);
  const prixDemande = data.prix_demande;
  const profit = prixDemande !== null ? prixDemande - total : null;
  const pct = profit !== null && total > 0 ? (profit / total) * 100 : null;

  const fmt = (n: number | null) => n == null ? '—' : `$${Math.round(n).toLocaleString('fr-CA')}`;
  const profitColor = profit === null ? '#9ca3af' : profit > 0 ? '#16a34a' : profit < 0 ? '#dc2626' : '#9ca3af';

  const handleSave = async () => {
    const parsed = inputVal.replace(/\s|,|\$/g, '');
    const num = parsed === '' ? null : Number(parsed);
    if (parsed !== '' && isNaN(num as number)) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      onLocalPrix(num);
      await onSavePrix(num);
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  return (
    <div style={{
      marginBottom: 20,
      padding: 14,
      borderRadius: 10,
      background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
      border: '1px solid #fde68a',
    }}>
      <div style={{
        fontSize: 12, fontWeight: 700, color: '#92400e',
        marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        💰 Données financières
      </div>

      {/* Ligne 1 : Achat / M.O. / Total */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <FinBloc label="Coût d'achat" value={fmt(achat)} />
        <FinBloc label="Main d'œuvre" value={fmt(mo)} />
        <FinBloc label="Total investi" value={fmt(total)} highlight />
      </div>

      {/* Ligne 2 : Prix demandé éditable + Profit */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{
          flex: 1, padding: '8px 10px', background: 'white',
          borderRadius: 8, border: '1px solid #fde68a',
        }}>
          <div style={{ fontSize: 10, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, fontWeight: 700 }}>
            Prix de vente projeté
          </div>
          {editing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 14, color: '#92400e', fontWeight: 700 }}>$</span>
              <input
                autoFocus
                inputMode="numeric"
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') setEditing(false);
                }}
                onBlur={handleSave}
                disabled={saving}
                style={{
                  fontSize: 16, fontWeight: 800, color: '#1e293b',
                  background: 'transparent',
                  border: 'none', borderBottom: '2px solid #f59e0b',
                  outline: 'none', width: '100%',
                  padding: '2px 0',
                }}
              />
            </div>
          ) : (
            <div
              onClick={() => setEditing(true)}
              title="Cliquer pour modifier"
              style={{
                fontSize: 16, fontWeight: 800, color: '#1e293b',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {fmt(prixDemande)}
              <span style={{ fontSize: 11 }}>✏️</span>
            </div>
          )}
        </div>

        <div style={{
          flex: 1, padding: '8px 10px',
          background: profit === null ? 'white' : profit >= 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
          borderRadius: 8, border: `1px solid ${profit === null ? '#fde68a' : profit >= 0 ? '#86efac' : '#fca5a5'}`,
        }}>
          <div style={{ fontSize: 10, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, fontWeight: 700 }}>
            Profit projeté
          </div>
          {profit !== null ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: profitColor }}>
                {profit >= 0 ? '+' : ''}{fmt(profit)}
              </span>
              {pct !== null && (
                <span style={{
                  fontSize: 11, fontWeight: 700, color: profitColor,
                  background: profit >= 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                  padding: '2px 6px', borderRadius: 4,
                }}>
                  {Math.round(pct)}%
                </span>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>
              Définir le prix
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FinBloc({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      flex: 1, padding: '8px 10px',
      background: highlight ? '#f59e0b' : 'white',
      borderRadius: 8,
      border: highlight ? 'none' : '1px solid #fde68a',
    }}>
      <div style={{
        fontSize: 10, color: highlight ? 'rgba(255,255,255,0.85)' : '#92400e',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        marginBottom: 3, fontWeight: 700,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 15, fontWeight: 800,
        color: highlight ? 'white' : '#1e293b',
      }}>
        {value}
      </div>
    </div>
  );
}
