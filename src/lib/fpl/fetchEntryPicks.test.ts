import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { fetchEntryPicks } from './api';

const endpoint = (teamId: number, gameweek: number) =>
  `https://fantasy.premierleague.com/api/entry/${teamId.toString()}/event/${gameweek.toString()}/picks/`;

const makePick = (position: number) => ({
  element: position * 100,
  position,
  is_captain: position === 1,
  is_vice_captain: position === 2,
});

const validPayload = {
  picks: Array.from({ length: 15 }, (_, i) => makePick(i + 1)),
};

const server = setupServer(http.get(endpoint(123456, 1), () => HttpResponse.json(validPayload)));

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

describe('fetchEntryPicks', () => {
  it('returns parsed squad picks on a 200 response', async () => {
    const result = await fetchEntryPicks(123456, 1);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.picks).toHaveLength(15);
    expect(result.value.picks[0]).toMatchObject({
      element: 100,
      position: 1,
      is_captain: true,
      is_vice_captain: false,
    });
  });

  it('returns not_found on a 404 (invalid team ID or GW not started)', async () => {
    server.use(http.get(endpoint(9999, 1), () => new HttpResponse(null, { status: 404 })));

    const result = await fetchEntryPicks(9999, 1);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('not_found');
  });

  it('returns network_error when the request fails at the network layer', async () => {
    server.use(http.get(endpoint(123456, 1), () => HttpResponse.error()));

    const result = await fetchEntryPicks(123456, 1);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('network_error');
  });

  it('returns invalid_response when picks array length is not 15', async () => {
    server.use(
      http.get(endpoint(123456, 1), () =>
        HttpResponse.json({ picks: Array.from({ length: 11 }, (_, i) => makePick(i + 1)) }),
      ),
    );

    const result = await fetchEntryPicks(123456, 1);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('invalid_response');
  });

  it('returns http_error on a 500 response', async () => {
    server.use(
      http.get(
        endpoint(123456, 1),
        () => new HttpResponse(null, { status: 500, statusText: 'Internal Server Error' }),
      ),
    );

    const result = await fetchEntryPicks(123456, 1);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({ type: 'http_error', status: 500 });
  });
});
