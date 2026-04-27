'use client';

import { useMemo } from 'react';
import type { JSX } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { SnapshotPoint } from '@/app/players/[id]/_components/types';

export interface ConfidenceChartProps {
  readonly snapshots: readonly SnapshotPoint[];
  /** Current confidence value — determines the line color for the entire chart. */
  readonly currentConfidence: number;
}

// ── Tooltip ─────────────────────────────────────────────────────────────────

interface TooltipEntry {
  readonly payload?: ChartPoint;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
}): JSX.Element | null {
  if (!active || !payload?.[0]?.payload) return null;
  const point = payload[0].payload;
  const deltaSign = point.delta > 0 ? '+' : point.delta < 0 ? '−' : '';
  const absDelta = Math.abs(point.delta);
  const deltaColor =
    point.delta > 0
      ? 'var(--color-positive)'
      : point.delta < 0
        ? 'var(--color-negative)'
        : 'var(--color-neutral)';
  const confColor =
    point.confidence > 0
      ? 'var(--color-positive)'
      : point.confidence < 0
        ? 'var(--color-negative)'
        : 'var(--color-neutral)';

  return (
    <div
      className="border-border bg-surface shadow-sm"
      style={{
        borderWidth: 1,
        borderStyle: 'solid',
        borderRadius: 8,
        padding: '8px 12px',
        minWidth: 160,
      }}
    >
      <p className="text-muted mb-1.5 text-[11px] font-medium tracking-[0.04em] uppercase">
        GW{point.gameweek.toString()}
      </p>
      <div className="flex items-center justify-between gap-6">
        <span className="text-muted text-[12px]">Confidence</span>
        <span className="text-[13px] font-semibold tabular-nums" style={{ color: confColor }}>
          {point.confidence > 0 ? '+' : ''}
          {point.confidence === 0
            ? '0'
            : point.confidence < 0
              ? `−${Math.abs(point.confidence).toString()}`
              : point.confidence.toString()}
        </span>
      </div>
      <div className="flex items-center justify-between gap-6">
        <span className="text-muted text-[12px]">Delta</span>
        <span className="text-[12px] font-medium tabular-nums" style={{ color: deltaColor }}>
          {deltaSign}
          {absDelta === 0 ? '0' : absDelta.toString()}
        </span>
      </div>
      {point.reason && (
        <p className="text-muted mt-2 max-w-[160px] text-[11px] leading-snug">{point.reason}</p>
      )}
    </div>
  );
}

// ── Chart ────────────────────────────────────────────────────────────────────

interface ChartPoint {
  readonly gameweek: number;
  readonly confidence: number;
  readonly delta: number;
  readonly reason: string;
}

/**
 * Season-view Recharts line chart for a player's confidence trajectory.
 *
 * Deliberate UX decision: the entire line uses a single color derived from the
 * player's *current* confidence, not per-segment coloring. The line shows
 * trajectory; the color communicates "where are they now." This is intentional
 * and differs from conventional segment-by-value charting.
 */
export function ConfidenceChart({
  snapshots,
  currentConfidence,
}: ConfidenceChartProps): JSX.Element {
  const data = useMemo<ChartPoint[]>(
    () =>
      snapshots.map((s) => ({
        gameweek: s.gameweek,
        confidence: s.confidenceAfter,
        delta: s.delta,
        reason: s.reason,
      })),
    [snapshots],
  );

  // Single line color reflects current state, not per-segment value
  const lineColor =
    currentConfidence > 0
      ? 'var(--color-positive)'
      : currentConfidence < 0
        ? 'var(--color-negative)'
        : 'var(--color-neutral)';

  const tickStyle = {
    fill: 'var(--color-muted)',
    fontSize: 11,
    fontFamily: 'var(--font-geist-sans, ui-sans-serif)',
  } as const;

  // Compute evenly-spaced X ticks from data-array indices.
  // XAxis type="category" places points by array position, not by GW value, so we
  // must pick ticks from actual data points at evenly-distributed indices.
  const xTicks = (() => {
    if (data.length === 0) return [];
    const lastIdx = data.length - 1;
    const indices = [
      0,
      Math.round(lastIdx * 0.25),
      Math.round(lastIdx * 0.5),
      Math.round(lastIdx * 0.75),
      lastIdx,
    ];
    return [...new Set(indices)].flatMap((i) => {
      const point = data[i];
      return point !== undefined ? [point.gameweek] : [];
    });
  })();

  if (data.length === 0) {
    return (
      <section aria-label="Confidence over time" className="mt-12">
        <ChartHeader />
        <div className="flex h-40 items-center justify-center">
          <p className="text-muted text-[13px]">No data yet.</p>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Confidence over time" className="mt-12">
      <ChartHeader />

      <div className="mt-4" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 16, left: 0 }}>
            {/* Zero threshold */}
            <ReferenceLine
              y={0}
              stroke="var(--color-border)"
              strokeWidth={1}
              strokeDasharray="4 3"
            />

            {/* Y axis: -5..+5 with minimal labels */}
            <YAxis
              domain={[-5, 5]}
              ticks={[-5, -3, 0, 3, 5]}
              tick={tickStyle}
              axisLine={false}
              tickLine={false}
              width={32}
              tickMargin={4}
              tickFormatter={(v: number) => (v > 0 ? `+${v.toString()}` : v.toString())}
            />

            {/* X axis: evenly-spaced GW ticks; interval={0} forces all to render */}
            <XAxis
              dataKey="gameweek"
              tick={tickStyle}
              axisLine={false}
              tickLine={false}
              ticks={xTicks}
              interval={0}
              tickFormatter={(v: number) => v.toString()}
              dy={6}
            />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: 'var(--color-border)', strokeWidth: 1 }}
            />

            {/* Single line — color = current confidence state */}
            <Line
              type="monotone"
              dataKey="confidence"
              stroke={lineColor}
              strokeWidth={2.5}
              dot={false}
              activeDot={{
                r: 4,
                fill: lineColor,
                stroke: 'var(--color-surface)',
                strokeWidth: 2,
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function ChartHeader(): JSX.Element {
  return (
    <h2 className="text-muted text-[13px] font-medium tracking-[0.06em] uppercase">
      Confidence over time
    </h2>
  );
}
