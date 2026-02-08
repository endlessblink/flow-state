/**
 * Centralized date utility functions for Pomo-Flow
 */

/**
 * Format date as YYYY-MM-DD
 */
export const formatDateKey = (date: Date | string): string => {
    const d = date instanceof Date ? date : new Date(date)
    if (isNaN(d.getTime())) return ''

    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Parse a YYYY-MM-DD date key back into a Date object at start of day
 * Returns null for invalid date strings
 */
export const parseDateKey = (dateKey: string): Date | null => {
    const parts = dateKey.split('-')
    if (parts.length !== 3) return null

    const [year, month, day] = parts.map(Number)
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null

    const date = new Date(year, month - 1, day, 0, 0, 0, 0)
    if (isNaN(date.getTime())) return null

    return date
}

/**
 * Get the current date as a YYYY-MM-DD string
 */
export const getTodayDateKey = (): string => {
    return formatDateKey(new Date())
}

/**
 * Format a date for display in AI chat task results.
 * Handles both YYYY-MM-DD date strings and full ISO timestamps.
 * Uses Intl APIs for automatic Hebrew/English/any locale formatting.
 *
 * Examples (English): "Today", "Yesterday", "Tomorrow", "3 days ago", "in 2 days", "Feb 7"
 * Examples (Hebrew):  "היום", "אתמול", "מחר", "לפני 3 ימים", "בעוד יומיים", "7 בפבר׳"
 */
export const formatRelativeDate = (date: Date | string | number | null | undefined): string => {
    if (!date) return ''

    // Handle YYYY-MM-DD strings: treat as local date (not UTC)
    let d: Date
    if (typeof date === 'string') {
        const cleaned = date.includes('T') ? date.split('T')[0] : date
        if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
            const [y, m, day] = cleaned.split('-').map(Number)
            d = new Date(y, m - 1, day)
        } else {
            d = new Date(date)
        }
    } else {
        d = date instanceof Date ? date : new Date(date)
    }

    if (isNaN(d.getTime())) return typeof date === 'string' ? date : ''

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000)

    // Use Intl.RelativeTimeFormat for -6..+6 day range (auto-localizes)
    if (Math.abs(diffDays) <= 6) {
        try {
            const rtf = new Intl.RelativeTimeFormat(navigator.language, { numeric: 'auto' })
            return rtf.format(diffDays, 'day')
        } catch {
            // Fallback for environments without Intl.RelativeTimeFormat
            if (diffDays === 0) return 'Today'
            if (diffDays === -1) return 'Yesterday'
            if (diffDays === 1) return 'Tomorrow'
            if (diffDays < 0) return `${Math.abs(diffDays)}d ago`
            return `in ${diffDays}d`
        }
    }

    // Use Intl.DateTimeFormat for older/future dates (auto-localizes)
    try {
        const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
        if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric'
        return new Intl.DateTimeFormat(navigator.language, opts).format(d)
    } catch {
        return d.toLocaleDateString()
    }
}
