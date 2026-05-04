import type { JSX } from 'react';
import { cn } from '@/lib/utils';

interface TransferStatusBannerProps {
  /** Bank balance at the last deadline, in tenths of millions (£0.1m). */
  readonly bank: number;
  /** Free transfers assumed available — defaults to 1 (FPL per-GW grant). */
  readonly freeTransfers: number;
  /** Number of staged TRANSFERS (excludes free intra-squad subs). */
  readonly stagedTransferCount: number;
  /** Total number of staged swap pairs (transfers + subs). */
  readonly stagedSwapCount: number;
  /** Net change to bank after applying staged transfers (tenths of millions). */
  readonly stagedTransferBankDelta: number;
  /** Negative point hit from staged transfers above the free count. */
  readonly stagedTransferPointCost: number;
  readonly onClearSwaps: () => void;
}

function formatPounds(tenths: number): string {
  // 17 → "£1.7m", -3 → "-£0.3m"
  const abs = Math.abs(tenths);
  const sign = tenths < 0 ? '-' : '';
  return `${sign}£${(abs / 10).toFixed(1)}m`;
}

/**
 * Always-visible banner in projected mode that surfaces:
 *   - Current bank balance (and projected balance after staged transfers)
 *   - Free transfers assumed available (default 1, per FPL's per-GW grant)
 *   - Point hit from any transfers beyond the free count (-4 each)
 *   - Number of staged changes + a Clear button when ≥1 are staged
 *
 * The free-transfer count is an assumption because the public FPL API
 * doesn't expose the rolled-over count. The banner labels it as such.
 */
export function TransferStatusBanner({
  bank,
  freeTransfers,
  stagedTransferCount,
  stagedSwapCount,
  stagedTransferBankDelta,
  stagedTransferPointCost,
  onClearSwaps,
}: TransferStatusBannerProps): JSX.Element {
  const projectedBank = bank + stagedTransferBankDelta;
  const hasPaidTransfers = stagedTransferPointCost < 0;
  const hasAnyStaged = stagedSwapCount > 0;
  return (
    <div
      className={cn(
        'mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[8px] border border-dashed px-4 py-2.5',
        hasPaidTransfers ? 'border-rose-500/40 bg-rose-500/5' : 'border-blue-500/40 bg-blue-500/5',
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-sans text-[13px]">
        {/* Bank — projected if staged transfers, current otherwise. */}
        <span className="text-muted">
          Bank{' '}
          <span className="text-text font-semibold tabular-nums">
            {formatPounds(projectedBank)}
          </span>
          {stagedTransferBankDelta !== 0 && (
            <span className="text-muted ml-1 text-[11px]">(was {formatPounds(bank)})</span>
          )}
        </span>

        <span className="text-muted/40">·</span>

        {/* Free transfers — derived from the manager's real transfer history
            and chip usage; replays FPL's per-GW grant + 5-FT cap rules. */}
        <span
          className="text-muted"
          title="Derived from your FPL transfer history and chips played. Banked transfers cap at 5."
        >
          <span className="text-text font-semibold tabular-nums">{freeTransfers.toString()}</span>{' '}
          free transfer{freeTransfers !== 1 ? 's' : ''}
        </span>

        {hasPaidTransfers && (
          <>
            <span className="text-muted/40">·</span>
            <span className="font-semibold text-rose-500 tabular-nums">
              {stagedTransferPointCost.toString()} pts
            </span>
            <span className="text-muted/60 text-[11px]">
              ({stagedTransferCount - freeTransfers} extra ×4)
            </span>
          </>
        )}
      </div>

      {hasAnyStaged && (
        <button
          type="button"
          onClick={onClearSwaps}
          className="text-muted hover:text-text font-sans text-[12px] underline underline-offset-2 transition-colors"
        >
          Clear {stagedSwapCount} staged
        </button>
      )}
    </div>
  );
}
