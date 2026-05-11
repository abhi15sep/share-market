import { useState, useRef, useEffect, useCallback } from 'react';
import type { StockRecord, Metadata } from '../../types';
import { processQuery } from '../../lib/copilot-engine';
import { queryLLM, hasApiKey, setApiKey, clearApiKey, getProviders, getProvider, setProvider, getMode, setMode, type ProviderName, type ChatMessage, type CopilotMode } from '../../lib/copilot-llm';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  source?: 'engine' | 'llm';
}

interface Props {
  stocks: StockRecord[];
  contextStock?: StockRecord | null;
  metadata?: Metadata | null;
  expanded?: boolean;
}

const SUGGESTIONS = [
  'What is the score?',
  'Why is it bullish?',
  'Is it overvalued?',
  'What are the risks?',
  'Show signals',
  'Technical summary',
  'Fundamentals',
  'Insider activity',
];

const GENERAL_SUGGESTIONS = [
  'Top 5 stocks by score',
  'Market regime',
  'Compare AAPL vs MSFT',
  'Best dividend stocks',
  'Top 5 stocks by momentum',
  'Average score',
  'Total stocks',
];

export default function AICopilotChat({ stocks, contextStock, metadata, expanded: initialExpanded }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isExpanded, setIsExpanded] = useState(initialExpanded ?? false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasKey, setHasKey] = useState(hasApiKey());
  const [selectedProvider, setSelectedProvider] = useState<ProviderName>(getProvider());
  const [copilotMode, setCopilotMode] = useState<CopilotMode>(getMode());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  const handleSend = useCallback(async (text?: string) => {
    const query = (text ?? input).trim();
    if (!query) return;

    const userMsg: Message = { id: generateId(), role: 'user', text: query };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    if (copilotMode === 'hybrid') {
      const engineResponse = processQuery(query, stocks, contextStock, metadata);
      if (engineResponse) {
        setMessages(prev => [...prev, {
          id: generateId(),
          role: 'assistant',
          text: engineResponse.text,
          source: 'engine',
        }]);
        return;
      }
    }

    const history: ChatMessage[] = messages
      .filter(m => m.source !== 'engine')
      .map(m => ({ role: m.role, text: m.text }));

    setIsTyping(true);
    try {
      const llmResponse = await queryLLM(query, contextStock, null, history);
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        text: llmResponse.text,
        source: 'llm',
      }]);
    } catch {
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        text: 'Sorry, I encountered an error. Please try again.',
        source: 'llm',
      }]);
    } finally {
      setIsTyping(false);
    }
  }, [input, stocks, contextStock, metadata, messages, copilotMode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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

  const handleModeChange = (mode: CopilotMode) => {
    setCopilotMode(mode);
    setMode(mode);
  };

  const suggestions = contextStock ? SUGGESTIONS : GENERAL_SUGGESTIONS;

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="card p-4 w-full text-left hover:bg-surface-hover transition-colors group"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-accent-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <div>
            <span className="text-sm font-medium t-primary group-hover:text-accent-light transition-colors">AI Copilot</span>
            <p className="text-xs t-muted">Ask questions about {contextStock ? contextStock.ticker : 'the market'}</p>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-accent/15 flex items-center justify-center">
            <svg className="w-3 h-3 text-accent-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <span className="text-xs font-semibold t-tertiary uppercase tracking-wider">AI Copilot</span>
          {contextStock && <span className="text-xs text-accent-light font-mono">{contextStock.ticker}</span>}
        </div>
        <div className="flex items-center gap-1">
          {/* Mode toggle */}
          <div className="flex items-center bg-surface-hover rounded overflow-hidden mr-1">
            <button
              onClick={() => handleModeChange('hybrid')}
              className={`text-[10px] px-1.5 py-1 transition-colors ${copilotMode === 'hybrid' ? 'bg-accent/20 text-accent-light' : 't-muted hover:t-secondary'}`}
              title="Try instant answers first, fall back to AI"
            >Hybrid</button>
            <button
              onClick={() => handleModeChange('ai-only')}
              className={`text-[10px] px-1.5 py-1 transition-colors ${copilotMode === 'ai-only' ? 'bg-accent/20 text-accent-light' : 't-muted hover:t-secondary'}`}
              title="Always use AI (requires API key)"
            >AI Only</button>
          </div>
          {/* API Key toggle */}
          <button
            onClick={() => setShowApiKeyInput(v => !v)}
            className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${hasKey ? 'bg-bullish/15 text-bullish' : 'bg-surface-hover t-muted hover:t-secondary'}`}
            title={hasKey ? 'API key set' : 'Set API key for AI responses'}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </button>
          {/* New chat */}
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="w-6 h-6 rounded flex items-center justify-center bg-surface-hover t-muted hover:t-secondary transition-colors"
              title="New conversation"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
          {/* Collapse */}
          <button
            onClick={() => setIsExpanded(false)}
            className="w-6 h-6 rounded flex items-center justify-center bg-surface-hover t-muted hover:t-secondary transition-colors"
            title="Collapse"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* API Key + Provider input */}
      {showApiKeyInput && (() => {
        const providers = getProviders();
        const selected = providers.find(p => p.key === selectedProvider);
        return (
          <div className="px-4 py-3 border-b border-surface-border bg-surface-tertiary space-y-2.5">
            <div>
              <p className="text-xs t-muted mb-1.5">LLM Provider:</p>
              <div className="flex flex-wrap gap-1.5">
                {providers.map(p => (
                  <button
                    key={p.key}
                    onClick={() => { setSelectedProvider(p.key); setProvider(p.key); }}
                    title={`${p.modelName} — ${p.site}`}
                    className={`text-xs px-2 py-1 rounded transition-colors ${
                      selectedProvider === p.key ? 'bg-accent/20 text-accent-light ring-1 ring-accent/30' : 'bg-surface-hover t-muted hover:t-secondary'
                    }`}
                  >
                    {p.label}
                    {p.free && <span className="ml-1 text-[9px] text-bullish">free</span>}
                  </button>
                ))}
              </div>
            </div>
            {selected && (
              <div className="rounded bg-surface-hover/50 px-2.5 py-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium t-secondary">{selected.label} — {selected.modelName}</span>
                  {selected.free
                    ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-bullish/15 text-bullish">Free</span>
                    : <span className="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-500">Paid</span>
                  }
                </div>
                <p className="text-[10px] t-muted font-mono leading-relaxed whitespace-pre-line">{selected.steps}</p>
              </div>
            )}
            <div>
              <p className="text-xs t-muted mb-1.5">API key:</p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={e => setApiKeyInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveApiKey(); }}
                  placeholder={selected?.hint ?? 'Enter API key...'}
                  className="input-field flex-1 text-xs"
                />
                <button onClick={handleSaveApiKey} className="text-xs px-2 py-1 rounded bg-accent/15 text-accent-light hover:bg-accent/25 transition-colors">Save</button>
                {hasKey && (
                  <button onClick={handleClearApiKey} className="text-xs px-2 py-1 rounded bg-bearish/15 text-bearish hover:bg-bearish/25 transition-colors">Clear</button>
                )}
              </div>
            </div>
            <p className="text-[10px] t-faint leading-relaxed">
              Your API key is encrypted (AES-256-GCM) and stored locally in your browser. It is never sent to our servers — only used for direct API calls from your browser to the LLM provider.
            </p>
          </div>
        );
      })()}

      {/* Messages */}
      <div className="min-h-[16rem] max-h-[32rem] overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="py-6">
            <p className="text-xs t-muted text-center mb-1">Ask me anything about {contextStock ? contextStock.ticker : 'stocks'}</p>
            <p className="text-[10px] t-faint text-center mb-4">
              {copilotMode === 'hybrid'
                ? 'Instant answers for data queries, AI for open-ended questions'
                : 'All queries sent to AI (requires API key)'}
            </p>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {suggestions.map(s => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="text-xs px-2.5 py-1.5 rounded-full bg-surface-hover t-secondary hover:text-accent-light hover:bg-accent/10 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
              msg.role === 'user'
                ? 'bg-accent/15 text-accent-light'
                : 'bg-surface-tertiary t-primary'
            }`}>
              {msg.role === 'assistant' ? (
                <div className="space-y-1">
                  <div
                    className="text-xs leading-relaxed copilot-response"
                    dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.text) }}
                  />
                  {msg.source && (
                    <p className="text-[10px] t-faint">{msg.source === 'engine' ? 'Instant' : 'AI'}</p>
                  )}
                </div>
              ) : (
                <p className="text-xs">{msg.text}</p>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-surface-tertiary rounded-lg px-3 py-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {/* Quick suggestions after messages */}
        {messages.length > 0 && !isTyping && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {suggestions.slice(0, 4).map(s => (
              <button
                key={s}
                onClick={() => handleSend(s)}
                className="text-[10px] px-2 py-1 rounded-full bg-surface-hover t-muted hover:text-accent-light hover:bg-accent/10 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-surface-border">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={contextStock ? `Ask about ${contextStock.ticker}...` : 'Ask about stocks...'}
            className="input-field flex-1 text-sm"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isTyping}
            className="px-3 py-1.5 rounded-lg bg-accent/15 text-accent-light hover:bg-accent/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Render markdown to HTML — handles **bold**, tables (|---|), and line breaks.
 * Input is HTML-escaped first so dangerouslySetInnerHTML is safe.
 */
function formatMarkdown(text: string): string {
  // 1. Escape HTML
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 2. Split into lines and group table blocks
  const lines = escaped.split('\n');
  const output: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Detect table: line starts with '|' and there's a separator line next
    if (line.trim().startsWith('|') && i + 1 < lines.length && /^\|[-| :]+\|/.test(lines[i + 1].trim())) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      output.push(renderTable(tableLines));
      continue;
    }

    // Regular line: apply inline formatting
    const formatted = applyInline(line);
    output.push(formatted ? formatted + '<br/>' : '<br/>');
    i++;
  }

  return output.join('');
}

function applyInline(line: string): string {
  return line
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

function renderTable(lines: string[]): string {
  const rows = lines.map(l =>
    l.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim())
  );

  const isSeparator = (row: string[]) => row.every(c => /^[-: ]+$/.test(c));

  let html = '<div class="overflow-x-auto my-2"><table class="text-[11px] border-collapse w-full">';
  let headerDone = false;

  for (const row of rows) {
    if (isSeparator(row)) { headerDone = true; continue; }
    const tag = !headerDone ? 'th' : 'td';
    const rowClass = !headerDone
      ? 'border-b border-surface-border bg-surface-tertiary/60'
      : 'border-b border-surface-border/40 hover:bg-surface-hover/40';
    html += `<tr class="${rowClass}">`;
    for (const cell of row) {
      html += `<${tag} class="px-2 py-1 text-left ${tag === 'th' ? 'font-semibold t-tertiary uppercase tracking-wide' : 't-secondary'}">${applyInline(cell)}</${tag}>`;
    }
    html += '</tr>';
    if (!headerDone) headerDone = true;
  }

  html += '</table></div>';
  return html;
}
