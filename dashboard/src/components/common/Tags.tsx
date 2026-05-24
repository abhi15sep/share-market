import { currencySymbol } from '../../lib/format';

const MARKET_TAG_STYLES: Record<string, string> = {
  US: 'bg-accent/10 text-accent dark:text-accent-light ring-1 ring-accent/20',
  UK: 'bg-accent/10 text-accent dark:text-accent-light ring-1 ring-accent/20',
  IN: 'bg-accent/10 text-accent dark:text-accent-light ring-1 ring-accent/20',
  DE: 'bg-accent/10 text-accent dark:text-accent-light ring-1 ring-accent/20',
  FR: 'bg-accent/10 text-accent dark:text-accent-light ring-1 ring-accent/20',
  JP: 'bg-accent/10 text-accent dark:text-accent-light ring-1 ring-accent/20',
  HK: 'bg-accent/10 text-accent dark:text-accent-light ring-1 ring-accent/20',
};

export function MarketTag({ market }: { market: string }) {
  return (
    <span
      className={`badge ${MARKET_TAG_STYLES[market] || 'bg-accent/10 text-accent dark:text-accent-light ring-1 ring-accent/20'}`}
    >
      {market}
    </span>
  );
}

export function CapTag({ cap }: { cap: string }) {
  const styles: Record<string, string> = {
    Large: 'bg-accent/10 text-accent dark:text-accent-light ring-1 ring-accent/20',
    Mid: 'bg-neutral/10 text-neutral dark:text-neutral-light ring-1 ring-neutral/20',
    Small: 'bg-surface-tertiary text-t-tertiary ring-1 ring-surface-border',
  };
  return (
    <span className={`badge ${styles[cap] || 'bg-gray-500/12 text-gray-500 dark:text-gray-400'}`}>
      {cap}
    </span>
  );
}

export function Trading212Badge() {
  return (
    <span className="badge bg-accent/10 text-accent dark:text-accent-light ring-1 ring-accent/20">
      T212
    </span>
  );
}

export function SignalBadge({ direction, type }: { direction: string; type: string }) {
  return (
    <span
      className={`badge ${
        direction === 'bearish'
          ? 'bg-bearish/10 text-bearish dark:text-bearish-light ring-1 ring-bearish/20'
          : 'bg-bullish/10 text-bullish dark:text-bullish-light ring-1 ring-bullish/20'
      }`}
    >
      {direction === 'bearish' ? '\u2193' : '\u2191'} {type}
    </span>
  );
}

export function ScoreBadge({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const color = score >= 65 ? 'text-bullish' : score >= 40 ? 'text-neutral' : 'text-bearish';
  const bg = score >= 65 ? 'bg-bullish/10' : score >= 40 ? 'bg-neutral/10' : 'bg-bearish/10';
  const sizeClass = size === 'lg' ? 'text-2xl px-3 py-1' : size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-0.5';

  return (
    <span className={`font-bold font-mono tabular-nums rounded-md ${color} ${bg} ${sizeClass}`}>
      {score}
    </span>
  );
}

export function ChangePercent({ value }: { value: number }) {
  const color = value >= 0 ? 'text-bullish' : 'text-bearish';
  return (
    <span className={`font-mono tabular-nums font-medium ${color}`}>
      {value >= 0 ? '+' : ''}{value.toFixed(2)}%
    </span>
  );
}

export function PriceDisplay({ value, market }: { value: number; market?: string }) {
  const sym = currencySymbol(market || 'US');
  return (
    <span className="font-mono tabular-nums font-medium t-primary">
      {sym}{value.toFixed(2)}
    </span>
  );
}
