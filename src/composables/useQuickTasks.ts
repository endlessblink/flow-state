/**
 * FEATURE-1248: Quick Tasks — Pinned & Frequent Task Shortcuts
 *
 * Central composable for the Quick Tasks system:
 * - Pinned tasks: user-created shortcuts stored in `pinned_tasks` table
 * - Frequent tasks: auto-detected from `completedPomodoros` on active tasks
 */

import { ref, computed, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useTaskStore } from '@/stores/tasks'
import { useProjectStore } from '@/stores/projects'
import { useTimerStore } from '@/stores/timer'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'
import type { PinnedTask, QuickTaskItem } from '@/types/quickTasks'
import type { Task } from '@/types/tasks'

const pinnedTasks = ref<PinnedTask[]>([])
const isLoading = ref(false)

export function useQuickTasks() {
    const authStore = useAuthStore()
    const taskStore = useTaskStore()
    const projectStore = useProjectStore()
    const timerStore = useTimerStore()
    const db = useSupabaseDatabase()

    // --- Pinned Tasks (from Supabase) ---

    const loadPinnedTasks = async () => {
        if (!authStore.isAuthenticated) {
            pinnedTasks.value = []
            return
        }
        isLoading.value = true
        try {
            pinnedTasks.value = await db.fetchPinnedTasks()
        } catch (e) {
            console.error('[QUICK-TASKS] Failed to load pinned tasks:', e)
        } finally {
            isLoading.value = false
        }
    }

    const pinTask = async (title: string, opts?: { description?: string; projectId?: string | null; priority?: string | null }) => {
        if (!authStore.isAuthenticated) return

        const maxOrder = pinnedTasks.value.reduce((max, p) => Math.max(max, p.sortOrder), -1)
        const newPin: PinnedTask = {
            id: crypto.randomUUID(),
            userId: authStore.user!.id,
            title,
            description: opts?.description || '',
            projectId: opts?.projectId || null,
            priority: opts?.priority || null,
            sortOrder: maxOrder + 1,
            createdAt: new Date(),
            updatedAt: new Date()
        }

        // Optimistic update
        pinnedTasks.value = [...pinnedTasks.value, newPin]

        try {
            await db.savePinnedTask(newPin)
        } catch (e) {
            console.error('[QUICK-TASKS] Failed to save pin:', e)
            // Rollback
            pinnedTasks.value = pinnedTasks.value.filter(p => p.id !== newPin.id)
        }
    }

    const unpinTask = async (pinId: string) => {
        const backup = [...pinnedTasks.value]

        // Optimistic update
        pinnedTasks.value = pinnedTasks.value.filter(p => p.id !== pinId)

        try {
            await db.deletePinnedTask(pinId)
        } catch (e) {
            console.error('[QUICK-TASKS] Failed to delete pin:', e)
            pinnedTasks.value = backup
        }
    }

    const pinFromTask = async (task: Task) => {
        // Check if already pinned by title (case-insensitive)
        const already = pinnedTasks.value.some(
            p => p.title.toLowerCase() === task.title.toLowerCase()
        )
        if (already) return

        await pinTask(task.title, {
            description: task.description,
            projectId: task.projectId === 'uncategorized' ? null : task.projectId,
            priority: task.priority
        })
    }

    // --- Frequent Tasks (client-side from task store) ---

    const frequentTasks = computed<Task[]>(() => {
        return taskStore.tasks
            .filter(t =>
                t.status !== 'done' &&
                !t._soft_deleted &&
                (t.completedPomodoros || 0) > 0 &&
                (!taskStore.activeStatusFilter || t.status === taskStore.activeStatusFilter) &&
                (!projectStore.activeProjectId ||
                    t.projectId === projectStore.activeProjectId ||
                    projectStore.isDescendantOf(t.projectId ?? '', projectStore.activeProjectId))
            )
            .sort((a, b) => (b.completedPomodoros || 0) - (a.completedPomodoros || 0))
            .slice(0, 10)
    })

    // --- Merged Quick Task Items ---

    const quickTaskItems = computed<QuickTaskItem[]>(() => {
        const items: QuickTaskItem[] = []
        const seenTitles = new Set<string>()

        // 1. Pinned tasks first (in sort order)
        const visiblePins = [...pinnedTasks.value]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .filter(pin =>
                !pin.projectId ||
                !projectStore.activeProjectId ||
                pin.projectId === projectStore.activeProjectId ||
                projectStore.isDescendantOf(pin.projectId, projectStore.activeProjectId)
            )

        for (const pin of visiblePins) {
            const titleLower = pin.title.toLowerCase()
            seenTitles.add(titleLower)

            const project = pin.projectId ? taskStore.getProjectById(pin.projectId) : null
            const projectColor = project?.color
                ? (Array.isArray(project.color) ? project.color[0] : project.color)
                : null

            items.push({
                key: `pin-${pin.id}`,
                type: 'pinned',
                title: pin.title,
                sourceId: pin.id,
                projectId: pin.projectId,
                projectName: project?.name || null,
                projectColor,
                priority: pin.priority,
                frequency: 0,
                isPinned: true
            })
        }

        // 2. Frequent tasks (deduplicated by title)
        for (const task of frequentTasks.value) {
            const titleLower = task.title.toLowerCase()
            if (seenTitles.has(titleLower)) continue
            seenTitles.add(titleLower)

            const project = task.projectId && task.projectId !== 'uncategorized'
                ? taskStore.getProjectById(task.projectId)
                : null
            const freqProjectColor = project?.color
                ? (Array.isArray(project.color) ? project.color[0] : project.color)
                : null

            const isPinned = pinnedTasks.value.some(
                p => p.title.toLowerCase() === titleLower
            )

            items.push({
                key: `freq-${task.id}`,
                type: 'frequent',
                title: task.title,
                sourceId: task.id,
                projectId: task.projectId === 'uncategorized' ? null : task.projectId,
                projectName: project?.name || null,
                projectColor: freqProjectColor,
                priority: task.priority,
                frequency: task.completedPomodoros || 0,
                isPinned
            })
        }

        return items
    })

    // --- Actions ---

    /**
     * Select a quick task and start the timer.
     * For pinned tasks: finds matching active task by title, or creates a new one.
     * For frequent tasks: uses the task directly.
     */
    const selectAndStartTimer = async (item: QuickTaskItem) => {
        let taskId: string

        if (item.type === 'frequent') {
            taskId = item.sourceId
        } else {
            // Pinned: find matching active task by title (case-insensitive)
            const match = taskStore.tasks.find(
                t => t.title.toLowerCase() === item.title.toLowerCase() &&
                    t.status !== 'done' &&
                    !t._soft_deleted
            )

            if (match) {
                taskId = match.id
            } else {
                // Create a new task from the pin template
                const newTask = await taskStore.createTask({
                    title: item.title,
                    description: '',
                    projectId: item.projectId || 'uncategorized',
                    priority: item.priority as Task['priority'] || null,
                    status: 'in_progress'
                })
                taskId = newTask?.id || item.title
            }
        }

        await timerStore.startTimer(taskId)
    }

    // --- Auth Watcher ---

    watch(
        () => authStore.isAuthenticated,
        (isAuth) => {
            if (isAuth) {
                loadPinnedTasks()
            } else {
                pinnedTasks.value = []
            }
        },
        { immediate: true }
    )

    return {
        pinnedTasks: computed(() => pinnedTasks.value),
        frequentTasks,
        quickTaskItems,
        isLoading: computed(() => isLoading.value),
        loadPinnedTasks,
        pinTask,
        unpinTask,
        pinFromTask,
        selectAndStartTimer
    }
}
