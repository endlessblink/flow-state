/**
 * Quick Tasks — Pinned & Frequent Task Shortcuts
 *
 * TASK-1772: Unified "Pinned" onto `task.isPinned`. The Supabase `pinned_tasks`
 * table is gone; pinned items are real tasks filtered by `task.isPinned`.
 *
 * - Pinned: tasks in the store where `isPinned === true`
 * - Frequent: auto-detected from `completedPomodoros` on active tasks
 */

import { computed, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useTaskStore } from '@/stores/tasks'
import { useProjectStore } from '@/stores/projects'
import { useTimerStore } from '@/stores/timer'
import type { QuickTaskItem } from '@/types/quickTasks'
import type { Task } from '@/types/tasks'

export type PinTaskResult =
    | { status: 'created' }
    | { status: 'pinned-existing'; taskId: string }
    | { status: 'already-pinned'; taskId: string }
    | { status: 'unauthenticated' }
    | { status: 'empty' }

// FEATURE-1774: per-user dismissals for the Frequent list, localStorage-backed.
// Display preference only — intentionally not synced across devices.
const DISMISS_STORAGE_KEY = 'flowstate:dismissed-frequent'

function loadDismissedFrequent(): Set<string> {
    if (typeof window === 'undefined' || !window.localStorage) return new Set()
    try {
        const raw = window.localStorage.getItem(DISMISS_STORAGE_KEY)
        if (!raw) return new Set()
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? new Set(parsed as string[]) : new Set()
    } catch {
        return new Set()
    }
}

const dismissedFrequentIds = ref<Set<string>>(loadDismissedFrequent())

function persistDismissedFrequent() {
    if (typeof window === 'undefined' || !window.localStorage) return
    try {
        window.localStorage.setItem(
            DISMISS_STORAGE_KEY,
            JSON.stringify([...dismissedFrequentIds.value])
        )
    } catch {
        // Storage may be unavailable (private mode, quota) — fail silently.
    }
}

export function useQuickTasks() {
    const authStore = useAuthStore()
    const taskStore = useTaskStore()
    const projectStore = useProjectStore()
    const timerStore = useTimerStore()

    // --- Pinned Tasks (from task store — single source of truth) ---

    const pinnedTasks = computed<Task[]>(() =>
        taskStore.tasks.filter(t =>
            t.isPinned === true &&
            t.status !== 'done' &&
            !t._soft_deleted
        )
    )

    const pinTask = async (title: string, opts?: { description?: string; projectId?: string | null; priority?: string | null }): Promise<PinTaskResult> => {
        if (!authStore.isAuthenticated) return { status: 'unauthenticated' }
        const trimmed = title.trim()
        if (!trimmed) return { status: 'empty' }

        // If a task with this title already exists, just pin it in place.
        const existing = taskStore.tasks.find(
            t => t.title.toLowerCase() === trimmed.toLowerCase() &&
                t.status !== 'done' &&
                !t._soft_deleted
        )
        if (existing) {
            if (!existing.isPinned) {
                await taskStore.updateTaskWithUndo(existing.id, { isPinned: true })
                return { status: 'pinned-existing', taskId: existing.id }
            }
            return { status: 'already-pinned', taskId: existing.id }
        }

        await taskStore.createTaskWithUndo({
            title: trimmed,
            description: opts?.description || '',
            projectId: opts?.projectId || undefined,
            priority: (opts?.priority as Task['priority']) || null,
            status: 'todo',
            isPinned: true,
        })
        return { status: 'created' }
    }

    const unpinTask = async (taskId: string) => {
        const task = taskStore.tasks.find(t => t.id === taskId)
        if (!task || !task.isPinned) return
        await taskStore.updateTaskWithUndo(taskId, { isPinned: false })
    }

    const pinFromTask = async (task: Task) => {
        if (task.isPinned) return
        await taskStore.updateTaskWithUndo(task.id, { isPinned: true })
    }

    // --- Frequent Tasks (client-side from task store) ---

    const frequentTasks = computed<Task[]>(() => {
        return taskStore.tasks
            .filter(t =>
                t.status !== 'done' &&
                !t._soft_deleted &&
                (t.completedPomodoros || 0) > 0 &&
                !dismissedFrequentIds.value.has(t.id) &&
                (!taskStore.activeStatusFilter || t.status === taskStore.activeStatusFilter) &&
                (!projectStore.activeProjectId ||
                    t.projectId === projectStore.activeProjectId ||
                    projectStore.isDescendantOf(t.projectId ?? '', projectStore.activeProjectId))
            )
            .sort((a, b) => (b.completedPomodoros || 0) - (a.completedPomodoros || 0))
            .slice(0, 10)
    })

    /**
     * FEATURE-1774: Hide a task from the Frequent list. Persists to localStorage
     * so the dismissal survives reloads. Does not touch the task itself or
     * cross-device sync — this is a per-device display preference.
     */
    const dismissFromFrequent = (taskId: string) => {
        if (!taskId) return
        if (dismissedFrequentIds.value.has(taskId)) return
        const next = new Set(dismissedFrequentIds.value)
        next.add(taskId)
        dismissedFrequentIds.value = next
        persistDismissedFrequent()
    }

    /**
     * FEATURE-1774: Clear all Frequent dismissals. Exposed for a future
     * Settings "Restore hidden" action; currently unused in the UI.
     */
    const restoreFrequentDismissals = () => {
        if (dismissedFrequentIds.value.size === 0) return
        dismissedFrequentIds.value = new Set()
        persistDismissedFrequent()
    }

    // --- Merged Quick Task Items ---

    const quickTaskItems = computed<QuickTaskItem[]>(() => {
        const items: QuickTaskItem[] = []
        const seenIds = new Set<string>()

        // 1. Pinned tasks (real tasks scoped to active project, same as before)
        const visiblePins = pinnedTasks.value.filter(task =>
            !task.projectId ||
            task.projectId === 'uncategorized' ||
            !projectStore.activeProjectId ||
            task.projectId === projectStore.activeProjectId ||
            projectStore.isDescendantOf(task.projectId, projectStore.activeProjectId)
        )

        for (const task of visiblePins) {
            seenIds.add(task.id)
            const project = task.projectId && task.projectId !== 'uncategorized'
                ? taskStore.getProjectById(task.projectId)
                : null
            const projectColor = project?.color
                ? (Array.isArray(project.color) ? project.color[0] : project.color)
                : null

            items.push({
                key: `pin-${task.id}`,
                type: 'pinned',
                title: task.title,
                sourceId: task.id,
                projectId: task.projectId === 'uncategorized' ? null : task.projectId ?? null,
                projectName: project?.name || null,
                projectColor,
                priority: task.priority,
                frequency: 0,
                isPinned: true
            })
        }

        // 2. Frequent tasks (deduped against pinned by task ID)
        for (const task of frequentTasks.value) {
            if (seenIds.has(task.id)) continue
            seenIds.add(task.id)

            const project = task.projectId && task.projectId !== 'uncategorized'
                ? taskStore.getProjectById(task.projectId)
                : null
            const freqProjectColor = project?.color
                ? (Array.isArray(project.color) ? project.color[0] : project.color)
                : null

            items.push({
                key: `freq-${task.id}`,
                type: 'frequent',
                title: task.title,
                sourceId: task.id,
                projectId: task.projectId === 'uncategorized' ? null : task.projectId ?? null,
                projectName: project?.name || null,
                projectColor: freqProjectColor,
                priority: task.priority,
                frequency: task.completedPomodoros || 0,
                isPinned: !!task.isPinned
            })
        }

        return items
    })

    // --- Actions ---

    /**
     * Select a quick task and start the timer. All items are real tasks
     * post-unification, so `sourceId` is always a task id.
     */
    const selectAndStartTimer = async (item: QuickTaskItem) => {
        await timerStore.startTimer(item.sourceId)
    }

    /**
     * No-op kept for backward compat with callers that used to trigger a
     * DB refresh. The task store drives reactivity now.
     */
    const loadPinnedTasks = async () => { /* intentional no-op */ }

    return {
        pinnedTasks,
        frequentTasks,
        quickTaskItems,
        isLoading: computed(() => false),
        loadPinnedTasks,
        pinTask,
        unpinTask,
        pinFromTask,
        selectAndStartTimer,
        dismissFromFrequent,
        restoreFrequentDismissals
    }
}
