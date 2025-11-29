<template>
  <div class="line-diff">
    <div class="diff-lines">
      <div
        v-for="(line, index) in diffLines"
        :key="index"
        :class="getLineClass(line)"
        class="diff-line"
      >
        <div class="line-number">{{ line.lineNumber }}</div>
        <div class="line-content" v-html="line.content"></div>
        <div v-if="line.type === 'changed'" class="line-comparison">
          <div class="original-line" v-html="line.originalContent"></div>
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
  value: any
  compareValue: any
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
  @apply space-y-3;
}

.diff-lines {
  @apply border border-gray-200 rounded-lg overflow-hidden font-mono text-sm;
}

.diff-line {
  @apply flex border-b border-gray-100 last:border-b-0;
}

.line-number {
  @apply w-12 px-2 py-1 bg-gray-50 text-gray-500 text-xs border-r border-gray-200 text-right;
}

.line-content {
  @apply flex-1 px-3 py-1 whitespace-pre;
}

.line-comparison {
  @apply border-l-2 border-gray-300;
}

.original-line {
  @apply px-3 py-1 bg-gray-50 text-gray-500 text-sm whitespace-pre;
}

.line-added {
  @apply bg-green-50;
}

.line-added .line-number {
  @apply bg-green-100 text-green-700;
}

.line-added .line-content {
  @apply text-green-900;
}

.line-removed {
  @apply bg-red-50;
}

.line-removed .line-number {
  @apply bg-red-100 text-red-700;
}

.line-removed .line-content {
  @apply text-red-900 line-through;
}

.line-unchanged {
  @apply bg-white;
}

.line-changed {
  @apply bg-orange-50;
}

.line-changed .line-number {
  @apply bg-orange-100 text-orange-700;
}

.line-changed .line-content {
  @apply text-orange-900;
}

.line-stats {
  @apply flex items-center justify-center gap-4 text-xs text-gray-600;
}

.stat-item {
  @apply flex items-center gap-1;
}

.stat-count {
  @apply font-medium;
}

.stat-item.added .stat-count {
  @apply text-green-600;
}

.stat-item.removed .stat-count {
  @apply text-red-600;
}

.stat-item.unchanged .stat-count {
  @apply text-gray-500;
}
</style>