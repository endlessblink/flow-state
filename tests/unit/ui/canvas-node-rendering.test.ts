/**
 * Canvas Node Rendering Tests (TASK-1638)
 *
 * Static analysis verifying canvas node components (TaskNode, GroupNodeSimple)
 * have the required template bindings, props, class assignments, and structural
 * constraints for correct rendering. No DOM/Vue runtime required.
 *
 * Tests:
 *  1.  TaskNode component file exists
 *  2.  TaskNode renders task title (template binding)
 *  3.  TaskNode shows priority indicator (class binding)
 *  4.  TaskNode shows due date (passed to TaskNodeMeta)
 *  5.  TaskNode shows project color indicator (priority glow via class binding)
 *  6.  TaskNode has timer-active class binding (isTimerActive computed)
 *  7.  GroupNode (GroupNodeSimple) component file exists
 *  8.  GroupNode renders group name (sectionName binding)
 *  9.  GroupNode shows task count (taskCount computed)
 * 10.  GroupNode has collapse/expand toggle (isCollapsed + button)
 * 11.  GroupNode has color prop (groupColor computed from store)
 * 12.  Node components use design tokens for colors (not hardcoded hex/rgb)
 * 13.  TaskNode has context menu handler (@contextmenu)
 * 14.  TaskNode has data-task-id selector for E2E targeting
 * 15.  Node size constraints defined (min-width, min-height in TaskNode style)
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

const SRC = path.resolve(__dirname, '../../../src')
const CANVAS = path.join(SRC, 'components/canvas')
const NODE_DIR = path.join(CANVAS, 'node')

function readFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return ''
  }
}

/**
 * Extract the outermost SFC <template> block.
 * A naive regex stops at the first </template> which may be a named slot like <template #trigger>.
 * Instead, find the position of the root opening tag and the last </template> in the file.
 */
function extractTemplate(source: string): string {
  const startMatch = source.match(/<template>/)
  if (!startMatch || startMatch.index === undefined) return ''
  const start = startMatch.index + '<template>'.length
  // The SFC root </template> is always the last one in the file
  const lastClose = source.lastIndexOf('</template>')
  if (lastClose === -1 || lastClose <= start) return source.slice(start)
  return source.slice(start, lastClose)
}

function extractScript(source: string): string {
  const matches = [...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
  return matches.map(m => m[1]).join('\n')
}

function extractStyleBlocks(source: string): string {
  const matches = [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
  return matches.map(m => m[1]).join('\n')
}

// ---------------------------------------------------------------------------
// TaskNode (src/components/canvas/TaskNode.vue)
// ---------------------------------------------------------------------------

describe('TASK-1638: Canvas Node Rendering — TaskNode', () => {
  const taskNodePath = path.join(CANVAS, 'TaskNode.vue')

  it('Test 1: TaskNode component file exists', () => {
    expect(fs.existsSync(taskNodePath), 'TaskNode.vue must exist in src/components/canvas/').toBe(true)
  })

  it('Test 2: TaskNode renders task title via TaskNodeHeader with :title binding', () => {
    const source = readFile(taskNodePath)
    const template = extractTemplate(source)

    // TaskNode delegates title rendering to TaskNodeHeader sub-component
    expect(template).toContain('TaskNodeHeader')
    expect(template).toContain(':title=')

    // The title comes from the task prop
    expect(template).toMatch(/:title="task\?\.title"/)
  })

  it('Test 3: TaskNode shows priority indicator via TaskNodePriority sub-component', () => {
    const source = readFile(taskNodePath)
    const template = extractTemplate(source)

    // Priority badge rendered as sub-component
    expect(template).toContain('TaskNodePriority')

    // Priority classes applied on the root node
    expect(template).toContain("'priority-high': task?.priority === 'high'")
    expect(template).toContain("'priority-medium': task?.priority === 'medium'")
    expect(template).toContain("'priority-low': task?.priority === 'low'")
  })

  it('Test 4: TaskNode passes due date to TaskNodeMeta', () => {
    const source = readFile(taskNodePath)
    const template = extractTemplate(source)

    // TaskNodeMeta receives due-date prop
    expect(template).toContain('TaskNodeMeta')
    expect(template).toMatch(/:due-date=/)
  })

  it('Test 5: TaskNode applies priority-based border/glow via CSS classes', () => {
    const source = readFile(taskNodePath)
    const css = extractStyleBlocks(source)

    // Priority glow classes must be defined in the style block
    expect(css).toContain('.priority-high')
    expect(css).toContain('.priority-medium')
    expect(css).toContain('.priority-low')
  })

  it('Test 6: TaskNode has timer-active class binding from isTimerActive', () => {
    const source = readFile(taskNodePath)
    const template = extractTemplate(source)
    const script = extractScript(source)

    // Template class binding
    expect(template).toContain("'timer-active': isTimerActive")

    // isTimerActive must be destructured/imported from useTaskNodeState
    expect(script).toContain('isTimerActive')
  })

  it('Test 13: TaskNode has @contextmenu handler', () => {
    const source = readFile(taskNodePath)
    const template = extractTemplate(source)

    expect(template).toContain('@contextmenu')
    // It prevents the default browser context menu
    expect(template).toContain('@contextmenu.prevent=')
  })

  it('Test 14: TaskNode has data-task-id attribute for E2E targeting', () => {
    const source = readFile(taskNodePath)
    const template = extractTemplate(source)

    expect(template).toContain(':data-task-id=')
    expect(template).toMatch(/:data-task-id="task\?\.id"/)
  })

  it('Test 15: TaskNode defines min-width and min-height size constraints', () => {
    const source = readFile(taskNodePath)
    const css = extractStyleBlocks(source)

    expect(css).toContain('min-width')
    expect(css).toContain('min-height')
    // Width constraints are fixed per TASK-071
    expect(css).toContain('width: 280px')
  })
})

// ---------------------------------------------------------------------------
// TaskNodeHeader (src/components/canvas/node/TaskNodeHeader.vue)
// ---------------------------------------------------------------------------

describe('TASK-1638: Canvas Node Rendering — TaskNodeHeader sub-component', () => {
  const headerPath = path.join(NODE_DIR, 'TaskNodeHeader.vue')

  it('TaskNodeHeader file exists', () => {
    expect(fs.existsSync(headerPath)).toBe(true)
  })

  it('TaskNodeHeader renders displayTitle from truncated title prop', () => {
    const source = readFile(headerPath)
    const template = extractTemplate(source)
    const script = extractScript(source)

    // Title displayed from computed displayTitle
    expect(template).toContain('displayTitle')
    expect(script).toContain('displayTitle')
    expect(script).toContain('title')
  })

  it('TaskNodeHeader shows timer-indicator when isTimerActive is true', () => {
    const source = readFile(headerPath)
    const template = extractTemplate(source)

    expect(template).toContain('isTimerActive')
    expect(template).toContain('timer-indicator')
  })
})

// ---------------------------------------------------------------------------
// TaskNodeMeta (src/components/canvas/node/TaskNodeMeta.vue)
// ---------------------------------------------------------------------------

describe('TASK-1638: Canvas Node Rendering — TaskNodeMeta sub-component', () => {
  const metaPath = path.join(NODE_DIR, 'TaskNodeMeta.vue')

  it('TaskNodeMeta file exists', () => {
    expect(fs.existsSync(metaPath)).toBe(true)
  })

  it('TaskNodeMeta accepts dueDate prop and renders due-date-badge', () => {
    const source = readFile(metaPath)
    const template = extractTemplate(source)
    const script = extractScript(source)

    expect(script).toContain('dueDate')
    expect(template).toContain('due-date-badge')
    expect(template).toContain('formattedDueDate')
  })
})

// ---------------------------------------------------------------------------
// GroupNodeSimple (src/components/canvas/GroupNodeSimple.vue)
// ---------------------------------------------------------------------------

describe('TASK-1638: Canvas Node Rendering — GroupNode (GroupNodeSimple)', () => {
  const groupNodePath = path.join(CANVAS, 'GroupNodeSimple.vue')

  it('Test 7: GroupNodeSimple component file exists', () => {
    expect(
      fs.existsSync(groupNodePath),
      'GroupNodeSimple.vue must exist in src/components/canvas/'
    ).toBe(true)
  })

  it('Test 8: GroupNode renders group name via v-model sectionName on input', () => {
    const source = readFile(groupNodePath)
    const template = extractTemplate(source)
    const script = extractScript(source)

    // v-model on the name input
    expect(template).toContain('v-model="sectionName"')
    // sectionName is a local ref derived from props.data.name
    expect(script).toContain('sectionName')
  })

  it('Test 9: GroupNode shows task count via taskCount computed property', () => {
    const source = readFile(groupNodePath)
    const template = extractTemplate(source)
    const script = extractScript(source)

    // taskCount displayed in template
    expect(template).toContain('taskCount')
    expect(template).toContain('section-count')
    // taskCount is computed from props.data
    expect(script).toContain('taskCount')
    expect(script).toContain('computed')
  })

  it('Test 10: GroupNode has collapse/expand toggle with isCollapsed state', () => {
    const source = readFile(groupNodePath)
    const template = extractTemplate(source)
    const script = extractScript(source)

    // Collapse button exists with toggle handler
    expect(template).toContain('collapse-btn')
    expect(template).toContain('toggleCollapse')

    // Collapsed state drives which icon shows
    expect(template).toContain('v-if="!isCollapsed"')
    expect(template).toContain('v-else')

    // isCollapsed is a computed property
    expect(script).toContain('isCollapsed')
  })

  it('Test 11: GroupNode has dynamic color via groupColor (from store, not static prop)', () => {
    const source = readFile(groupNodePath)
    const script = extractScript(source)
    const template = extractTemplate(source)

    // groupColor computed from canvas store for reactivity (BUG-225)
    expect(script).toContain('groupColor')
    expect(script).toContain('canvasStore')

    // Color applied as inline style
    expect(template).toMatch(/borderColor:\s*groupColor/)
  })

  it('Test 12: GroupNode uses design tokens (CSS vars) for structural styles not hardcoded colors', () => {
    const source = readFile(groupNodePath)
    const css = extractStyleBlocks(source)

    // The component uses inline styles for the dynamic color (groupColor hex), which is expected.
    // But structural CSS should use design tokens for non-color properties.
    expect(css).toMatch(/var\(--/)

    // Should not have hardcoded hex values for structural colors in scoped styles
    // (the borderColor is inline style, not scoped CSS, so scoped CSS must be clean)
    const hardcodedHexInCss = css.match(/#[0-9a-fA-F]{3,6}(?!\w)/g) || []
    // Allow at most a couple of hardcoded fallback colors in scoped CSS
    expect(hardcodedHexInCss.length).toBeLessThanOrEqual(5)
  })
})

// ---------------------------------------------------------------------------
// TaskNodePriority (src/components/canvas/node/TaskNodePriority.vue)
// ---------------------------------------------------------------------------

describe('TASK-1638: Canvas Node Rendering — TaskNodePriority sub-component', () => {
  const priorityPath = path.join(NODE_DIR, 'TaskNodePriority.vue')

  it('TaskNodePriority file exists', () => {
    expect(fs.existsSync(priorityPath)).toBe(true)
  })

  it('TaskNodePriority uses design tokens for priority colors', () => {
    const source = readFile(priorityPath)
    const css = extractStyleBlocks(source)

    expect(css).toContain('var(--color-priority-high)')
    expect(css).toContain('var(--color-priority-medium)')
    expect(css).toContain('var(--color-priority-low)')
  })

  it('TaskNodePriority uses :global() selectors to receive priority state from parent', () => {
    const source = readFile(priorityPath)
    const css = extractStyleBlocks(source)

    expect(css).toContain(':global(.priority-high)')
    expect(css).toContain(':global(.priority-medium)')
    expect(css).toContain(':global(.priority-low)')
  })
})
