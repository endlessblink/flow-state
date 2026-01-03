/**
 * Individual Notification Storage Utility
 *
 * Stores each scheduled notification as a separate document.
 * Document ID format: notif-{notificationId}
 */

import type { ScheduledNotification } from '@/types/recurrence'

export const NOTIF_DOC_PREFIX = 'notif-'

/**
 * Save multiple notifications as individual documents
 */
export const saveIndividualNotifications = async (
    db: PouchDB.Database,
    notifications: ScheduledNotification[]
): Promise<void> => {
    try {
        const docs = notifications.map(n => ({
            _id: `${NOTIF_DOC_PREFIX}${n.id}`,
            type: 'notification',
            ...n,
            scheduledTime: n.scheduledTime.toISOString(),
            snoozedUntil: n.snoozedUntil?.toISOString(),
            createdAt: n.createdAt.toISOString(),
            updatedAt: new Date().toISOString()
        }))

        // Use bulkDocs for efficiency
        const existingDocs = await db.allDocs({
            keys: docs.map(d => d._id),
            include_docs: true
        })

        const docsWithRevs = docs.map((doc, index) => {
            const row = existingDocs.rows[index]
            if ('doc' in row && row.doc) {
                return { ...doc, _rev: row.doc._rev }
            }
            return doc
        })

        await db.bulkDocs(docsWithRevs)
    } catch (error) {
        console.error('❌ [NOTIF-STORAGE] Failed to save notifications:', error)
        throw error
    }
}

/**
 * Load all individual notifications
 */
export const loadIndividualNotifications = async (db: PouchDB.Database): Promise<ScheduledNotification[]> => {
    try {
        const result = await db.allDocs({
            startkey: NOTIF_DOC_PREFIX,
            endkey: `${NOTIF_DOC_PREFIX}\ufff0`,
            include_docs: true
        })

        return result.rows
            .map(row => {
                const doc = row.doc as any
                if (!doc) return null
                return {
                    ...doc,
                    scheduledTime: new Date(doc.scheduledTime),
                    snoozedUntil: doc.snoozedUntil ? new Date(doc.snoozedUntil) : undefined,
                    createdAt: new Date(doc.createdAt)
                } as ScheduledNotification
            })
            .filter((n): n is ScheduledNotification => n !== null)
    } catch (error) {
        console.error('❌ [NOTIF-STORAGE] Failed to load notifications:', error)
        return []
    }
}

/**
 * Delete a specific notification document
 */
export const deleteIndividualNotification = async (db: PouchDB.Database, id: string): Promise<void> => {
    try {
        const docId = `${NOTIF_DOC_PREFIX}${id}`
        const doc = await db.get(docId)
        await db.remove(doc)
    } catch (error) {
        const pouchErr = error as { status?: number }
        if (pouchErr.status !== 404) {
            console.warn(`⚠️ [NOTIF-STORAGE] Failed to delete notification ${id}:`, error)
        }
    }
}
