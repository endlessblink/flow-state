import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../..')
const boardSource = readFileSync(resolve(root, 'src/views/BoardView.vue'), 'utf8')
const sidebarSource = readFileSync(resolve(root, 'src/layouts/AppSidebar.vue'), 'utf8')
const routerSource = readFileSync(resolve(root, 'src/router/index.ts'), 'utf8')
const laneStoreSource = readFileSync(resolve(root, 'src/stores/lanes.ts'), 'utf8')
const timelineSource = readFileSync(resolve(root, 'src/components/kanban/TaskFocusTimeline.vue'), 'utf8')
const timelineStyles = readFileSync(resolve(root, 'src/components/kanban/TaskFocusTimeline.css'), 'utf8')

describe('TASK-2068 focused task timeline', () => {
  it('uses the focused timeline for every visual Board mode while retaining List mode', () => {
    expect(boardSource).toContain("v-if=\"currentViewType === 'list'\"")
    expect(boardSource).toContain('<TaskFocusTimeline')
    expect(boardSource).not.toContain('<KanbanSwimlane')
  })

  it('centers one task with identifiable previous and next tasks', () => {
    expect(timelineSource).toContain('class="task-focus-card task-focus-card--active"')
    expect(timelineSource).toContain('class="task-card task-focus-card task-focus-card--previous"')
    expect(timelineSource).toContain('class="task-card task-focus-card task-focus-card--next"')
    expect(timelineSource).toContain(":aria-label=\"t('kanban.previous_task')\"")
    expect(timelineSource).toContain(":aria-label=\"t('kanban.next_task')\"")
    expect(timelineStyles).toMatch(/\.task-focus-card--active\s*\{[^}]*grid-column:\s*3/s)
  })

  it('supports keyboard navigation and keeps the backlog progressively disclosed', () => {
    expect(timelineSource).toContain('@keydown.left.prevent="movePrevious"')
    expect(timelineSource).toContain('@keydown.right.prevent="moveNext"')
    expect(timelineSource).toContain('visiblePreviousTask')
    expect(timelineSource).toContain('visibleNextTask')
    expect(timelineSource).not.toContain('v-for="task in tasks"')
  })

  it('does not repeat timeline status above the task sequence', () => {
    expect(timelineSource).not.toContain('class="task-focus-heading"')
    expect(timelineSource).not.toContain('class="task-focus-position"')
    expect(timelineSource).toContain('class="task-focus-controls"')
  })

  it('replaces the obsolete sidebar lane entrypoint with a Board-only priority filter', () => {
    expect(sidebarSource).not.toContain('SidebarLanesSection')
    expect(sidebarSource).toContain("route.name === 'board'")
    expect(sidebarSource).toContain('<SidebarPriorityFilter')
    expect(boardSource).toContain('useBoardPriorityFilter')
    expect(routerSource).toContain("path: '/lane/:laneId'")
    expect(laneStoreSource).toMatch(/defineStore\(['"]lanes['"]/)
  })

  it('keeps the full ordering surface hidden until the user requests it', () => {
    expect(timelineSource).toContain('v-if="showReorder"')
    expect(timelineSource).toContain('class="task-focus-reorder-list"')
    expect(timelineSource).toContain('@dragend="finishReorder"')
    expect(timelineSource).toContain('@keydown.alt.left.stop.prevent="moveReorderTask(task.id, -1)"')
    expect(timelineSource).toContain('@keydown.alt.right.stop.prevent="moveReorderTask(task.id, 1)"')
    expect(timelineSource).toContain("reorderTasks: [taskIds: string[]]")
    expect(boardSource).toContain("bulkUpdateTasksWithUndo(updates, 'Reorder focused timeline')")
    expect(boardSource).toContain("boardSortOption.value = 'manual'")
    expect(boardSource).toContain("message.error(t('kanban.reorder_failed'))")
    expect(boardSource).not.toMatch(/updates:\s*\{[^}]*canvasPosition/s)
  })
})
