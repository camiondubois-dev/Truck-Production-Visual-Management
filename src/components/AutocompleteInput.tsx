import { useState, useRef, useEffect } from 'react';

interface AutocompleteInputProps {
  value: string;
  onChange: (val: string) => void;
  suggestions: string[];
  placeholder?: string;
  style?: React.CSSProperties;
}

export function AutocompleteInput({
  value, onChange, suggestions, placeholder, style,
}: AutocompleteInputProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = value.length === 0
    ? suggestions
    : suggestions.filter(s =>
        s.toLowerCase().includes(value.toLowerCase())
      );

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid #d1d5db',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
    ...style,
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        style={inputStyle}
        onChange={e => {
          onChange(e.target.value);
          setOpen(true);
          setHighlighted(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (!open || filtered.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlighted(h => Math.min(h + 1, filtered.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlighted(h => Math.max(h - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            onChange(filtered[highlighted]);
            setOpen(false);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />

      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          background: 'white', border: '1px solid #e5e7eb',
          borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 999, maxHeight: 220, overflowY: 'auto',
          marginTop: 4,
        }}>
          {filtered.map((s, i) => (
            <div
              key={s}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(s);
                setOpen(false);
              }}
              style={{
                padding: '9px 12px',
                fontSize: 13,
                cursor: 'pointer',
                background: i === highlighted ? '#eff6ff' : 'white',
                color: i === highlighted ? '#1d4ed8' : '#374151',
                fontWeight: i === highlighted ? 600 : 400,
                borderBottom: i < filtered.length - 1 ? '1px solid #f1f5f9' : 'none',
                transition: 'background 0.1s',
              }}
              onMouseEnter={() => setHighlighted(i)}
            >
              {(() => {
                if (!value) return s;
                const idx = s.toLowerCase().indexOf(value.toLowerCase());
                if (idx === -1) return s;
                return (
                  <>
                    {s.slice(0, idx)}
                    <strong style={{ color: '#f97316' }}>{s.slice(idx, idx + value.length)}</strong>
                    {s.slice(idx + value.length)}
                  </>
                );
              })()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
