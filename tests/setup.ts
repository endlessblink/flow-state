/**
 * Vitest global test setup
 *
 * Runs before every test file. Adds browser API stubs that jsdom does not
 * provide but are referenced by production code at module-evaluation time
 * (e.g. src/utils/platform.ts calling window.matchMedia).
 */

import { vi } from 'vitest'

// ---------------------------------------------------------------------------
// window.matchMedia — not implemented in jsdom
// See: https://jestjs.io/docs/manual-mocks#mocking-methods-which-are-not-implemented-in-jsdom
//
// NOTE: Use a plain function (not vi.fn()) so that vi.clearAllMocks() in test
// beforeEach hooks does not wipe the return value and cause subsequent calls
// from vi.importActual() to return undefined.
// ---------------------------------------------------------------------------
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
})
