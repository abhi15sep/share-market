import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { NewsItem } from '../types';
import SentimentBar from '../components/charts/SentimentBar';

type SortKey = 'date' | 'positive' | 'negative';

function relativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export default function NewsSentiment({ news }: { news: NewsItem[] }) {
  const [filter, setFilter]   = useState<'all' | 'positive' | 'negative' | 'neutral'>('all');
  const [search, setSearch]   = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');

  const posCount  = useMemo(() => news.filter(n => n.sentimentLabel === 'positive').length, [news]);
  const negCount  = useMemo(() => news.filter(n => n.sentimentLabel === 'negative').length, [news]);
  const neutCount = useMemo(() => news.filter(n => n.sentimentLabel === 'neutral').length, [news]);
  const avgScore  = useMemo(() => news.length > 0 ? news.reduce((a, n) => a + n.sentimentScore, 0) / news.length : 0, [news]);

  // Per-ticker aggregation
  const tickerStats = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const n of news) {
      const e = map.get(n.ticker) ?? { count: 0, total: 0 };
      e.count++;
      e.total += n.sentimentScore;
      map.set(n.ticker, e);
    }
    return [...map.entries()]
      .map(([ticker, { count, total }]) => ({ ticker, count, avgScore: total / count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [news]);

  const filtered = useMemo(() => {
    let arr = news.filter(n => {
      if (filter !== 'all' && n.sentimentLabel !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!n.title.toLowerCase().includes(q) && !n.ticker.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    if (sortKey === 'positive')  arr = [...arr].sort((a, b) => b.sentimentScore - a.sentimentScore);
    else if (sortKey === 'negative') arr = [...arr].sort((a, b) => a.sentimentScore - b.sentimentScore);
    else arr = [...arr].sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
    return arr;
  }, [news, filter, search, sortKey]);

  const sentimentLabel = avgScore > 0.1 ? 'Bullish' : avgScore < -0.1 ? 'Bearish' : 'Neutral';
  const sentimentColor = avgScore > 0.1 ? 'text-bullish' : avgScore < -0.1 ? 'text-bearish' : 't-muted';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold t-primary">News & Sentiment</h1>
        <p className="text-sm t-muted mt-1">Latest headlines with AFINN sentiment scoring</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="card-flat p-3 text-center">
          <div className="text-lg font-bold font-mono t-primary">{news.length}</div>
          <div className="text-xs t-muted">Total</div>
        </div>
        <div className="card-flat p-3 text-center">
          <div className="text-lg font-bold font-mono text-bullish">{posCount}</div>
          <div className="text-xs t-muted">Positive</div>
        </div>
        <div className="card-flat p-3 text-center">
          <div className="text-lg font-bold font-mono text-bearish">{negCount}</div>
          <div className="text-xs t-muted">Negative</div>
        </div>
        <div className="card-flat p-3 text-center">
          <div className="text-lg font-bold font-mono t-secondary">{neutCount}</div>
          <div className="text-xs t-muted">Neutral</div>
        </div>
        <div className="card-flat p-3 text-center">
          <div className={`text-lg font-bold font-mono ${sentimentColor}`}>
            {avgScore > 0 ? '+' : ''}{avgScore.toFixed(2)}
          </div>
          <div className="text-xs t-muted">Avg · {sentimentLabel}</div>
        </div>
      </div>

      {/* Sentiment distribution bar */}
      {news.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold t-tertiary uppercase tracking-wider">Sentiment Distribution</span>
            <span className="text-xs t-faint">{posCount} pos · {negCount} neg · {neutCount} neutral</span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
            <div className="bg-bullish rounded-l-full transition-all" style={{ width: `${(posCount / news.length) * 100}%` }} />
            <div className="bg-surface-tertiary transition-all" style={{ width: `${(neutCount / news.length) * 100}%` }} />
            <div className="bg-bearish rounded-r-full transition-all" style={{ width: `${(negCount / news.length) * 100}%` }} />
          </div>
          <div className="flex gap-4 mt-2 text-[10px] t-faint">
            <span className="text-bullish">{((posCount / news.length) * 100).toFixed(0)}% positive</span>
            <span>{((neutCount / news.length) * 100).toFixed(0)}% neutral</span>
            <span className="text-bearish">{((negCount / news.length) * 100).toFixed(0)}% negative</span>
          </div>
        </div>
      )}

      {/* Most discussed tickers */}
      {tickerStats.length > 0 && (
        <div className="card p-4">
          <h3 className="text-xs font-semibold t-tertiary uppercase tracking-wider mb-3">Most Discussed</h3>
          <div className="flex flex-wrap gap-2">
            {tickerStats.map(({ ticker, count, avgScore: avg }) => {
              const col = avg > 0.1 ? 'text-bullish bg-bullish/10 ring-bullish/20' : avg < -0.1 ? 'text-bearish bg-bearish/10 ring-bearish/20' : 't-secondary bg-surface-hover ring-surface-border';
              return (
                <Link
                  key={ticker}
                  to={`/stock/${ticker}`}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ring-1 hover:brightness-110 transition-all ${col}`}
                >
                  <span className="text-xs font-semibold font-mono">{ticker}</span>
                  <span className="text-[10px] t-faint">{count}</span>
                  <span className={`text-[10px] font-mono ${avg > 0.1 ? 'text-bullish' : avg < -0.1 ? 'text-bearish' : 't-faint'}`}>
                    {avg > 0 ? '+' : ''}{avg.toFixed(2)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters + sort */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Search headline or ticker..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field w-56"
          />
          <div className="flex gap-1 bg-surface-tertiary rounded-lg p-1">
            {(['all', 'positive', 'negative', 'neutral'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  filter === f ? 'bg-accent/20 text-accent-light' : 't-muted hover:t-secondary'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex gap-1 ml-auto">
            {([['date', 'Newest'], ['positive', 'Most +'], ['negative', 'Most −']] as [SortKey, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setSortKey(k)}
                className={`text-xs px-2.5 py-1.5 rounded transition-colors ${
                  sortKey === k ? 'bg-accent/20 text-accent-light ring-1 ring-accent/30' : 'bg-surface-hover t-muted hover:t-secondary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-xs t-faint">{filtered.length} article{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* News list */}
      <div className="space-y-1.5">
        {filtered.length === 0 && (
          <div className="card p-12 text-center">
            <p className="t-muted">No news articles found.</p>
          </div>
        )}
        {filtered.map((item) => (
          <div
            key={`${item.ticker}-${item.title}`}
            className="card-flat px-4 py-3 flex items-start gap-4 hover:bg-surface-hover/30 transition-colors"
          >
            {/* Sentiment accent bar */}
            <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${
              item.sentimentLabel === 'positive' ? 'bg-bullish' :
              item.sentimentLabel === 'negative' ? 'bg-bearish' : 'bg-surface-border'
            }`} />

            <div className="flex-1 min-w-0">
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm t-secondary hover:text-accent-light transition-colors line-clamp-2 leading-relaxed"
              >
                {item.title}
              </a>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <Link
                  to={`/stock/${item.ticker}`}
                  className="text-xs font-semibold text-accent-light font-mono hover:underline"
                >
                  {item.ticker}
                </Link>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-hover t-faint">{item.source}</span>
                <span className="text-xs t-faint" title={new Date(item.pubDate).toLocaleDateString()}>
                  {relativeDate(item.pubDate)}
                </span>
              </div>
            </div>

            <div className="flex-shrink-0 pt-0.5">
              <SentimentBar score={item.sentimentScore} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
