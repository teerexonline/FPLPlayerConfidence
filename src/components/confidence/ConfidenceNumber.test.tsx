import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { useReducedMotion } from 'motion/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfidenceNumber } from './ConfidenceNumber';

// ── Module mocks ─────────────────────────────────────────────────────────────

const mockWarn = vi.hoisted(() => vi.fn());

vi.mock('@/lib/logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: mockWarn,
    error: vi.fn(),
  })),
}));

vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('motion/react')>();
  return { ...actual, useReducedMotion: vi.fn().mockReturnValue(false) };
});

afterEach(() => {
  vi.mocked(useReducedMotion).mockReturnValue(false);
  mockWarn.mockReset();
});

// ── Percentage mapping reference ──────────────────────────────────────────────
// v≥0: 50+(v/5)×50 → +5=100%, +3=80%, +1=60%, 0=50%
// v<0: 50+(v/4)×50 → -2=25%, -3=12.5%→13%, -4=0%

describe('ConfidenceNumber', () => {
  it('renders +5 as 100%', () => {
    render(<ConfidenceNumber value={5} animated={false} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('renders +3 as 80% with data-sign="positive"', () => {
    render(<ConfidenceNumber value={3} animated={false} />);
    const el = screen.getByText('80%');
    expect(el).toHaveAttribute('data-sign', 'positive');
  });

  it('renders +1 as 60%', () => {
    render(<ConfidenceNumber value={1} animated={false} />);
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('renders 0 as exactly "50%" with data-sign="neutral"', () => {
    render(<ConfidenceNumber value={0} animated={false} />);
    const el = screen.getByText('50%');
    expect(el).toHaveAttribute('data-sign', 'neutral');
    // No spurious leading sign characters
    expect(screen.queryByText('+50%')).not.toBeInTheDocument();
    expect(screen.queryByText('-50%')).not.toBeInTheDocument();
  });

  it('renders -2 as 25% with data-sign="negative"', () => {
    render(<ConfidenceNumber value={-2} animated={false} />);
    const el = screen.getByText('25%');
    expect(el).toHaveAttribute('data-sign', 'negative');
  });

  it('renders -3 as 13% (12.5% rounded)', () => {
    render(<ConfidenceNumber value={-3} animated={false} />);
    expect(screen.getByText('13%')).toBeInTheDocument();
    // No minus signs — percentages are always non-negative
    expect(screen.queryByText('-3')).not.toBeInTheDocument();
    expect(screen.queryByText('−3')).not.toBeInTheDocument();
  });

  it('renders -4 as 0% (the floor)', () => {
    render(<ConfidenceNumber value={-4} animated={false} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('applies data-size="sm" for the sm variant', () => {
    render(<ConfidenceNumber value={2} size="sm" animated={false} />);
    expect(screen.getByText('70%')).toHaveAttribute('data-size', 'sm');
  });

  it('applies data-size="md" for the md variant', () => {
    render(<ConfidenceNumber value={2} size="md" animated={false} />);
    expect(screen.getByText('70%')).toHaveAttribute('data-size', 'md');
  });

  it('applies data-size="xl" for the xl variant', () => {
    render(<ConfidenceNumber value={2} size="xl" animated={false} />);
    expect(screen.getByText('70%')).toHaveAttribute('data-size', 'xl');
  });

  it('animated={false} renders the final percentage immediately (synchronous getByText)', () => {
    render(<ConfidenceNumber value={5} animated={false} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('skips animation and renders instantly when prefers-reduced-motion is true', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    render(<ConfidenceNumber value={4} />);
    expect(screen.getByText('90%')).toBeInTheDocument();
  });

  it('clamps an out-of-range value (+7 → +5 → 100%) and logs a warning', async () => {
    render(<ConfidenceNumber value={7} animated={false} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
    await waitFor(() => {
      expect(mockWarn).toHaveBeenCalledOnce();
      expect(mockWarn).toHaveBeenCalledWith(
        'ConfidenceNumber: value outside [-4, +5] — clamped',
        expect.objectContaining({ received: 7, clamped: 5 }),
      );
    });
  });

  it('aria-label reflects the percentage, not the integer', () => {
    render(<ConfidenceNumber value={3} animated={false} />);
    expect(screen.getByText('80%')).toHaveAttribute('aria-label', 'Confidence: 80%');
  });

  it('aria-label for 0 is "Confidence: 50%"', () => {
    render(<ConfidenceNumber value={0} animated={false} />);
    expect(screen.getByText('50%')).toHaveAttribute('aria-label', 'Confidence: 50%');
  });

  it('aria-label for -4 is "Confidence: 0%"', () => {
    render(<ConfidenceNumber value={-4} animated={false} />);
    expect(screen.getByText('0%')).toHaveAttribute('aria-label', 'Confidence: 0%');
  });

  it('merges a custom className with internal classes via cn', () => {
    render(<ConfidenceNumber value={1} className="my-custom-class" animated={false} />);
    const el = screen.getByText('60%');
    expect(el.className).toContain('my-custom-class');
    expect(el.className).toContain('tabular-nums');
  });

  it('has no accessibility violations (axe)', async () => {
    const { container } = render(<ConfidenceNumber value={3} animated={false} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
