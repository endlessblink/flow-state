
export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastAction {
    label: string
    onClick: () => void
}

interface ToastOptions {
    duration?: number
    position?: 'top-right' | 'bottom-right' | 'top-center' | 'bottom-center'
    action?: ToastAction
}

// Singleton state to avoid multiple containers
let toastContainer: HTMLDivElement | null = null

function getOrCreateContainer(): HTMLDivElement {
    if (toastContainer) return toastContainer

    toastContainer = document.createElement('div')
    toastContainer.id = 'toast-container'
    toastContainer.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 10px;
    pointer-events: none; /* Allow clicking through container */
  `
    document.body.appendChild(toastContainer)
    return toastContainer
}

export function useToast() {
    const showToast = (message: string, type: ToastType = 'info', options: ToastOptions = {}) => {
        const container = getOrCreateContainer()
        const { duration = 3000, action } = options

        const toast = document.createElement('div')

        // Icon selection
        let icon = 'ℹ️'
        let bgColor = 'var(--overlay-component-bg)' // Default dark glass background
        let borderColor = 'var(--border-medium)'

        switch (type) {
            case 'success':
                icon = '✓'
                bgColor = 'var(--success-bg-subtle)' // Dark green tint
                borderColor = 'var(--color-success)'
                break
            case 'error':
                icon = '✕'
                bgColor = 'var(--danger-bg-subtle)' // Dark red tint
                borderColor = 'var(--color-danger)'
                break
            case 'warning':
                icon = '⚠️'
                bgColor = 'var(--amber-bg-light)' // Dark amber tint
                borderColor = 'var(--color-warning)'
                break
            case 'info':
            default:
                icon = 'ℹ️' // Default blue-ish
                bgColor = 'var(--overlay-component-bg)'
                borderColor = 'var(--color-info)'
                break
        }

        toast.style.cssText = `
      background: ${bgColor};
      color: white; /* Always white text on dark toasts */
      padding: 12px 16px;
      border-radius: 8px;
      border-left: 4px solid ${borderColor};
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: var(--shadow-dark-md);
      animation: slideIn 0.2s ease-out;
      min-width: 240px;
      max-width: 400px;
      pointer-events: auto; /* Allow clicking the toast itself */
      backdrop-filter: blur(8px);
    `

        // Create content
        const iconSpan = document.createElement('span')
        iconSpan.style.fontWeight = 'bold'
        iconSpan.style.fontSize = '16px'
        iconSpan.textContent = icon

        const messageSpan = document.createElement('span')
        messageSpan.textContent = message
        messageSpan.style.flex = '1'
        messageSpan.style.lineHeight = '1.4'

        toast.appendChild(iconSpan)
        toast.appendChild(messageSpan)

        let removed = false
        const removeToast = () => {
            if (removed) return
            removed = true
            toast.style.animation = 'slideOut 0.2s ease-out'
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast)
                }
            }, 200)
        }

        // Optional action button — clicking it invokes the callback and dismisses the toast.
        // Note: action handlers like Ctrl+Z's undo operate on the top of the operation stack,
        // so if the user performs another op before clicking Undo, the most recent op is undone.
        // This matches Gmail/VS Code "Undo Send" semantics.
        if (action) {
            const button = document.createElement('button')
            button.type = 'button'
            button.textContent = action.label
            button.style.cssText = `
        background: transparent;
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.4);
        border-radius: 6px;
        padding: 4px 10px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        margin-left: 8px;
        transition: background 0.15s ease;
      `
            button.addEventListener('mouseenter', () => {
                button.style.background = 'rgba(255, 255, 255, 0.12)'
            })
            button.addEventListener('mouseleave', () => {
                button.style.background = 'transparent'
            })
            button.addEventListener('click', (e) => {
                e.stopPropagation()
                try {
                    action.onClick()
                } catch (err) {
                    console.error('[useToast] action.onClick threw:', err)
                }
                removeToast()
            })
            toast.appendChild(button)
        }

        // Add animation styles if needed
        if (!document.querySelector('#toast-animations')) {
            const style = document.createElement('style')
            style.id = 'toast-animations'
            style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `
            document.head.appendChild(style)
        }

        container.appendChild(toast)

        // Auto removal
        setTimeout(removeToast, duration)
    }

    return { showToast }
}
