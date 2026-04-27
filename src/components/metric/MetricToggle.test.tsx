import { fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { usePathname, useSearchParams } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MetricToggle } from './MetricToggle';
import { DEFAULT_METRIC_MODE, parseMetric } from './useMetricMode';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
// These vars are mutated per-test; the vi.mock factory closes over them by reference.
let testSearchParams = new URLSearchParams();
let testPathname = '/players';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
  useSearchParams: vi.fn(() => testSearchParams),
  usePathname: vi.fn(() => testPathname),
}));

// Suppress the unused import warning — useSearchParams and usePathname are used
// only to satisfy vi.mocked() in tests; their call signatures matter at runtime.
void useSearchParams;
void usePathname;

beforeEach(() => {
  mockPush.mockClear();
  testSearchParams = new URLSearchParams();
  testPathname = '/players';
});

// ── parseMetric ───────────────────────────────────────────────────────────────

describe('parseMetric', () => {
  it('returns "c" for null (absent param)', () => {
    expect(parseMetric(null)).toBe('c');
  });

  it('returns "c" for explicit "c"', () => {
    expect(parseMetric('c')).toBe('c');
  });

  it('returns "g" for "g"', () => {
    expect(parseMetric('g')).toBe('g');
  });

  it('returns "a" for "a"', () => {
    expect(parseMetric('a')).toBe('a');
  });

  it('returns default "c" for unrecognised value', () => {
    expect(parseMetric('x')).toBe('c');
    expect(parseMetric('')).toBe('c');
    expect(parseMetric('goal')).toBe('c');
  });

  it('DEFAULT_METRIC_MODE is "c"', () => {
    expect(DEFAULT_METRIC_MODE).toBe('c');
  });
});

// ── MetricToggle ──────────────────────────────────────────────────────────────

describe('MetricToggle', () => {
  it('renders three pill buttons labelled Confidence, P(Goal), P(Assist)', () => {
    render(<MetricToggle />);
    expect(screen.getByRole('button', { name: /confidence/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /p\(goal\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /p\(assist\)/i })).toBeInTheDocument();
  });

  it('C pill is aria-pressed=true by default (no metric param)', () => {
    render(<MetricToggle />);
    expect(screen.getByRole('button', { name: /confidence/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /p\(goal\)/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: /p\(assist\)/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('G pill is aria-pressed=true when metric=g', () => {
    testSearchParams = new URLSearchParams('metric=g');
    render(<MetricToggle />);
    expect(screen.getByRole('button', { name: /p\(goal\)/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /confidence/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('A pill is aria-pressed=true when metric=a', () => {
    testSearchParams = new URLSearchParams('metric=a');
    render(<MetricToggle />);
    expect(screen.getByRole('button', { name: /p\(assist\)/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('invalid metric param falls back to C as active', () => {
    testSearchParams = new URLSearchParams('metric=xyz');
    render(<MetricToggle />);
    expect(screen.getByRole('button', { name: /confidence/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('clicking G pushes URL containing metric=g', () => {
    render(<MetricToggle />);
    fireEvent.click(screen.getByRole('button', { name: /p\(goal\)/i }));
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('metric=g'),
      expect.objectContaining({ scroll: false }),
    );
  });

  it('clicking A pushes URL containing metric=a', () => {
    render(<MetricToggle />);
    fireEvent.click(screen.getByRole('button', { name: /p\(assist\)/i }));
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('metric=a'),
      expect.objectContaining({ scroll: false }),
    );
  });

  it('clicking C from G mode pushes URL without metric param (default omitted)', () => {
    testSearchParams = new URLSearchParams('metric=g');
    render(<MetricToggle />);
    fireEvent.click(screen.getByRole('button', { name: /confidence/i }));
    const pushArg = mockPush.mock.calls[0]?.[0] as string;
    expect(pushArg).not.toContain('metric=');
  });

  it('preserves existing URL params when toggling metric', () => {
    testSearchParams = new URLSearchParams('pos=MID&sort=price');
    render(<MetricToggle />);
    fireEvent.click(screen.getByRole('button', { name: /p\(goal\)/i }));
    const pushArg = mockPush.mock.calls[0]?.[0] as string;
    expect(pushArg).toContain('pos=MID');
    expect(pushArg).toContain('sort=price');
    expect(pushArg).toContain('metric=g');
  });

  it('uses the current pathname in the pushed URL', () => {
    testPathname = '/my-team';
    render(<MetricToggle />);
    fireEvent.click(screen.getByRole('button', { name: /p\(goal\)/i }));
    const pushArg = mockPush.mock.calls[0]?.[0] as string;
    expect(pushArg).toMatch(/^\/my-team\?/);
  });

  it('has no accessibility violations (axe)', async () => {
    const { container } = render(<MetricToggle />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
