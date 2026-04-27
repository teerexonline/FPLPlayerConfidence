import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'jest-axe';
import { GwTimeline } from './GwTimeline';

const AVAILABLE = new Set([1, 2, 3, 5, 10]);

describe('GwTimeline', () => {
  it('renders a pill for every GW from 1 to currentGameweek', () => {
    render(
      <GwTimeline
        currentGameweek={5}
        availableGameweeks={new Set([1, 3, 5])}
        selectedGw={5}
        onSelectGw={vi.fn()}
      />,
    );
    // GW1–GW5: 5 pills visible
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });

  it('shows GW label for available gameweeks', () => {
    render(
      <GwTimeline
        currentGameweek={3}
        availableGameweeks={new Set([1, 2, 3])}
        selectedGw={1}
        onSelectGw={vi.fn()}
      />,
    );
    expect(screen.getByText('GW1')).toBeInTheDocument();
    expect(screen.getByText('GW2')).toBeInTheDocument();
    expect(screen.getByText('GW3')).toBeInTheDocument();
  });

  it('shows "—" label for unavailable gameweeks (no cached data)', () => {
    render(
      <GwTimeline
        currentGameweek={3}
        availableGameweeks={new Set([1, 3])}
        selectedGw={1}
        onSelectGw={vi.fn()}
      />,
    );
    // GW2 has no data → shows "—"
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('marks the selected pill with aria-current', () => {
    render(
      <GwTimeline
        currentGameweek={5}
        availableGameweeks={AVAILABLE}
        selectedGw={3}
        onSelectGw={vi.fn()}
      />,
    );
    const currentEl = document.querySelector('[aria-current="true"]');
    expect(currentEl).not.toBeNull();
    expect(currentEl?.textContent).toContain('GW3');
  });

  it('only one pill has aria-current at a time', () => {
    render(
      <GwTimeline
        currentGameweek={10}
        availableGameweeks={AVAILABLE}
        selectedGw={5}
        onSelectGw={vi.fn()}
      />,
    );
    expect(document.querySelectorAll('[aria-current="true"]')).toHaveLength(1);
  });

  it('calls onSelectGw with the correct GW when an available pill is clicked', () => {
    const onSelect = vi.fn();
    render(
      <GwTimeline
        currentGameweek={5}
        availableGameweeks={AVAILABLE}
        selectedGw={5}
        onSelectGw={onSelect}
      />,
    );
    fireEvent.click(screen.getByText('GW1'));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('unavailable pills are not clickable', () => {
    const onSelect = vi.fn();
    render(
      <GwTimeline
        currentGameweek={4}
        availableGameweeks={new Set([1, 4])}
        selectedGw={1}
        onSelectGw={onSelect}
      />,
    );
    // GW2 and GW3 are unavailable — click them
    const dashPills = screen.getAllByText('—');
    for (const pill of dashPills) {
      fireEvent.click(pill);
    }
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('clicking the already-selected pill does not call onSelectGw', () => {
    const onSelect = vi.fn();
    render(
      <GwTimeline
        currentGameweek={5}
        availableGameweeks={AVAILABLE}
        selectedGw={3}
        onSelectGw={onSelect}
      />,
    );
    fireEvent.click(screen.getByText('GW3'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('renders the section with an accessible label', () => {
    render(
      <GwTimeline
        currentGameweek={5}
        availableGameweeks={AVAILABLE}
        selectedGw={1}
        onSelectGw={vi.fn()}
      />,
    );
    expect(screen.getByRole('navigation', { name: /gameweek timeline/i })).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <GwTimeline
        currentGameweek={10}
        availableGameweeks={AVAILABLE}
        selectedGw={5}
        onSelectGw={vi.fn()}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
