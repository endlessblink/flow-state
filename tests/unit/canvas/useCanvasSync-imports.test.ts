/**
 * BUG-1796: `useCanvasSync.ts` called `toRelativePosition(...)` (lines 302/457) without
 * importing it. Because Vite/esbuild doesn't type-check and CI type-checking is currently
 * disabled (TASK-1789), the missing import shipped and threw a runtime ReferenceError the
 * moment the canvas synced a node with a visible parent — aborting the whole sync before
 * `setNodes()`, leaving the canvas completely empty.
 *
 * This guard statically verifies that every helper `useCanvasSync.ts` calls from
 * `@/utils/canvas/coordinates` is actually present in its import statement. It fails on the
 * pre-fix code and passes after. No production source is modified by this file.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const srcRoot = resolve(here, '../../../src')

const coordinatesSrc = readFileSync(resolve(srcRoot, 'utils/canvas/coordinates.ts'), 'utf8')
const syncSrc = readFileSync(resolve(srcRoot, 'composables/canvas/useCanvasSync.ts'), 'utf8')

/** Names exported as functions from coordinates.ts */
const exportedCoordinateFns = Array.from(
  coordinatesSrc.matchAll(/export\s+function\s+([A-Za-z0-9_]+)/g),
).map((m) => m[1])

/** The single import block useCanvasSync.ts uses for the coordinates module */
const importBlock =
  syncSrc.match(/import\s*\{([^}]*)\}\s*from\s*['"]@\/utils\/canvas\/coordinates['"]/)?.[1] ?? ''
const importedNames = new Set(
  importBlock
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)

describe('useCanvasSync coordinate-helper imports (BUG-1796)', () => {
  it('imports every coordinates helper it calls', () => {
    const missing: string[] = []
    for (const fn of exportedCoordinateFns) {
      const isCalled = new RegExp(`\\b${fn}\\s*\\(`).test(syncSrc)
      if (isCalled && !importedNames.has(fn)) missing.push(fn)
    }
    expect(missing, `useCanvasSync.ts calls these coordinates helpers without importing them: ${missing.join(', ')}`).toEqual([])
  })

  it('still imports toRelativePosition specifically (the BUG-1796 regression)', () => {
    expect(/\btoRelativePosition\s*\(/.test(syncSrc)).toBe(true) // it is used
    expect(importedNames.has('toRelativePosition')).toBe(true) // and imported
  })
})
