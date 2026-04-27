import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { PlayerStatusIndicator } from './PlayerStatusIndicator';

describe('PlayerStatusIndicator', () => {
  it('renders nothing for status="a" (available)', () => {
    const { container } = render(
      <PlayerStatusIndicator status="a" chanceOfPlaying={null} news="" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for empty status string', () => {
    const { container } = render(
      <PlayerStatusIndicator status="" chanceOfPlaying={null} news="" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders an amber dot for status="d" (doubtful)', () => {
    render(<PlayerStatusIndicator status="d" chanceOfPlaying={50} news="Knock" />);
    const dot = screen.getByRole('img');
    expect(dot).toBeInTheDocument();
    expect(dot.className).toContain('status-warning');
  });

  it('renders an amber dot for status="n" (not available)', () => {
    render(<PlayerStatusIndicator status="n" chanceOfPlaying={25} news="" />);
    const dot = screen.getByRole('img');
    expect(dot.className).toContain('status-warning');
  });

  it('renders a red dot for status="i" (injured)', () => {
    render(<PlayerStatusIndicator status="i" chanceOfPlaying={0} news="Hamstring" />);
    const dot = screen.getByRole('img');
    expect(dot.className).toContain('status-danger');
  });

  it('renders a red dot for status="s" (suspended)', () => {
    render(<PlayerStatusIndicator status="s" chanceOfPlaying={0} news="Ban" />);
    const dot = screen.getByRole('img');
    expect(dot.className).toContain('status-danger');
  });

  it('renders a gray dot for status="u" (unavailable/left club)', () => {
    render(<PlayerStatusIndicator status="u" chanceOfPlaying={null} news="Left on loan" />);
    const dot = screen.getByRole('img');
    expect(dot.className).toContain('status-muted');
  });

  it('combines news and chanceOfPlaying in the tooltip', () => {
    render(<PlayerStatusIndicator status="d" chanceOfPlaying={75} news="Knock" />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Knock · 75% chance to play');
  });

  it('shows only news when chanceOfPlaying is null', () => {
    render(<PlayerStatusIndicator status="i" chanceOfPlaying={null} news="ACL tear" />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'ACL tear');
  });

  it('shows only chance-to-play when news is empty', () => {
    render(<PlayerStatusIndicator status="d" chanceOfPlaying={50} news="" />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', '50% chance to play');
  });

  it('falls back to generic aria-label when news and chanceOfPlaying are both absent', () => {
    render(<PlayerStatusIndicator status="i" chanceOfPlaying={null} news="" />);
    expect(screen.getByRole('img')).toHaveAttribute('aria-label', 'Player status: i');
  });

  it('has no accessibility violations for doubtful player (axe)', async () => {
    const { container } = render(
      <PlayerStatusIndicator status="d" chanceOfPlaying={75} news="Knock" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no accessibility violations for available player — renders nothing (axe)', async () => {
    const { container } = render(
      <PlayerStatusIndicator status="a" chanceOfPlaying={null} news="" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
