import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { fetchFixtures } from './api';
import fixturesFixture from './__fixtures__/fixtures';

const ENDPOINT = 'https://fantasy.premierleague.com/api/fixtures/';

const server = setupServer(http.get(ENDPOINT, () => HttpResponse.json(fixturesFixture)));

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

describe('fetchFixtures', () => {
  it('returns parsed fixtures on a 200 response (no gameweek filter)', async () => {
    const result = await fetchFixtures();

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value).toHaveLength(2);
    expect(result.value[0]).toMatchObject({ id: 1, event: 1, finished: true });
  });

  it('appends ?event= when a gameweek is specified', async () => {
    server.use(
      http.get(ENDPOINT, ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('event') === '5') {
          return HttpResponse.json(fixturesFixture);
        }
        return new HttpResponse(null, { status: 400 });
      }),
    );

    const result = await fetchFixtures(5);

    expect(result.ok).toBe(true);
  });

  it('returns network_error when the request fails at the network layer', async () => {
    server.use(http.get(ENDPOINT, () => HttpResponse.error()));

    const result = await fetchFixtures();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('network_error');
  });

  it('returns invalid_response when the body is not an array', async () => {
    server.use(http.get(ENDPOINT, () => HttpResponse.json({ fixtures: 'wrong shape' })));

    const result = await fetchFixtures();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('invalid_response');
  });

  it('returns http_error on a 404 response', async () => {
    server.use(http.get(ENDPOINT, () => new HttpResponse(null, { status: 404 })));

    const result = await fetchFixtures();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('not_found');
  });
});
