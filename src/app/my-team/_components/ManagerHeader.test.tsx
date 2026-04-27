import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ManagerHeader } from './ManagerHeader';
import type { ManagerHeaderProps } from './ManagerHeader';

const BASE: ManagerHeaderProps = {
  managerName: 'Test Manager',
  teamName: 'Test FC',
  overallRank: 12345,
  overallPoints: 1000,
  gameweek: 33,
  freeHitBypassed: false,
  freeHitGameweek: null,
  isGw1FreeHit: false,
  preDeadlineFallback: false,
};

describe('ManagerHeader', () => {
  it('renders manager name and team stats', () => {
    render(<ManagerHeader {...BASE} />);
    expect(screen.getByText('Test Manager')).toBeInTheDocument();
    expect(screen.getByText('Test FC')).toBeInTheDocument();
    expect(screen.getByText('GW33')).toBeInTheDocument();
  });

  it('shows no indicator when neither pre-deadline nor FH', () => {
    render(<ManagerHeader {...BASE} />);
    expect(screen.queryByText(/showing your/i)).toBeNull();
  });

  it('shows pre-deadline indicator when preDeadlineFallback=true', () => {
    render(<ManagerHeader {...BASE} preDeadlineFallback={true} />);
    expect(screen.getByText(/showing your locked squad from GW33/i)).toBeInTheDocument();
  });

  it('shows FH indicator when freeHitBypassed=true', () => {
    render(<ManagerHeader {...BASE} freeHitBypassed={true} freeHitGameweek={33} gameweek={32} />);
    expect(screen.getByText(/showing your pre-Free Hit squad from GW32/i)).toBeInTheDocument();
    expect(screen.getByText(/Free Hit was played in GW33/i)).toBeInTheDocument();
  });

  it('shows GW1 FH indicator when isGw1FreeHit=true', () => {
    render(<ManagerHeader {...BASE} isGw1FreeHit={true} gameweek={1} />);
    expect(screen.getByText(/Showing your Free Hit squad/i)).toBeInTheDocument();
  });

  it('FH indicator takes priority over pre-deadline when both are true', () => {
    render(
      <ManagerHeader
        {...BASE}
        preDeadlineFallback={true}
        freeHitBypassed={true}
        freeHitGameweek={33}
        gameweek={32}
      />,
    );
    // FH indicator shown
    expect(screen.getByText(/showing your pre-Free Hit squad from GW32/i)).toBeInTheDocument();
    // Pre-deadline indicator NOT shown
    expect(screen.queryByText(/locked squad/i)).toBeNull();
  });

  it('renders overallRank when not null', () => {
    render(<ManagerHeader {...BASE} />);
    expect(screen.getByText('Rank 12,345')).toBeInTheDocument();
  });

  it('omits rank when overallRank is null', () => {
    render(<ManagerHeader {...BASE} overallRank={null} />);
    expect(screen.queryByText(/rank/i)).toBeNull();
  });
});
