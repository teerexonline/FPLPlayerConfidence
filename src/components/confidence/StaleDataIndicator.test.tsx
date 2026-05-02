import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { StaleDataIndicator } from './StaleDataIndicator';

describe('StaleDataIndicator', () => {
  it('renders nothing when isStale is false', () => {
    const { container } = render(<StaleDataIndicator isStale={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a clock icon when isStale is true', () => {
    render(<StaleDataIndicator isStale={true} />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('shows stale tooltip text', () => {
    render(<StaleDataIndicator isStale={true} />);
    expect(screen.getByRole('img')).toHaveAttribute(
      'aria-label',
      'Confidence data may be stale · May not reflect current form',
    );
  });

  it('has no accessibility violations when stale (axe)', async () => {
    const { container } = render(<StaleDataIndicator isStale={true} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no accessibility violations when fresh — renders nothing (axe)', async () => {
    const { container } = render(<StaleDataIndicator isStale={false} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
