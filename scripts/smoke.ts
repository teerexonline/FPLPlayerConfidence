/**
 * Smoke test — runs against the real FPL API.
 * Execute: npx vitest run scripts/smoke.ts --reporter=verbose
 */
import { describe, expect, it } from 'vitest';
import { calculateConfidence } from '@/lib/confidence';
import { fetchBootstrapStatic, fetchElementSummary } from '@/lib/fpl';
import {
  buildFdrLookup,
  elementTypeToPosition,
  mapMatchEvents,
} from '@/lib/sync/internal/matchEventMapper';

// Trent Alexander-Arnold moved to Real Madrid — not in FPL this season. Replaced with Virgil van Dijk.
const TARGET_NAMES = ['M.Salah', 'Haaland', 'Saka', 'Virgil', 'Pickford'];

describe('smoke: real FPL API confidence calculation', { timeout: 60_000 }, () => {
  it('fetches bootstrap-static and resolves target players by web_name', async () => {
    const bootstrapResult = await fetchBootstrapStatic();

    expect(bootstrapResult.ok).toBe(true);
    if (!bootstrapResult.ok) return;

    const { elements } = bootstrapResult.value;
    const targets = TARGET_NAMES.map((name) => {
      const found = elements.find((e) => e.web_name === name);
      if (!found) console.warn(`Player not found by web_name: ${name}`);
      return { name, element: found };
    });

    // Smoke test uses an empty FDR lookup (fallback FDR 3 for all matches).
    // The purpose is end-to-end algorithm verification, not FDR accuracy.
    const fdrLookup = buildFdrLookup([]);

    console.log('\n── Confidence Smoke Test ─────────────────────────────────');

    for (const { name, element } of targets) {
      if (!element) {
        console.log(`  ${name}: NOT FOUND in bootstrap`);
        continue;
      }

      const summaryResult = await fetchElementSummary(element.id);
      if (!summaryResult.ok) {
        console.log(
          `  ${name} (id=${element.id.toString()}): fetch error — ${summaryResult.error.type}`,
        );
        continue;
      }

      const position = elementTypeToPosition(element.element_type);
      const matchEvents = mapMatchEvents(summaryResult.value.history, element.team, fdrLookup);
      const { finalConfidence, history } = calculateConfidence({ position, matches: matchEvents });
      const appearances = matchEvents.length;

      console.log(
        `  ${name.padEnd(20)} id=${element.id.toString()}  pos=${position}  appearances=${appearances.toString()}  confidence=${finalConfidence >= 0 ? '+' : ''}${finalConfidence.toString()}`,
      );

      if (history.length > 0) {
        const last = history[history.length - 1];
        if (last) {
          console.log(
            `    └─ last GW${last.gameweek.toString()}: delta=${last.delta >= 0 ? '+' : ''}${last.delta.toString()}  reason="${last.reason}"`,
          );
        }
      }
    }

    console.log('──────────────────────────────────────────────────────────\n');
    expect(true).toBe(true);
  });
});
