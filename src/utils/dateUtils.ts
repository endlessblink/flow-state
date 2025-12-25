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
 */
export const parseDateKey = (dateKey: string): Date => {
    const [year, month, day] = dateKey.split('-').map(Number)
    return new Date(year, month - 1, day, 0, 0, 0, 0)
}

/**
 * Get the current date as a YYYY-MM-DD string
 */
export const getTodayDateKey = (): string => {
    return formatDateKey(new Date())
}
