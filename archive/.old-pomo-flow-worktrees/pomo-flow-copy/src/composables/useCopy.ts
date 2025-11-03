import { ref } from 'vue'

export interface CopyOptions {
  text: string
  showFeedback?: boolean
  feedbackMessage?: string
  feedbackDuration?: number
}

export function useCopy() {
  const isCopying = ref(false)
  const lastCopiedText = ref('')

  const copyToClipboard = async (options: CopyOptions): Promise<boolean> => {
    const {
      text,
      showFeedback = false,
      feedbackMessage = 'Copied to clipboard!',
      feedbackDuration = 2000
    } = options

    if (isCopying.value) return false

    try {
      isCopying.value = true

      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea')
        textArea.value = text
        textArea.style.position = 'fixed'
        textArea.style.opacity = '0'
        document.body.appendChild(textArea)
        textArea.select()

        const success = document.execCommand('copy')
        document.body.removeChild(textArea)

        if (!success) {
          throw new Error('Failed to copy text using fallback method')
        }
      }

      lastCopiedText.value = text

      // Show feedback if requested
      if (showFeedback) {
        // Create a simple toast notification
        showToast(feedbackMessage, 'success')
      }

      return true
    } catch (error) {
      console.error('Failed to copy text:', error)
      showToast('Failed to copy to clipboard', 'error')
      return false
    } finally {
      isCopying.value = false
    }
  }

  const copyError = (errorMessage: string, errorDetails?: string): Promise<boolean> => {
    const text = errorDetails
      ? `Error: ${errorMessage}\n\nStack Trace:\n${errorDetails}`
      : `Error: ${errorMessage}`

    return copyToClipboard({
      text,
      showFeedback: true,
      feedbackMessage: 'Error copied to clipboard!'
    })
  }

  return {
    isCopying,
    lastCopiedText,
    copyToClipboard,
    copyError
  }
}

// Simple toast notification system
let toastContainer: HTMLDivElement | null = null

function showToast(message: string, type: 'success' | 'error' = 'success') {
  // Create toast container if it doesn't exist
  if (!toastContainer) {
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
    `
    document.body.appendChild(toastContainer)
  }

  const toast = document.createElement('div')
  const icon = type === 'success' ? '✓' : '✕'
  const bgColor = type === 'success'
    ? 'var(--success-bg-start, #10b981)'
    : 'var(--color-danger, #ef4444)'

  toast.style.cssText = `
    background: ${bgColor};
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    animation: slideIn 0.2s ease-out;
    min-width: 200px;
  `

  // Create safe DOM structure instead of innerHTML
  const iconSpan = document.createElement('span')
  iconSpan.style.fontWeight = 'bold'
  iconSpan.textContent = icon

  const messageText = document.createTextNode(` ${message}`)

  toast.appendChild(iconSpan)
  toast.appendChild(messageText)

  // Add animation keyframes if not already present
  if (!document.querySelector('#toast-animations')) {
    const style = document.createElement('style')
    style.id = 'toast-animations'
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }
    `
    document.head.appendChild(style)
  }

  toastContainer.appendChild(toast)

  // Remove toast after delay
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.2s ease-out'
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast)
      }
    }, 200)
  }, 3000)
}