/**
 * PR 1 of "Make Delete Reversible Everywhere":
 * useToast must support an optional action button so destructive operations
 * (delete task, delete group, etc.) can surface an on-screen Undo affordance.
 *
 * The motivating bug: deleting from the canvas inbox left users with no way to
 * restore — Ctrl+Z worked but was invisible. The delete-time toast is now the
 * primary discoverable restore path.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// useToast caches its toast-container div at module scope, so reset modules
// between tests to start each one with a clean DOM and a fresh singleton.
async function loadUseToast() {
    vi.resetModules()
    const mod = await import('@/composables/useToast')
    return mod.useToast()
}

describe('useToast — action button', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        document.body.innerHTML = ''
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('renders an action button when options.action is provided', async () => {
        const { showToast } = await loadUseToast()
        const onClick = vi.fn()

        showToast('Deleted "Task A"', 'info', {
            duration: 6000,
            action: { label: 'Undo', onClick }
        })

        const container = document.getElementById('toast-container')!
        const button = container.querySelector('button')
        expect(button).not.toBeNull()
        expect(button!.textContent).toBe('Undo')
        expect(onClick).not.toHaveBeenCalled()
    })

    it('omits the button when options.action is not provided (backward compat)', async () => {
        const { showToast } = await loadUseToast()

        showToast('Saved', 'success')

        const container = document.getElementById('toast-container')!
        expect(container.querySelector('button')).toBeNull()
    })

    it('invokes action.onClick when the button is clicked', async () => {
        const { showToast } = await loadUseToast()
        const onClick = vi.fn()

        showToast('Deleted "Task A"', 'info', {
            action: { label: 'Undo', onClick }
        })

        const button = document.querySelector('#toast-container button') as HTMLButtonElement
        button.click()

        expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('removes the toast from the DOM after the action button is clicked', async () => {
        const { showToast } = await loadUseToast()

        showToast('Deleted "Task A"', 'info', {
            duration: 6000,
            action: { label: 'Undo', onClick: () => { } }
        })

        const container = document.getElementById('toast-container')!
        expect(container.children.length).toBe(1)

        const button = container.querySelector('button') as HTMLButtonElement
        button.click()

        // useToast's removeToast waits 200ms for the slide-out animation before
        // detaching the node. Fast-forward past that.
        vi.advanceTimersByTime(250)

        expect(container.children.length).toBe(0)
    })

    it('does not double-remove when click+timeout race', async () => {
        const { showToast } = await loadUseToast()

        showToast('Deleted "Task A"', 'info', {
            duration: 100,
            action: { label: 'Undo', onClick: () => { } }
        })

        const button = document.querySelector('#toast-container button') as HTMLButtonElement
        button.click()

        // Auto-removal timer also fires; should not throw or attempt a second detach.
        expect(() => vi.advanceTimersByTime(500)).not.toThrow()

        const container = document.getElementById('toast-container')!
        expect(container.children.length).toBe(0)
    })

    it('still swallows action.onClick exceptions and removes the toast', async () => {
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => { })
        const { showToast } = await loadUseToast()

        showToast('Deleted "Task A"', 'info', {
            action: {
                label: 'Undo',
                onClick: () => { throw new Error('boom') }
            }
        })

        const button = document.querySelector('#toast-container button') as HTMLButtonElement
        expect(() => button.click()).not.toThrow()

        vi.advanceTimersByTime(250)
        const container = document.getElementById('toast-container')!
        expect(container.children.length).toBe(0)

        consoleError.mockRestore()
    })
})
