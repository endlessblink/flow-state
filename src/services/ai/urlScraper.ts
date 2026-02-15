/**
 * TASK-1325: URL Scraping Service
 * Fetches page metadata (title, description, OG tags) from URLs.
 *
 * Scraping strategy (tries in order):
 * 1. oEmbed for known providers (YouTube, Vimeo) — works in browser, no CORS
 * 2. Direct HTML fetch via Tauri plugin-http (CORS-free, Tauri only)
 * 3. Direct browser fetch (works for sites with permissive CORS)
 * 4. Edge function proxy (PWA fallback, requires deployment)
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

// ── oEmbed providers with CORS-friendly endpoints ──────────────────────

interface OEmbedProvider {
  pattern: RegExp
  endpoint: string
}

const OEMBED_PROVIDERS: OEmbedProvider[] = [
  {
    pattern: /(?:youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts\/)/,
    endpoint: 'https://www.youtube.com/oembed',
  },
  {
    pattern: /vimeo\.com\//,
    endpoint: 'https://vimeo.com/api/oembed.json',
  },
  {
    pattern: /twitter\.com\/|x\.com\//,
    endpoint: 'https://publish.twitter.com/oembed',
  },
]

/**
 * Try oEmbed for known providers. Works in browsers without CORS issues.
 */
async function tryOembed(
  url: string,
  signal?: AbortSignal,
): Promise<Omit<ScrapedUrlData, 'aiSummary' | 'error'> | null> {
  for (const provider of OEMBED_PROVIDERS) {
    if (provider.pattern.test(url)) {
      try {
        const oembedUrl = `${provider.endpoint}?url=${encodeURIComponent(url)}&format=json`
        console.log('[urlScraper] Trying oEmbed:', oembedUrl)

        const response = await fetch(oembedUrl, { signal })
        if (!response.ok) {
          console.warn('[urlScraper] oEmbed returned', response.status)
          return null
        }

        const data = await response.json()
        console.log('[urlScraper] oEmbed success:', { title: data.title, author: data.author_name })

        return {
          url,
          title: data.title || null,
          description: data.author_name ? `By ${data.author_name}` : null,
          ogImage: data.thumbnail_url || null,
        }
      } catch (err) {
        console.warn('[urlScraper] oEmbed failed:', err)
        return null
      }
    }
  }
  return null
}

// ── HTML fetch strategies ──────────────────────────────────────────────

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
 * Fetch HTML via Tauri plugin-http (CORS-free).
 */
async function fetchHtmlTauri(url: string, signal?: AbortSignal): Promise<string> {
  console.log('[urlScraper] Fetching via Tauri HTTP:', url)
  const response = await tauriFetchWithTimeout(
    url,
    {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0 (compatible; FlowState/1.0)',
      },
      signal,
    },
    10_000,
  )

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const text = await response.text()
  return text.slice(0, MAX_HTML_SIZE)
}

/**
 * Fetch HTML via direct browser fetch (works if server allows CORS).
 */
async function fetchHtmlBrowser(url: string, signal?: AbortSignal): Promise<string> {
  console.log('[urlScraper] Trying direct browser fetch:', url)
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'text/html,application/xhtml+xml' },
    signal,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const text = await response.text()
  return text.slice(0, MAX_HTML_SIZE)
}

/**
 * Fetch HTML via edge function proxy (for sites that block CORS).
 */
async function fetchHtmlProxy(url: string, signal?: AbortSignal): Promise<string> {
  const endpoint = getProxyEndpoint()
  console.log('[urlScraper] Trying proxy fetch:', endpoint)

  const response = await fetch(endpoint, {
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
 * Fetch HTML content using the best available strategy.
 */
async function fetchHtml(url: string, signal?: AbortSignal): Promise<string> {
  // Strategy 1: Tauri direct fetch (CORS-free)
  if (isTauriEnvironment()) {
    return await fetchHtmlTauri(url, signal)
  }

  // Strategy 2: Direct browser fetch (works for permissive CORS)
  try {
    return await fetchHtmlBrowser(url, signal)
  } catch (browserErr) {
    console.log('[urlScraper] Browser fetch failed (likely CORS):', (browserErr as Error).message)
  }

  // Strategy 3: Edge function proxy
  return await fetchHtmlProxy(url, signal)
}

// ── Metadata parsing ───────────────────────────────────────────────────

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

  console.log('[urlScraper] Parsed metadata:', { title, description: description?.slice(0, 50), ogImage: !!ogImage })

  return { url, title, description, ogImage }
}

// ── AI summary ─────────────────────────────────────────────────────────

/**
 * Generate an AI summary of the page using the AI Router.
 * Returns null if AI is unavailable.
 */
async function generateAiSummary(
  title: string | null,
  description: string | null,
  url: string,
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

    const response = await router.chat([{ role: 'user', content: prompt }], {
      taskType: 'task_parsing',
      temperature: 0.3,
      maxTokens: 100,
    })

    return response.content?.trim() || null
  } catch (error) {
    console.warn('[urlScraper] AI summary failed:', error)
    return null
  }
}

// ── Main scrape function ───────────────────────────────────────────────

/**
 * Scrape a URL and return structured metadata + optional AI summary.
 *
 * Tries oEmbed first (fast, CORS-free), then falls back to HTML scraping.
 */
export async function scrapeUrl(
  url: string,
  options?: { signal?: AbortSignal; skipAi?: boolean },
): Promise<ScrapedUrlData> {
  console.log('[urlScraper] Scraping:', url, { isTauri: isTauriEnvironment() })

  try {
    // Strategy 1: oEmbed for known providers (fast, works everywhere)
    const oembedResult = await tryOembed(url, options?.signal)
    if (oembedResult && oembedResult.title) {
      console.log('[urlScraper] Got oEmbed result:', oembedResult.title)

      let aiSummary: string | null = null
      if (!options?.skipAi) {
        aiSummary = await generateAiSummary(oembedResult.title, oembedResult.description, url)
      }

      return { ...oembedResult, aiSummary, error: null }
    }

    // Strategy 2: HTML fetch + parse
    const html = await fetchHtml(url, options?.signal)
    const metadata = parseMetadata(html, url)

    let aiSummary: string | null = null
    if (!options?.skipAi && (metadata.title || metadata.description)) {
      aiSummary = await generateAiSummary(metadata.title, metadata.description, url)
    }

    return { ...metadata, aiSummary, error: null }
  } catch (error: unknown) {
    if ((error as Error)?.name === 'AbortError') {
      return { url, title: null, description: null, ogImage: null, aiSummary: null, error: 'cancelled' }
    }
    console.warn('[urlScraper] Scrape failed:', error)
    return {
      url,
      title: null,
      description: null,
      ogImage: null,
      aiSummary: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
