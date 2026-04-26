import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { WatchlistCard } from './WatchlistCard';

describe('WatchlistCard', () => {
  it('renders the Watchlist heading', () => {
    render(<WatchlistCard />);
    expect(screen.getByRole('heading', { name: /watchlist/i })).toBeInTheDocument();
  });

  it('renders the empty-state message', () => {
    render(<WatchlistCard />);
    expect(screen.getByText('No watchlist yet')).toBeInTheDocument();
  });

  it('renders a link to /players', () => {
    render(<WatchlistCard />);
    const link = screen.getByRole('link', { name: /browse players/i });
    expect(link).toHaveAttribute('href', '/players');
  });

  it('has role="region" with aria-label "Watchlist"', () => {
    render(<WatchlistCard />);
    expect(screen.getByRole('region', { name: /^watchlist$/i })).toBeInTheDocument();
  });

  it('has no accessibility violations (axe)', async () => {
    const { container } = render(<WatchlistCard />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
