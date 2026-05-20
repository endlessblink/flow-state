
export type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastOptions {
    duration?: number
    position?: 'top-right' | 'bottom-right' | 'top-center' | 'bottom-center'
    action?: {
        label: string
        onClick: () => void
    }
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
        const { duration = 3000 } = options

        const toast = document.createElement('div')
        let removed = false

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

        if (options.action) {
            const actionButton = document.createElement('button')
            actionButton.type = 'button'
            actionButton.textContent = options.action.label
            actionButton.style.cssText = `
        border: 1px solid rgba(255, 255, 255, 0.35);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.12);
        color: white;
        cursor: pointer;
        font-size: 12px;
        font-weight: 700;
        padding: 4px 10px;
      `
            actionButton.addEventListener('click', (event) => {
                event.stopPropagation()
                try {
                    options.action?.onClick()
                } catch (error) {
                    console.error('Toast action failed:', error)
                } finally {
                    removeToast()
                }
            })
            toast.appendChild(actionButton)
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
