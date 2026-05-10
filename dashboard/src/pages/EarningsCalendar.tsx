import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { StockRecord } from '../types';
import { ScoreBadge, MarketTag, ChangePercent } from '../components/common/Tags';
import { currencySymbol } from '../lib/format';
import MultiSelect from '../components/common/MultiSelect';

const ALL_MARKETS = ['US', 'UK', 'IN', 'HK', 'JP', 'DE', 'FR'];
const ALL_SECTORS = [
  'Communication', 'Consumer Cyclical', 'Consumer Defensive', 'Energy',
  'Financials', 'Fintech', 'Healthcare', 'Industrials', 'Materials',
  'Real Estate', 'Technology', 'Utilities',
];

/* ─── HELPERS ─── */
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

function isToday(iso: string): boolean {
  return iso === todayStr();
}

function isThisWeek(iso: string): boolean {
  const now = new Date();
  const d = new Date(iso + 'T00:00:00');
  const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff < 7;
}

function daysUntil(iso: string): number {
  const now = new Date();
  const d = new Date(iso + 'T00:00:00');
  return Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function daysAgo(iso: string): number {
  return -daysUntil(iso);
}

type ViewMode = 'upcoming' | 'recent' | 'all';
type SortKey = 'date' | 'score' | 'ticker';

/* ─── COMPONENT ─── */
export default function EarningsCalendar({ stocks }: { stocks: StockRecord[] }) {
  const [view, setView] = useState<ViewMode>('upcoming');
  const [sortBy, setSortBy] = useState<SortKey>('date');
  const [markets, setMarkets] = useState<string[]>([]);
  const [sectors, setSectors] = useState<string[]>([]);

  const today = todayStr();

  const { upcoming, recent } = useMemo(() => {
    const filtered = stocks
      .filter(s => s.earningsDate)
      .filter(s => markets.length === 0 || markets.includes(s.market))
      .filter(s => sectors.length === 0 || sectors.includes(s.sector ?? ''));

    const upcomingList = filtered.filter(s => s.earningsDate! >= today) as (StockRecord & { earningsDate: string })[];
    const recentList = filtered.filter(s => s.earningsDate! < today) as (StockRecord & { earningsDate: string })[];

    return { upcoming: upcomingList, recent: recentList };
  }, [stocks, markets, sectors, today]);

  const displayList = useMemo(() => {
    const list = view === 'upcoming' ? upcoming
      : view === 'recent' ? recent
      : [...upcoming, ...recent];
    return list;
  }, [view, upcoming, recent]);

  // Group by date, then sort within each group
  const grouped = useMemo(() => {
    const map = new Map<string, (StockRecord & { earningsDate: string })[]>();
    for (const s of displayList) {
      const date = s.earningsDate;
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(s);
    }

    // Sort within each group
    for (const [, arr] of map) {
      arr.sort((a, b) => {
        if (sortBy === 'score') return b.score.composite - a.score.composite;
        if (sortBy === 'ticker') return a.ticker.localeCompare(b.ticker);
        return 0; // date sort = insertion order (already grouped by date)
      });
    }

    // Sort date groups
    const entries = [...map.entries()];
    if (view === 'recent') {
      entries.sort((a, b) => b[0].localeCompare(a[0])); // most recent first
    } else {
      entries.sort((a, b) => a[0].localeCompare(b[0])); // earliest first
    }

    return entries;
  }, [displayList, sortBy, view]);

  const totalWithDates = useMemo(() =>
    stocks.filter(s => s.earningsDate).length,
  [stocks]);

  const anyFilterActive = markets.length > 0 || sectors.length > 0;
  const resetFilters = () => { setMarkets([]); setSectors([]); };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold t-primary">Earnings Calendar</h1>
        <p className="text-sm t-muted mt-1">
          Track upcoming and recent earnings dates for stocks in your universe. Plan trades around earnings announcements.
        </p>
      </div>

      {/* Why it matters */}
      <div className="card p-4 bg-accent/5 border-accent/15">
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium t-secondary select-none">
            <span className="text-xs t-muted group-open:rotate-90 transition-transform">&#9654;</span>
            Why it matters &amp; how to use
          </summary>
          <div className="mt-3 text-sm t-muted space-y-2">
            <p>
              Earnings announcements typically cause the <strong className="t-secondary">largest single-day price moves</strong> — stocks often gap up or down 5–20% on earnings surprises.
            </p>
            <ol className="list-decimal list-inside space-y-1.5 ml-1">
              <li><strong className="t-secondary">Reduce risk before uncertain reports</strong> — trim or hedge positions 1–2 days before earnings if you are unsure of the outcome. Never hold a full position into a binary event.</li>
              <li><strong className="t-secondary">Look for post-earnings overreactions</strong> — quality stocks (high composite score) that drop 10–15% on in-line or slightly-miss results often recover within 2–4 weeks. Use Recent tab to find these.</li>
              <li><strong className="t-secondary">Sort by Score before earnings</strong> — highest-scored stocks with upcoming earnings are the best candidates for a "buy the report" trade — only if the stock is in a confirmed uptrend.</li>
              <li><strong className="t-secondary">Never buy a stock purely for earnings</strong> — if you wouldn't own it outside of earnings, don't speculate on the report. Use this as a planning tool, not a trading signal on its own.</li>
              <li><strong className="t-secondary">Watch for gaps + volume on Recent tab</strong> — large gap moves on heavy volume after earnings often set the direction for the next 2–3 months.</li>
            </ol>
            <p className="text-xs pt-2 border-t border-surface-border">
              <strong>Best setup:</strong> Stock in uptrend (Minervini 8/8) + high composite score + upcoming earnings in 1–5 days. If it reports well, buy the first pullback after the gap rather than chasing the open.
            </p>
          </div>
        </details>
      </div>

      {/* Controls */}
      <div className="card p-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* View tabs */}
          <div className="flex gap-0.5 bg-surface-tertiary rounded-lg p-0.5">
            {([['upcoming', 'Upcoming'], ['recent', 'Recent'], ['all', 'All']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  view === key ? 'bg-accent/20 text-accent-light' : 't-muted hover:t-secondary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-surface-border" />

          {/* Sort tabs */}
          <div className="flex gap-0.5 bg-surface-tertiary rounded-lg p-0.5">
            {([['date', 'By Date'], ['score', 'By Score'], ['ticker', 'By Ticker']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  sortBy === key ? 'bg-accent/20 text-accent-light' : 't-muted hover:t-secondary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-surface-border" />

          <MultiSelect label="Market" options={ALL_MARKETS} selected={markets} onChange={setMarkets} activeClass="bg-accent/15 text-accent-light ring-1 ring-accent/30" />
          <MultiSelect label="Sector" options={ALL_SECTORS} selected={sectors} onChange={setSectors} activeClass="bg-accent/15 text-accent-light ring-1 ring-accent/30" />

          <span className="ml-auto badge bg-surface-tertiary t-secondary ring-1 ring-surface-border text-xs">
            {displayList.length} of {totalWithDates} stocks
          </span>

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

      {/* Calendar grouped view */}
      {grouped.length > 0 ? (
        <div className="space-y-3">
          {grouped.map(([date, dateStocks]) => {
            const past = date < today;
            const days = past ? daysAgo(date) : daysUntil(date);
            return (
              <div key={date} className="card overflow-hidden">
                {/* Date header */}
                <div className={`px-4 py-2.5 border-b border-surface-border flex items-center gap-2.5 flex-wrap ${
                  isToday(date)
                    ? 'bg-accent/10'
                    : isThisWeek(date)
                    ? 'bg-bullish/5'
                    : past
                    ? 'bg-surface-tertiary/20'
                    : 'bg-surface-tertiary/30'
                }`}>
                  <span className={`text-sm font-semibold ${isToday(date) ? 'text-accent-light' : 't-primary'}`}>
                    {formatDate(date)}
                  </span>
                  {isToday(date) && (
                    <span className="badge bg-accent/20 text-accent-light text-[10px] px-1.5 py-0.5 font-bold">TODAY</span>
                  )}
                  {!isToday(date) && isThisWeek(date) && (
                    <span className="badge bg-bullish/15 text-bullish text-[10px] px-1.5 py-0.5 font-bold">THIS WEEK</span>
                  )}
                  {!past && !isThisWeek(date) && days <= 30 && (
                    <span className="text-xs t-muted">in {days}d</span>
                  )}
                  {past && days <= 7 && (
                    <span className="text-xs t-muted">{days}d ago</span>
                  )}
                  <span className="text-xs t-muted">{dateStocks.length} stock{dateStocks.length !== 1 ? 's' : ''}</span>
                </div>

                {/* Stock rows */}
                <div className="divide-y divide-surface-border/40">
                  {dateStocks.map(s => (
                    <Link
                      key={s.ticker}
                      to={`/stock/${s.ticker}`}
                      className="px-4 py-2.5 flex items-center gap-3 hover:bg-surface-hover/40 transition-colors"
                    >
                      <span className="font-bold text-sm text-accent-light w-20 flex-shrink-0 truncate">
                        {s.ticker}
                      </span>
                      <span className="text-xs t-muted truncate flex-1 min-w-0">{s.name}</span>
                      <MarketTag market={s.market} />
                      <div className="w-16 flex-shrink-0 text-right">
                        <ChangePercent value={s.changePercent} />
                      </div>
                      <div className="flex-shrink-0">
                        <ScoreBadge score={s.score.composite} />
                      </div>
                      <div className="w-20 flex-shrink-0 text-right">
                        <span className="font-mono tabular-nums text-xs t-secondary">
                          {currencySymbol(s.market)}{s.price.toFixed(2)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <p className="t-muted text-sm">
            {view === 'upcoming'
              ? 'No upcoming earnings dates found.'
              : 'No earnings dates found for this view.'}
          </p>
        </div>
      )}
    </div>
  );
}
