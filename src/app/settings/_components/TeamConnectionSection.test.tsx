import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import userEvent from '@testing-library/user-event';
import { TeamConnectionSection } from './TeamConnectionSection';

// next/link renders as a plain anchor in tests
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

describe('TeamConnectionSection', () => {
  beforeEach(() => {
    localStorageMock.clear();
    mockPush.mockClear();
  });

  it('shows disconnected state when no team ID in localStorage', async () => {
    render(<TeamConnectionSection />);
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
    render(<TeamConnectionSection />);
    await waitFor(() => {
      expect(screen.getByText('231177')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view team/i })).toHaveAttribute('href', '/my-team');
  });

  it('shows "Confirm disconnect" on first click (two-step confirmation)', async () => {
    localStorageMock.setItem('fpl-team-id', '231177');
    render(<TeamConnectionSection />);
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
    render(<TeamConnectionSection />);
    const user = userEvent.setup();

    await waitFor(() => screen.getByRole('button', { name: /disconnect/i }));
    await user.click(screen.getByRole('button', { name: /disconnect/i }));
    await user.click(screen.getByRole('button', { name: /confirm disconnect/i }));

    expect(localStorageMock.getItem('fpl-team-id')).toBeNull();
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('cancels disconnect flow when Cancel is clicked', async () => {
    localStorageMock.setItem('fpl-team-id', '231177');
    render(<TeamConnectionSection />);
    const user = userEvent.setup();

    await waitFor(() => screen.getByRole('button', { name: /disconnect/i }));
    await user.click(screen.getByRole('button', { name: /disconnect/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    // Back to normal disconnect label
    expect(screen.getByRole('button', { name: /^disconnect$/i })).toBeInTheDocument();
    expect(localStorageMock.getItem('fpl-team-id')).toBe('231177');
  });

  it('clears non-numeric team ID and shows disconnected state', async () => {
    localStorageMock.setItem('fpl-team-id', 'not-a-number');
    render(<TeamConnectionSection />);
    await waitFor(() => {
      expect(screen.getByText(/no team connected/i)).toBeInTheDocument();
    });
    expect(localStorageMock.getItem('fpl-team-id')).toBeNull();
  });

  it('has no accessibility violations in disconnected state (axe)', async () => {
    const { container } = render(<TeamConnectionSection />);
    await waitFor(() => screen.getByText(/no team connected/i));
    expect(await axe(container)).toHaveNoViolations();
  });
});
