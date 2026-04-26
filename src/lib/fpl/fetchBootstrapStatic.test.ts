import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { fetchBootstrapStatic } from './api';
import bootstrapFixture from './__fixtures__/bootstrap-static';

const ENDPOINT = 'https://fantasy.premierleague.com/api/bootstrap-static/';

const server = setupServer(http.get(ENDPOINT, () => HttpResponse.json(bootstrapFixture)));

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

describe('fetchBootstrapStatic', () => {
  it('returns parsed data on a 200 response', async () => {
    const result = await fetchBootstrapStatic();

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.teams).toHaveLength(3);
    expect(result.value.elements[0]).toMatchObject({ id: 1, web_name: 'Raya' });
    expect(result.value.events[0]).toMatchObject({ id: 1, finished: true });
  });

  it('returns network_error when the request fails at the network layer', async () => {
    server.use(http.get(ENDPOINT, () => HttpResponse.error()));

    const result = await fetchBootstrapStatic();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('network_error');
  });

  it('returns invalid_response when the response body does not match the schema', async () => {
    server.use(http.get(ENDPOINT, () => HttpResponse.json({ teams: 'not-an-array' })));

    const result = await fetchBootstrapStatic();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('invalid_response');
  });

  it('returns http_error on a 500 response', async () => {
    server.use(
      http.get(
        ENDPOINT,
        () => new HttpResponse(null, { status: 500, statusText: 'Internal Server Error' }),
      ),
    );

    const result = await fetchBootstrapStatic();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe('http_error');
    expect(result.error).toMatchObject({ type: 'http_error', status: 500 });
  });
});
