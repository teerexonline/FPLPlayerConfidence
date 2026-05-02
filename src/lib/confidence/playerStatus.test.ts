import { describe, expect, it } from 'vitest';
import { getPlayerNameColorClass } from './playerStatus';

describe('getPlayerNameColorClass', () => {
  it('returns danger red for injured status', () => {
    expect(getPlayerNameColorClass('i', false)).toBe('text-status-danger');
  });

  it('returns danger red for suspended status', () => {
    expect(getPlayerNameColorClass('s', false)).toBe('text-status-danger');
  });

  it('returns warning amber for doubtful status', () => {
    expect(getPlayerNameColorClass('d', false)).toBe('text-status-warning');
  });

  it('returns warning amber for not-available status', () => {
    expect(getPlayerNameColorClass('n', false)).toBe('text-status-warning');
  });

  it('returns muted for unavailable status', () => {
    expect(getPlayerNameColorClass('u', false)).toBe('text-muted');
  });

  it('returns muted for stale player', () => {
    expect(getPlayerNameColorClass('a', true)).toBe('text-muted');
  });

  it('returns default text for available non-stale player', () => {
    expect(getPlayerNameColorClass('a', false)).toBe('text-text');
  });

  it('injury beats stale — injured + stale returns danger, not muted', () => {
    expect(getPlayerNameColorClass('i', true)).toBe('text-status-danger');
  });

  it('doubtful beats stale — doubtful + stale returns warning, not muted', () => {
    expect(getPlayerNameColorClass('d', true)).toBe('text-status-warning');
  });

  it('unknown status falls through to stale check and then default', () => {
    expect(getPlayerNameColorClass('x', false)).toBe('text-text');
    expect(getPlayerNameColorClass('x', true)).toBe('text-muted');
  });
});
