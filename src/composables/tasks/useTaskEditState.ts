import { ref, watch, nextTick, computed, type Ref } from 'vue'
import { type Task, useTaskStore } from '@/stores/tasks'
import type { TaskRecurrence } from '@/types/recurrence'

export function useTaskEditState(
    props: { isOpen: boolean; task: Task | null },
    titleInputRef?: Ref<HTMLInputElement | undefined>
) {
    const taskStore = useTaskStore()
    // Editing state
    const editedTask = ref<Task>({
        id: '',
        title: '',
        description: '',
        status: 'todo',
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
        } as TaskRecurrence,
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
                description: st.description,
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

    // TASK-1873 — "this can't get lost again", with exactly ONE fallback:
    // a single local draft of the in-progress description, keyed by task id. It captures
    // text the instant it's typed, survives a reset/crash/reload, and is cleared the moment a
    // save confirms the text reached the server (where the 30-min VPS pg_dump + 5-min local
    // backup take over). There is no second fallback path on purpose.
    const draftKey = (id: string) => `flowstate:desc-draft:${id}`
    const saveDescriptionDraft = (id: string, description: string) => {
        if (!id) return
        try {
            if (description && description.trim()) localStorage.setItem(draftKey(id), description)
            else localStorage.removeItem(draftKey(id))
        } catch { /* storage unavailable — the single fallback degrades silently, no backup path */ }
    }
    const clearDescriptionDraft = (id: string) => {
        try { localStorage.removeItem(draftKey(id)) } catch { /* ignore */ }
    }
    const readDescriptionDraft = (id: string): string | null => {
        try { return localStorage.getItem(draftKey(id)) } catch { return null }
    }

    const markCurrentTaskSaved = () => {
        originalTaskSnapshot.value = createTaskFingerprint(editedTask.value)
        // Text is now persisted server-side; the local fallback is no longer needed.
        clearDescriptionDraft(editedTask.value.id)
    }

    // Persist the draft the instant the description changes (before the 500ms autosave),
    // so a crash/reset in that window can't lose it. Gated on isFormDirty so simply opening a
    // task never writes its already-saved server value back as a draft.
    watch(() => editedTask.value.description, (description) => {
        if (props.isOpen && editedTask.value.id && isFormDirty.value) {
            saveDescriptionDraft(editedTask.value.id, description)
        }
    })

    // Options
    const priorityOptions = [
        { label: 'Immediate', value: 'immediate' },
        { label: 'Low', value: 'low' },
        { label: 'Medium', value: 'medium' },
        { label: 'High', value: 'high' },
        { label: 'Relaxed', value: 'relaxed' }
    ]

    const statusOptions = [
        { label: 'To Do', value: 'todo' },
        { label: 'Done', value: 'done' }
    ]

    // Watch for task changes to sync local state
    watch(() => props.task, (newTask) => {
        // Guard: If we are saving, ignore external updates
        if (isSaving.value || !newTask) return

        // FIX: If user has unsaved edits to THIS task, don't overwrite with sync data.
        // This prevents the LWW writeback or realtime echo from clobbering the user's work.
        if (isFormDirty.value && editedTask.value.id === newTask.id) {
            if (import.meta.env.DEV) {
                console.log(`[TaskEditState] Ignoring sync update for ${newTask.id.slice(0, 8)} — form has unsaved edits`)
            }
            return
        }

        // Fingerprint for change detection
        const currentFingerprint = JSON.stringify({
            ...editedTask.value,
            canvasPosition: undefined,
            updatedAt: undefined
        })

        const newTaskState = {
            ...newTask,
            subtasks: [...(newTask.subtasks || [])],
            // BUG-1097 FIX: Explicitly copy date fields to ensure they're not lost
            dueDate: newTask.dueDate || '',
            scheduledDate: newTask.scheduledDate || '',
            scheduledTime: newTask.scheduledTime || '09:00'
        }

        // BUG-1872 FIX: While the modal owns THIS task, the in-editor description is the
        // source of truth. The markdown converter is not byte-stable (tracked by TASK-1873),
        // so an echo of our own autosave re-injects a normalized copy. Letting it through here
        // changes MarkdownEditor's modelValue, which fires a TipTap setContent that wipes the
        // user's in-progress typing — the "description keeps resetting" loop. Other fields may
        // still update from the echo; only the description is pinned to the editor's value.
        if (props.isOpen && editedTask.value.id === newTask.id) {
            newTaskState.description = editedTask.value.description
        }

        const newFingerprint = JSON.stringify({
            ...newTaskState,
            canvasPosition: undefined,
            updatedAt: undefined
        })

        // BUG-1097 FIX: Always update if IDs match (same task being edited)
        // This ensures external changes to the task are reflected
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
                if (titleInputRef?.value && !newTask.title) {
                    titleInputRef.value.focus()
                    titleInputRef.value.select()
                }
            })
        }
    }, { immediate: true })

    // BUG-1097 FIX: Also watch isOpen to ensure fresh data when modal opens
    watch(() => props.isOpen, (isOpen) => {
        if (isOpen && props.task) {
            // Get FRESH task from store (not the potentially stale props.task)
            const freshTask = taskStore.getTask(props.task.id)
            if (freshTask) {
                const newTaskState = {
                    ...freshTask,
                    subtasks: [...(freshTask.subtasks || [])],
                    dueDate: freshTask.dueDate || '',
                    scheduledDate: freshTask.scheduledDate || '',
                    scheduledTime: freshTask.scheduledTime || '09:00'
                }
                // Snapshot the SERVER value first — a restored draft must read as dirty so
                // autosave re-persists it (otherwise the recovered text would never be saved).
                const serverSnapshot = createTaskFingerprint(newTaskState)

                // TASK-1873: restore an unsaved draft if the app died before the last save.
                // A draft only exists when text was typed but never confirmed-saved, so if it
                // differs from the loaded value it IS the newer, unsaved content — restore it.
                const draft = readDescriptionDraft(freshTask.id)
                if (draft != null && draft !== newTaskState.description) {
                    newTaskState.description = draft
                }

                editedTask.value = newTaskState
                originalTaskSnapshot.value = serverSnapshot

                // Auto-expand sections
                showSubtasks.value = (freshTask.subtasks || []).length > 0
                showDependencies.value = (freshTask.dependsOn && freshTask.dependsOn.length > 0) || false
                showPomodoros.value = (freshTask.completedPomodoros || 0) > 0
            }
        }
    })

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
        isSaveDisabled,
        markCurrentTaskSaved
    }
}
