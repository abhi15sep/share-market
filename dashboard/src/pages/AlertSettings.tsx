import { useState, useEffect, useCallback } from 'react';
import { encryptString } from '../lib/crypto';

interface AlertRule {
  id: string;
  type: string;
  ticker: string;
  threshold: number;
  enabled: boolean;
  note?: string;
}

interface AlertConfig {
  rules: AlertRule[];
}

const ALERT_TYPES: {
  value: string;
  label: string;
  desc: string;
  unit?: string;
  thresholdHint?: string;
  needsThreshold: boolean;
  category: 'price' | 'score' | 'technical' | 'pattern' | 'summary';
}[] = [
  { value: 'daily_summary',         label: 'Daily Summary',              desc: 'Send a daily market summary at the first ETL run',                           needsThreshold: false, category: 'summary'   },
  { value: 'price_above',           label: 'Price Above',                desc: 'Alert when price rises above threshold',                   unit: '$',   thresholdHint: 'e.g. 200',   needsThreshold: true,  category: 'price'     },
  { value: 'price_below',           label: 'Price Below',                desc: 'Alert when price drops below threshold',                   unit: '$',   thresholdHint: 'e.g. 150',   needsThreshold: true,  category: 'price'     },
  { value: 'score_above',           label: 'Score Above',                desc: 'Alert when composite score rises above threshold',          unit: '/100',thresholdHint: 'e.g. 70',    needsThreshold: true,  category: 'score'     },
  { value: 'score_below',           label: 'Score Below',                desc: 'Alert when composite score drops below threshold',          unit: '/100',thresholdHint: 'e.g. 40',    needsThreshold: true,  category: 'score'     },
  { value: 'bearish_score_above',   label: 'Bearish Score Above',        desc: 'Alert when bearish signal count exceeds threshold',         unit: '/7',  thresholdHint: 'e.g. 4',     needsThreshold: true,  category: 'score'     },
  { value: 'rsi_above',             label: 'RSI Above (Overbought)',      desc: 'Alert when RSI goes above threshold — typically 70+',      unit: '',    thresholdHint: 'e.g. 70',    needsThreshold: true,  category: 'technical' },
  { value: 'rsi_below',             label: 'RSI Below (Oversold)',        desc: 'Alert when RSI drops below threshold — typically 30',      unit: '',    thresholdHint: 'e.g. 30',    needsThreshold: true,  category: 'technical' },
  { value: 'minervini_pass',        label: 'Minervini Checks ≥',          desc: 'Alert when a stock passes N or more Minervini criteria',   unit: '/8',  thresholdHint: 'e.g. 6',     needsThreshold: true,  category: 'technical' },
  { value: 'uptrend_below_resistance', label: 'Uptrend Below Resistance %', desc: 'Alert when multi-year uptrend stock is N% below resistance', unit: '%', thresholdHint: 'e.g. 5', needsThreshold: true,  category: 'pattern'   },
  { value: 'top_owned_drop',        label: 'Top Owned Drop %',           desc: 'Alert when a top institutional stock drops N% from 52W high', unit: '%', thresholdHint: 'e.g. 10',  needsThreshold: true,  category: 'pattern'   },
  { value: 'dividend_at_support',   label: 'Dividend Stock at Support %', desc: 'Dividend stock (2%+ yield) within N% of support level',    unit: '%',  thresholdHint: 'e.g. 5',    needsThreshold: true,  category: 'pattern'   },
];

const CATEGORY_COLORS: Record<string, string> = {
  summary:   'bg-accent/15 text-accent-light',
  price:     'bg-sky-500/15 text-sky-400',
  score:     'bg-violet-500/15 text-violet-400',
  technical: 'bg-amber-500/15 text-amber-400',
  pattern:   'bg-emerald-500/15 text-emerald-400',
};

function typeLabel(value: string): string {
  return ALERT_TYPES.find(t => t.value === value)?.label
    ?? value.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function typeMeta(value: string) {
  return ALERT_TYPES.find(t => t.value === value);
}

const STORAGE_KEY      = 'sm-alert-rules';
const FINNHUB_KEY_STORE = 'sm-finnhub-api-key';

export default function AlertSettings() {
  const [rules, setRules]           = useState<AlertRule[]>([]);
  const [showAdd, setShowAdd]       = useState(false);
  const [loadingRules, setLoadingRules] = useState(true);
  const [newRule, setNewRule]       = useState<Omit<AlertRule, 'id'>>({
    type: 'daily_summary', ticker: '', threshold: 0, enabled: true, note: '',
  });
  const [copied, setCopied]         = useState(false);

  const [finnhubKey, setFinnhubKey]     = useState('');
  const [finnhubHasKey, setFinnhubHasKey] = useState(false);
  const [finnhubSaved, setFinnhubSaved] = useState(false);

  useEffect(() => {
    setFinnhubHasKey(!!localStorage.getItem(FINNHUB_KEY_STORE));
  }, []);

  const saveFinnhubKey = useCallback(async () => {
    if (!finnhubKey.trim()) return;
    const encrypted = await encryptString(finnhubKey.trim());
    localStorage.setItem(FINNHUB_KEY_STORE, encrypted);
    setFinnhubHasKey(true);
    setFinnhubKey('');
    setFinnhubSaved(true);
    setTimeout(() => setFinnhubSaved(false), 2000);
  }, [finnhubKey]);

  const clearFinnhubKey = useCallback(() => {
    localStorage.removeItem(FINNHUB_KEY_STORE);
    setFinnhubHasKey(false);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}data/alerts.json`);
        if (res.ok) {
          const config: AlertConfig = await res.json();
          if (config.rules?.length) {
            setRules(config.rules);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(config.rules));
            setLoadingRules(false);
            return;
          }
        }
      } catch { /* fall through */ }
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) setRules(JSON.parse(saved));
      } catch { /* ignore */ }
      setLoadingRules(false);
    })();
  }, []);

  useEffect(() => {
    if (!loadingRules) localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  }, [rules, loadingRules]);

  const addRule = () => {
    const meta = typeMeta(newRule.type);
    if (meta?.needsThreshold && !newRule.ticker) return;
    const rule: AlertRule = {
      ...newRule,
      id: `rule-${Date.now()}`,
      ticker: newRule.type === 'daily_summary' ? '*' : newRule.ticker.toUpperCase(),
    };
    setRules(prev => [...prev, rule]);
    setNewRule({ type: 'daily_summary', ticker: '', threshold: 0, enabled: true, note: '' });
    setShowAdd(false);
  };

  const removeRule  = (id: string) => setRules(prev => prev.filter(r => r.id !== id));
  const toggleRule  = (id: string) => setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));

  const configJson = () => JSON.stringify({ rules } as AlertConfig, null, 2);

  const copyJson = () => {
    navigator.clipboard.writeText(configJson()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const downloadJson = () => {
    const blob = new Blob([configJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'alerts.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const meta = typeMeta(newRule.type);
  const activeCount   = rules.filter(r => r.enabled).length;
  const disabledCount = rules.length - activeCount;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-bold t-primary">Alert Settings</h1>
        <p className="text-sm t-muted mt-1">
          Configure price, score, and signal alerts. Notifications are sent via Telegram when the ETL pipeline runs.
        </p>
      </div>

      {/* Setup Guide — collapsible */}
      <details className="card overflow-hidden group">
        <summary className="px-5 py-4 flex items-center justify-between cursor-pointer list-none select-none hover:bg-surface-hover/30 transition-colors">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-accent-light">Setup Guide</span>
            <span className="text-xs t-faint">Telegram + GitHub Actions</span>
          </div>
          <svg className="w-4 h-4 t-muted transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div className="px-5 pb-5 border-t border-surface-border space-y-3 text-xs t-tertiary pt-4">
          {[
            { n: 1, title: 'Create a Telegram Bot',        body: <>Open Telegram, search for <code className="text-accent-light bg-accent/10 px-1 rounded">@BotFather</code>, send <code className="text-accent-light bg-accent/10 px-1 rounded">/newbot</code>, and follow the prompts. Copy the bot token.</> },
            { n: 2, title: 'Get your Chat ID',              body: <>Start a chat with your bot, then visit <code className="text-accent-light bg-accent/10 px-1 rounded text-[10px]">api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code> to find your chat ID.</> },
            { n: 3, title: 'Add GitHub Secrets',            body: <>In your repo: Settings → Secrets → Actions → Add <code className="text-accent-light bg-accent/10 px-1 rounded">TELEGRAM_BOT_TOKEN</code> and <code className="text-accent-light bg-accent/10 px-1 rounded">TELEGRAM_CHAT_ID</code>.</> },
            { n: 4, title: 'Deploy rules to your repo',     body: <>Configure rules below, click <strong className="t-secondary">Download alerts.json</strong>, then commit the file to <code className="text-accent-light bg-accent/10 px-1 rounded">data/alerts.json</code> in your repo. The ETL checks these rules hourly.</> },
          ].map(({ n, title, body }) => (
            <div key={n} className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/15 flex items-center justify-center text-accent-light font-bold text-xs">{n}</span>
              <div><p className="t-secondary font-medium">{title}</p><p className="mt-0.5">{body}</p></div>
            </div>
          ))}
        </div>
      </details>

      {/* Rules */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-semibold t-tertiary uppercase tracking-wider">Alert Rules</h2>
            {rules.length > 0 && (
              <div className="flex items-center gap-1.5 text-[10px]">
                <span className="text-bullish">{activeCount} active</span>
                {disabledCount > 0 && <span className="t-faint">· {disabledCount} off</span>}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {rules.length > 0 && (
              <>
                <button onClick={copyJson} className="badge bg-surface-tertiary t-secondary ring-1 ring-surface-border hover:bg-surface-hover transition-colors cursor-pointer text-xs px-3 py-1.5">
                  {copied ? 'Copied!' : 'Copy JSON'}
                </button>
                <button onClick={downloadJson} className="badge bg-surface-tertiary t-secondary ring-1 ring-surface-border hover:bg-surface-hover transition-colors cursor-pointer text-xs px-3 py-1.5">
                  Download
                </button>
              </>
            )}
            <button
              onClick={() => setShowAdd(v => !v)}
              className="badge bg-accent/15 text-accent-light ring-1 ring-accent/20 hover:bg-accent/25 transition-colors cursor-pointer text-xs px-3 py-1.5"
            >
              {showAdd ? 'Cancel' : '+ Add Rule'}
            </button>
          </div>
        </div>

        {/* Add form — inline */}
        {showAdd && (
          <div className="mb-4 p-4 rounded-lg bg-surface-hover border border-accent/20 space-y-3">
            <h3 className="text-xs font-semibold t-primary">New Alert Rule</h3>

            <div>
              <label className="text-xs t-muted block mb-1">Alert Type</label>
              <select
                value={newRule.type}
                onChange={e => setNewRule(prev => ({ ...prev, type: e.target.value, threshold: 0 }))}
                className="input-field w-full"
              >
                {(['summary', 'price', 'score', 'technical', 'pattern'] as const).map(cat => (
                  <optgroup key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)}>
                    {ALERT_TYPES.filter(t => t.category === cat).map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {meta && <p className="text-[10px] t-faint mt-1">{meta.desc}</p>}
            </div>

            {meta?.needsThreshold && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs t-muted block mb-1">Ticker <span className="t-faint">(or * for all)</span></label>
                  <input
                    type="text"
                    value={newRule.ticker}
                    onChange={e => setNewRule(prev => ({ ...prev, ticker: e.target.value }))}
                    placeholder="e.g. AAPL or *"
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="text-xs t-muted block mb-1">
                    Threshold {meta.unit && <span className="t-faint">{meta.unit}</span>}
                  </label>
                  <input
                    type="number"
                    value={newRule.threshold || ''}
                    onChange={e => setNewRule(prev => ({ ...prev, threshold: Number(e.target.value) }))}
                    placeholder={meta.thresholdHint ?? '0'}
                    className="input-field w-full"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs t-muted block mb-1">Note <span className="t-faint">(optional)</span></label>
              <input
                type="text"
                value={newRule.note || ''}
                onChange={e => setNewRule(prev => ({ ...prev, note: e.target.value }))}
                placeholder="Why did you set this alert?"
                className="input-field w-full"
              />
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={addRule}
                disabled={meta?.needsThreshold && !newRule.ticker.trim()}
                className="badge bg-accent/15 text-accent-light ring-1 ring-accent/20 hover:bg-accent/25 transition-colors cursor-pointer text-xs px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Add Rule
              </button>
            </div>
          </div>
        )}

        {rules.length === 0 ? (
          <div className="text-center py-8">
            <p className="t-muted text-sm">No alert rules configured yet.</p>
            <p className="t-faint text-xs mt-1">Click "+ Add Rule" to create your first alert.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rules.map(rule => {
              const m = typeMeta(rule.type);
              const catColor = CATEGORY_COLORS[m?.category ?? 'summary'];
              return (
                <div
                  key={rule.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors ${
                    rule.enabled ? 'bg-surface-hover/40 border-surface-border' : 'bg-surface-tertiary/20 border-surface-border/40 opacity-55'
                  }`}
                >
                  {/* Toggle */}
                  <button
                    onClick={() => toggleRule(rule.id)}
                    className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 relative ${rule.enabled ? 'bg-bullish' : 'bg-surface-border'}`}
                    title={rule.enabled ? 'Disable' : 'Enable'}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${rule.enabled ? 'left-[18px]' : 'left-0.5'}`} />
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold t-primary font-mono">{rule.ticker === '*' ? 'ALL' : rule.ticker}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${catColor}`}>
                        {typeLabel(rule.type)}
                      </span>
                      {m?.needsThreshold && rule.threshold > 0 && (
                        <span className="text-xs font-mono t-muted">{rule.threshold}{m.unit}</span>
                      )}
                    </div>
                    {rule.note && <p className="text-xs t-faint mt-0.5 truncate">{rule.note}</p>}
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => removeRule(rule.id)}
                    className="t-faint hover:text-bearish transition-colors flex-shrink-0 w-6 h-6 rounded hover:bg-bearish/10 flex items-center justify-center text-base font-bold"
                    title="Remove rule"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Finnhub API Key */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-xs font-semibold t-tertiary uppercase tracking-wider">Real-Time Prices (Finnhub)</h2>
          {finnhubHasKey && <span className="text-[10px] px-1.5 py-0.5 rounded bg-bullish/15 text-bullish font-medium">Connected</span>}
        </div>
        <p className="text-xs t-muted mb-4">
          Connect to Finnhub's WebSocket for live US market prices during trading hours. Free tier — no credit card required.
        </p>
        <div className="space-y-2 text-xs t-muted mb-4">
          {['Go to finnhub.io and sign up (free)', 'Copy your API key from the Dashboard', 'Paste it below — stored encrypted in your browser, never sent to our servers'].map((s, i) => (
            <div key={i} className="flex gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center text-accent-light font-bold text-[10px]">{i + 1}</span>
              <p className="t-secondary">{s}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs t-muted block mb-1">Finnhub API Key</label>
            <input
              type="password"
              value={finnhubKey}
              onChange={e => setFinnhubKey(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveFinnhubKey(); }}
              placeholder={finnhubHasKey ? '••••••••••••••' : 'Paste your API key'}
              className="input-field w-full"
            />
          </div>
          <button onClick={saveFinnhubKey} className="badge bg-accent/15 text-accent-light ring-1 ring-accent/20 hover:bg-accent/25 transition-colors cursor-pointer text-xs px-4 py-2">
            {finnhubSaved ? 'Saved!' : 'Save Key'}
          </button>
          {finnhubHasKey && (
            <button onClick={clearFinnhubKey} className="badge bg-bearish/15 text-bearish ring-1 ring-bearish/20 hover:bg-bearish/25 transition-colors cursor-pointer text-xs px-4 py-2">
              Remove
            </button>
          )}
        </div>
        {finnhubHasKey && (
          <p className="text-xs text-bullish mt-2">API key configured. Live prices will connect during US market hours (9:30am–4pm ET).</p>
        )}
      </div>

      {/* How Alerts Work */}
      <div className="card p-5">
        <h2 className="text-xs font-semibold t-tertiary uppercase tracking-wider mb-3">How Alerts Work</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {[
            { title: 'Edge-Triggered',    body: "Alerts fire only when a condition newly becomes true. You won't get repeated alerts every hour for the same condition." },
            { title: 'Hourly Checks',     body: 'The ETL runs every hour on weekdays (7am–9pm UTC). Alerts are evaluated after each data refresh.' },
            { title: 'Wildcard Rules',    body: 'Use * as ticker to apply a rule to all tracked stocks — e.g., alert when any stock\'s composite score drops below 40.' },
            { title: 'Deploying Rules',   body: 'Download alerts.json and commit it to data/alerts.json in your repo. The ETL reads this file on each run.' },
          ].map(({ title, body }) => (
            <div key={title} className="p-3 rounded-lg bg-surface-hover border border-surface-border">
              <p className="font-semibold t-secondary mb-1">{title}</p>
              <p className="t-tertiary leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
