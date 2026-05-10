import { useMemo, useState } from 'react';

interface EconomicEvent {
  date: string;
  name: string;
  category: 'fed' | 'inflation' | 'jobs' | 'gdp' | 'earnings' | 'other';
  impact: 'high' | 'medium' | 'low';
  description: string;
}

const EVENTS: EconomicEvent[] = [
  // ── FOMC 2025 ──
  { date: '2025-01-29', name: 'FOMC Rate Decision', category: 'fed', impact: 'high', description: 'Federal Reserve interest rate decision and statement' },
  { date: '2025-03-19', name: 'FOMC Rate Decision', category: 'fed', impact: 'high', description: 'Federal Reserve interest rate decision and statement' },
  { date: '2025-05-07', name: 'FOMC Rate Decision', category: 'fed', impact: 'high', description: 'Federal Reserve interest rate decision and statement' },
  { date: '2025-06-18', name: 'FOMC Rate Decision', category: 'fed', impact: 'high', description: 'Federal Reserve interest rate decision and statement' },
  { date: '2025-07-30', name: 'FOMC Rate Decision', category: 'fed', impact: 'high', description: 'Federal Reserve interest rate decision and statement' },
  { date: '2025-09-17', name: 'FOMC Rate Decision', category: 'fed', impact: 'high', description: 'Federal Reserve interest rate decision and statement' },
  { date: '2025-10-29', name: 'FOMC Rate Decision', category: 'fed', impact: 'high', description: 'Federal Reserve interest rate decision and statement' },
  { date: '2025-12-17', name: 'FOMC Rate Decision', category: 'fed', impact: 'high', description: 'Federal Reserve interest rate decision and statement' },
  // ── FOMC 2026 ──
  { date: '2026-01-28', name: 'FOMC Rate Decision', category: 'fed', impact: 'high', description: 'Federal Reserve interest rate decision and statement' },
  { date: '2026-03-18', name: 'FOMC Rate Decision', category: 'fed', impact: 'high', description: 'Federal Reserve interest rate decision and statement' },
  { date: '2026-05-06', name: 'FOMC Rate Decision', category: 'fed', impact: 'high', description: 'Federal Reserve interest rate decision and statement' },
  { date: '2026-06-17', name: 'FOMC Rate Decision', category: 'fed', impact: 'high', description: 'Federal Reserve interest rate decision and statement' },
  { date: '2026-07-29', name: 'FOMC Rate Decision', category: 'fed', impact: 'high', description: 'Federal Reserve interest rate decision and statement' },
  { date: '2026-09-16', name: 'FOMC Rate Decision', category: 'fed', impact: 'high', description: 'Federal Reserve interest rate decision and statement' },
  { date: '2026-10-28', name: 'FOMC Rate Decision', category: 'fed', impact: 'high', description: 'Federal Reserve interest rate decision and statement' },
  { date: '2026-12-09', name: 'FOMC Rate Decision', category: 'fed', impact: 'high', description: 'Federal Reserve interest rate decision and statement' },

  // ── CPI 2025 ──
  { date: '2025-02-12', name: 'CPI Report', category: 'inflation', impact: 'high', description: 'Consumer Price Index — key inflation gauge watched by the Fed' },
  { date: '2025-03-12', name: 'CPI Report', category: 'inflation', impact: 'high', description: 'Consumer Price Index — key inflation gauge watched by the Fed' },
  { date: '2025-04-10', name: 'CPI Report', category: 'inflation', impact: 'high', description: 'Consumer Price Index — key inflation gauge watched by the Fed' },
  { date: '2025-05-13', name: 'CPI Report', category: 'inflation', impact: 'high', description: 'Consumer Price Index — key inflation gauge watched by the Fed' },
  { date: '2025-06-11', name: 'CPI Report', category: 'inflation', impact: 'high', description: 'Consumer Price Index — key inflation gauge watched by the Fed' },
  { date: '2025-07-11', name: 'CPI Report', category: 'inflation', impact: 'high', description: 'Consumer Price Index — key inflation gauge watched by the Fed' },
  { date: '2025-08-12', name: 'CPI Report', category: 'inflation', impact: 'high', description: 'Consumer Price Index — key inflation gauge watched by the Fed' },
  { date: '2025-09-10', name: 'CPI Report', category: 'inflation', impact: 'high', description: 'Consumer Price Index — key inflation gauge watched by the Fed' },
  { date: '2025-10-14', name: 'CPI Report', category: 'inflation', impact: 'high', description: 'Consumer Price Index — key inflation gauge watched by the Fed' },
  { date: '2025-11-12', name: 'CPI Report', category: 'inflation', impact: 'high', description: 'Consumer Price Index — key inflation gauge watched by the Fed' },
  { date: '2025-12-10', name: 'CPI Report', category: 'inflation', impact: 'high', description: 'Consumer Price Index — key inflation gauge watched by the Fed' },
  // ── CPI 2026 ──
  { date: '2026-01-13', name: 'CPI Report', category: 'inflation', impact: 'high', description: 'Consumer Price Index — key inflation gauge watched by the Fed' },
  { date: '2026-02-11', name: 'CPI Report', category: 'inflation', impact: 'high', description: 'Consumer Price Index — key inflation gauge watched by the Fed' },
  { date: '2026-03-11', name: 'CPI Report', category: 'inflation', impact: 'high', description: 'Consumer Price Index — key inflation gauge watched by the Fed' },
  { date: '2026-04-10', name: 'CPI Report', category: 'inflation', impact: 'high', description: 'Consumer Price Index — key inflation gauge watched by the Fed' },
  { date: '2026-05-13', name: 'CPI Report', category: 'inflation', impact: 'high', description: 'Consumer Price Index — key inflation gauge watched by the Fed' },
  { date: '2026-06-10', name: 'CPI Report', category: 'inflation', impact: 'high', description: 'Consumer Price Index — key inflation gauge watched by the Fed' },
  { date: '2026-07-14', name: 'CPI Report', category: 'inflation', impact: 'high', description: 'Consumer Price Index — key inflation gauge watched by the Fed' },
  { date: '2026-08-12', name: 'CPI Report', category: 'inflation', impact: 'high', description: 'Consumer Price Index — key inflation gauge watched by the Fed' },
  { date: '2026-09-09', name: 'CPI Report', category: 'inflation', impact: 'high', description: 'Consumer Price Index — key inflation gauge watched by the Fed' },
  { date: '2026-10-14', name: 'CPI Report', category: 'inflation', impact: 'high', description: 'Consumer Price Index — key inflation gauge watched by the Fed' },
  { date: '2026-11-12', name: 'CPI Report', category: 'inflation', impact: 'high', description: 'Consumer Price Index — key inflation gauge watched by the Fed' },
  { date: '2026-12-09', name: 'CPI Report', category: 'inflation', impact: 'high', description: 'Consumer Price Index — key inflation gauge watched by the Fed' },

  // ── NFP 2025 ──
  { date: '2025-02-07', name: 'Non-Farm Payrolls', category: 'jobs', impact: 'high', description: 'Monthly jobs report — total employment and wage growth' },
  { date: '2025-03-07', name: 'Non-Farm Payrolls', category: 'jobs', impact: 'high', description: 'Monthly jobs report — total employment and wage growth' },
  { date: '2025-04-04', name: 'Non-Farm Payrolls', category: 'jobs', impact: 'high', description: 'Monthly jobs report — total employment and wage growth' },
  { date: '2025-05-02', name: 'Non-Farm Payrolls', category: 'jobs', impact: 'high', description: 'Monthly jobs report — total employment and wage growth' },
  { date: '2025-06-06', name: 'Non-Farm Payrolls', category: 'jobs', impact: 'high', description: 'Monthly jobs report — total employment and wage growth' },
  { date: '2025-07-03', name: 'Non-Farm Payrolls', category: 'jobs', impact: 'high', description: 'Monthly jobs report — total employment and wage growth' },
  { date: '2025-08-01', name: 'Non-Farm Payrolls', category: 'jobs', impact: 'high', description: 'Monthly jobs report — total employment and wage growth' },
  { date: '2025-09-05', name: 'Non-Farm Payrolls', category: 'jobs', impact: 'high', description: 'Monthly jobs report — total employment and wage growth' },
  { date: '2025-10-03', name: 'Non-Farm Payrolls', category: 'jobs', impact: 'high', description: 'Monthly jobs report — total employment and wage growth' },
  { date: '2025-11-07', name: 'Non-Farm Payrolls', category: 'jobs', impact: 'high', description: 'Monthly jobs report — total employment and wage growth' },
  { date: '2025-12-05', name: 'Non-Farm Payrolls', category: 'jobs', impact: 'high', description: 'Monthly jobs report — total employment and wage growth' },
  // ── NFP 2026 ──
  { date: '2026-01-09', name: 'Non-Farm Payrolls', category: 'jobs', impact: 'high', description: 'Monthly jobs report — total employment and wage growth' },
  { date: '2026-02-06', name: 'Non-Farm Payrolls', category: 'jobs', impact: 'high', description: 'Monthly jobs report — total employment and wage growth' },
  { date: '2026-03-06', name: 'Non-Farm Payrolls', category: 'jobs', impact: 'high', description: 'Monthly jobs report — total employment and wage growth' },
  { date: '2026-04-03', name: 'Non-Farm Payrolls', category: 'jobs', impact: 'high', description: 'Monthly jobs report — total employment and wage growth' },
  { date: '2026-05-08', name: 'Non-Farm Payrolls', category: 'jobs', impact: 'high', description: 'Monthly jobs report — total employment and wage growth' },
  { date: '2026-06-05', name: 'Non-Farm Payrolls', category: 'jobs', impact: 'high', description: 'Monthly jobs report — total employment and wage growth' },
  { date: '2026-07-02', name: 'Non-Farm Payrolls', category: 'jobs', impact: 'high', description: 'Monthly jobs report — total employment and wage growth' },
  { date: '2026-08-07', name: 'Non-Farm Payrolls', category: 'jobs', impact: 'high', description: 'Monthly jobs report — total employment and wage growth' },
  { date: '2026-09-04', name: 'Non-Farm Payrolls', category: 'jobs', impact: 'high', description: 'Monthly jobs report — total employment and wage growth' },
  { date: '2026-10-02', name: 'Non-Farm Payrolls', category: 'jobs', impact: 'high', description: 'Monthly jobs report — total employment and wage growth' },
  { date: '2026-11-06', name: 'Non-Farm Payrolls', category: 'jobs', impact: 'high', description: 'Monthly jobs report — total employment and wage growth' },
  { date: '2026-12-04', name: 'Non-Farm Payrolls', category: 'jobs', impact: 'high', description: 'Monthly jobs report — total employment and wage growth' },

  // ── GDP 2025 ──
  { date: '2025-01-30', name: 'GDP (Q4 Advance)', category: 'gdp', impact: 'medium', description: 'Advance estimate of Q4 2024 GDP growth rate' },
  { date: '2025-03-27', name: 'GDP (Q4 Final)', category: 'gdp', impact: 'medium', description: 'Final estimate of Q4 2024 GDP growth rate' },
  { date: '2025-04-30', name: 'GDP (Q1 Advance)', category: 'gdp', impact: 'medium', description: 'Advance estimate of Q1 2025 GDP growth rate' },
  { date: '2025-06-26', name: 'GDP (Q1 Final)', category: 'gdp', impact: 'medium', description: 'Final estimate of Q1 2025 GDP growth rate' },
  { date: '2025-07-30', name: 'GDP (Q2 Advance)', category: 'gdp', impact: 'medium', description: 'Advance estimate of Q2 2025 GDP growth rate' },
  { date: '2025-09-25', name: 'GDP (Q2 Final)', category: 'gdp', impact: 'medium', description: 'Final estimate of Q2 2025 GDP growth rate' },
  { date: '2025-10-30', name: 'GDP (Q3 Advance)', category: 'gdp', impact: 'medium', description: 'Advance estimate of Q3 2025 GDP growth rate' },
  { date: '2025-12-18', name: 'GDP (Q3 Final)', category: 'gdp', impact: 'medium', description: 'Final estimate of Q3 2025 GDP growth rate' },
  // ── GDP 2026 ──
  { date: '2026-01-29', name: 'GDP (Q4 Advance)', category: 'gdp', impact: 'medium', description: 'Advance estimate of Q4 2025 GDP growth rate' },
  { date: '2026-03-26', name: 'GDP (Q4 Final)', category: 'gdp', impact: 'medium', description: 'Final estimate of Q4 2025 GDP growth rate' },
  { date: '2026-04-29', name: 'GDP (Q1 Advance)', category: 'gdp', impact: 'medium', description: 'Advance estimate of Q1 2026 GDP growth rate' },
  { date: '2026-06-25', name: 'GDP (Q1 Final)', category: 'gdp', impact: 'medium', description: 'Final estimate of Q1 2026 GDP growth rate' },
  { date: '2026-07-29', name: 'GDP (Q2 Advance)', category: 'gdp', impact: 'medium', description: 'Advance estimate of Q2 2026 GDP growth rate' },
  { date: '2026-09-24', name: 'GDP (Q2 Final)', category: 'gdp', impact: 'medium', description: 'Final estimate of Q2 2026 GDP growth rate' },
  { date: '2026-10-29', name: 'GDP (Q3 Advance)', category: 'gdp', impact: 'medium', description: 'Advance estimate of Q3 2026 GDP growth rate' },
  { date: '2026-12-17', name: 'GDP (Q3 Final)', category: 'gdp', impact: 'medium', description: 'Final estimate of Q3 2026 GDP growth rate' },

  // ── Earnings seasons ──
  { date: '2025-01-13', name: 'Earnings Season Begins', category: 'earnings', impact: 'medium', description: 'Q4 2024 earnings season kicks off — major banks report first' },
  { date: '2025-04-14', name: 'Earnings Season Begins', category: 'earnings', impact: 'medium', description: 'Q1 2025 earnings season kicks off — banks lead' },
  { date: '2025-07-14', name: 'Earnings Season Begins', category: 'earnings', impact: 'medium', description: 'Q2 2025 earnings season kicks off — banks lead' },
  { date: '2025-10-13', name: 'Earnings Season Begins', category: 'earnings', impact: 'medium', description: 'Q3 2025 earnings season kicks off — banks lead' },
  { date: '2026-01-12', name: 'Earnings Season Begins', category: 'earnings', impact: 'medium', description: 'Q4 2025 earnings season kicks off — banks lead' },
  { date: '2026-04-13', name: 'Earnings Season Begins', category: 'earnings', impact: 'medium', description: 'Q1 2026 earnings season kicks off — banks lead' },
  { date: '2026-07-13', name: 'Earnings Season Begins', category: 'earnings', impact: 'medium', description: 'Q2 2026 earnings season kicks off — banks lead' },
  { date: '2026-10-12', name: 'Earnings Season Begins', category: 'earnings', impact: 'medium', description: 'Q3 2026 earnings season kicks off — banks lead' },

  // ── Quad Witching ──
  { date: '2025-03-21', name: 'Quad Witching', category: 'other', impact: 'medium', description: 'Quarterly expiration of stock options, index options, index futures & stock futures — high volatility expected' },
  { date: '2025-06-20', name: 'Quad Witching', category: 'other', impact: 'medium', description: 'Quarterly expiration of stock options, index options, index futures & stock futures — high volatility expected' },
  { date: '2025-09-19', name: 'Quad Witching', category: 'other', impact: 'medium', description: 'Quarterly expiration of stock options, index options, index futures & stock futures — high volatility expected' },
  { date: '2025-12-19', name: 'Quad Witching', category: 'other', impact: 'medium', description: 'Quarterly expiration of stock options, index options, index futures & stock futures — high volatility expected' },
  { date: '2026-03-20', name: 'Quad Witching', category: 'other', impact: 'medium', description: 'Quarterly expiration of stock options, index options, index futures & stock futures — high volatility expected' },
  { date: '2026-06-19', name: 'Quad Witching', category: 'other', impact: 'medium', description: 'Quarterly expiration of stock options, index options, index futures & stock futures — high volatility expected' },
  { date: '2026-09-18', name: 'Quad Witching', category: 'other', impact: 'medium', description: 'Quarterly expiration of stock options, index options, index futures & stock futures — high volatility expected' },
  { date: '2026-12-18', name: 'Quad Witching', category: 'other', impact: 'medium', description: 'Quarterly expiration of stock options, index options, index futures & stock futures — high volatility expected' },

  // ── Jackson Hole ──
  { date: '2025-08-21', name: 'Jackson Hole Symposium', category: 'fed', impact: 'high', description: 'Fed Chair speech — major policy signal opportunity, often market-moving' },
  { date: '2026-08-20', name: 'Jackson Hole Symposium', category: 'fed', impact: 'high', description: 'Fed Chair speech — major policy signal opportunity, often market-moving' },
];

type Category = 'all' | 'fed' | 'inflation' | 'jobs' | 'gdp' | 'earnings' | 'other';

const CATEGORY_META: Record<string, { bg: string; text: string; border: string; label: string }> = {
  fed:       { bg: 'bg-red-500/15',    text: 'text-red-400',    border: 'border-red-500/30',    label: 'Fed' },
  inflation: { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30', label: 'Inflation' },
  jobs:      { bg: 'bg-blue-500/15',   text: 'text-blue-400',   border: 'border-blue-500/30',   label: 'Jobs' },
  gdp:       { bg: 'bg-green-500/15',  text: 'text-green-400',  border: 'border-green-500/30',  label: 'GDP' },
  earnings:  { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30', label: 'Earnings' },
  other:     { bg: 'bg-gray-500/15',   text: 'text-gray-400',   border: 'border-gray-500/30',   label: 'Other' },
};

const FILTER_TABS: { key: Category; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'fed', label: 'Fed' },
  { key: 'inflation', label: 'Inflation' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'gdp', label: 'GDP' },
  { key: 'earnings', label: 'Earnings' },
  { key: 'other', label: 'Other' },
];

function formatDate(date: string): string {
  const d = new Date(date + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function daysLabel(date: string, today: string): string {
  const diff = Math.round((new Date(date + 'T12:00:00').getTime() - new Date(today + 'T12:00:00').getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 0) return `${diff} days`;
  return `${-diff}d ago`;
}

export default function EconomicCalendar() {
  const today = new Date().toISOString().slice(0, 10);
  const [activeCategory, setActiveCategory] = useState<Category>('all');

  const { upcoming, past } = useMemo(() => {
    const filtered = activeCategory === 'all'
      ? EVENTS
      : EVENTS.filter(e => e.category === activeCategory);

    const sorted = [...filtered].sort((a, b) => a.date.localeCompare(b.date));
    return {
      upcoming: sorted.filter(e => e.date >= today),
      past: sorted.filter(e => e.date < today).reverse(),
    };
  }, [today, activeCategory]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold t-primary">Economic Calendar</h1>
        <p className="text-sm t-muted mt-1">Key market-moving events: FOMC, CPI, NFP, GDP, and earnings seasons</p>
      </div>

      {/* How to use */}
      <div className="card p-4 bg-accent/5 border-accent/15">
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium t-secondary select-none">
            <span className="text-xs t-muted group-open:rotate-90 transition-transform">&#9654;</span>
            How to use this calendar
          </summary>
          <div className="mt-3 text-sm t-muted space-y-2">
            <ol className="list-decimal list-inside space-y-1.5 ml-1">
              <li><strong className="t-secondary">FOMC beats everything</strong> — reduce or hedge positions 1–2 days before; the market can swing 1–3% on the statement wording alone. Rate decisions are the single highest-impact macro event.</li>
              <li><strong className="t-secondary">CPI + FOMC within a week = double risk</strong> — when a CPI print lands a few days before an FOMC meeting, volatility compounds. Avoid holding large positions through both.</li>
              <li><strong className="t-secondary">NFP: watch the reaction, not just the number</strong> — a strong jobs print that sends bond yields up can actually hurt growth stocks. Wait 15–30 minutes after release before acting.</li>
              <li><strong className="t-secondary">GDP is a lagging indicator</strong> — markets usually price in GDP trends weeks in advance. The Advance estimate (first release) matters most; Final revisions rarely move markets.</li>
              <li><strong className="t-secondary">Quad Witching = forced flows, not fundamentals</strong> — large moves on Quad Witching days are often reversed the following week. Don't chase breakouts on those dates.</li>
            </ol>
            <p className="text-xs pt-2 border-t border-surface-border">
              <strong>Rule of thumb:</strong> 3–5 days before a high-impact event, trim positions by 25–50%. After the event, re-enter once the direction is confirmed — the post-event trend usually persists for 1–2 weeks.
            </p>
          </div>
        </details>
      </div>

      {/* Category filter tabs */}
      <div className="card p-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTER_TABS.map(({ key, label }) => {
            const meta = key !== 'all' ? CATEGORY_META[key] : null;
            const isActive = activeCategory === key;
            return (
              <button
                key={key}
                onClick={() => setActiveCategory(key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isActive && meta
                    ? `${meta.bg} ${meta.text} ring-1 ${meta.border}`
                    : isActive
                    ? 'bg-accent/15 text-accent-light ring-1 ring-accent/30'
                    : 'bg-surface-tertiary t-tertiary hover:t-secondary'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Upcoming Events */}
      {upcoming.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-border bg-surface-tertiary/30">
            <h2 className="text-xs font-semibold t-tertiary uppercase tracking-wider">Upcoming Events</h2>
          </div>
          <div className="divide-y divide-surface-border/50">
            {upcoming.map((event, i) => {
              const cat = CATEGORY_META[event.category];
              const isToday = event.date === today;
              const dl = daysLabel(event.date, today);
              return (
                <div key={i} className={`flex items-start gap-4 px-4 py-3 transition-colors ${
                  isToday ? 'bg-accent/5' : 'hover:bg-surface-hover/30'
                }`}>
                  {/* Date */}
                  <div className="w-36 flex-shrink-0 pt-0.5">
                    <p className={`text-xs font-semibold ${isToday ? 'text-accent-light' : 't-secondary'}`}>
                      {formatDate(event.date)}
                    </p>
                  </div>

                  {/* Category badge */}
                  <span className={`mt-0.5 flex-shrink-0 badge text-[10px] px-1.5 py-0.5 ${cat.bg} ${cat.text}`}>
                    {cat.label}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold t-primary leading-snug">{event.name}</p>
                    <p className="text-xs t-muted mt-0.5 leading-snug">{event.description}</p>
                  </div>

                  {/* Days until + impact */}
                  <div className="flex-shrink-0 flex items-center gap-2 pt-0.5">
                    <span className={`text-xs font-mono tabular-nums font-medium ${
                      isToday ? 'text-accent-light' : dl === 'Tomorrow' ? 'text-amber-400' : 't-muted'
                    }`}>
                      {dl}
                    </span>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      event.impact === 'high' ? 'bg-red-400' : event.impact === 'medium' ? 'bg-yellow-400' : 'bg-gray-500'
                    }`} title={`${event.impact} impact`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Events */}
      {past.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-border bg-surface-tertiary/30">
            <h2 className="text-xs font-semibold t-tertiary uppercase tracking-wider">Recent Events</h2>
          </div>
          <div className="divide-y divide-surface-border/40">
            {past.slice(0, 15).map((event, i) => {
              const cat = CATEGORY_META[event.category];
              return (
                <div key={i} className="flex items-center gap-4 px-4 py-2.5 opacity-60 hover:opacity-100 transition-opacity">
                  <div className="w-36 flex-shrink-0">
                    <p className="text-xs t-muted">{formatDate(event.date)}</p>
                  </div>
                  <span className={`flex-shrink-0 badge text-[10px] px-1.5 py-0.5 ${cat.bg} ${cat.text}`}>
                    {cat.label}
                  </span>
                  <p className="text-sm t-secondary flex-1 truncate">{event.name}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {upcoming.length === 0 && past.length === 0 && (
        <div className="card p-12 text-center">
          <p className="t-muted text-sm">No events found for this category.</p>
        </div>
      )}
    </div>
  );
}
