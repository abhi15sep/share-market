import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  createColumnHelper,
  flexRender,
  type SortingState,
} from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import type { StockRecord } from '../types';
import { MarketTag, CapTag, ChangePercent, ScoreBadge } from '../components/common/Tags';
import { currencySymbol } from '../lib/format';
import MultiSelect from '../components/common/MultiSelect';

interface Props {
  stocks: StockRecord[];
}

interface Weights {
  momentum: number;
  technical: number;
  sentiment: number;
  fundamentals: number;
  volume: number;
  risk: number;
}

const PRESETS: Record<string, { label: string; weights: Weights }> = {
  balanced: {
    label: 'Balanced',
    weights: { momentum: 17, technical: 17, sentiment: 17, fundamentals: 17, volume: 16, risk: 16 },
  },
  momentumHunter: {
    label: 'Momentum Hunter',
    weights: { momentum: 35, technical: 25, sentiment: 5, fundamentals: 5, volume: 20, risk: 10 },
  },
  valueInvestor: {
    label: 'Value Investor',
    weights: { momentum: 10, technical: 10, sentiment: 5, fundamentals: 40, volume: 10, risk: 25 },
  },
  riskAverse: {
    label: 'Risk-Averse',
    weights: { momentum: 10, technical: 10, sentiment: 10, fundamentals: 20, volume: 15, risk: 35 },
  },
};

const WEIGHT_KEYS: (keyof Weights)[] = ['momentum', 'technical', 'sentiment', 'fundamentals', 'volume', 'risk'];
const WEIGHT_META: Record<keyof Weights, { label: string; desc: string; color: string }> = {
  momentum:     { label: 'Momentum',     desc: 'Price trend & RS percentile', color: 'bg-bullish' },
  technical:    { label: 'Technical',    desc: 'RSI, MACD, Bollinger signals', color: 'bg-accent-light' },
  sentiment:    { label: 'Sentiment',    desc: 'News & social sentiment',      color: 'bg-amber-400' },
  fundamentals: { label: 'Fundamentals', desc: 'Earnings, P/E, ROE quality',   color: 'bg-purple-400' },
  volume:       { label: 'Volume',       desc: 'Volume ratio & OBV trend',     color: 'bg-sky-400' },
  risk:         { label: 'Risk',         desc: 'Beta, volatility & drawdown',  color: 'bg-rose-400' },
};

const ALL_MARKETS = ['US', 'UK', 'IN', 'HK', 'JP', 'DE', 'FR'];
const ALL_CAPS = ['Large', 'Mid', 'Small'];
const ALL_SECTORS = [
  'Communication', 'Consumer Cyclical', 'Consumer Defensive', 'Energy',
  'Financials', 'Fintech', 'Healthcare', 'Industrials', 'Materials',
  'Real Estate', 'Technology', 'Utilities',
];

function computeAdjustedScore(stock: StockRecord, weights: Weights): number {
  const components: Record<keyof Weights, number> = {
    momentum:     stock.score.priceMomentum,
    technical:    stock.score.technicalSignals,
    sentiment:    stock.score.newsSentiment,
    fundamentals: stock.score.fundamentals,
    volume:       stock.score.volumeTrend,
    risk:         stock.score.riskInverse,
  };
  let weightedSum = 0;
  let totalWeight = 0;
  for (const key of WEIGHT_KEYS) {
    weightedSum += components[key] * weights[key];
    totalWeight += weights[key];
  }
  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

function parseWeightsFromParams(params: URLSearchParams): Weights | null {
  const m = params.get('m');
  const t = params.get('t');
  if (m == null && t == null) return null;
  return {
    momentum:     Number(params.get('m')) || 17,
    technical:    Number(params.get('t')) || 17,
    sentiment:    Number(params.get('s')) || 17,
    fundamentals: Number(params.get('f')) || 17,
    volume:       Number(params.get('v')) || 16,
    risk:         Number(params.get('r')) || 16,
  };
}

function weightsToParams(w: Weights): string {
  return `?m=${w.momentum}&t=${w.technical}&s=${w.sentiment}&f=${w.fundamentals}&v=${w.volume}&r=${w.risk}`;
}

type StockWithAdjusted = StockRecord & { adjustedScore: number };

const columnHelper = createColumnHelper<StockWithAdjusted>();

/* ─── Score breakdown tooltip ─── */
function ScoreBreakdown({ stock, weights }: { stock: StockRecord; weights: Weights }) {
  const rows: { key: keyof Weights; value: number; weight: number }[] = WEIGHT_KEYS.map(key => ({
    key,
    value: {
      momentum: stock.score.priceMomentum,
      technical: stock.score.technicalSignals,
      sentiment: stock.score.newsSentiment,
      fundamentals: stock.score.fundamentals,
      volume: stock.score.volumeTrend,
      risk: stock.score.riskInverse,
    }[key],
    weight: weights[key],
  }));

  return (
    <div className="absolute right-0 top-full mt-1 z-50 bg-surface-secondary border border-surface-border rounded-lg shadow-xl p-3 w-52 text-xs">
      <div className="font-semibold t-secondary mb-2">Score Breakdown</div>
      {rows.map(({ key, value, weight }) => (
        <div key={key} className="flex items-center justify-between mb-1">
          <span className="t-muted">{WEIGHT_META[key].label}</span>
          <div className="flex items-center gap-2">
            <span className="font-mono t-secondary">{value}</span>
            <span className="t-faint">×{weight}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function WeightedScreener({ stocks }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialWeights = parseWeightsFromParams(searchParams) || PRESETS.balanced.weights;
  const [weights, setWeights] = useState<Weights>(initialWeights);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'adjustedScore', desc: true }]);
  const [markets, setMarkets] = useState<string[]>([]);
  const [caps, setCaps] = useState<string[]>([]);
  const [sectors, setSectors] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [hoveredTicker, setHoveredTicker] = useState<string | null>(null);

  const updateWeights = useCallback((newWeights: Weights) => {
    setWeights(newWeights);
    setSearchParams(new URLSearchParams(weightsToParams(newWeights).slice(1)), { replace: true });
  }, [setSearchParams]);

  const handleSlider = useCallback((key: keyof Weights, value: number) => {
    updateWeights({ ...weights, [key]: value });
  }, [weights, updateWeights]);

  const totalWeight = WEIGHT_KEYS.reduce((s, k) => s + weights[k], 0);

  const matchesPreset = useMemo(() =>
    Object.entries(PRESETS).find(([, p]) =>
      WEIGHT_KEYS.every(k => p.weights[k] === weights[k])
    )?.[0] ?? null
  , [weights]);

  const data = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stocks
      .filter(s => markets.length === 0 || markets.includes(s.market))
      .filter(s => caps.length === 0 || caps.includes(s.capCategory))
      .filter(s => sectors.length === 0 || sectors.includes(s.sector ?? ''))
      .filter(s => !q || s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      .map(s => ({ ...s, adjustedScore: computeAdjustedScore(s, weights) }));
  }, [stocks, weights, markets, caps, sectors, search]);

  const columns = useMemo(() => [
    columnHelper.accessor('ticker', {
      header: 'Ticker',
      cell: info => (
        <Link to={`/stock/${info.getValue()}`} className="font-bold text-sm text-accent-light hover:underline">
          {info.getValue()}
        </Link>
      ),
    }),
    columnHelper.accessor('name', {
      header: 'Name',
      cell: info => <span className="text-xs t-muted truncate max-w-[140px] block">{info.getValue()}</span>,
    }),
    columnHelper.accessor('market', {
      header: 'Market',
      cell: info => <MarketTag market={info.getValue()} />,
    }),
    columnHelper.accessor('capCategory', {
      header: 'Cap',
      cell: info => <CapTag cap={info.getValue()} />,
    }),
    columnHelper.accessor('price', {
      header: 'Price',
      cell: info => (
        <span className="font-mono tabular-nums text-xs t-secondary">
          {currencySymbol(info.row.original.market)}{info.getValue().toFixed(2)}
        </span>
      ),
    }),
    columnHelper.accessor('changePercent', {
      header: 'Change',
      cell: info => <ChangePercent value={info.getValue()} />,
    }),
    columnHelper.accessor(row => row.score.composite, {
      id: 'originalScore',
      header: 'Original',
      cell: info => <ScoreBadge score={info.getValue()} size="sm" />,
    }),
    columnHelper.accessor('adjustedScore', {
      header: 'Adjusted',
      sortDescFirst: true,
      cell: info => (
        <div
          className="relative inline-block"
          onMouseEnter={() => setHoveredTicker(info.row.original.ticker)}
          onMouseLeave={() => setHoveredTicker(null)}
        >
          <ScoreBadge score={info.getValue()} size="sm" />
          {hoveredTicker === info.row.original.ticker && (
            <ScoreBreakdown stock={info.row.original} weights={weights} />
          )}
        </div>
      ),
    }),
  ], [weights, hoveredTicker]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  const exportCsv = useCallback(() => {
    const rows = table.getSortedRowModel().rows.map(r => r.original);
    const header = 'Ticker,Name,Market,Cap,Price,Change%,Original Score,Adjusted Score\n';
    const body = rows.map(s =>
      `${s.ticker},"${s.name}",${s.market},${s.capCategory},${s.price.toFixed(2)},${s.changePercent.toFixed(2)},${s.score.composite},${s.adjustedScore}`
    ).join('\n');
    const blob = new Blob([header + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'weighted-screener.csv'; a.click();
    URL.revokeObjectURL(url);
  }, [table]);

  const anyFilterActive = markets.length > 0 || caps.length > 0 || sectors.length > 0 || search !== '';
  const resetFilters = () => { setMarkets([]); setCaps([]); setSectors([]); setSearch(''); };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold t-primary">Weighted Screener</h1>
        <p className="text-sm t-muted mt-1">Customize scoring weights to rank stocks by what matters most to you.</p>
      </div>

      {/* How to use */}
      <div className="card p-4 bg-accent/5 border-accent/15">
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium t-secondary select-none">
            <span className="text-xs t-muted group-open:rotate-90 transition-transform">&#9654;</span>
            How to use this screen
          </summary>
          <div className="mt-3 text-sm t-muted space-y-2">
            <p>Each of the 6 sub-scores (0–100) is re-weighted to produce a custom <strong className="t-secondary">Adjusted Score</strong>. Weights auto-normalize so they don't need to sum to 100.</p>
            <ol className="list-decimal list-inside space-y-1.5 ml-1">
              <li><strong className="t-secondary">Pick a preset</strong> — start with Momentum Hunter or Value Investor to see the extremes before fine-tuning.</li>
              <li><strong className="t-secondary">Drag sliders</strong> — set a weight to 0 to ignore that dimension entirely. The scores re-rank instantly.</li>
              <li><strong className="t-secondary">Hover Adjusted Score</strong> — see the per-dimension breakdown to understand why a stock ranked where it did.</li>
              <li><strong className="t-secondary">Filter then Export CSV</strong> — narrow by market or sector first, then export to build a shortlist in a spreadsheet.</li>
              <li><strong className="t-secondary">Sort by Original to compare</strong> — click the Original column to see which stocks the default model ranks higher than your custom weighting.</li>
            </ol>
            <p className="text-xs pt-2 border-t border-surface-border">
              <strong>Tip:</strong> For swing trades, try Momentum 40 + Technical 30 + Volume 20 + Risk 10 (zero out Sentiment and Fundamentals). For long-term holds, try Fundamentals 40 + Risk 30 + Momentum 15 + Technical 15.
            </p>
          </div>
        </details>
      </div>

      {/* Weight Sliders */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold t-tertiary uppercase tracking-wider">Score Weights</h2>
            <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
              totalWeight === 100 ? 'bg-bullish/10 text-bullish' : 'bg-amber-500/10 text-amber-400'
            }`}>
              total {totalWeight}
            </span>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {Object.entries(PRESETS).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => updateWeights(preset.weights)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  matchesPreset === key
                    ? 'bg-accent/15 text-accent-light ring-1 ring-accent/30'
                    : 'bg-surface-tertiary t-tertiary hover:t-secondary'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
          {WEIGHT_KEYS.map(key => {
            const meta = WEIGHT_META[key];
            const pct = totalWeight > 0 ? Math.round((weights[key] / totalWeight) * 100) : 0;
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium t-secondary">{meta.label}</label>
                  <span className="text-sm font-bold font-mono t-primary">{weights[key]}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={weights[key]}
                  onChange={e => handleSlider(key, Number(e.target.value))}
                  className="range-slider w-full"
                />
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] t-faint">{meta.desc}</span>
                  <span className="text-[10px] t-faint">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters + table header */}
      <div className="card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search ticker or name..."
            className="text-xs bg-surface-tertiary border border-surface-border rounded-md px-2.5 py-1.5 t-secondary placeholder:t-faint w-44 focus:outline-none focus:ring-1 focus:ring-accent/40"
          />
          <div className="w-px h-5 bg-surface-border" />
          <MultiSelect label="Market" options={ALL_MARKETS} selected={markets} onChange={setMarkets} activeClass="bg-accent/15 text-accent-light ring-1 ring-accent/30" />
          <MultiSelect label="Cap" options={ALL_CAPS} selected={caps} onChange={setCaps} activeClass="bg-accent/15 text-accent-light ring-1 ring-accent/30" />
          <MultiSelect label="Sector" options={ALL_SECTORS} selected={sectors} onChange={setSectors} activeClass="bg-accent/15 text-accent-light ring-1 ring-accent/30" />

          <span className="ml-auto badge bg-surface-tertiary t-secondary ring-1 ring-surface-border text-xs">
            {data.length} stock{data.length !== 1 ? 's' : ''}
          </span>

          <button onClick={exportCsv} className="btn-ghost text-xs flex items-center gap-1.5 px-2.5 py-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>

          {anyFilterActive && (
            <>
              <div className="w-px h-5 bg-surface-border" />
              <button onClick={resetFilters} className="px-2.5 py-1 rounded-md text-xs font-medium text-bearish bg-bearish/10 hover:bg-bearish/20 transition-all">
                Reset
              </button>
            </>
          )}
        </div>
      </div>

      {/* Results Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map(hg => (
                <tr key={hg.id} className="border-b border-surface-border bg-surface-tertiary/30">
                  {hg.headers.map(header => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left table-header cursor-pointer select-none hover:text-accent-light transition-colors whitespace-nowrap"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' && <span className="text-accent-light text-[10px]">&#9650;</span>}
                        {header.column.getIsSorted() === 'desc' && <span className="text-accent-light text-[10px]">&#9660;</span>}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map(row => (
                <tr key={row.id} className="border-b border-surface-border/50 hover:bg-surface-hover/50 transition-colors">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-4 py-2.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between p-4 border-t border-surface-border">
          <span className="text-xs t-muted">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <div className="flex gap-1">
            <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="pagination-btn px-3">Prev</button>
            <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="pagination-btn px-3">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
