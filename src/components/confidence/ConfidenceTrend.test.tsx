import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConfidenceTrend } from './ConfidenceTrend';

// ── Strip bar slot differentiation ───────────────────────────────────────────

describe('ConfidenceTrend strip — no-data vs neutral-delta distinction', () => {
  it('renders no-data outline slots for missing early-season history', () => {
    // 2 deltas → 3 no-data slots at the start of a 5-slot strip
    const { container } = render(<ConfidenceTrend deltas={[1, -1]} variant="strip" />);
    const noDataSlots = container.querySelectorAll('[data-slot="no-data"]');
    expect(noDataSlots).toHaveLength(3);
  });

  it('renders neutral filled slot for an actual zero delta', () => {
    // 5 deltas, one of which is 0 → zero no-data slots, one neutral slot
    const { container } = render(<ConfidenceTrend deltas={[1, 0, -1, 2, 0]} variant="strip" />);
    const noDataSlots = container.querySelectorAll('[data-slot="no-data"]');
    const neutralSlots = container.querySelectorAll('[data-slot="neutral"]');
    expect(noDataSlots).toHaveLength(0);
    expect(neutralSlots).toHaveLength(2);
  });

  it('renders all no-data slots when deltas is empty', () => {
    const { container } = render(<ConfidenceTrend deltas={[]} variant="strip" />);
    const noDataSlots = container.querySelectorAll('[data-slot="no-data"]');
    expect(noDataSlots).toHaveLength(5);
  });

  it('renders zero no-data slots when all 5 slots are filled', () => {
    const { container } = render(<ConfidenceTrend deltas={[1, -1, 2, 0, -2]} variant="strip" />);
    const noDataSlots = container.querySelectorAll('[data-slot="no-data"]');
    expect(noDataSlots).toHaveLength(0);
  });

  it('no-data slots are visually distinct (outline) vs neutral slots (filled)', () => {
    const { container } = render(<ConfidenceTrend deltas={[0]} variant="strip" />);
    // 4 no-data + 1 neutral
    const noDataSlot = container.querySelector('[data-slot="no-data"]');
    const neutralSlot = container.querySelector('[data-slot="neutral"]');

    // no-data: has border class, not bg-neutral/25
    expect(noDataSlot?.className).toContain('border');
    expect(noDataSlot?.className).not.toContain('bg-neutral');

    // neutral: has bg-neutral/25, not a border-only style
    expect(neutralSlot?.className).toContain('bg-neutral');
  });
});
