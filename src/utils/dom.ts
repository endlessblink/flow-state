/**
 * Checks if the target element is a text input area (textarea, contenteditable, or tip-tap editor)
 * This is useful for preventing global key handlers (like Enter to submit) from interfering 
 * with multiline text input.
 */
export const isTextAreaOrContentEditable = (target: EventTarget | null): boolean => {
    if (!target || !(target instanceof HTMLElement)) return false

    // Check for textarea
    if (target.tagName === 'TEXTAREA') return true

    // Check for contenteditable
    if (target.isContentEditable) return true

    // Check for TipTap editor (has ProseMirror class)
    if (target.classList.contains('ProseMirror')) return true
    if (target.closest('.ProseMirror')) return true

    return false
}
