import { type Ref, type ComputedRef } from 'vue'
import { useTaskStore, type Task, type Subtask } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { useCanvasUiStore } from '@/stores/canvas/canvasUi'
import { generateRecurringInstances } from '@/utils/recurrenceUtils'
import { getUndoSystem } from '@/composables/undoSingleton'
import { useToast } from '@/composables/useToast'


// Helper for cleaning task instances (from existing code)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getTaskInstances = (task: Task): any[] => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (task as any).instances || []
}

export interface TaskEditActionsOptions {
    isFormValid?: ComputedRef<boolean>
    isFormDirty?: ComputedRef<boolean>
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
        if (!sectionId) {
            // Move to Inbox
            editedTask.value.isInInbox = true
            editedTask.value.canvasPosition = undefined
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

    // --- Main Save Action ---

    // BUG-291 FIX: Made async to properly await updateTaskWithUndo
    const saveTask = async () => {
        // Guard: Prevent double-save
        if (isSaving.value || !props.task) return

        // Validate form before saving
        if (options.isFormValid && !options.isFormValid.value) {
            // Check specific validation failures
            if (!editedTask.value.title || editedTask.value.title.trim() === '') {
                showToast('Task title is required', 'error')
            } else {
                showToast('Please fix form errors before saving', 'error')
            }
            return
        }

        // Check if there are actually changes to save
        if (options.isFormDirty && !options.isFormDirty.value) {
            // No changes - just close without showing error
            emit('close')
            return
        }

        isSaving.value = true

        try {
            // Debug logging omitted for brevity in refactor, but logic preserved

            const originalTask = taskStore.tasks.find(t => t.id === editedTask.value.id)
            const originalInstances = originalTask ? getTaskInstances(originalTask) : []

            const hadOriginalSchedule = originalInstances.length > 0 ||
                (originalTask?.scheduledDate && originalTask?.scheduledTime) ||
                (originalTask?.instances && originalTask.instances.length > 0)
            const hasNewSchedule = editedTask.value.scheduledDate && editedTask.value.scheduledTime
            const scheduleExplicitlyRemoved = hadOriginalSchedule && !hasNewSchedule

            const originalCanvasPosition = editedTask.value.canvasPosition ?? props.task?.canvasPosition
            const originalIsInInbox = editedTask.value.isInInbox ?? props.task?.isInInbox

            // BUG-1047 DEBUG: Track position through save flow
            const storeTask = taskStore.tasks.find(t => t.id === editedTask.value.id)
            console.log('🔍 [BUG-1047] Position tracking on save:', {
                taskId: editedTask.value.id.slice(0, 8),
                editedTaskPosition: editedTask.value.canvasPosition,
                propsTaskPosition: props.task?.canvasPosition,
                storeTaskPosition: storeTask?.canvasPosition,
                resolvedOriginalPosition: originalCanvasPosition,
                isInInbox: originalIsInInbox
            })

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

            if (originalCanvasPosition !== undefined) {
                updates.canvasPosition = originalCanvasPosition
                updates.isInInbox = false
            } else if (originalIsInInbox !== undefined) {
                updates.isInInbox = originalIsInInbox
            }

            // Preserve existing instances
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (editedTask.value.instances && (editedTask.value.instances as unknown as any[]).length > 0) {
                updates.instances = editedTask.value.instances
            }

            // Lock position before update
            if (originalCanvasPosition) {
                // Optimistic sync removed
            }

            // Generate recurring instances if enabled
            if (editedTask.value.recurrence?.isEnabled && editedTask.value.recurrence.rule) {
                const startDate = editedTask.value.scheduledDate || editedTask.value.dueDate || new Date().toISOString().split('T')[0]
                const instances = generateRecurringInstances(
                    editedTask.value.id,
                    editedTask.value.recurrence.rule,
                    editedTask.value.recurrence.endCondition,
                    (editedTask.value.recurrence.exceptions || []) as any,
                    new Date(startDate),
                    editedTask.value.scheduledTime,
                    editedTask.value.estimatedDuration
                )
                updates.recurringInstances = instances
                if (updates.recurrence) {
                    (updates.recurrence as any).generatedInstances = instances
                        ; (updates.recurrence as any).lastGenerated = new Date().toISOString()
                }
            }

            // BUG-291 FIX: Use direct updateTask for INSTANT feedback
            // The old flow blocked UI for 2-3 seconds due to:
            // - 3 dynamic imports in updateTaskWithUndo
            // - 2 undo state saves
            // - Instance/subtask operations with same pattern
            // Now we: Update store → Close modal → Background ops
            console.time('⚡ [BUG-291] Task update')

            // BUG-1097 DEBUG: Log what we're about to save including due date
            console.log('🔍 [BUG-1097] About to updateTask with:', {
                taskId: editedTask.value.id.slice(0, 8),
                updatesHasPosition: 'canvasPosition' in updates,
                updatesPosition: updates.canvasPosition,
                dueDate: updates.dueDate
            })

            // BUG-1097 FIX: Ensure dueDate is included in updates
            if (editedTask.value.dueDate !== undefined) {
                updates.dueDate = editedTask.value.dueDate
            }

            // BUG-1206 FIX: Await updateTask to ensure store + sync queue are updated
            // before closing the modal. updateTask no longer rolls back on direct save failure
            // (sync queue retries), so this won't block the UI on network errors.
            await taskStore.updateTask(editedTask.value.id, updates as Partial<Task>)

            // BUG-1097 DEBUG: Log what's in store after update
            const afterUpdate = taskStore.tasks.find(t => t.id === editedTask.value.id)
            console.log('🔍 [BUG-1097] Store after updateTask:', {
                taskId: editedTask.value.id.slice(0, 8),
                storePosition: afterUpdate?.canvasPosition,
                storeDueDate: afterUpdate?.dueDate
            })

            console.timeEnd('⚡ [BUG-291] Task update')

            // BUG-357 FIX: Force canvas sync to update Vue Flow nodes with fresh data
            // This fixes Tauri/WebKitGTK reactivity issue where computed doesn't re-evaluate
            canvasUiStore.requestSync('user:manual')

            // BUG-1097 FIX: Close modal FIRST, then show toast
            // This ensures the modal closes even if toast has issues
            emit('close')
            isSaving.value = false

            // Show success feedback after close
            showToast('Task saved successfully', 'success')

            // === BACKGROUND OPERATIONS (fire-and-forget) ===
            // These run after modal closes - user doesn't wait for them

            // Fire-and-forget: Save undo state in background
            getUndoSystem().saveState('After edit modal save').catch(() => {})

            // Handle instances
            if (editedTask.value.scheduledDate && editedTask.value.scheduledTime) {
                const existingInstances = props.task ? getTaskInstances(props.task) : []
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const sameDayInstance = existingInstances.find((inst: any) =>
                    inst.scheduledDate === editedTask.value.scheduledDate
                )

                if (sameDayInstance) {
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
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    existingInstances.forEach((instance: any) => {
                        taskStore.deleteTaskInstanceWithUndo(editedTask.value.id, instance.id)
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
        }
    }

    return {
        addSubtask,
        deleteSubtask,
        updateSubtaskCompletion,
        resetPomodoros,
        handleScheduledDateChange,
        handleSectionChange,
        saveTask
    }
}
