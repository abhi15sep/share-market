import pLimit from 'p-limit';
import { getYahooCrumb } from '../stocks/fetcher.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export interface AnnualFinancial {
  year: string;           // e.g. "2024"
  endDate: string;        // ISO date
  totalRevenue: number | null;
  netIncome: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  totalStockholderEquity: number | null;
  longTermDebt: number | null;
  currentAssets: number | null;
  currentLiabilities: number | null;
  operatingCashflow: number | null;
  capitalExpenditures: number | null;
  sharesOutstanding: number | null;
}

export interface FinancialData {
  ticker: string;
  annuals: AnnualFinancial[];
  ppiScore: number;           // Piotroski F-Score (0-9)
  ppiDetails: string[];       // Which criteria passed
  grahamNumber: number | null;  // sqrt(22.5 * EPS * BookValue)
  buffettScore: number;       // 0-5 custom Buffett quality score
  buffettDetails: string[];
  beneishMScore: number | null;  // Beneish M-Score (earnings manipulation)
  beneishZone: 'unlikely' | 'possible' | 'likely' | null;
}

async function fetchFinancialStatements(ticker: string, auth: { cookie: string; crumb: string }): Promise<AnnualFinancial[]> {
  const encoded = encodeURIComponent(ticker);
  const modules = 'incomeStatementHistory,balanceSheetHistory,cashflowStatementHistory';
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encoded}?modules=${modules}&crumb=${encodeURIComponent(auth.crumb)}`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Cookie': auth.cookie },
    });
    if (!res.ok) return [];

    const data = await res.json() as any;
    const result = data?.quoteSummary?.result?.[0];
    if (!result) return [];

    const incomeStmts = result.incomeStatementHistory?.incomeStatementHistory ?? [];
    const balanceStmts = result.balanceSheetHistory?.balanceSheetStatements ?? [];
    const cashflowStmts = result.cashflowStatementHistory?.cashflowStatements ?? [];

    // Merge by year
    const years = new Map<string, AnnualFinancial>();

    for (const stmt of incomeStmts) {
      const endDate = stmt.endDate?.fmt ?? '';
      const year = endDate.slice(0, 4);
      if (!year) continue;

      if (!years.has(year)) {
        years.set(year, {
          year, endDate,
          totalRevenue: null, netIncome: null, grossProfit: null,
          operatingIncome: null, totalAssets: null, totalLiabilities: null,
          totalStockholderEquity: null, longTermDebt: null,
          currentAssets: null, currentLiabilities: null,
          operatingCashflow: null, capitalExpenditures: null,
          sharesOutstanding: null,
        });
      }
      const entry = years.get(year)!;
      entry.totalRevenue = stmt.totalRevenue?.raw ?? null;
      entry.netIncome = stmt.netIncome?.raw ?? null;
      entry.grossProfit = stmt.grossProfit?.raw ?? null;
      entry.operatingIncome = stmt.operatingIncome?.raw ?? null;
    }

    for (const stmt of balanceStmts) {
      const year = (stmt.endDate?.fmt ?? '').slice(0, 4);
      if (!year || !years.has(year)) continue;
      const entry = years.get(year)!;
      entry.totalAssets = stmt.totalAssets?.raw ?? null;
      entry.totalLiabilities = stmt.totalLiab?.raw ?? null;
      entry.totalStockholderEquity = stmt.totalStockholderEquity?.raw ?? null;
      entry.longTermDebt = stmt.longTermDebt?.raw ?? null;
      entry.currentAssets = stmt.totalCurrentAssets?.raw ?? null;
      entry.currentLiabilities = stmt.totalCurrentLiabilities?.raw ?? null;
    }

    for (const stmt of cashflowStmts) {
      const year = (stmt.endDate?.fmt ?? '').slice(0, 4);
      if (!year || !years.has(year)) continue;
      const entry = years.get(year)!;
      entry.operatingCashflow = stmt.totalCashFromOperatingActivities?.raw ?? null;
      entry.capitalExpenditures = stmt.capitalExpenditures?.raw ?? null;
    }

    return [...years.values()].sort((a, b) => b.year.localeCompare(a.year));
  } catch {
    return [];
  }
}

// Criteria computed from income statement history (balance sheet & cashflow API modules no longer return data).
// Criteria 2-7 are supplemented at stock-assembly time using quote-level financial fields.
function computePiotroski(annuals: AnnualFinancial[]): { score: number; details: string[] } {
  if (annuals.length < 2) return { score: 0, details: [] };

  const curr = annuals[0];
  const prev = annuals[1];
  const details: string[] = [];
  let score = 0;

  // 1. Positive net income
  if (curr.netIncome != null && curr.netIncome > 0) { score++; details.push('Positive net income'); }

  // 8. Improving gross margin YoY
  const currGM = curr.grossProfit != null && curr.totalRevenue != null && curr.totalRevenue > 0
    ? curr.grossProfit / curr.totalRevenue : null;
  const prevGM = prev.grossProfit != null && prev.totalRevenue != null && prev.totalRevenue > 0
    ? prev.grossProfit / prev.totalRevenue : null;
  if (currGM != null && prevGM != null && currGM > prevGM) { score++; details.push('Improving gross margin'); }

  // 9. Revenue growing YoY (asset turnover proxy — total assets not available via API)
  if (curr.totalRevenue != null && prev.totalRevenue != null && prev.totalRevenue > 0
      && curr.totalRevenue > prev.totalRevenue) {
    score++; details.push('Revenue growing YoY');
  }

  return { score, details };
}

function computeGrahamNumber(eps: number | null, bookValue: number | null): number | null {
  if (eps == null || bookValue == null || eps <= 0 || bookValue <= 0) return null;
  return +Math.sqrt(22.5 * eps * bookValue).toFixed(2);
}

function computeBuffettScore(annuals: AnnualFinancial[]): { score: number; details: string[] } {
  if (annuals.length < 2) return { score: 0, details: ['Insufficient data'] };

  const curr = annuals[0];
  const details: string[] = [];
  let score = 0;

  // 1. Consistent profitability (net income positive for all available years)
  const allProfitable = annuals.every(a => a.netIncome != null && a.netIncome > 0);
  if (allProfitable) { score++; details.push('Consistently profitable'); }

  // 2. High ROE (>15%)
  if (curr.netIncome != null && curr.totalStockholderEquity != null && curr.totalStockholderEquity > 0) {
    const roe = curr.netIncome / curr.totalStockholderEquity;
    if (roe > 0.15) { score++; details.push(`High ROE (${(roe * 100).toFixed(1)}%)`); }
  }

  // 3. Low debt (debt/equity < 0.5)
  if (curr.longTermDebt != null && curr.totalStockholderEquity != null && curr.totalStockholderEquity > 0) {
    const de = curr.longTermDebt / curr.totalStockholderEquity;
    if (de < 0.5) { score++; details.push('Low debt-to-equity'); }
  }

  // 4. Growing revenue
  if (annuals.length >= 2 && curr.totalRevenue != null && annuals[1].totalRevenue != null && annuals[1].totalRevenue > 0) {
    const growth = (curr.totalRevenue - annuals[1].totalRevenue) / annuals[1].totalRevenue;
    if (growth > 0) { score++; details.push('Revenue growing'); }
  }

  // 5. Positive free cash flow
  if (curr.operatingCashflow != null && curr.capitalExpenditures != null) {
    const fcf = curr.operatingCashflow + curr.capitalExpenditures; // capex is negative
    if (fcf > 0) { score++; details.push('Positive free cash flow'); }
  }

  return { score, details };
}

/**
 * Beneish M-Score: 8-variable model to detect earnings manipulation.
 * M-Score > -1.78 suggests possible manipulation.
 */
function computeBeneishMScore(annuals: AnnualFinancial[]): { mScore: number | null; zone: 'unlikely' | 'possible' | 'likely' | null } {
  if (annuals.length < 2) return { mScore: null, zone: null };
  const curr = annuals[0];
  const prev = annuals[1];

  // Need revenue, receivables proxy, gross profit, total assets, depreciation proxy, SGA proxy, net income, cash flow
  const revC = curr.totalRevenue;
  const revP = prev.totalRevenue;
  const gpC = curr.grossProfit;
  const gpP = prev.grossProfit;
  const taC = curr.totalAssets;
  const taP = prev.totalAssets;
  const niC = curr.netIncome;
  const caC = curr.currentAssets;
  const caP = prev.currentAssets;
  const clC = curr.currentLiabilities;
  const clP = prev.currentLiabilities;
  const ltdC = curr.longTermDebt ?? 0;
  const ltdP = prev.longTermDebt ?? 0;
  const oiC = curr.operatingIncome;
  const oiP = prev.operatingIncome;
  const ocfC = curr.operatingCashflow;

  if (revC == null || revP == null || revP === 0 || taC == null || taP == null || taP === 0 ||
      gpC == null || gpP == null) return { mScore: null, zone: null };

  // DSRI: Days Sales in Receivables Index (proxy: current assets - cash proxy)
  const recC = (caC ?? 0) * 0.3; // rough receivables proxy
  const recP = (caP ?? 0) * 0.3;
  const dsri = recP > 0 && revP > 0 ? (recC / revC!) / (recP / revP) : 1;

  // GMI: Gross Margin Index
  const gmC = revC > 0 ? gpC / revC : 0;
  const gmP = revP > 0 ? gpP / revP : 0;
  const gmi = gmC > 0 ? gmP / gmC : 1; // inverted: higher = margin declining

  // AQI: Asset Quality Index
  const ppC = taC - (caC ?? 0);
  const ppP = taP - (caP ?? 0);
  const aqiC = taC > 0 ? 1 - (ppC / taC) : 0;
  const aqiP = taP > 0 ? 1 - (ppP / taP) : 0;
  const aqi = aqiP > 0 ? aqiC / aqiP : 1;

  // SGI: Sales Growth Index
  const sgi = revP > 0 ? revC / revP : 1;

  // DEPI: Depreciation Index (proxy from operating income vs gross profit)
  const depC = gpC - (oiC ?? gpC);
  const depP = gpP - (oiP ?? gpP);
  const depRateC = (ppC + depC) > 0 ? depC / (ppC + depC) : 0;
  const depRateP = (ppP + depP) > 0 ? depP / (ppP + depP) : 0;
  const depi = depRateC > 0 ? depRateP / depRateC : 1;

  // SGAI: SGA Expense Index (proxy: revenue - gross profit - operating income approximation)
  const sgaC = revC > 0 ? ((revC - gpC) / revC) : 0;
  const sgaP = revP > 0 ? ((revP - gpP) / revP) : 0;
  const sgai = sgaP > 0 ? sgaC / sgaP : 1;

  // LVGI: Leverage Index
  const leverageC = taC > 0 ? (clC ?? 0 + ltdC) / taC : 0;
  const leverageP = taP > 0 ? (clP ?? 0 + ltdP) / taP : 0;
  const lvgi = leverageP > 0 ? leverageC / leverageP : 1;

  // TATA: Total Accruals to Total Assets
  const tata = taC > 0 && niC != null && ocfC != null ? (niC - ocfC) / taC : 0;

  // M-Score = -4.84 + 0.92*DSRI + 0.528*GMI + 0.404*AQI + 0.892*SGI + 0.115*DEPI - 0.172*SGAI + 4.679*TATA - 0.327*LVGI
  const mScore = +(-4.84 + 0.92 * dsri + 0.528 * gmi + 0.404 * aqi + 0.892 * sgi +
    0.115 * depi - 0.172 * sgai + 4.679 * tata - 0.327 * lvgi).toFixed(2);

  const zone: 'unlikely' | 'possible' | 'likely' =
    mScore < -2.22 ? 'unlikely' :
    mScore < -1.78 ? 'possible' : 'likely';

  return { mScore, zone };
}

export async function fetchFinancials(tickers: string[]): Promise<Map<string, FinancialData>> {
  const result = new Map<string, FinancialData>();
  const auth = await getYahooCrumb();
  if (!auth) {
    console.warn('  Financial statements: Failed to get Yahoo auth');
    return result;
  }

  const limit = pLimit(5);
  console.log(`  Fetching financial statements for ${tickers.length} stocks...`);

  await Promise.all(
    tickers.map((ticker, idx) =>
      limit(async () => {
        const annuals = await fetchFinancialStatements(ticker, auth);
        if (annuals.length === 0) return;

        const ppi = computePiotroski(annuals);
        const buffett = computeBuffettScore(annuals);
        const beneish = computeBeneishMScore(annuals);

        // For Graham number, we need EPS and book value -- get from the latest annual
        const latestEquity = annuals[0]?.totalStockholderEquity;
        const latestShares = annuals[0]?.sharesOutstanding;
        const latestNetIncome = annuals[0]?.netIncome;
        const eps = latestNetIncome != null && latestShares != null && latestShares > 0
          ? latestNetIncome / latestShares : null;
        const bookValue = latestEquity != null && latestShares != null && latestShares > 0
          ? latestEquity / latestShares : null;

        result.set(ticker, {
          ticker,
          annuals,
          ppiScore: ppi.score,
          ppiDetails: ppi.details,
          grahamNumber: computeGrahamNumber(eps, bookValue),
          buffettScore: buffett.score,
          buffettDetails: buffett.details,
          beneishMScore: beneish.mScore,
          beneishZone: beneish.zone,
        });

        if ((idx + 1) % 25 === 0) console.log(`    Financials: ${idx + 1}/${tickers.length}`);
        await delay(200);
      })
    )
  );

  console.log(`  Financial statements: ${result.size}/${tickers.length} fetched`);
  return result;
}
