
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import PouchDB from 'pouchdb'

describe('Sync Conflict Reproduction', () => {
    let remoteDB: PouchDB.Database
    let clientADB: PouchDB.Database
    let clientBDB: PouchDB.Database

    beforeEach(async () => {
        // Unique DB names for each run
        const timestamp = Date.now()
        remoteDB = new PouchDB(`remote_${timestamp}`)
        clientADB = new PouchDB(`clientA_${timestamp}`)
        clientBDB = new PouchDB(`clientB_${timestamp}`)
    })

    afterEach(async () => {
        await remoteDB.destroy()
        await clientADB.destroy()
        await clientBDB.destroy()
    })

    it('generates a conflict when two clients update the same document', async () => {
        // 1. Setup: Create initial document in Client A
        const docId = 'task-conflict-repro'
        await clientADB.put({
            _id: docId,
            title: 'Original Title',
            status: 'todo',
            type: 'task',
            updatedAt: new Date().toISOString()
        })

        // 2. Sync A -> Remote
        await clientADB.replicate.to(remoteDB)

        // 3. Sync Remote -> Client B
        await clientBDB.replicate.from(remoteDB)
        const docInB = await clientBDB.get(docId)
        expect(docInB.title).toBe('Original Title')

        // 4. Update Client A (OFFLINE)
        const docInA = await clientADB.get(docId)
        await clientADB.put({
            ...docInA,
            title: 'Updated by A',
            updatedAt: new Date().toISOString()
        })

        // 5. Update Client B (OFFLINE) -> CONFLICTING CHANGE
        await clientBDB.put({
            ...docInB,
            title: 'Updated by B',
            updatedAt: new Date().toISOString()
        })

        // 6. Sync A -> Remote (A wins for now)
        await clientADB.replicate.to(remoteDB)

        // 7. Sync B -> Remote (Conflict occurs here)
        try {
            await clientBDB.replicate.to(remoteDB)
        } catch (e) {
            // PouchDB usually handles conflicts silently during replication, 
            // but stores them as conflicting revisions.
            console.log('Replication error (unexpected vs expected):', e)
        }


        // 8. Verify Conflict Exists on Remote
        const remoteDoc = await remoteDB.get(docId, { conflicts: true })
        console.log('Remote Document Conflicts (Before Resolution):', remoteDoc._conflicts)

        expect(remoteDoc._conflicts).toBeDefined()
        expect(remoteDoc._conflicts?.length).toBeGreaterThan(0)

        // 9. PHASE 2: Attempt Resolution using App Logic
        const { ConflictDetector } = await import('@/utils/conflictDetector')
        const { ConflictResolver } = await import('@/utils/conflictResolver')

        const detector = new ConflictDetector({ deviceId: 'test-device' })
        const resolver = new ConflictResolver('test-device')

        // Initialize detector with Client B (which failed to push) and Remote
        // We simulate that Client B detects the conflict because it has the "losing" state vs remote
        await detector.initialize(clientBDB, remoteDB)

        // Detect execution
        // Note: detectDocumentConflict fetches heads. 
        // It might NOT detect it if PouchDB already synced the winning revision to Client B locally.
        // So we force Client B to pull the conflict first?
        await clientBDB.replicate.from(remoteDB)

        // Now Client B has the "winning" remote revision AND the "losing" local revision in _conflicts or history

        const conflicts = await detector.detectAllConflicts()

        if (conflicts.length > 0) {
            const resolution = await resolver.resolveConflict(conflicts[0])

            // Apply resolution (simulating PROPER fix)
            // We need to get the conflicting revisions first
            const docWithConflicts = await clientBDB.get(conflicts[0].documentId, { conflicts: true })
            const conflictRevs = docWithConflicts._conflicts || []

            const bulkDocs = [
                // 1. The Winner
                {
                    ...resolution.resolvedDocument,
                    _id: conflicts[0].documentId,
                    _rev: conflicts[0].localVersion._rev // Updating local head
                },
                // 2. The Losers (Process as Deletions)
                ...conflictRevs.map(rev => ({
                    _id: conflicts[0].documentId,
                    _rev: rev,
                    _deleted: true
                }))
            ]

            await clientBDB.bulkDocs(bulkDocs)

            // Push resolved state back to remote
            await clientBDB.replicate.to(remoteDB)
        }

        // 10. Verify _conflicts is cleared on Remote
        const remoteDocAfter = await remoteDB.get(docId, { conflicts: true })

        // CRITICAL: If this fails, we found the root cause (conflicts persist even after "resolution")
        expect(remoteDocAfter._conflicts || []).toHaveLength(0)
    })
})

