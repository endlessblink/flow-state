import { ref, watch, nextTick, computed, type Ref } from 'vue'
import { type Task } from '@/stores/tasks'

export function useTaskEditState(
    props: { isOpen: boolean; task: Task | null },
    titleInputRef?: Ref<HTMLInputElement | undefined>
) {
    // Editing state
    const editedTask = ref<Task>({
        id: '',
        title: '',
        description: '',
        status: 'planned',
        priority: 'medium',
        progress: 0,
        completedPomodoros: 0,
        subtasks: [],
        dueDate: '',
        scheduledDate: '',
        scheduledTime: '09:00',
        estimatedDuration: 60,
        projectId: '' as string,
        recurrence: {
            isEnabled: false,
            rule: { pattern: 'none' },
            endCondition: { type: 'never' },
            exceptions: [],
            generatedInstances: []
        } as any,
        createdAt: new Date(),
        updatedAt: new Date()
    })

    // Original task snapshot for dirty checking
    const originalTaskSnapshot = ref<string>('')

    // Progressive disclosure state
    const showDependencies = ref(false)
    const showSubtasks = ref(true)
    const showPomodoros = ref(false)

    // Save-in-progress guard
    const isSaving = ref(false)

    // --- Form Validation ---

    // Check if title is valid (non-empty)
    const isTitleValid = computed((): boolean => {
        return Boolean(editedTask.value.title && editedTask.value.title.trim().length > 0)
    })

    // Form is valid if all required fields pass validation
    const isFormValid = computed(() => {
        return isTitleValid.value
    })

    // --- Form Dirty Tracking ---

    // Create a fingerprint of task data for comparison (excludes volatile fields)
    const createTaskFingerprint = (task: Task): string => {
        return JSON.stringify({
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            dueDate: task.dueDate,
            scheduledDate: task.scheduledDate,
            scheduledTime: task.scheduledTime,
            estimatedDuration: task.estimatedDuration,
            recurrence: task.recurrence,
            subtasks: task.subtasks?.map(st => ({
                id: st.id,
                title: st.title,
                isCompleted: st.isCompleted
            }))
        })
    }

    // Check if form has unsaved changes
    const isFormDirty = computed(() => {
        if (!originalTaskSnapshot.value) return false
        const currentFingerprint = createTaskFingerprint(editedTask.value)
        return currentFingerprint !== originalTaskSnapshot.value
    })

    // Check if form is pristine (no changes made)
    const isFormPristine = computed(() => !isFormDirty.value)

    // Save button should be disabled if form is pristine OR invalid OR currently saving
    const isSaveDisabled = computed(() => {
        return isFormPristine.value || !isFormValid.value || isSaving.value
    })

    // Options
    const priorityOptions = [
        { label: 'Low', value: 'low' },
        { label: 'Medium', value: 'medium' },
        { label: 'High', value: 'high' }
    ]

    const statusOptions = [
        { label: 'Planned', value: 'planned' },
        { label: 'Active', value: 'in_progress' },
        { label: 'Done', value: 'done' },
        { label: 'Backlog', value: 'backlog' }
    ]

    // Watch for task changes to sync local state
    watch(() => props.task, (newTask) => {
        // Guard: If we are saving, ignore external updates
        if (isSaving.value || !newTask) return

        // Fingerprint for change detection
        const currentFingerprint = JSON.stringify({
            ...editedTask.value,
            canvasPosition: undefined,
            updatedAt: undefined
        })

        const newTaskState = {
            ...newTask,
            subtasks: [...(newTask.subtasks || [])]
        }

        const newFingerprint = JSON.stringify({
            ...newTaskState,
            canvasPosition: undefined,
            updatedAt: undefined
        })

        if (editedTask.value.id !== newTask.id || currentFingerprint !== newFingerprint) {
            editedTask.value = newTaskState

            // Store original snapshot for dirty tracking
            originalTaskSnapshot.value = createTaskFingerprint(newTaskState)

            // Auto-expand sections
            showSubtasks.value = (newTask.subtasks || []).length > 0
            showDependencies.value = (newTask.dependsOn && newTask.dependsOn.length > 0) || false
            showPomodoros.value = (newTask.completedPomodoros || 0) > 0

            // Focus title for new tasks
            nextTick(() => {
                if (titleInputRef?.value && newTask.title === 'New Task') {
                    titleInputRef.value.focus()
                    titleInputRef.value.select()
                }
            })
        }
    }, { immediate: true })

    return {
        editedTask,
        isSaving,
        showDependencies,
        showSubtasks,
        showPomodoros,
        priorityOptions,
        statusOptions,
        // Form validation & dirty tracking
        isTitleValid,
        isFormValid,
        isFormDirty,
        isFormPristine,
        isSaveDisabled
    }
}
