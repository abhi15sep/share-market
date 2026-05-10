import { useState, useRef, useEffect } from 'react';

interface MultiSelectProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  activeClass?: string;
}

export default function MultiSelect({
  label,
  options,
  selected,
  onChange,
  activeClass = 'bg-accent/15 text-accent-light ring-1 ring-accent/30',
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);
  };

  const display =
    selected.length === 0 ? 'All' : selected.length === 1 ? selected[0] : `${selected.length} selected`;
  const isActive = selected.length > 0;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
          isActive ? `${activeClass} border-transparent` : 'bg-surface-tertiary border-transparent t-tertiary hover:t-secondary'
        }`}
      >
        <span className={isActive ? 'opacity-70' : 't-muted'}>{label}:</span>
        <span>{display}</span>
        <span className="opacity-50 ml-0.5">▾</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-surface-elevated border border-surface-border rounded-lg shadow-xl min-w-[150px] py-1">
          {options.map(opt => (
            <label
              key={opt}
              className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-surface-tertiary"
            >
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
                className="accent-accent w-3 h-3"
              />
              <span className="t-secondary">{opt}</span>
            </label>
          ))}
          {selected.length > 0 && (
            <>
              <div className="border-t border-surface-border my-1" />
              <button
                onClick={() => { onChange([]); setOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-xs text-bearish hover:bg-surface-tertiary"
              >
                Clear
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}