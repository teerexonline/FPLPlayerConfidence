import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { DashboardEmptyState } from './DashboardEmptyState';

describe('DashboardEmptyState', () => {
  it('renders the heading and description', () => {
    render(<DashboardEmptyState />);
    expect(screen.getByText('Data sync pending')).toBeInTheDocument();
    expect(screen.getByText(/confidence scores will appear/i)).toBeInTheDocument();
  });

  it('has role="status" and a descriptive aria-label', () => {
    render(<DashboardEmptyState />);
    expect(screen.getByRole('status', { name: /no data available/i })).toBeInTheDocument();
  });

  it('has no accessibility violations (axe)', async () => {
    const { container } = render(<DashboardEmptyState />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
