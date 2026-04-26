// Recorded 2026-04-25. Source: GET https://fantasy.premierleague.com/api/bootstrap-static/
// Live season: 20 teams, 830 players, 38 gameweeks.
// Trimmed to 3 teams / 3 elements / 3 events for schema test coverage.

const bootstrapStaticFixture = {
  teams: [
    { id: 1, code: 3, name: 'Arsenal', short_name: 'ARS' },
    { id: 2, code: 7, name: 'Aston Villa', short_name: 'AVL' },
    { id: 3, code: 90, name: 'Burnley', short_name: 'BUR' },
  ],
  elements: [
    { id: 1, web_name: 'Raya', team: 1, element_type: 1 as const, now_cost: 60, total_points: 141 },
    {
      id: 2,
      web_name: 'Arrizabalaga',
      team: 1,
      element_type: 1 as const,
      now_cost: 40,
      total_points: 0,
    },
    { id: 3, web_name: 'Hein', team: 1, element_type: 1 as const, now_cost: 40, total_points: 0 },
  ],
  events: [
    {
      id: 1,
      deadline_time: '2025-08-15T17:30:00Z',
      finished: true,
      is_current: false,
      is_next: false,
    },
    {
      id: 2,
      deadline_time: '2025-08-22T17:30:00Z',
      finished: true,
      is_current: false,
      is_next: false,
    },
    {
      id: 3,
      deadline_time: '2025-08-30T10:00:00Z',
      finished: true,
      is_current: false,
      is_next: false,
    },
  ],
};

export default bootstrapStaticFixture;
