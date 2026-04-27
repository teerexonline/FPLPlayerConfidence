'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export type MetricMode = 'c' | 'g' | 'a';

export const METRIC_MODES: readonly MetricMode[] = ['c', 'g', 'a'];

/** URL default — absent param implies Confidence mode. */
export const DEFAULT_METRIC_MODE: MetricMode = 'c';

/** Validates a raw URL param value, returning the default on missing or invalid input. */
export function parseMetric(raw: string | null): MetricMode {
  return (METRIC_MODES as readonly string[]).includes(raw ?? '')
    ? (raw as MetricMode)
    : DEFAULT_METRIC_MODE;
}

export interface MetricModeHook {
  readonly mode: MetricMode;
  readonly setMode: (next: MetricMode) => void;
}

/**
 * Reads the active metric from `?metric=c|g|a` and provides a setter that
 * pushes a new URL while preserving all existing search params. The default
 * (Confidence) is omitted from the URL to keep links clean.
 */
export function useMetricMode(): MetricModeHook {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const mode = parseMetric(searchParams.get('metric'));

  function setMode(next: MetricMode): void {
    const params = new URLSearchParams(searchParams.toString());
    if (next === DEFAULT_METRIC_MODE) {
      params.delete('metric');
    } else {
      params.set('metric', next);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return { mode, setMode };
}
