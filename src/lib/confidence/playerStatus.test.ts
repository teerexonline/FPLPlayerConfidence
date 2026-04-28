import { describe, expect, it } from 'vitest';
import { getPlayerNameColorClass } from './playerStatus';

describe('getPlayerNameColorClass', () => {
  it('returns danger red for injured status', () => {
    expect(getPlayerNameColorClass('i', 3)).toBe('text-status-danger');
  });

  it('returns danger red for suspended status', () => {
    expect(getPlayerNameColorClass('s', 3)).toBe('text-status-danger');
  });

  it('returns warning amber for doubtful status', () => {
    expect(getPlayerNameColorClass('d', 3)).toBe('text-status-warning');
  });

  it('returns warning amber for not-available status', () => {
    expect(getPlayerNameColorClass('n', 3)).toBe('text-status-warning');
  });

  it('returns muted for unavailable status', () => {
    expect(getPlayerNameColorClass('u', 3)).toBe('text-muted');
  });

  it('returns muted for stale data with recentAppearances=1', () => {
    expect(getPlayerNameColorClass('a', 1)).toBe('text-muted');
  });

  it('returns muted for stale data with recentAppearances=0', () => {
    expect(getPlayerNameColorClass('a', 0)).toBe('text-muted');
  });

  it('returns default text for available non-stale player (recentAppearances=2)', () => {
    expect(getPlayerNameColorClass('a', 2)).toBe('text-text');
  });

  it('returns default text for available non-stale player (recentAppearances=3)', () => {
    expect(getPlayerNameColorClass('a', 3)).toBe('text-text');
  });

  it('injury beats stale — injured + 0 appearances returns danger, not muted', () => {
    expect(getPlayerNameColorClass('i', 0)).toBe('text-status-danger');
  });

  it('doubtful beats stale — doubtful + 0 appearances returns warning, not muted', () => {
    expect(getPlayerNameColorClass('d', 0)).toBe('text-status-warning');
  });

  it('unknown status falls through to stale check and then default', () => {
    expect(getPlayerNameColorClass('x', 3)).toBe('text-text');
    expect(getPlayerNameColorClass('x', 0)).toBe('text-muted');
  });
});
