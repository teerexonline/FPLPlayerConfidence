import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LivePlayerStreakIndicator } from './LivePlayerStreakIndicator';
import type { LivePlayerStreakIndicatorProps } from './LivePlayerStreakIndicator';

const BASE: LivePlayerStreakIndicatorProps = {
  level: 'red_hot',
  status: 'a',
  isStale: false,
  currentGW: 30,
};

describe('LivePlayerStreakIndicator', () => {
  it('renders the flame when player is available and not stale', () => {
    render(<LivePlayerStreakIndicator {...BASE} />);
    expect(screen.getByRole('img', { name: /fresh streak/i })).toBeInTheDocument();
  });

  it('renders null when level is null (player is cold)', () => {
    const { container } = render(<LivePlayerStreakIndicator {...BASE} level={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('hides the flame when status is injured (i)', () => {
    const { container } = render(<LivePlayerStreakIndicator {...BASE} status="i" />);
    expect(container.firstChild).toBeNull();
  });

  it('hides the flame when status is doubtful (d)', () => {
    const { container } = render(<LivePlayerStreakIndicator {...BASE} status="d" />);
    expect(container.firstChild).toBeNull();
  });

  it('hides the flame when status is suspended (s)', () => {
    const { container } = render(<LivePlayerStreakIndicator {...BASE} status="s" />);
    expect(container.firstChild).toBeNull();
  });

  it('hides the flame when status is not available (n)', () => {
    const { container } = render(<LivePlayerStreakIndicator {...BASE} status="n" />);
    expect(container.firstChild).toBeNull();
  });

  it('hides the flame when status is unavailable (u)', () => {
    const { container } = render(<LivePlayerStreakIndicator {...BASE} status="u" />);
    expect(container.firstChild).toBeNull();
  });

  it('hides the flame when isStale is true (available but stale data)', () => {
    const { container } = render(<LivePlayerStreakIndicator {...BASE} isStale={true} />);
    expect(container.firstChild).toBeNull();
  });

  it('hides the flame when both injured and stale (status takes effect first)', () => {
    const { container } = render(<LivePlayerStreakIndicator {...BASE} status="i" isStale={true} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the flame when status is empty string (treated as available)', () => {
    render(<LivePlayerStreakIndicator {...BASE} status="" />);
    expect(screen.getByRole('img', { name: /fresh streak/i })).toBeInTheDocument();
  });

  it('passes size=lg to HotStreakIndicator — renders text label', () => {
    render(<LivePlayerStreakIndicator {...BASE} size="lg" />);
    expect(screen.getByText('Fresh')).toBeInTheDocument();
  });

  it('renders med_hot flame correctly', () => {
    render(<LivePlayerStreakIndicator {...BASE} level="med_hot" />);
    expect(screen.getByRole('img', { name: /recent streak/i })).toBeInTheDocument();
  });

  it('renders low_hot flame correctly', () => {
    render(<LivePlayerStreakIndicator {...BASE} level="low_hot" />);
    expect(screen.getByRole('img', { name: /fading streak/i })).toBeInTheDocument();
  });
});
