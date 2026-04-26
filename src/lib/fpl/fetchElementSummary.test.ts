import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { fetchElementSummary } from './api';
import elementSummaryFixture from './__fixtures__/element-summary';

const endpoint = (playerId: number) =>
  `https://fantasy.premierleague.com/api/element-summary/${playerId.toString()}/`;

const server = setupServer(http.get(endpoint(1), () => HttpResponse.json(elementSummaryFixture)));

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

describe('fetchElementSummary', () => {
  it('returns parsed match history on a 200 response', async () => {
    const result = await fetchElementSummary(1);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.history).toHaveLength(2);
    expect(result.value.history[0]).toMatchObject({
      round: 1,
      opponent_team: 14,
      minutes: 90,
      clean_sheets: 1,
    });
  });

  it('returns not_found on a 404 response (invalid player ID)', async () => {
    server.use(http.get(endpoint(9999), () => new HttpResponse(null, { status: 404 })));

    const result = await fetchElementSummary(9999);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('not_found');
  });

  it('returns network_error when the request fails at the network layer', async () => {
    server.use(http.get(endpoint(1), () => HttpResponse.error()));

    const result = await fetchElementSummary(1);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('network_error');
  });

  it('returns invalid_response when history items fail schema validation', async () => {
    server.use(
      http.get(endpoint(1), () => HttpResponse.json({ history: [{ round: 'not-a-number' }] })),
    );

    const result = await fetchElementSummary(1);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('invalid_response');
  });

  it('returns http_error on a 503 response', async () => {
    server.use(
      http.get(
        endpoint(1),
        () => new HttpResponse(null, { status: 503, statusText: 'Service Unavailable' }),
      ),
    );

    const result = await fetchElementSummary(1);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({ type: 'http_error', status: 503 });
  });
});
