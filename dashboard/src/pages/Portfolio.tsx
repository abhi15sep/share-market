import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { StockRecord } from '../types';
import { ScoreBadge, ChangePercent, MarketTag } from '../components/common/Tags';
import InfoTooltip from '../components/common/InfoTooltip';
import { currencySymbol } from '../lib/format';
import CorrelationHeatmap from '../components/charts/CorrelationHeatmap';
import { useOhlcvData } from '../hooks/useOhlcvData';
import { computeCorrelationMatrix } from '../lib/correlation';
import PaperTradingTab from '../components/paper-trading/PaperTradingTab';
import RiskAnalytics from '../components/portfolio/RiskAnalytics';
import { useSwipeNavigation } from '../hooks/useSwipeNavigation';

/* ─── TYPES ─── */
interface Holding {
  ticker: string;
  shares: number;
  buyPrice: number;
  addedAt: string; // ISO date
}

const STORAGE_KEY = 'sm-portfolio';

function readHoldings(): Holding[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function writeHoldings(h: Holding[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(h));
}

/* ─── PIE CHART (SVG) ─── */
function PieChart({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  if (total === 0) return null;

  const cx = 80, cy = 80, r = 70;
  let cumAngle = -Math.PI / 2;
  const paths: JSX.Element[] = [];

  for (const slice of slices) {
    const angle = (slice.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(cumAngle);
    const y1 = cy + r * Math.sin(cumAngle);
    cumAngle += angle;
    const x2 = cx + r * Math.cos(cumAngle);
    const y2 = cy + r * Math.sin(cumAngle);
    const large = angle > Math.PI ? 1 : 0;
    paths.push(
      <path
        key={slice.label}
        d={`M ${cx} ${cy} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`}
        fill={slice.color}
        stroke="var(--surface)"
        strokeWidth="2"
      >
        <title>{slice.label}: {((slice.value / total) * 100).toFixed(1)}%</title>
      </path>
    );
  }

  return (
    <div className="flex items-center gap-6">
      <svg width={160} height={160} viewBox="0 0 160 160">{paths}</svg>
      <div className="space-y-1.5">
        {slices.map(s => (
          <div key={s.label} className="flex items-center gap-2 text-xs">
            <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span className="t-secondary">{s.label}</span>
            <span className="font-mono t-muted">{((s.value / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const COLORS = ['#3b82f6','#16a34a','#d97706','#dc2626','#0284c7','#0d9488','#c2410c','#9333ea','#0891b2','#7c3aed'];

/* ─── COMPONENT ─── */
export default function Portfolio({ stocks }: { stocks: StockRecord[] }) {
  const [activeTab, setActiveTab] = useState<'holdings' | 'paper' | 'risk'>('holdings');
  const tabs: ('holdings' | 'paper' | 'risk')[] = ['holdings', 'paper', 'risk'];
  const swipeHandlers = useSwipeNavigation(
    () => setActiveTab(prev => { const i = tabs.indexOf(prev); return i < tabs.length - 1 ? tabs[i + 1] : prev; }),
    () => setActiveTab(prev => { const i = tabs.indexOf(prev); return i > 0 ? tabs[i - 1] : prev; }),
  );
  const [holdings, setHoldings] = useState<Holding[]>(readHoldings);
  const [showAdd, setShowAdd] = useState(false);
  const [addTicker, setAddTicker] = useState('');
  const [addShares, setAddShares] = useState('');
  const [addPrice, setAddPrice] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => { writeHoldings(holdings); }, [holdings]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return stocks
      .filter(s => s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [searchQuery, stocks]);

  const selectTicker = (ticker: string) => {
    setAddTicker(ticker);
    setSearchQuery('');
    setShowDropdown(false);
    // Auto-fill current price
    const s = stocks.find(st => st.ticker === ticker);
    if (s) setAddPrice(s.price.toFixed(2));
  };

  const addHolding = useCallback(() => {
    const shares = parseFloat(addShares);
    const price = parseFloat(addPrice);
    if (!addTicker || isNaN(shares) || shares <= 0 || isNaN(price) || price <= 0) return;

    setHoldings(prev => [...prev, {
      ticker: addTicker.toUpperCase(),
      shares,
      buyPrice: price,
      addedAt: new Date().toISOString(),
    }]);
    setAddTicker('');
    setAddShares('');
    setAddPrice('');
    setShowAdd(false);
  }, [addTicker, addShares, addPrice]);

  const removeHolding = (idx: number) => {
    setHoldings(prev => prev.filter((_, i) => i !== idx));
  };

  // Merge holdings by ticker
  const portfolio = useMemo(() => {
    const map = new Map<string, { holdings: Holding[]; stock: StockRecord | undefined }>();
    for (const h of holdings) {
      if (!map.has(h.ticker)) map.set(h.ticker, { holdings: [], stock: stocks.find(s => s.ticker === h.ticker) });
      map.get(h.ticker)!.holdings.push(h);
    }
    return [...map.entries()].map(([ticker, { holdings: hs, stock }]) => {
      const totalShares = hs.reduce((a, h) => a + h.shares, 0);
      const totalCost = hs.reduce((a, h) => a + h.shares * h.buyPrice, 0);
      const avgCost = totalCost / totalShares;
      const currentPrice = stock?.price ?? avgCost;
      const currentValue = totalShares * currentPrice;
      const pnl = currentValue - totalCost;
      const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
      return { ticker, stock, totalShares, avgCost, totalCost, currentValue, pnl, pnlPct };
    });
  }, [holdings, stocks]);

  const totalValue = portfolio.reduce((a, p) => a + p.currentValue, 0);
  const totalCost = portfolio.reduce((a, p) => a + p.totalCost, 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const avgScore = portfolio.length > 0
    ? Math.round(portfolio.filter(p => p.stock).reduce((a, p) => a + (p.stock?.score.composite ?? 0), 0) / portfolio.filter(p => p.stock).length)
    : 0;

  const portfolioTickers = useMemo(() => portfolio.map(p => p.ticker), [portfolio]);
  const { data: ohlcvData, loading: ohlcvLoading } = useOhlcvData(portfolioTickers);

  const correlationData = useMemo(() => {
    if (portfolioTickers.length < 2 || ohlcvData.size < 2) return null;
    const availableTickers = portfolioTickers.filter(t => ohlcvData.has(t));
    if (availableTickers.length < 2) return null;
    const matrix = computeCorrelationMatrix(ohlcvData, availableTickers);
    return { tickers: availableTickers, matrix };
  }, [portfolioTickers, ohlcvData]);

  // N5: Position Sizing Calculator state
  const [psCapital, setPsCapital] = useState('10000');
  const [psRiskPct, setPsRiskPct] = useState('2');
  const [psEntryPrice, setPsEntryPrice] = useState('');
  const [psStopLoss, setPsStopLoss] = useState('');
  const [psMethod, setPsMethod] = useState<'fixed' | 'kelly'>('fixed');
  const [psWinRate, setPsWinRate] = useState('55');
  const [psAvgWin, setPsAvgWin] = useState('3');
  const [psAvgLoss, setPsAvgLoss] = useState('2');

  const positionSize = useMemo(() => {
    const capital = parseFloat(psCapital);
    const riskPct = parseFloat(psRiskPct) / 100;
    const entry = parseFloat(psEntryPrice);
    const stop = parseFloat(psStopLoss);
    if (isNaN(capital) || capital <= 0) return null;

    if (psMethod === 'kelly') {
      const winRate = parseFloat(psWinRate) / 100;
      const avgWin = parseFloat(psAvgWin);
      const avgLoss = parseFloat(psAvgLoss);
      if (isNaN(winRate) || isNaN(avgWin) || isNaN(avgLoss) || avgLoss <= 0) return null;
      const kelly = (winRate * avgWin - (1 - winRate) * avgLoss) / avgWin;
      const halfKelly = Math.max(0, Math.min(kelly / 2, 0.25)); // half-Kelly, capped at 25%
      const posValue = capital * halfKelly;
      const shares = entry > 0 ? Math.floor(posValue / entry) : null;
      return { method: 'Half-Kelly', riskAmount: posValue, shares, kellyFull: kelly * 100, kellyHalf: halfKelly * 100 };
    }

    // Fixed percentage
    const riskAmount = capital * riskPct;
    if (isNaN(entry) || isNaN(stop) || entry <= 0 || stop <= 0 || stop >= entry) return null;
    const riskPerShare = entry - stop;
    const shares = Math.floor(riskAmount / riskPerShare);
    const posValue = shares * entry;
    return { method: 'Fixed %', riskAmount, shares, posValue, riskPerShare, pctOfCapital: (posValue / capital * 100) };
  }, [psCapital, psRiskPct, psEntryPrice, psStopLoss, psMethod, psWinRate, psAvgWin, psAvgLoss]);

  const pieSlices = portfolio.map((p, i) => ({
    label: p.ticker,
    value: p.currentValue,
    color: COLORS[i % COLORS.length],
  }));

  const [showGuide, setShowGuide] = useState(false);

  return (
    <div className="space-y-5" {...swipeHandlers}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold t-primary">Portfolio Tracker</h1>
          <p className="text-sm t-muted mt-1">Track your holdings, P&L, allocation, and position sizing</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGuide(v => !v)}
            className="badge bg-surface-hover t-muted ring-1 ring-surface-border hover:t-secondary transition-colors cursor-pointer text-xs px-3 py-1.5"
          >
            {showGuide ? 'Hide Guide' : 'How to Use'}
          </button>
          {activeTab === 'holdings' && (
            <button
              onClick={() => setShowAdd(v => !v)}
              className="badge bg-accent/15 text-accent-light ring-1 ring-accent/20 hover:bg-accent/25 transition-colors cursor-pointer text-xs px-3 py-1.5"
            >
              + Add Holding
            </button>
          )}
        </div>
      </div>

      {/* Beginner Guide */}
      {showGuide && (
        <div className="card p-5 border-l-4 border-l-accent">
          <h2 className="text-sm font-semibold t-primary mb-3">Getting Started with Portfolio Tracker</h2>
          <p className="text-xs t-secondary leading-relaxed mb-4">
            This page has two tabs: <strong className="t-primary">Holdings</strong> (your real investments) and <strong className="t-primary">Paper Trading</strong> (practice with virtual money). Here's how to use each:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Holdings Guide */}
            <div className="p-3 rounded-lg bg-surface-hover border border-surface-border">
              <h3 className="text-xs font-semibold text-accent-light uppercase tracking-wider mb-2">Holdings Tab</h3>
              <p className="text-xs t-muted mb-2">Track your real stock investments and see how they're performing.</p>
              <ol className="text-xs t-secondary space-y-1.5 list-decimal list-inside">
                <li><strong>Add a holding</strong> — Click "+ Add Holding", search for a stock, enter shares and your buy price</li>
                <li><strong>Track P&L</strong> — See your profit/loss update automatically as prices change</li>
                <li><strong>Check allocation</strong> — The pie chart shows how concentrated your portfolio is (diversify if one stock is &gt;20%)</li>
                <li><strong>Correlation matrix</strong> — Shows if your stocks move together (green = similar, red = opposite). Aim for mix of low-correlated stocks</li>
                <li><strong>Position sizing</strong> — Before buying, use the calculator to figure out how many shares to buy based on your risk tolerance</li>
              </ol>
              <p className="text-xs t-muted mt-2 italic">Tip: Start by adding your existing holdings to see your total portfolio health.</p>
            </div>

            {/* Paper Trading Guide */}
            <div className="p-3 rounded-lg bg-surface-hover border border-surface-border">
              <h3 className="text-xs font-semibold text-accent-light uppercase tracking-wider mb-2">Paper Trading Tab</h3>
              <p className="text-xs t-muted mb-2">Practice trading with $100,000 virtual cash — no real money at risk.</p>
              <ol className="text-xs t-secondary space-y-1.5 list-decimal list-inside">
                <li><strong>Place a trade</strong> — Click "New Trade", pick Buy/Sell, search for a stock, enter shares</li>
                <li><strong>Journal your trades</strong> — Expand "Journal Details" to log your strategy, emotional state, and reasoning</li>
                <li><strong>Monitor positions</strong> — Watch your open positions update with real prices</li>
                <li><strong>Close positions</strong> — Click "Close" when you want to sell and lock in P&L</li>
                <li><strong>Review trades</strong> — After closing, click "Review" to rate the trade and write lessons learned</li>
                <li><strong>Check analytics</strong> — Switch to "Journal Analytics" to see which strategies and emotions lead to wins vs losses</li>
              </ol>
              <p className="text-xs t-muted mt-2 italic">Tip: Paper trade for at least 2-3 months before using real money.</p>
            </div>
          </div>

          {/* Forward vs Backward Testing */}
          <div className="p-3 rounded-lg bg-accent/5 border border-accent/20">
            <h3 className="text-xs font-semibold text-accent-light uppercase tracking-wider mb-2">Can I test my strategy on the last 2-4 years?</h3>
            <p className="text-xs t-secondary leading-relaxed mb-2">
              Paper Trading is <strong className="t-primary">forward-looking</strong> — it tracks from today onwards. For testing against the past, use the <strong className="t-primary">Backtest</strong> page instead.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="text-xs">
                <p className="font-semibold t-primary mb-1">Backtest (Past)</p>
                <p className="t-muted">"Would buying high-score stocks have worked over the last year?" — Tests your <em>strategy rules</em> against real historical returns.</p>
                <Link to="/backtest" className="text-accent-light hover:underline mt-1 inline-block">Go to Backtest &rarr;</Link>
              </div>
              <div className="text-xs">
                <p className="font-semibold t-primary mb-1">Paper Trading (Future)</p>
                <p className="t-muted">"Can I follow my rules, manage emotions, and stay disciplined?" — Tests your <em>execution</em> going forward with virtual money.</p>
              </div>
            </div>
            <p className="text-xs t-muted mt-3 italic">
              Best approach: First backtest your strategy to see if the rules work, then paper trade to see if <em>you</em> can follow them consistently.
            </p>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-surface-border">
        <button
          onClick={() => setActiveTab('holdings')}
          className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
            activeTab === 'holdings'
              ? 'border-accent text-accent-light'
              : 'border-transparent t-muted hover:t-primary hover:border-surface-border'
          }`}
        >Holdings</button>
        <button
          onClick={() => setActiveTab('paper')}
          className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
            activeTab === 'paper'
              ? 'border-accent text-accent-light'
              : 'border-transparent t-muted hover:t-primary hover:border-surface-border'
          }`}
        >Paper Trading</button>
        <button
          onClick={() => setActiveTab('risk')}
          className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
            activeTab === 'risk'
              ? 'border-accent text-accent-light'
              : 'border-transparent t-muted hover:t-primary hover:border-surface-border'
          }`}
        >Risk Analytics</button>
      </div>

      {activeTab === 'paper' && <PaperTradingTab stocks={stocks} />}

      {activeTab === 'risk' && (
        <RiskAnalytics portfolio={portfolio} stocks={stocks} ohlcvData={ohlcvData} />
      )}

      {activeTab === 'holdings' && (<>


      {/* Add form */}
      {showAdd && (
        <div className="card p-4">
          <h3 className="text-xs font-semibold t-tertiary uppercase tracking-wider mb-3">Add Holding</h3>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="relative">
              <label className="text-xs t-muted block mb-1">Ticker</label>
              <input
                type="text"
                value={addTicker || searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setAddTicker(''); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                placeholder="AAPL"
                className="input-field w-32"
              />
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-surface-secondary border border-surface-border rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                  {searchResults.map(s => (
                    <button
                      key={s.ticker}
                      onMouseDown={() => selectTicker(s.ticker)}
                      className="w-full text-left px-3 py-2 hover:bg-surface-hover transition-colors flex items-center gap-2"
                    >
                      <span className="font-semibold text-accent-light text-sm">{s.ticker}</span>
                      <span className="t-muted text-xs truncate">{s.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs t-muted block mb-1">Shares</label>
              <input type="number" value={addShares} onChange={e => setAddShares(e.target.value)} placeholder="100" className="input-field w-24" min="0" step="any" />
            </div>
            <div>
              <label className="text-xs t-muted block mb-1">Buy Price</label>
              <input type="number" value={addPrice} onChange={e => setAddPrice(e.target.value)} placeholder="150.00" className="input-field w-28" min="0" step="0.01" />
            </div>
            <button onClick={addHolding} className="badge bg-bullish/20 text-bullish ring-1 ring-bullish/30 hover:bg-bullish/30 transition-colors cursor-pointer text-xs px-4 py-2">
              Add
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {holdings.length === 0 && (
        <div className="card p-12 text-center">
          <p className="text-lg font-semibold t-primary mb-2">No holdings yet</p>
          <p className="t-muted text-sm mb-3">Click "+ Add Holding" above to start tracking your investments.</p>
          <div className="text-xs t-muted max-w-md mx-auto space-y-1">
            <p><strong className="t-secondary">What to add:</strong> Stocks you've actually bought with real money.</p>
            <p><strong className="t-secondary">What you'll see:</strong> Total portfolio value, profit/loss, allocation breakdown, and quality scores.</p>
            <p><strong className="t-secondary">New to investing?</strong> Try Paper Trading first (next tab) to practice with virtual money.</p>
          </div>
        </div>
      )}

      {holdings.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="stat-card border-t-2 border-t-accent">
              <p className="text-xs font-medium t-tertiary uppercase tracking-wider">Total Value</p>
              <p className="text-2xl font-bold t-primary mt-1 font-mono tabular-nums">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-xs t-muted mt-1">{portfolio.length} position{portfolio.length !== 1 ? 's' : ''}</p>
            </div>
            <div className={`stat-card border-t-2 ${totalPnl >= 0 ? 'border-t-bullish' : 'border-t-bearish'}`}>
              <p className="text-xs font-medium t-tertiary uppercase tracking-wider">Total P&L</p>
              <p className={`text-2xl font-bold mt-1 font-mono tabular-nums ${totalPnl >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                {totalPnl >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}%
              </p>
              <p className={`text-xs mt-1 font-mono ${totalPnl >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                {totalPnl >= 0 ? '+' : ''}${totalPnl.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="stat-card border-t-2 border-t-accent">
              <p className="text-xs font-medium t-tertiary uppercase tracking-wider">Total Cost</p>
              <p className="text-2xl font-bold t-primary mt-1 font-mono tabular-nums">${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className={`stat-card border-t-2 ${avgScore >= 50 ? 'border-t-bullish' : 'border-t-bearish'}`}>
              <p className="text-xs font-medium t-tertiary uppercase tracking-wider">
                <InfoTooltip text="Weighted average composite score of your holdings">Avg Score</InfoTooltip>
              </p>
              <p className="text-2xl font-bold t-primary mt-1 font-mono tabular-nums">{avgScore}</p>
              <p className="text-xs t-muted mt-1">{avgScore >= 60 ? 'Healthy' : avgScore >= 40 ? 'Mixed' : 'Weak'}</p>
            </div>
          </div>

          {/* Allocation pie + Holdings table */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Pie chart */}
            <div className="card p-5">
              <h2 className="text-xs font-semibold t-tertiary uppercase tracking-wider mb-4">Allocation</h2>
              <PieChart slices={pieSlices} />
            </div>

            {/* Holdings table */}
            <div className="card-flat overflow-hidden lg:col-span-2">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-border bg-surface-tertiary/30">
                      <th className="px-4 py-3 text-left table-header">Ticker</th>
                      <th className="px-4 py-3 text-right table-header">Shares</th>
                      <th className="px-4 py-3 text-right table-header">Avg Cost</th>
                      <th className="px-4 py-3 text-right table-header">Price</th>
                      <th className="px-4 py-3 text-right table-header">Value</th>
                      <th className="px-4 py-3 text-right table-header">Alloc</th>
                      <th className="px-4 py-3 text-right table-header">P&L</th>
                      <th className="px-4 py-3 text-right table-header">Today</th>
                      <th className="px-4 py-3 text-center table-header">Score</th>
                      <th className="px-4 py-3 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.map(p => {
                      const cur = currencySymbol(p.stock?.market ?? 'US');
                      const allocPct = totalValue > 0 ? (p.currentValue / totalValue) * 100 : 0;
                      return (
                        <tr key={p.ticker} className={`border-b border-surface-border/50 hover:bg-surface-hover/50 transition-colors ${allocPct > 25 ? 'bg-amber-500/3' : ''}`}>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <Link to={`/stock/${p.ticker}`} className="font-semibold text-accent-light hover:t-primary transition-colors">
                                {p.ticker}
                              </Link>
                              {p.stock && <MarketTag market={p.stock.market} />}
                            </div>
                            {p.stock && <span className="text-xs t-muted">{p.stock.name.slice(0, 22)}</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums t-primary text-xs">{p.totalShares}</td>
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums t-secondary text-xs">{cur}{p.avgCost.toFixed(2)}</td>
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums t-primary text-xs">{cur}{(p.stock?.price ?? p.avgCost).toFixed(2)}</td>
                          <td className="px-4 py-2.5 text-right font-mono tabular-nums t-primary text-xs">{cur}{p.currentValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="px-4 py-2.5 text-right text-xs">
                            <span className={`font-mono tabular-nums ${allocPct > 25 ? 'text-amber-400 font-semibold' : 't-secondary'}`}>
                              {allocPct.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className={`font-mono tabular-nums text-xs font-semibold ${p.pnl >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                              {p.pnl >= 0 ? '+' : ''}{p.pnlPct.toFixed(1)}%
                            </div>
                            <div className={`font-mono tabular-nums text-[10px] ${p.pnl >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                              {p.pnl >= 0 ? '+' : ''}{cur}{Math.abs(p.pnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs">
                            {p.stock ? <ChangePercent value={p.stock.changePercent} /> : <span className="t-faint">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {p.stock ? <ScoreBadge score={p.stock.score.composite} /> : <span className="t-faint">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <button
                              onClick={() => {
                                const idx = holdings.findIndex(h => h.ticker === p.ticker);
                                if (idx >= 0) removeHolding(idx);
                              }}
                              className="t-faint hover:text-bearish transition-colors font-bold px-1 text-sm"
                              title="Remove"
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Correlation Matrix */}
          {correlationData && (
            <div className="card p-5">
              <h2 className="text-xs font-semibold t-tertiary uppercase tracking-wider mb-2">Correlation Matrix</h2>
              <p className="text-xs t-muted mb-4">
                Shows how your holdings move together. Values near +1 mean stocks move in sync (less diversification), near 0 means independent, near -1 means inverse (good hedge).
              </p>
              <CorrelationHeatmap tickers={correlationData.tickers} matrix={correlationData.matrix} />
            </div>
          )}
        </>
      )}

      {/* Position Sizing Calculator */}
      <div className="card p-5">
        <h2 className="text-xs font-semibold t-tertiary uppercase tracking-wider mb-2">Position Sizing Calculator</h2>
        <p className="text-xs t-muted mb-2">
          Calculate optimal position size using fixed-% risk or Kelly Criterion. Never risk more than you can afford to lose.
        </p>
        <details className="mb-4">
          <summary className="text-xs text-accent-light cursor-pointer hover:underline">How does this work?</summary>
          <div className="mt-2 p-3 rounded-lg bg-surface-hover border border-surface-border text-xs t-secondary space-y-1.5">
            <p><strong className="t-primary">Fixed % Risk:</strong> You decide what % of your account you're willing to lose on one trade (typically 1-2%). Then based on where you'd place your stop-loss, it tells you how many shares to buy. Example: $10,000 account, 2% risk = you're OK losing $200 max on this trade.</p>
            <p><strong className="t-primary">Kelly Criterion:</strong> A math formula that uses your win rate and average win/loss sizes to calculate the optimal bet size. We use "Half-Kelly" (half the formula's suggestion) because full Kelly is too aggressive for most traders.</p>
            <p className="italic t-muted">Rule of thumb: Never put more than 5-10% of your total capital in a single stock, and never risk more than 1-2% on any single trade.</p>
          </div>
        </details>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setPsMethod('fixed')}
            className={`text-xs px-3 py-1.5 rounded transition-colors ${
              psMethod === 'fixed' ? 'bg-accent/20 text-accent-light ring-1 ring-accent/30' : 'bg-surface-hover t-muted hover:t-secondary'
            }`}
          >Fixed % Risk</button>
          <button
            onClick={() => setPsMethod('kelly')}
            className={`text-xs px-3 py-1.5 rounded transition-colors ${
              psMethod === 'kelly' ? 'bg-accent/20 text-accent-light ring-1 ring-accent/30' : 'bg-surface-hover t-muted hover:t-secondary'
            }`}
          >Kelly Criterion</button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="text-xs t-muted block mb-1">Account Capital ($)</label>
            <input type="number" value={psCapital} onChange={e => setPsCapital(e.target.value)} className="input-field w-full" min="0" step="100" />
          </div>
          {psMethod === 'fixed' ? (
            <>
              <div>
                <label className="text-xs t-muted block mb-1">Risk per Trade (%)</label>
                <input type="number" value={psRiskPct} onChange={e => setPsRiskPct(e.target.value)} className="input-field w-full" min="0.1" max="10" step="0.5" />
              </div>
              <div>
                <label className="text-xs t-muted block mb-1">Entry Price ($)</label>
                <input type="number" value={psEntryPrice} onChange={e => setPsEntryPrice(e.target.value)} className="input-field w-full" min="0" step="0.01" />
              </div>
              <div>
                <label className="text-xs t-muted block mb-1">Stop Loss ($)</label>
                <input type="number" value={psStopLoss} onChange={e => setPsStopLoss(e.target.value)} className="input-field w-full" min="0" step="0.01" />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-xs t-muted block mb-1">Win Rate (%)</label>
                <input type="number" value={psWinRate} onChange={e => setPsWinRate(e.target.value)} className="input-field w-full" min="1" max="99" step="1" />
              </div>
              <div>
                <label className="text-xs t-muted block mb-1">Avg Win ($)</label>
                <input type="number" value={psAvgWin} onChange={e => setPsAvgWin(e.target.value)} className="input-field w-full" min="0" step="0.1" />
              </div>
              <div>
                <label className="text-xs t-muted block mb-1">Avg Loss ($)</label>
                <input type="number" value={psAvgLoss} onChange={e => setPsAvgLoss(e.target.value)} className="input-field w-full" min="0" step="0.1" />
              </div>
            </>
          )}
        </div>

        {/* Validation hint */}
        {!positionSize && psMethod === 'fixed' && psEntryPrice && psStopLoss && (
          <p className="text-xs text-amber-400 mb-3">
            {parseFloat(psStopLoss) >= parseFloat(psEntryPrice)
              ? 'Stop loss must be below entry price.'
              : 'Enter a valid entry price and stop loss to calculate.'}
          </p>
        )}

        {positionSize && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-lg bg-surface-hover border border-surface-border">
            <div className="text-center">
              <p className="text-xs t-muted mb-1">Method</p>
              <p className="font-semibold text-accent-light">{positionSize.method}</p>
            </div>
            <div className="text-center">
              <p className="text-xs t-muted mb-1">Max Risk</p>
              <p className="font-semibold font-mono text-bearish">${positionSize.riskAmount.toFixed(2)}</p>
            </div>
            {positionSize.shares != null && (
              <div className="text-center">
                <p className="text-xs t-muted mb-1">Shares to Buy</p>
                <p className="font-semibold font-mono text-bullish">{positionSize.shares}</p>
              </div>
            )}
            {'posValue' in positionSize && positionSize.posValue != null && (
              <div className="text-center">
                <p className="text-xs t-muted mb-1">Position Value</p>
                <p className="font-semibold font-mono t-primary">${(positionSize.posValue as number).toFixed(2)}</p>
              </div>
            )}
            {'pctOfCapital' in positionSize && positionSize.pctOfCapital != null && (
              <div className="text-center">
                <p className="text-xs t-muted mb-1">% of Capital</p>
                <p className={`font-semibold font-mono ${(positionSize.pctOfCapital as number) > 10 ? 'text-amber-400' : 'text-accent-light'}`}>
                  {(positionSize.pctOfCapital as number).toFixed(1)}%
                </p>
              </div>
            )}
            {'riskPerShare' in positionSize && (
              <div className="text-center">
                <p className="text-xs t-muted mb-1">Risk / Share</p>
                <p className="font-semibold font-mono text-bearish">${(positionSize.riskPerShare as number).toFixed(2)}</p>
              </div>
            )}
            {'kellyHalf' in positionSize && (
              <div className="text-center">
                <p className="text-xs t-muted mb-1">Half-Kelly %</p>
                <p className="font-semibold font-mono text-accent-light">{(positionSize.kellyHalf as number).toFixed(1)}%</p>
              </div>
            )}
            {'kellyFull' in positionSize && (
              <div className="text-center">
                <p className="text-xs t-muted mb-1">Full Kelly %</p>
                <p className="font-semibold font-mono t-muted">{(positionSize.kellyFull as number).toFixed(1)}%</p>
              </div>
            )}
          </div>
        )}
      </div>
      </>)}
    </div>
  );
}
