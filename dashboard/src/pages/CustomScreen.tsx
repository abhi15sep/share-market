import { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { StockRecord } from '../types';
import { ScoreBadge, MarketTag, CapTag, ChangePercent } from '../components/common/Tags';
import { currencySymbol } from '../lib/format';

/* ─── METRIC DEFINITIONS ─── */
interface MetricDef {
  key: string;
  label: string;
  group: string;
  getValue: (s: StockRecord) => number | null | undefined;
  unit?: string;
  hint?: string;
}

const METRICS: MetricDef[] = [
  // Scoring
  { key: 'score',       label: 'Composite Score',   group: 'Scoring',      getValue: s => s.score.composite },
  { key: 'rs',          label: 'RS Percentile',      group: 'Scoring',      getValue: s => s.rsPercentile },
  { key: 'bearish',     label: 'Bearish Score',      group: 'Scoring',      getValue: s => s.bearishScore },
  { key: 'bullish',     label: 'Bullish Score',      group: 'Scoring',      getValue: s => s.bullishScore },
  { key: 'minervini',   label: 'Minervini Checks',   group: 'Scoring',      getValue: s => s.minerviniChecks.passed },
  { key: 'piotroski',   label: 'Piotroski F-Score',  group: 'Scoring',      getValue: s => s.piotroskiScore },
  { key: 'buffett',     label: 'Buffett Score',       group: 'Scoring',      getValue: s => s.buffettScore },
  // Technical
  { key: 'rsi',         label: 'RSI',                group: 'Technical',    getValue: s => s.rsi, hint: 'Overbought >70, Oversold <30' },
  { key: 'volRatio',    label: 'Volume Ratio',        group: 'Technical',    getValue: s => s.volumeRatio },
  { key: 'range52w',    label: '52W Range %',         group: 'Technical',    getValue: s => s.fiftyTwoWeekRangePercent, unit: '%', hint: '100 = at 52W high' },
  // Returns
  { key: 'change',      label: 'Change % (today)',    group: 'Returns',      getValue: s => s.changePercent, unit: '%' },
  { key: 'return3m',    label: '3M Return %',         group: 'Returns',      getValue: s => s.priceReturn3m != null ? s.priceReturn3m * 100 : null, unit: '%' },
  { key: 'return1y',    label: '1Y Return %',         group: 'Returns',      getValue: s => s.priceReturn1y != null ? s.priceReturn1y * 100 : null, unit: '%' },
  // Valuation
  { key: 'pe',          label: 'P/E Ratio',           group: 'Valuation',    getValue: s => s.pe },
  { key: 'forwardPe',   label: 'Forward P/E',         group: 'Valuation',    getValue: s => s.forwardPe },
  { key: 'peg',         label: 'PEG Ratio',           group: 'Valuation',    getValue: s => s.pegRatio },
  { key: 'pb',          label: 'P/B Ratio',           group: 'Valuation',    getValue: s => s.priceToBook },
  // Fundamentals
  { key: 'roe',         label: 'ROE %',               group: 'Fundamentals', getValue: s => s.returnOnEquity != null ? s.returnOnEquity * 100 : null, unit: '%' },
  { key: 'roa',         label: 'ROA %',               group: 'Fundamentals', getValue: s => s.returnOnAssets != null ? s.returnOnAssets * 100 : null, unit: '%' },
  { key: 'grossMargin', label: 'Gross Margin %',      group: 'Fundamentals', getValue: s => s.grossMargins != null ? s.grossMargins * 100 : null, unit: '%' },
  { key: 'profitMargin',label: 'Profit Margin %',     group: 'Fundamentals', getValue: s => s.profitMargins != null ? s.profitMargins * 100 : null, unit: '%' },
  { key: 'earningsGrowth', label: 'Earnings Growth %',group: 'Fundamentals', getValue: s => s.earningsGrowth != null ? s.earningsGrowth * 100 : null, unit: '%' },
  { key: 'revenueGrowth',  label: 'Revenue Growth %', group: 'Fundamentals', getValue: s => s.revenueGrowth != null ? s.revenueGrowth * 100 : null, unit: '%' },
  { key: 'divYield',    label: 'Dividend Yield %',    group: 'Fundamentals', getValue: s => s.dividendYield != null ? s.dividendYield : null, unit: '%' },
  // Risk & balance sheet
  { key: 'de',          label: 'Debt/Equity',         group: 'Risk',         getValue: s => s.debtToEquity },
  { key: 'currentRatio',label: 'Current Ratio',       group: 'Risk',         getValue: s => s.currentRatio },
  { key: 'beta',        label: 'Beta',                group: 'Risk',         getValue: s => s.beta },
  { key: 'volatility',  label: 'Volatility',          group: 'Risk',         getValue: s => s.volatility },
  { key: 'sharpe',      label: 'Sharpe Ratio',        group: 'Risk',         getValue: s => s.sharpeRatio },
  { key: 'altmanZ',     label: 'Altman Z-Score',      group: 'Risk',         getValue: s => s.altmanZScore, hint: '>2.99 safe, <1.81 distress' },
  // Size
  { key: 'marketCapB',  label: 'Market Cap ($B)',      group: 'Size',         getValue: s => s.marketCap > 0 ? s.marketCap / 1e9 : null },
  { key: 'dataQuality', label: 'Data Quality %',      group: 'Other',        getValue: s => s.dataCompleteness, unit: '%' },
];

// Group for the <select> optgroup
const METRIC_GROUPS = [...new Set(METRICS.map(m => m.group))];

type Operator = '>' | '>=' | '<' | '<=' | '=';
const OPERATORS: { op: Operator; label: string }[] = [
  { op: '>=', label: '>=' },
  { op: '>', label: '>' },
  { op: '<=', label: '<=' },
  { op: '<', label: '<' },
  { op: '=', label: '=' },
];

interface FilterRule {
  id: number;
  metricKey: string;
  operator: Operator;
  value: string;
}

interface SavedScreen {
  name: string;
  logic: 'AND' | 'OR';
  rules: Omit<FilterRule, 'id'>[];
}

const STORAGE_KEY = 'sm-custom-screens';
function loadScreens(): SavedScreen[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); } catch { return []; }
}
function saveScreens(screens: SavedScreen[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(screens));
}

/* ─── PRESET TEMPLATES ─── */
const PRESETS: SavedScreen[] = [
  {
    name: 'Minervini Stage 2',
    logic: 'AND',
    rules: [
      { metricKey: 'minervini', operator: '>=', value: '7' },
      { metricKey: 'rs', operator: '>=', value: '80' },
      { metricKey: 'rsi', operator: '>=', value: '50' },
    ],
  },
  {
    name: 'High Quality',
    logic: 'AND',
    rules: [
      { metricKey: 'piotroski', operator: '>=', value: '7' },
      { metricKey: 'roe', operator: '>=', value: '15' },
      { metricKey: 'de', operator: '<=', value: '100' },
    ],
  },
  {
    name: 'Oversold Bounce',
    logic: 'AND',
    rules: [
      { metricKey: 'rsi', operator: '<=', value: '35' },
      { metricKey: 'score', operator: '>=', value: '55' },
      { metricKey: 'volRatio', operator: '>=', value: '1.2' },
    ],
  },
  {
    name: 'Value + Profitable',
    logic: 'AND',
    rules: [
      { metricKey: 'pe', operator: '<=', value: '15' },
      { metricKey: 'pe', operator: '>=', value: '1' },
      { metricKey: 'piotroski', operator: '>=', value: '6' },
      { metricKey: 'roe', operator: '>=', value: '10' },
    ],
  },
  {
    name: 'Safe Dividend',
    logic: 'AND',
    rules: [
      { metricKey: 'divYield', operator: '>=', value: '2' },
      { metricKey: 'de', operator: '<=', value: '100' },
      { metricKey: 'currentRatio', operator: '>=', value: '1.5' },
      { metricKey: 'score', operator: '>=', value: '55' },
    ],
  },
  {
    name: 'Momentum Leaders',
    logic: 'AND',
    rules: [
      { metricKey: 'rs', operator: '>=', value: '85' },
      { metricKey: 'return3m', operator: '>=', value: '10' },
      { metricKey: 'volRatio', operator: '>=', value: '1.3' },
    ],
  },
];

let nextId = 1;

export default function CustomScreen({ stocks }: { stocks: StockRecord[] }) {
  const [rules, setRules] = useState<FilterRule[]>([]);
  const [savedScreens, setSavedScreens] = useState<SavedScreen[]>(loadScreens);
  const [screenName, setScreenName] = useState('');
  const [logic, setLogic] = useState<'AND' | 'OR'>('AND');
  const [sortMetric, setSortMetric] = useState<string>('score');

  const addRule = useCallback(() => {
    setRules(prev => [...prev, { id: nextId++, metricKey: 'score', operator: '>=', value: '60' }]);
  }, []);

  const removeRule = useCallback((id: number) => {
    setRules(prev => prev.filter(r => r.id !== id));
  }, []);

  const updateRule = useCallback((id: number, field: keyof FilterRule, val: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  }, []);

  const loadScreen = useCallback((screen: SavedScreen) => {
    setRules(screen.rules.map(r => ({ ...r, id: nextId++ })));
    setLogic(screen.logic ?? 'AND');
  }, []);

  const saveScreen = useCallback(() => {
    if (!screenName.trim() || rules.length === 0) return;
    const newScreen: SavedScreen = {
      name: screenName.trim(),
      logic,
      rules: rules.map(({ metricKey, operator, value }) => ({ metricKey, operator, value })),
    };
    const updated = [...savedScreens.filter(s => s.name !== newScreen.name), newScreen];
    setSavedScreens(updated);
    saveScreens(updated);
    setScreenName('');
  }, [screenName, rules, logic, savedScreens]);

  const deleteScreen = useCallback((name: string) => {
    const updated = savedScreens.filter(s => s.name !== name);
    setSavedScreens(updated);
    saveScreens(updated);
  }, [savedScreens]);

  const filtered = useMemo(() => {
    if (rules.length === 0) return [];

    const matches = stocks.filter(s => {
      const results = rules.map(rule => {
        const metric = METRICS.find(m => m.key === rule.metricKey);
        if (!metric) return false;
        const val = metric.getValue(s);
        if (val == null) return false;
        const target = parseFloat(rule.value);
        if (isNaN(target)) return false;
        switch (rule.operator) {
          case '>':  return val > target;
          case '>=': return val >= target;
          case '<':  return val < target;
          case '<=': return val <= target;
          case '=':  return Math.abs(val - target) < 0.01;
          default:   return false;
        }
      });
      return logic === 'AND' ? results.every(Boolean) : results.some(Boolean);
    });

    // Sort by selected metric
    const sortDef = METRICS.find(m => m.key === sortMetric);
    if (sortDef) {
      matches.sort((a, b) => {
        const av = sortDef.getValue(a) ?? -Infinity;
        const bv = sortDef.getValue(b) ?? -Infinity;
        return bv - av;
      });
    }

    return matches;
  }, [stocks, rules, logic, sortMetric]);

  const exportCsv = useCallback(() => {
    if (filtered.length === 0) return;
    const activeMetrics = rules.map(r => METRICS.find(m => m.key === r.metricKey)).filter(Boolean) as MetricDef[];
    const headers = ['Ticker', 'Name', 'Market', 'Cap', 'Price', 'Change%', 'Score', ...activeMetrics.map(m => m.label)];
    const rows = filtered.map(s => [
      s.ticker, `"${s.name}"`, s.market, s.capCategory,
      s.price.toFixed(2), s.changePercent.toFixed(2), s.score.composite,
      ...activeMetrics.map(m => { const v = m.getValue(s); return v != null ? (typeof v === 'number' ? v.toFixed(2) : v) : ''; }),
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `screen-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }, [filtered, rules]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold t-primary">Custom Screen Builder</h1>
        <p className="text-sm t-muted mt-1">Create custom screens by combining any metrics with AND/OR logic</p>
      </div>

      {/* Preset templates */}
      <div className="card p-4">
        <h3 className="text-xs font-semibold t-tertiary uppercase tracking-wider mb-3">Templates</h3>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(preset => (
            <button
              key={preset.name}
              onClick={() => loadScreen(preset)}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-surface-tertiary t-secondary hover:t-primary hover:bg-surface-hover border border-surface-border transition-all"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Saved screens */}
      {savedScreens.length > 0 && (
        <div className="card p-4">
          <h3 className="text-xs font-semibold t-tertiary uppercase tracking-wider mb-3">Saved Screens</h3>
          <div className="flex flex-wrap gap-2">
            {savedScreens.map(screen => (
              <div key={screen.name} className="flex items-center gap-0.5">
                <button
                  onClick={() => loadScreen(screen)}
                  className="px-3 py-1.5 rounded-l-md text-xs font-medium bg-accent/15 text-accent-light ring-1 ring-accent/20 hover:bg-accent/25 transition-colors"
                >
                  {screen.name} <span className="t-faint">({screen.rules.length})</span>
                </button>
                <button
                  onClick={() => deleteScreen(screen.name)}
                  className="px-2 py-1.5 rounded-r-md text-xs t-faint hover:text-bearish hover:bg-bearish/10 ring-1 ring-accent/20 transition-colors"
                  title="Delete screen"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rules builder */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h3 className="text-xs font-semibold t-tertiary uppercase tracking-wider">Filter Rules</h3>
            <div className="flex gap-0.5 bg-surface-tertiary rounded-lg p-0.5">
              {(['AND', 'OR'] as const).map(l => (
                <button
                  key={l}
                  onClick={() => setLogic(l)}
                  className={`px-2.5 py-0.5 rounded-md text-xs font-medium transition-all ${
                    logic === l ? 'bg-accent/20 text-accent-light' : 't-muted hover:t-secondary'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={addRule}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-bullish/15 text-bullish ring-1 ring-bullish/20 hover:bg-bullish/25 transition-colors"
          >
            + Add Rule
          </button>
        </div>

        {rules.length === 0 && (
          <p className="text-sm t-faint py-6 text-center">Click "+ Add Rule" or load a template to start building your screen.</p>
        )}

        <div className="space-y-2">
          {rules.map((rule, idx) => {
            const metric = METRICS.find(m => m.key === rule.metricKey);
            return (
              <div key={rule.id} className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg bg-surface-tertiary/30 border border-surface-border">
                <span className="text-xs font-semibold w-8 flex-shrink-0 text-accent-light">
                  {idx === 0 ? 'IF' : logic}
                </span>

                {/* Metric select with optgroups */}
                <select
                  value={rule.metricKey}
                  onChange={e => updateRule(rule.id, 'metricKey', e.target.value)}
                  className="text-xs bg-surface-tertiary border border-surface-border rounded-md px-2 py-1.5 t-secondary flex-1 min-w-[160px]"
                >
                  {METRIC_GROUPS.map(group => (
                    <optgroup key={group} label={group}>
                      {METRICS.filter(m => m.group === group).map(m => (
                        <option key={m.key} value={m.key}>{m.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                <select
                  value={rule.operator}
                  onChange={e => updateRule(rule.id, 'operator', e.target.value)}
                  className="text-xs bg-surface-tertiary border border-surface-border rounded-md px-2 py-1.5 t-secondary w-16"
                >
                  {OPERATORS.map(o => (
                    <option key={o.op} value={o.op}>{o.label}</option>
                  ))}
                </select>

                <input
                  type="number"
                  value={rule.value}
                  onChange={e => updateRule(rule.id, 'value', e.target.value)}
                  className="text-xs bg-surface-tertiary border border-surface-border rounded-md px-2 py-1.5 t-secondary w-24 font-mono"
                  step="any"
                />

                {metric?.unit && (
                  <span className="text-xs t-faint -ml-1">{metric.unit}</span>
                )}

                {metric?.hint && (
                  <span className="text-[10px] t-faint italic hidden sm:inline">{metric.hint}</span>
                )}

                <button
                  onClick={() => removeRule(rule.id)}
                  className="ml-auto text-base t-faint hover:text-bearish hover:bg-bearish/10 px-2 py-0.5 rounded transition-colors"
                  title="Remove rule"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>

        {/* Save row */}
        {rules.length > 0 && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-surface-border">
            <input
              type="text"
              value={screenName}
              onChange={e => setScreenName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveScreen()}
              placeholder="Name this screen..."
              className="text-xs bg-surface-tertiary border border-surface-border rounded-md px-2.5 py-1.5 t-secondary flex-1 max-w-[180px] focus:outline-none focus:ring-1 focus:ring-accent/40"
            />
            <button
              onClick={saveScreen}
              disabled={!screenName.trim()}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-accent/15 text-accent-light ring-1 ring-accent/20 hover:bg-accent/25 disabled:opacity-40 transition-colors"
            >
              Save
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      {rules.length > 0 && (
        <div className="card overflow-hidden">
          {/* Table toolbar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border flex-wrap">
            <span className="badge bg-surface-tertiary t-secondary ring-1 ring-surface-border text-xs">
              {filtered.length} match{filtered.length !== 1 ? 'es' : ''}
            </span>

            <div className="flex items-center gap-1.5">
              <span className="text-xs t-muted">Sort:</span>
              <select
                value={sortMetric}
                onChange={e => setSortMetric(e.target.value)}
                className="text-xs bg-surface-tertiary border border-surface-border rounded-md px-2 py-1 t-secondary"
              >
                {METRIC_GROUPS.map(group => (
                  <optgroup key={group} label={group}>
                    {METRICS.filter(m => m.group === group).map(m => (
                      <option key={m.key} value={m.key}>{m.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {filtered.length > 0 && (
              <button
                onClick={exportCsv}
                className="ml-auto flex items-center gap-1.5 text-xs t-muted hover:t-secondary transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export CSV
              </button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="p-10 text-center">
              <p className="t-muted text-sm">No stocks match all criteria.</p>
              <p className="t-faint text-xs mt-1">Try switching AND → OR, or relaxing one of the thresholds.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-border bg-surface-tertiary/30">
                    <th className="px-4 py-2.5 text-left table-header text-xs">Ticker</th>
                    <th className="px-3 py-2.5 text-left table-header text-xs">Name</th>
                    <th className="px-3 py-2.5 text-left table-header text-xs">Market</th>
                    <th className="px-3 py-2.5 text-left table-header text-xs">Cap</th>
                    <th className="px-3 py-2.5 text-right table-header text-xs">Price</th>
                    <th className="px-3 py-2.5 text-right table-header text-xs">Change</th>
                    <th className="px-3 py-2.5 text-center table-header text-xs">Score</th>
                    {rules.map(r => {
                      const m = METRICS.find(md => md.key === r.metricKey);
                      return (
                        <th key={r.id} className="px-3 py-2.5 text-right table-header text-xs whitespace-nowrap">
                          {m?.label ?? r.metricKey}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 100).map(s => (
                    <tr key={s.ticker} className="border-b border-surface-border/50 hover:bg-surface-hover/50 transition-colors">
                      <td className="px-4 py-2.5">
                        <Link to={`/stock/${s.ticker}`} className="font-bold text-sm text-accent-light hover:underline">
                          {s.ticker}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 t-muted text-xs truncate max-w-[130px]">{s.name}</td>
                      <td className="px-3 py-2.5"><MarketTag market={s.market} /></td>
                      <td className="px-3 py-2.5"><CapTag cap={s.capCategory} /></td>
                      <td className="px-3 py-2.5 text-right font-mono tabular-nums text-xs t-secondary">
                        {currencySymbol(s.market)}{s.price.toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5 text-right"><ChangePercent value={s.changePercent} /></td>
                      <td className="px-3 py-2.5 text-center"><ScoreBadge score={s.score.composite} size="sm" /></td>
                      {rules.map(r => {
                        const m = METRICS.find(md => md.key === r.metricKey);
                        const val = m?.getValue(s);
                        return (
                          <td key={r.id} className="px-3 py-2.5 text-right font-mono tabular-nums text-xs t-secondary">
                            {val != null ? val.toFixed(1) : '--'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length > 100 && (
                <p className="text-xs t-faint p-3 text-center">Showing first 100 of {filtered.length} matches</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
