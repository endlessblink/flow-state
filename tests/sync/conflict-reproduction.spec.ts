
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
        console.log('Remote Document Conflicts:', remoteDoc._conflicts)

        expect(remoteDoc._conflicts).toBeDefined()
        expect(remoteDoc._conflicts?.length).toBeGreaterThan(0)
    })
})
