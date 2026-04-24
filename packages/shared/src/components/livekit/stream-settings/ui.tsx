import { PING_HISTORY_SIZE } from '../../../lib/stream-stats';

export function SectionHeader({ emoji, label }: { emoji: string; label: string }) {
  return (
    <h3 className="text-xs font-semibold text-[var(--mutty-fg-3)] mb-3 uppercase tracking-wide flex items-center gap-2.5">
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
        <span className="text-xs text-[var(--mutty-fg-3)]">Input level</span>
        <span className="text-[10px] text-[var(--mutty-fg-3)]">{pct}%</span>
      </div>
      <div className="relative h-2 bg-[var(--mutty-surface-1)] rounded-full overflow-hidden border border-[var(--mutty-border-2)]">
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
        <p className="text-[10px] text-[var(--mutty-fg-3)]">
          {pct === 0 ? 'Silent / gated' : pct < 8 ? 'Very quiet' : 'Active'}
        </p>
        {gateEnabled && (
          <p className="text-[10px] text-orange-400 opacity-70">gate: {gateThreshold} dB</p>
        )}
      </div>
    </div>
  );
}

function pingColor(latest: number): { stroke: string; fill: string; dot: string } {
  if (latest < 100) return { stroke: '#22c55e', fill: '#22c55e', dot: '#22c55e' };
  if (latest < 250) return { stroke: '#f59e0b', fill: '#f59e0b', dot: '#f59e0b' };
  return { stroke: '#ef4444', fill: '#ef4444', dot: '#ef4444' };
}

function smoothPath(points: [number, number][]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[Math.max(0, i - 1)];
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const [x3, y3] = points[Math.min(points.length - 1, i + 2)];
    const cp1x = x1 + (x2 - x0) / 6;
    const cp1y = y1 + (y2 - y0) / 6;
    const cp2x = x2 - (x3 - x1) / 6;
    const cp2y = y2 - (y3 - y1) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }
  return d;
}

export function PingChart({ history }: { history: (number | null)[] }) {
  const W = 400;
  const H = 80;
  const padX = 0;
  const padTop = 6;
  const padBottom = 4;

  const valid = history.filter((v): v is number => v !== null);
  if (valid.length < 2) {
    return (
      <div className="flex min-h-[72px] items-center justify-center rounded-md border border-[var(--mutty-border-2)] bg-[var(--mutty-surface-1)] px-3 text-xs text-[var(--mutty-fg-3)]">
        Collecting samples…
      </div>
    );
  }

  const maxVal = Math.max(1, ...valid) * 1.2;
  const plotH = H - padTop - padBottom;

  const points: [number, number][] = [];
  history.forEach((v, i) => {
    if (v === null) return;
    const x = padX + (i / (PING_HISTORY_SIZE - 1)) * W;
    const y = padTop + plotH - (v / maxVal) * plotH;
    points.push([x, y]);
  });

  const latest = valid[valid.length - 1];
  const colors = pingColor(latest);

  const linePath = smoothPath(points);
  const areaPath = linePath
    ? `${linePath} L ${points[points.length - 1][0].toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${points[0][0].toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`
    : '';

  const lastPt = points[points.length - 1];

  return (
    <div className="w-full min-w-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-[72px] w-full max-h-[88px]"
        role="img"
        aria-label="Round-trip time over the last minute"
      >
        <defs>
          <linearGradient id="ping-area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.fill} stopOpacity="0.18" />
            <stop offset="100%" stopColor={colors.fill} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {areaPath && <path d={areaPath} fill="url(#ping-area-fill)" />}

        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke={colors.stroke}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {lastPt && (
          <>
            <circle cx={lastPt[0]} cy={lastPt[1]} r={6} fill={colors.dot} opacity="0.15" />
            <circle cx={lastPt[0]} cy={lastPt[1]} r={3} fill={colors.dot} stroke="#18181b" strokeWidth={1.5} />
          </>
        )}
      </svg>
    </div>
  );
}
