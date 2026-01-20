// Global keyboard handler with undo/redo functionality
// Handles Ctrl+Z (undo) and Ctrl+Y/Ctrl+Shift+Z (redo) shortcuts

import type { Ref } from 'vue'

interface KeyboardHandlerOptions {
  enabled?: boolean
  preventDefault?: boolean
  ignoreInputs?: boolean
  ignoreModals?: boolean
}

interface UndoRedoSystem {
  canUndo: Ref<boolean>
  canRedo: Ref<boolean>
  undoCount: Ref<number>
  redoCount: Ref<number>
  undo: () => Promise<boolean>
  redo: () => Promise<boolean>
}

export class SimpleGlobalKeyboardHandler {
  private enabled: boolean = true
  private preventDefault: boolean = true
  private ignoreInputs: boolean = true
  private ignoreModals: boolean = true
  private keydownHandler: (event: KeyboardEvent) => void
  private undoRedo: UndoRedoSystem | null = null

  constructor(options: KeyboardHandlerOptions = {}) {
    this.enabled = options.enabled ?? true
    this.preventDefault = options.preventDefault ?? true
    this.ignoreInputs = options.ignoreInputs ?? true
    this.ignoreModals = options.ignoreModals ?? true

    // Bind the event handler
    this.keydownHandler = this.handleKeydown.bind(this)
  }

  /**
   * Initialize the keyboard handler
   */
  async init(): Promise<void> {
    if (typeof window !== 'undefined') {
      // Load unified undo/redo functionality
      try {
        // Use the shared singleton undo system to ensure all instances share the same state
        const { getUndoSystem } = await import('@/composables/undoSingleton')
        this.undoRedo = getUndoSystem() as UndoRedoSystem
      } catch (error) {
        console.error('❌ [KEYBOARD] Failed to load undo system:', error)
      }

      window.addEventListener('keydown', this.keydownHandler, false)
    }
  }

  /**
   * Destroy the keyboard handler
   */
  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.keydownHandler, false)
    }
  }

  /**
   * Check if an element or its parents should be ignored
   */
  private shouldIgnoreElement(target: Element): boolean {
    const element = target as HTMLElement

    // 🔧 FIX: Allow Enter key events on quick task input to pass through
    // Check if this is the quick task input field
    if (element.classList.contains('task-input') ||
      element.closest('.quick-add-input')) {
      return false // Don't block - allow @keydown.enter to work
    }

    // Check if we're in an input field and ignoreInputs is true
    if (this.ignoreInputs) {
      const tagName = element.tagName?.toLowerCase()
      const isInput = tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        element.contentEditable === 'true'

      if (isInput) {
        return true
      }

      // Check if we're inside an input-like element
      const parent = element.closest('input, textarea, select, [contenteditable="true"]')
      if (parent) {
        return true
      }
    }

    // Check if we're in a modal and ignoreModals is true
    if (this.ignoreModals) {
      const modal = element.closest('[role="dialog"], .modal, .popup, .overlay')
      if (modal) {
        return true
      }
    }

    return false
  }

  /**
   * Handle keyboard events
   */
  private handleKeydown(event: KeyboardEvent): void {
    if (!this.enabled) return

    const { ctrlKey, metaKey, shiftKey, key } = event
    const hasModifier = ctrlKey || metaKey

    // Only process if we have a modifier key (Ctrl/Cmd)
    if (!hasModifier) return

    // Check if we should ignore this element (inputs, modals)
    const target = event.target as Element
    if (target && this.shouldIgnoreElement(target)) {
      return
    }

    // Handle Ctrl+Z (Undo) and Ctrl+Shift+Z (Redo)
    if (hasModifier && key.toLowerCase() === 'z') {
      if (shiftKey) {
        // Ctrl+Shift+Z = Redo
        this.executeRedo()
      } else {
        // Ctrl+Z = Undo
        this.executeUndo()
      }

      if (this.preventDefault) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    // Handle Ctrl+Y (Redo alternative)
    else if (hasModifier && key.toLowerCase() === 'y') {
      this.executeRedo()

      if (this.preventDefault) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    // Handle Ctrl+N (New Task)
    else if (hasModifier && key.toLowerCase() === 'n') {
      this.executeNewTask()

      if (this.preventDefault) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
  }

  /**
   * Execute new task - dispatch custom event for App.vue to handle
   */
  private executeNewTask(): void {

    window.dispatchEvent(new CustomEvent('global-new-task'))
  }

  /**
   * Execute undo operation
   */
  private async executeUndo(): Promise<void> {
    console.log('🔴 [KEYBOARD] executeUndo called')

    if (!this.undoRedo) {
      console.warn('⚠️ [UNDO] Undo system not initialized')
      return
    }

    try {
      // Check if undo is possible
      console.log('🔴 [KEYBOARD] canUndo:', this.undoRedo.canUndo?.value)
      if (!this.undoRedo.canUndo?.value) {
        console.log('🔴 [KEYBOARD] Nothing to undo')
        return // Nothing to undo - silent return
      }

      console.log('🔴 [KEYBOARD] Calling undo()...')
      await this.undoRedo.undo()
      console.log('🔴 [KEYBOARD] undo() completed')
    } catch (error) {
      console.error('❌ [UNDO] Undo failed:', error)
    }
  }

  /**
   * Execute redo operation
   */
  private async executeRedo(): Promise<void> {
    if (!this.undoRedo) {
      return
    }

    try {
      // Check if redo is possible
      if (!this.undoRedo.canRedo.value) {
        return
      }

      // Execute redo
      await this.undoRedo.redo()
    } catch (error) {
      console.error('❌ Redo operation failed:', error)
    }
  }

  /**
   * Get current settings
   */
  getSettings(): KeyboardHandlerOptions {
    return {
      enabled: this.enabled,
      preventDefault: this.preventDefault,
      ignoreInputs: this.ignoreInputs,
      ignoreModals: this.ignoreModals
    }
  }

  /**
   * Update settings
   */
  updateSettings(options: Partial<KeyboardHandlerOptions>): void {
    if (options.enabled !== undefined) this.enabled = options.enabled
    if (options.preventDefault !== undefined) this.preventDefault = options.preventDefault
    if (options.ignoreInputs !== undefined) this.ignoreInputs = options.ignoreInputs
    if (options.ignoreModals !== undefined) this.ignoreModals = options.ignoreModals
  }
}

// Global instance
let globalKeyboardHandler: SimpleGlobalKeyboardHandler | null = null

/**
 * Initialize global keyboard shortcuts (simple version)
 */
export const initGlobalKeyboardShortcuts = async (options?: KeyboardHandlerOptions): Promise<SimpleGlobalKeyboardHandler> => {
  if (globalKeyboardHandler) {
    globalKeyboardHandler.destroy()
  }

  globalKeyboardHandler = new SimpleGlobalKeyboardHandler(options)
  await globalKeyboardHandler.init()

  return globalKeyboardHandler
}

/**
 * Get the global keyboard handler instance
 */
export const getGlobalKeyboardHandler = (): SimpleGlobalKeyboardHandler | null => {
  return globalKeyboardHandler
}

/**
 * Destroy the global keyboard handler
 */
export const destroyGlobalKeyboardShortcuts = (): void => {
  if (globalKeyboardHandler) {
    globalKeyboardHandler.destroy()
    globalKeyboardHandler = null
  }
}