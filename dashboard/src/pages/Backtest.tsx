import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { StockRecord } from '../types';
import { ScoreBadge, MarketTag, ChangePercent } from '../components/common/Tags';
import { currencySymbol } from '../lib/format';
import InfoTooltip from '../components/common/InfoTooltip';

type ScoreHistory = Record<string, Record<string, number>>;

interface BacktestResult {
  stock: StockRecord;
  entryScore: number;
  currentScore: number;
  scoreDelta: number;
  return3m: number;
  return6m: number;
  return1y: number;
}

interface Strategy {
  key: string;
  label: string;
  shortLabel: string;
  description: string;
  filter: (s: StockRecord) => boolean;
}

const STRATEGIES: Strategy[] = [
  {
    key: 'highScore',
    label: 'High Composite Score (70+)',
    shortLabel: 'High Score 70+',
    description: 'Buy stocks with composite score >= 70. Tests whether high-scored stocks outperform.',
    filter: s => s.score.composite >= 70,
  },
  {
    key: 'momentum',
    label: 'Momentum Leaders (RS 80+)',
    shortLabel: 'RS Momentum 80+',
    description: 'Buy stocks with RS Percentile >= 80. Tests relative strength momentum strategy.',
    filter: s => s.rsPercentile >= 80,
  },
  {
    key: 'minervini',
    label: 'Minervini SEPA (6+ checks)',
    shortLabel: 'Minervini SEPA',
    description: 'Buy stocks passing 6+ Minervini trend template checks.',
    filter: s => s.minerviniChecks.passed >= 6,
  },
  {
    key: 'valueGrowth',
    label: 'Value + Growth (PE<20, EG>15%)',
    shortLabel: 'GARP PE<20 EG>15%',
    description: 'Buy stocks with P/E < 20 and earnings growth > 15%. Tests GARP approach.',
    filter: s => s.pe != null && s.pe > 0 && s.pe < 20 && s.earningsGrowth != null && s.earningsGrowth > 0.15,
  },
  {
    key: 'piotroski',
    label: 'Piotroski Strong (7+)',
    shortLabel: 'Piotroski 7+',
    description: 'Buy stocks with Piotroski F-Score >= 7. Tests fundamental quality strategy.',
    filter: s => (s.piotroskiScore ?? 0) >= 7,
  },
  {
    key: 'buffett',
    label: 'Buffett Quality (4+)',
    shortLabel: 'Buffett Quality 4+',
    description: 'Buy stocks with Buffett Score >= 4. Tests quality investing approach.',
    filter: s => (s.buffettScore ?? 0) >= 4,
  },
  {
    key: 'oversold',
    label: 'Oversold Bounce (RSI<35)',
    shortLabel: 'Oversold RSI<35',
    description: 'Buy stocks with RSI < 35. Tests mean-reversion / buy-the-dip strategy.',
    filter: s => s.rsi != null && s.rsi < 35,
  },
  {
    key: 'breakout',
    label: 'Breakout (52W High + Volume)',
    shortLabel: 'Breakout 52W+Vol',
    description: 'Buy stocks near 52-week high (>90%) with above-average volume. Tests breakout strategy.',
    filter: s => s.fiftyTwoWeekRangePercent >= 90 && s.volumeRatio >= 1.3,
  },
];

/* ── Return distribution buckets ── */
const BUCKETS = [
  { label: '<-20%',   min: -Infinity, max: -20  },
  { label: '-20–-10', min: -20,       max: -10  },
  { label: '-10–0',   min: -10,       max: 0    },
  { label: '0–10%',   min: 0,         max: 10   },
  { label: '10–25%',  min: 10,        max: 25   },
  { label: '25–50%',  min: 25,        max: 50   },
  { label: '>50%',    min: 50,        max: Infinity },
];

const MARKETS = ['All', 'US', 'UK', 'JP', 'HK', 'DE', 'FR', 'IN'] as const;

/* ─── COMPONENT ─── */
export default function Backtest({ stocks, scoreHistory }: { stocks: StockRecord[]; scoreHistory: ScoreHistory | null }) {
  const [selectedStrategy, setSelectedStrategy] = useState('highScore');
  const [sortBy, setSortBy] = useState<'return3m' | 'return6m' | 'return1y' | 'scoreDelta' | 'currentScore'>('return3m');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [marketFilter, setMarketFilter] = useState<string>('All');

  const strategy = STRATEGIES.find(s => s.key === selectedStrategy) ?? STRATEGIES[0];

  const results = useMemo(() => {
    const filtered = stocks.filter(strategy.filter);
    return filtered.map(s => {
      const history = scoreHistory?.[s.ticker];
      const dates = history ? Object.keys(history).sort() : [];
      const entryScore = dates.length > 0 ? history![dates[0]] : s.score.composite;
      return {
        stock: s,
        entryScore,
        currentScore: s.score.composite,
        scoreDelta: s.score.composite - entryScore,
        return3m: s.priceReturn3m * 100,
        return6m: s.priceReturn6m * 100,
        return1y: s.priceReturn1y * 100,
      };
    });
  }, [stocks, scoreHistory, strategy]);

  const filteredResults = useMemo(() => {
    const base = marketFilter === 'All' ? results : results.filter(r => r.stock.market === marketFilter);
    return [...base].sort((a, b) => {
      const mul = sortDir === 'desc' ? -1 : 1;
      return mul * (a[sortBy] - b[sortBy]);
    });
  }, [results, marketFilter, sortBy, sortDir]);

  // Aggregate stats (on filtered set)
  const stats = useMemo(() => {
    if (filteredResults.length === 0) return null;
    const r3 = filteredResults.map(r => r.return3m);
    const r1 = filteredResults.map(r => r.return1y);
    const sorted3m = [...r3].sort((a, b) => a - b);
    return {
      count:     filteredResults.length,
      avg3m:     r3.reduce((a, v) => a + v, 0) / r3.length,
      avg1y:     r1.reduce((a, v) => a + v, 0) / r1.length,
      avgScore:  filteredResults.reduce((a, r) => a + r.currentScore, 0) / filteredResults.length,
      winRate3m: (r3.filter(v => v > 0).length / r3.length) * 100,
      winRate1y: (r1.filter(v => v > 0).length / r1.length) * 100,
      best3m:    Math.max(...r3),
      worst3m:   Math.min(...r3),
      median3m:  sorted3m[Math.floor(sorted3m.length / 2)],
    };
  }, [filteredResults]);

  // Return distribution for chart
  const distribution = useMemo(() => {
    return BUCKETS.map(b => ({
      label: b.label,
      count: filteredResults.filter(r => r.return3m > b.min && r.return3m <= b.max).length,
      positive: b.min >= 0,
    }));
  }, [filteredResults]);

  // All-strategy comparison
  const allStrategyStats = useMemo(() => {
    return STRATEGIES.map(st => {
      const filtered = stocks.filter(st.filter);
      if (filtered.length === 0) return { key: st.key, shortLabel: st.shortLabel, count: 0, avg3m: null, avg1y: null, winRate3m: null };
      const r3 = filtered.map(s => s.priceReturn3m * 100);
      const r1 = filtered.map(s => s.priceReturn1y * 100);
      return {
        key: st.key,
        shortLabel: st.shortLabel,
        count: filtered.length,
        avg3m: r3.reduce((a, v) => a + v, 0) / r3.length,
        avg1y: r1.reduce((a, v) => a + v, 0) / r1.length,
        winRate3m: (r3.filter(v => v > 0).length / r3.length) * 100,
      };
    }).sort((a, b) => (b.avg3m ?? -Infinity) - (a.avg3m ?? -Infinity));
  }, [stocks]);

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const sortArrow = (col: typeof sortBy) => sortBy === col ? (sortDir === 'desc' ? ' ▼' : ' ▲') : '';

  const thBtn = (col: typeof sortBy, label: string, align: 'left' | 'right' | 'center' = 'right') => (
    <th className={`px-4 py-3 text-${align} table-header`}>
      <button onClick={() => toggleSort(col)} className="hover:text-accent-light transition-colors whitespace-nowrap">
        {label}{sortArrow(col)}
      </button>
    </th>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold t-primary">Strategy Backtest</h1>
        <p className="text-sm t-muted mt-1">Test how different stock-picking strategies perform using real return data.</p>
      </div>

      {/* How it works */}
      <div className="card p-4 bg-accent/5 border-accent/15">
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium t-secondary select-none">
            <span className="text-xs t-muted group-open:rotate-90 transition-transform">&#9654;</span>
            How it works
          </summary>
          <div className="mt-3 text-sm t-muted space-y-2">
            <p>Each strategy applies a filter to today's universe of stocks. We then measure the actual 3M and 1Y price returns for those stocks. This is a <strong className="t-secondary">snapshot backtest</strong> — it shows how stocks <em>currently</em> meeting each criterion have performed historically.</p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li><strong className="t-secondary">Avg 3M Return</strong> — average price change over the last 3 months for all selected stocks</li>
              <li><strong className="t-secondary">Win Rate</strong> — percentage of selected stocks with positive returns</li>
              <li><strong className="t-secondary">Score Delta</strong> — how much the composite score has changed since earliest history</li>
            </ul>
            <p className="text-xs pt-2 border-t border-surface-border">
              <strong>Caveat:</strong> This is a look-back test, not a forward prediction. Survivorship bias and data-mining risk apply — treat results as directional, not definitive.
            </p>
          </div>
        </details>
      </div>

      {/* Strategy selector */}
      <div className="card p-4">
        <h3 className="text-xs font-semibold t-tertiary uppercase tracking-wider mb-3">Select Strategy</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {STRATEGIES.map(s => (
            <button
              key={s.key}
              onClick={() => setSelectedStrategy(s.key)}
              className={`text-left p-3 rounded-lg border transition-all ${
                selectedStrategy === s.key
                  ? 'border-accent/40 bg-accent/10'
                  : 'border-surface-border hover:border-accent/20 hover:bg-surface-hover/50'
              }`}
            >
              <span className={`text-sm font-medium block ${selectedStrategy === s.key ? 'text-accent-light' : 't-primary'}`}>
                {s.label}
              </span>
              <span className="text-xs t-muted mt-1 block">{s.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Stats summary */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="stat-card border-t-2 border-t-accent">
            <p className="text-xs font-medium t-tertiary uppercase tracking-wider">Stocks Selected</p>
            <p className="text-2xl font-bold t-primary mt-1 font-mono tabular-nums">{stats.count}</p>
            <p className="text-xs t-muted mt-1">Avg Score: {stats.avgScore.toFixed(0)}</p>
          </div>
          <div className={`stat-card border-t-2 ${stats.avg3m >= 0 ? 'border-t-bullish' : 'border-t-bearish'}`}>
            <p className="text-xs font-medium t-tertiary uppercase tracking-wider">
              <InfoTooltip text="Average 3-month price return of all selected stocks">Avg 3M Return</InfoTooltip>
            </p>
            <p className={`text-2xl font-bold mt-1 font-mono tabular-nums ${stats.avg3m >= 0 ? 'text-bullish' : 'text-bearish'}`}>
              {stats.avg3m >= 0 ? '+' : ''}{stats.avg3m.toFixed(1)}%
            </p>
            <p className="text-xs t-muted mt-1">Median: {stats.median3m >= 0 ? '+' : ''}{stats.median3m.toFixed(1)}%</p>
          </div>
          <div className={`stat-card border-t-2 ${stats.avg1y >= 0 ? 'border-t-bullish' : 'border-t-bearish'}`}>
            <p className="text-xs font-medium t-tertiary uppercase tracking-wider">
              <InfoTooltip text="Average 1-year price return of all selected stocks">Avg 1Y Return</InfoTooltip>
            </p>
            <p className={`text-2xl font-bold mt-1 font-mono tabular-nums ${stats.avg1y >= 0 ? 'text-bullish' : 'text-bearish'}`}>
              {stats.avg1y >= 0 ? '+' : ''}{stats.avg1y.toFixed(1)}%
            </p>
            <p className="text-xs t-muted mt-1">
              Best 3M: <span className="text-bullish">{stats.best3m >= 0 ? '+' : ''}{stats.best3m.toFixed(1)}%</span>
            </p>
          </div>
          <div className={`stat-card border-t-2 ${stats.winRate3m >= 50 ? 'border-t-bullish' : 'border-t-bearish'}`}>
            <p className="text-xs font-medium t-tertiary uppercase tracking-wider">
              <InfoTooltip text="Percentage of stocks with positive 3-month returns">Win Rate (3M)</InfoTooltip>
            </p>
            <p className={`text-2xl font-bold mt-1 font-mono tabular-nums ${stats.winRate3m >= 50 ? 'text-bullish' : 'text-bearish'}`}>
              {stats.winRate3m.toFixed(0)}%
            </p>
            <p className="text-xs t-muted mt-1">
              Worst: <span className="text-bearish">{stats.worst3m.toFixed(1)}%</span>
              {' · '}1Y: {stats.winRate1y.toFixed(0)}%
            </p>
          </div>
        </div>
      )}

      {/* Return distribution chart + strategy comparison side-by-side */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Distribution histogram */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold t-tertiary uppercase tracking-wider mb-3">3M Return Distribution</h3>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribution} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }} />
                  <YAxis tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, backgroundColor: 'var(--surface-secondary)', border: '1px solid var(--surface-border)', borderRadius: 8 }}
                    formatter={(v: number) => [v, 'Stocks']}
                  />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                    {distribution.map((d, i) => (
                      <Cell key={i} fill={d.positive ? '#16a34a' : '#dc2626'} fillOpacity={0.75} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* All-strategy comparison */}
          <div className="card p-4">
            <h3 className="text-xs font-semibold t-tertiary uppercase tracking-wider mb-3">Strategy Comparison (all)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-surface-border">
                    <th className="py-1.5 text-left table-header font-medium">Strategy</th>
                    <th className="py-1.5 text-right table-header font-medium">N</th>
                    <th className="py-1.5 text-right table-header font-medium">Avg 3M</th>
                    <th className="py-1.5 text-right table-header font-medium">Avg 1Y</th>
                    <th className="py-1.5 text-right table-header font-medium">Win%</th>
                  </tr>
                </thead>
                <tbody>
                  {allStrategyStats.map(st => (
                    <tr
                      key={st.key}
                      onClick={() => setSelectedStrategy(st.key)}
                      className={`border-b border-surface-border/40 cursor-pointer transition-colors ${
                        st.key === selectedStrategy ? 'bg-accent/8' : 'hover:bg-surface-hover/50'
                      }`}
                    >
                      <td className={`py-1.5 font-medium ${st.key === selectedStrategy ? 'text-accent-light' : 't-secondary'}`}>
                        {st.shortLabel}
                      </td>
                      <td className="py-1.5 text-right font-mono t-muted">{st.count}</td>
                      <td className={`py-1.5 text-right font-mono font-semibold ${
                        st.avg3m == null ? 't-muted' : st.avg3m >= 0 ? 'text-bullish' : 'text-bearish'
                      }`}>
                        {st.avg3m == null ? '—' : `${st.avg3m >= 0 ? '+' : ''}${st.avg3m.toFixed(1)}%`}
                      </td>
                      <td className={`py-1.5 text-right font-mono ${
                        st.avg1y == null ? 't-muted' : st.avg1y >= 0 ? 'text-bullish' : 'text-bearish'
                      }`}>
                        {st.avg1y == null ? '—' : `${st.avg1y >= 0 ? '+' : ''}${st.avg1y.toFixed(1)}%`}
                      </td>
                      <td className={`py-1.5 text-right font-mono ${
                        st.winRate3m == null ? 't-muted' : st.winRate3m >= 50 ? 'text-bullish' : 'text-bearish'
                      }`}>
                        {st.winRate3m == null ? '—' : `${st.winRate3m.toFixed(0)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] t-faint mt-2">Click a row to switch strategy. Sorted by Avg 3M Return.</p>
          </div>
        </div>
      )}

      {/* Market filter + results table */}
      {results.length > 0 && (
        <div className="card overflow-hidden">
          {/* Market filter */}
          <div className="px-4 pt-4 pb-3 border-b border-surface-border/50 flex items-center gap-2 flex-wrap">
            <span className="text-xs t-muted">Market:</span>
            {MARKETS.map(m => (
              <button
                key={m}
                onClick={() => setMarketFilter(m)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  marketFilter === m
                    ? 'bg-accent/20 text-accent-light ring-1 ring-accent/30'
                    : 'bg-surface-hover t-muted hover:t-secondary'
                }`}
              >
                {m}
              </button>
            ))}
            {marketFilter !== 'All' && (
              <span className="text-xs t-muted ml-1">{filteredResults.length} stocks</span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-border bg-surface-tertiary/30">
                  <th className="px-4 py-3 text-left table-header">Ticker</th>
                  <th className="px-4 py-3 text-left table-header">Name</th>
                  <th className="px-4 py-3 text-left table-header">Market</th>
                  <th className="px-4 py-3 text-right table-header">Price</th>
                  {thBtn('currentScore', 'Score', 'center')}
                  {thBtn('return3m', '3M Return')}
                  {thBtn('return6m', '6M Return')}
                  {thBtn('return1y', '1Y Return')}
                  {thBtn('scoreDelta', 'Score Δ')}
                </tr>
              </thead>
              <tbody>
                {filteredResults.slice(0, 100).map(r => (
                  <tr key={r.stock.ticker} className="border-b border-surface-border/50 hover:bg-surface-hover/50 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link to={`/stock/${r.stock.ticker}`} className="font-semibold text-accent-light hover:t-primary transition-colors">
                        {r.stock.ticker}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 t-secondary text-xs truncate max-w-[120px]">{r.stock.name}</td>
                    <td className="px-4 py-2.5"><MarketTag market={r.stock.market} /></td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums t-primary text-xs">
                      {currencySymbol(r.stock.market)}{r.stock.price.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-center"><ScoreBadge score={r.currentScore} /></td>
                    <td className="px-4 py-2.5 text-right"><ChangePercent value={r.return3m} /></td>
                    <td className="px-4 py-2.5 text-right"><ChangePercent value={r.return6m} /></td>
                    <td className="px-4 py-2.5 text-right"><ChangePercent value={r.return1y} /></td>
                    <td className="px-4 py-2.5 text-right">
                      <span className={`font-mono tabular-nums text-xs ${
                        r.scoreDelta > 0 ? 'text-bullish' : r.scoreDelta < 0 ? 'text-bearish' : 't-muted'
                      }`}>
                        {r.scoreDelta > 0 ? '+' : ''}{r.scoreDelta}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredResults.length > 100 && (
            <p className="text-xs t-muted p-3 text-center">Showing first 100 of {filteredResults.length} results</p>
          )}
        </div>
      )}

      {results.length === 0 && (
        <div className="card p-12 text-center">
          <p className="t-muted text-sm">No stocks match the "{strategy.label}" criteria. Try a different strategy.</p>
        </div>
      )}
    </div>
  );
}
