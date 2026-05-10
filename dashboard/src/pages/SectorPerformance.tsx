import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { StockRecord } from '../types';
import { HelpLabel } from '../components/common/InfoTooltip';
import { TIPS } from '../lib/tooltips';

interface SectorData {
  name: string;
  count: number;
  avgComposite: number;
  medianChange: number;
  avgRsi: number;
  avgRsPercentile: number;
  avgReturn3m: number;
  avgReturn1y: number;
  topStocks: StockRecord[];
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

type SortKey = 'avgComposite' | 'avgRsPercentile' | 'avgReturn3m' | 'avgReturn1y' | 'avgRsi' | 'count';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'avgComposite',   label: 'Composite Score' },
  { key: 'avgRsPercentile', label: 'RS Percentile'  },
  { key: 'avgReturn3m',    label: '3M Return'       },
  { key: 'avgReturn1y',    label: '1Y Return'       },
  { key: 'avgRsi',         label: 'RSI'             },
  { key: 'count',          label: 'Stock Count'     },
];

export default function SectorPerformance({ stocks }: { stocks: StockRecord[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('avgComposite');
  const [chartMetric, setChartMetric] = useState<'avgRsPercentile' | 'avgComposite' | 'avgReturn3m'>('avgRsPercentile');

  const sectors = useMemo(() => {
    const groups: Record<string, StockRecord[]> = {};
    for (const stock of stocks) {
      const sector = stock.sector;
      if (!sector || sector === 'Unknown') continue;
      if (!groups[sector]) groups[sector] = [];
      groups[sector].push(stock);
    }

    return Object.entries(groups)
      .filter(([, ss]) => ss.length >= 3)
      .map(([name, ss]): SectorData => {
        const rsiValues = ss.map(s => s.rsi).filter((v): v is number => v != null);
        const sorted = [...ss].sort((a, b) => b.score.composite - a.score.composite);
        return {
          name,
          count:           ss.length,
          avgComposite:    Math.round(avg(ss.map(s => s.score.composite))),
          medianChange:    median(ss.map(s => s.changePercent)),
          avgRsi:          rsiValues.length > 0 ? avg(rsiValues) : 0,
          avgRsPercentile: Math.round(avg(ss.map(s => s.rsPercentile))),
          avgReturn3m:     avg(ss.map(s => s.priceReturn3m * 100)),
          avgReturn1y:     avg(ss.map(s => s.priceReturn1y * 100)),
          topStocks:       sorted.slice(0, 5),
        };
      });
  }, [stocks]);

  const sorted = useMemo(
    () => [...sectors].sort((a, b) => b[sortKey] - a[sortKey]),
    [sectors, sortKey],
  );

  const strongest = sorted[0];
  const weakest   = sorted[sorted.length - 1];

  // Chart data — sorted by the selected chart metric descending
  const chartData = useMemo(() =>
    [...sectors]
      .sort((a, b) => b[chartMetric] - a[chartMetric])
      .map(s => ({ name: s.name.replace(' ', '\n'), value: +s[chartMetric].toFixed(1), full: s.name })),
    [sectors, chartMetric],
  );

  const CHART_METRIC_LABEL: Record<typeof chartMetric, string> = {
    avgRsPercentile: 'Avg RS Percentile',
    avgComposite:    'Avg Composite Score',
    avgReturn3m:     'Avg 3M Return (%)',
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold t-primary">Sector Performance</h1>
        <p className="text-sm t-muted mt-1">
          Comparative analysis across {sectors.length} sectors covering {stocks.length} stocks
        </p>
      </div>

      {/* Summary bar */}
      <div className="card p-4 flex flex-wrap gap-4 text-sm items-center">
        <div><span className="t-muted">Sectors: </span><span className="font-semibold t-primary">{sectors.length}</span></div>
        <div><span className="t-muted">Strongest: </span><span className="font-semibold text-bullish">{strongest?.name ?? '—'}</span></div>
        <div><span className="t-muted">Weakest: </span><span className="font-semibold text-bearish">{weakest?.name ?? '—'}</span></div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs t-muted">Sort by:</span>
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
            className="input-field text-xs py-1 px-2"
          >
            {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Sector comparison chart */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold t-tertiary uppercase tracking-wider">Sector Overview</h2>
          <div className="flex gap-1">
            {(['avgRsPercentile', 'avgComposite', 'avgReturn3m'] as const).map(m => (
              <button
                key={m}
                onClick={() => setChartMetric(m)}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  chartMetric === m ? 'bg-accent/20 text-accent-light ring-1 ring-accent/30' : 'bg-surface-hover t-muted hover:t-secondary'
                }`}
              >
                {m === 'avgRsPercentile' ? 'RS %ile' : m === 'avgComposite' ? 'Score' : '3M Ret'}
              </button>
            ))}
          </div>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 28, left: -10 }}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }}
                interval={0}
                angle={-35}
                textAnchor="end"
              />
              <YAxis tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }} />
              <Tooltip
                contentStyle={{ fontSize: 11, backgroundColor: 'var(--surface-secondary)', border: '1px solid var(--surface-border)', borderRadius: 8 }}
                formatter={(v: number) => [`${chartMetric === 'avgReturn3m' ? (v >= 0 ? '+' : '') : ''}${v}${chartMetric === 'avgReturn3m' ? '%' : ''}`, CHART_METRIC_LABEL[chartMetric]]}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.full ?? ''}
              />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {chartData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={
                      chartMetric === 'avgReturn3m'
                        ? d.value >= 0 ? '#16a34a' : '#dc2626'
                        : d.value >= 60 ? '#16a34a' : d.value >= 40 ? '#d97706' : '#dc2626'
                    }
                    fillOpacity={0.8}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sector cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sorted.map((sector, idx) => {
          const rankInComposite = [...sectors].sort((a, b) => b.avgComposite - a.avgComposite).findIndex(s => s.name === sector.name);
          const scoreColor = sector.avgComposite >= 60 ? 'text-bullish' : sector.avgComposite >= 45 ? 'text-amber-400' : 'text-bearish';
          const scoreBg    = sector.avgComposite >= 60 ? 'bg-bullish/10' : sector.avgComposite >= 45 ? 'bg-amber-400/10' : 'bg-bearish/10';
          const changeColor = sector.medianChange >= 0 ? 'text-bullish' : 'text-bearish';

          return (
            <div key={sector.name} className="card p-5 flex flex-col">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-mono t-faint">#{idx + 1}</span>
                    <h3 className="text-base font-bold t-primary">{sector.name}</h3>
                  </div>
                  <span className="text-xs t-muted">{sector.count} stock{sector.count !== 1 ? 's' : ''}</span>
                </div>
                <div className={`text-2xl font-bold font-mono tabular-nums rounded-md px-3 py-1 ${scoreColor} ${scoreBg}`} title={`Ranked #${rankInComposite + 1} by composite score`}>
                  {sector.avgComposite}
                </div>
              </div>

              {/* Stats grid — 4 metrics */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wider t-faint mb-0.5">
                    <HelpLabel label="Day Change" tip={TIPS['Avg Change']} />
                  </div>
                  <div className={`text-sm font-mono tabular-nums font-medium ${changeColor}`}>
                    {sector.medianChange >= 0 ? '+' : ''}{sector.medianChange.toFixed(2)}%
                    <span className="text-[9px] t-faint ml-1">median</span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider t-faint mb-0.5">
                    <HelpLabel label="Avg RSI" tip={TIPS['RSI']} />
                  </div>
                  <div className={`text-sm font-mono tabular-nums font-medium ${
                    sector.avgRsi > 70 ? 'text-bearish' : sector.avgRsi < 30 ? 'text-bullish' : 't-secondary'
                  }`}>
                    {sector.avgRsi.toFixed(1)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider t-faint mb-0.5">
                    <HelpLabel label="Avg RS" tip={TIPS['RS']} />
                  </div>
                  <div className={`text-sm font-mono tabular-nums font-medium ${
                    sector.avgRsPercentile >= 60 ? 'text-bullish' : sector.avgRsPercentile >= 40 ? 'text-amber-400' : 'text-bearish'
                  }`}>
                    {sector.avgRsPercentile}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider t-faint mb-0.5">3M Return</div>
                  <div className={`text-sm font-mono tabular-nums font-medium ${sector.avgReturn3m >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                    {sector.avgReturn3m >= 0 ? '+' : ''}{sector.avgReturn3m.toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* 1Y return as a subtle sub-line */}
              <div className="text-[10px] t-faint mb-3">
                1Y avg: <span className={sector.avgReturn1y >= 0 ? 'text-bullish' : 'text-bearish'}>
                  {sector.avgReturn1y >= 0 ? '+' : ''}{sector.avgReturn1y.toFixed(1)}%
                </span>
              </div>

              {/* Top stocks */}
              <div className="pt-3 border-t border-surface-border mt-auto">
                <div className="text-[10px] uppercase tracking-wider t-faint mb-2">Top Stocks</div>
                <div className="space-y-1.5">
                  {sector.topStocks.map(stock => (
                    <Link
                      key={stock.ticker}
                      to={`/stock/${stock.ticker}`}
                      className="flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-semibold text-accent-light group-hover:t-primary transition-colors shrink-0">
                          {stock.ticker}
                        </span>
                        <span className="text-xs t-muted truncate">{stock.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className={`text-xs font-mono tabular-nums ${stock.changePercent >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                          {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(1)}%
                        </span>
                        <span className={`text-xs font-bold font-mono tabular-nums rounded px-1.5 py-0.5 ${
                          stock.score.composite >= 65 ? 'text-bullish bg-bullish/10' :
                          stock.score.composite >= 45 ? 'text-amber-400 bg-amber-400/10' :
                          'text-bearish bg-bearish/10'
                        }`}>
                          {stock.score.composite}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
