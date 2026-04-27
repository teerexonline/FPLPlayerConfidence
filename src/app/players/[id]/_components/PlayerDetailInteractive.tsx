'use client';

import { useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import type { JSX } from 'react';
import { ConfidenceHero } from './ConfidenceHero';
import { MatchHistoryStrip } from './MatchHistoryStrip';
import type { SnapshotPoint } from './types';

interface PlayerDetailInteractiveProps {
  readonly snapshots: readonly SnapshotPoint[];
  readonly latestGameweek: number;
}

/**
 * Holds the selected-GW and mount-animation state for the player detail page.
 * Clicking a match card updates the hero to show that GW's confidence data.
 * The ConfidenceNumber count-up runs once on mount, then snaps on subsequent updates.
 */
export function PlayerDetailInteractive({
  snapshots,
  latestGameweek,
}: PlayerDetailInteractiveProps): JSX.Element {
  const [selectedGw, setSelectedGw] = useState<number | undefined>(
    snapshots.length > 0 ? latestGameweek : undefined,
  );
  const [animated, setAnimated] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      // flushSync forces a synchronous re-render so fake-timer tests don't need act()
      flushSync(() => {
        setAnimated(false);
      });
    }, 900);
    return () => {
      clearTimeout(timer);
    };
  }, []);

  const latestSnap = snapshots[snapshots.length - 1];
  const selectedSnap = snapshots.find((s) => s.gameweek === selectedGw) ?? latestSnap;

  if (snapshots.length === 0 || selectedSnap === undefined) {
    return (
      <>
        <ConfidenceHero
          confidence={0}
          latestDelta={0}
          latestReason=""
          latestGameweek={0}
          hasSnapshots={false}
          animated={false}
        />
        <MatchHistoryStrip snapshots={snapshots} />
      </>
    );
  }

  return (
    <>
      <ConfidenceHero
        confidence={selectedSnap.confidenceAfter}
        latestDelta={selectedSnap.delta}
        latestReason={selectedSnap.reason}
        latestGameweek={selectedSnap.gameweek}
        hasSnapshots={true}
        animated={animated}
      />
      <MatchHistoryStrip
        snapshots={snapshots}
        {...(selectedGw !== undefined ? { selectedGw } : {})}
        onSelectGw={setSelectedGw}
      />
    </>
  );
}
