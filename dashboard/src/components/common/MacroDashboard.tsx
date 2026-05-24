import type { MacroData } from '../../types';

interface Props {
  data: MacroData;
  compact?: boolean;
}

function vixColor(v: number): string {
  if (v < 15) return 'bg-bullish';
  if (v < 25) return 'bg-neutral';
  if (v < 35) return 'bg-neutral-dark';
  return 'bg-bearish';
}

function vixLabel(v: number): string {
  if (v < 15) return 'Low';
  if (v < 25) return 'Normal';
  if (v < 35) return 'Elevated';
  return 'Extreme';
}

function MiniGauge({ label, value, suffix, bar, barColor, sub }: {
  label: string;
  value: string;
  suffix?: string;
  bar?: number;
  barColor?: string;
  sub?: string;
}) {
  return (
    <div className="p-3 rounded-lg bg-surface-tertiary/50 border border-surface-border">
      <p className="text-[10px] font-semibold t-muted uppercase tracking-wider mb-1">{label}</p>
      <p className="text-lg font-bold t-primary tabular-nums">
        {value}{suffix && <span className="text-xs t-muted ml-0.5">{suffix}</span>}
      </p>
      {bar != null && (
        <div className="w-full h-1.5 bg-surface-border rounded-full mt-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor || 'bg-accent'}`}
            style={{ width: `${Math.min(100, Math.max(2, bar))}%` }}
          />
        </div>
      )}
      {sub && <p className="text-[10px] t-muted mt-1">{sub}</p>}
    </div>
  );
}

export default function MacroDashboard({ data, compact }: Props) {
  const gridClass = compact
    ? 'grid grid-cols-2 gap-2'
    : 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3';

  return (
    <div className={compact ? '' : 'card p-5'}>
      {!compact && (
        <>
          <h2 className="text-xs font-semibold t-tertiary uppercase tracking-wider mb-1">Macro Indicators</h2>
          <p className="text-[10px] t-muted mb-4">
            Key economic indicators that affect the whole market. Think of these as the "weather conditions" for stocks.
          </p>
        </>
      )}
      <div className={gridClass}>
        {data.vix != null && (
          <MiniGauge
            label="VIX (Fear Index)"
            value={data.vix.toFixed(1)}
            bar={Math.min(100, (data.vix / 50) * 100)}
            barColor={vixColor(data.vix)}
            sub={vixLabel(data.vix)}
          />
        )}
        {data.treasury10y != null && (
          <MiniGauge
            label="10Y Treasury"
            value={data.treasury10y.toFixed(2)}
            suffix="%"
            bar={(data.treasury10y / 7) * 100}
            barColor="bg-accent"
            sub="Long-term interest rate"
          />
        )}
        {data.treasury2y != null && (
          <MiniGauge
            label="2Y Treasury"
            value={data.treasury2y.toFixed(2)}
            suffix="%"
            bar={(data.treasury2y / 7) * 100}
            barColor="bg-accent-light"
            sub="Short-term rate"
          />
        )}
        {data.yieldSpread != null && (
          <MiniGauge
            label="Yield Spread"
            value={data.yieldSpread > 0 ? `+${data.yieldSpread.toFixed(2)}` : data.yieldSpread.toFixed(2)}
            suffix="%"
            bar={50 + (data.yieldSpread / 4) * 50}
            barColor={data.yieldSpread >= 0 ? 'bg-bullish' : 'bg-bearish'}
            sub={data.yieldSpread >= 0 ? 'Expansion' : 'Recession Warning'}
          />
        )}
        {data.dxy != null && (
          <MiniGauge
            label="DXY (Dollar)"
            value={data.dxy.toFixed(1)}
            bar={((data.dxy - 80) / 40) * 100}
            barColor="bg-accent"
            sub={data.dxy > 105 ? 'Strong' : data.dxy < 95 ? 'Weak' : 'Normal'}
          />
        )}
        {data.fedFundsRate != null && (
          <MiniGauge
            label="Fed Funds Rate"
            value={data.fedFundsRate.toFixed(2)}
            suffix="%"
            bar={(data.fedFundsRate / 8) * 100}
            barColor="bg-accent"
            sub="Federal Reserve target"
          />
        )}
      </div>
      {!compact && data.lastUpdated && (
        <p className="text-[10px] t-faint mt-3 italic">
          Source: FRED (Federal Reserve Economic Data) — Updated {new Date(data.lastUpdated).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
