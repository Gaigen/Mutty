import { PING_HISTORY_SIZE } from '../../../lib/stream-stats';

export function SectionHeader({ emoji, label }: { emoji: string; label: string }) {
  return (
    <h3 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide flex items-center gap-2">
      <span>{emoji}</span> {label}
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

export function PingChart({ history }: { history: (number | null)[] }) {
  const W = 400;
  const H = 132;
  const leftPad = 52;
  const rightPad = 10;
  const topPad = 12;
  const bottomPad = 26;

  const valid = history.filter((v): v is number => v !== null);
  if (valid.length < 2) {
    return (
      <div className="flex items-center justify-center min-h-[132px] rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 text-sm text-gray-400">
        Collecting data…
      </div>
    );
  }

  const maxVal = Math.max(300, ...valid);
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
  const gridMs = [100, 200, 300].filter((v) => v <= maxVal);

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full block h-[clamp(132px,28vw,188px)]"
        role="img"
        aria-label="Round-trip time over the last minute"
      >
        <rect
          x={leftPad}
          y={topPad}
          width={plotW}
          height={plotH}
          rx={4}
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
                strokeOpacity={0.9}
              />
              <text
                x={leftPad - 8}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fill="#a1a1aa"
                style={{ fontSize: 11, fontWeight: 500 }}
              >
                {ms} ms
              </text>
            </g>
          );
        })}
        <polyline
          points={pts.join(' ')}
          fill="none"
          stroke={lineColor}
          strokeWidth={2.25}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {pts.length > 0 &&
          (() => {
            const last = pts[pts.length - 1].split(',');
            return <circle cx={last[0]} cy={last[1]} r={3.5} fill={lineColor} stroke="#0a0a0a" strokeWidth={1} />;
          })()}
        <text x={leftPad} y={H - 6} fill="#a1a1aa" style={{ fontSize: 11 }}>
          60s ago
        </text>
        <text x={leftPad + plotW} y={H - 6} textAnchor="end" fill="#a1a1aa" style={{ fontSize: 11 }}>
          Now
        </text>
      </svg>
    </div>
  );
}
