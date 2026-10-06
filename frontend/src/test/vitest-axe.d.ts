import 'vitest';
import type { AxeMatchers } from 'vitest-axe/matchers';

declare module 'vitest' {
  export interface Assertion extends AxeMatchers {
    toHaveNoViolations(): void;
  }
  export interface AsymmetricMatchersContaining extends AxeMatchers {
    toHaveNoViolations(): void;
  }
}
