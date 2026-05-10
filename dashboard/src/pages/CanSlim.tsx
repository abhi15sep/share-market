import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { StockRecord, Metadata } from '../types';
import { ScoreBadge, MarketTag, CapTag } from '../components/common/Tags';
import MultiSelect from '../components/common/MultiSelect';

/* ─── CAN SLIM CRITERIA ─── */
interface SlimResult {
  stock: StockRecord;
  checks: { key: string; label: string; pass: boolean; detail: string }[];
  passed: number;
  total: number;
}

function evaluateCanSlim(s: StockRecord, regimeOk: boolean): SlimResult {
  const checks = [
    {
      key: 'C',
      label: 'C — Current Earnings',
      pass: s.earningsGrowth != null && s.earningsGrowth >= 0.25,
      detail: s.earningsGrowth != null
        ? `EPS Growth: ${(s.earningsGrowth * 100).toFixed(0)}% (need 25%+)`
        : 'EPS growth data unavailable',
    },
    {
      key: 'A',
      label: 'A — Annual Earnings',
      pass: (s.piotroskiScore ?? 0) >= 5 && s.returnOnEquity != null && s.returnOnEquity > 0.15,
      detail: `Piotroski ${s.piotroskiScore ?? 'N/A'}/9, ROE ${s.returnOnEquity != null ? (s.returnOnEquity * 100).toFixed(1) + '%' : 'N/A'} (proxy for consistent annual growth)`,
    },
    {
      key: 'N',
      label: 'N — New High',
      pass: s.fiftyTwoWeekRangePercent >= 80,
      detail: `52W Range: ${s.fiftyTwoWeekRangePercent}% (near new high = 80%+)`,
    },
    {
      key: 'S',
      label: 'S — Supply & Demand',
      pass: s.volumeRatio >= 1.2 && s.changePercent > 0,
      detail: `Vol Ratio: ${s.volumeRatio.toFixed(1)}x, Change: ${s.changePercent >= 0 ? '+' : ''}${s.changePercent.toFixed(1)}% (need above-avg volume on up days)`,
    },
    {
      key: 'L',
      label: 'L — Leader',
      pass: s.rsPercentile >= 80,
      detail: `RS Percentile: ${s.rsPercentile} (need 80+)`,
    },
    {
      key: 'I',
      label: 'I — Institutional Sponsorship',
      pass: s.heldPercentInstitutions != null && s.heldPercentInstitutions >= 0.2 && s.heldPercentInstitutions <= 0.9,
      detail: s.heldPercentInstitutions != null
        ? `Inst. Ownership: ${(s.heldPercentInstitutions * 100).toFixed(0)}% (need 20-90%)`
        : 'Institutional data unavailable',
    },
    {
      key: 'M',
      label: 'M — Market Direction',
      pass: regimeOk,
      detail: regimeOk ? 'Market regime is bullish' : 'Market regime is not bullish (correction/bear)',
    },
  ];

  return {
    stock: s,
    checks,
    passed: checks.filter(c => c.pass).length,
    total: checks.length,
  };
}

const ALL_MARKETS = ['US', 'UK', 'IN', 'HK', 'JP', 'DE', 'FR'];
const ALL_CAPS = ['Large', 'Mid', 'Small'];
const ALL_SECTORS = [
  'Communication', 'Consumer Cyclical', 'Consumer Defensive', 'Energy',
  'Financials', 'Fintech', 'Healthcare', 'Industrials', 'Materials',
  'Real Estate', 'Technology', 'Utilities',
];

type SortKey = 'passed' | 'rs' | 'changePercent' | 'score' | 'marketCap';

function isSpeculative(s: StockRecord): boolean {
  return s.earningsGrowth == null && (s.returnOnEquity == null || s.returnOnEquity < 0);
}

export default function CanSlim({ stocks, metadata }: { stocks: StockRecord[]; metadata: Metadata | null }) {
  const [minPassing, setMinPassing] = useState(5);
  const [markets, setMarkets] = useState<string[]>([]);
  const [caps, setCaps] = useState<string[]>([]);
  const [sectors, setSectors] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortKey>('passed');
  const regimeOk = metadata?.marketRegime?.overall === 'bull';

  const results = useMemo(() => {
    return stocks
      .map(s => evaluateCanSlim(s, regimeOk))
      .filter(r => r.passed >= minPassing)
      .filter(r => markets.length === 0 || markets.includes(r.stock.market))
      .filter(r => caps.length === 0 || caps.includes(r.stock.capCategory))
      .filter(r => sectors.length === 0 || sectors.includes(r.stock.sector ?? ''))
      .sort((a, b) => {
        switch (sortBy) {
          case 'passed': return b.passed - a.passed || b.stock.rsPercentile - a.stock.rsPercentile;
          case 'rs': return b.stock.rsPercentile - a.stock.rsPercentile;
          case 'changePercent': return b.stock.changePercent - a.stock.changePercent;
          case 'score': return b.stock.score.composite - a.stock.score.composite;
          case 'marketCap': return b.stock.marketCap - a.stock.marketCap;
          default: return 0;
        }
      });
  }, [stocks, regimeOk, minPassing, markets, caps, sectors, sortBy]);

  const anyFilterActive = markets.length > 0 || caps.length > 0 || sectors.length > 0 || minPassing !== 5 || sortBy !== 'passed';

  const resetFilters = () => {
    setMarkets([]); setCaps([]); setSectors([]); setMinPassing(5); setSortBy('passed');
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold t-primary">CAN SLIM Screen</h1>
        <p className="text-sm t-muted mt-1">
          William O'Neil's 7-point growth stock methodology. Stocks passing {minPassing}+ criteria out of 7.
        </p>
      </div>

      {/* Bear market warning */}
      {!regimeOk && (
        <div className="card p-3 bg-bearish/5 border-bearish/20 flex items-start gap-3">
          <span className="text-bearish text-lg leading-none mt-0.5">⚠</span>
          <div className="text-sm">
            <span className="font-semibold text-bearish">Market in correction/bear phase</span>
            <span className="t-muted"> — M criterion fails for all stocks. Maximum achievable score is 6/7. O'Neil's rule: don't buy growth stocks against the market trend.</span>
          </div>
        </div>
      )}

      {/* Description */}
      <div className="card p-4 bg-accent/5 border-accent/15">
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium t-secondary select-none">
            <span className="text-xs t-muted group-open:rotate-90 transition-transform">&#9654;</span>
            What is CAN SLIM?
          </summary>
          <div className="mt-3 text-sm t-muted space-y-2">
            <p><strong className="t-secondary">CAN SLIM</strong> is a growth investing strategy by William O'Neil. Each letter represents a criterion:</p>
            <ul className="space-y-1 ml-1">
              <li><strong className="t-secondary">C</strong> — Current quarterly EPS growth 25%+</li>
              <li><strong className="t-secondary">A</strong> — Annual earnings quality (Piotroski 5+ &amp; ROE 15%+)</li>
              <li><strong className="t-secondary">N</strong> — New price high (near 52-week high, 80%+ of range)</li>
              <li><strong className="t-secondary">S</strong> — Supply &amp; demand (above-avg volume on up days)</li>
              <li><strong className="t-secondary">L</strong> — Leader (RS Percentile 80+)</li>
              <li><strong className="t-secondary">I</strong> — Institutional sponsorship (20–90% inst. ownership)</li>
              <li><strong className="t-secondary">M</strong> — Market direction (bull regime)</li>
            </ul>
            <p>The more criteria passed, the stronger the candidate. <strong className="t-secondary">6/7 or 7/7</strong> in a bull market is the ideal setup.</p>
          </div>
        </details>
      </div>

      {/* How to use */}
      <div className="card p-4 bg-accent/5 border-accent/15">
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium t-secondary select-none">
            <span className="text-xs t-muted group-open:rotate-90 transition-transform">&#9654;</span>
            How to use this page
          </summary>
          <div className="mt-3 text-sm t-muted space-y-2">
            <ol className="list-decimal list-inside space-y-1.5 ml-1">
              <li><strong className="t-secondary">Wait for M (bull market)</strong> — O'Neil was firm: 75% of stocks follow the market. Never fight the M criterion; use this screen as a watchlist and act when M turns green.</li>
              <li><strong className="t-secondary">Target 6/7 or 7/7</strong> — stocks with 4–5 passes are candidates to watch, not to buy. At least 6 criteria must align for a real CAN SLIM setup.</li>
              <li><strong className="t-secondary">C and A are the most important</strong> — earnings are the engine. Skip stocks where both C and A fail, even if price and momentum look good.</li>
              <li><strong className="t-secondary">Avoid "Speculative" badges</strong> — stocks with no earnings data and negative ROE are momentum plays, not CAN SLIM stocks. Treat them separately.</li>
              <li><strong className="t-secondary">Never chase Strong Move stocks</strong> — a stock up 20–34% in a day has already moved; wait for it to base for 3–6 weeks before entering.</li>
            </ol>
            <p className="text-xs pt-2 border-t border-surface-border">
              <strong>Best setup:</strong> C ✓ + A ✓ + L (RS 90+) + M ✓ (bull market) = O'Neil's ideal. Filter to 6/7+ in a bull market, sort by RS Percentile, then check for a tight consolidation base on the chart.
            </p>
          </div>
        </details>
      </div>

      {/* Filters */}
      <div className="card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium t-muted">Min passing:</span>
          <div className="flex items-center gap-1">
            {[4, 5, 6, 7].map(n => (
              <button
                key={n}
                onClick={() => setMinPassing(n)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  minPassing === n
                    ? 'bg-accent/15 text-accent-light ring-1 ring-accent/30'
                    : 'bg-surface-tertiary t-tertiary hover:t-secondary'
                }`}
              >
                {n}/7
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-surface-border" />

          <MultiSelect label="Market" options={ALL_MARKETS} selected={markets} onChange={setMarkets} activeClass="bg-accent/15 text-accent-light ring-1 ring-accent/30" />
          <MultiSelect label="Cap" options={ALL_CAPS} selected={caps} onChange={setCaps} activeClass="bg-accent/15 text-accent-light ring-1 ring-accent/30" />
          <MultiSelect label="Sector" options={ALL_SECTORS} selected={sectors} onChange={setSectors} activeClass="bg-accent/15 text-accent-light ring-1 ring-accent/30" />

          <div className="w-px h-5 bg-surface-border" />

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium t-muted">Sort:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortKey)}
              className="text-xs bg-surface-tertiary border border-surface-border rounded-md px-2 py-1 t-secondary"
            >
              <option value="passed">Criteria Passed</option>
              <option value="rs">RS Percentile</option>
              <option value="changePercent">Biggest Gain Today</option>
              <option value="score">Composite Score</option>
              <option value="marketCap">Largest Market Cap</option>
            </select>
          </div>

          <span className="ml-auto badge bg-surface-tertiary t-secondary ring-1 ring-surface-border text-xs">
            {results.length} stock{results.length !== 1 ? 's' : ''}
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

      {/* Results */}
      {results.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="t-muted text-sm">No stocks pass {minPassing}+ CAN SLIM criteria. Try lowering the threshold or adjusting filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {results.map(r => (
            <Link
              key={r.stock.ticker}
              to={`/stock/${r.stock.ticker}`}
              className="card p-4 block hover:border-accent/30 hover:shadow-glow-blue transition-all"
            >
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-lg font-bold t-primary">{r.stock.ticker}</span>
                  <MarketTag market={r.stock.market} />
                  {r.stock.capCategory && <CapTag cap={r.stock.capCategory} />}
                  <span className="text-sm t-muted">{r.stock.name}</span>
                  {isSpeculative(r.stock) && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30">
                      Speculative
                    </span>
                  )}
                  {r.stock.changePercent >= 15 && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-bearish/20 text-bearish ring-1 ring-bearish/30">
                      Strong Move +{r.stock.changePercent.toFixed(1)}%
                    </span>
                  )}
                  {r.stock.changePercent >= 7 && r.stock.changePercent < 15 && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30">
                      Up +{r.stock.changePercent.toFixed(1)}%
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xl font-bold font-mono ${
                    r.passed >= 6 ? 'text-bullish' : r.passed >= 5 ? 'text-accent-light' : 't-secondary'
                  }`}>
                    {r.passed}<span className="text-sm t-muted">/{r.total}</span>
                  </span>
                  <ScoreBadge score={r.stock.score.composite} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {r.checks.map(c => (
                  <div key={c.key} className={`flex items-start gap-2 p-2 rounded-lg text-xs ${
                    c.pass ? 'bg-bullish/5' : 'bg-surface-tertiary/50'
                  }`}>
                    <span className={`flex-shrink-0 font-bold text-sm leading-none mt-0.5 ${c.pass ? 'text-bullish' : 'text-bearish'}`}>
                      {c.pass ? '+' : 'x'}
                    </span>
                    <div>
                      <span className={`font-medium ${c.pass ? 't-secondary' : 't-muted'}`}>{c.label}</span>
                      <p className="t-muted mt-0.5 leading-snug">{c.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
