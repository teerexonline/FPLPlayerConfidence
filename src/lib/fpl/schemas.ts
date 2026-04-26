import { z } from 'zod';

export const TeamSchema = z.object({
  id: z.number().int().positive(),
  code: z.number().int().positive(),
  name: z.string().min(1),
  short_name: z.string().min(1),
});

export const ElementSchema = z.object({
  id: z.number().int().positive(),
  web_name: z.string().min(1),
  team: z.number().int().positive(),
  element_type: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  now_cost: z.number().int().nonnegative(),
  total_points: z.number().int(),
  status: z.string().default('a'),
  chance_of_playing_next_round: z.number().int().min(0).max(100).nullable().default(null),
  news: z.string().default(''),
});

export const EventSchema = z.object({
  id: z.number().int().positive(),
  deadline_time: z.string().min(1),
  finished: z.boolean(),
  is_current: z.boolean(),
  is_next: z.boolean(),
});

export const BootstrapStaticSchema = z.object({
  teams: z.array(TeamSchema),
  elements: z.array(ElementSchema),
  events: z.array(EventSchema),
});

export const HistoryItemSchema = z.object({
  round: z.number().int().positive(),
  opponent_team: z.number().int().positive(),
  was_home: z.boolean(),
  minutes: z.number().int().nonnegative(),
  goals_scored: z.number().int().nonnegative(),
  assists: z.number().int().nonnegative(),
  clean_sheets: z.union([z.literal(0), z.literal(1)]),
  saves: z.number().int().nonnegative(),
  // Pre-computed aggregate by FPL; formula is position-dependent (DEF excludes recoveries).
  defensive_contribution: z.number().int().nonnegative(),
});

export const ElementSummarySchema = z.object({
  history: z.array(HistoryItemSchema),
});

export const FixtureSchema = z.object({
  id: z.number().int().positive(),
  event: z.number().int().positive().nullable(),
  team_h: z.number().int().positive(),
  team_a: z.number().int().positive(),
  team_h_difficulty: z.number().int().min(1).max(5),
  team_a_difficulty: z.number().int().min(1).max(5),
  finished: z.boolean(),
  kickoff_time: z.string().nullable(),
});

export const FixturesSchema = z.array(FixtureSchema);

export const EntryPickSchema = z.object({
  element: z.number().int().positive(),
  position: z.number().int().min(1).max(15),
  is_captain: z.boolean(),
  is_vice_captain: z.boolean(),
});

export const EntryPicksSchema = z.object({
  active_chip: z.string().nullable().default(null),
  picks: z.array(EntryPickSchema).min(15).max(15),
});

// GET /api/entry/{team_id}/ — manager profile + season summary.
// The FPL response contains many more fields; we extract only what we display.
export const EntryInfoSchema = z.object({
  player_first_name: z.string(),
  player_last_name: z.string(),
  name: z.string().min(1), // FPL team name
  summary_overall_rank: z.number().int().positive().nullable(),
  summary_overall_points: z.number().int().nonnegative(),
});
