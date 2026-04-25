import { http, HttpResponse } from 'msw';

/**
 * Default MSW request handlers shared across integration tests.
 * Per-test overrides are applied via server.use() inside each test file.
 */
export const handlers = [
  http.get('https://fantasy.premierleague.com/api/bootstrap-static/', () => HttpResponse.json({})),
];
