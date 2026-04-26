import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SkeletonRow } from './SkeletonRow';

describe('SkeletonRow', () => {
  it('renders without throwing', () => {
    const { container: c } = render(<SkeletonRow />);
    expect(c.firstChild).not.toBeNull();
  });

  it('is aria-hidden so screen readers skip it', () => {
    const { container: c } = render(<SkeletonRow />);
    const row = c.firstChild as HTMLElement;
    expect(row).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders animated bone elements', () => {
    const { container: c } = render(<SkeletonRow />);
    const bones = c.querySelectorAll('.animate-pulse');
    expect(bones.length).toBeGreaterThan(0);
  });
});
