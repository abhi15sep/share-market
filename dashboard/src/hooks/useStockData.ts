import { useState, useEffect } from 'react';
import type { StockRecord, SummaryData, NewsItem, Metadata, InsiderTradesMap, MacroData, SocialSentimentMap, OnlinePicksData } from '../types';

const BASE = import.meta.env.BASE_URL;

export type ScoreHistory = Record<string, Record<string, number>>;

export interface FinancialYear {
  y: string;
  rev: number | null;
  ni: number | null;
  gp: number | null;
  oi: number | null;
}

export type FinancialsMap = Record<string, FinancialYear[]>;

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}data/${path}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function useStockData() {
  const [stocks, setStocks] = useState<StockRecord[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [bearishAlerts, setBearishAlerts] = useState<StockRecord[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [scoreHistory, setScoreHistory] = useState<ScoreHistory | null>(null);
  const [financials, setFinancials] = useState<FinancialsMap | null>(null);
  const [insiderTrades, setInsiderTrades] = useState<InsiderTradesMap | null>(null);
  const [aiResearchNotes, setAiResearchNotes] = useState<Record<string, string[]> | null>(null);
  const [macroData, setMacroData] = useState<MacroData | null>(null);
  const [socialSentiment, setSocialSentiment] = useState<SocialSentimentMap | null>(null);
  const [onlinePicks, setOnlinePicks] = useState<OnlinePicksData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchJson<StockRecord[]>('latest.json'),
      fetchJson<SummaryData>('summary.json'),
      fetchJson<StockRecord[]>('bearish-alerts.json'),
      fetchJson<NewsItem[]>('news-sentiment.json'),
      fetchJson<Metadata>('metadata.json'),
      fetchJson<ScoreHistory>('score-history.json'),
      fetchJson<FinancialsMap>('financials.json'),
      fetchJson<InsiderTradesMap>('insider-trades.json'),
      fetchJson<Record<string, string[]>>('ai-research-notes.json'),
      fetchJson<MacroData>('macro.json'),
      fetchJson<SocialSentimentMap>('social-sentiment.json'),
      fetchJson<OnlinePicksData>('online-picks.json'),
    ]).then(([s, sum, ba, n, m, sh, fin, insider, aiNotes, macro, social, picks]) => {
      setStocks(s || []);
      setSummary(sum || null);
      setBearishAlerts(ba || []);
      setNews(n || []);
      setMetadata(m || null);
      setScoreHistory(sh || null);
      setFinancials(fin || null);
      setInsiderTrades(insider || null);
      setAiResearchNotes(aiNotes || null);
      setMacroData(macro || null);
      setSocialSentiment(social || null);
      setOnlinePicks(picks || null);
    }).catch(err => {
      console.error('Failed to load stock data:', err);
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  return { stocks, summary, bearishAlerts, news, metadata, scoreHistory, financials, insiderTrades, aiResearchNotes, macroData, socialSentiment, onlinePicks, loading };
}
