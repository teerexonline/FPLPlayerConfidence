import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import userEvent from '@testing-library/user-event';
import { ThemeSelector } from './ThemeSelector';

// next-themes mock
const mockSetTheme = vi.fn();
let mockTheme = 'system';

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: mockTheme, setTheme: mockSetTheme }),
}));

// useSyncExternalStore: return client (mounted) snapshot so ThemeSelector renders
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useSyncExternalStore: (
      _subscribe: unknown,
      getSnapshot: () => unknown,
      _getServerSnapshot: unknown,
    ) => getSnapshot(),
  };
});

describe('ThemeSelector', () => {
  beforeEach(() => {
    mockTheme = 'system';
    mockSetTheme.mockClear();
  });

  it('renders System, Light, and Dark radio options', () => {
    render(<ThemeSelector />);

    expect(screen.getByRole('radio', { name: /system/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /light/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /dark/i })).toBeInTheDocument();
  });

  it('marks the current theme as checked', () => {
    mockTheme = 'dark';
    render(<ThemeSelector />);

    expect(screen.getByRole('radio', { name: /dark/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /light/i })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /system/i })).not.toBeChecked();
  });

  it('calls setTheme with "light" when the Light option is selected', async () => {
    render(<ThemeSelector />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('radio', { name: /light/i }));

    expect(mockSetTheme).toHaveBeenCalledOnce();
    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });

  it('calls setTheme with "dark" when the Dark option is selected', async () => {
    render(<ThemeSelector />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('radio', { name: /dark/i }));

    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('calls setTheme with "system" when the System option is selected', async () => {
    mockTheme = 'dark';
    render(<ThemeSelector />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('radio', { name: /system/i }));

    expect(mockSetTheme).toHaveBeenCalledWith('system');
  });

  it('has a radiogroup role on the container', () => {
    render(<ThemeSelector />);
    expect(screen.getByRole('radiogroup', { name: /theme/i })).toBeInTheDocument();
  });

  it('has no accessibility violations (axe)', async () => {
    const { container } = render(<ThemeSelector />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
