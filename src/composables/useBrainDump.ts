import { ref, computed } from 'vue'
import { useOnline } from '@vueuse/core'
import { useUnifiedUndoRedo } from '@/composables/useUnifiedUndoRedo'
import { isUrl } from '@/utils/urlDetection'
import { scrapeUrl } from '@/services/ai/urlScraper'

export function useBrainDump() {
    const brainDumpMode = ref(false)
    const brainDumpText = ref('')
    const isProcessingUrls = ref(false)
    const isOnline = useOnline()

    // Parse brain dump text to count tasks
    const parsedTaskCount = computed(() => {
        if (!brainDumpText.value.trim()) return 0

        const lines = brainDumpText.value.split('\n').filter(line => line.trim())
        return lines.length
    })

    // Process the brain dump text and create tasks
    // TASK-1325: URL lines are scraped in parallel for title/description enrichment
    const processBrainDump = async () => {
        if (!brainDumpText.value.trim()) return

        const lines = brainDumpText.value.split('\n').filter(line => line.trim())
        const { createTaskWithUndo } = useUnifiedUndoRedo()

        // Separate URL lines from regular lines for parallel scraping
        const urlLineIndices: number[] = []
        if (isOnline.value) {
            lines.forEach((line, i) => {
                if (isUrl(line.trim())) urlLineIndices.push(i)
            })
        }

        // Scrape URL lines in parallel (with 5s timeout per URL)
        const scrapeResults = new Map<number, { title: string; description: string }>()
        if (urlLineIndices.length > 0) {
            isProcessingUrls.value = true
            const scrapePromises = urlLineIndices.map(async (lineIndex) => {
                const url = lines[lineIndex].trim()
                const data = await scrapeUrl(url, { skipAi: urlLineIndices.length > 3 })
                if (data.title && !data.error) {
                    const summaryPart = data.aiSummary || data.description || ''
                    const description = summaryPart
                        ? `${summaryPart}\n\nSource: ${url}`
                        : `Source: ${url}`
                    scrapeResults.set(lineIndex, { title: data.title, description })
                }
            })
            await Promise.allSettled(scrapePromises)
            isProcessingUrls.value = false
        }

        // Create tasks from all lines
        lines.forEach((line, lineIndex) => {
            const cleanedLine = line.trim()

            // Check if this line was a scraped URL
            const scrapeResult = scrapeResults.get(lineIndex)
            if (scrapeResult) {
                createTaskWithUndo({
                    title: scrapeResult.title,
                    description: scrapeResult.description,
                    status: 'planned',
                    isInInbox: true
                })
                return
            }

            // Regular line: parse for priority, duration, etc.
            let title = cleanedLine
            let priority: 'high' | 'medium' | 'low' | null = null
            let estimatedDuration: number | undefined

            // Extract priority (e.g., "!!!", "!!", "!")
            const priorityMatch = cleanedLine.match(/(!+)$/)
            if (priorityMatch) {
                const exclamationCount = priorityMatch[1].length
                if (exclamationCount >= 3) priority = 'high'
                else if (exclamationCount === 2) priority = 'medium'
                else if (exclamationCount === 1) priority = 'low'
                title = cleanedLine.replace(/\s*!+$/, '').trim()
            }

            // Extract duration (e.g., "2h", "30m")
            const durationMatch = cleanedLine.match(/(\d+)([hm])$/i)
            if (durationMatch) {
                const value = parseInt(durationMatch[1])
                const unit = durationMatch[2].toLowerCase()
                if (unit === 'h') estimatedDuration = value * 60
                else estimatedDuration = value
                title = cleanedLine.replace(/\s*\d+[hm]$/i, '').trim()
            }

            createTaskWithUndo({
                title,
                priority,
                estimatedDuration,
                status: 'planned',
                isInInbox: true
            })
        })

        // Clear brain dump
        brainDumpText.value = ''
        brainDumpMode.value = false
    }

    // Detect text direction based on content
    const textDirection = computed(() => {
        if (!brainDumpText.value.trim()) return 'ltr'

        // Check first non-whitespace character
        const firstChar = brainDumpText.value.trim()[0]

        // RTL character ranges (Hebrew: \u0590-\u05FF, Arabic: \u0600-\u06FF, etc.)
        const rtlRegex = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/

        return rtlRegex.test(firstChar) ? 'rtl' : 'ltr'
    })

    return {
        brainDumpMode,
        brainDumpText,
        textDirection,
        parsedTaskCount,
        processBrainDump,
        isProcessingUrls
    }
}
