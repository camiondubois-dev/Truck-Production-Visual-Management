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
  const { prix_achat_reel, cout_mo, cout_total_investi, prix_demande } = data;
  const total = cout_total_investi ?? ((prix_achat_reel ?? 0) + (cout_mo ?? 0));
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
  const { stock_numero, prix_achat_reel, cout_mo, cout_total_investi, prix_demande } = data;
  const total = cout_total_investi ?? ((prix_achat_reel ?? 0) + (cout_mo ?? 0));
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
