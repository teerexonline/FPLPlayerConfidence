// Recorded 2026-04-25. Source: GET https://fantasy.premierleague.com/api/element-summary/1/
// Player: David Raya (Arsenal GK). Trimmed to 2 history entries.
// defensive_contribution added 2026-04-26; saves added 2026-04-26.

const elementSummaryFixture = {
  history: [
    {
      round: 1,
      opponent_team: 14,
      was_home: false,
      minutes: 90,
      goals_scored: 0,
      assists: 0,
      clean_sheets: 1 as const,
      saves: 3,
      defensive_contribution: 7,
    },
    {
      round: 2,
      opponent_team: 11,
      was_home: true,
      minutes: 90,
      goals_scored: 0,
      assists: 0,
      clean_sheets: 1 as const,
      saves: 2,
      defensive_contribution: 3,
    },
  ],
};

export default elementSummaryFixture;
