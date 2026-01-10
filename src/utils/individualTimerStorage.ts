/**
 * Individual Timer Storage Utility
 *
 * Stores timer sessions as individual PouchDB documents.
 * Document ID format: timer-session
 *
 * This ensures timer state is synchronized reliably across devices
 * while following the individual-document architecture.
 */

import type { PomodoroSession } from '@/stores/timer'

export const TIMER_DOC_ID = 'timer-session'

/**
 * Save timer session to individual document
 */
export const saveTimerSession = async (
    db: PouchDB.Database,
    session: PomodoroSession | null,
    deviceLeaderId: string | null,
    deviceLeaderLastSeen: number | null
): Promise<void> => {
    try {
        const existing = await db.get(TIMER_DOC_ID).catch(() => null) as any

        const sessionData = session ? {
            ...session,
            startTime: session.startTime.toISOString(),
            completedAt: session.completedAt?.toISOString()
        } : null

        await db.put({
            _id: TIMER_DOC_ID,
            _rev: existing?._rev,
            type: 'timer',
            session: sessionData,
            deviceLeaderId,
            deviceLeaderLastSeen,
            updatedAt: new Date().toISOString()
        })
    } catch (error) {
        console.error('❌ [TIMER-STORAGE] Failed to save timer session:', error)
        throw error
    }
}

/**
 * Load timer session from individual document
 */
export const loadTimerSession = async (db: PouchDB.Database): Promise<any> => {
    try {
        const doc = await db.get(TIMER_DOC_ID).catch(() => null) as any
        if (!doc) return null

        if (doc.session) {
            doc.session.startTime = new Date(doc.session.startTime)
            if (doc.session.completedAt) {
                doc.session.completedAt = new Date(doc.session.completedAt)
            }
        }

        return doc
    } catch (error) {
        console.warn('⚠️ [TIMER-STORAGE] Failed to load timer session:', error)
        return null
    }
}
