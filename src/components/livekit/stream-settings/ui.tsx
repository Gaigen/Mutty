import { PING_HISTORY_SIZE } from '../../../lib/stream-stats';

export function SectionHeader({ emoji, label }: { emoji: string; label: string }) {
  return (
    <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide flex items-center gap-2.5">
      <span
        className="inline-flex h-6 w-7 shrink-0 items-center justify-center text-base leading-none"
        aria-hidden
      >
        {emoji}
      </span>
      <span className="min-w-0">{label}</span>
    </h3>
  );
}

export function MicLevelBar({
  level,
  gateThreshold,
  gateEnabled,
}: {
  level: number;
  gateThreshold: number;
  gateEnabled: boolean;
}) {
  const pct = Math.round(level * 100);
  const color = pct < 50 ? '#22c55e' : pct < 80 ? '#f59e0b' : '#ef4444';
  const threshPct = Math.max(0, Math.min(100, ((gateThreshold - -60) / 60) * 100));

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400">Input level</span>
        <span className="text-[10px] text-gray-500">{pct}%</span>
      </div>
      <div className="relative h-2 bg-[#252525] rounded-full overflow-hidden border border-[#2a2a2a]">
        <div
          className="h-full rounded-full transition-[width] duration-75"
          style={{ width: `${pct}%`, background: color }}
        />
        {gateEnabled && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-orange-400 opacity-80"
            style={{ left: `${threshPct}%` }}
            title={`Noise gate: ${gateThreshold} dB`}
          />
        )}
      </div>
      <div className="flex justify-between mt-0.5">
        <p className="text-[10px] text-gray-600">
          {pct === 0 ? 'Silent / gated' : pct < 8 ? 'Very quiet' : 'Active'}
        </p>
        {gateEnabled && (
          <p className="text-[10px] text-orange-400 opacity-70">gate: {gateThreshold} dB</p>
        )}
      </div>
    </div>
  );
}

function pingChartMaxMs(valid: number[]): number {
  const peak = Math.max(1, ...valid);
  const padded = peak * 1.35;
  let cap = Math.ceil(padded / 5) * 5;
  if (cap < 20) cap = 20;
  if (cap > 300) cap = 300;
  return cap;
}

function pingChartTicks(maxMs: number): number[] {
  if (maxMs <= 30) return [10, 20, 30].filter((t) => t <= maxMs);
  if (maxMs <= 60) return [20, 40, 60].filter((t) => t <= maxMs);
  if (maxMs <= 120) return [40, 80, 120].filter((t) => t <= maxMs);
  const step = maxMs <= 200 ? 50 : 100;
  const ticks: number[] = [];
  for (let t = step; t < maxMs; t += step) ticks.push(t);
  ticks.push(maxMs);
  return [...new Set(ticks)].sort((a, b) => a - b);
}

export function PingChart({ history }: { history: (number | null)[] }) {
  const W = 400;
  const H = 86;
  const leftPad = 44;
  const rightPad = 8;
  const topPad = 8;
  const bottomPad = 18;

  const valid = history.filter((v): v is number => v !== null);
  if (valid.length < 2) {
    return (
      <div className="flex min-h-[72px] items-center justify-center rounded-md border border-[#2a2a2a] bg-[#1a1a1a] px-3 text-xs text-gray-500">
        Collecting samples…
      </div>
    );
  }

  const maxVal = pingChartMaxMs(valid);
  const plotW = W - leftPad - rightPad;
  const plotH = H - topPad - bottomPad;

  const pts: string[] = [];
  history.forEach((v, i) => {
    if (v === null) return;
    const x = leftPad + (i / (PING_HISTORY_SIZE - 1)) * plotW;
    const y = topPad + plotH - (v / maxVal) * plotH;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  });

  const latest = valid[valid.length - 1];
  const lineColor = latest < 100 ? '#22c55e' : latest < 250 ? '#f59e0b' : '#ef4444';
  const gridMs = pingChartTicks(maxVal);

  return (
    <div className="w-full min-w-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-[72px] w-full max-h-[88px]"
        role="img"
        aria-label="Round-trip time over the last minute"
      >
        <rect
          x={leftPad}
          y={topPad}
          width={plotW}
          height={plotH}
          rx={3}
          fill="#141414"
          stroke="#2a2a2a"
          strokeWidth={1}
        />
        {gridMs.map((ms) => {
          const y = topPad + plotH - (ms / maxVal) * plotH;
          return (
            <g key={ms}>
              <line
                x1={leftPad}
                y1={y}
                x2={leftPad + plotW}
                y2={y}
                stroke="#3f3f46"
                strokeWidth={1}
                strokeOpacity={0.85}
              />
              <text
                x={leftPad - 6}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fill="#a1a1aa"
                style={{ fontSize: 10, fontWeight: 500 }}
              >
                {ms}ms
              </text>
            </g>
          );
        })}
        <polyline
          points={pts.join(' ')}
          fill="none"
          stroke={lineColor}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {pts.length > 0 &&
          (() => {
            const last = pts[pts.length - 1].split(',');
            return <circle cx={last[0]} cy={last[1]} r={3} fill={lineColor} stroke="#0a0a0a" strokeWidth={1} />;
          })()}
        <text x={leftPad} y={H - 4} fill="#71717a" style={{ fontSize: 10 }}>
          60s ago
        </text>
        <text x={leftPad + plotW} y={H - 4} textAnchor="end" fill="#71717a" style={{ fontSize: 10 }}>
          Now
        </text>
      </svg>
    </div>
  );
}
