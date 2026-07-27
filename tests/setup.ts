/**
 * Vitest global test setup
 *
 * Runs before every test file. Adds browser API stubs that jsdom does not
 * provide but are referenced by production code at module-evaluation time
 * (e.g. src/utils/platform.ts calling window.matchMedia).
 */

import { beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// IndexedDB — not implemented in jsdom.
//
// Durable writes are mandatory: enqueueOperation() throws "IndexedDB is
// required for durable queued writes" and the read cache throws "Read cache
// scope is not configured" when either is missing. Without both, every
// mutation path (delete, move, undo, rollback, subtasks, instances) aborts
// during setup and its assertions never run — the suite silently stops
// guarding the behaviour it was written to guard.
//
// Providing them here makes the default test environment match the contract
// production code actually requires, so failures mean real defects rather
// than a missing harness. Individual tests may still override the scope, or
// stub the write queue, to exercise degraded paths.
// ---------------------------------------------------------------------------
import "fake-indexeddb/auto";

beforeEach(async () => {
  // Many suites replace this module with a partial vi.mock() that only defines
  // the cache functions they care about. Vitest makes even *reading* an
  // undeclared export throw, so the whole probe is guarded: a module that does
  // not expose the scope API is a suite managing its own read cache, and it is
  // left untouched rather than failed.
  try {
    const readCache = await import("@/services/offline/readCacheDB");
    if (!readCache.getReadCacheScope()) {
      readCache.configureReadCacheScope({
        userId: "vitest-user",
        workspaceId: null,
      });
    }
  } catch {
    // Mocked or unavailable read cache — nothing to configure.
  }
});

// ---------------------------------------------------------------------------
// window.matchMedia — not implemented in jsdom
// See: https://jestjs.io/docs/manual-mocks#mocking-methods-which-are-not-implemented-in-jsdom
//
// NOTE: Use a plain function (not vi.fn()) so that vi.clearAllMocks() in test
// beforeEach hooks does not wipe the return value and cause subsequent calls
// from vi.importActual() to return undefined.
// ---------------------------------------------------------------------------
Object.defineProperty(window, "matchMedia", {
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
});
