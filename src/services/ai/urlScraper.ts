/**
 * TASK-1325: URL Scraping Service
 * Fetches page HTML and extracts metadata (title, description, OG tags).
 * Uses tauriFetchWithTimeout for CORS-free fetching in Tauri,
 * falls back to edge function proxy for PWA.
 */

import { tauriFetchWithTimeout, isTauriEnvironment } from './utils/tauriHttp'

export interface ScrapedUrlData {
  url: string
  title: string | null
  description: string | null
  ogImage: string | null
  aiSummary: string | null
  error: string | null
}

const MAX_HTML_SIZE = 50_000 // 50KB limit for parsing

/**
 * Get the edge function endpoint for URL scraping (PWA mode)
 */
function getProxyEndpoint(): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
  if (supabaseUrl.startsWith('/')) {
    return `${window.location.origin}${supabaseUrl}/functions/v1/url-scraper-proxy`
  }
  return `${supabaseUrl}/functions/v1/url-scraper-proxy`
}

/**
 * Fetch HTML content from a URL.
 * In Tauri: direct fetch (CORS-free via plugin-http)
 * In PWA: route through Supabase Edge Function proxy
 */
async function fetchHtml(url: string, signal?: AbortSignal): Promise<string> {
  if (isTauriEnvironment()) {
    const response = await tauriFetchWithTimeout(url, {
      method: 'GET',
      headers: { 'Accept': 'text/html,application/xhtml+xml' },
      signal,
    }, 10_000)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const text = await response.text()
    return text.slice(0, MAX_HTML_SIZE)
  }

  // PWA: use edge function proxy
  const response = await fetch(getProxyEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
    signal,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || `Proxy error: ${response.status}`)
  }

  const data = await response.json()
  return data.html || ''
}

/**
 * Parse HTML string to extract metadata using DOMParser.
 */
function parseMetadata(html: string, url: string): Omit<ScrapedUrlData, 'aiSummary' | 'error'> {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // Title: OG > regular title
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content')
  const htmlTitle = doc.querySelector('title')?.textContent
  const title = (ogTitle || htmlTitle || '').trim() || null

  // Description: OG > meta description
  const ogDesc = doc.querySelector('meta[property="og:description"]')?.getAttribute('content')
  const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute('content')
  const description = (ogDesc || metaDesc || '').trim() || null

  // OG Image
  const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || null

  return { url, title, description, ogImage }
}

/**
 * Generate an AI summary of the page using the AI Router.
 * Returns null if AI is unavailable.
 */
async function generateAiSummary(
  title: string | null,
  description: string | null,
  url: string
): Promise<string | null> {
  try {
    const { createAIRouter } = await import('./router')
    const router = createAIRouter()
    await router.initialize()

    const prompt = `Summarize this web page in 1-2 sentences for a task management app. Be concise and action-oriented.

URL: ${url}
Title: ${title || 'Unknown'}
Description: ${description || 'No description available'}

Summary:`

    const response = await router.chat(
      [{ role: 'user', content: prompt }],
      {
        taskType: 'task_parsing',
        temperature: 0.3,
        maxTokens: 100,
      }
    )

    return response.content?.trim() || null
  } catch (error) {
    console.warn('[urlScraper] AI summary failed:', error)
    return null
  }
}

/**
 * Scrape a URL and return structured metadata + AI summary.
 */
export async function scrapeUrl(
  url: string,
  options?: { signal?: AbortSignal; skipAi?: boolean }
): Promise<ScrapedUrlData> {
  try {
    const html = await fetchHtml(url, options?.signal)
    const metadata = parseMetadata(html, url)

    let aiSummary: string | null = null
    if (!options?.skipAi && (metadata.title || metadata.description)) {
      aiSummary = await generateAiSummary(metadata.title, metadata.description, url)
    }

    return { ...metadata, aiSummary, error: null }
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return { url, title: null, description: null, ogImage: null, aiSummary: null, error: 'cancelled' }
    }
    console.warn('[urlScraper] Scrape failed:', error)
    return { url, title: null, description: null, ogImage: null, aiSummary: null, error: error?.message || 'Unknown error' }
  }
}
