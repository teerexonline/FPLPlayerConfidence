import { err, ok } from '@/lib/utils/result';
import type { Result } from '@/lib/utils/result';
import {
  BootstrapStaticSchema,
  ElementSummarySchema,
  EntryInfoSchema,
  EntryPicksSchema,
  FixturesSchema,
} from './schemas';
import type {
  BootstrapStatic,
  ElementSummary,
  EntryInfo,
  EntryPicks,
  FetchError,
  Fixtures,
} from './types';

const FPL_BASE = 'https://fantasy.premierleague.com/api/';

const REVALIDATE_1H = 3_600;
const REVALIDATE_6H = 21_600;

async function fetchJson(url: string, revalidate: number): Promise<Result<unknown, FetchError>> {
  let response: Response;

  try {
    response = await fetch(url, {
      next: { revalidate },
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'en-GB,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        Referer: 'https://fantasy.premierleague.com/',
        Origin: 'https://fantasy.premierleague.com',
      },
    });
  } catch (error) {
    return err({
      type: 'network_error',
      message: error instanceof Error ? error.message : 'Network request failed',
    });
  }

  if (response.status === 404) {
    return err({ type: 'not_found' });
  }

  if (!response.ok) {
    return err({ type: 'http_error', status: response.status, message: response.statusText });
  }

  const json: unknown = await response.json();
  return ok(json);
}

/** Fetches the master bootstrap-static payload. Cached for 1 hour. */
export async function fetchBootstrapStatic(): Promise<Result<BootstrapStatic, FetchError>> {
  const raw = await fetchJson(`${FPL_BASE}bootstrap-static/`, REVALIDATE_1H);
  if (!raw.ok) return raw;

  const parsed = BootstrapStaticSchema.safeParse(raw.value);
  if (!parsed.success) {
    return err({ type: 'invalid_response', message: parsed.error.message });
  }

  return ok(parsed.data);
}

/**
 * Fetches per-player match history and upcoming fixtures.
 * Cached for 6 hours.
 */
export async function fetchElementSummary(
  playerId: number,
): Promise<Result<ElementSummary, FetchError>> {
  const raw = await fetchJson(`${FPL_BASE}element-summary/${playerId.toString()}/`, REVALIDATE_6H);
  if (!raw.ok) return raw;

  const parsed = ElementSummarySchema.safeParse(raw.value);
  if (!parsed.success) {
    return err({ type: 'invalid_response', message: parsed.error.message });
  }

  return ok(parsed.data);
}

/**
 * Fetches all fixtures. Pass a gameweek number to filter to a single GW.
 * Cached for 1 hour.
 */
export async function fetchFixtures(gameweek?: number): Promise<Result<Fixtures, FetchError>> {
  const qs = gameweek !== undefined ? `?event=${gameweek.toString()}` : '';
  const raw = await fetchJson(`${FPL_BASE}fixtures/${qs}`, REVALIDATE_1H);
  if (!raw.ok) return raw;

  const parsed = FixturesSchema.safeParse(raw.value);
  if (!parsed.success) {
    return err({ type: 'invalid_response', message: parsed.error.message });
  }

  return ok(parsed.data);
}

/**
 * Fetches a manager's public profile: team name, manager name, overall rank.
 * Returns `not_found` for invalid / private entry IDs.
 * Cached for 1 hour — rank updates infrequently during the week.
 */
export async function fetchEntryInfo(teamId: number): Promise<Result<EntryInfo, FetchError>> {
  const raw = await fetchJson(`${FPL_BASE}entry/${teamId.toString()}/`, REVALIDATE_1H);
  if (!raw.ok) return raw;

  const parsed = EntryInfoSchema.safeParse(raw.value);
  if (!parsed.success) {
    return err({ type: 'invalid_response', message: parsed.error.message });
  }

  return ok(parsed.data);
}

/**
 * Fetches a manager's squad picks for a specific gameweek.
 * Returns `not_found` when the team ID is invalid or the GW has not started.
 * Cached for 1 hour.
 */
export async function fetchEntryPicks(
  teamId: number,
  gameweek: number,
): Promise<Result<EntryPicks, FetchError>> {
  const raw = await fetchJson(
    `${FPL_BASE}entry/${teamId.toString()}/event/${gameweek.toString()}/picks/`,
    REVALIDATE_1H,
  );
  if (!raw.ok) return raw;

  const parsed = EntryPicksSchema.safeParse(raw.value);
  if (!parsed.success) {
    return err({ type: 'invalid_response', message: parsed.error.message });
  }

  return ok(parsed.data);
}
