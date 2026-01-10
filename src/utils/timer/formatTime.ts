/**
 * Format seconds into MM:SS display string
 */
export function formatTime(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Format seconds into human-readable duration
 */
export function formatDuration(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60)
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const remainingMins = minutes % 60
    return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`
}
