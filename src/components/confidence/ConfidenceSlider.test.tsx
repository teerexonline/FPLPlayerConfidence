import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'jest-axe';
import { ConfidenceSlider } from './ConfidenceSlider';

// Motion's animate() uses Web Animations API which jsdom doesn't implement.
// Stub it so the component renders without throwing.
vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('motion/react')>();
  return {
    ...actual,
    animate: vi.fn().mockResolvedValue(undefined),
  };
});

describe('ConfidenceSlider', () => {
  it('renders with role=meter', () => {
    render(<ConfidenceSlider value={3} />);
    expect(screen.getByRole('meter')).toBeInTheDocument();
  });

  it('sets aria-valuemin to -4', () => {
    render(<ConfidenceSlider value={0} />);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuemin', '-4');
  });

  it('sets aria-valuemax to 5', () => {
    render(<ConfidenceSlider value={0} />);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuemax', '5');
  });

  it('sets aria-valuenow to the clamped value', () => {
    render(<ConfidenceSlider value={3} />);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '3');
  });

  it('clamps value above 5 to 5', () => {
    render(<ConfidenceSlider value={10} />);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '5');
  });

  it('clamps value below -4 to -4', () => {
    render(<ConfidenceSlider value={-10} />);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '-4');
  });

  it('has aria-label describing the percentage (value=3 → 80%)', () => {
    render(<ConfidenceSlider value={3} />);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-label', 'Confidence: 80%');
  });

  it('has aria-label for negative value (value=-2 → 25%)', () => {
    render(<ConfidenceSlider value={-2} />);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-label', 'Confidence: 25%');
  });

  it('has aria-label for zero (value=0 → 50%)', () => {
    render(<ConfidenceSlider value={0} />);
    expect(screen.getByRole('meter')).toHaveAttribute('aria-label', 'Confidence: 50%');
  });

  it('renders tick labels at 0%, 25%, 50%, 75%, 100%', () => {
    // value=3: pill animates from 0 (=50%), so "50%" appears in both the tick and the pill.
    // Use getAllByText to avoid "multiple elements" failure on the shared value.
    render(<ConfidenceSlider value={3} />);
    ['0%', '25%', '50%', '75%', '100%'].forEach((label) => {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    });
    // Old integer labels are gone
    expect(screen.queryByText('+5')).not.toBeInTheDocument();
    expect(screen.queryByText('-4')).not.toBeInTheDocument();
  });

  it('applies className when provided', () => {
    const { container } = render(<ConfidenceSlider value={0} className="test-class" />);
    const meter = container.querySelector('[role="meter"]');
    expect(meter).toHaveClass('test-class');
  });

  it('has no axe violations', async () => {
    const { container } = render(<ConfidenceSlider value={3} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
