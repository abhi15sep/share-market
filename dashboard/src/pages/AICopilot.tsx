import { useState, useMemo } from 'react';
import type { StockRecord, Metadata } from '../types';
import AICopilotChat from '../components/common/AICopilotChat';
import { currencySymbol } from '../lib/format';
import { ScoreBadge, ChangePercent, MarketTag } from '../components/common/Tags';

interface Props {
  stocks: StockRecord[];
  metadata?: Metadata | null;
}

export default function AICopilot({ stocks, metadata }: Props) {
  const [selectedTicker, setSelectedTicker] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return stocks
      .filter(s => s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [searchQuery, stocks]);

  const contextStock = useMemo(() => {
    if (!selectedTicker) return null;
    return stocks.find(s => s.ticker === selectedTicker) ?? null;
  }, [selectedTicker, stocks]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold t-primary">AI Copilot</h1>
        <p className="text-sm t-muted mt-1">Ask questions about any stock or the overall market</p>
      </div>

      {/* Ticker selector */}
      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative">
            <label className="text-xs t-muted block mb-1">Stock Context (optional)</label>
            <input
              type="text"
              value={selectedTicker || searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setSelectedTicker(''); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              placeholder="Select a ticker..."
              className="input-field w-48"
            />
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute top-full left-0 mt-1 w-72 bg-surface-secondary border border-surface-border rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                {searchResults.map(s => (
                  <button
                    key={s.ticker}
                    onMouseDown={() => { setSelectedTicker(s.ticker); setSearchQuery(''); setShowDropdown(false); }}
                    className="w-full text-left px-3 py-2 hover:bg-surface-hover transition-colors flex items-center gap-2"
                  >
                    <span className="font-semibold text-accent-light text-sm">{s.ticker}</span>
                    <span className="t-muted text-xs truncate">{s.name}</span>
                    <span className="ml-auto font-mono text-xs t-secondary">{s.score.composite}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedTicker && (
            <button
              onClick={() => { setSelectedTicker(''); setSearchQuery(''); }}
              className="text-xs px-2 py-1.5 rounded bg-surface-hover t-muted hover:t-secondary transition-colors"
            >
              Clear
            </button>
          )}
          {contextStock && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-accent-light">{contextStock.ticker}</span>
                <MarketTag market={contextStock.market} />
                <span className="t-muted text-xs">{contextStock.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono t-primary">{currencySymbol(contextStock.market)}{contextStock.price.toFixed(2)}</span>
                <ChangePercent value={contextStock.changePercent} />
                <ScoreBadge score={contextStock.score.composite} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat */}
      <AICopilotChat
        stocks={stocks}
        contextStock={contextStock}
        metadata={metadata}
        expanded={true}
      />

      {/* Tips */}
      <div className="card p-4">
        <h3 className="text-xs font-semibold t-tertiary uppercase tracking-wider mb-2">Tips</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs t-muted">
          <div>
            <p className="font-medium t-secondary mb-1">Instant answers (no API key):</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>"What is the score for AAPL?"</li>
              <li>"Compare AAPL vs MSFT"</li>
              <li>"Top 5 stocks by dividend"</li>
              <li>"Why is NVDA bullish?"</li>
              <li>"Is TSLA overvalued?"</li>
              <li>"What are the risks for META?"</li>
            </ul>
          </div>
          <div>
            <p className="font-medium t-secondary mb-1">AI-powered (needs API key):</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>"Should I buy this stock?"</li>
              <li>"What's your outlook for tech?"</li>
              <li>"Explain the signals"</li>
              <li>Any open-ended question</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
