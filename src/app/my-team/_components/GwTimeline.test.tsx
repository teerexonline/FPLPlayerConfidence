import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'jest-axe';
import { GwTimeline } from './GwTimeline';

describe('GwTimeline', () => {
  it('renders a pill for every GW from 1 to currentGameweek', () => {
    render(
      <GwTimeline currentGameweek={5} firstGameweek={1} selectedGw={5} onSelectGw={vi.fn()} />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });

  it('shows GW label for all gameweeks at or after firstGameweek', () => {
    render(
      <GwTimeline currentGameweek={5} firstGameweek={3} selectedGw={3} onSelectGw={vi.fn()} />,
    );
    // GW3–GW5 should show labels
    expect(screen.getByText('GW3')).toBeInTheDocument();
    expect(screen.getByText('GW4')).toBeInTheDocument();
    expect(screen.getByText('GW5')).toBeInTheDocument();
  });

  it('shows "—" for gameweeks before firstGameweek', () => {
    render(
      <GwTimeline currentGameweek={5} firstGameweek={3} selectedGw={3} onSelectGw={vi.fn()} />,
    );
    // GW1 and GW2 are before firstGameweek → show "—"
    const dashes = screen.getAllByText('—');
    expect(dashes).toHaveLength(2);
  });

  it('marks the selected pill with aria-current', () => {
    render(
      <GwTimeline currentGameweek={5} firstGameweek={1} selectedGw={3} onSelectGw={vi.fn()} />,
    );
    const currentEl = document.querySelector('[aria-current="true"]');
    expect(currentEl).not.toBeNull();
    expect(currentEl?.textContent).toContain('GW3');
  });

  it('only one pill has aria-current at a time', () => {
    render(
      <GwTimeline currentGameweek={10} firstGameweek={1} selectedGw={5} onSelectGw={vi.fn()} />,
    );
    expect(document.querySelectorAll('[aria-current="true"]')).toHaveLength(1);
  });

  it('calls onSelectGw with the correct GW when a pill is clicked', () => {
    const onSelect = vi.fn();
    render(
      <GwTimeline currentGameweek={5} firstGameweek={1} selectedGw={5} onSelectGw={onSelect} />,
    );
    fireEvent.click(screen.getByText('GW1'));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('on-demand GWs (in range, not yet cached) are clickable', () => {
    // GW4 is in range (firstGameweek=1) but was not previously cached.
    // The old availableGameweeks approach would show it as "—"; the new
    // firstGameweek approach should make it clickable.
    const onSelect = vi.fn();
    render(
      <GwTimeline currentGameweek={5} firstGameweek={1} selectedGw={5} onSelectGw={onSelect} />,
    );
    // GW4 is not in any cached set — but it should still be clickable
    fireEvent.click(screen.getByText('GW4'));
    expect(onSelect).toHaveBeenCalledWith(4);
  });

  it('GWs before firstGameweek are not clickable', () => {
    const onSelect = vi.fn();
    render(
      <GwTimeline currentGameweek={5} firstGameweek={3} selectedGw={3} onSelectGw={onSelect} />,
    );
    // GW1 and GW2 are before firstGameweek — click them
    const dashPills = screen.getAllByText('—');
    for (const pill of dashPills) {
      fireEvent.click(pill);
    }
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('clicking the already-selected pill does not call onSelectGw', () => {
    const onSelect = vi.fn();
    render(
      <GwTimeline currentGameweek={5} firstGameweek={1} selectedGw={3} onSelectGw={onSelect} />,
    );
    fireEvent.click(screen.getByText('GW3'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('renders the section with an accessible label', () => {
    render(
      <GwTimeline currentGameweek={5} firstGameweek={1} selectedGw={1} onSelectGw={vi.fn()} />,
    );
    expect(screen.getByRole('navigation', { name: /gameweek timeline/i })).toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <GwTimeline currentGameweek={10} firstGameweek={4} selectedGw={5} onSelectGw={vi.fn()} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
