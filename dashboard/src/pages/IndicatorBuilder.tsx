/**
 * N30: AI-Powered Indicator Builder
 * Describe screening rules in plain English → AI generates filter → run against all stocks
 */
import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { StockRecord } from '../types';
import { ScoreBadge, ChangePercent, MarketTag, CapTag } from '../components/common/Tags';
import { currencySymbol } from '../lib/format';
import { generateIndicator, executeFilter, STOCK_FIELDS_REFERENCE } from '../lib/indicator-ai';
import { hasApiKey, setApiKey, clearApiKey, getProviders, getProvider, setProvider, type ProviderName } from '../lib/copilot-llm';

interface SavedIndicator {
  name: string;
  description: string;
  code: string;
  savedAt: string;
}

const SAVED_KEY = 'sm-custom-indicators';

function readSaved(): SavedIndicator[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
  } catch { return []; }
}

function writeSaved(indicators: SavedIndicator[]) {
  localStorage.setItem(SAVED_KEY, JSON.stringify(indicators));
}

const EXAMPLES = [
  { label: 'Oversold large caps with good fundamentals', desc: 'Large cap stocks with RSI below 30, PE under 25, and composite score above 50' },
  { label: 'High growth with reasonable P/E', desc: 'Stocks with revenue growth over 20%, earnings growth over 15%, and forward PE under 30' },
  { label: 'Momentum leaders near breakout', desc: 'Stocks within 5% of 52-week high, RSI between 50-70, volume ratio above 1.5, and Minervini checks passed at least 6' },
  { label: 'Dividend value picks', desc: 'Stocks with dividend yield above 2%, PE under 20, debt to equity under 1, and Piotroski score above 6' },
];

export default function IndicatorBuilder({ stocks }: { stocks: StockRecord[] }) {
  const [description, setDescription] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editedCode, setEditedCode] = useState('');
  const [matches, setMatches] = useState<StockRecord[]>([]);
  const [filterError, setFilterError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [savedIndicators, setSavedIndicators] = useState<SavedIndicator[]>(readSaved);
  const [saveName, setSaveName] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasKey, setHasKey] = useState(hasApiKey());
  const [selectedProvider, setSelectedProvider] = useState<ProviderName>(getProvider());

  const activeCode = editMode ? editedCode : generatedCode;

  const handleSaveApiKey = async () => {
    if (apiKeyInput.trim()) {
      await setApiKey(apiKeyInput.trim());
      setHasKey(true);
      setApiKeyInput('');
    }
  };

  const handleClearApiKey = () => {
    clearApiKey();
    setHasKey(false);
  };

  const handleGenerate = useCallback(async () => {
    if (!description.trim()) return;
    setGenerating(true);
    setFilterError('');
    setMatches([]);
    setGeneratedCode('');

    const result = await generateIndicator(description);

    if (result.error) {
      setFilterError(result.error);
    } else {
      setGeneratedCode(result.code);
      setEditedCode(result.code);
      // Auto-run
      const { matches: m, error } = executeFilter(result.code, stocks);
      setMatches(m);
      if (error) setFilterError(error);
    }
    setGenerating(false);
  }, [description, stocks]);

  const handleRun = useCallback(() => {
    setFilterError('');
    const code = editMode ? editedCode : generatedCode;
    if (!code.trim()) return;
    const { matches: m, error } = executeFilter(code, stocks);
    setMatches(m);
    if (error) setFilterError(error);
  }, [editMode, editedCode, generatedCode, stocks]);

  const handleSave = useCallback(() => {
    if (!saveName.trim() || !activeCode.trim()) return;
    const updated = [...savedIndicators, {
      name: saveName,
      description,
      code: activeCode,
      savedAt: new Date().toISOString(),
    }];
    setSavedIndicators(updated);
    writeSaved(updated);
    setSaveName('');
  }, [saveName, description, activeCode, savedIndicators]);

  const loadIndicator = useCallback((ind: SavedIndicator) => {
    setDescription(ind.description);
    setGeneratedCode(ind.code);
    setEditedCode(ind.code);
    setEditMode(false);
    // Auto-run
    const { matches: m, error } = executeFilter(ind.code, stocks);
    setMatches(m);
    setFilterError(error ?? '');
  }, [stocks]);

  const deleteIndicator = useCallback((idx: number) => {
    const updated = savedIndicators.filter((_, i) => i !== idx);
    setSavedIndicators(updated);
    writeSaved(updated);
  }, [savedIndicators]);

  const noApiKey = !hasKey;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold t-primary">AI Indicator Builder</h1>
          <p className="text-sm t-muted mt-1">Describe stock screening rules in plain English. AI generates a filter and runs it against all {stocks.length} stocks.</p>
        </div>
        <button
          onClick={() => setShowApiKeyInput(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            hasKey
              ? 'bg-bullish/15 text-bullish ring-1 ring-bullish/30'
              : 'bg-surface-hover t-muted ring-1 ring-surface-border hover:t-secondary'
          }`}
          title={hasKey ? 'API key set — click to change provider or key' : 'Set API key for AI generation'}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          {hasKey ? 'API Key Set' : 'Set API Key'}
        </button>
      </div>

      {/* Provider & API Key Panel */}
      {showApiKeyInput && (() => {
        const providers = getProviders();
        const selected = providers.find(p => p.key === selectedProvider);
        return (
          <div className="card p-4 space-y-3 border-l-4 border-l-accent">
            <div>
              <p className="text-xs font-semibold t-tertiary uppercase tracking-wider mb-2">LLM Provider</p>
              <div className="flex flex-wrap gap-1.5">
                {providers.map(p => (
                  <button
                    key={p.key}
                    onClick={() => { setSelectedProvider(p.key); setProvider(p.key); }}
                    title={`${p.modelName} — ${p.site}`}
                    className={`text-xs px-2.5 py-1.5 rounded transition-colors ${
                      selectedProvider === p.key
                        ? 'bg-accent/20 text-accent-light ring-1 ring-accent/30'
                        : 'bg-surface-hover t-muted hover:t-secondary'
                    }`}
                  >
                    {p.label}
                    {p.free && <span className="ml-1 text-[9px] text-bullish">free</span>}
                  </button>
                ))}
              </div>
            </div>

            {selected && (
              <div className="rounded-lg bg-surface-hover/50 px-3 py-2.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium t-secondary">{selected.label} — {selected.modelName}</span>
                  {selected.free
                    ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-bullish/15 text-bullish">Free</span>
                    : <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-500">Paid</span>
                  }
                </div>
                <p className="text-[10px] t-muted font-mono leading-relaxed whitespace-pre-line">{selected.steps}</p>
              </div>
            )}

            <div>
              <p className="text-xs t-muted mb-1.5">API Key:</p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={e => setApiKeyInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveApiKey(); }}
                  placeholder={selected?.hint ?? 'Enter API key...'}
                  className="input-field flex-1 text-xs"
                />
                <button onClick={handleSaveApiKey} className="text-xs px-3 py-1.5 rounded bg-accent/15 text-accent-light hover:bg-accent/25 transition-colors">Save</button>
                {hasKey && (
                  <button onClick={handleClearApiKey} className="text-xs px-3 py-1.5 rounded bg-bearish/15 text-bearish hover:bg-bearish/25 transition-colors">Clear</button>
                )}
              </div>
            </div>
            <p className="text-[10px] t-faint leading-relaxed">
              Your API key is encrypted (AES-256-GCM) and stored locally in your browser. It is never sent to our servers — only used for direct API calls from your browser to the LLM provider.
            </p>
          </div>
        );
      })()}

      {noApiKey && !showApiKeyInput && (
        <div className="card p-4 border-l-4 border-l-amber-500">
          <p className="text-sm t-secondary">
            <strong className="text-amber-400">API key required.</strong>{' '}
            Click the "Set API Key" button above to configure a free LLM provider (Groq, Gemini, or OpenRouter).
          </p>
        </div>
      )}

      {/* Input Section */}
      <div className="card p-5 space-y-4">
        <div>
          <label className="text-xs font-semibold t-tertiary uppercase tracking-wider block mb-2">Describe your screen</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g., Large cap tech stocks with RSI below 40, revenue growth over 15%, and composite score above 60"
            className="input-field w-full h-20 text-sm resize-none"
          />
        </div>

        {/* Example suggestions */}
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map(ex => (
            <button
              key={ex.label}
              onClick={() => setDescription(ex.desc)}
              className="text-xs px-3 py-1.5 rounded-full bg-surface-hover t-muted ring-1 ring-surface-border hover:t-secondary hover:ring-accent/30 transition-colors"
            >
              {ex.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={generating || !description.trim() || noApiKey}
            className="px-5 py-2 rounded-lg text-sm font-medium bg-accent/15 text-accent-light ring-1 ring-accent/20 hover:bg-accent/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {generating ? 'Generating...' : 'Generate & Run'}
          </button>
          {generatedCode && (
            <button
              onClick={handleRun}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-bullish/15 text-bullish ring-1 ring-bullish/20 hover:bg-bullish/25 transition-colors"
            >
              Re-run Filter
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {filterError && (
        <div className="card p-3 border-l-4 border-l-bearish">
          <p className="text-xs text-bearish">{filterError}</p>
        </div>
      )}

      {/* Generated Code */}
      {generatedCode && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold t-tertiary uppercase tracking-wider">Generated Filter Function</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setEditMode(v => !v); if (!editMode) setEditedCode(generatedCode); }}
                className="text-xs px-3 py-1 rounded bg-surface-hover t-muted ring-1 ring-surface-border hover:t-secondary transition-colors"
              >
                {editMode ? 'Lock' : 'Edit'}
              </button>
            </div>
          </div>

          {editMode ? (
            <textarea
              value={editedCode}
              onChange={e => setEditedCode(e.target.value)}
              className="input-field w-full h-24 font-mono text-xs resize-none"
            />
          ) : (
            <pre className="p-3 rounded-lg bg-surface-hover text-xs font-mono t-secondary overflow-x-auto whitespace-pre-wrap">
              {generatedCode}
            </pre>
          )}

          {/* Save */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              placeholder="Name this indicator..."
              className="input-field flex-1 text-xs"
            />
            <button
              onClick={handleSave}
              disabled={!saveName.trim()}
              className="px-3 py-1.5 rounded text-xs font-medium bg-accent/15 text-accent-light ring-1 ring-accent/20 hover:bg-accent/25 transition-colors disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {matches.length > 0 && (
        <div className="card-flat overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold t-tertiary uppercase tracking-wider">Results</h3>
              <p className="text-xs t-muted mt-0.5">{matches.length} of {stocks.length} stocks match</p>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-surface-secondary">
                <tr className="border-b border-surface-border bg-surface-tertiary/30">
                  <th className="px-4 py-2.5 text-left table-header text-xs">Ticker</th>
                  <th className="px-3 py-2.5 text-left table-header text-xs">Name</th>
                  <th className="px-3 py-2.5 text-left table-header text-xs">Market</th>
                  <th className="px-3 py-2.5 text-left table-header text-xs">Cap</th>
                  <th className="px-3 py-2.5 text-right table-header text-xs">Price</th>
                  <th className="px-3 py-2.5 text-right table-header text-xs">Change</th>
                  <th className="px-3 py-2.5 text-center table-header text-xs">Score</th>
                  <th className="px-3 py-2.5 text-left table-header text-xs">Sector</th>
                </tr>
              </thead>
              <tbody>
                {matches.slice(0, 100).map(s => (
                  <tr key={s.ticker} className="border-b border-surface-border/50 hover:bg-surface-hover/50 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link to={`/stock/${s.ticker}`} className="font-bold text-sm text-accent-light hover:underline">
                        {s.ticker}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 t-muted text-xs truncate max-w-[150px]">{s.name}</td>
                    <td className="px-3 py-2.5"><MarketTag market={s.market} /></td>
                    <td className="px-3 py-2.5"><CapTag cap={s.capCategory} /></td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-xs t-secondary">
                      {currencySymbol(s.market)}{s.price.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-right"><ChangePercent value={s.changePercent} /></td>
                    <td className="px-3 py-2.5 text-center"><ScoreBadge score={s.score.composite} size="sm" /></td>
                    <td className="px-3 py-2.5 text-xs t-faint">{s.sector}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {matches.length > 100 && (
              <p className="text-xs t-muted text-center py-3">Showing first 100 of {matches.length} matches</p>
            )}
          </div>
        </div>
      )}

      {generatedCode && matches.length === 0 && !filterError && (
        <div className="card p-8 text-center">
          <p className="text-lg font-semibold t-primary mb-2">No matches</p>
          <p className="t-muted text-sm">No stocks matched the generated filter. Try adjusting your criteria.</p>
        </div>
      )}

      {/* Saved Indicators */}
      {savedIndicators.length > 0 && (
        <div className="card p-5">
          <h3 className="text-xs font-semibold t-tertiary uppercase tracking-wider mb-3">Saved Indicators</h3>
          <div className="space-y-2">
            {savedIndicators.map((ind, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-surface-hover border border-surface-border">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium t-primary">{ind.name}</p>
                  <p className="text-xs t-muted truncate">{ind.description}</p>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <button
                    onClick={() => loadIndicator(ind)}
                    className="text-xs px-3 py-1 rounded bg-accent/15 text-accent-light ring-1 ring-accent/20 hover:bg-accent/25 transition-colors"
                  >
                    Load
                  </button>
                  <button
                    onClick={() => deleteIndicator(i)}
                    className="text-xs px-2 py-1 rounded bg-bearish/10 text-bearish ring-1 ring-bearish/20 hover:bg-bearish/20 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Field Reference */}
      <div className="card p-4 bg-accent/5 border-accent/15">
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium t-secondary select-none">
            <span className="text-xs t-muted group-open:rotate-90 transition-transform">&#9654;</span>
            Available Stock Fields Reference
          </summary>
          <pre className="mt-3 p-4 rounded-lg bg-surface-hover text-xs font-mono t-secondary overflow-x-auto whitespace-pre-wrap max-h-[400px] overflow-y-auto">
            {STOCK_FIELDS_REFERENCE}
          </pre>
        </details>
      </div>
    </div>
  );
}
