/**
 * BUG-1900: group resize silently ignored lockManager.acquire() failures.
 *
 * Live symptom: a wall of `[LockManager] Unauthorized release attempt on <id>
 * by user-resize (owned by user-drag)` warnings, and resized children snapping
 * back after resize. Cause: `onSectionResizeStart` acquired child locks with
 * 'user-resize' but discarded the boolean; children still holding a (often
 * LEAKED — BUG-1492 stale-handler skip) 15s 'user-drag' lock were never
 * actually locked, their PositionManager updates were rejected during resize,
 * and resize-end "released" locks it never owned.
 *
 * Contract under test: LockManager.acquireOrAdopt —
 *  - free node → acquire, true
 *  - foreign lock + allowAdopt → force-adopt, true, owner switches
 *  - foreign lock + !allowAdopt → false, owner unchanged, no warning release
 *  - own lock → refresh, true
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { lockManager } from '@/services/canvas/LockManager'

describe('BUG-1900: LockManager.acquireOrAdopt', () => {
  beforeEach(() => {
    lockManager.clearAll()
    vi.restoreAllMocks()
  })

  it('acquires a free node', () => {
    expect(lockManager.acquireOrAdopt('n1', 'user-resize', { allowAdopt: true })).toBe(true)
    expect(lockManager.getLockOwner('n1')).toBe('user-resize')
  })

  it('adopts a stale foreign lock when allowAdopt=true (no drag active)', () => {
    lockManager.acquire('n1', 'user-drag')
    const ok = lockManager.acquireOrAdopt('n1', 'user-resize', { allowAdopt: true })
    expect(ok).toBe(true)
    expect(lockManager.getLockOwner('n1')).toBe('user-resize')
  })

  it('does NOT adopt when allowAdopt=false (drag genuinely active) and reports failure', () => {
    lockManager.acquire('n1', 'user-drag')
    const warnSpy = vi.spyOn(console, 'warn')
    const ok = lockManager.acquireOrAdopt('n1', 'user-resize', { allowAdopt: false })
    expect(ok).toBe(false)
    expect(lockManager.getLockOwner('n1')).toBe('user-drag')
    // Denied adopt must be silent-clean — no "Unauthorized release" warning spam
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('Unauthorized release'))
  })

  it('refreshes its own lock', () => {
    lockManager.acquire('n1', 'user-resize')
    expect(lockManager.acquireOrAdopt('n1', 'user-resize', { allowAdopt: false })).toBe(true)
    expect(lockManager.getLockOwner('n1')).toBe('user-resize')
  })
})
