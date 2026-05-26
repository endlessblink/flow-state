import { ref, type Ref, type ComputedRef } from 'vue'
import { useTaskStore, type Task, type Subtask, type TaskInstance } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { useCanvasUiStore } from '@/stores/canvas/canvasUi'
import { useToast } from '@/composables/useToast'
import type { SimpleRecurrenceRule } from '@/types/tasks'
import { RecurrencePattern, EndCondition } from '@/types/recurrence'
import type { RecurrenceRule as LegacyRecurrenceRule, RecurrenceEndCondition, WeeklyRecurrenceRule, MonthlyRecurrenceRule } from '@/types/recurrence'


// Helper for cleaning task instances (from existing code)
// Helper for cleaning task instances (from existing code)
const getTaskInstances = (task: Task): TaskInstance[] => {
    return task.instances || []
}

export interface TaskEditActionsOptions {
    isFormValid?: ComputedRef<boolean>
    isFormDirty?: ComputedRef<boolean>
    markCurrentTaskSaved?: () => void
}

export interface SaveTaskOptions {
    close?: boolean
    showSuccessToast?: boolean
}

export function useTaskEditActions(
    props: { task: Task | null },
    emit: (event: 'close') => void,
    editedTask: Ref<Task>,
    isSaving: Ref<boolean>,
    options: TaskEditActionsOptions = {}
) {
    const taskStore = useTaskStore()
    const canvasStore = useCanvasStore()
    const canvasUiStore = useCanvasUiStore()
    const { showToast } = useToast()

    const sectionChanged = ref(false)


    // --- Subtask Management ---

    const addSubtask = () => {
        const newSubtask: Subtask = {
            id: Date.now().toString(),
            parentTaskId: editedTask.value.id,
            title: '',
            description: '',
            completedPomodoros: 0,
            isCompleted: false,
            createdAt: new Date(),
            updatedAt: new Date()
        }
        editedTask.value.subtasks.push(newSubtask)
    }

    const deleteSubtask = (subtaskId: string) => {
        const index = editedTask.value.subtasks.findIndex(st => st.id === subtaskId)
        if (index !== -1) {
            editedTask.value.subtasks.splice(index, 1)
        }
    }

    const updateSubtaskCompletion = (subtask: Subtask) => {
        if (!props.task) return

        // TASK-089 FIX: Lock position BEFORE any store updates
        const canvasPosition = editedTask.value.canvasPosition ?? props.task?.canvasPosition
        if (canvasPosition) {
            // Optimistic sync removed
        }

        // Update subtask in store
        taskStore.updateSubtaskWithUndo(editedTask.value.id, subtask.id, {
            isCompleted: subtask.isCompleted,
            updatedAt: new Date()
        })

        // Recalculate parent progress
        const completedCount = editedTask.value.subtasks.filter(st => st.isCompleted).length
        const totalSubtasks = editedTask.value.subtasks.length
        const newProgress = totalSubtasks > 0 ? Math.round((completedCount / totalSubtasks) * 100) : 0

        taskStore.updateTaskWithUndo(editedTask.value.id, {
            progress: newProgress,
            updatedAt: new Date()
        })
    }

    const resetPomodoros = () => {
        editedTask.value.completedPomodoros = 0
        editedTask.value.subtasks.forEach(subtask => {
            subtask.completedPomodoros = 0
        })
    }

    // --- Core Scheduling & Parsing Logic ---

    const handleScheduledDateChange = () => {
        if (editedTask.value.scheduledDate && !editedTask.value.scheduledTime) {
            editedTask.value.scheduledTime = '09:00'
        }
    }

    // --- Canvas Interaction ---

    const handleSectionChange = (sectionId: string | null) => {
        sectionChanged.value = true
        if (!sectionId) {
            // Move to Inbox
            editedTask.value.isInInbox = true
            editedTask.value.canvasPosition = undefined
            editedTask.value.parentId = undefined
            return
        }

        const section = canvasStore.sections.find(s => s.id === sectionId)
        if (!section) return

        // Update position if not already in this section
        const currentPos = editedTask.value.canvasPosition
        const isCurrentlyInSection = currentPos &&
            currentPos.x >= section.position.x &&
            currentPos.x <= section.position.x + section.position.width &&
            currentPos.y >= section.position.y &&
            currentPos.y <= section.position.y + section.position.height

        if (!isCurrentlyInSection) {
            // Place in center of section with small offset
            editedTask.value.canvasPosition = {
                x: section.position.x + (section.position.width / 2) - 100,
                y: section.position.y + (section.position.height / 2) - 40
            }
        }

        // Set parentId so the task belongs to this group
        editedTask.value.parentId = sectionId
        editedTask.value.isInInbox = false

        // Apply "Assign on Drop" settings
        if (section.assignOnDrop) {
            const settings = section.assignOnDrop
            if (settings.priority) editedTask.value.priority = settings.priority
            if (settings.status) editedTask.value.status = settings.status
            if (settings.projectId) editedTask.value.projectId = settings.projectId

            if (settings.dueDate) {
                import('@/composables/useGroupSettings').then(({ resolveDueDate }) => {
                    const dateStr = resolveDueDate(settings.dueDate!)
                    if (dateStr) editedTask.value.dueDate = dateStr
                })
            }
        }
    }

    // TASK-1403: Convert legacy RecurrenceRule to new SimpleRecurrenceRule
    function convertToSimpleRecurrenceRule(
        oldRule: LegacyRecurrenceRule,
        endCondition: RecurrenceEndCondition
    ): SimpleRecurrenceRule | null {
        let pattern: SimpleRecurrenceRule['pattern']
        switch (oldRule.pattern) {
            case RecurrencePattern.DAILY: pattern = 'daily'; break
            case RecurrencePattern.WEEKLY: pattern = 'weekly'; break
            case RecurrencePattern.MONTHLY: pattern = 'monthly'; break
            case RecurrencePattern.YEARLY: pattern = 'yearly'; break
            default: return null // NONE or CUSTOM — not supported in new model
        }

        const rule: SimpleRecurrenceRule = {
            pattern,
            interval: (oldRule as { interval?: number }).interval || 1,
            endType: endCondition.type === EndCondition.NEVER ? 'never'
                   : endCondition.type === EndCondition.AFTER_COUNT ? 'after_count'
                   : 'on_date',
        }

        if (oldRule.pattern === RecurrencePattern.WEEKLY) {
            rule.weekdays = [...(oldRule as WeeklyRecurrenceRule).weekdays]
        }
        if (oldRule.pattern === RecurrencePattern.MONTHLY) {
            const monthly = oldRule as MonthlyRecurrenceRule
            if (monthly.dayOfMonth) rule.monthDay = monthly.dayOfMonth
            if (monthly.weekday !== undefined && monthly.weekOfMonth !== undefined) {
                rule.monthWeekday = { nth: monthly.weekOfMonth, day: monthly.weekday }
            }
        }
        if (endCondition.type === EndCondition.ON_DATE && endCondition.date) {
            rule.endDate = endCondition.date
        }
        if (endCondition.type === EndCondition.AFTER_COUNT && endCondition.count) {
            rule.endCount = endCondition.count
        }

        return rule
    }

    // --- Main Save Action ---

    // BUG-291 FIX: Made async to properly await updateTaskWithUndo
    const saveTask = async (saveOptions: SaveTaskOptions = {}): Promise<boolean> => {
        const shouldClose = saveOptions.close ?? true
        const shouldShowSuccessToast = saveOptions.showSuccessToast ?? true

        // Guard: Prevent double-save
        if (isSaving.value || !props.task) return false

        // Validate form before saving
        if (options.isFormValid && !options.isFormValid.value) {
            // Check specific validation failures
            if (!editedTask.value.title || editedTask.value.title.trim() === '') {
                showToast('Task title is required', 'error')
            } else {
                showToast('Please fix form errors before saving', 'error')
            }
            return false
        }

        // Check if there are actually changes to save
        if (options.isFormDirty && !options.isFormDirty.value) {
            // No changes - just close without showing error
            if (shouldClose) emit('close')
            return true
        }

        isSaving.value = true

        try {
            // Debug logging omitted for brevity in refactor, but logic preserved

            const originalTask = taskStore.tasks.find(t => t.id === editedTask.value.id)
            const originalInstances = originalTask ? getTaskInstances(originalTask) : []
            const originalDueDate = originalTask?.dueDate || ''
            const editedDueDate = editedTask.value.dueDate || ''
            const dueDateChanged = editedDueDate !== originalDueDate
            const dueDateDivergesFromSchedule = Boolean(
                dueDateChanged &&
                editedTask.value.scheduledDate &&
                editedDueDate !== editedTask.value.scheduledDate
            )

            const hadOriginalSchedule = originalInstances.length > 0 ||
                (originalTask?.scheduledDate && originalTask?.scheduledTime) ||
                (originalTask?.instances && originalTask.instances.length > 0)
            const hasNewSchedule = editedTask.value.scheduledDate && editedTask.value.scheduledTime
            // BUG-1365 FIX: Only consider schedule "removed" if the edited task also has no instances.
            // Without this check, instance-based tasks (no legacy scheduledDate/scheduledTime) would
            // have their instances deleted on every save because hasNewSchedule is always false for them.
            const editedHasInstances = editedTask.value.instances && editedTask.value.instances.length > 0
            const scheduleExplicitlyRemoved = hadOriginalSchedule && !hasNewSchedule && !editedHasInstances

            const originalIsInInbox = editedTask.value.isInInbox ?? props.task?.isInInbox

            const updates: Record<string, unknown> = {
                title: editedTask.value.title,
                description: editedTask.value.description,
                status: editedTask.value.status,
                priority: editedTask.value.priority,
                dueDate: editedTask.value.dueDate,
                scheduledDate: editedTask.value.scheduledDate,
                scheduledTime: editedTask.value.scheduledTime,
                estimatedDuration: editedTask.value.estimatedDuration,
                recurrence: editedTask.value.recurrence,
                subtasks: editedTask.value.subtasks
            }

            // Only write canvasPosition if user explicitly changed section via handleSectionChange
            if (sectionChanged.value && editedTask.value.canvasPosition !== undefined) {
                updates.canvasPosition = editedTask.value.canvasPosition
                updates.isInInbox = false
            } else if (props.task?.canvasPosition !== undefined) {
                // Task is on canvas but position wasn't changed — don't touch position, just preserve inbox status
                updates.isInInbox = false
            } else if (originalIsInInbox !== undefined) {
                updates.isInInbox = originalIsInInbox
            }

            // Include parentId if the task has a canvas position (set by section change)
            if (editedTask.value.parentId !== undefined) {
                updates.parentId = editedTask.value.parentId
            }

            // Preserve existing instances
            if (editedTask.value.instances && editedTask.value.instances.length > 0) {
                updates.instances = editedTask.value.instances
            }

            // Lock position before update (no-op, optimistic sync removed)

            // TASK-1403: Convert recurrence to new SimpleRecurrenceRule format (clone-on-complete)
            if (editedTask.value.recurrence?.isEnabled && editedTask.value.recurrence.rule) {
                const oldRule = editedTask.value.recurrence.rule as LegacyRecurrenceRule
                const endCondition = editedTask.value.recurrence.endCondition
                const newRule = convertToSimpleRecurrenceRule(oldRule, endCondition)
                if (newRule) {
                    updates.recurrenceRule = newRule
                }
                // Keep old recurrence field for backwards compat during migration
                // but stop writing recurringInstances (no more pre-generation)
            } else if (editedTask.value.recurrence && !editedTask.value.recurrence.isEnabled) {
                // Recurrence was disabled — clear the new rule too
                updates.recurrenceRule = undefined
            }

            console.time('⚡ [BUG-291] Task update')

            // BUG-1097 FIX: Ensure dueDate is included in updates
            if (editedTask.value.dueDate !== undefined) {
                updates.dueDate = editedTask.value.dueDate
            }

            // BUG-1206 FIX: Await updateTask to ensure store + sync queue are updated
            // before closing the modal. updateTask no longer rolls back on direct save failure
            // (sync queue retries), so this won't block the UI on network errors.
            await taskStore.updateTaskWithUndo(editedTask.value.id, updates as Partial<Task>)

            console.timeEnd('⚡ [BUG-291] Task update')

            // BUG-357 FIX: Force canvas sync to update Vue Flow nodes with fresh data
            // This fixes Tauri/WebKitGTK reactivity issue where computed doesn't re-evaluate
            canvasUiStore.requestSync('user:manual')

            options.markCurrentTaskSaved?.()

            // BUG-1097 FIX: Close modal FIRST, then show toast
            // This ensures the modal closes even if toast has issues
            if (shouldClose) emit('close')
            sectionChanged.value = false
            isSaving.value = false

            // FIX: Clean up pending write after a short delay.
            // The 120s safety timeout is too long — reduce to 5s after a successful save.
            // This still protects against realtime echoes (which arrive within ~1s)
            // while allowing legitimate sync updates sooner.
            const savedTaskId = editedTask.value.id
            setTimeout(() => {
                taskStore.removePendingWrite(savedTaskId)
            }, 5000)

            // Show success feedback after close
            if (shouldShowSuccessToast) showToast('Task saved successfully', 'success')

            // === BACKGROUND OPERATIONS (fire-and-forget) ===
            // These run after modal closes - user doesn't wait for them

            // Handle instances
            if (editedTask.value.scheduledDate && editedTask.value.scheduledTime && !dueDateDivergesFromSchedule) {
                const existingInstances = props.task ? getTaskInstances(props.task) : []
                const sameDayInstance = existingInstances.find((inst) =>
                    inst.scheduledDate && inst.scheduledDate === editedTask.value.scheduledDate
                )

                if (sameDayInstance && sameDayInstance.id) {
                    taskStore.updateTaskInstanceWithUndo(editedTask.value.id, sameDayInstance.id, {
                        scheduledTime: editedTask.value.scheduledTime,
                        duration: editedTask.value.estimatedDuration || 60
                    })
                } else {
                    taskStore.createTaskInstanceWithUndo(editedTask.value.id, {
                        scheduledDate: editedTask.value.scheduledDate,
                        scheduledTime: editedTask.value.scheduledTime,
                        duration: editedTask.value.estimatedDuration || 60
                    })
                }
            } else if (scheduleExplicitlyRemoved) {
                const existingInstances = props.task ? getTaskInstances(props.task) : []
                if (existingInstances.length > 0) {
                    existingInstances.forEach((instance) => {
                        if (instance.id) {
                            taskStore.deleteTaskInstanceWithUndo(editedTask.value.id, instance.id)
                        }
                    })

                    // Check if should return to inbox
                    const currentTask = taskStore.tasks.find(t => t.id === editedTask.value.id)
                    if (currentTask) {
                        const hasRemainingInstances = getTaskInstances(currentTask).length > 0
                        if (!hasRemainingInstances && currentTask.isInInbox === false) {
                            taskStore.updateTask(currentTask.id, {
                                instances: [],
                                isInInbox: true
                            })
                        }
                    }
                }
            }

            // Subtasks are included in the main updateTask call above (no separate sync needed)

            // NOTE: emit('close') already called above for instant feedback
            return true
        } catch (error) {
            // Handle save errors gracefully
            console.error('Failed to save task:', error)
            isSaving.value = false

            // Show user-friendly error message
            const errorMessage = error instanceof Error
                ? error.message
                : 'An unexpected error occurred'
            showToast(`Failed to save task: ${errorMessage}`, 'error')

            // Don't close the modal on error - let user retry
            return false
        }
    }

    return {
        addSubtask,
        deleteSubtask,
        updateSubtaskCompletion,
        resetPomodoros,
        handleScheduledDateChange,
        handleSectionChange,
        saveTask,
        sectionChanged
    }
}
