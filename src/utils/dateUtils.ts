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
