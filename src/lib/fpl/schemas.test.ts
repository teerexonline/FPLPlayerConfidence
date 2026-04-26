import { describe, expect, it } from 'vitest';
import {
  BootstrapStaticSchema,
  ElementSchema,
  ElementSummarySchema,
  EntryPicksSchema,
  EventSchema,
  FixturesSchema,
  TeamSchema,
} from './schemas';
import bootstrapFixture from './__fixtures__/bootstrap-static';
import elementSummaryFixture from './__fixtures__/element-summary';
import fixturesFixture from './__fixtures__/fixtures';

// ── Positive: recorded real-API responses ────────────────────────────────────

describe('BootstrapStaticSchema', () => {
  it('parses a recorded bootstrap-static response', () => {
    const result = BootstrapStaticSchema.safeParse(bootstrapFixture);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.teams).toHaveLength(3);
    expect(result.data.elements).toHaveLength(3);
    expect(result.data.events).toHaveLength(3);

    expect(result.data.teams[0]).toMatchObject({
      id: 1,
      code: 3,
      name: 'Arsenal',
      short_name: 'ARS',
    });
    expect(result.data.elements[0]).toMatchObject({ id: 1, web_name: 'Raya', element_type: 1 });
    expect(result.data.events[0]).toMatchObject({ id: 1, finished: true });
  });

  it('rejects a response missing the events array', () => {
    const result = BootstrapStaticSchema.safeParse({
      teams: bootstrapFixture.teams,
      elements: bootstrapFixture.elements,
      // events intentionally omitted
    });
    expect(result.success).toBe(false);
  });

  it('rejects an element with an out-of-range element_type (5 is not a valid position)', () => {
    const badElement = { ...bootstrapFixture.elements[0], element_type: 5 };
    const result = BootstrapStaticSchema.safeParse({
      ...bootstrapFixture,
      elements: [badElement],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a team with an empty name string', () => {
    const badTeam = { ...bootstrapFixture.teams[0], name: '' };
    const result = BootstrapStaticSchema.safeParse({
      ...bootstrapFixture,
      teams: [badTeam],
    });
    expect(result.success).toBe(false);
  });
});

describe('ElementSummarySchema', () => {
  it('parses a recorded element-summary response', () => {
    const result = ElementSummarySchema.safeParse(elementSummaryFixture);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.history).toHaveLength(2);
    expect(result.data.history[0]).toMatchObject({
      round: 1,
      opponent_team: 14,
      minutes: 90,
      goals_scored: 0,
      assists: 0,
      clean_sheets: 1,
    });
  });

  it('rejects a history item where clean_sheets is 2 (must be 0 or 1)', () => {
    const result = ElementSummarySchema.safeParse({
      history: [{ ...elementSummaryFixture.history[0], clean_sheets: 2 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a history item with negative minutes', () => {
    const result = ElementSummarySchema.safeParse({
      history: [{ ...elementSummaryFixture.history[0], minutes: -1 }],
    });
    expect(result.success).toBe(false);
  });
});

describe('FixturesSchema', () => {
  it('parses a recorded fixtures response', () => {
    const result = FixturesSchema.safeParse(fixturesFixture);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toMatchObject({ id: 1, event: 1, finished: true });
  });

  it('rejects a fixture where difficulty is out of the 1–5 range', () => {
    const result = FixturesSchema.safeParse([{ ...fixturesFixture[0], team_h_difficulty: 6 }]);
    expect(result.success).toBe(false);
  });
});

describe('EntryPicksSchema', () => {
  const makePick = (position: number) => ({
    element: position * 100,
    position,
    is_captain: position === 1,
    is_vice_captain: position === 2,
  });

  it('accepts a valid 15-pick squad', () => {
    const picks = Array.from({ length: 15 }, (_, i) => makePick(i + 1));
    const result = EntryPicksSchema.safeParse({ picks });
    expect(result.success).toBe(true);
  });

  it('rejects a squad with only 14 picks (squads are always 15)', () => {
    const picks = Array.from({ length: 14 }, (_, i) => makePick(i + 1));
    const result = EntryPicksSchema.safeParse({ picks });
    expect(result.success).toBe(false);
  });

  it('rejects a pick where position is 0 (valid range is 1–15)', () => {
    const picks = Array.from({ length: 15 }, (_, i) => makePick(i + 1));
    const result = EntryPicksSchema.safeParse({
      picks: [{ ...picks[0], position: 0 }, ...picks.slice(1)],
    });
    expect(result.success).toBe(false);
  });
});

// ── Individual sub-schemas ───────────────────────────────────────────────────

describe('TeamSchema', () => {
  it('rejects an id of 0 (must be positive)', () => {
    const result = TeamSchema.safeParse({ id: 0, code: 3, name: 'Arsenal', short_name: 'ARS' });
    expect(result.success).toBe(false);
  });
});

describe('EventSchema', () => {
  it('rejects a missing deadline_time field', () => {
    const result = EventSchema.safeParse({
      id: 1,
      finished: false,
      is_current: true,
      is_next: false,
    });
    expect(result.success).toBe(false);
  });
});

describe('ElementSchema', () => {
  it('rejects a non-integer now_cost (costs are always whole integers)', () => {
    const result = ElementSchema.safeParse({
      id: 1,
      web_name: 'Raya',
      team: 1,
      element_type: 1,
      now_cost: 9.5,
      total_points: 141,
    });
    expect(result.success).toBe(false);
  });
});
