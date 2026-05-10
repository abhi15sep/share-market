/**
 * N29: Chart Replay — Step through historical candles one at a time
 * Practice trading decisions without seeing the future
 */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
  BarChart, Bar, Cell,
} from 'recharts';
import type { StockRecord } from '../types';
import { computeSMA, computeRSI } from '../lib/replay-indicators';
import { currencySymbol } from '../lib/format';

const BASE = import.meta.env.BASE_URL;

interface Decision {
  type: 'buy' | 'sell' | 'skip';
  index: number;
  date: string;
  price: number;
  notes: string;
}

interface Trade {
  buyIndex: number;
  buyPrice: number;
  sellIndex: number;
  sellPrice: number;
  pnlPct: number;
}

/* ─── Suggested stocks empty state ─── */
const CATEGORIES = [
  { label: 'High Momentum',  desc: 'RS ≥ 80',          filter: (s: StockRecord) => s.rsPercentile >= 80 },
  { label: 'High Score',     desc: 'Composite ≥ 70',    filter: (s: StockRecord) => s.score.composite >= 70 },
  { label: 'Oversold',       desc: 'RSI < 35',          filter: (s: StockRecord) => s.rsi != null && s.rsi < 35 },
  { label: 'Near 52W High',  desc: '52W range > 90%',   filter: (s: StockRecord) => s.fiftyTwoWeekRangePercent >= 90 },
] as const;

function SuggestedStocks({ stocks, onSelect }: { stocks: StockRecord[]; onSelect: (ticker: string) => void }) {
  const [activeCategory, setActiveCategory] = useState(0);

  const suggestions = useMemo(() => {
    const cat = CATEGORIES[activeCategory];
    return stocks
      .filter(cat.filter)
      .sort((a, b) => b.score.composite - a.score.composite)
      .slice(0, 12);
  }, [stocks, activeCategory]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs t-muted">Quick picks:</span>
        {CATEGORIES.map((cat, i) => (
          <button
            key={cat.label}
            onClick={() => setActiveCategory(i)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeCategory === i
                ? 'bg-accent/20 text-accent-light ring-1 ring-accent/30'
                : 'bg-surface-hover t-muted hover:t-secondary'
            }`}
          >
            {cat.label}
            <span className="ml-1 t-faint font-normal">({cat.desc})</span>
          </button>
        ))}
      </div>

      {suggestions.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
          {suggestions.map(s => (
            <button
              key={s.ticker}
              onClick={() => onSelect(s.ticker)}
              className="card p-3 text-left hover:border-accent/30 transition-all group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-accent-light group-hover:t-primary transition-colors">{s.ticker}</span>
                <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                  s.score.composite >= 65 ? 'text-bullish bg-bullish/10' :
                  s.score.composite >= 45 ? 'text-amber-400 bg-amber-400/10' :
                  'text-bearish bg-bearish/10'
                }`}>{s.score.composite}</span>
              </div>
              <div className="text-[10px] t-muted truncate mb-1.5">{s.name}</div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="t-faint">RS {s.rsPercentile}</span>
                <span className={s.changePercent >= 0 ? 'text-bullish' : 'text-bearish'}>
                  {s.changePercent >= 0 ? '+' : ''}{s.changePercent.toFixed(1)}%
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs t-muted">No stocks match this filter right now.</p>
      )}
    </div>
  );
}

export default function ChartReplay({ stocks }: { stocks: StockRecord[] }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState('');
  const [ohlcv, setOhlcv] = useState<number[][] | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(30);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [notes, setNotes] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const stockInfo = useMemo(() => stocks.find(s => s.ticker === selectedTicker), [stocks, selectedTicker]);
  const sym = stockInfo ? currencySymbol(stockInfo.market) : '$';

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return stocks
      .filter(s => s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [searchQuery, stocks]);

  const selectStock = useCallback(async (ticker: string) => {
    setSelectedTicker(ticker);
    setSearchQuery('');
    setShowDropdown(false);
    setLoading(true);
    setDecisions([]);
    setCurrentIndex(30);
    setPlaying(false);
    setShowSummary(false);

    try {
      const safeTicker = ticker.replace(/[^a-zA-Z0-9.-]/g, '_');
      const res = await fetch(`${BASE}data/charts/${safeTicker}.json`);
      if (!res.ok) throw new Error('Not found');
      const data: number[][] = await res.json();
      setOhlcv(data);
    } catch {
      setOhlcv(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const pickRandom = useCallback(() => {
    const pick = stocks[Math.floor(Math.random() * stocks.length)];
    if (pick) selectStock(pick.ticker);
  }, [stocks, selectStock]);

  // Auto-play interval
  useEffect(() => {
    if (playing && ohlcv) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          if (prev >= ohlcv.length) { setPlaying(false); return prev; }
          return prev + 1;
        });
      }, 1000 / speed);
    }
    return () => { clearInterval(intervalRef.current); };
  }, [playing, speed, ohlcv]);

  // Visible data slice
  const visibleData = useMemo(() => ohlcv?.slice(0, currentIndex) ?? [], [ohlcv, currentIndex]);
  const closes = useMemo(() => visibleData.map(c => c[4]), [visibleData]);
  const currentCandle = visibleData[visibleData.length - 1];
  const currentPrice = currentCandle?.[4] ?? 0;
  const currentDate = currentCandle ? new Date(currentCandle[0] * 1000).toLocaleDateString() : '';

  // Indicators
  const sma20  = useMemo(() => computeSMA(closes, 20),  [closes]);
  const sma50  = useMemo(() => computeSMA(closes, 50),  [closes]);
  const sma200 = useMemo(() => computeSMA(closes, 200), [closes]);
  const rsi    = useMemo(() => computeRSI(closes),      [closes]);

  // Chart data with decision markers
  const chartData = useMemo(() => {
    const decisionMap = new Map<number, Decision>();
    for (const d of decisions) decisionMap.set(d.index, d);

    return visibleData.map((c, i) => {
      const dec = decisionMap.get(i);
      return {
        date:      new Date(c[0] * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        open:  c[1], high: c[2], low: c[3], close: c[4], volume: c[5],
        sma20: sma20[i], sma50: sma50[i], sma200: sma200[i],
        buyMark:  dec?.type === 'buy'  ? c[4] : undefined,
        sellMark: dec?.type === 'sell' ? c[4] : undefined,
      };
    });
  }, [visibleData, sma20, sma50, sma200, decisions]);

  const displayData = chartData.slice(-80);

  const rsiData = useMemo(() => {
    const offset = Math.max(0, visibleData.length - 80);
    return visibleData.slice(-80).map((c, i) => ({
      date: new Date(c[0] * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      rsi: rsi[offset + i],
    }));
  }, [visibleData, rsi]);

  // Decision handlers
  const isAtEnd = ohlcv ? currentIndex >= ohlcv.length : false;
  const hasOpenPosition = decisions.filter(d => d.type === 'buy').length > decisions.filter(d => d.type === 'sell').length;

  const makeDecision = useCallback((type: 'buy' | 'sell' | 'skip') => {
    if (!currentCandle) return;
    setDecisions(prev => [...prev, { type, index: currentIndex - 1, date: currentDate, price: currentPrice, notes }]);
    setNotes('');
  }, [currentCandle, currentIndex, currentDate, currentPrice, notes]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!ohlcv) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;
      if (e.key === 'ArrowRight') { e.preventDefault(); setCurrentIndex(prev => Math.min(ohlcv.length, prev + 1)); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setCurrentIndex(prev => Math.max(30, prev - 1)); }
      else if (e.key === ' ') { e.preventDefault(); setPlaying(v => !v); }
      else if ((e.key === 'b' || e.key === 'B') && !hasOpenPosition && !isAtEnd) makeDecision('buy');
      else if ((e.key === 's' || e.key === 'S') && hasOpenPosition && !isAtEnd) makeDecision('sell');
      else if ((e.key === 'k' || e.key === 'K') && !isAtEnd) makeDecision('skip');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [ohlcv, hasOpenPosition, isAtEnd, makeDecision]);

  // Compute trades from decisions
  const trades = useMemo(() => {
    const result: Trade[] = [];
    let openBuy: Decision | null = null;
    for (const d of decisions) {
      if (d.type === 'buy' && !openBuy) { openBuy = d; }
      else if (d.type === 'sell' && openBuy) {
        result.push({ buyIndex: openBuy.index, buyPrice: openBuy.price, sellIndex: d.index, sellPrice: d.price, pnlPct: ((d.price - openBuy.price) / openBuy.price) * 100 });
        openBuy = null;
      }
    }
    return result;
  }, [decisions]);

  // Summary stats
  const summaryStats = useMemo(() => {
    if (!ohlcv || ohlcv.length === 0) return null;
    const firstPrice = ohlcv[0][4];
    const lastPrice  = ohlcv[ohlcv.length - 1][4];
    const buyHoldReturn = ((lastPrice - firstPrice) / firstPrice) * 100;
    const totalReturn   = trades.reduce((a, t) => a + t.pnlPct, 0);
    const wins = trades.filter(t => t.pnlPct > 0).length;
    return { buyHoldReturn, totalReturn, winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0, totalTrades: trades.length, wins };
  }, [ohlcv, trades]);

  const progress = ohlcv ? ((currentIndex / ohlcv.length) * 100).toFixed(0) : '0';

  const tooltipStyle = { fontSize: 11, backgroundColor: 'var(--surface-secondary)', border: '1px solid var(--surface-border)', borderRadius: 8 };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold t-primary">Chart Replay</h1>
        <p className="text-sm t-muted mt-1">Step through historical candles and practice trading decisions without seeing the future.</p>
      </div>

      {/* How to use */}
      <div className="card p-4 bg-accent/5 border-accent/15">
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium t-secondary select-none">
            <span className="text-xs t-muted group-open:rotate-90 transition-transform">&#9654;</span>
            How to Use Chart Replay
          </summary>
          <div className="mt-3 text-sm t-muted space-y-2">
            <ol className="list-decimal list-inside space-y-1.5 ml-1">
              <li>Search for a stock above (or click <strong className="t-secondary">Random</strong>) — its historical chart will load</li>
              <li>Step through candles with <kbd className="px-1.5 py-0.5 rounded bg-surface-hover text-xs font-mono t-secondary">→</kbd> or auto-play with <kbd className="px-1.5 py-0.5 rounded bg-surface-hover text-xs font-mono t-secondary">Space</kbd></li>
              <li>Watch SMA lines and RSI update live as each candle reveals</li>
              <li>Press <kbd className="px-1.5 py-0.5 rounded bg-surface-hover text-xs font-mono t-secondary">B</kbd> to Buy, <kbd className="px-1.5 py-0.5 rounded bg-surface-hover text-xs font-mono t-secondary">S</kbd> to Sell, <kbd className="px-1.5 py-0.5 rounded bg-surface-hover text-xs font-mono t-secondary">K</kbd> to Skip at each point</li>
              <li>When done, click <strong className="t-secondary">See Results</strong> to compare your trades vs buy-and-hold</li>
            </ol>
            <p className="text-xs pt-2 border-t border-surface-border">
              <strong>Keyboard shortcuts:</strong> ← → step · Space play/pause · B buy · S sell · K skip
            </p>
          </div>
        </details>
      </div>

      {/* Stock Picker */}
      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <label className="text-xs t-muted block mb-1">Select Stock</label>
            <input
              type="text"
              value={selectedTicker || searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setSelectedTicker(''); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              placeholder="Search by ticker or name..."
              className="input-field w-full"
            />
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute top-full left-0 mt-1 w-full bg-surface-secondary border border-surface-border rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                {searchResults.map(s => (
                  <button
                    key={s.ticker}
                    onMouseDown={() => selectStock(s.ticker)}
                    className="w-full text-left px-3 py-2 hover:bg-surface-hover transition-colors flex items-center gap-2"
                  >
                    <span className="font-semibold text-accent-light text-sm">{s.ticker}</span>
                    <span className="t-muted text-xs truncate">{s.name}</span>
                    <span className="ml-auto text-xs font-mono t-muted">{currencySymbol(s.market)}{s.price.toFixed(2)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={pickRandom}
            className="px-3 py-2 rounded-lg text-xs font-medium bg-surface-hover t-secondary hover:t-primary ring-1 ring-surface-border transition-colors"
          >
            Random
          </button>
          {selectedTicker && (
            <div className="text-sm t-secondary">
              <span className="font-semibold text-accent-light">{selectedTicker}</span>
              {ohlcv && <span className="t-muted ml-2">{ohlcv.length} candles</span>}
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 rounded-full border-2 border-surface-border" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
          </div>
        </div>
      )}

      {selectedTicker && !loading && !ohlcv && (
        <div className="card p-8 text-center">
          <p className="text-lg font-semibold t-primary mb-2">No chart data available</p>
          <p className="t-muted text-sm">OHLCV data for {selectedTicker} is not available. Try another stock.</p>
        </div>
      )}

      {/* Suggested stocks — only shown when nothing selected */}
      {!selectedTicker && !loading && <SuggestedStocks stocks={stocks} onSelect={selectStock} />}

      {ohlcv && !loading && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
            {/* Chart Area */}
            <div className="lg:col-span-3 space-y-3">
              {/* Price Chart */}
              <div className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold t-primary">{selectedTicker}</span>
                    <span className="text-lg font-bold font-mono t-primary">{sym}{currentPrice.toFixed(2)}</span>
                    <span className="text-xs t-muted">{currentDate}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs t-muted">
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-400 inline-block" /> SMA20</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-400 inline-block" /> SMA50</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-400 inline-block" /> SMA200</span>
                    {decisions.some(d => d.type === 'buy')  && <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-bullish inline-block" /> Buy</span>}
                    {decisions.some(d => d.type === 'sell') && <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-bearish inline-block" /> Sell</span>}
                  </div>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={displayData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} tickFormatter={v => `${sym}${v}`} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => {
                        if (name === 'close') return [`${sym}${v?.toFixed(2)}`, 'Price'];
                        if (name === 'sma20') return [`${sym}${v?.toFixed(2)}`, 'SMA20'];
                        if (name === 'sma50') return [`${sym}${v?.toFixed(2)}`, 'SMA50'];
                        if (name === 'sma200') return [`${sym}${v?.toFixed(2)}`, 'SMA200'];
                        return [v, name];
                      }} />
                      <Line type="monotone" dataKey="close"  stroke="var(--text-primary, #e5e7eb)" strokeWidth={1.5} dot={false} />
                      <Line type="monotone" dataKey="sma20"  stroke="#60a5fa" strokeWidth={1} dot={false} strokeDasharray="3 3" connectNulls={false} />
                      <Line type="monotone" dataKey="sma50"  stroke="#fbbf24" strokeWidth={1} dot={false} strokeDasharray="3 3" connectNulls={false} />
                      <Line type="monotone" dataKey="sma200" stroke="#f87171" strokeWidth={1} dot={false} strokeDasharray="3 3" connectNulls={false} />
                      {/* Decision markers */}
                      <Line type="monotone" dataKey="buyMark"  stroke="#16a34a" strokeWidth={0} dot={{ r: 5, fill: '#16a34a', stroke: '#fff', strokeWidth: 1.5 }} activeDot={false} connectNulls={false} legendType="none" />
                      <Line type="monotone" dataKey="sellMark" stroke="#dc2626" strokeWidth={0} dot={{ r: 5, fill: '#dc2626', stroke: '#fff', strokeWidth: 1.5 }} activeDot={false} connectNulls={false} legendType="none" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* RSI Sub-panel */}
              <div className="card p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold t-tertiary uppercase tracking-wider">RSI (14)</span>
                  <span className="text-xs font-mono t-primary">{rsi[rsi.length - 1]?.toFixed(1) ?? '—'}</span>
                </div>
                <div className="h-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rsiData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} ticks={[30, 50, 70]} />
                      <ReferenceLine y={70} stroke="#dc2626" strokeDasharray="3 3" strokeOpacity={0.5} />
                      <ReferenceLine y={30} stroke="#16a34a" strokeDasharray="3 3" strokeOpacity={0.5} />
                      <Line type="monotone" dataKey="rsi" stroke="#a78bfa" strokeWidth={1.5} dot={false} connectNulls={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Volume Sub-panel */}
              <div className="card p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold t-tertiary uppercase tracking-wider">Volume</span>
                </div>
                <div className="h-20">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={displayData} margin={{ top: 2, right: 10, bottom: 2, left: 10 }}>
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 9 }} tickFormatter={v => v >= 1e6 ? `${(v / 1e6).toFixed(0)}M` : `${(v / 1e3).toFixed(0)}K`} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${(v / 1e3).toFixed(0)}K`, 'Volume']} />
                      <Bar dataKey="volume" maxBarSize={6}>
                        {displayData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.close >= entry.open ? '#16a34a' : '#dc2626'} fillOpacity={0.65} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Controls */}
              <div className="card p-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <button onClick={() => { setCurrentIndex(30); setPlaying(false); }} className="px-3 py-1.5 rounded bg-surface-hover hover:bg-surface-tertiary transition-colors text-xs t-secondary" title="Reset (go to start)">|&lt;&lt;</button>
                  <button onClick={() => setCurrentIndex(Math.max(30, currentIndex - 1))} className="px-3 py-1.5 rounded bg-surface-hover hover:bg-surface-tertiary transition-colors text-xs t-secondary" title="Step back (←)">&lt;</button>
                  <button
                    onClick={() => setPlaying(v => !v)}
                    className={`px-4 py-1.5 rounded text-xs font-medium transition-colors ${
                      playing ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30' : 'bg-bullish/20 text-bullish ring-1 ring-bullish/30'
                    }`}
                    title="Play/Pause (Space)"
                  >
                    {playing ? 'Pause' : 'Play'}
                  </button>
                  <button onClick={() => setCurrentIndex(Math.min(ohlcv.length, currentIndex + 1))} className="px-3 py-1.5 rounded bg-surface-hover hover:bg-surface-tertiary transition-colors text-xs t-secondary" title="Step forward (→)">&gt;</button>
                  <button onClick={() => { setCurrentIndex(ohlcv.length); setPlaying(false); }} className="px-3 py-1.5 rounded bg-surface-hover hover:bg-surface-tertiary transition-colors text-xs t-secondary" title="Jump to end">&gt;&gt;|</button>

                  <div className="w-px h-6 bg-surface-border mx-1" />

                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="t-muted">Speed:</span>
                    {[1, 2, 5].map(s => (
                      <button
                        key={s}
                        onClick={() => setSpeed(s)}
                        className={`px-2 py-1 rounded transition-colors ${
                          speed === s ? 'bg-accent/20 text-accent-light ring-1 ring-accent/30' : 'bg-surface-hover t-muted hover:t-secondary'
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>

                  <span className="text-xs font-mono t-muted tabular-nums">
                    Candle {currentIndex}/{ohlcv.length}
                  </span>

                  <div className="flex-1 min-w-[60px]">
                    <div className="flex items-center gap-2 text-xs t-muted">
                      <div className="flex-1 h-1.5 rounded-full bg-surface-hover overflow-hidden">
                        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="font-mono tabular-nums">{progress}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Decision Panel */}
            <div className="space-y-3">
              <div className="card p-4">
                <h3 className="text-xs font-semibold t-tertiary uppercase tracking-wider mb-3">Make Decision</h3>
                <div className="space-y-2">
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Notes (optional)..."
                    className="input-field w-full h-16 text-xs resize-none"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => makeDecision('buy')}
                      disabled={hasOpenPosition || isAtEnd}
                      className="px-3 py-2 rounded text-xs font-medium bg-bullish/20 text-bullish ring-1 ring-bullish/30 hover:bg-bullish/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Buy (B)"
                    >
                      Buy
                    </button>
                    <button
                      onClick={() => makeDecision('sell')}
                      disabled={!hasOpenPosition || isAtEnd}
                      className="px-3 py-2 rounded text-xs font-medium bg-bearish/20 text-bearish ring-1 ring-bearish/30 hover:bg-bearish/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Sell (S)"
                    >
                      Sell
                    </button>
                    <button
                      onClick={() => makeDecision('skip')}
                      disabled={isAtEnd}
                      className="px-3 py-2 rounded text-xs font-medium bg-surface-hover t-muted ring-1 ring-surface-border hover:t-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Skip (K)"
                    >
                      Skip
                    </button>
                  </div>
                  {hasOpenPosition && (
                    <p className="text-xs text-bullish mt-1">Position open — sell to close</p>
                  )}
                  <p className="text-[10px] t-faint text-center">Keyboard: B · S · K</p>
                </div>
              </div>

              {/* Decision Log */}
              <div className="card p-4 max-h-[280px] overflow-y-auto">
                <h3 className="text-xs font-semibold t-tertiary uppercase tracking-wider mb-2">Decision Log</h3>
                {decisions.length === 0 ? (
                  <p className="text-xs t-muted">No decisions yet. Step through candles and make buy/sell/skip decisions.</p>
                ) : (
                  <div className="space-y-1.5">
                    {decisions.map((d, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-surface-border/50">
                        <span className={`font-semibold uppercase w-8 ${
                          d.type === 'buy' ? 'text-bullish' : d.type === 'sell' ? 'text-bearish' : 't-muted'
                        }`}>
                          {d.type}
                        </span>
                        <span className="font-mono t-secondary">{sym}{d.price.toFixed(2)}</span>
                        <span className="t-muted">{d.date}</span>
                        {d.notes && <span className="t-muted italic truncate" title={d.notes}>{d.notes}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* See Results */}
              {(decisions.length > 0 || isAtEnd) && (
                <button
                  onClick={() => setShowSummary(true)}
                  className="w-full px-4 py-2.5 rounded-lg text-xs font-medium bg-accent/15 text-accent-light ring-1 ring-accent/20 hover:bg-accent/25 transition-colors"
                >
                  See Results
                </button>
              )}
            </div>
          </div>

          {/* Summary Modal */}
          {showSummary && summaryStats && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowSummary(false)}>
              <div className="bg-surface-secondary border border-surface-border rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold t-primary">Replay Results — {selectedTicker}</h2>
                  <button onClick={() => setShowSummary(false)} className="t-muted hover:t-primary text-xl">&times;</button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-surface-hover text-center">
                    <p className="text-xs t-muted mb-1">Your Return</p>
                    <p className={`text-xl font-bold font-mono ${summaryStats.totalReturn >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                      {summaryStats.totalReturn >= 0 ? '+' : ''}{summaryStats.totalReturn.toFixed(2)}%
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-hover text-center">
                    <p className="text-xs t-muted mb-1">Buy &amp; Hold Return</p>
                    <p className={`text-xl font-bold font-mono ${summaryStats.buyHoldReturn >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                      {summaryStats.buyHoldReturn >= 0 ? '+' : ''}{summaryStats.buyHoldReturn.toFixed(2)}%
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-hover text-center">
                    <p className="text-xs t-muted mb-1">Win Rate</p>
                    <p className="text-xl font-bold font-mono t-primary">{summaryStats.winRate.toFixed(0)}%</p>
                    <p className="text-xs t-muted">{summaryStats.wins}/{summaryStats.totalTrades} trades</p>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-hover text-center">
                    <p className="text-xs t-muted mb-1">vs Buy &amp; Hold</p>
                    <p className={`text-xl font-bold font-mono ${summaryStats.totalReturn > summaryStats.buyHoldReturn ? 'text-bullish' : 'text-bearish'}`}>
                      {summaryStats.totalReturn > summaryStats.buyHoldReturn ? 'Beat it' : 'Lost to it'}
                    </p>
                  </div>
                </div>

                {trades.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold t-tertiary uppercase tracking-wider mb-2">Completed Trades</h3>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {trades.map((t, i) => (
                        <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-surface-border/50">
                          <span className="t-secondary">Buy {sym}{t.buyPrice.toFixed(2)} → Sell {sym}{t.sellPrice.toFixed(2)}</span>
                          <span className={`font-mono font-semibold ${t.pnlPct >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                            {t.pnlPct >= 0 ? '+' : ''}{t.pnlPct.toFixed(2)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-xs t-muted italic text-center">
                  {summaryStats.totalReturn > summaryStats.buyHoldReturn
                    ? 'Great job! You outperformed buy and hold.'
                    : "Don't worry — even pros struggle to beat buy & hold. Keep practicing!"}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
