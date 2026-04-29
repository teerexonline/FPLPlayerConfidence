import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { describe, expect, it, vi } from 'vitest';
import { GwControlBar } from './GwControlBar';

function makeProps(overrides: Partial<Parameters<typeof GwControlBar>[0]> = {}) {
  return {
    formation: '4-3-3',
    selectedGw: 20,
    currentGameweek: 34,
    firstGameweek: 1,
    onSelectGw: vi.fn(),
    ...overrides,
  };
}

// ── Formation label ───────────────────────────────────────────────────────────

describe('GwControlBar — formation label', () => {
  it('renders the formation string', () => {
    render(<GwControlBar {...makeProps({ formation: '3-5-2' })} />);
    expect(screen.getByText('3-5-2')).toBeInTheDocument();
  });

  it('renders the "Formation" heading label', () => {
    render(<GwControlBar {...makeProps()} />);
    expect(screen.getByText('Formation')).toBeInTheDocument();
  });

  it('has aria-label describing the formation', () => {
    render(<GwControlBar {...makeProps({ formation: '4-5-1' })} />);
    expect(screen.getByLabelText('Formation: 4-5-1')).toBeInTheDocument();
  });
});

// ── GW indicator ─────────────────────────────────────────────────────────────

describe('GwControlBar — GW indicator', () => {
  it('shows the selected GW between the arrows', () => {
    render(<GwControlBar {...makeProps({ selectedGw: 34 })} />);
    expect(screen.getByText('GW34')).toBeInTheDocument();
  });

  it('updates GW indicator when selectedGw changes', () => {
    const { rerender } = render(<GwControlBar {...makeProps({ selectedGw: 10 })} />);
    expect(screen.getByText('GW10')).toBeInTheDocument();
    rerender(<GwControlBar {...makeProps({ selectedGw: 15 })} />);
    expect(screen.getByText('GW15')).toBeInTheDocument();
    expect(screen.queryByText('GW10')).not.toBeInTheDocument();
  });
});

// ── Arrow navigation ──────────────────────────────────────────────────────────

describe('GwControlBar — arrow navigation', () => {
  it('clicking the left arrow calls onSelectGw(selectedGw - 1)', async () => {
    const onSelectGw = vi.fn();
    render(<GwControlBar {...makeProps({ selectedGw: 20, onSelectGw })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Previous gameweek' }));
    expect(onSelectGw).toHaveBeenCalledOnce();
    expect(onSelectGw).toHaveBeenCalledWith(19);
  });

  it('clicking the right arrow calls onSelectGw(selectedGw + 1)', async () => {
    const onSelectGw = vi.fn();
    render(<GwControlBar {...makeProps({ selectedGw: 20, onSelectGw })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Next gameweek' }));
    expect(onSelectGw).toHaveBeenCalledOnce();
    expect(onSelectGw).toHaveBeenCalledWith(21);
  });
});

// ── Boundary states ───────────────────────────────────────────────────────────

describe('GwControlBar — boundaries', () => {
  it('left arrow is disabled at firstGameweek (GW1)', () => {
    render(<GwControlBar {...makeProps({ selectedGw: 1, firstGameweek: 1 })} />);
    expect(screen.getByRole('button', { name: 'Previous gameweek' })).toBeDisabled();
  });

  it('left arrow is disabled at the earliest available GW (non-GW1 firstGameweek)', () => {
    render(<GwControlBar {...makeProps({ selectedGw: 5, firstGameweek: 5 })} />);
    expect(screen.getByRole('button', { name: 'Previous gameweek' })).toBeDisabled();
  });

  it('right arrow is disabled at currentGameweek', () => {
    render(<GwControlBar {...makeProps({ selectedGw: 34, currentGameweek: 34 })} />);
    expect(screen.getByRole('button', { name: 'Next gameweek' })).toBeDisabled();
  });

  it('left arrow is enabled when selectedGw > firstGameweek', () => {
    render(<GwControlBar {...makeProps({ selectedGw: 10, firstGameweek: 1 })} />);
    expect(screen.getByRole('button', { name: 'Previous gameweek' })).not.toBeDisabled();
  });

  it('right arrow is enabled when selectedGw < currentGameweek', () => {
    render(<GwControlBar {...makeProps({ selectedGw: 20, currentGameweek: 34 })} />);
    expect(screen.getByRole('button', { name: 'Next gameweek' })).not.toBeDisabled();
  });

  it('disabled left arrow does not call onSelectGw when clicked', async () => {
    const onSelectGw = vi.fn();
    render(<GwControlBar {...makeProps({ selectedGw: 1, firstGameweek: 1, onSelectGw })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Previous gameweek' }));
    expect(onSelectGw).not.toHaveBeenCalled();
  });

  it('disabled right arrow does not call onSelectGw when clicked', async () => {
    const onSelectGw = vi.fn();
    render(<GwControlBar {...makeProps({ selectedGw: 34, currentGameweek: 34, onSelectGw })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Next gameweek' }));
    expect(onSelectGw).not.toHaveBeenCalled();
  });

  it('both arrows disabled when only one GW available (firstGameweek === currentGameweek)', () => {
    render(
      <GwControlBar {...makeProps({ selectedGw: 1, firstGameweek: 1, currentGameweek: 1 })} />,
    );
    expect(screen.getByRole('button', { name: 'Previous gameweek' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next gameweek' })).toBeDisabled();
  });
});

// ── Combined rendering ────────────────────────────────────────────────────────

describe('GwControlBar — combined rendering', () => {
  it('renders formation label and GW navigation together', () => {
    render(<GwControlBar {...makeProps({ formation: '4-4-2', selectedGw: 28 })} />);
    expect(screen.getByText('4-4-2')).toBeInTheDocument();
    expect(screen.getByText('GW28')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous gameweek' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next gameweek' })).toBeInTheDocument();
  });

  it('GW navigation is in an accessible group', () => {
    render(<GwControlBar {...makeProps()} />);
    expect(screen.getByRole('group', { name: 'Gameweek navigation' })).toBeInTheDocument();
  });

  it('has no accessibility violations (axe)', async () => {
    const { container } = render(<GwControlBar {...makeProps()} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
