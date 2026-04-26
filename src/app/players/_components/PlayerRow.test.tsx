import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { PlayerRow } from './PlayerRow';
import { SALAH, PICKFORD, HAALAND, makePlayer } from './__fixtures__/players';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}));

describe('PlayerRow', () => {
  it('renders the player name', () => {
    render(<PlayerRow player={SALAH} />);
    expect(screen.getByText('M. Salah')).toBeInTheDocument();
  });

  it('renders team short name', () => {
    render(<PlayerRow player={SALAH} />);
    expect(screen.getByText('LIV')).toBeInTheDocument();
  });

  it('renders position chip', () => {
    render(<PlayerRow player={SALAH} />);
    expect(screen.getByText('MID')).toBeInTheDocument();
  });

  it('renders formatted price', () => {
    render(<PlayerRow player={SALAH} />);
    expect(screen.getByText('£13.0m')).toBeInTheDocument();
  });

  it('renders upward arrow for positive last delta', () => {
    const player = makePlayer({ recentDeltas: [1, 2, 3, 4, 5] });
    render(<PlayerRow player={player} />);
    expect(screen.getByText('↑')).toBeInTheDocument();
  });

  it('renders downward arrow for negative last delta', () => {
    render(<PlayerRow player={PICKFORD} />);
    expect(screen.getByText('↓')).toBeInTheDocument();
  });

  it('renders neutral arrow for zero last delta', () => {
    render(<PlayerRow player={HAALAND} />);
    expect(screen.getByText('→')).toBeInTheDocument();
  });

  it('has role="row" for accessible table semantics', () => {
    render(<PlayerRow player={SALAH} />);
    expect(screen.getByRole('row')).toBeInTheDocument();
  });

  it('navigates to player detail page on click', () => {
    render(<PlayerRow player={SALAH} />);
    fireEvent.click(screen.getByRole('row'));
    expect(mockPush).toHaveBeenCalledWith('/players/100');
  });

  it('applies focus ring styles when focused prop is true', () => {
    render(<PlayerRow player={SALAH} focused />);
    const row = screen.getByRole('row');
    expect(row.className).toContain('ring-2');
  });

  it('does not apply focus ring when focused prop is false', () => {
    render(<PlayerRow player={SALAH} focused={false} />);
    const row = screen.getByRole('row');
    expect(row.className).not.toContain('ring-2');
  });

  it('renders jersey image with correct src', () => {
    const { container } = render(<PlayerRow player={SALAH} />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', '/api/jerseys/14');
  });

  it('pin button click does not trigger row navigation', () => {
    mockPush.mockClear();
    render(<PlayerRow player={SALAH} />);
    const pin = screen.getByRole('button', { name: /pin m. salah/i });
    fireEvent.click(pin);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('has no accessibility violations (axe)', async () => {
    const { container } = render(
      <div role="table" aria-label="Players">
        <div role="rowgroup">
          <PlayerRow player={SALAH} />
        </div>
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
