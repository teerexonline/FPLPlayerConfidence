import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConnectTeamForm } from './ConnectTeamForm';
import type { MyTeamData } from './types';

// Minimal MyTeamData to satisfy the type in onSuccess
const MOCK_DATA: MyTeamData = {
  managerName: 'Test Manager',
  teamName: 'Test FC',
  overallRank: 123456,
  overallPoints: 1800,
  gameweek: 33,
  teamConfidencePercent: 62.5,
  defencePercent: 65,
  midfieldPercent: 60,
  attackPercent: 62.5,
  defenceXp: 18,
  midfieldXp: 22,
  attackXp: 17,
  starters: [],
  bench: [],
  syncedAt: Date.now(),
  freeHitBypassed: false,
  freeHitGameweek: null,
  isGw1FreeHit: false,
  preDeadlineFallback: false,
  currentGameweek: 33,
  availableGameweeks: [33],
  lastSeasonGameweek: 38,
  viewMode: 'historical',
  projectedTeamXp: null,
  appliedSwaps: [],
};

function submitForm(): void {
  const form = screen.getByRole('button', { name: /Load my team/i }).closest('form');
  if (!(form instanceof HTMLFormElement)) throw new Error('form not found');
  fireEvent.submit(form);
}

describe('ConnectTeamForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the heading, input, helper text, and submit button', () => {
    render(<ConnectTeamForm onSuccess={vi.fn()} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Connect your FPL team');
    expect(screen.getByLabelText('FPL Team ID')).toBeInTheDocument();
    expect(screen.getByText(/Find your team ID/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Load my team/i })).toBeInTheDocument();
  });

  it('shows a validation error when submitting empty input', async () => {
    render(<ConnectTeamForm onSuccess={vi.fn()} />);
    submitForm();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/valid numeric team ID/i);
    });
  });

  it('shows a validation error when submitting non-numeric input', async () => {
    render(<ConnectTeamForm onSuccess={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('FPL Team ID'), { target: { value: 'abc123' } });
    submitForm();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/valid numeric team ID/i);
    });
  });

  it('clears the validation error when the user starts typing after an error', async () => {
    render(<ConnectTeamForm onSuccess={vi.fn()} />);
    submitForm();
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('FPL Team ID'), { target: { value: '2' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('calls onSuccess with the team ID and data on a successful fetch', async () => {
    const onSuccess = vi.fn();
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(MOCK_DATA), { status: 200 }),
    );

    render(<ConnectTeamForm onSuccess={onSuccess} />);
    fireEvent.change(screen.getByLabelText('FPL Team ID'), { target: { value: '231177' } });
    submitForm();

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(231177, MOCK_DATA);
    });
  });

  it('shows NOT_FOUND error message on 404 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'NOT_FOUND' }), { status: 404 }),
    );

    render(<ConnectTeamForm onSuccess={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('FPL Team ID'), { target: { value: '999999999' } });
    submitForm();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Team not found/i);
    });
  });

  it('shows NETWORK_ERROR message when fetch throws', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('ECONNRESET'));

    render(<ConnectTeamForm onSuccess={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('FPL Team ID'), { target: { value: '231177' } });
    submitForm();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/connection/i);
    });
  });

  it('disables the input and button while loading', async () => {
    // Never resolves — keeps the component in the loading state
    vi.mocked(fetch).mockReturnValueOnce(new Promise(() => undefined));

    render(<ConnectTeamForm onSuccess={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('FPL Team ID'), { target: { value: '231177' } });
    submitForm();

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeDisabled();
      expect(screen.getByLabelText('FPL Team ID')).toBeDisabled();
      expect(screen.getByRole('button')).toHaveTextContent('Loading…');
    });
  });

  it('has no accessibility violations in idle state (axe)', async () => {
    const { container } = render(<ConnectTeamForm onSuccess={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
