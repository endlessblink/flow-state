import { type Ref } from 'vue'
import { useTaskStore, type Task, type Subtask } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { generateRecurringInstances } from '@/utils/recurrenceUtils'


// Helper for cleaning task instances (from existing code)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getTaskInstances = (task: Task): any[] => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (task as any).instances || []
}

export function useTaskEditActions(
    props: { task: Task | null },
    emit: (event: 'close') => void,
    editedTask: Ref<Task>,
    isSaving: Ref<boolean>
) {
    const taskStore = useTaskStore()
    const canvasStore = useCanvasStore()


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

            const updates: Record<string, unknown> = {
                title: editedTask.value.title,
                description: editedTask.value.description,
                status: editedTask.value.status,
                priority: editedTask.value.priority,
                dueDate: editedTask.value.dueDate,
                scheduledDate: editedTask.value.scheduledDate,
                scheduledTime: editedTask.value.scheduledTime,
                estimatedDuration: editedTask.value.estimatedDuration,
                recurrence: editedTask.value.recurrence
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

            // BUG-291 FIX: Await the async update operation
            // Update main task
            await taskStore.updateTaskWithUndo(editedTask.value.id, updates)

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

            // Sync Subtasks
            const originalSubtasks = props.task.subtasks || []

            originalSubtasks.forEach(originalSt => {
                const exists = editedTask.value.subtasks.find(st => st.id === originalSt.id)
                if (!exists) {
                    taskStore.deleteSubtaskWithUndo(editedTask.value.id, originalSt.id)
                }
            })

            editedTask.value.subtasks.forEach(subtask => {
                if (originalSubtasks.find(st => st.id === subtask.id)) {
                    taskStore.updateSubtaskWithUndo(editedTask.value.id, subtask.id, subtask)
                } else {
                    taskStore.createSubtaskWithUndo(editedTask.value.id, subtask)
                }
            })

            emit('close')
        } finally {
            isSaving.value = false
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
