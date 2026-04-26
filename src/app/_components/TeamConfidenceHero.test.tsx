import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { TeamConfidenceHero } from './TeamConfidenceHero';
import type { MyTeamData } from '@/app/my-team/_components/types';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
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

const MOCK_DATA: MyTeamData = {
  managerName: 'Test Manager',
  teamName: 'Test FC',
  overallRank: 50000,
  overallPoints: 1800,
  gameweek: 33,
  teamConfidencePercent: 72.5,
  defencePercent: 70,
  midfieldPercent: 60,
  attackPercent: 68,
  starters: [],
  bench: [],
  syncedAt: Date.now(),
  freeHitBypassed: false,
  freeHitGameweek: null,
  isGw1FreeHit: false,
};

describe('TeamConfidenceHero', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the CTA card when no team ID is stored', async () => {
    render(<TeamConfidenceHero />);
    // Hydration is synchronous for localStorage absence — no await needed for absent state
    await waitFor(() => {
      expect(screen.getByText('No team connected')).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /connect team/i })).toBeInTheDocument();
  });

  it('renders "My Team" heading in both the CTA and loaded card', async () => {
    render(<TeamConfidenceHero />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /my team/i })).toBeInTheDocument();
    });
  });

  it('renders the loaded card when fetch succeeds', async () => {
    localStorageMock.setItem('fpl-team-id', '12345');
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(MOCK_DATA), { status: 200 }));

    render(<TeamConfidenceHero />);

    await waitFor(() => {
      expect(screen.getByText('72.5%')).toBeInTheDocument();
    });
    expect(screen.getByText('Team Confidence')).toBeInTheDocument();
    expect(screen.getByText(/Test FC/)).toBeInTheDocument();
  });

  it('renders the CTA card when fetch fails', async () => {
    localStorageMock.setItem('fpl-team-id', '12345');
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'NOT_FOUND' }), { status: 404 }),
    );

    render(<TeamConfidenceHero />);

    await waitFor(() => {
      expect(screen.getByText('No team connected')).toBeInTheDocument();
    });
  });

  it('clears invalid non-numeric team ID from localStorage', async () => {
    localStorageMock.setItem('fpl-team-id', 'not-a-number');
    render(<TeamConfidenceHero />);

    await waitFor(() => {
      expect(screen.getByText('No team connected')).toBeInTheDocument();
    });
    expect(localStorageMock.getItem('fpl-team-id')).toBeNull();
  });

  it('has no accessibility violations in CTA state (axe)', async () => {
    const { container } = render(<TeamConfidenceHero />);
    await waitFor(() => {
      expect(screen.getByText('No team connected')).toBeInTheDocument();
    });
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no accessibility violations in loaded state (axe)', async () => {
    localStorageMock.setItem('fpl-team-id', '12345');
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(MOCK_DATA), { status: 200 }));

    const { container } = render(<TeamConfidenceHero />);
    await waitFor(() => screen.getByText('72.5%'));
    expect(await axe(container)).toHaveNoViolations();
  });
});
