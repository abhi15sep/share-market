# Plan: Online Stock Picks Aggregator Dashboard

> **Created**: 2026-05-05
> **Goal**: Aggregate daily "stocks to buy now" recommendations from online sources (websites, YouTube channels, Reddit, analyst feeds) into a new dashboard section, updated automatically by the ETL pipeline.

---

## 1. What We're Building

A new page — **"Online Picks"** — that aggregates publicly available stock recommendations from across the internet. Each entry shows:
- Which stock was recommended
- Who recommended it (source + author/channel)
- When (date)
- What they said (brief reason / thesis)
- Type of call (Buy / Strong Buy / Speculative Buy / Watch)
- Price at time of recommendation (if available)
- Current price from our live data (with % change since pick)

This page becomes a **research-sourcing tool** — you can see at a glance what stocks traders/analysts are excited about right now, cross-reference against your own screener, and track how their picks performed.

---

## 2. Sources Researched

### 2.1 Indian Market Sources

| Source | URL | Access Method | Update Freq | Notes |
|--------|-----|---------------|-------------|-------|
| **Moneycontrol — Top Picks** | https://www.moneycontrol.com/brokers-recommendation/ | HTML scrape | Daily | Broker buy/sell recs with target prices |
| **Economic Times — Top Picks** | https://economictimes.indiatimes.com/markets/stocks/recos | HTML scrape | Daily | ET analysts + broker rec summaries |
| **NSE India — Top Gainers** | https://www.nseindia.com/market-data/top-gainers-losers | Official JSON API | Real-time | Not picks per se, but signals momentum |
| **StockEdge — Daily Updates** | https://web.stockedge.com/ | HTML scrape (complex SPA) | Real-time | Good but JS-heavy SPA, hard to scrape |
| **Screener.in** | https://www.screener.in/ | HTML scrape / Apify API | Daily | Pre-built screens (Golden Crossover, etc.) |
| **Investing.com India — News RSS** | https://in.investing.com/rss/news_25.rss | RSS feed | Daily | Market news with analyst views |

### 2.2 US Market Sources

| Source | URL | Access Method | Update Freq | Notes |
|--------|-----|---------------|-------------|-------|
| **Finviz — Analyst Upgrades** | https://finviz.com/news.ashx | HTML scrape (already have!) | Daily | We already scrape FinViz; extend to upgrades |
| **Financial Modeling Prep — Upgrades RSS** | https://financialmodelingprep.com/rss-feed/upgrades-downgrades-feed | Free RSS feed | Daily | Analyst upgrades/downgrades with target prices |
| **Financial Modeling Prep — Price Target RSS** | https://financialmodelingprep.com/rss-feed/price-target-rss-feed | Free RSS feed | Daily | Analyst price target changes |
| **Benzinga — Analyst Ratings** | https://www.benzinga.com/stock-ideas/ | HTML scrape | Daily | Stock ideas + analyst ratings; 130+ articles/day |
| **Seeking Alpha — Top Rated** | https://seekingalpha.com/feed.xml | RSS feed | Daily | Articles with stock picks; rate-limited without auth |
| **Nasdaq — Analyst Activity** | https://www.nasdaq.com/news-and-insights/topic/markets/analyst-activity | HTML scrape | Daily | Upgrades, initiations, price target changes |
| **Reddit — r/stocks / r/IndiaInvestments** | https://www.reddit.com/r/stocks/new.json?limit=25 (JSON API) | Free Reddit JSON API | Daily | Community discussion; requires NLP to extract tickers |
| **ApeWisdom (already integrated!)** | https://apewisdom.io/api/v1.0/filter/all-stocks | Already in use | Hourly | Already pulling from this in social-sentiment.ts |
| **StockTwits — Trending** | https://api.stocktwits.com/api/2/trending/symbols/equities.json | Free REST API | Hourly | Trending tickers with sentiment; no auth needed |

### 2.3 YouTube — Why It's Excluded from ETL

YouTube channels (e.g. "Akshat Shrivastava", "CA Rachana Ranade", "Andrei Jikh", "Meet Kevin") are where many retail traders get stock picks. However:
- YouTube API v3 does not provide video transcripts or community post text programmatically without OAuth
- Video descriptions require per-video API calls and string parsing (high noise, low precision)
- Community posts are not available via the public API
- **Alternative**: We can link to known YouTube channels as reference resources on the dashboard without ETL integration

YouTube will be handled as a **curated static reference list** on the dashboard, not a live data feed.

---

## 3. Data Model

New file: **`data/online-picks.json`**

```typescript
interface OnlinePick {
  id: string;                    // hash of source+ticker+date
  ticker: string;                // e.g. "RELIANCE.NS", "NVDA"
  name: string;                  // company name (matched from our universe or from source)
  market: string;                // "IN", "US", etc.
  source: string;                // "Financial Modeling Prep", "Moneycontrol", etc.
  sourceUrl: string;             // direct URL to the article/post
  sourceType: 'analyst' | 'broker' | 'community' | 'screener' | 'news';
  date: string;                  // ISO date "2026-05-05"
  callType: 'Buy' | 'Strong Buy' | 'Outperform' | 'Overweight' | 'Speculative Buy' | 'Watch' | 'Upgrade';
  analyst: string | null;        // analyst name or channel/author
  priceAtCall: number | null;    // price when recommendation was made
  priceTarget: number | null;    // analyst target price (if available)
  upside: number | null;         // % upside to target from call price
  headline: string;              // short description (1-2 sentences)
  fetchedAt: string;             // ISO datetime when ETL pulled this
}

interface OnlinePicksOutput {
  updatedAt: string;
  picks: OnlinePick[];           // all picks, last 14 days, deduped
}
```

---

## 4. ETL Implementation Plan

### 4.1 New File: `etl/src/research/online-picks.ts`

This module will be called from `etl/src/index.ts` as an additional enrichment step (like `fetchSocialSentiment` today).

**Functions to implement:**

```
fetchFMPUpgrades()        → parse FMP upgrades/downgrades RSS feed (free, no auth)
fetchFMPPriceTargets()    → parse FMP price target RSS feed (free, no auth)
fetchFinvizRatings()      → extend existing finviz-scraper.ts for analyst ratings page
fetchMoneycontrolPicks()  → scrape Moneycontrol broker recommendations HTML
fetchStockTwitsTrending() → call StockTwits public API for trending tickers
fetchRedditPicks()        → call Reddit JSON API + regex ticker extraction
mergeAndDedup()           → combine all sources, dedup by (ticker+date+source), keep 14 days
```

**Integration in `etl/src/index.ts`:**
```typescript
// In the parallel enrichment block (Promise.all):
withTimeout('Online stock picks', () => fetchOnlinePicks(), 60_000, [])
```

**Output:** Merged into `writeOutputs()` → `data/online-picks.json`

### 4.2 Parser Strategy Per Source

**Financial Modeling Prep RSS (priority 1 — easiest, most structured):**
- Parse XML/RSS with built-in Node `xml2js` or simple regex
- Fields available: ticker, company, analyst, rating action (upgrade/downgrade), fromGrade, toGrade, priceTarget, publishedDate, article URL
- Free tier: no API key needed for RSS feeds
- Rate limit: generous (no auth = public feed)

**StockTwits Trending API (priority 2 — already have pattern):**
- `GET https://api.stocktwits.com/api/2/trending/symbols/equities.json`
- Returns: `{symbols: [{symbol, watchlist_count, message_count}]}`
- Already follow this pattern in `social-sentiment.ts`
- Mark as `sourceType: 'community'`, `callType: 'Watch'`

**Reddit JSON API (priority 3 — extend existing ApeWisdom):**
- `GET https://www.reddit.com/r/stocks/new.json?limit=25`
- `GET https://www.reddit.com/r/IndiaInvestments/new.json?limit=25`
- Extract tickers via regex: `\b[A-Z]{2,5}\b` against our known ticker universe
- Already using ApeWisdom for sentiment scores; Reddit JSON API for post titles gives richer context

**Moneycontrol HTML scrape (priority 4 — Indian picks):**
- Target: `https://www.moneycontrol.com/brokers-recommendation/`
- Extract: stock name, broker, recommendation (Buy/Sell/Hold), target price, current price
- Anti-scraping: add user-agent header + 2s delay (as done in `finviz-scraper.ts`)
- Map stock name to ticker via our `in-stocks.csv` lookup

**FinViz News Extension (priority 5 — already scraped):**
- We already scrape `https://finviz.com/news.ashx` in `finviz-scraper.ts`
- Extend to also scrape analyst rating pages: parse entries matching "upgrades to Buy", "initiates with Overweight"
- These already appear in FinViz news headlines

### 4.3 Deduplication & Retention

- Key: `${source}:${ticker}:${date}`
- Retain picks from the last **14 days** (rolling window)
- On each ETL run: load existing `online-picks.json`, merge new picks, prune old ones, write back
- Sort: by date desc, then by sourceType priority (analyst > broker > community > screener)

### 4.4 Error Handling

- Each fetcher wrapped in `withTimeout()` (60s each)
- `continue-on-error` spirit: if a source fails, log warning and continue with others
- Fallback: if `online-picks.json` doesn't exist yet, start fresh

---

## 5. Dashboard UI Plan

### 5.1 New Page: `/online-picks`

**File:** `dashboard/src/pages/OnlinePicks.tsx`

**Layout:**

```
┌─────────────────────────────────────────────────────────┐
│  Online Stock Picks                    [Last updated: 2h ago]
│  Stock recommendations from analysts, brokers & community │
├────────────┬──────────────────────────────────────────────┤
│ FILTERS    │  PICKS TABLE / CARDS                         │
│            │                                              │
│ Market:    │  NVDA  ★ Strong Buy  FMP Analyst  2026-05-05 │
│ [US ▼]     │  Goldman Sachs initiates with $180 target    │
│            │  +12% upside │ Source ↗                      │
│ Source:    │  ─────────────────────────────────────────── │
│ [All ▼]    │  RELIANCE  Buy  Moneycontrol  2026-05-04     │
│            │  Motilal Oswal: ₹1,650 target (+8%)          │
│ Date:      │  ─────────────────────────────────────────── │
│ [7 days ▼] │  TSLA  Watch  Reddit/r/stocks  2026-05-05   │
│            │  Trending in r/stocks (312 mentions today)   │
│ Call Type: │                                              │
│ [Buy+ ▼]   │  [Show 20 more...]                          │
└────────────┴──────────────────────────────────────────────┘
```

**Columns in table view:**
- Ticker + name (linked to our StockDetail page)
- Call type (color-coded badge: green=Buy, yellow=Watch, blue=Upgrade)
- Source (name + icon) + link to original article
- Analyst/Author
- Date
- Price at call vs current price (% change since pick)
- Price target + upside %
- Market tag (US/IN/etc.)

**Cards view (mobile-friendly):** Each pick as a card with all fields.

**Stats bar at top:**
- Total picks today
- Most mentioned ticker (with count)
- Top source
- Pick performance: avg % change since picks made in last 7 days

### 5.2 YouTube Resources Panel (static, curated)

A collapsible section at the bottom linking to known quality YouTube channels by market:

**Indian Markets:**
- Akshat Shrivastava — https://www.youtube.com/@AkshatShrivastava
- CA Rachana Ranade — https://www.youtube.com/@CARachanaRanade
- Pranjal Kamra (Finology) — https://www.youtube.com/@PranjalKamra
- Vivek Bajaj (StockEdge) — https://www.youtube.com/@VivekBajajStockEdge
- Nikhil Kamath — https://www.youtube.com/@nikhilkamathcio

**US Markets:**
- Andrei Jikh — https://www.youtube.com/@AndreiJikh
- Joseph Carlson — https://www.youtube.com/@JosephCarlsonShow
- Meet Kevin — https://www.youtube.com/@MeetKevin
- Everything Money — https://www.youtube.com/@EverythingMoney
- Ticker Symbol You — https://www.youtube.com/@TickerSymbolYOU

These are **not auto-fetched** (no free API for video content) but serve as a quick-access reference panel.

### 5.3 Integration with Existing Pages

- **Stock Detail page**: Show a "Community Picks" card in the right column if the stock has any picks in the last 14 days — e.g. "3 analysts recommended this stock in the last 7 days"
- **Screener**: Add "Has Online Pick" boolean filter + "Latest Pick" column (optional, opt-in column)
- **Overview/Home**: Add a small widget: "Hot Picks Today" — top 3 most-mentioned tickers

---

## 6. ETL Pipeline Integration

### 6.1 Changes to `etl/src/index.ts`

```typescript
import { fetchOnlinePicks } from './research/online-picks.js';

// In the parallel enrichment block:
withTimeout('Online stock picks', () => fetchOnlinePicks(), 60_000, [])
```

Pass result to `writeOutputs()` which writes `data/online-picks.json`.

### 6.2 Changes to `etl/src/output/writer.ts`

Add `onlinePicks` parameter. Merge with existing `online-picks.json` (load, merge, dedup, prune 14d), write back.

### 6.3 GitHub Actions Workflow

No changes to `.github/workflows/etl.yml` needed — the online picks fetch runs as part of `npm run etl` and writes to `data/online-picks.json` which is committed by the existing "Commit and push data" step.

The workflow already runs hourly on weekdays (7am–9pm UTC), so picks will refresh up to 14× per trading day.

### 6.4 New Environment Variables Required

| Variable | Purpose | Required? |
|----------|---------|-----------|
| None new for priority sources | FMP RSS, StockTwits, Reddit JSON API are all free/no-auth | N/A |
| `MONEYCONTROL_ENABLED` | Optional flag to skip Moneycontrol scrape if it starts blocking | Optional |

No new secrets needed for the initial implementation.

---

## 7. Implementation Sequence

### Phase 1 — ETL (1–2 days)
1. Create `etl/src/research/online-picks.ts` with `fetchFMPUpgrades()`, `fetchStockTwitsTrending()`, `fetchRedditPicks()`
2. Add `fetchMoneycontrolPicks()` for Indian market picks
3. Update `writer.ts` to write/merge `data/online-picks.json`
4. Wire into `index.ts` parallel enrichment block
5. Test locally: `npm run etl` → verify `data/online-picks.json` created with real data

### Phase 2 — Dashboard (1–2 days)
1. Create `dashboard/src/pages/OnlinePicks.tsx`
2. Add route `/online-picks` in router
3. Add nav link "Online Picks" in sidebar
4. Add "Community Picks" card to StockDetail page
5. Add "Hot Picks Today" widget to Overview page

### Phase 3 — Polish (0.5 day)
1. Add "Has Online Pick" filter to Screener
2. Add performance tracking: % change since pick date
3. Add YouTube curated reference panel
4. Test on mobile (card layout)

---

## 8. Limitations & Risks

| Risk | Mitigation |
|------|-----------|
| Moneycontrol starts blocking scrapes | Wrap in try/catch; skip if 429/403; use User-Agent rotation |
| FMP RSS feed structure changes | Parse defensively; test on each ETL run; fallback to empty array |
| Reddit API rate limits | 1 request per 2 seconds; limited to 25 posts per subreddit per run |
| Ticker extraction from text is noisy | Only match against our known ticker universe (not arbitrary 2-5 letter sequences) |
| StockTwits "trending" is noisy (meme stocks) | Mark as `sourceType: 'community'`; user can filter these out |
| Picks accumulate indefinitely | 14-day rolling window prune keeps file size small |
| YouTube content not accessible | Handled as static curated reference — not live feed |

---

## 9. Data Flow Diagram

```
ETL Run (hourly)
     │
     ├── fetchFMPUpgrades()          → analyst upgrades/downgrades (US)
     ├── fetchFMPPriceTargets()      → price target changes (US)
     ├── fetchStockTwitsTrending()   → trending tickers (US)
     ├── fetchRedditPicks()          → r/stocks + r/IndiaInvestments mentions
     ├── fetchMoneycontrolPicks()    → broker picks (IN)
     └── extendFinvizForRatings()    → analyst ratings from FinViz news
             │
             ▼
     mergeAndDedup()
     [+ load existing online-picks.json]
     [prune entries > 14 days old]
             │
             ▼
     data/online-picks.json   ←── committed to git by workflow
             │
             ▼
     Dashboard /online-picks page
     StockDetail "Community Picks" card
     Overview "Hot Picks Today" widget
```

---

## 10. Reference Resources (YouTube & Other)

These are not scraped automatically but are curated links for the dashboard's reference panel:

### Indian Markets
- **Akshat Shrivastava** — https://www.youtube.com/@AkshatShrivastava — Long-term investing, wealth creation, specific stock analysis videos
- **CA Rachana Ranade** — https://www.youtube.com/@CARachanaRanade — Fundamentals, IPOs, sector analysis with stock picks
- **Pranjal Kamra (Finology)** — https://www.youtube.com/@PranjalKamra — Stock picking methodology, Finology 30 basket
- **Vivek Bajaj** — https://www.youtube.com/@VivekBajajStockEdge — Technical + fundamental, StockEdge integration
- **Nikhil Kamath** — https://www.youtube.com/@nikhilkamathcio — Macro + sectoral picks, Indian markets
- **Parimal Ade** — https://www.youtube.com/@ParimalAde — Fundamental analysis, QGLP methodology

### US Markets
- **Andrei Jikh** — https://www.youtube.com/@AndreiJikh — Dividend investing, index funds, individual growth picks
- **Joseph Carlson** — https://www.youtube.com/@JosephCarlsonShow — Dividend portfolio, stock fundamentals
- **Meet Kevin** — https://www.youtube.com/@MeetKevin — Growth stocks, market news commentary, momentum picks
- **Everything Money** — https://www.youtube.com/@EverythingMoney — 8-pillar fundamental analysis framework
- **Ticker Symbol You** — https://www.youtube.com/@TickerSymbolYOU — Long-term fundamental deep dives

### Community & Aggregator Sites
- **StockTwits** — https://stocktwits.com/rankings/trending — Live trending tickers with social sentiment
- **ApeWisdom** — https://apewisdom.io — Reddit stock mention aggregator (already integrated in ETL)
- **Finviz News** — https://finviz.com/news.ashx — Analyst upgrades/downgrades headlines (already scraped)
- **WallStreetMojo Top Picks** — https://www.wallstreetmojo.com/stocks-to-buy/ — Curated buy lists
- **Investing.com Top Picks** — https://www.investing.com/stock-ideas/ — AI + analyst combined picks

---

*Next step: Begin Phase 1 ETL implementation when ready. Start with `fetchFMPUpgrades()` as it's the most reliable/structured source, then add others incrementally.*