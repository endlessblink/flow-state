/**
 * TASK-1325: Vue composable for URL scraping in task inputs.
 * Provides reactive state and scraping on paste.
 *
 * Usage:
 * ```typescript
 * const { isScraping, scrapeIfUrl, cancel } = useUrlScraping()
 *
 * const handlePaste = async (e: ClipboardEvent) => {
 *   const text = e.clipboardData?.getData('text') || ''
 *   const result = await scrapeIfUrl(text)
 *   if (result) {
 *     titleRef.value = result.title
 *     descriptionRef.value = result.description
 *   }
 * }
 * ```
 */

import { ref } from 'vue'
import { useOnline } from '@vueuse/core'
import { isUrl } from '@/utils/urlDetection'
import { scrapeUrl, type ScrapedUrlData } from '@/services/ai/urlScraper'

export interface UrlScrapingResult {
  title: string
  description: string
  originalUrl: string
}

export function useUrlScraping() {
  const isOnline = useOnline()
  const isScraping = ref(false)
  const scrapedData = ref<ScrapedUrlData | null>(null)
  const error = ref<string | null>(null)

  let abortController: AbortController | null = null

  /**
   * Cancel any in-progress scraping.
   */
  const cancel = () => {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
    isScraping.value = false
  }

  /**
   * Scrape a URL and return title + description for task creation.
   * Returns null if the text is not a URL, we're offline, or scraping fails.
   */
  const scrapeIfUrl = async (text: string): Promise<UrlScrapingResult | null> => {
    const trimmed = text.trim()
    if (!isUrl(trimmed)) return null

    // Offline fallback: return null (caller will use truncated URL)
    if (!isOnline.value) return null

    // Cancel previous scrape
    cancel()

    abortController = new AbortController()
    isScraping.value = true
    error.value = null
    scrapedData.value = null

    try {
      const data = await scrapeUrl(trimmed, { signal: abortController.signal })
      scrapedData.value = data

      if (data.error === 'cancelled') return null

      if (data.error || !data.title) {
        error.value = data.error
        return null
      }

      // Build description: AI summary or meta description + source URL
      const summaryPart = data.aiSummary || data.description || ''
      const description = summaryPart
        ? `${summaryPart}\n\nSource: ${trimmed}`
        : `Source: ${trimmed}`

      return {
        title: data.title,
        description,
        originalUrl: trimmed,
      }
    } catch (err: any) {
      error.value = err?.message || 'Scraping failed'
      return null
    } finally {
      isScraping.value = false
      abortController = null
    }
  }

  return {
    isScraping,
    scrapedData,
    error,
    scrapeIfUrl,
    cancel,
    isOnline,
  }
}
