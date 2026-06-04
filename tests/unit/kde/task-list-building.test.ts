/**
 * TASK-1655: KDE Task List Building Tests (10 tests)
 *
 * Tests the buildNannyTaskList / _buildNannyTaskListFromTasks logic
 * from main.qml, extracted as pure JavaScript functions.
 *
 * The nanny task list:
 * 1. Adds pinned tasks first
 * 2. Fills remaining with tasks due today
 * 3. Groups by project with header injection
 * 4. Caps at 15 items
 * 5. Excludes done and hidden tasks
 */
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Type definitions matching the QML data structures
// ---------------------------------------------------------------------------

interface KdeTask {
  id: string
  title: string
  project_id?: string
  priority?: 'high' | 'medium' | 'low' | ''
  due_date?: string
  status?: string
}

interface PinnedTask {
  id: string
  title: string
  project_id?: string
  priority?: 'high' | 'medium' | 'low' | ''
  due_date?: string
  status?: string
}

interface ProjectInfo {
  name: string
  color: string
}

interface NannyTaskItem {
  title: string
  taskId: string
  pinId: string
  isPinned: boolean
  source: string
  projectName: string
  projectColor: string
  priority: string
  priorityLabel: string
  priorityColor: string
  dueDate: string
  isHeader?: boolean
}

interface NannyListContext {
  pinnedTasks: PinnedTask[]
  projects: Record<string, ProjectInfo>
  nannyHiddenToday: Record<string, boolean>
  workColor: string // teal, #4ECDC4
  mutedColor: string
}

// ---------------------------------------------------------------------------
// Pure JS extraction of _buildNannyTaskListFromTasks from main.qml
// ---------------------------------------------------------------------------

function priorityLabel(p: string | undefined): string {
  if (p === 'high') return 'P1'
  if (p === 'medium') return 'P2'
  if (p === 'low') return 'P3'
  return ''
}

function priorityColor(p: string | undefined, mutedColor: string): string {
  if (p === 'high') return '#FF6B6B'
  if (p === 'medium') return '#FFD93D'
  if (p === 'low') return '#6BCB77'
  return mutedColor
}

function buildNannyTaskListFromTasks(
  allTasks: KdeTask[],
  context: NannyListContext,
  todayStr: string // YYYY-MM-DD
): NannyTaskItem[] {
  const combined: NannyTaskItem[] = []
  const pinnedTitles: Record<string, boolean> = {}
  const maxItems = 15

  function getProjectInfo(projectId?: string): ProjectInfo {
    if (!projectId || !context.projects[projectId]) return { name: '', color: '' }
    return context.projects[projectId]
  }

  // 1. Add pinned tasks first
  for (let i = 0; i < context.pinnedTasks.length && combined.length < maxItems; i++) {
    const pin = context.pinnedTasks[i]
    if (pin.status === 'done') continue
    if (context.nannyHiddenToday[pin.id]) continue

    const proj = getProjectInfo(pin.project_id || '')
    const prio = pin.priority || ''
    const dueDate = pin.due_date || ''

    combined.push({
      title: pin.title,
      taskId: pin.id,
      pinId: pin.id,
      isPinned: true,
      source: 'pinned',
      projectName: proj.name,
      projectColor: proj.color,
      priority: prio,
      priorityLabel: priorityLabel(prio),
      priorityColor: priorityColor(prio, context.mutedColor),
      dueDate: dueDate
    })
    pinnedTitles[pin.title.toLowerCase()] = true
  }

  // 2. Fill remaining with tasks due today
  if (combined.length < maxItems && allTasks.length > 0) {
    for (let j = 0; j < allTasks.length && combined.length < maxItems; j++) {
      const task = allTasks[j]
      if (!task || !task.title) continue
      if (pinnedTitles[task.title.toLowerCase()]) continue
      if (task.status === 'done') continue
      if (context.nannyHiddenToday[task.id]) continue
      if (!task.due_date) continue
      const dueDateStr = task.due_date.substring(0, 10)
      if (dueDateStr !== todayStr) continue

      const tProj = getProjectInfo(task.project_id)

      combined.push({
        title: task.title,
        taskId: task.id,
        pinId: '',
        isPinned: false,
        source: 'recent',
        projectName: tProj.name,
        projectColor: tProj.color,
        priority: task.priority || '',
        priorityLabel: priorityLabel(task.priority),
        priorityColor: priorityColor(task.priority, context.mutedColor),
        dueDate: task.due_date || ''
      })
    }
  }

  // 3. Sort by project name (empty = "No Project" goes last)
  combined.sort((a, b) => {
    const pA = a.projectName || ''
    const pB = b.projectName || ''
    if (pA === '' && pB !== '') return 1
    if (pA !== '' && pB === '') return -1
    if (pA < pB) return -1
    if (pA > pB) return 1
    return 0
  })

  // 4. Inject header items
  const grouped: NannyTaskItem[] = []
  let lastProject: string | null = null
  for (const item of combined) {
    const projName = item.projectName || ''
    const projColor = item.projectColor || ''
    const groupKey = projName || '__no_project__'
    if (groupKey !== lastProject) {
      grouped.push({
        isHeader: true,
        projectName: projName || '\u26A1 Quick Tasks', // ⚡
        projectColor: projColor
      } as NannyTaskItem)
      lastProject = groupKey
    }
    grouped.push(item)
  }

  return grouped
}

// ---------------------------------------------------------------------------
// Helper to create test context
// ---------------------------------------------------------------------------

function defaultContext(): NannyListContext {
  return {
    pinnedTasks: [],
    projects: {},
    nannyHiddenToday: {},
    workColor: '#4ECDC4',
    mutedColor: '#888888'
  }
}

const TODAY = '2025-01-06'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TASK-1655: KDE Task List Building', () => {
  it('1. Empty task list produces empty output', () => {
    const result = buildNannyTaskListFromTasks([], defaultContext(), TODAY)
    expect(result).toEqual([])
  })

  it('2. Tasks grouped by project (headers injected)', () => {
    const tasks: KdeTask[] = [
      { id: 't1', title: 'Task A', project_id: 'p1', due_date: `${TODAY}T10:00:00Z` },
      { id: 't2', title: 'Task B', project_id: 'p1', due_date: `${TODAY}T10:00:00Z` },
      { id: 't3', title: 'Task C', project_id: 'p2', due_date: `${TODAY}T10:00:00Z` },
    ]
    const ctx = {
      ...defaultContext(),
      projects: {
        p1: { name: 'Work', color: '#FF0000' },
        p2: { name: 'Personal', color: '#00FF00' }
      }
    }

    const result = buildNannyTaskListFromTasks(tasks, ctx, TODAY)

    // Should have headers for each project group
    const headers = result.filter(item => item.isHeader)
    expect(headers.length).toBe(2) // Work, Personal

    // Headers should appear before their tasks
    const workHeaderIdx = result.findIndex(i => i.isHeader && i.projectName === 'Personal')
    const personalTaskIdx = result.findIndex(i => i.title === 'Task C')
    expect(workHeaderIdx).toBeLessThan(personalTaskIdx)
  })

  it('3. "No Project" tasks labeled as "⚡ Quick Tasks"', () => {
    const tasks: KdeTask[] = [
      { id: 't1', title: 'Quick task', due_date: `${TODAY}T10:00:00Z` }, // no project_id
    ]

    const result = buildNannyTaskListFromTasks(tasks, defaultContext(), TODAY)

    const headers = result.filter(item => item.isHeader)
    expect(headers.length).toBe(1)
    expect(headers[0].projectName).toContain('Quick Tasks')
  })

  it('4. Quick Tasks dot uses muted color (no project color)', () => {
    const tasks: KdeTask[] = [
      { id: 't1', title: 'No project task', due_date: `${TODAY}T10:00:00Z` },
    ]

    const result = buildNannyTaskListFromTasks(tasks, defaultContext(), TODAY)

    const header = result.find(item => item.isHeader)
    expect(header).toBeDefined()
    // No project color — the header gets empty projectColor
    expect(header!.projectColor).toBe('')
  })

  it('5. Pinned tasks appear first', () => {
    const tasks: KdeTask[] = [
      { id: 't1', title: 'Regular task', project_id: 'p1', due_date: `${TODAY}T10:00:00Z` },
      { id: 't2', title: 'Pinned task', project_id: 'p1', due_date: `${TODAY}T10:00:00Z` },
    ]
    const ctx = {
      ...defaultContext(),
      pinnedTasks: [{ id: 'pin1', title: 'Pinned task', project_id: 'p1' }],
      projects: { p1: { name: 'Work', color: '#FF0000' } }
    }

    const result = buildNannyTaskListFromTasks(tasks, ctx, TODAY)

    // Find non-header items
    const taskItems = result.filter(item => !item.isHeader)
    expect(taskItems.length).toBeGreaterThanOrEqual(1)

    // The pinned task item should have isPinned=true
    const pinnedItem = taskItems.find(item => item.isPinned)
    expect(pinnedItem).toBeDefined()
    expect(pinnedItem!.title).toBe('Pinned task')
  })

  it('6. Max 15 items enforced', () => {
    // Create 20 tasks due today
    const tasks: KdeTask[] = Array.from({ length: 20 }, (_, i) => ({
      id: `t${i}`,
      title: `Task ${i}`,
      due_date: `${TODAY}T10:00:00Z`
    }))

    const result = buildNannyTaskListFromTasks(tasks, defaultContext(), TODAY)

    // Non-header items should be <= 15
    const taskItems = result.filter(item => !item.isHeader)
    expect(taskItems.length).toBeLessThanOrEqual(15)
  })

  it('7. Hidden tasks (nannyHiddenToday) excluded', () => {
    const tasks: KdeTask[] = [
      { id: 't1', title: 'Visible task', due_date: `${TODAY}T10:00:00Z` },
      { id: 't2', title: 'Hidden task', due_date: `${TODAY}T10:00:00Z` },
    ]
    const ctx = {
      ...defaultContext(),
      nannyHiddenToday: { t2: true }
    }

    const result = buildNannyTaskListFromTasks(tasks, ctx, TODAY)

    const taskItems = result.filter(item => !item.isHeader)
    expect(taskItems.length).toBe(1)
    expect(taskItems[0].title).toBe('Visible task')
  })

  it('8. Done tasks excluded', () => {
    const tasks: KdeTask[] = [
      { id: 't1', title: 'Active task', status: 'planned', due_date: `${TODAY}T10:00:00Z` },
      { id: 't2', title: 'Done task', status: 'done', due_date: `${TODAY}T10:00:00Z` },
    ]

    const result = buildNannyTaskListFromTasks(tasks, defaultContext(), TODAY)

    const taskItems = result.filter(item => !item.isHeader)
    expect(taskItems.length).toBe(1)
    expect(taskItems[0].title).toBe('Active task')
  })

  it('8. Done pinned tasks are excluded even if the pinned cache is stale', () => {
    const ctx = {
      ...defaultContext(),
      pinnedTasks: [
        { id: 'p1', title: 'Completed pin', status: 'done' },
        { id: 'p2', title: 'Active pin', status: 'planned' },
      ]
    }

    const result = buildNannyTaskListFromTasks([], ctx, TODAY)

    const taskItems = result.filter(item => !item.isHeader)
    expect(taskItems.length).toBe(1)
    expect(taskItems[0].title).toBe('Active pin')
  })

  it('8. Hidden pinned tasks are excluded even if they are still present in the pinned cache', () => {
    const ctx = {
      ...defaultContext(),
      pinnedTasks: [
        { id: 'p1', title: 'Completed from popup', status: 'planned' },
        { id: 'p2', title: 'Still active', status: 'planned' },
      ],
      nannyHiddenToday: { p1: true }
    }

    const result = buildNannyTaskListFromTasks([], ctx, TODAY)

    const taskItems = result.filter(item => !item.isHeader)
    expect(taskItems.length).toBe(1)
    expect(taskItems[0].title).toBe('Still active')
  })

  it('8. Completed task is excluded from both stale pinned and unfiltered nanny task caches', () => {
    const tasks: KdeTask[] = [
      { id: 't1', title: 'Done in popup', status: 'done', due_date: `${TODAY}T10:00:00Z` },
      { id: 't2', title: 'Active today', status: 'planned', due_date: `${TODAY}T10:00:00Z` },
    ]
    const ctx = {
      ...defaultContext(),
      pinnedTasks: [
        { id: 't1', title: 'Done in popup', status: 'done', due_date: `${TODAY}T10:00:00Z` },
      ]
    }

    const result = buildNannyTaskListFromTasks(tasks, ctx, TODAY)

    const taskItems = result.filter(item => !item.isHeader)
    expect(taskItems.map(item => item.title)).toEqual(['Active today'])
  })

  it('8. Pinned task suppresses the matching recent task so a task cannot reappear twice', () => {
    const tasks: KdeTask[] = [
      { id: 't1', title: 'Pinned duplicate', status: 'planned', due_date: `${TODAY}T10:00:00Z` },
    ]
    const ctx = {
      ...defaultContext(),
      pinnedTasks: [
        { id: 't1', title: 'Pinned duplicate', status: 'planned', due_date: `${TODAY}T10:00:00Z` },
      ]
    }

    const result = buildNannyTaskListFromTasks(tasks, ctx, TODAY)

    const taskItems = result.filter(item => !item.isHeader)
    expect(taskItems.length).toBe(1)
    expect(taskItems[0].source).toBe('pinned')
  })

  it('9. Today-only filter: only due_date=today included', () => {
    const tasks: KdeTask[] = [
      { id: 't1', title: 'Today task', due_date: `${TODAY}T10:00:00Z` },
      { id: 't2', title: 'Tomorrow task', due_date: '2025-01-07T10:00:00Z' },
      { id: 't3', title: 'No due date', },
      { id: 't4', title: 'Yesterday task', due_date: '2025-01-05T10:00:00Z' },
    ]

    const result = buildNannyTaskListFromTasks(tasks, defaultContext(), TODAY)

    const taskItems = result.filter(item => !item.isHeader)
    expect(taskItems.length).toBe(1)
    expect(taskItems[0].title).toBe('Today task')
  })

  it('10. Tasks sorted by project name (No Project last)', () => {
    const tasks: KdeTask[] = [
      { id: 't1', title: 'No project', due_date: `${TODAY}T10:00:00Z` },
      { id: 't2', title: 'Work task', project_id: 'p1', due_date: `${TODAY}T10:00:00Z` },
      { id: 't3', title: 'Alpha task', project_id: 'p2', due_date: `${TODAY}T10:00:00Z` },
    ]
    const ctx = {
      ...defaultContext(),
      projects: {
        p1: { name: 'Zulu Project', color: '#FF0000' },
        p2: { name: 'Alpha Project', color: '#00FF00' }
      }
    }

    const result = buildNannyTaskListFromTasks(tasks, ctx, TODAY)

    // Headers should be: Alpha Project, Zulu Project, ⚡ Quick Tasks
    const headers = result.filter(item => item.isHeader)
    expect(headers.length).toBe(3)
    expect(headers[0].projectName).toBe('Alpha Project')
    expect(headers[1].projectName).toBe('Zulu Project')
    expect(headers[2].projectName).toContain('Quick Tasks') // No project goes last
  })
})
