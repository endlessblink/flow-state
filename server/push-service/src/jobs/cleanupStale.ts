import { removeStaleSubscriptions } from '../db.js'

export async function runCleanupStale() {
  const removed = await removeStaleSubscriptions(5)
  if (removed > 0) {
    console.log(`[CLEANUP] Removed ${removed} stale subscription(s)`)
  }
}
