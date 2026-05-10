import { CONFIG } from '../config.js';
import type { TechnicalData } from './technical.js';
import type { QuoteData } from '../stocks/fetcher.js';

export interface Signal {
  type: string;
  direction: 'bullish' | 'bearish';
  severity: number; // 1-3
  description: string;
  timeframe: 'short' | 'medium' | 'long';
}

export interface TimeframeSentiment {
  short: { opinion: 'Buy' | 'Hold' | 'Sell'; signalCount: number };
  medium: { opinion: 'Buy' | 'Hold' | 'Sell'; signalCount: number };
  long: { opinion: 'Buy' | 'Hold' | 'Sell'; signalCount: number };
}

export function detectSignals(tech: TechnicalData, quote: QuoteData): Signal[] {
  const signals: Signal[] = [];

  // === MOVING AVERAGE SIGNALS (long-term) ===

  // Death Cross / Golden Cross: SMA50 vs SMA200
  if (tech.sma50 != null && tech.sma200 != null) {
    if (tech.sma50 < tech.sma200) {
      // Only flag Death Cross as a strong bearish signal when price is still below or
      // near SMA200. If price has already recovered well above SMA200 the cross is a
      // stale lagging artefact (e.g. stock crashed then rebounded strongly).
      const priceAboveSma200Pct = tech.sma200 > 0
        ? (quote.price - tech.sma200) / tech.sma200
        : 0;
      if (priceAboveSma200Pct > 0.10) {
        // Price >10% above SMA200 — death cross is stale, skip it
      } else {
        signals.push({
          type: 'Death Cross',
          direction: 'bearish',
          severity: priceAboveSma200Pct > 0.05 ? 1 : 3, // soften if already recovering
          description: `SMA50 (${tech.sma50.toFixed(2)}) below SMA200 (${tech.sma200.toFixed(2)})`,
          timeframe: 'long',
        });
      }
    } else {
      signals.push({
        type: 'Golden Cross',
        direction: 'bullish',
        severity: 2,
        description: `SMA50 (${tech.sma50.toFixed(2)}) above SMA200 (${tech.sma200.toFixed(2)})`,
        timeframe: 'long',
      });
    }
  }

  // Price vs SMA alignment (long-term)
  if (tech.sma50 != null && tech.sma200 != null) {
    if (quote.price > tech.sma50 && tech.sma50 > tech.sma200) {
      signals.push({
        type: 'MA Alignment Bullish',
        direction: 'bullish',
        severity: 1,
        description: 'Price > SMA50 > SMA200 — strong uptrend alignment',
        timeframe: 'long',
      });
    } else if (quote.price < tech.sma50 && tech.sma50 < tech.sma200) {
      signals.push({
        type: 'MA Alignment Bearish',
        direction: 'bearish',
        severity: 1,
        description: 'Price < SMA50 < SMA200 — strong downtrend alignment',
        timeframe: 'long',
      });
    }
  }

  // === RSI SIGNALS (short-term) ===

  if (tech.rsi != null) {
    if (tech.rsi > CONFIG.rsiOverbought) {
      // RSI overbought in a downtrend (price below SMA200) is a reversal warning.
      // RSI overbought in a strong uptrend (price well above SMA200) is often
      // momentum continuation — reduce severity so it doesn't dominate the score.
      const inUptrend = tech.sma200 != null && quote.price > tech.sma200 * 1.05;
      signals.push({
        type: 'RSI Overbought',
        direction: 'bearish',
        severity: inUptrend ? 1 : 2,
        description: `RSI at ${tech.rsi.toFixed(1)} (above ${CONFIG.rsiOverbought})${inUptrend ? ' — uptrend context, lower weight' : ''}`,
        timeframe: 'short',
      });
    } else if (tech.rsi < CONFIG.rsiOversold) {
      signals.push({
        type: 'RSI Oversold',
        direction: 'bullish',
        severity: 2,
        description: `RSI at ${tech.rsi.toFixed(1)} (below ${CONFIG.rsiOversold})`,
        timeframe: 'short',
      });
    }
  }

  // === MACD SIGNALS (medium-term) ===

  if (tech.macd) {
    if (tech.macd.histogram < 0) {
      signals.push({
        type: 'MACD Bearish',
        direction: 'bearish',
        severity: 2,
        description: `MACD histogram negative (${tech.macd.histogram.toFixed(3)})`,
        timeframe: 'medium',
      });
    } else {
      signals.push({
        type: 'MACD Bullish',
        direction: 'bullish',
        severity: 2,
        description: `MACD histogram positive (${tech.macd.histogram.toFixed(3)})`,
        timeframe: 'medium',
      });
    }
  }

  // === BOLLINGER BAND SIGNALS (short-term) ===

  if (tech.bollinger) {
    const bb = tech.bollinger;

    // Squeeze detection — volatility about to expand
    if (bb.squeeze) {
      signals.push({
        type: 'BB Squeeze',
        direction: 'bullish', // Squeeze is neutral but often resolves upward
        severity: 2,
        description: `Bollinger Band squeeze (bandwidth ${(bb.bandwidth * 100).toFixed(1)}%) — breakout imminent`,
        timeframe: 'short',
      });
    }

    // Price touching upper band + RSI overbought = bearish reversal
    // In a strong uptrend (price well above SMA200), this is less predictive — reduce severity.
    if (bb.percentB > 0.95 && tech.rsi != null && tech.rsi > 70) {
      const inUptrend = tech.sma200 != null && quote.price > tech.sma200 * 1.05;
      signals.push({
        type: 'BB Upper + RSI High',
        direction: 'bearish',
        severity: inUptrend ? 1 : 2,
        description: `Price at upper Bollinger Band with RSI ${tech.rsi.toFixed(1)} — overextended${inUptrend ? ' (uptrend)' : ''}`,
        timeframe: 'short',
      });
    }

    // Price touching lower band + RSI oversold = bullish bounce
    if (bb.percentB < 0.05 && tech.rsi != null && tech.rsi < 30) {
      signals.push({
        type: 'BB Lower + RSI Low',
        direction: 'bullish',
        severity: 2,
        description: `Price at lower Bollinger Band with RSI ${tech.rsi.toFixed(1)} — potential bounce`,
        timeframe: 'short',
      });
    }
  }

  // === STOCHASTIC SIGNALS (short-term) ===

  if (tech.stochastic) {
    const { k, d } = tech.stochastic;

    // Bearish: %K crosses below %D above 80
    if (k < d && k > 75) {
      signals.push({
        type: 'Stochastic Bearish',
        direction: 'bearish',
        severity: 2,
        description: `Stochastic %K (${k.toFixed(1)}) crossed below %D (${d.toFixed(1)}) in overbought zone`,
        timeframe: 'short',
      });
    }

    // Bullish: %K crosses above %D below 20
    if (k > d && k < 25) {
      signals.push({
        type: 'Stochastic Bullish',
        direction: 'bullish',
        severity: 2,
        description: `Stochastic %K (${k.toFixed(1)}) crossed above %D (${d.toFixed(1)}) in oversold zone`,
        timeframe: 'short',
      });
    }

    // Double confirmation: RSI + Stochastic agree
    if (tech.rsi != null) {
      if (tech.rsi > 70 && k > 80) {
        // Strong uptrend context — both overbought readings are less actionable bearishly
        const inUptrend = tech.sma200 != null && quote.price > tech.sma200 * 1.05;
        signals.push({
          type: 'RSI + Stochastic Overbought',
          direction: 'bearish',
          severity: inUptrend ? 1 : 3,
          description: `Both RSI (${tech.rsi.toFixed(1)}) and Stochastic (${k.toFixed(1)}) confirm overbought${inUptrend ? ' — uptrend context' : ''}`,
          timeframe: 'short',
        });
      } else if (tech.rsi < 30 && k < 20) {
        signals.push({
          type: 'RSI + Stochastic Oversold',
          direction: 'bullish',
          severity: 3,
          description: `Both RSI (${tech.rsi.toFixed(1)}) and Stochastic (${k.toFixed(1)}) confirm oversold`,
          timeframe: 'short',
        });
      }
    }
  }

  // === OBV SIGNALS (medium-term) ===

  if (tech.obvDivergence === 'bearish') {
    signals.push({
      type: 'OBV Bearish Divergence',
      direction: 'bearish',
      severity: 3,
      description: 'Price rising but OBV falling — distribution detected (smart money selling)',
      timeframe: 'medium',
    });
  } else if (tech.obvDivergence === 'bullish') {
    signals.push({
      type: 'OBV Bullish Divergence',
      direction: 'bullish',
      severity: 3,
      description: 'Price falling but OBV rising — accumulation detected (smart money buying)',
      timeframe: 'medium',
    });
  }

  if (tech.obvTrend === 'rising' && quote.changePercent > 0) {
    signals.push({
      type: 'Volume Confirms Uptrend',
      direction: 'bullish',
      severity: 1,
      description: 'OBV trend rising with price — volume confirms the move',
      timeframe: 'medium',
    });
  }

  // === VOLUME SIGNALS (short-term) ===

  // Volume spike on price decline
  if (tech.volumeRatio > 2 && quote.changePercent < -2) {
    signals.push({
      type: 'Volume Spike Decline',
      direction: 'bearish',
      severity: 2,
      description: `Volume ${tech.volumeRatio.toFixed(1)}x average with ${quote.changePercent.toFixed(1)}% decline`,
      timeframe: 'short',
    });
  }

  // Accumulation day: price up >1% on above-average volume
  if (tech.volumeRatio > 1.3 && quote.changePercent > 1) {
    signals.push({
      type: 'Accumulation Day',
      direction: 'bullish',
      severity: 1,
      description: `Price up ${quote.changePercent.toFixed(1)}% on ${tech.volumeRatio.toFixed(1)}x volume — institutional buying`,
      timeframe: 'short',
    });
  }

  // === MOMENTUM SIGNALS (medium-term) ===

  if (tech.priceReturn3m > 0.15) {
    signals.push({
      type: 'Strong Momentum',
      direction: 'bullish',
      severity: 1,
      description: `3-month return +${(tech.priceReturn3m * 100).toFixed(1)}%`,
      timeframe: 'medium',
    });
  } else if (tech.priceReturn3m < -0.15) {
    signals.push({
      type: 'Weak Momentum',
      direction: 'bearish',
      severity: 1,
      description: `3-month return ${(tech.priceReturn3m * 100).toFixed(1)}%`,
      timeframe: 'medium',
    });
  }

  // === 52-WEEK PROXIMITY (medium-term) ===

  if (quote.price <= quote.fiftyTwoWeekLow * 1.05) {
    signals.push({
      type: 'Near 52W Low',
      direction: 'bearish',
      severity: 1,
      description: `Price near 52-week low of ${quote.fiftyTwoWeekLow.toFixed(2)}`,
      timeframe: 'medium',
    });
  }

  if (quote.price >= quote.fiftyTwoWeekHigh * 0.95) {
    signals.push({
      type: 'Near 52W High',
      direction: 'bullish',
      severity: 1,
      description: `Price near 52-week high of ${quote.fiftyTwoWeekHigh.toFixed(2)}`,
      timeframe: 'medium',
    });
  }

  return signals;
}

export function computeTimeframeSentiment(signals: Signal[]): TimeframeSentiment {
  const compute = (tf: 'short' | 'medium' | 'long') => {
    const tfSignals = signals.filter(s => s.timeframe === tf);
    const net = tfSignals.reduce((sum, s) => {
      return sum + (s.direction === 'bullish' ? s.severity : -s.severity);
    }, 0);
    const opinion: 'Buy' | 'Hold' | 'Sell' = net > 1 ? 'Buy' : net < -1 ? 'Sell' : 'Hold';
    return { opinion, signalCount: tfSignals.length };
  };

  return {
    short: compute('short'),
    medium: compute('medium'),
    long: compute('long'),
  };
}

export function computeBearishScore(signals: Signal[]): number {
  return signals
    .filter(s => s.direction === 'bearish')
    .reduce((sum, s) => sum + s.severity, 0);
}

export function computeBullishScore(signals: Signal[]): number {
  return signals
    .filter(s => s.direction === 'bullish')
    .reduce((sum, s) => sum + s.severity, 0);
}
