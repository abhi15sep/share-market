import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { OnlinePick, OnlinePicksData, StockRecord } from '../types';
import { MarketTag } from '../components/common/Tags';

const CALL_TYPE_COLOR: Record<string, string> = {
  'Strong Buy':    'bg-bullish/15 text-bullish ring-1 ring-bullish/30',
  'Buy':           'bg-bullish/10 text-bullish ring-1 ring-bullish/20',
  'Outperform':    'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20',
  'Overweight':    'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20',
  'Accumulate':    'bg-accent/10 text-accent-light ring-1 ring-accent/20',
  'Upgrade':       'bg-accent/10 text-accent-light ring-1 ring-accent/20',
  'Initiation':    'bg-purple-500/10 text-purple-400 ring-1 ring-purple-500/20',
  'Speculative Buy': 'bg-yellow-500/10 text-yellow-400 ring-1 ring-yellow-500/20',
  'Watch':         'bg-surface-tertiary t-muted ring-1 ring-surface-border',
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

const YOUTUBE_CHANNELS = [
  {
    market: 'Indian Markets',
    channels: [
      { name: 'Akshat Shrivastava', url: 'https://www.youtube.com/@AkshatShrivastava', desc: 'Long-term investing, wealth creation' },
      { name: 'CA Rachana Ranade', url: 'https://www.youtube.com/@CARachanaRanade', desc: 'Fundamentals, IPOs, sector analysis' },
      { name: 'Pranjal Kamra (Finology)', url: 'https://www.youtube.com/@PranjalKamra', desc: 'Stock picking, Finology 30 basket' },
      { name: 'Vivek Bajaj', url: 'https://www.youtube.com/@VivekBajajStockEdge', desc: 'Technical + fundamental, StockEdge' },
      { name: 'Nikhil Kamath', url: 'https://www.youtube.com/@nikhilkamathcio', desc: 'Macro + sectoral picks' },
      { name: 'Parimal Ade', url: 'https://www.youtube.com/@ParimalAde', desc: 'QGLP fundamental methodology' },
    ],
  },
  {
    market: 'US Markets',
    channels: [
      { name: 'Andrei Jikh', url: 'https://www.youtube.com/@AndreiJikh', desc: 'Dividend investing, growth picks' },
      { name: 'Joseph Carlson', url: 'https://www.youtube.com/@JosephCarlsonShow', desc: 'Dividend portfolio, fundamentals' },
      { name: 'Meet Kevin', url: 'https://www.youtube.com/@MeetKevin', desc: 'Growth stocks, market news' },
      { name: 'Everything Money', url: 'https://www.youtube.com/@EverythingMoney', desc: '8-pillar fundamental analysis' },
      { name: 'Ticker Symbol: You', url: 'https://www.youtube.com/@TickerSymbolYOU', desc: 'Long-term fundamental deep dives' },
    ],
  },
];

const OTHER_RESOURCES = [
  { name: 'StockTwits Trending', url: 'https://stocktwits.com/rankings/trending', desc: 'Live trending tickers' },
  { name: 'ApeWisdom', url: 'https://apewisdom.io', desc: 'Reddit mention aggregator' },
  { name: 'FinViz News', url: 'https://finviz.com/news.ashx', desc: 'Analyst upgrades/downgrades' },
  { name: 'Moneycontrol Recs', url: 'https://www.moneycontrol.com/brokers-recommendation/', desc: 'Indian broker recommendations' },
  { name: 'Screener.in', url: 'https://www.screener.in/screens/50/', desc: 'Golden Crossover screen (India)' },
  { name: 'Investing.com Ideas', url: 'https://www.investing.com/stock-ideas/', desc: 'Analyst + AI combined picks' },
  { name: 'r/stocks', url: 'https://www.reddit.com/r/stocks/', desc: 'US stock discussion' },
  { name: 'r/IndiaInvestments', url: 'https://www.reddit.com/r/IndiaInvestments/', desc: 'Indian market discussion' },
];

interface Props {
  stocks: StockRecord[];
  onlinePicks: OnlinePicksData | null;
}

function getPriceChange(pick: OnlinePick, stocks: StockRecord[]): { current: number; pct: number } | null {
  const stock = stocks.find(s => s.ticker === pick.ticker);
  if (!stock) return null;
  return { current: stock.price, pct: stock.changePercent };
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function daysAgo(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00');
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

export default function OnlinePicks({ stocks, onlinePicks }: Props) {
  const [market, setMarket] = useState<'All' | 'US' | 'IN' | 'UK' | 'Other'>('All');
  const [sourceType, setSourceType] = useState<'All' | 'analyst' | 'broker' | 'community' | 'screener'>('All');
  const [callFilter, setCallFilter] = useState<'All' | 'Strong' | 'Buy' | 'Watch'>('All');
  const [days, setDays] = useState<7 | 14>(7);
  const [sortBy, setSortBy] = useState<'date' | 'ticker' | 'source'>('date');
  const [showYouTube, setShowYouTube] = useState(false);

  const picks = onlinePicks?.picks ?? [];

  const filtered = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    return picks
      .filter(p => p.date >= cutoffStr)
      .filter(p => market === 'All' || p.market === market || (market === 'Other' && !['US', 'IN', 'UK'].includes(p.market)))
      .filter(p => sourceType === 'All' || p.sourceType === sourceType)
      .filter(p => {
        if (callFilter === 'All') return true;
        if (callFilter === 'Strong') return p.callType === 'Strong Buy' || p.callType === 'Outperform' || p.callType === 'Overweight';
        if (callFilter === 'Buy') return p.callType === 'Buy' || p.callType === 'Accumulate' || p.callType === 'Upgrade' || p.callType === 'Initiation';
        if (callFilter === 'Watch') return p.callType === 'Watch';
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date') return b.date.localeCompare(a.date) || a.ticker.localeCompare(b.ticker);
        if (sortBy === 'ticker') return a.ticker.localeCompare(b.ticker);
        return a.source.localeCompare(b.source);
      });
  }, [picks, market, sourceType, callFilter, days, sortBy]);

  // Stats
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayPicks = picks.filter(p => p.date === todayStr);
  const tickerCounts = picks.reduce<Record<string, number>>((acc, p) => {
    acc[p.ticker] = (acc[p.ticker] ?? 0) + 1;
    return acc;
  }, {});
  const hotTicker = Object.entries(tickerCounts).sort((a, b) => b[1] - a[1])[0];

  if (picks.length === 0) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold t-primary">Online Stock Picks</h1>
          <p className="text-sm t-muted mt-1">Recommendations from analysts, brokers, and online communities</p>
        </div>
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">🔍</div>
          <h3 className="text-lg font-semibold t-secondary mb-1">No picks fetched yet</h3>
          <p className="t-muted max-w-md mx-auto">
            Run the ETL pipeline to fetch stock picks from StockTwits, Reddit, Moneycontrol,
            FinViz, and Screener.in. Data updates hourly on weekdays.
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
      {/* Header */}
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold t-primary">Online Stock Picks</h1>
          <p className="text-sm t-muted mt-0.5">
            Aggregated from analysts, brokers, and online communities · last updated{' '}
            {onlinePicks?.updatedAt
              ? new Date(onlinePicks.updatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              : '—'}
          </p>
        </div>
        <span className="badge bg-accent/15 text-accent-light ring-1 ring-accent/30 text-sm">
          {filtered.length} pick{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Today's Picks" value={String(todayPicks.length)} sub="new recommendations" />
        <StatCard
          label="Most Mentioned"
          value={hotTicker ? hotTicker[0] : '—'}
          sub={hotTicker ? `${hotTicker[1]} mentions in 14d` : 'no data'}
          link={hotTicker ? `/stock/${hotTicker[0]}` : undefined}
        />
        <StatCard label="Total (14d)" value={String(picks.length)} sub="across all sources" />
        <StatCard
          label="Sources"
          value={String(new Set(picks.map(p => p.source)).size)}
          sub="data providers"
        />
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Market */}
          <FilterGroup
            label="Market"
            value={market}
            options={['All', 'US', 'IN', 'UK', 'Other']}
            onChange={v => setMarket(v as typeof market)}
          />
          {/* Source type */}
          <FilterGroup
            label="Source"
            value={sourceType}
            options={['All', 'analyst', 'broker', 'community', 'screener']}
            labels={{ analyst: 'Analyst', broker: 'Broker', community: 'Community', screener: 'Screener' }}
            onChange={v => setSourceType(v as typeof sourceType)}
          />
          {/* Call type */}
          <FilterGroup
            label="Call"
            value={callFilter}
            options={['All', 'Strong', 'Buy', 'Watch']}
            labels={{ Strong: 'Strong Buy+', Buy: 'Buy', Watch: 'Watch' }}
            onChange={v => setCallFilter(v as typeof callFilter)}
          />
          {/* Days */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-xs t-muted">Period:</span>
            {([7, 14] as const).map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  days === d ? 'bg-accent/15 text-accent-light' : 't-muted hover:t-primary hover:bg-surface-hover'
                }`}
              >
                {d}d
              </button>
            ))}
            <span className="w-px h-4 bg-surface-border mx-1" />
            <span className="text-xs t-muted">Sort:</span>
            {(['date', 'ticker', 'source'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${
                  sortBy === s ? 'bg-accent/15 text-accent-light' : 't-muted hover:t-primary hover:bg-surface-hover'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Picks list */}
      {filtered.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="t-muted">No picks match your filters.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(pick => (
            <PickCard key={pick.id} pick={pick} stocks={stocks} />
          ))}
        </div>
      )}

      {/* Resources panel */}
      <ResourcesPanel showYouTube={showYouTube} onToggleYouTube={() => setShowYouTube(v => !v)} />
    </div>
  );
}

function PickCard({ pick, stocks }: { pick: OnlinePick; stocks: StockRecord[] }) {
  const priceInfo = getPriceChange(pick, stocks);
  const ago = daysAgo(pick.date);
  const callColor = CALL_TYPE_COLOR[pick.callType] ?? CALL_TYPE_COLOR['Buy'];
  const stColor = SOURCE_TYPE_COLOR[pick.sourceType] ?? SOURCE_TYPE_COLOR['community'];
  const stLabel = SOURCE_TYPE_LABEL[pick.sourceType] ?? pick.sourceType;

  return (
    <div className="card p-4 hover:border-accent/20 transition-colors">
      <div className="flex flex-wrap items-start gap-3">
        {/* Left: ticker + badges */}
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <Link
            to={`/stock/${pick.ticker}`}
            className="flex-shrink-0 w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-xs font-bold text-accent-light hover:bg-accent/20 transition-colors"
          >
            {pick.ticker.replace('.NS', '').replace('.L', '').slice(0, 4)}
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
              <Link
                to={`/stock/${pick.ticker}`}
                className="text-sm font-semibold t-primary hover:text-accent-light transition-colors"
              >
                {pick.ticker}
              </Link>
              {pick.name && (
                <span className="text-xs t-muted truncate max-w-[140px]">{pick.name}</span>
              )}
              <MarketTag market={pick.market as any} />
            </div>
            <p className="text-xs t-muted leading-relaxed">{pick.headline}</p>
          </div>
        </div>

        {/* Right: call type, source, date, price */}
        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
          {/* Call type badge */}
          <span className={`badge text-xs font-semibold ${callColor}`}>
            {pick.callType}
          </span>
          {/* Source type */}
          <span className={`badge text-xs ${stColor}`}>{stLabel}</span>
          {/* Price target */}
          {pick.priceTarget != null && (
            <span className="text-xs t-muted">
              Target: <span className="t-secondary font-medium">{pick.priceTarget.toLocaleString()}</span>
            </span>
          )}
          {/* Current price change */}
          {priceInfo && (
            <span className={`text-xs font-medium ${priceInfo.pct >= 0 ? 'text-bullish' : 'text-bearish'}`}>
              {priceInfo.pct >= 0 ? '+' : ''}{priceInfo.pct.toFixed(2)}%
            </span>
          )}
          {/* Date */}
          <span className="text-xs t-muted whitespace-nowrap">
            {ago === 0 ? 'Today' : ago === 1 ? '1d ago' : `${ago}d ago`}
          </span>
          {/* Source link */}
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

      {/* Analyst name if present */}
      {pick.analyst && (
        <div className="mt-2 ml-12 text-xs t-muted">
          by <span className="t-secondary">{pick.analyst}</span>
          {pick.date && <span> · {formatDate(pick.date)}</span>}
        </div>
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
  label, value, options, labels, onChange,
}: {
  label: string;
  value: T;
  options: T[];
  labels?: Partial<Record<T, string>>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs t-muted">{label}:</span>
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

function ResourcesPanel({ showYouTube, onToggleYouTube }: { showYouTube: boolean; onToggleYouTube: () => void }) {
  return (
    <div className="space-y-3">
      {/* Other online resources */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold t-primary mb-3">Other Online Resources</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {OTHER_RESOURCES.map(r => (
            <a
              key={r.url}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col p-2.5 rounded-lg border border-surface-border hover:border-accent/30 hover:bg-surface-hover transition-all group"
            >
              <span className="text-xs font-medium t-secondary group-hover:text-accent-light transition-colors truncate">{r.name}</span>
              <span className="text-xs t-muted mt-0.5 leading-relaxed">{r.desc}</span>
            </a>
          ))}
        </div>
      </div>

      {/* YouTube channels — collapsible */}
      <div className="card p-4">
        <button
          onClick={onToggleYouTube}
          className="flex items-center gap-2 w-full text-left"
        >
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
              Note: YouTube content is not auto-fetched due to API limitations. Visit these channels directly for their latest stock recommendations.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
