// Global keyboard handler with undo/redo functionality
// Handles Ctrl+Z (undo) and Ctrl+Y/Ctrl+Shift+Z (redo) shortcuts

interface KeyboardHandlerOptions {
  enabled?: boolean
  preventDefault?: boolean
  ignoreInputs?: boolean
  ignoreModals?: boolean
}

export class SimpleGlobalKeyboardHandler {
  private enabled: boolean = true
  private preventDefault: boolean = true
  private ignoreInputs: boolean = true
  private ignoreModals: boolean = true
  private keydownHandler: (event: KeyboardEvent) => void
  private undoRedo: any = null

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
        console.log('🔄 Loading unified undo/redo system for keyboard handler... [CACHE FIX V4 - 22:48]')

        // Use the shared singleton undo system to ensure all instances share the same state
        const { getUndoSystem } = await import('@/composables/undoSingleton')
        this.undoRedo = getUndoSystem()
        console.log('✅ Keyboard handler using shared undo singleton instance:', new Date().toISOString())
        console.log('✅ Unified undo/redo system loaded successfully')
      } catch (error) {
        console.error('❌ Failed to load unified undo/redo system:', error)
        console.log('⚠️ Keyboard shortcuts will only log messages without undo/redo functionality')
      }

      window.addEventListener('keydown', this.keydownHandler, false)
      console.log('Global keyboard handler initialized')
    }
  }

  /**
   * Destroy the keyboard handler
   */
  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.keydownHandler, false)
      console.log('Simple keyboard handler destroyed')
    }
  }

  /**
   * Check if an element or its parents should be ignored
   */
  private shouldIgnoreElement(target: Element): boolean {
    const element = target as HTMLElement

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
    // Check if handler is enabled
    if (!this.enabled) {
      return
    }

    // Check if we should ignore this element
    if (this.shouldIgnoreElement(event.target as Element)) {
      return
    }

    const { ctrlKey, metaKey, shiftKey, key } = event
    const hasModifier = ctrlKey || metaKey

  
    // Handle Ctrl+Z (Undo) and Ctrl+Shift+Z (Redo)
    if (hasModifier && key.toLowerCase() === 'z') {
      if (shiftKey) {
        // Ctrl+Shift+Z = Redo
        console.log('🔄 Redo shortcut detected (Ctrl+Shift+Z)')
        this.executeRedo()
      } else {
        // Ctrl+Z = Undo
        console.log('↩️ UNDO WORKING NOW - Undo shortcut detected (Ctrl+Z) [CACHE FIX TEST]')
        this.executeUndo()
      }

      if (this.preventDefault) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    // Handle Ctrl+Y (Redo alternative)
    else if (hasModifier && key.toLowerCase() === 'y') {
      console.log('🔄 Redo shortcut detected (Ctrl+Y)')
      this.executeRedo()

      if (this.preventDefault) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
  }

  /**
   * Execute undo operation
   */
  private async executeUndo(): Promise<void> {
    if (!this.undoRedo) {
      console.log('⚠️ Unified undo/redo system not available - cannot undo')
      return
    }

    try {
      console.log('🔄 Executing undo operation with unified system...')

      // Check if undo is possible
      if (!this.undoRedo.canUndo.value) {
        console.log('ℹ️ Nothing to undo - canUndo is false')
        return
      }

      // Execute undo
      const result = await this.undoRedo.undo()
      if (result) {
        console.log('✅ Undo successful - task(s) should be restored')
        console.log(`🔄 Undo count after operation: ${this.undoRedo.undoCount.value}`)
      } else {
        console.log('ℹ️ Undo operation returned false')
      }
    } catch (error) {
      console.error('❌ Undo operation failed:', error)
    }
  }

  /**
   * Execute redo operation
   */
  private async executeRedo(): Promise<void> {
    if (!this.undoRedo) {
      console.log('⚠️ Unified undo/redo system not available - cannot redo')
      return
    }

    try {
      console.log('🔄 Executing redo operation with unified system...')

      // Check if redo is possible
      if (!this.undoRedo.canRedo.value) {
        console.log('ℹ️ Nothing to redo - canRedo is false')
        return
      }

      // Execute redo
      const result = await this.undoRedo.redo()
      if (result) {
        console.log('✅ Redo successful - task(s) should be re-applied')
        console.log(`🔄 Redo count after operation: ${this.undoRedo.redoCount.value}`)
      } else {
        console.log('ℹ️ Redo operation returned false')
      }
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