import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { StockRecord, SummaryData, Metadata, MarketRegime, RegimeData, MacroData } from '../types';
import { MarketTag, ScoreBadge, ChangePercent } from '../components/common/Tags';
import { HelpLabel } from '../components/common/InfoTooltip';
import { TIPS } from '../lib/tooltips';
import MacroDashboard from '../components/common/MacroDashboard';

interface Props {
  stocks: StockRecord[];
  summary: SummaryData | null;
  metadata: Metadata | null;
  bearishCount: number;
  macroData?: MacroData | null;
}

export default function Overview({ stocks, summary, metadata, bearishCount, macroData }: Props) {
  const [capTab, setCapTab] = useState<'all' | 'Large' | 'Mid' | 'Small'>('all');

  if (!summary || summary.totalStocks === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center text-2xl">
          📊
        </div>
        <h2 className="text-xl font-semibold t-primary">No Data Yet</h2>
        <p className="t-tertiary text-center max-w-md">
          Run the ETL pipeline to fetch market data. The dashboard will populate automatically once data is available.
        </p>
        <code className="text-sm text-accent bg-accent/10 px-3 py-1.5 rounded-lg font-mono">
          cd etl && npm start
        </code>
      </div>
    );
  }

  const topByTab = capTab === 'all'
    ? summary.topOverall
    : capTab === 'Large'
      ? summary.topLargeCap
      : capTab === 'Mid'
        ? summary.topMidCap
        : summary.topSmallCap;

  const MARKETS = ['US', 'UK', 'JP', 'HK', 'IN', 'DE', 'FR'] as const;
  const marketCounts = Object.fromEntries(MARKETS.map(m => [m, stocks.filter(s => s.market === m).length]));

  // Median change — resistant to outliers
  const sortedChanges = [...stocks.map(s => s.changePercent)].sort((a, b) => a - b);
  const mid = Math.floor(sortedChanges.length / 2);
  const medianChange = sortedChanges.length % 2 !== 0
    ? sortedChanges[mid]
    : (sortedChanges[mid - 1] + sortedChanges[mid]) / 2;

  const bullishCount = stocks.filter(s => s.score.composite >= 60).length;
  const regime = metadata?.marketRegime ?? null;

  // Score distribution buckets
  const scoreDistribution = [
    { label: '70–100', count: stocks.filter(s => s.score.composite >= 70).length,  color: 'bg-bullish'    },
    { label: '50–69',  count: stocks.filter(s => s.score.composite >= 50 && s.score.composite < 70).length, color: 'bg-amber-500' },
    { label: '0–49',   count: stocks.filter(s => s.score.composite < 50).length,   color: 'bg-bearish'    },
  ];

  // Top movers
  const sortedByChange = [...stocks].filter(s => Math.abs(s.changePercent) < 30); // exclude extreme outliers
  const topGainers = [...sortedByChange].sort((a, b) => b.changePercent - a.changePercent).slice(0, 5);
  const topLosers  = [...sortedByChange].sort((a, b) => a.changePercent - b.changePercent).slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold t-primary">Market Overview</h1>
        <p className="text-sm t-muted mt-1">Daily snapshot of {summary.totalStocks} tracked stocks</p>
      </div>

      {/* Market Regime Indicator */}
      {regime && <MarketRegimeCard regime={regime} />}

      {/* Macro Indicators */}
      {macroData && <MacroDashboard data={macroData} />}

      {/* Hero stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Stocks"
          value={summary.totalStocks.toString()}
          sub={`${marketCounts['US']} US · ${marketCounts['UK']} UK · ${marketCounts['JP']} JP`}
          gradient="from-accent/20 to-transparent"
          borderColor="border-t-accent"
        />
        <StatCard
          label="Avg Score"
          value={summary.avgScore.toString()}
          sub={`${bullishCount} bullish (60+)`}
          gradient={summary.avgScore >= 50 ? 'from-bullish/20 to-transparent' : 'from-bearish/20 to-transparent'}
          borderColor={summary.avgScore >= 50 ? 'border-t-bullish' : 'border-t-bearish'}
        />
        <StatCard
          label="Avg Change"
          value={`${medianChange >= 0 ? '+' : ''}${medianChange.toFixed(2)}%`}
          sub="Median today"
          gradient={medianChange >= 0 ? 'from-bullish/20 to-transparent' : 'from-bearish/20 to-transparent'}
          borderColor={medianChange >= 0 ? 'border-t-bullish' : 'border-t-bearish'}
        />
        <Link to="/bearish">
          <StatCard
            label="Bearish Alerts"
            value={bearishCount.toString()}
            sub="Stocks with strong warnings"
            gradient="from-bearish/20 to-transparent"
            borderColor="border-t-bearish"
          />
        </Link>
      </div>

      {/* Top Performers */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold t-primary">Top Performers</h2>
            <p className="text-sm t-muted mt-0.5">Highest composite scores</p>
          </div>
          <div className="flex gap-1 bg-surface-tertiary rounded-lg p-1">
            {(['all', 'Large', 'Mid', 'Small'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setCapTab(tab)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  capTab === tab ? 'bg-accent/20 text-accent-light' : 't-muted hover:t-secondary'
                }`}
              >
                {tab === 'all' ? 'All' : tab}
              </button>
            ))}
          </div>
        </div>
        <div className="card-flat overflow-hidden">
          {topByTab.map((s, i) => {
            const liveStock = stocks.find(st => st.ticker === s.ticker);
            return (
              <Link
                key={s.ticker}
                to={`/stock/${s.ticker}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-surface-hover transition-colors border-b border-surface-border last:border-b-0"
              >
                <div className="flex items-center gap-4">
                  <span className="w-7 h-7 rounded-full bg-surface-tertiary flex items-center justify-center text-xs font-bold t-tertiary">{i + 1}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold t-primary">{s.ticker}</span>
                      <MarketTag market={s.market} />
                    </div>
                    <span className="text-xs t-muted">{s.name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {liveStock && <ChangePercent value={liveStock.changePercent} />}
                  <ScoreBadge score={s.score} />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Bottom Performers */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold t-primary">Bottom Performers</h2>
          <p className="text-sm t-muted mt-0.5">Lowest composite scores — exercise caution</p>
        </div>
        <div className="card-flat overflow-hidden">
          {summary.bottomOverall.map((s, i) => {
            const liveStock = stocks.find(st => st.ticker === s.ticker);
            return (
              <Link
                key={s.ticker}
                to={`/stock/${s.ticker}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-surface-hover transition-colors border-b border-surface-border last:border-b-0"
              >
                <div className="flex items-center gap-4">
                  <span className="w-7 h-7 rounded-full bg-bearish/10 flex items-center justify-center text-xs font-bold text-bearish">{i + 1}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold t-primary">{s.ticker}</span>
                      <MarketTag market={s.market} />
                    </div>
                    <span className="text-xs t-muted">{s.name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {liveStock && <ChangePercent value={liveStock.changePercent} />}
                  <ScoreBadge score={s.score} />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Top Movers Today */}
      <section className="grid md:grid-cols-2 gap-4">
        <div>
          <h2 className="text-lg font-semibold t-primary mb-1">Top Gainers Today</h2>
          <p className="text-sm t-muted mb-3">Largest % gains (outliers excluded)</p>
          <div className="card-flat overflow-hidden">
            {topGainers.map((s, i) => (
              <Link key={s.ticker} to={`/stock/${s.ticker}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-surface-hover transition-colors border-b border-surface-border last:border-b-0">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-bullish/10 flex items-center justify-center text-xs font-bold text-bullish">{i + 1}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold t-primary text-sm">{s.ticker}</span>
                      <MarketTag market={s.market} />
                    </div>
                    <span className="text-xs t-muted">{s.name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ChangePercent value={s.changePercent} />
                  <ScoreBadge score={s.score.composite} />
                </div>
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold t-primary mb-1">Top Losers Today</h2>
          <p className="text-sm t-muted mb-3">Largest % declines (outliers excluded)</p>
          <div className="card-flat overflow-hidden">
            {topLosers.map((s, i) => (
              <Link key={s.ticker} to={`/stock/${s.ticker}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-surface-hover transition-colors border-b border-surface-border last:border-b-0">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-bearish/10 flex items-center justify-center text-xs font-bold text-bearish">{i + 1}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold t-primary text-sm">{s.ticker}</span>
                      <MarketTag market={s.market} />
                    </div>
                    <span className="text-xs t-muted">{s.name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ChangePercent value={s.changePercent} />
                  <ScoreBadge score={s.score.composite} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Market breakdown */}
      <section className="grid md:grid-cols-3 gap-4">
        <div className="card p-5">
          <h3 className="text-sm font-semibold t-tertiary uppercase tracking-wider mb-3">By Market</h3>
          <div className="space-y-3">
            <BarStat label="US" value={marketCounts['US']} total={summary.totalStocks} color="bg-accent" />
            <BarStat label="UK" value={marketCounts['UK']} total={summary.totalStocks} color="bg-accent" />
            <BarStat label="JP" value={marketCounts['JP']} total={summary.totalStocks} color="bg-accent" />
            <BarStat label="HK" value={marketCounts['HK']} total={summary.totalStocks} color="bg-accent" />
            <BarStat label="IN" value={marketCounts['IN']} total={summary.totalStocks} color="bg-accent" />
            <BarStat label="DE" value={marketCounts['DE']} total={summary.totalStocks} color="bg-accent" />
            <BarStat label="FR" value={marketCounts['FR']} total={summary.totalStocks} color="bg-accent" />
          </div>
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-semibold t-tertiary uppercase tracking-wider mb-3">By Cap Size</h3>
          <div className="space-y-3">
            <BarStat label="Large Cap" value={stocks.filter(s => s.capCategory === 'Large').length} total={summary.totalStocks} color="bg-accent" />
            <BarStat label="Mid Cap"   value={stocks.filter(s => s.capCategory === 'Mid').length}   total={summary.totalStocks} color="bg-accent" />
            <BarStat label="Small Cap" value={stocks.filter(s => s.capCategory === 'Small').length} total={summary.totalStocks} color="bg-accent" />
          </div>
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-semibold t-tertiary uppercase tracking-wider mb-3">Score Distribution</h3>
          <div className="space-y-3">
            {scoreDistribution.map(({ label, count, color }) => (
              <BarStat key={label} label={label} value={count} total={summary.totalStocks} color={color} />
            ))}
          </div>
          <p className="text-xs t-faint mt-4">70+ = bullish · 50–69 = neutral · &lt;50 = caution</p>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, sub, gradient, borderColor }: {
  label: string; value: string; sub: string; gradient: string; borderColor: string;
}) {
  return (
    <div className={`stat-card border-t-2 ${borderColor}`}>
      <div className={`absolute inset-0 bg-gradient-to-b ${gradient} pointer-events-none`} />
      <div className="relative">
        <p className="text-xs font-medium t-tertiary uppercase tracking-wider">
          {TIPS[label] ? <HelpLabel label={label} tip={TIPS[label]} /> : label}
        </p>
        <p className="text-2xl font-bold t-primary mt-1 font-mono tabular-nums">{value}</p>
        <p className="text-xs t-muted mt-1">{sub}</p>
      </div>
    </div>
  );
}

function BarStat({ label, value, total, color }: {
  label: string; value: number; total: number; color: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="t-secondary">{label}</span>
        <span className="font-mono tabular-nums t-primary">{value}</span>
      </div>
      <div className="h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const regimeColors = {
  bull: { banner: 'from-bullish/15 to-bullish/5', border: 'border-bullish', text: 'text-bullish-light', badge: 'bg-bullish/15 text-bullish-light', label: 'BULL' },
  correction: { banner: 'from-neutral/15 to-neutral/5', border: 'border-neutral', text: 'text-neutral-light', badge: 'bg-neutral/15 text-neutral-light', label: 'CORRECTION' },
  bear: { banner: 'from-bearish/15 to-bearish/5', border: 'border-bearish', text: 'text-bearish-light', badge: 'bg-bearish/15 text-bearish-light', label: 'BEAR' },
};

function MarketRegimeCard({ regime }: { regime: MarketRegime }) {
  const overall = regimeColors[regime.overall];

  return (
    <div className={`card overflow-hidden border-l-4 ${overall.border}`}>
      <div className={`bg-gradient-to-r ${overall.banner} px-5 py-4`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold t-tertiary uppercase tracking-wider">Market Regime</h2>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${overall.badge}`}>
              {overall.label}
            </span>
          </div>
        </div>
        <p className="text-sm t-secondary">{regime.summary}</p>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 divide-x divide-surface-border">
        <RegimeIndexRow data={regime.us} />
        <RegimeIndexRow data={regime.uk} />
        {regime.in && <RegimeIndexRow data={regime.in} />}
        {regime.eu && <RegimeIndexRow data={regime.eu} />}
        {regime.asia && <RegimeIndexRow data={regime.asia} />}
      </div>
    </div>
  );
}

function RegimeIndexRow({ data }: { data: RegimeData }) {
  const colors = regimeColors[data.regime];
  return (
    <div className="px-5 py-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold t-primary text-sm">{data.index}</span>
        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${colors.badge}`}>
          {colors.label}
        </span>
      </div>
      <div className="font-mono text-lg font-bold t-primary tabular-nums">
        {data.price > 0 ? data.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}
      </div>
      <div className="text-xs t-muted space-y-1">
        <div className="flex justify-between">
          <HelpLabel label="SMA 50" tip={TIPS['SMA 50']} />
          <span className="font-mono tabular-nums t-secondary">{data.sma50 > 0 ? data.sma50.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <HelpLabel label="SMA 200" tip={TIPS['SMA 200']} />
          <span className="font-mono tabular-nums t-secondary">{data.sma200 > 0 ? data.sma200.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <HelpLabel label="From 52W High" tip={TIPS['From 52W High']} />
          <span className={`font-mono tabular-nums ${data.changeFromHigh >= -5 ? 'text-bullish-light' : data.changeFromHigh >= -15 ? 'text-neutral-light' : 'text-bearish-light'}`}>
            {data.changeFromHigh.toFixed(2)}%
          </span>
        </div>
        <div className="flex justify-between">
          <HelpLabel label="Distribution Days" tip={TIPS['Distribution Days']} />
          <span className={`font-mono tabular-nums ${data.distributionDays >= 6 ? 'text-bearish-light' : data.distributionDays >= 4 ? 'text-neutral-light' : 't-secondary'}`}>
            {data.distributionDays}/25
          </span>
        </div>
      </div>
      <p className="text-xs t-muted pt-1 border-t border-surface-border">{data.signal}</p>
    </div>
  );
}
