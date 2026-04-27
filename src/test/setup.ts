import '@testing-library/jest-dom';
import { expect } from 'vitest';
import { toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

// JSDOM does not implement scrollIntoView — add a no-op so components that
// call it in useEffect don't throw during tests.
if (typeof window !== 'undefined') {
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView(): void {
    /* no-op in test environment */
  };
}
