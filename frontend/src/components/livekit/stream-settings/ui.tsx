import { PING_HISTORY_SIZE } from './constants';

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
  const W = 100;
  const H = 40;
  const PAD = 2;

  const valid = history.filter((v): v is number => v !== null);
  if (valid.length < 2) {
    return (
      <div className="flex items-center justify-center h-10 text-[10px] text-gray-600">
        Collecting data…
      </div>
    );
  }

  const maxVal = Math.max(300, ...valid);
  const innerH = H - PAD * 2;
  const innerW = W - PAD * 2;

  const pts: string[] = [];
  history.forEach((v, i) => {
    if (v === null) return;
    const x = PAD + (i / (PING_HISTORY_SIZE - 1)) * innerW;
    const y = PAD + innerH - (v / maxVal) * innerH;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  });

  const latest = valid[valid.length - 1];
  const lineColor = latest < 100 ? '#22c55e' : latest < 250 ? '#f59e0b' : '#ef4444';
  const gridLines = [100, 200].filter((v) => v < maxVal);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 48, display: 'block' }}>
        {gridLines.map((v) => {
          const y = PAD + innerH - (v / maxVal) * innerH;
          return (
            <g key={v}>
              <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="#2a2a2a" strokeWidth={0.5} />
              <text x={PAD + 1} y={y - 1} fontSize={4} fill="#555">
                {v}ms
              </text>
            </g>
          );
        })}
        <polyline
          points={pts.join(' ')}
          fill="none"
          stroke={lineColor}
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
        {pts.length > 0 &&
          (() => {
            const last = pts[pts.length - 1].split(',');
            return <circle cx={last[0]} cy={last[1]} r={1.5} fill={lineColor} />;
          })()}
      </svg>
      <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
        <span>60s ago</span>
        <span>now</span>
      </div>
    </div>
  );
}
