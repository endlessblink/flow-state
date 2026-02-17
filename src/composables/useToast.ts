
export type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastOptions {
    duration?: number
    position?: 'top-right' | 'bottom-right' | 'top-center' | 'bottom-center'
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

        // Icon selection
        let icon = 'ℹ️'
        let bgColor = 'var(--bg-card, #1e293b)' // Default dark
        let borderColor = 'var(--border-color, #334155)'

        switch (type) {
            case 'success':
                icon = '✓'
                bgColor = 'var(--success-bg-start, #064e3b)' // Dark green
                borderColor = 'var(--color-success, #10b981)'
                break
            case 'error':
                icon = '✕'
                bgColor = 'var(--danger-bg-start, #450a0a)' // Dark red
                borderColor = 'var(--color-danger, #ef4444)'
                break
            case 'warning':
                icon = '⚠️'
                bgColor = 'var(--warning-bg-start, #451a03)' // Dark orange
                borderColor = 'var(--color-warning, #f59e0b)'
                break
            case 'info':
            default:
                icon = 'ℹ️' // Default blue-ish
                bgColor = 'var(--info-bg-start, #0f172a)'
                borderColor = 'var(--color-info, #3b82f6)'
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
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
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
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.2s ease-out'
            // Wait for animation to finish
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast)
                }
            }, 200)
        }, duration)
    }

    return { showToast }
}
