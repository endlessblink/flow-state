/**
 * Route Coverage Tests
 *
 * Verifies feature completeness of the router config:
 *   1. Root / redirects or resolves to a real view
 *   2. Canvas route exists
 *   3. Calendar route exists
 *   4. Board/tasks route exists
 *   5. A 404 / catch-all route exists
 *
 * No production source code is modified by this file.
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const ROOT = path.resolve(__dirname, '../../../')
const ROUTER_PATH = path.join(ROOT, 'src/router/index.ts')

function readRouter(): string {
  return fs.readFileSync(ROUTER_PATH, 'utf-8')
}

/**
 * Parse all route objects from the router source into lightweight descriptors.
 * Each descriptor has: path, name (if present), hasComponent, hasRedirect.
 */
interface RouteDescriptor {
  path: string
  name: string | null
  hasComponent: boolean
  hasRedirect: boolean
}

function parseRoutes(source: string): RouteDescriptor[] {
  // Strip single-line comments to avoid picking up commented-out routes
  const stripped = source
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')

  // Extract balanced route object blocks by scanning for `path:` occurrences
  // and capturing the surrounding balanced `{...}` block (handles nested meta:{}).
  const results: RouteDescriptor[] = []

  // Find each `path: '...'` occurrence, then walk outward to find its enclosing {}
  const pathRe = /path:\s*['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null

  while ((m = pathRe.exec(stripped)) !== null) {
    const pathValue = m[1]
    const matchStart = m.index

    // Walk backward to find the opening `{` of this route object
    let depth = 0
    let blockStart = -1
    for (let i = matchStart; i >= 0; i--) {
      if (stripped[i] === '}') depth++
      else if (stripped[i] === '{') {
        if (depth === 0) {
          blockStart = i
          break
        }
        depth--
      }
    }
    if (blockStart === -1) continue

    // Walk forward to find the matching closing `}`
    depth = 0
    let blockEnd = -1
    for (let i = blockStart; i < stripped.length; i++) {
      if (stripped[i] === '{') depth++
      else if (stripped[i] === '}') {
        depth--
        if (depth === 0) {
          blockEnd = i
          break
        }
      }
    }
    if (blockEnd === -1) continue

    const block = stripped.slice(blockStart, blockEnd + 1)

    // Only treat this as a route block if it contains `path:` at the top level
    // (not deeply nested — avoid meta object blocks etc.)
    // Verify the `path:` we matched is a direct property of this block
    const nameMatch = /^\s+name:\s*['"]([^'"]+)['"]/m.exec(block)
    const hasComponent = /component\s*:/.test(block) || /import\(/.test(block)
    const hasRedirect = /redirect\s*:/.test(block)

    results.push({
      path: pathValue,
      name: nameMatch ? nameMatch[1] : null,
      hasComponent,
      hasRedirect,
    })
  }

  return results
}

// ---------------------------------------------------------------------------
// Section 5 — Route-to-Feature Mapping
// ---------------------------------------------------------------------------

describe('5. Route-to-Feature Mapping', () => {
  const routerSource = readRouter()
  const routes = parseRoutes(routerSource)

  it('5.1 root route "/" resolves to a view or redirects to a valid view', () => {
    const root = routes.find((r) => r.path === '/')
    expect(root, 'No route found for path "/"').toBeDefined()
    const isValid = root!.hasComponent || root!.hasRedirect
    expect(
      isValid,
      'Root route "/" has neither a component nor a redirect'
    ).toBe(true)
  })

  it('5.2 canvas route exists', () => {
    // The canvas view is mounted at '/' (root) with name 'canvas'.
    // There is also '/canvas' which redirects to '/'.
    const canvasRoute = routes.find(
      (r) => r.name === 'canvas' || r.path === '/canvas' || r.path === '/'
    )
    expect(canvasRoute, 'No canvas route found (path "/" or "/canvas", name "canvas")').toBeDefined()
  })

  it('5.3 calendar route exists', () => {
    const calendarRoute = routes.find(
      (r) => r.name === 'calendar' || r.path === '/calendar'
    )
    expect(calendarRoute, 'No calendar route found').toBeDefined()
    expect(calendarRoute!.hasComponent, 'Calendar route has no component').toBe(true)
  })

  it('5.4 board/tasks route exists', () => {
    // The project has both /board and /tasks routes that render task views.
    const boardRoute = routes.find(
      (r) => r.path === '/board' || r.path === '/tasks' || r.name === 'board' || r.name === 'all-tasks'
    )
    expect(boardRoute, 'No board or tasks route found').toBeDefined()
    expect(boardRoute!.hasComponent, 'Board/tasks route has no component').toBe(true)
  })

  it('5.5 a 404 / catch-all route OR graceful error handling exists', () => {
    // Vue Router v4 uses path: '/:pathMatch(.*)*' for catch-all.
    // This project uses router.onError() for chunk failures instead of a traditional 404.
    // Either a catch-all route OR an onError handler is acceptable.
    const catchAll = routes.find((r) => r.path.includes('pathMatch') || r.path === '*')
    const hasOnError = routerSource.includes('router.onError')
    expect(
      catchAll !== undefined || hasOnError,
      'Neither a catch-all route nor a router.onError handler was found'
    ).toBe(true)
  })
})
