import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import userEvent from '@testing-library/user-event';
import { TeamConnectionSection } from './TeamConnectionSection';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockUpdateFplManagerId = vi.fn().mockResolvedValue({ error: null });
vi.mock('@/app/actions/updateFplManagerId', () => ({
  updateFplManagerIdAction: (...args: unknown[]): Promise<{ error: string | null }> =>
    mockUpdateFplManagerId(...args) as Promise<{ error: string | null }>,
}));

const localStorageMock = (() => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// ── Anonymous flow (isAuthenticated=false) ────────────────────────────────────

describe('TeamConnectionSection — anonymous user', () => {
  beforeEach(() => {
    localStorageMock.clear();
    mockPush.mockClear();
    mockUpdateFplManagerId.mockClear();
  });

  it('shows disconnected state when no team ID in localStorage', async () => {
    render(<TeamConnectionSection isAuthenticated={false} profileTeamId={null} />);
    await waitFor(() => {
      expect(screen.getByText(/no team connected/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /connect a team/i })).toHaveAttribute(
      'href',
      '/my-team',
    );
  });

  it('shows connected state when team ID is in localStorage', async () => {
    localStorageMock.setItem('fpl-team-id', '231177');
    render(<TeamConnectionSection isAuthenticated={false} profileTeamId={null} />);
    await waitFor(() => {
      expect(screen.getByText('231177')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view team/i })).toHaveAttribute('href', '/my-team');
  });

  it('shows "Confirm disconnect" on first click (two-step confirmation)', async () => {
    localStorageMock.setItem('fpl-team-id', '231177');
    render(<TeamConnectionSection isAuthenticated={false} profileTeamId={null} />);
    const user = userEvent.setup();

    await waitFor(() => screen.getByRole('button', { name: /disconnect/i }));
    await user.click(screen.getByRole('button', { name: /disconnect/i }));

    expect(screen.getByRole('button', { name: /confirm disconnect/i })).toBeInTheDocument();
    expect(screen.getByText(/cancel/i)).toBeInTheDocument();
    // localStorage not yet cleared
    expect(localStorageMock.getItem('fpl-team-id')).toBe('231177');
  });

  it('clears localStorage and redirects on second click (confirmed disconnect)', async () => {
    localStorageMock.setItem('fpl-team-id', '231177');
    render(<TeamConnectionSection isAuthenticated={false} profileTeamId={null} />);
    const user = userEvent.setup();

    await waitFor(() => screen.getByRole('button', { name: /disconnect/i }));
    await user.click(screen.getByRole('button', { name: /disconnect/i }));
    await user.click(screen.getByRole('button', { name: /confirm disconnect/i }));

    expect(localStorageMock.getItem('fpl-team-id')).toBeNull();
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('cancels disconnect flow when Cancel is clicked', async () => {
    localStorageMock.setItem('fpl-team-id', '231177');
    render(<TeamConnectionSection isAuthenticated={false} profileTeamId={null} />);
    const user = userEvent.setup();

    await waitFor(() => screen.getByRole('button', { name: /disconnect/i }));
    await user.click(screen.getByRole('button', { name: /disconnect/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.getByRole('button', { name: /^disconnect$/i })).toBeInTheDocument();
    expect(localStorageMock.getItem('fpl-team-id')).toBe('231177');
  });

  it('clears non-numeric team ID and shows disconnected state', async () => {
    localStorageMock.setItem('fpl-team-id', 'not-a-number');
    render(<TeamConnectionSection isAuthenticated={false} profileTeamId={null} />);
    await waitFor(() => {
      expect(screen.getByText(/no team connected/i)).toBeInTheDocument();
    });
    expect(localStorageMock.getItem('fpl-team-id')).toBeNull();
  });

  it('has no accessibility violations in disconnected state (axe)', async () => {
    const { container } = render(
      <TeamConnectionSection isAuthenticated={false} profileTeamId={null} />,
    );
    await waitFor(() => screen.getByText(/no team connected/i));
    expect(await axe(container)).toHaveNoViolations();
  });
});

// ── Authenticated flow (isAuthenticated=true) ─────────────────────────────────

describe('TeamConnectionSection — authenticated user', () => {
  beforeEach(() => {
    localStorageMock.clear();
    mockPush.mockClear();
    mockUpdateFplManagerId.mockClear().mockResolvedValue({ error: null });
  });

  it('shows connected state when profileTeamId is non-null', () => {
    render(<TeamConnectionSection isAuthenticated profileTeamId={231177} />);
    expect(screen.getByText('231177')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();
  });

  it('shows inline input form when profileTeamId is null (disconnected)', () => {
    render(<TeamConnectionSection isAuthenticated profileTeamId={null} />);
    expect(screen.getByLabelText(/fpl manager id/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /connect/i })).toBeInTheDocument();
    // No /my-team link in auth disconnected state
    expect(screen.queryByRole('link', { name: /connect a team/i })).not.toBeInTheDocument();
  });

  it('connects team: calls server action and writes localStorage', async () => {
    render(<TeamConnectionSection isAuthenticated profileTeamId={null} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/fpl manager id/i), '231177');
    await user.click(screen.getByRole('button', { name: /^connect$/i }));

    await waitFor(() => {
      expect(mockUpdateFplManagerId).toHaveBeenCalledWith(231177);
    });
    expect(localStorageMock.getItem('fpl-team-id')).toBe('231177');
    // UI switches to connected state
    await waitFor(() => {
      expect(screen.getByText('231177')).toBeInTheDocument();
    });
  });

  it('shows error message when server action fails', async () => {
    mockUpdateFplManagerId.mockResolvedValueOnce({ error: 'DB error' });
    render(<TeamConnectionSection isAuthenticated profileTeamId={null} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/fpl manager id/i), '231177');
    await user.click(screen.getByRole('button', { name: /^connect$/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to connect/i)).toBeInTheDocument();
    });
    // Does not write to localStorage on error
    expect(localStorageMock.getItem('fpl-team-id')).toBeNull();
  });

  it('profile value takes precedence over localStorage', () => {
    // localStorage has a different (stale) team ID
    localStorageMock.setItem('fpl-team-id', '999999');
    render(<TeamConnectionSection isAuthenticated profileTeamId={231177} />);
    // Shows the profile value, not the stale localStorage value
    expect(screen.getByText('231177')).toBeInTheDocument();
  });

  it('disconnects: calls server action with null, clears localStorage, stays on settings', async () => {
    localStorageMock.setItem('fpl-team-id', '231177');
    render(<TeamConnectionSection isAuthenticated profileTeamId={231177} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /disconnect/i }));
    await user.click(screen.getByRole('button', { name: /confirm disconnect/i }));

    await waitFor(() => {
      expect(mockUpdateFplManagerId).toHaveBeenCalledWith(null);
    });
    expect(localStorageMock.getItem('fpl-team-id')).toBeNull();
    // Does NOT redirect — stays on settings to allow reconnect
    expect(mockPush).not.toHaveBeenCalled();
    // UI returns to inline input
    await waitFor(() => {
      expect(screen.getByLabelText(/fpl manager id/i)).toBeInTheDocument();
    });
  });

  it('has no accessibility violations with inline input (axe)', async () => {
    const { container } = render(<TeamConnectionSection isAuthenticated profileTeamId={null} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
