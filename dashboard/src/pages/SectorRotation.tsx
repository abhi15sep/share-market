import { useMemo, useState } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea, Cell, Label, ZAxis, LabelList,
} from 'recharts';
import { Link } from 'react-router-dom';
import type { StockRecord } from '../types';

interface SectorData {
  sector: string;
  currentRS: number;
  rsChange: number;
  count: number;
  avgScore: number;
  quadrant: 'Leading' | 'Weakening' | 'Lagging' | 'Improving';
}

const QUADRANT_META = {
  Leading:   { color: '#16a34a', bg: 'rgba(22,163,74,0.06)',   label: 'High RS, accelerating', textClass: 'text-bullish'       },
  Weakening: { color: '#d97706', bg: 'rgba(217,119,6,0.06)',   label: 'High RS, decelerating', textClass: 'text-amber-400'     },
  Lagging:   { color: '#dc2626', bg: 'rgba(220,38,38,0.06)',   label: 'Low RS, decelerating',  textClass: 'text-bearish'       },
  Improving: { color: '#3b82f6', bg: 'rgba(59,130,246,0.06)',  label: 'Low RS, accelerating',  textClass: 'text-accent-light'  },
} as const;

function classifyQuadrant(rs: number, change: number): SectorData['quadrant'] {
  if (rs >= 50 && change >= 0) return 'Leading';
  if (rs >= 50 && change < 0)  return 'Weakening';
  if (rs < 50  && change < 0)  return 'Lagging';
  return 'Improving';
}

/* ─── Custom scatter label ─── */
function SectorLabel(props: any) {
  const { x, y, value } = props;
  return (
    <text x={x} y={y - 10} textAnchor="middle" fontSize={10} fill="var(--text-muted)" fontFamily="inherit">
      {value}
    </text>
  );
}

export default function SectorRotation({ stocks }: { stocks: StockRecord[] }) {
  const [sortKey, setSortKey] = useState<'rsChange' | 'currentRS' | 'avgScore' | 'count'>('rsChange');
  const [selectedSector, setSelectedSector] = useState<string | null>(null);

  const sectors = useMemo(() => {
    const groups = new Map<string, StockRecord[]>();
    for (const s of stocks) {
      if (!s.sector || s.sector === 'Unknown') continue;
      if (!groups.has(s.sector)) groups.set(s.sector, []);
      groups.get(s.sector)!.push(s);
    }

    const result: SectorData[] = [];
    for (const [sector, ss] of groups) {
      if (ss.length < 3) continue;
      const avgRS   = ss.reduce((a, s) => a + s.rsPercentile, 0) / ss.length;
      const avg3m   = ss.reduce((a, s) => a + s.priceReturn3m, 0) / ss.length;
      const avg6m   = ss.reduce((a, s) => a + s.priceReturn6m, 0) / ss.length;
      const rsChange = (avg3m - avg6m) * 100;
      const avgScore = Math.round(ss.reduce((a, s) => a + s.score.composite, 0) / ss.length);
      result.push({
        sector,
        currentRS: +avgRS.toFixed(1),
        rsChange:  +rsChange.toFixed(2),
        count:     ss.length,
        avgScore,
        quadrant:  classifyQuadrant(avgRS, rsChange),
      });
    }
    return result;
  }, [stocks]);

  const sorted = useMemo(
    () => [...sectors].sort((a, b) => b[sortKey] - a[sortKey]),
    [sectors, sortKey],
  );

  const yExtent = useMemo(() => {
    const vals = sectors.map(s => s.rsChange);
    const max = Math.max(...vals, 5);
    const min = Math.min(...vals, -5);
    const pad = Math.ceil(Math.max(Math.abs(max), Math.abs(min)) * 0.15);
    return { min: min - pad, max: max + pad };
  }, [sectors]);

  const quadrantCounts = useMemo(() => {
    const counts: Record<string, number> = { Leading: 0, Weakening: 0, Lagging: 0, Improving: 0 };
    for (const s of sectors) counts[s.quadrant]++;
    return counts;
  }, [sectors]);

  const selectedStocks = useMemo(() => {
    if (!selectedSector) return [];
    return stocks
      .filter(s => s.sector === selectedSector)
      .sort((a, b) => b.rsPercentile - a.rsPercentile)
      .slice(0, 20);
  }, [selectedSector, stocks]);

  const sortHeader = (key: typeof sortKey, label: string) => (
    <th
      className="px-4 py-2.5 text-right table-header text-xs cursor-pointer hover:text-accent-light select-none whitespace-nowrap"
      onClick={() => setSortKey(key)}
    >
      {label}{sortKey === key ? ' ▼' : ''}
    </th>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold t-primary">Sector Rotation</h1>
        <p className="text-sm t-muted mt-1">Relative Rotation Graph — sector momentum model</p>
      </div>

      {/* How to use */}
      <div className="card p-4 bg-accent/5 border-accent/15">
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium t-secondary select-none">
            <span className="text-xs t-muted group-open:rotate-90 transition-transform">&#9654;</span>
            How to read this chart
          </summary>
          <div className="mt-3 text-sm t-muted space-y-2">
            <p>The Relative Rotation Graph (RRG) plots each sector by its <strong className="t-secondary">RS Percentile</strong> (x-axis) vs its <strong className="t-secondary">momentum change</strong> (y-axis, 3M minus 6M return). Sectors rotate clockwise over time.</p>
            <ol className="list-decimal list-inside space-y-1.5 ml-1">
              <li><strong className="t-secondary text-bullish">Leading</strong> (top-right) — strongest sectors right now. Overweight these in a bull market.</li>
              <li><strong className="t-secondary text-amber-400">Weakening</strong> (bottom-right) — still strong RS but momentum fading. Start reducing exposure; rotation out is beginning.</li>
              <li><strong className="t-secondary text-bearish">Lagging</strong> (bottom-left) — weak and getting weaker. Avoid or underweight.</li>
              <li><strong className="t-secondary text-accent-light">Improving</strong> (top-left) — weak RS but momentum picking up. Early entry opportunity — wait for RS to cross 50 before committing.</li>
            </ol>
            <p className="text-xs pt-2 border-t border-surface-border">
              <strong>Rotation pattern:</strong> Leading → Weakening → Lagging → Improving → Leading (clockwise). Sectors rarely jump from Lagging to Leading without going through Improving first.
            </p>
          </div>
        </details>
      </div>

      {/* Quadrant summary chips */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(QUADRANT_META) as [keyof typeof QUADRANT_META, typeof QUADRANT_META[keyof typeof QUADRANT_META]][]).map(([q, meta]) => (
          <div key={q} className="card px-3 py-2 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
            <span className={`text-xs font-semibold ${meta.textClass}`}>{q}</span>
            <span className="text-xs t-muted">{meta.label}</span>
            <span className="text-xs font-bold t-primary ml-1">{quadrantCounts[q]}</span>
          </div>
        ))}
      </div>

      {/* RRG Chart */}
      <div className="card p-5">
        <h2 className="text-xs font-semibold t-tertiary uppercase tracking-wider mb-4">Relative Rotation Graph</h2>
        <ResponsiveContainer width="100%" height={440}>
          <ScatterChart margin={{ top: 24, right: 40, bottom: 30, left: 30 }}>
            {/* Quadrant background shading */}
            <ReferenceArea x1={50} x2={100} y1={0} y2={yExtent.max} fill={QUADRANT_META.Leading.bg}   />
            <ReferenceArea x1={0}  x2={50}  y1={0} y2={yExtent.max} fill={QUADRANT_META.Improving.bg} />
            <ReferenceArea x1={50} x2={100} y1={yExtent.min} y2={0} fill={QUADRANT_META.Weakening.bg} />
            <ReferenceArea x1={0}  x2={50}  y1={yExtent.min} y2={0} fill={QUADRANT_META.Lagging.bg}   />

            <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-border)" opacity={0.5} />

            <XAxis
              type="number" dataKey="currentRS"
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
              axisLine={{ stroke: 'var(--surface-border)' }} tickLine={false}
            >
              <Label value="Relative Strength (RS Percentile)" position="insideBottom" offset={-12} style={{ fill: 'var(--text-muted)', fontSize: 11 }} />
            </XAxis>
            <YAxis
              type="number" dataKey="rsChange"
              domain={[yExtent.min, yExtent.max]}
              tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
              axisLine={{ stroke: 'var(--surface-border)' }} tickLine={false}
            >
              <Label value="RS Momentum Change" angle={-90} position="insideLeft" offset={10} style={{ fill: 'var(--text-muted)', fontSize: 11 }} />
            </YAxis>

            {/* Dot size proportional to stock count */}
            <ZAxis dataKey="count" range={[60, 240]} />

            <ReferenceLine x={50} stroke="var(--surface-border)" strokeWidth={1.5} />
            <ReferenceLine y={0}  stroke="var(--surface-border)" strokeWidth={1.5} />

            <Tooltip
              contentStyle={{ backgroundColor: 'var(--surface-secondary)', border: '1px solid var(--surface-border)', borderRadius: '8px', fontSize: '12px' }}
              formatter={(value: number, name: string) => {
                if (name === 'currentRS') return [`${value}`, 'RS Percentile'];
                if (name === 'rsChange') return [`${value >= 0 ? '+' : ''}${value.toFixed(2)}pp`, 'Momentum'];
                if (name === 'count') return [value, 'Stocks'];
                return [value, name];
              }}
              labelFormatter={(_, payload) => {
                const item = payload?.[0]?.payload as SectorData | undefined;
                return item ? `${item.sector} · ${item.quadrant}` : '';
              }}
            />

            <Scatter data={sectors} name="Sectors" onClick={entry => setSelectedSector(prev => prev === (entry as SectorData).sector ? null : (entry as SectorData).sector)} style={{ cursor: 'pointer' }}>
              {sectors.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={QUADRANT_META[entry.quadrant].color}
                  opacity={selectedSector && selectedSector !== entry.sector ? 0.3 : 1}
                  stroke={selectedSector === entry.sector ? '#fff' : 'none'}
                  strokeWidth={selectedSector === entry.sector ? 2 : 0}
                />
              ))}
              <LabelList dataKey="sector" content={<SectorLabel />} />
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
        <p className="text-[10px] t-faint text-center mt-1">Dot size = number of stocks in sector. Click a dot to filter the stock list below.</p>
      </div>

      {/* Selected sector stock list */}
      {selectedSector && selectedStocks.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: QUADRANT_META[sectors.find(s => s.sector === selectedSector)!.quadrant].color }}
              />
              <h3 className="text-sm font-semibold t-primary">{selectedSector}</h3>
              <span className="text-xs t-muted">— top stocks by RS</span>
            </div>
            <button onClick={() => setSelectedSector(null)} className="text-xs t-faint hover:t-secondary">✕ close</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedStocks.map(s => (
              <Link
                key={s.ticker}
                to={`/stock/${s.ticker}`}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-tertiary border border-surface-border hover:border-accent/30 transition-colors"
              >
                <span className="text-xs font-bold text-accent-light">{s.ticker}</span>
                <span className="text-[10px] t-faint">RS {s.rsPercentile}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border bg-surface-tertiary/30">
                <th className="px-4 py-2.5 text-left table-header text-xs">Sector</th>
                <th className="px-4 py-2.5 text-center table-header text-xs">Quadrant</th>
                {sortHeader('count', 'Stocks')}
                {sortHeader('currentRS', 'Avg RS')}
                {sortHeader('rsChange', 'Momentum')}
                {sortHeader('avgScore', 'Avg Score')}
              </tr>
            </thead>
            <tbody>
              {sorted.map(s => {
                const meta = QUADRANT_META[s.quadrant];
                return (
                  <tr
                    key={s.sector}
                    onClick={() => setSelectedSector(prev => prev === s.sector ? null : s.sector)}
                    className={`border-b border-surface-border/50 cursor-pointer transition-colors ${
                      selectedSector === s.sector ? 'bg-accent/5' : 'hover:bg-surface-hover/50'
                    }`}
                  >
                    <td className="px-4 py-2.5 font-medium t-primary text-sm">{s.sector}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="badge text-[10px] px-2 py-0.5 font-medium" style={{ backgroundColor: `${meta.color}20`, color: meta.color }}>
                        {s.quadrant}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-xs t-muted">{s.count}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-xs t-primary">{s.currentRS}</td>
                    <td className={`px-4 py-2.5 text-right font-mono tabular-nums text-xs font-semibold ${s.rsChange >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                      {s.rsChange >= 0 ? '+' : ''}{s.rsChange.toFixed(2)}pp
                    </td>
                    <td className={`px-4 py-2.5 text-right font-mono tabular-nums text-xs ${s.avgScore >= 55 ? 'text-bullish' : 't-secondary'}`}>
                      {s.avgScore}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
