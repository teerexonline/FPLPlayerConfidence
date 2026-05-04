import type { EntryHistory } from './types';

/**
 * Maximum number of free transfers a manager can bank in the 2024/25+ season.
 * (Was 2 prior to that — bumped to 5.)
 */
const MAX_BANKED_FREE_TRANSFERS = 5;

/** Chips that preserve the existing free-transfer balance instead of consuming it. */
const PRESERVE_FT_CHIPS: ReadonlySet<string> = new Set(['wildcard', 'freehit']);

/**
 * Derives the number of banked free transfers a manager has heading into the
 * NEXT gameweek (i.e. the count available for the upcoming deadline).
 *
 * FPL rules implemented:
 *   • Each gameweek grants +1 free transfer (rolls over).
 *   • Maximum cap of 5 banked free transfers.
 *   • Wildcard and Free Hit chips DON'T consume free transfers — the
 *     existing balance is preserved across the chip GW.
 *   • Other transfers consume free transfers first; extras cost 4 pts each.
 *
 * Returns 1 (the per-GW grant) when no history is available — safe default
 * matching the previous hardcoded behaviour.
 */
export function deriveFreeTransfers(history: EntryHistory): number {
  const chipsByEvent = new Map<number, string>();
  for (const c of history.chips) chipsByEvent.set(c.event, c.name);

  // Walk every gameweek seen so far in chronological order.
  // Start with 1 FT (the GW1 grant — there's no prior balance).
  let free = 1;
  // Sort events ascending so we replay the season in order.
  const events = [...history.current].sort((a, b) => a.event - b.event);
  for (const e of events) {
    const isPreserveChip = PRESERVE_FT_CHIPS.has(chipsByEvent.get(e.event) ?? '');
    if (!isPreserveChip) {
      // Real transfers consume FTs (free first, then paid). The free count
      // can't go below 0 (paid transfers don't dig deeper).
      const consumed = Math.min(e.event_transfers, free);
      free -= consumed;
    }
    // Roll over: +1 every GW, including chip GWs (the balance is preserved
    // across a chip GW but the weekly grant still applies).
    free = Math.min(MAX_BANKED_FREE_TRANSFERS, free + 1);
  }
  return Math.max(1, free);
}
