import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { StaleDataIndicator } from './StaleDataIndicator';

describe('StaleDataIndicator', () => {
  it('renders nothing when recentAppearances >= 2', () => {
    const { container: c2 } = render(<StaleDataIndicator recentAppearances={2} />);
    expect(c2.firstChild).toBeNull();

    const { container: c3 } = render(<StaleDataIndicator recentAppearances={3} />);
    expect(c3.firstChild).toBeNull();
  });

  it('renders a clock icon when recentAppearances === 0', () => {
    render(<StaleDataIndicator recentAppearances={0} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('renders a clock icon when recentAppearances === 1', () => {
    render(<StaleDataIndicator recentAppearances={1} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('shows correct "0/3" tooltip when appearances === 0', () => {
    render(<StaleDataIndicator recentAppearances={0} />);
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      'Played 0/3 recent gameweeks · Confidence may not reflect current form',
    );
  });

  it('shows correct "1/3" tooltip when appearances === 1', () => {
    render(<StaleDataIndicator recentAppearances={1} />);
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      'Played 1/3 recent gameweeks · Confidence may not reflect current form',
    );
  });

  it('has no accessibility violations when stale (axe)', async () => {
    const { container } = render(<StaleDataIndicator recentAppearances={0} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no accessibility violations when fresh — renders nothing (axe)', async () => {
    const { container } = render(<StaleDataIndicator recentAppearances={3} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
