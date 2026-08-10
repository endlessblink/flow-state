import { nextTick } from 'vue'

type TaskLookup<T> = () => T | undefined | null

type RefreshTasks = () => Promise<unknown>

/**
 * Completes a task across the small window where a catalog refresh can replace
 * the row between the view lookup and the undo system's canonical lookup.
 */
export async function runTaskMutationWithSettling<T>(
    taskId: string,
    getTask: TaskLookup<unknown>,
    refreshTasks: RefreshTasks,
    mutation: () => Promise<T>,
): Promise<T> {
    let refreshed = false
    let lastError: unknown

    for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
            if (!getTask()) {
                if (!refreshed) {
                    refreshed = true
                    await refreshTasks()
                }
                await nextTick()
                continue
            }
            return await mutation()
        } catch (error) {
            lastError = error
            const message = error instanceof Error ? error.message : String(error)
            if (!message.includes(`Task update target no longer exists: ${taskId}`)) throw error
            if (!refreshed) {
                refreshed = true
                await refreshTasks()
            }
            await nextTick()
        }
    }

    throw lastError instanceof Error
        ? lastError
        : new Error(`Task update target no longer exists: ${taskId}`)
}
