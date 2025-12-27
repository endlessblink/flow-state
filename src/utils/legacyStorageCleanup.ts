/**
 * Legacy Storage Cleanup Utility
 * 
 * Physically removes monolithic documents from PouchDB once individual document 
 * storage is active and verified. This prevents "shadow" data from being synced
 * and reduces database size.
 */

import { STORAGE_FLAGS } from '@/config/database'

const MONOLITHIC_DOCS = [
    { flag: STORAGE_FLAGS.INDIVIDUAL_ONLY, id: 'tasks:data', name: 'Tasks' },
    { flag: STORAGE_FLAGS.INDIVIDUAL_PROJECTS_ONLY, id: 'projects:data', name: 'Projects' },
    { flag: STORAGE_FLAGS.INDIVIDUAL_SECTIONS_ONLY, id: 'canvas:data', name: 'Canvas/Sections' }
]

/**
 * Clean up legacy monolithic documents if their respective individual-only flags are set.
 * This should be called once the database is initialized and data has been verified.
 */
export const cleanupLegacyMonolithicDocuments = async (db: any): Promise<{
    deleted: string[],
    failed: string[],
    skipped: string[]
}> => {
    const results = {
        deleted: [] as string[],
        failed: [] as string[],
        skipped: [] as string[]
    }

    console.log('🧹 [STORAGE-CLEANUP] Starting legacy document cleanup check...')

    for (const doc of MONOLITHIC_DOCS) {
        if (doc.flag) {
            try {
                const existingDoc = await db.get(doc.id).catch(() => null)
                if (existingDoc) {
                    await db.remove(existingDoc)
                    results.deleted.push(doc.name)
                    console.log(`✅ [STORAGE-CLEANUP] Deleted legacy ${doc.name} document (${doc.id})`)
                } else {
                    results.skipped.push(doc.name)
                }
            } catch (error) {
                results.failed.push(doc.name)
                console.warn(`⚠️ [STORAGE-CLEANUP] Failed to delete legacy ${doc.name} document:`, error)
            }
        } else {
            results.skipped.push(doc.name)
        }
    }

    return results
}
