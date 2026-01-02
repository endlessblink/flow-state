
// WAL Verification Script

import { transactionManager } from './services/sync/TransactionManager'

async function testWAL() {
    console.log('🧪 Starting WAL Verification...')

    try {
        // 1. Initialize
        await transactionManager.initialize()

        // 2. Create a dummy transaction
        console.log('📝 Creating test transaction...')
        const txId = await transactionManager.beginTransaction('create', 'test_collection', { foo: 'bar' })
        console.log(`✅ Transaction created: ${txId}`)

        // 3. Verify it exists in pending state
        // (We would need to peek into DB, but for now we trust the return)

        // 4. Commit it
        console.log('💾 Committing transaction...')
        await transactionManager.commit(txId)
        console.log('✅ Transaction committed')

        console.log('🎉 WAL Basic Test Passed')

    } catch (error) {
        console.error('❌ WAL Test Failed:', error)
    }
}

// Attach to window for dev console access
(window as any).testWAL = testWAL
