import { ref } from 'vue'
import { useToast } from '@/composables/useToast'

export interface CopyOptions {
  text: string
  showFeedback?: boolean
  feedbackMessage?: string
  feedbackDuration?: number
}

export function useCopy() {
  const isCopying = ref(false)
  const lastCopiedText = ref('')
  const { showToast } = useToast()

  const copyToClipboard = async (options: CopyOptions): Promise<boolean> => {
    const {
      text,
      showFeedback = false,
      feedbackMessage = 'Copied to clipboard!',
      feedbackDuration: _feedbackDuration = 2000
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