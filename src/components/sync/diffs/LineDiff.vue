<template>
  <div class="line-diff">
    <div class="diff-lines">
      <div
        v-for="(line, index) in diffLines"
        :key="index"
        :class="getLineClass(line)"
        class="diff-line"
      >
        <div class="line-number">
          {{ line.lineNumber }}
        </div>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="line-content" v-html="line.content" />
        <div v-if="line.type === 'changed'" class="line-comparison">
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div class="original-line" v-html="line.originalContent" />
        </div>
      </div>
    </div>

    <!-- Line Stats -->
    <div class="line-stats">
      <div class="stat-item added">
        <span class="stat-count">{{ diffStats.linesAdded }}</span>
        <span class="stat-label">lines added</span>
      </div>
      <div class="stat-item removed">
        <span class="stat-count">{{ diffStats.linesRemoved }}</span>
        <span class="stat-label">lines removed</span>
      </div>
      <div class="stat-item unchanged">
        <span class="stat-count">{{ diffStats.linesUnchanged }}</span>
        <span class="stat-label">unchanged</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  value: unknown
  compareValue: unknown
  mode: 'local' | 'remote'
}

const props = defineProps<Props>()

interface DiffLine {
  lineNumber: number
  content: string
  originalContent?: string
  type: 'added' | 'removed' | 'unchanged' | 'changed'
}

const diffLines = computed((): DiffLine[] => {
  const val1 = String(props.value || '')
  const val2 = String(props.compareValue || '')

  if (val1 === val2) {
    return val1.split('\n').map((line, index) => ({
      lineNumber: index + 1,
      content: escapeHtml(line),
      type: 'unchanged' as const
    }))
  }

  const lines1 = val1.split('\n')
  const lines2 = val2.split('\n')

  const lines: DiffLine[] = []
  let i1 = 0, i2 = 0
  let lineNumber = 1

  while (i1 < lines1.length || i2 < lines2.length) {
    const line1 = lines1[i1]
    const line2 = lines2[i2]

    if (line1 === line2) {
      lines.push({
        lineNumber: lineNumber++,
        content: escapeHtml(line1),
        type: 'unchanged'
      })
      i1++
      i2++
    } else if (i1 >= lines1.length) {
      // Only remote lines left
      lines.push({
        lineNumber: lineNumber++,
        content: escapeHtml(line2),
        type: props.mode === 'remote' ? 'unchanged' : 'added'
      })
      i2++
    } else if (i2 >= lines2.length) {
      // Only local lines left
      lines.push({
        lineNumber: lineNumber++,
        content: escapeHtml(line1),
        type: props.mode === 'local' ? 'unchanged' : 'removed'
      })
      i1++
    } else {
      // Different lines - show both
      if (props.mode === 'local') {
        lines.push({
          lineNumber: lineNumber++,
          content: escapeHtml(line1),
          originalContent: escapeHtml(line2),
          type: 'unchanged'
        })
      } else if (props.mode === 'remote') {
        lines.push({
          lineNumber: lineNumber++,
          content: escapeHtml(line2),
          originalContent: escapeHtml(line1),
          type: 'unchanged'
        })
      } else {
        lines.push({
          lineNumber: lineNumber++,
          content: escapeHtml(line2),
          originalContent: escapeHtml(line1),
          type: 'changed'
        })
      }
      i1++
      i2++
    }
  }

  return lines
})

const diffStats = computed(() => {
  const val1 = String(props.value || '')
  const val2 = String(props.compareValue || '')

  if (val1 === val2) {
    return { linesAdded: 0, linesRemoved: 0, linesUnchanged: val1.split('\n').length }
  }

  const lines1 = val1.split('\n')
  const lines2 = val2.split('\n')

  const set1 = new Set(lines1)
  const set2 = new Set(lines2)

  const added = [...set2].filter(line => !set1.has(line)).length
  const removed = [...set1].filter(line => !set2.has(line)).length
  const unchanged = [...set1].filter(line => set2.has(line)).length

  return { linesAdded: added, linesRemoved: removed, linesUnchanged: unchanged }
})

function getLineClass(line: DiffLine): string {
  const baseClass = 'diff-line'
  switch (line.type) {
    case 'added':
      return `${baseClass} line-added`
    case 'removed':
      return `${baseClass} line-removed`
    case 'unchanged':
      return `${baseClass} line-unchanged`
    case 'changed':
      return `${baseClass} line-changed`
    default:
      return baseClass
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
</script>

<style scoped>
.line-diff {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.diff-lines {
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
}

.diff-line {
  display: flex;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.diff-line:last-child {
  border-bottom: none;
}

.line-number {
  width: 48px;
  padding: var(--space-1) var(--space-2);
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-muted);
  font-size: var(--font-size-xs);
  border-right: 1px solid var(--glass-border);
  text-align: right;
  flex-shrink: 0;
}

.line-content {
  flex-grow: 1;
  padding: var(--space-1) var(--space-3);
  white-space: pre;
  color: var(--text-primary);
}

.line-comparison {
  border-left: 2px solid var(--glass-border);
}

.original-line {
  padding: var(--space-1) var(--space-3);
  background: rgba(255, 255, 255, 0.02);
  color: var(--text-muted);
  font-size: var(--font-size-sm);
  white-space: pre;
}

.line-added {
  background: rgba(34, 197, 94, 0.1);
}

.line-added .line-number {
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
}

.line-added .line-content {
  color: #4ade80;
}

.line-removed {
  background: rgba(239, 68, 68, 0.1);
}

.line-removed .line-number {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}

.line-removed .line-content {
  color: #f87171;
  text-decoration: line-through;
}

.line-unchanged {
  background: transparent;
}

.line-changed {
  background: rgba(245, 158, 11, 0.1);
}

.line-changed .line-number {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
}

.line-changed .line-content {
  color: #fbbf24;
}

.line-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  font-size: var(--font-size-xs);
  color: var(--text-muted);
}

.stat-item {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.stat-count {
  font-weight: var(--font-medium);
}

.stat-item.added .stat-count {
  color: #4ade80;
}

.stat-item.removed .stat-count {
  color: #f87171;
}

.stat-item.unchanged .stat-count {
  color: var(--text-muted);
}
</style>