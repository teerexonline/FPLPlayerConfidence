import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Providers } from './Providers';

// next-themes is a real library; mock the ThemeProvider so tests don't depend
// on browser matchMedia or localStorage APIs that jsdom does not fully implement.
vi.mock('next-themes', () => ({
  ThemeProvider: ({ children }: { readonly children: React.ReactNode }) => <>{children}</>,
}));

describe('Providers', () => {
  it('renders its children', () => {
    render(
      <Providers>
        <span>hello</span>
      </Providers>,
    );
    expect(screen.getByText('hello')).toBeInTheDocument();
  });
});
