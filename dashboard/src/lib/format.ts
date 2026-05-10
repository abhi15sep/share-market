const CURRENCY_MAP: Record<string, string> = {
  US: '$', UK: '£', IN: '₹', DE: '€', FR: '€', JP: '¥', HK: 'HK$',
};

export function currencySymbol(market: string): string {
  return CURRENCY_MAP[market] || '$';
}

export function formatPrice(price: number, market: string): string {
  return `${currencySymbol(market)}${price.toFixed(2)}`;
}

export function formatMarketCap(marketCap: number, market: string): string {
  const sym = currencySymbol(market);
  if (marketCap >= 1e12) return `${sym}${(marketCap / 1e12).toFixed(1)}T`;
  if (marketCap >= 1e9) return `${sym}${(marketCap / 1e9).toFixed(1)}B`;
  if (marketCap >= 1e6) return `${sym}${(marketCap / 1e6).toFixed(0)}M`;
  return `${sym}${marketCap.toLocaleString()}`;
}
