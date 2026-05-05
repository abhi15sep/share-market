import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { OnlinePick, OnlinePicksData, StockRecord } from '../types';
import { MarketTag } from '../components/common/Tags';

const CALL_TYPE_COLOR: Record<string, string> = {
  'Strong Buy':      'bg-bullish/15 text-bullish ring-1 ring-bullish/30',
  'Buy':             'bg-bullish/10 text-bullish ring-1 ring-bullish/20',
  'Outperform':      'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20',
  'Overweight':      'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20',
  'Accumulate':      'bg-accent/10 text-accent-light ring-1 ring-accent/20',
  'Upgrade':         'bg-accent/10 text-accent-light ring-1 ring-accent/20',
  'Initiation':      'bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20',
  'Speculative Buy': 'bg-yellow-500/10 text-yellow-400 ring-1 ring-yellow-500/20',
  'Watch':           'bg-surface-tertiary t-muted ring-1 ring-surface-border',
};

const SOURCE_TYPE_COLOR: Record<string, string> = {
  analyst:   'bg-accent/10 text-accent-light',
  broker:    'bg-bullish/10 text-bullish',
  community: 'bg-surface-tertiary t-secondary',
  screener:  'bg-purple-500/10 text-purple-400',
  news:      'bg-yellow-500/10 text-yellow-400',
};

const SOURCE_TYPE_LABEL: Record<string, string> = {
  analyst:   'Analyst',
  broker:    'Broker',
  community: 'Community',
  screener:  'Screener',
  news:      'News',
};

type Period = 'today' | 'week' | 'all';
type ViewMode = 'list' | 'grouped';

const YOUTUBE_CHANNELS = [
  {
    market: 'Your Subscriptions',
    channels: [
      { name: 'Mark Roussin, CPA', url: 'https://www.youtube.com/@MarkRoussin', desc: 'CPA-led fundamental stock analysis' },
      { name: 'Financial Education', url: 'https://www.youtube.com/@FinancialEducationJeremy', desc: 'Stock picking, growth investing' },
      { name: 'Felix & Friends (Goat Academy)', url: 'https://www.youtube.com/@GoatAcademy', desc: 'Growth stocks, US market picks' },
      { name: 'Jeremy Lefebvre Makes Money', url: 'https://www.youtube.com/@JeremyLeftebvreMakesMoney', desc: 'Portfolio updates, stock analysis' },
      { name: 'ZipTrader', url: 'https://www.youtube.com/@ZipTrader', desc: 'Technical analysis, swing trading picks' },
      { name: 'Fin Tek', url: 'https://www.youtube.com/@FinTekNeil', desc: 'Stock market analysis & picks' },
      { name: 'Everything Money', url: 'https://www.youtube.com/@EverythingMoney', desc: '8-pillar fundamental analysis framework' },
      { name: "Let's Talk Money! with Joseph Hogue, CFA", url: 'https://www.youtube.com/@josephhogue', desc: 'CFA-level dividend & value investing' },
      { name: 'Everything Money Plus', url: 'https://www.youtube.com/@EverythingMoneyPlus', desc: 'Extended deep dives & live analysis' },
      { name: 'Ross Givens', url: 'https://www.youtube.com/@RossGivens', desc: 'Options & momentum stock picks' },
      { name: 'Couch Investor', url: 'https://www.youtube.com/@CouchInvestor', desc: 'Passive & long-term investing ideas' },
    ],
  },
  {
    market: 'Highly Recommended — US',
    channels: [
      { name: 'Andrei Jikh', url: 'https://www.youtube.com/@AndreiJikh', desc: '2.3M subs · Dividend & passive investing' },
      { name: 'Graham Stephan', url: 'https://www.youtube.com/@GrahamStephan', desc: '4.7M subs · Personal finance, growth picks' },
      { name: 'The Plain Bagel', url: 'https://www.youtube.com/@ThePlainBagel', desc: 'Evidence-based value investing & ETFs' },
      { name: 'Patrick Boyle', url: 'https://www.youtube.com/@PatrickBoyleOnFinance', desc: 'Ex-hedge fund · institutional-quality analysis' },
      { name: 'Ticker Symbol: You', url: 'https://www.youtube.com/@TickerSymbolYOU', desc: 'Long-term fundamental deep dives' },
      { name: 'Tom Nash', url: 'https://www.youtube.com/@TomNashTV', desc: 'Value investing, Warren Buffett style' },
      { name: 'InvestAnswers', url: 'https://www.youtube.com/@InvestAnswers', desc: 'Data-driven stock & macro analysis' },
      { name: 'Aswath Damodaran', url: 'https://www.youtube.com/@AswathDamodaranonValuation', desc: 'NYU professor · gold standard on valuation' },
      { name: 'Meet Kevin', url: 'https://www.youtube.com/@MeetKevin', desc: '2M subs · Growth stocks, market commentary' },
      { name: 'Humphrey Yang', url: 'https://www.youtube.com/@HumphreyYang', desc: 'Beginner-friendly stock & ETF analysis' },
    ],
  },
  {
    market: 'Highly Recommended — UK',
    channels: [
      { name: 'Sasha Yanshin', url: 'https://www.youtube.com/@SashaYanshin', desc: 'UK & US stocks, ISA/SIPP strategies' },
      { name: 'Damien Talks Money', url: 'https://www.youtube.com/@DamienTalksMoney', desc: 'UK personal finance, dividend investing' },
      { name: 'Toby Newbatt', url: 'https://www.youtube.com/@TobyNewbatt', desc: 'UK dividend stocks, long-term portfolios' },
      { name: 'James Shack', url: 'https://www.youtube.com/@JamesShack', desc: 'UK financial planning & FIRE investing' },
    ],
  },
];

const OTHER_RESOURCES = [
  { name: 'StockTwits Trending', url: 'https://stocktwits.com/rankings/trending', desc: 'Live trending US tickers · auto-fetched', group: 'auto' },
  { name: 'ApeWisdom (Reddit)', url: 'https://apewisdom.io', desc: 'Reddit mention aggregator — r/stocks, WSB, r/investing · auto-fetched', group: 'auto' },
  { name: 'MarketBeat Upgrades', url: 'https://www.marketbeat.com/ratings/upgrades/', desc: 'Analyst upgrades · auto-fetched', group: 'auto' },
  { name: 'MarketBeat Initiations', url: 'https://www.marketbeat.com/ratings/initiations/', desc: 'New analyst coverage · auto-fetched', group: 'auto' },
  { name: 'Reddit r/UKInvesting', url: 'https://www.reddit.com/r/UKInvesting/', desc: 'UK stock discussion · auto-fetched', group: 'auto' },
  { name: 'TipRanks', url: 'https://www.tipranks.com/analysts/top', desc: 'Top analysts ranked by accuracy & returns', group: 'analyst' },
  { name: 'MarketBeat Ratings', url: 'https://www.marketbeat.com/ratings/', desc: 'Daily analyst upgrades/downgrades + scores', group: 'analyst' },
  { name: 'Benzinga Ratings', url: 'https://www.benzinga.com/analyst-ratings/', desc: 'Wall Street analyst ratings & price targets', group: 'analyst' },
  { name: 'Seeking Alpha Top Picks', url: 'https://seekingalpha.com/stock-ideas/top-stocks', desc: 'Quant + analyst strong buy stocks', group: 'analyst' },
  { name: 'Zacks #1 Rank', url: 'https://www.zacks.com/stocks/buy-list/', desc: 'Earnings estimate revision-driven picks', group: 'analyst' },
  { name: 'FinViz Screener', url: 'https://finviz.com/screener.ashx?v=111&f=ta_rsi_os30', desc: 'RSI oversold + breakout screens', group: 'screener' },
  { name: 'Investing.com Ideas', url: 'https://www.investing.com/stock-ideas/', desc: 'Analyst + AI combined picks', group: 'screener' },
  { name: 'Motley Fool US', url: 'https://www.fool.com/investing/stock-market/market-sectors/', desc: 'Stock Advisor picks & sector analysis', group: 'screener' },
  { name: 'Motley Fool UK', url: 'https://www.fool.co.uk/investing/', desc: 'UK-focused stock recommendations', group: 'screener' },
  { name: 'WallStreetBets', url: 'https://www.reddit.com/r/wallstreetbets/', desc: 'High-risk momentum & speculative plays', group: 'community' },
];

const RESOURCE_GROUPS = [
  { key: 'auto',      label: 'Auto-Fetched by ETL',          accent: 'text-bullish' },
  { key: 'analyst',   label: 'Analyst Ratings & Targets',    accent: 'text-accent-light' },
  { key: 'screener',  label: 'Screeners & Stock Ideas',       accent: 'text-purple-400' },
  { key: 'community', label: 'Community Discussion',          accent: 't-muted' },
];

interface Props {
  stocks: StockRecord[];
  onlinePicks: OnlinePicksData | null;
}

function todayStr() { return new Date().toISOString().slice(0, 10); }

function weekAgoStr() {
  const d = new Date(); d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function cutoffForPeriod(period: Period): string {
  if (period === 'today') return todayStr();
  if (period === 'week')  return weekAgoStr();
  const d = new Date(); d.setDate(d.getDate() - 14);
  return d.toISOString().slice(0, 10);
}

function daysAgo(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr + 'T00:00:00').getTime()) / 86_400_000);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function scoreColor(score: number): string {
  if (score >= 70) return 'text-bullish';
  if (score >= 50) return 'text-accent-light';
  if (score >= 30) return 't-secondary';
  return 'text-bearish';
}

export default function OnlinePicks({ stocks, onlinePicks }: Props) {
  const [period, setPeriod]       = useState<Period>('today');
  const [viewMode, setViewMode]   = useState<ViewMode>('grouped');
  const [market, setMarket]       = useState<'All' | 'US' | 'UK'>('All');
  const [sourceType, setSourceType] = useState<'All' | 'analyst' | 'broker' | 'community' | 'screener'>('All');
  const [callFilter, setCallFilter] = useState<'All' | 'Strong' | 'Buy' | 'Watch'>('All');
  const [showYouTube, setShowYouTube] = useState(false);

  const allPicks = onlinePicks?.picks ?? [];

  const filtered = useMemo(() => {
    const cutoff = cutoffForPeriod(period);
    return allPicks
      .filter(p => p.date >= cutoff)
      .filter(p => market === 'All' || p.market === market)
      .filter(p => sourceType === 'All' || p.sourceType === sourceType)
      .filter(p => {
        if (callFilter === 'All') return true;
        if (callFilter === 'Strong') return ['Strong Buy', 'Outperform', 'Overweight'].includes(p.callType);
        if (callFilter === 'Buy')    return ['Buy', 'Accumulate', 'Upgrade', 'Initiation'].includes(p.callType);
        if (callFilter === 'Watch')  return p.callType === 'Watch';
        return true;
      });
  }, [allPicks, period, market, sourceType, callFilter]);

  // Grouped by ticker (sorted by mention count desc, then ticker)
  const grouped = useMemo(() => {
    const map = new Map<string, OnlinePick[]>();
    for (const p of filtered) {
      const arr = map.get(p.ticker) ?? [];
      arr.push(p);
      map.set(p.ticker, arr);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  }, [filtered]);

  // Stats across full 14-day window
  const todayPicks   = allPicks.filter(p => p.date === todayStr());
  const tickerCounts = allPicks.reduce<Record<string, number>>((acc, p) => { acc[p.ticker] = (acc[p.ticker] ?? 0) + 1; return acc; }, {});
  const hotTicker    = Object.entries(tickerCounts).sort((a, b) => b[1] - a[1])[0];
  const analystCount = allPicks.filter(p => p.sourceType === 'analyst' || p.sourceType === 'broker').length;

  const stockMap = useMemo(() => new Map(stocks.map(s => [s.ticker, s])), [stocks]);

  const periodLabel = period === 'today' ? "Today's" : period === 'week' ? "This Week's" : "14-Day";

  if (allPicks.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader onlinePicks={onlinePicks} count={0} />
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">🔍</div>
          <h3 className="text-lg font-semibold t-secondary mb-1">No picks fetched yet</h3>
          <p className="t-muted max-w-md mx-auto">
            Run the ETL pipeline to fetch stock picks from StockTwits trending,
            Reddit (r/stocks, r/UKInvesting), and MarketBeat analyst ratings. Data updates hourly on weekdays.
          </p>
          <code className="mt-4 inline-block text-sm text-accent bg-accent/10 px-3 py-1.5 rounded-lg font-mono">
            npm run etl
          </code>
        </div>
        <ResourcesPanel showYouTube={showYouTube} onToggleYouTube={() => setShowYouTube(v => !v)} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader onlinePicks={onlinePicks} count={filtered.length} />

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Today's Picks" value={String(todayPicks.length)} sub="new recommendations" />
        <StatCard
          label="Most Mentioned"
          value={hotTicker ? hotTicker[0] : '—'}
          sub={hotTicker ? `${hotTicker[1]} source${hotTicker[1] !== 1 ? 's' : ''} in 14d` : 'no data'}
          link={hotTicker ? `/stock/${hotTicker[0]}` : undefined}
        />
        <StatCard label="Analyst Calls" value={String(analystCount)} sub="upgrades & initiations (14d)" />
        <StatCard
          label="Unique Tickers"
          value={String(new Set(allPicks.map(p => p.ticker)).size)}
          sub={`across ${new Set(allPicks.map(p => p.source)).size} sources`}
        />
      </div>

      {/* Period tabs + view toggle */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Period tabs */}
        <div className="flex rounded-xl border border-surface-border bg-surface-secondary overflow-hidden">
          {([
            { id: 'today', label: 'Today' },
            { id: 'week',  label: 'This Week' },
            { id: 'all',   label: 'All (14d)' },
          ] as { id: Period; label: string }[]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setPeriod(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                period === tab.id
                  ? 'bg-accent/15 text-accent-light'
                  : 't-muted hover:t-primary hover:bg-surface-hover'
              }`}
            >
              {tab.label}
              {tab.id === 'today' && todayPicks.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-bullish/20 text-bullish font-semibold">
                  {todayPicks.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* View mode */}
        <div className="flex rounded-xl border border-surface-border bg-surface-secondary overflow-hidden">
          <button
            onClick={() => setViewMode('grouped')}
            className={`px-3 py-2 text-xs font-medium transition-colors flex items-center gap-1.5 ${
              viewMode === 'grouped' ? 'bg-accent/15 text-accent-light' : 't-muted hover:t-primary hover:bg-surface-hover'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h8M4 18h8" />
            </svg>
            Grouped
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-2 text-xs font-medium transition-colors flex items-center gap-1.5 ${
              viewMode === 'list' ? 'bg-accent/15 text-accent-light' : 't-muted hover:t-primary hover:bg-surface-hover'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            List
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-1.5 ml-auto">
          <FilterGroup
            value={market}
            options={['All', 'US', 'UK']}
            onChange={v => setMarket(v as typeof market)}
          />
          <span className="w-px h-4 bg-surface-border" />
          <FilterGroup
            value={sourceType}
            options={['All', 'analyst', 'broker', 'community']}
            labels={{ analyst: 'Analyst', broker: 'Broker', community: 'Community' }}
            onChange={v => setSourceType(v as typeof sourceType)}
          />
          <span className="w-px h-4 bg-surface-border" />
          <FilterGroup
            value={callFilter}
            options={['All', 'Strong', 'Buy', 'Watch']}
            labels={{ Strong: 'Strong Buy+', Buy: 'Buy', Watch: 'Watch' }}
            onChange={v => setCallFilter(v as typeof callFilter)}
          />
        </div>
      </div>

      {/* Results header */}
      <p className="text-xs t-muted -mb-2">
        {periodLabel} picks · {viewMode === 'grouped' ? `${grouped.length} tickers` : `${filtered.length} picks`}
        {filtered.length === 0 && ' — try adjusting filters'}
      </p>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="t-muted">No picks match your filters.</p>
        </div>
      ) : viewMode === 'grouped' ? (
        <div className="space-y-3">
          {grouped.map(([ticker, picks]) => (
            <GroupedTickerCard key={ticker} ticker={ticker} picks={picks} stock={stockMap.get(ticker) ?? null} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered
            .sort((a, b) => b.date.localeCompare(a.date) || a.ticker.localeCompare(b.ticker))
            .map(pick => (
              <PickCard key={pick.id} pick={pick} stock={stockMap.get(pick.ticker) ?? null} />
            ))}
        </div>
      )}

      {/* Resources panel */}
      <ResourcesPanel showYouTube={showYouTube} onToggleYouTube={() => setShowYouTube(v => !v)} />
    </div>
  );
}

// ─── Grouped ticker card ────────────────────────────────────────────────────

function GroupedTickerCard({ ticker, picks, stock }: { ticker: string; picks: OnlinePick[]; stock: StockRecord | null }) {
  const [expanded, setExpanded] = useState(picks.length <= 3);
  const score = stock?.score?.composite;
  const mostRecentPick = picks[0];
  const analystPicks   = picks.filter(p => p.sourceType === 'analyst' || p.sourceType === 'broker');
  const communityPicks = picks.filter(p => p.sourceType === 'community');
  const hasPriceTarget = picks.some(p => p.priceTarget != null);
  const latestTarget   = picks.find(p => p.priceTarget != null)?.priceTarget;
  const displayPicks   = expanded ? picks : picks.slice(0, 2);

  return (
    <div className="card hover:border-accent/20 transition-colors">
      {/* Ticker header */}
      <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpanded(v => !v)}>
        <Link
          to={`/stock/${ticker}`}
          onClick={e => e.stopPropagation()}
          className="flex-shrink-0 w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-xs font-bold text-accent-light hover:bg-accent/20 transition-colors"
        >
          {ticker.replace('.L', '').slice(0, 4)}
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/stock/${ticker}`}
              onClick={e => e.stopPropagation()}
              className="text-sm font-bold t-primary hover:text-accent-light transition-colors"
            >
              {ticker}
            </Link>
            {stock?.name && <span className="text-xs t-muted truncate max-w-[160px]">{stock.name}</span>}
            <MarketTag market={(mostRecentPick.market as 'US' | 'UK')} />
          </div>
          {/* Source summary */}
          <div className="flex flex-wrap gap-1.5 mt-1">
            {analystPicks.length > 0 && (
              <span className="text-xs bg-accent/10 text-accent-light px-1.5 py-0.5 rounded-md font-medium">
                {analystPicks.length} analyst call{analystPicks.length !== 1 ? 's' : ''}
              </span>
            )}
            {communityPicks.length > 0 && (
              <span className="text-xs bg-surface-tertiary t-secondary px-1.5 py-0.5 rounded-md">
                {communityPicks.length} community
              </span>
            )}
            {picks.length > analystPicks.length + communityPicks.length && (
              <span className="text-xs bg-surface-tertiary t-muted px-1.5 py-0.5 rounded-md">
                +{picks.length - analystPicks.length - communityPicks.length} other
              </span>
            )}
          </div>
        </div>

        {/* Right side: score + price target + count + chevron */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {hasPriceTarget && latestTarget != null && (
            <div className="text-right hidden sm:block">
              <p className="text-xs t-muted">Target</p>
              <p className="text-sm font-semibold t-primary">${latestTarget.toLocaleString()}</p>
            </div>
          )}
          {stock && (
            <div className="text-right hidden sm:block">
              <p className="text-xs t-muted">Price</p>
              <p className={`text-sm font-medium ${stock.changePercent >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
              </p>
            </div>
          )}
          {score != null && (
            <div className="text-center">
              <p className="text-xs t-muted">Score</p>
              <p className={`text-sm font-bold ${scoreColor(score)}`}>{Math.round(score)}</p>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-accent-light bg-accent/15 px-2 py-1 rounded-lg">
              {picks.length}×
            </span>
            <svg
              className={`w-4 h-4 t-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Pick list */}
      <div className="border-t border-surface-border divide-y divide-surface-border">
        {displayPicks.map(pick => (
          <PickRow key={pick.id} pick={pick} />
        ))}
        {!expanded && picks.length > 2 && (
          <button
            onClick={() => setExpanded(true)}
            className="w-full py-2.5 text-xs text-accent-light hover:bg-surface-hover transition-colors"
          >
            Show {picks.length - 2} more
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Compact pick row (inside grouped card) ─────────────────────────────────

function PickRow({ pick }: { pick: OnlinePick }) {
  const ago = daysAgo(pick.date);
  const callColor = CALL_TYPE_COLOR[pick.callType] ?? CALL_TYPE_COLOR['Buy'];
  const stLabel   = SOURCE_TYPE_LABEL[pick.sourceType] ?? pick.sourceType;
  const stColor   = SOURCE_TYPE_COLOR[pick.sourceType] ?? SOURCE_TYPE_COLOR['community'];

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
      <span className={`badge text-xs font-semibold flex-shrink-0 ${callColor}`}>{pick.callType}</span>
      <span className={`badge text-xs flex-shrink-0 ${stColor}`}>{stLabel}</span>
      <p className="text-xs t-muted flex-1 min-w-0 truncate">{pick.headline}</p>
      <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
        {pick.priceTarget != null && (
          <span className="text-xs t-muted hidden sm:inline">
            Target <span className="t-secondary font-medium">${pick.priceTarget.toLocaleString()}</span>
          </span>
        )}
        {pick.analyst && (
          <span className="text-xs t-muted hidden md:inline truncate max-w-[120px]">{pick.analyst}</span>
        )}
        <span className="text-xs t-muted whitespace-nowrap">
          {ago === 0 ? 'Today' : ago === 1 ? '1d ago' : `${ago}d`}
        </span>
        <a
          href={pick.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="text-xs text-accent-light hover:underline flex items-center gap-0.5 flex-shrink-0"
        >
          {pick.source.length > 12 ? pick.source.slice(0, 12) + '…' : pick.source}
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    </div>
  );
}

// ─── Flat pick card (list view) ─────────────────────────────────────────────

function PickCard({ pick, stock }: { pick: OnlinePick; stock: StockRecord | null }) {
  const ago = daysAgo(pick.date);
  const callColor = CALL_TYPE_COLOR[pick.callType] ?? CALL_TYPE_COLOR['Buy'];
  const stColor   = SOURCE_TYPE_COLOR[pick.sourceType] ?? SOURCE_TYPE_COLOR['community'];
  const stLabel   = SOURCE_TYPE_LABEL[pick.sourceType] ?? pick.sourceType;
  const score     = stock?.score?.composite;

  return (
    <div className="card p-4 hover:border-accent/20 transition-colors">
      <div className="flex flex-wrap items-start gap-3">
        <Link
          to={`/stock/${pick.ticker}`}
          className="flex-shrink-0 w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-xs font-bold text-accent-light hover:bg-accent/20 transition-colors"
        >
          {pick.ticker.replace('.L', '').slice(0, 4)}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
            <Link to={`/stock/${pick.ticker}`} className="text-sm font-semibold t-primary hover:text-accent-light transition-colors">
              {pick.ticker}
            </Link>
            {pick.name && <span className="text-xs t-muted truncate max-w-[140px]">{pick.name}</span>}
            <MarketTag market={pick.market as 'US' | 'UK'} />
          </div>
          <p className="text-xs t-muted leading-relaxed">{pick.headline}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
          <span className={`badge text-xs font-semibold ${callColor}`}>{pick.callType}</span>
          <span className={`badge text-xs ${stColor}`}>{stLabel}</span>
          {pick.priceTarget != null && (
            <span className="text-xs t-muted">
              Target: <span className="t-secondary font-medium">${pick.priceTarget.toLocaleString()}</span>
            </span>
          )}
          {stock && (
            <span className={`text-xs font-medium ${stock.changePercent >= 0 ? 'text-bullish' : 'text-bearish'}`}>
              {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
            </span>
          )}
          {score != null && (
            <span className={`text-xs font-semibold ${scoreColor(score)}`}>
              Score {Math.round(score)}
            </span>
          )}
          <span className="text-xs t-muted whitespace-nowrap">
            {ago === 0 ? 'Today' : ago === 1 ? '1d ago' : `${ago}d ago`}
          </span>
          <a
            href={pick.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-accent-light hover:underline flex items-center gap-0.5"
          >
            {pick.source}
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>
      {pick.analyst && (
        <div className="mt-2 ml-12 text-xs t-muted">
          by <span className="t-secondary">{pick.analyst}</span>
          <span> · {formatDate(pick.date)}</span>
        </div>
      )}
    </div>
  );
}

// ─── Shared components ───────────────────────────────────────────────────────

function PageHeader({ onlinePicks, count }: { onlinePicks: OnlinePicksData | null; count: number }) {
  return (
    <div className="flex flex-wrap items-start gap-3">
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-bold t-primary">Online Stock Picks</h1>
        <p className="text-sm t-muted mt-0.5">
          Aggregated from analysts, brokers & online communities · last updated{' '}
          {onlinePicks?.updatedAt
            ? new Date(onlinePicks.updatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '—'}
        </p>
      </div>
      {count > 0 && (
        <span className="badge bg-accent/15 text-accent-light ring-1 ring-accent/30 text-sm">
          {count} pick{count !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, link }: { label: string; value: string; sub: string; link?: string }) {
  const inner = (
    <div className="card p-3.5">
      <p className="text-xs t-muted mb-1">{label}</p>
      <p className="text-lg font-bold t-primary truncate">{value}</p>
      <p className="text-xs t-muted mt-0.5 truncate">{sub}</p>
    </div>
  );
  return link ? <Link to={link}>{inner}</Link> : inner;
}

function FilterGroup<T extends string>({
  value, options, labels, onChange,
}: {
  value: T;
  options: T[];
  labels?: Partial<Record<T, string>>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
            value === opt
              ? 'bg-accent/15 text-accent-light'
              : 't-muted hover:t-primary hover:bg-surface-hover'
          }`}
        >
          {labels?.[opt] ?? opt}
        </button>
      ))}
    </div>
  );
}

// ─── Resources panel ─────────────────────────────────────────────────────────

function ResourcesPanel({ showYouTube, onToggleYouTube }: { showYouTube: boolean; onToggleYouTube: () => void }) {
  return (
    <div className="space-y-3">
      <div className="card p-4">
        <h3 className="text-sm font-semibold t-primary mb-4">Online Resources</h3>
        <div className="space-y-4">
          {RESOURCE_GROUPS.map(group => {
            const items = OTHER_RESOURCES.filter(r => r.group === group.key);
            return (
              <div key={group.key}>
                <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${group.accent}`}>{group.label}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {items.map(r => (
                    <a
                      key={r.url}
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col p-2.5 rounded-lg border border-surface-border hover:border-accent/30 hover:bg-surface-hover transition-all group"
                    >
                      <span className="text-xs font-medium t-secondary group-hover:text-accent-light transition-colors truncate">{r.name}</span>
                      <span className="text-xs t-muted mt-0.5 leading-relaxed">{r.desc.replace(' · auto-fetched', '')}</span>
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card p-4">
        <button onClick={onToggleYouTube} className="flex items-center gap-2 w-full text-left">
          <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
            <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
          <span className="text-sm font-semibold t-primary">YouTube Channels</span>
          <span className="text-xs t-muted ml-1">(curated — not auto-fetched)</span>
          <svg
            className={`w-4 h-4 t-muted ml-auto transition-transform ${showYouTube ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showYouTube && (
          <div className="mt-4 space-y-4">
            {YOUTUBE_CHANNELS.map(group => (
              <div key={group.market}>
                <p className="text-xs font-semibold t-muted uppercase tracking-wider mb-2">{group.market}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {group.channels.map(ch => (
                    <a
                      key={ch.url}
                      href={ch.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2.5 p-2.5 rounded-lg border border-surface-border hover:border-red-500/30 hover:bg-surface-hover transition-all group"
                    >
                      <div className="w-6 h-6 rounded bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium t-secondary group-hover:text-accent-light transition-colors truncate">{ch.name}</p>
                        <p className="text-xs t-muted leading-relaxed">{ch.desc}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-xs t-muted italic">
              YouTube content is not auto-fetched due to API limitations. Visit these channels directly for their latest picks.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
