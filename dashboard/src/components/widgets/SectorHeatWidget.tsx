import { useMemo } from 'react';
import type { StockRecord } from '../../types';

interface Props {
  stocks: StockRecord[];
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export default function SectorHeatWidget({ stocks }: Props) {
  const sectors = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const s of stocks) {
      if (!s.sector || s.sector === 'Unknown') continue;
      if (!map.has(s.sector)) map.set(s.sector, []);
      map.get(s.sector)!.push(s.changePercent);
    }
    return [...map.entries()]
      .filter(([, changes]) => changes.length >= 2)
      .map(([name, changes]) => ({ name, medianChange: median(changes), count: changes.length }))
      .sort((a, b) => b.medianChange - a.medianChange);
  }, [stocks]);

  return (
    <div className="grid grid-cols-2 gap-1 p-1 overflow-auto h-full">
      {sectors.map(s => {
        const bg = s.medianChange > 0.5
          ? 'bg-bullish/20 border-bullish/30'
          : s.medianChange < -0.5
            ? 'bg-bearish/20 border-bearish/30'
            : 'bg-surface-tertiary/50 border-surface-border';
        return (
          <div key={s.name} className={`p-2 rounded-lg border text-center ${bg}`}>
            <p className="text-[10px] font-medium t-secondary truncate">{s.name}</p>
            <p className={`text-xs font-bold tabular-nums ${s.medianChange >= 0 ? 'text-bullish' : 'text-bearish'}`}>
              {s.medianChange >= 0 ? '+' : ''}{s.medianChange.toFixed(2)}%
            </p>
            <p className="text-[9px] t-muted">{s.count} stocks</p>
          </div>
        );
      })}
    </div>
  );
}
