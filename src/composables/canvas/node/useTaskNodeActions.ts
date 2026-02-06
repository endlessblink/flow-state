import { ref } from 'vue'
import type { Task } from '@/types/tasks'
import type { CanvasGroup } from '@/types/canvas'
import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { useCanvasUiStore } from '@/stores/canvas/canvasUi'
import { formatDateKey } from '@/utils/dateUtils'
import { detectPowerKeyword } from '@/composables/usePowerKeywords'

// TASK-289: Map reschedule options to Smart Group keywords
const DATE_TYPE_TO_KEYWORDS: Record<string, string[]> = {
    'today': ['today'],
    'tomorrow': ['tomorrow'],
    'this_weekend': ['this weekend', 'saturday', 'weekend'],
    'next_week': ['next week', 'monday']
}

export function useTaskNodeActions(
    props: {
        task: Task;
        isSelected?: boolean;
        isConnecting?: boolean;
        isDragging?: boolean;
        // TASK-262: Callback prop for selection - bypasses Vue's broken emit in Vue Flow
        selectCallback?: (task: Task, multiSelect: boolean) => void;
        // TASK-279: Callback prop for edit - bypasses Vue's broken emit in Vue Flow
        editCallback?: (task: Task) => void;
    },
    emit: {
        (e: 'edit', task: Task): void;
        (e: 'select', task: Task, multiSelect: boolean): void;
        (e: 'contextMenu', event: MouseEvent, task: Task): void;
    }
) {
    const taskStore = useTaskStore()

    // TASK-279: Manual double-click detection
    // Native dblclick doesn't work because DOM changes between clicks (selection indicator appears)
    const DOUBLE_CLICK_THRESHOLD = 350 // ms
    let lastClickTime = 0
    let lastClickTaskId: string | null = null

    // Description expansion state
    const isDescriptionExpanded = ref(false)
    const DESCRIPTION_MAX_LENGTH = 100

    // Check if description is long enough for truncation
    const isDescriptionLong = (description?: string) => {
        return description && description.length > DESCRIPTION_MAX_LENGTH
    }

    // Toggle description expansion
    const toggleDescriptionExpanded = () => {
        isDescriptionExpanded.value = !isDescriptionExpanded.value
    }

    // TASK-075: Checkbox interactivity logic
    const handleCheckboxClick = (clickedIndex: number) => {
        const description = props.task?.description || ''
        const checkboxPattern = /- \[([ x])\]/g
        const matches = [...description.matchAll(checkboxPattern)]

        if (clickedIndex >= 0 && clickedIndex < matches.length) {
            let currentIndex = 0
            const newDescription = description.replace(checkboxPattern, (match) => {
                if (currentIndex === clickedIndex) {
                    currentIndex++
                    return match === '- [ ]' ? '- [x]' : '- [ ]'
                }
                currentIndex++
                return match
            })
            taskStore.updateTask(props.task.id, { description: newDescription })
        }
    }

    // TASK-262: Helper to call selection - uses callback prop if available, falls back to emit
    const triggerSelect = (task: Task, multiSelect: boolean) => {
        if (props.selectCallback) {
            // Use callback prop (works in Vue Flow custom nodes)
            props.selectCallback(task, multiSelect)
        } else {
            // Fallback to emit (works outside Vue Flow)
            emit('select', task, multiSelect)
        }
    }

    // TASK-279: Helper to call edit - uses callback prop if available, falls back to emit
    // BUG-357 FIX: Always get fresh task from store instead of using potentially stale props.task
    const triggerEdit = (task: Task) => {
        // Get fresh task from store (source of truth) instead of stale node data
        const freshTask = taskStore.tasks.find(t => t.id === task.id) || task

        // BUG-1206 DEBUG: Log description when opening edit
        console.log('🐛 [BUG-1206] TRIGGER EDIT - description from store:', {
            taskId: freshTask.id?.slice(0, 8),
            descLength: freshTask.description?.length,
            descPreview: freshTask.description?.slice(0, 50),
            usedFallback: !taskStore.tasks.find(t => t.id === task.id)
        })

        if (props.editCallback) {
            // Use callback prop (works in Vue Flow custom nodes)
            props.editCallback(freshTask)
        } else {
            // Fallback to emit (works outside Vue Flow)
            emit('edit', freshTask)
        }
    }

    // Interaction Handlers
    const handleClick = (event: MouseEvent) => {
        if (!props.task) return

        const now = Date.now()
        const timeSinceLastClick = now - lastClickTime
        const isSameTask = lastClickTaskId === props.task.id

        // TASK-279: Manual double-click detection
        // Check if this is a double-click (same task, within threshold)
        const isDoubleClick = isSameTask && timeSinceLastClick < DOUBLE_CLICK_THRESHOLD

        // Debug logging removed - uncomment if needed for debugging
        // console.log('[DEBUG] TaskNode Click', { id: props.task.id, timeSinceLastClick, isDoubleClick })

        // Update last click tracking
        lastClickTime = now
        lastClickTaskId = props.task.id

        // TASK-279: Handle double-click - open edit modal
        if (isDoubleClick && !props.isConnecting) {
            event.stopPropagation()
            triggerEdit(props.task)
            // Reset tracking to prevent triple-click issues
            lastClickTime = 0
            lastClickTaskId = null
            return
        }

        // BUG-007 + BUG-FIX: Ctrl/Cmd OR Shift triggers multi-select toggle
        const isMultiSelectClick = event.ctrlKey || event.metaKey || event.shiftKey

        // Prevent edit modal when connecting to avoid conflicts
        if (props.isConnecting) {
            triggerSelect(props.task, isMultiSelectClick)
            return
        }

        // Ctrl/Cmd+click toggles selection (for multi-select)
        // CRITICAL: stopPropagation prevents Vue Flow from processing this click
        // and overriding our custom multi-select behavior
        if (isMultiSelectClick) {
            event.stopPropagation()
            triggerSelect(props.task, true)
            return
        }

        // Single click on unselected task - trigger selection
        triggerSelect(props.task, false)
    }

    const handleContextMenu = (event: MouseEvent) => {
        if (!props.task) return

        // Don't show context menu if we're currently dragging or connecting
        // Note: This relies on props.isDragging which comes from the parent
        if (props.isDragging) {
            event.preventDefault()
            event.stopPropagation()
            return
        }

        emit('contextMenu', event, props.task)
    }

    const handleMouseDown = (event: MouseEvent) => {
        // BUG-MIX: Stop propagation on Shift+Mousedown to prevent Vue Flow Box Selection
        if (event.shiftKey) {
            event.stopPropagation()
            // Toggle selection logic immediately
            triggerSelect(props.task, true) // Force multi-select toggle
        }
    }

    // TASK-289: Find a Smart Group by date type keyword
    const findSmartGroupByDateType = (dateType: string): CanvasGroup | undefined => {
        const canvasStore = useCanvasStore()
        const keywords = DATE_TYPE_TO_KEYWORDS[dateType] || []

        return canvasStore.groups.find(group => {
            const powerInfo = detectPowerKeyword(group.name)
            if (!powerInfo || powerInfo.category !== 'date') return false
            return keywords.includes(powerInfo.value.toLowerCase())
        })
    }

    // TASK-289: Move task to a Smart Group with position update
    const moveTaskToSmartGroup = (taskId: string, group: CanvasGroup) => {
        // Skip if already in this group
        const task = taskStore.tasks.find(t => t.id === taskId)
        if (!task || task.parentId === group.id) return

        // Calculate position inside group (offset from group position)
        const PADDING = 20
        const HEADER_HEIGHT = 60
        const newPosition = {
            x: group.position.x + PADDING,
            y: group.position.y + HEADER_HEIGHT
        }

        console.log(`📍 [TASK-289] Moving task "${task.title}" to group "${group.name}" at (${newPosition.x}, ${newPosition.y})`)

        // Update task with geometry change (user-initiated = allowed per SOP-002)
        // Fire without await - UI updates immediately via Pinia reactivity
        taskStore.updateTask(taskId, {
            parentId: group.id,
            canvasPosition: newPosition
        }, 'USER')
    }

    // Clear "Done for now" badge by resetting doneForNowUntil
    const handleClearDoneForNow = () => {
        if (!props.task) return
        console.log(`🗑️ Clearing "Done for now" badge for task "${props.task.title}"`)
        taskStore.updateTask(props.task.id, { doneForNowUntil: undefined }, 'USER')
    }

    // TASK-282: Reschedule overdue task (sync - fires updates without waiting)
    const handleReschedule = (dateType: string) => {
        if (!props.task) return

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        let newDueDate: string | null = null

        switch (dateType) {
            case 'today':
                newDueDate = formatDateKey(today)
                break
            case 'tomorrow': {
                const tomorrow = new Date(today)
                tomorrow.setDate(today.getDate() + 1)
                newDueDate = formatDateKey(tomorrow)
                break
            }
            case 'this_weekend': {
                // Find next Saturday
                const saturday = new Date(today)
                const daysUntilSaturday = (6 - today.getDay() + 7) % 7 || 7
                saturday.setDate(today.getDate() + daysUntilSaturday)
                newDueDate = formatDateKey(saturday)
                break
            }
            case 'next_week': {
                // Find next Monday
                const monday = new Date(today)
                const daysUntilMonday = (1 - today.getDay() + 7) % 7 || 7
                monday.setDate(today.getDate() + daysUntilMonday)
                newDueDate = formatDateKey(monday)
                break
            }
            case 'pick_date':
                // For "pick a date", open the edit modal
                triggerEdit(props.task)
                return
        }

        if (newDueDate) {
            console.log(`📅 [TASK-282] Rescheduling task "${props.task.title}" to ${newDueDate}`)

            // TASK-289: Find target group BEFORE updating (while task still has old parentId)
            const targetGroup = findSmartGroupByDateType(dateType)

            // Use updateTask directly (not updateTaskWithUndo) for INSTANT UI update
            // updateTaskWithUndo has saveState/dynamic imports that cause delay
            taskStore.updateTask(props.task.id, { dueDate: newDueDate }, 'USER')

            // Move to matching Smart Group if exists
            if (targetGroup) {
                moveTaskToSmartGroup(props.task.id, targetGroup)
            }

            // TASK-289: Force immediate canvas sync to update the node display
            // updateTask doesn't trigger sync (by design to avoid loops), so we trigger manually
            const canvasUiStore = useCanvasUiStore()
            canvasUiStore.requestSync('user:context-menu')
        }
    }

    return {
        isDescriptionExpanded,
        isDescriptionLong,
        toggleDescriptionExpanded,
        handleCheckboxClick,
        handleClick,
        handleMouseDown,
        handleContextMenu,
        handleReschedule, // TASK-282
        handleClearDoneForNow,
        triggerEdit
    }
}
