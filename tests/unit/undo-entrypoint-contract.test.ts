import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const projectRoot = resolve(__dirname, '../..')

const readSource = (relativePath: string) =>
  readFileSync(resolve(projectRoot, relativePath), 'utf8')

describe('undo-aware modal and context-menu entry points', () => {
  it('keeps TaskContextMenu user mutations on undo-aware APIs', () => {
    const source = readSource('src/components/tasks/TaskContextMenu.vue')

    expect(source).toContain('await taskStore.updateTaskWithUndo(currentTask.value.id, { isPinned:')
    expect(source).toContain('await taskStore.updateTaskWithUndo(currentTask.value.id, { calendarLocked:')
    expect(source).toContain("await taskStore.updateTaskWithUndo(taskId, { status: 'done' })")
    expect(source).toContain('await taskStore.createTaskWithUndo({')

    expect(source).not.toContain('await taskStore.updateTask(currentTask.value.id, { isPinned:')
    expect(source).not.toContain('await taskStore.updateTask(currentTask.value.id, { calendarLocked:')
    expect(source).not.toContain("await taskStore.moveTask(taskId, 'done')")
    expect(source).not.toContain('await taskStore.createTask({\n      title: t.title')
  })

  it('keeps recurrence modal delete and canvas-remove paths undo-aware', () => {
    const source = readSource('src/layouts/ModalManager.vue')

    expect(source).toContain('await getUndoSystem().permanentlyDeleteTaskWithUndo(taskId)')
    expect(source).toContain('await getUndoSystem().bulkMoveToInboxWithUndo([taskId])')

    expect(source).not.toContain('await taskStore.permanentlyDeleteTask(taskId)')
    expect(source).not.toContain('await taskStore.updateTask(taskId, {\n      canvasPosition: undefined')
  })

  it('keeps Kanban drop mutations on undo-aware APIs', () => {
    const source = readSource('src/components/kanban/KanbanColumn.vue')

    expect(source).toContain('await taskStore.updateTaskWithUndo(taskId, {')
    expect(source).not.toContain('await taskStore.updateTask(taskId, { isInInbox: false })')
    expect(source).not.toContain('taskStore.moveTaskToProject(taskId')
    expect(source).not.toContain('taskStore.moveTaskToPriority(taskId')
    expect(source).not.toContain('taskStore.moveTaskToDate(taskId')
  })

  it('keeps Board list-mode task mutations on undo-aware APIs', () => {
    const source = readSource('src/views/BoardView.vue')

    expect(source).toContain('return taskStore.updateTaskWithUndo(taskId, {')
    expect(source).toContain('await taskStore.updateTaskWithUndo(taskId, { status: newStatus })')
    expect(source).not.toContain('return taskStore.updateTask(taskId, {')
    expect(source).not.toContain('taskStore.updateTask(taskId, updates)')
    expect(source).not.toContain('await taskStore.updateTask(taskId, { status: newStatus })')
  })

  it('keeps All Tasks create, inline update, complete, and move entry points undo-aware', () => {
    const source = readSource('src/views/AllTasksView.vue')

    expect(source).toContain('const { bulkDeleteTasksWithUndo, createTaskWithUndo, updateTaskWithUndo } = useUnifiedUndoRedo()')
    expect(source).toContain('await createTaskWithUndo({')
    expect(source).toContain('await updateTaskWithUndo(taskId, { status: newStatus })')
    expect(source).toContain('await updateTaskWithUndo(taskId, updates)')
    expect(source).not.toContain('await taskStore.createTask({')
    expect(source).not.toContain('await taskStore.updateTask(taskId, updates)')
    expect(source).not.toContain('await taskStore.updateTask(taskId, { status: newStatus })')
  })

  it('keeps Batch Edit task updates atomic and undo-aware', () => {
    const source = readSource('src/components/tasks/BatchEditModal.vue')

    expect(source).toContain('await undoSystem.bulkUpdateTasksWithUndo(')
    expect(source).not.toContain('await taskStore.updateTask(taskId, { status:')
    expect(source).not.toContain('await taskStore.updateTask(taskId, { priority:')
    expect(source).not.toContain('await taskStore.updateTask(taskId, updates)')
  })

  it('keeps direct task edit and quick-create entry points undo-aware', () => {
    const editActions = readSource('src/composables/tasks/useTaskEditActions.ts')
    const quickCreate = readSource('src/components/tasks/QuickTaskCreate.vue')
    const commandPalette = readSource('src/components/layout/CommandPalette.vue')

    expect(editActions).toContain('await taskStore.updateTaskWithUndo(editedTask.value.id, updates as Partial<Task>)')
    expect(editActions).not.toContain('getUndoSystem().saveState(')
    expect(editActions).not.toContain('await taskStore.updateTask(editedTask.value.id, updates as Partial<Task>)')

    expect(quickCreate).toContain('await taskStore.createTaskWithUndo({')
    expect(quickCreate).not.toContain('await taskStore.createTask({')

    expect(commandPalette).toContain('await taskStore.createTaskWithUndo(newTask)')
    expect(commandPalette).not.toContain('await taskStore.createTask(newTask)')
  })

  it('keeps small inline task edits undo-aware', () => {
    const quickSort = readSource('src/views/QuickSortView.vue')
    const badges = readSource('src/components/kanban/card/TaskCardBadges.vue')
    const taskNode = readSource('src/components/canvas/TaskNode.vue')
    const taskCardActions = readSource('src/composables/tasks/card/useTaskCardActions.ts')
    const taskAssignment = readSource('src/composables/workspace/useTaskAssignment.ts')

    expect(quickSort).toContain('await taskStore.updateTaskWithUndo(currentTask.value.id, updates)')
    expect(quickSort).not.toContain('await taskStore.updateTask(currentTask.value.id, updates)')

    expect(badges).toContain('await taskStore.updateTaskWithUndo(props.task.id, { estimatedDuration: duration })')
    expect(badges).not.toContain('await taskStore.updateTask(props.task.id, { estimatedDuration: duration })')

    expect(taskNode).toContain('await taskStore.updateTaskWithUndo(currentTask.id, { estimatedDuration: duration })')
    expect(taskNode).not.toContain("await taskStore.updateTask(currentTask.id, { estimatedDuration: duration }, 'USER')")

    expect(taskCardActions).toContain('taskStore.updateTaskWithUndo(props.task.id, { status: nextStatus })')
    expect(taskCardActions).not.toContain('taskStore.updateTask(props.task.id, { status: nextStatus })')

    expect(taskAssignment).toContain('await taskStore.updateTaskWithUndo(taskId, { assignedTo: userId ?? null })')
    expect(taskAssignment).not.toContain('await taskStore.updateTask(taskId, { assignedTo: userId ?? null })')
  })

  it('keeps quick task creation and mini-canvas edits undo-aware', () => {
    const quickTasks = readSource('src/composables/useQuickTasks.ts')
    const morningQuickCapture = readSource('src/components/morning-dashboard/MorningQuickCapture.vue')
    const bigThree = readSource('src/components/morning-dashboard/BigThreeCard.vue')
    const miniCanvas = readSource('src/composables/mini-canvas/useMiniCanvasActions.ts')

    expect(quickTasks).toContain('await taskStore.createTaskWithUndo({')
    expect(quickTasks).toContain('await taskStore.updateTaskWithUndo(existing.id, { isPinned: true })')
    expect(quickTasks).toContain('await taskStore.updateTaskWithUndo(taskId, { isPinned: false })')
    expect(quickTasks).not.toContain('await taskStore.createTask({')
    expect(quickTasks).not.toContain('await taskStore.updateTask(existing.id, { isPinned: true })')

    expect(morningQuickCapture).toContain("await taskStore.createTaskWithUndo({ title: trimmed, status: 'todo' })")
    expect(morningQuickCapture).not.toContain("await taskStore.createTask({ title: trimmed, status: 'todo' })")

    expect(bigThree).toContain("await taskStore.createTaskWithUndo({ title, dueDate: todayStr, status: 'todo' })")
    expect(bigThree).not.toContain("await taskStore.createTask({ title, dueDate: todayStr, status: 'todo' })")

    expect(miniCanvas).toContain('taskStore.updateTaskWithUndo(task.id, { subtasks: updated } as Partial<Task>)')
    expect(miniCanvas).toContain('taskStore.updateTaskWithUndo(task.id, { planningNotes: updated } as Partial<Task>)')
    expect(miniCanvas).toContain('taskStore.updateTaskWithUndo(task.id, { miniCanvasEdges: [...existing, edge] } as Partial<Task>)')
    expect(miniCanvas).not.toContain('taskStore.updateTask(task.id,')
  })

  it('keeps calendar scheduling, resizing, and date moves undo-aware', () => {
    const dayView = readSource('src/composables/calendar/useCalendarDayView.ts')
    const weekView = readSource('src/composables/calendar/useCalendarWeekView.ts')
    const monthView = readSource('src/composables/calendar/useCalendarMonthView.ts')
    const vueCalView = readSource('src/views/CalendarViewVueCal.vue')
    const calendarCore = readSource('src/composables/useCalendarCore.ts')
    const contextMenuActions = readSource('src/composables/tasks/useTaskContextMenuActions.ts')

    expect(dayView).toContain('await taskStore.updateTaskWithUndo(taskId, updates)')
    expect(dayView).toContain('await taskStore.updateTaskWithUndo(taskId, {')
    expect(dayView).toContain('await taskStore.createTaskWithUndo({')
    expect(dayView).not.toContain('await taskStore.updateTask(taskId, { isInInbox: false })')
    expect(dayView).not.toContain('taskStore.createTask({')
    expect(dayView).not.toContain('taskStore.updateTaskInstance(calendarEvent.taskId')

    expect(weekView).toContain('await taskStore.updateTaskWithUndo(taskId, {')
    expect(weekView).toContain('await taskStore.createTaskWithUndo({')
    expect(weekView).not.toContain('taskStore.createTask({')
    expect(weekView).not.toContain('taskStore.updateTaskInstance(calendarEvent.taskId')

    expect(monthView).toContain('await taskStore.updateTaskWithUndo(taskId, {')
    expect(monthView).not.toContain('await taskStore.updateTask(taskId, {')

    expect(vueCalView).toContain('await taskStore.updateTaskWithUndo(event.id, {')
    expect(vueCalView).not.toContain('await taskStore.updateTask(event.id, {')

    expect(calendarCore).toContain('await taskStore.updateTaskWithUndo(task.id, {')
    expect(calendarCore).not.toContain('await taskStore.moveTask(task.id, nextStatus)')
    expect(calendarCore).not.toContain('taskStore.updateTaskInstance(calendarEvent.taskId')

    expect(contextMenuActions).toContain('await updateDueDateWithCalendarInstance(taskId,')
    expect(contextMenuActions).not.toContain('await taskStore.updateTaskInstance(taskId, calendarInstanceId')
  })

  it('keeps drag reorder persistence atomic and undo-aware', () => {
    const kanbanColumn = readSource('src/components/kanban/KanbanColumn.vue')
    const taskList = readSource('src/components/tasks/TaskList.vue')

    expect(kanbanColumn).toContain("await taskStore.bulkUpdateTasksWithUndo(orderUpdates, 'Reorder kanban column')")
    expect(kanbanColumn).not.toContain('taskStore.updateTask(task.id, { order: index })')

    expect(taskList).toContain("await taskStore.bulkUpdateTasksWithUndo(orderUpdates, 'Reorder task group')")
    expect(taskList).not.toContain('taskStore.updateTask(t.id, { order: i })')
  })
})
