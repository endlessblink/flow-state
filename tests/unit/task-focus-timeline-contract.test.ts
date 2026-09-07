import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../..')
const boardSource = readFileSync(resolve(root, 'src/views/BoardView.vue'), 'utf8')
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
})
