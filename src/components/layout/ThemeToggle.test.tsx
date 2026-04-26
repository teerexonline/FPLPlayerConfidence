import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useTheme } from 'next-themes';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeToggle } from './ThemeToggle';

// ── Module mocks ─────────────────────────────────────────────────────────────

const mockSetTheme = vi.hoisted(() => vi.fn());

vi.mock('next-themes', () => ({
  useTheme: vi.fn(() => ({ resolvedTheme: 'light', setTheme: mockSetTheme, themes: [] })),
}));

afterEach(() => {
  vi.mocked(useTheme).mockReturnValue({
    resolvedTheme: 'light',
    setTheme: mockSetTheme,
    themes: [],
  });
  mockSetTheme.mockReset();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ThemeToggle', () => {
  // In jsdom, useSyncExternalStore uses the client snapshot (() => true),
  // so hasMounted is always true — we see the real button, not the placeholder.

  it('renders a button labeled "Dark" when resolved theme is light', () => {
    vi.mocked(useTheme).mockReturnValue({
      resolvedTheme: 'light',
      setTheme: mockSetTheme,
      themes: [],
    });
    render(<ThemeToggle />);
    const btn = screen.getByRole('button', { name: /switch to dark mode/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent('Dark');
  });

  it('renders a button labeled "Light" when resolved theme is dark', () => {
    vi.mocked(useTheme).mockReturnValue({
      resolvedTheme: 'dark',
      setTheme: mockSetTheme,
      themes: [],
    });
    render(<ThemeToggle />);
    const btn = screen.getByRole('button', { name: /switch to light mode/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent('Light');
  });

  it('calls setTheme("dark") when clicked in light mode', async () => {
    vi.mocked(useTheme).mockReturnValue({
      resolvedTheme: 'light',
      setTheme: mockSetTheme,
      themes: [],
    });
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole('button'));
    expect(mockSetTheme).toHaveBeenCalledOnce();
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('calls setTheme("light") when clicked in dark mode', async () => {
    vi.mocked(useTheme).mockReturnValue({
      resolvedTheme: 'dark',
      setTheme: mockSetTheme,
      themes: [],
    });
    const user = userEvent.setup();
    render(<ThemeToggle />);
    await user.click(screen.getByRole('button'));
    expect(mockSetTheme).toHaveBeenCalledOnce();
    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });

  it('applies a custom className to the rendered button', () => {
    render(<ThemeToggle className="my-toggle" />);
    expect(screen.getByRole('button')).toHaveClass('my-toggle');
  });
});
