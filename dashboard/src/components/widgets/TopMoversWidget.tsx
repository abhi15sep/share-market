import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { StockRecord } from '../../types';
import { ChangePercent } from '../common/Tags';

interface Props {
  stocks: StockRecord[];
}

export default function TopMoversWidget({ stocks }: Props) {
  const { gainers, losers } = useMemo(() => {
    // Exclude extreme outliers (halted/data errors) with the same threshold used in Overview
    const clean = stocks.filter(s => Math.abs(s.changePercent) < 30);
    const sorted = [...clean].sort((a, b) => b.changePercent - a.changePercent);
    return {
      gainers: sorted.slice(0, 5),
      losers: sorted.slice(-5).reverse(),
    };
  }, [stocks]);

  return (
    <div className="overflow-auto h-full text-xs">
      <div className="grid grid-cols-2 gap-2 p-1">
        <div>
          <p className="text-[10px] font-semibold text-bullish uppercase mb-1">Top Gainers</p>
          {gainers.map(s => (
            <div key={s.ticker} className="flex items-center justify-between py-1">
              <Link to={`/stock/${s.ticker}`} className="font-medium text-accent-light hover:underline">{s.ticker}</Link>
              <ChangePercent value={s.changePercent} />
            </div>
          ))}
        </div>
        <div>
          <p className="text-[10px] font-semibold text-bearish uppercase mb-1">Top Losers</p>
          {losers.map(s => (
            <div key={s.ticker} className="flex items-center justify-between py-1">
              <Link to={`/stock/${s.ticker}`} className="font-medium text-accent-light hover:underline">{s.ticker}</Link>
              <ChangePercent value={s.changePercent} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
