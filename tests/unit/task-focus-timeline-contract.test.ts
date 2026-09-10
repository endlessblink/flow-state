import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../..')
const boardSource = readFileSync(resolve(root, 'src/views/BoardView.vue'), 'utf8')
const sidebarSource = readFileSync(resolve(root, 'src/layouts/AppSidebar.vue'), 'utf8')
const routerSource = readFileSync(resolve(root, 'src/router/index.ts'), 'utf8')
const headerSource = readFileSync(resolve(root, 'src/layouts/AppHeader.vue'), 'utf8')
const timelineViewPath = resolve(root, 'src/views/FocusedTimelineView.vue')
const timelineViewSource = existsSync(timelineViewPath) ? readFileSync(timelineViewPath, 'utf8') : ''
const laneStoreSource = readFileSync(resolve(root, 'src/stores/lanes.ts'), 'utf8')
const timelineSource = readFileSync(resolve(root, 'src/components/kanban/TaskFocusTimeline.vue'), 'utf8')
const timelineStyles = readFileSync(resolve(root, 'src/components/kanban/TaskFocusTimeline.css'), 'utf8')

describe('TASK-2068 focused task timeline', () => {
  it('keeps Kanban as the Board surface and mounts the timeline only when explicitly requested', () => {
    expect(boardSource).toContain('<KanbanSwimlane')
    expect(boardSource).not.toContain("v-else-if=\"currentViewType === 'list'\"")
    expect(boardSource).not.toContain("value: 'list' as const")
    expect(boardSource).toContain("currentViewType.value === 'list'")
    expect(boardSource).toContain("currentViewType.value = 'priority'")
    expect(boardSource).toContain('const isTimelineView = computed')
    expect(boardSource).toContain("displayMode: 'board'")
    expect(timelineViewSource).toContain('display-mode="timeline"')
  })

  it('exposes the focused timeline as its own main route and navigation tab', () => {
    expect(routerSource).toContain("path: '/timeline'")
    expect(routerSource).toContain("name: 'focused-timeline'")
    expect(routerSource).toContain("component: () => import('@/views/FocusedTimelineView.vue')")
    expect(headerSource).toContain('to="/timeline"')
    expect(headerSource).toContain("'focused-timeline': t('views.timeline')")
  })

  it('uses recognizable icons with readable labels in the main navigation', () => {
    expect(headerSource).toContain('class="view-tab-icon"')
    expect(headerSource).toContain('class="view-tab-label"')
    expect(headerSource).toContain("$t('views.timeline')")
    expect(headerSource).toContain(':aria-label="$t(\'kanban.focus_timeline\')"')
    expect(headerSource).toMatch(/\.title-main\s*\{[^}]*white-space:\s*nowrap/s)
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
