import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { CalibrationCaveat } from './CalibrationCaveat';

describe('CalibrationCaveat', () => {
  it('renders a "?" button', () => {
    render(<CalibrationCaveat />);
    expect(screen.getByRole('button', { name: /calibration note/i })).toBeInTheDocument();
  });

  it('tooltip is hidden by default', () => {
    render(<CalibrationCaveat />);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows tooltip on click', () => {
    render(<CalibrationCaveat />);
    fireEvent.click(screen.getByRole('button', { name: /calibration note/i }));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('tooltip contains MACE text', () => {
    render(<CalibrationCaveat />);
    fireEvent.click(screen.getByRole('button', { name: /calibration note/i }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('7.4 percentage points');
  });

  it('tooltip contains FWD caveat text', () => {
    render(<CalibrationCaveat />);
    fireEvent.click(screen.getByRole('button', { name: /calibration note/i }));
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'Goal probability for forwards may run slightly higher',
    );
  });

  it('dismisses tooltip via "Got it" button', () => {
    render(<CalibrationCaveat />);
    fireEvent.click(screen.getByRole('button', { name: /calibration note/i }));
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('button has aria-expanded=false when closed', () => {
    render(<CalibrationCaveat />);
    expect(screen.getByRole('button', { name: /calibration note/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('button has aria-expanded=true when open', () => {
    render(<CalibrationCaveat />);
    fireEvent.click(screen.getByRole('button', { name: /calibration note/i }));
    expect(screen.getByRole('button', { name: /calibration note/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('has no accessibility violations when closed', async () => {
    const { container } = render(<CalibrationCaveat />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no accessibility violations when open', async () => {
    const { container } = render(<CalibrationCaveat />);
    fireEvent.click(screen.getByRole('button', { name: /calibration note/i }));
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
