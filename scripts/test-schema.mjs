// Test Zod schema validation against live FPL element summary API
// Run with: node scripts/test-schema.mjs

import { z } from 'zod';

const HistoryItemSchema = z.object({
  round: z.number().int().positive(),
  opponent_team: z.number().int().positive(),
  was_home: z.boolean(),
  minutes: z.number().int().nonnegative(),
  goals_scored: z.number().int().nonnegative(),
  assists: z.number().int().nonnegative(),
  clean_sheets: z.union([z.literal(0), z.literal(1)]),
  saves: z.number().int().nonnegative(),
  defensive_contribution: z.number().int().nonnegative(),
  total_points: z.number().int().default(0),
  influence: z.coerce.number().nonnegative().default(0),
  creativity: z.coerce.number().nonnegative().default(0),
  threat: z.coerce.number().nonnegative().default(0),
});

const ElementSummarySchema = z.object({
  history: z.array(HistoryItemSchema),
});

// Test 3 different players
for (const id of [1, 2, 100]) {
  const res = await fetch(`https://fantasy.premierleague.com/api/element-summary/${id}/`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  const json = await res.json();
  const parsed = ElementSummarySchema.safeParse(json);
  if (parsed.success) {
    console.log(`Player ${id}: OK — ${parsed.data.history.length} history items`);
  } else {
    console.log(`Player ${id}: FAIL`);
    console.log(
      '  Error:',
      parsed.error.errors
        .slice(0, 3)
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join('\n  '),
    );
    console.log('  Raw first item:', JSON.stringify(json.history?.[0]).slice(0, 200));
  }
}
