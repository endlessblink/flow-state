<template>
  <div class="word-diff">
    <div class="diff-content">
      <span
        v-for="(token, index) in diffTokens"
        :key="index"
        :class="getTokenClass(token)"
        v-html="token.content"
      />
    </div>

    <!-- Word Stats -->
    <div class="word-stats">
      <div class="stat-item added">
        <span class="stat-count">{{ diffStats.wordsAdded }}</span>
        <span class="stat-label">words added</span>
      </div>
      <div class="stat-item removed">
        <span class="stat-count">{{ diffStats.wordsRemoved }}</span>
        <span class="stat-label">words removed</span>
      </div>
      <div class="stat-item unchanged">
        <span class="stat-count">{{ diffStats.wordsUnchanged }}</span>
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

interface DiffToken {
  content: string
  type: 'added' | 'removed' | 'unchanged' | 'whitespace'
}

const diffTokens = computed((): DiffToken[] => {
  const val1 = String(props.value || '')
  const val2 = String(props.compareValue || '')

  if (val1 === val2) {
    return [{ content: escapeHtml(val1), type: 'unchanged' }]
  }

  // Simple word-level diff
  const words1 = val1.split(/(\s+)/)
  const words2 = val2.split(/(\s+)/)

  const tokens: DiffToken[] = []
  let i1 = 0, i2 = 0

  while (i1 < words1.length || i2 < words2.length) {
    const word1 = words1[i1]
    const word2 = words2[i2]

    if (word1 === word2) {
      tokens.push({
        content: escapeHtml(word1),
        type: word1.trim() === '' ? 'whitespace' : 'unchanged'
      })
      i1++
      i2++
    } else if (i1 >= words1.length) {
      // Only remote words left
      tokens.push({
        content: escapeHtml(word2),
        type: props.mode === 'remote' ? 'unchanged' : 'added'
      })
      i2++
    } else if (i2 >= words2.length) {
      // Only local words left
      tokens.push({
        content: escapeHtml(word1),
        type: props.mode === 'local' ? 'unchanged' : 'removed'
      })
      i1++
    } else {
      // Different words
      if (word1.trim() === '') {
        tokens.push({
          content: escapeHtml(word1),
          type: 'whitespace'
        })
        i1++
      } else if (word2.trim() === '') {
        tokens.push({
          content: escapeHtml(word2),
          type: 'whitespace'
        })
        i2++
      } else {
        tokens.push({
          content: escapeHtml(word1),
          type: props.mode === 'local' ? 'unchanged' : 'removed'
        })
        tokens.push({
          content: escapeHtml(word2),
          type: props.mode === 'remote' ? 'unchanged' : 'added'
        })
        i1++
        i2++
      }
    }
  }

  return tokens
})

const diffStats = computed(() => {
  const val1 = String(props.value || '')
  const val2 = String(props.compareValue || '')

  if (val1 === val2) {
    return { wordsAdded: 0, wordsRemoved: 0, wordsUnchanged: val1.split(/\s+/).filter(w => w.length > 0).length }
  }

  const words1 = val1.split(/\s+/).filter(w => w.length > 0)
  const words2 = val2.split(/\s+/).filter(w => w.length > 0)

  const set1 = new Set(words1)
  const set2 = new Set(words2)

  const added = [...set2].filter(word => !set1.has(word)).length
  const removed = [...set1].filter(word => !set2.has(word)).length
  const unchanged = [...set1].filter(word => set2.has(word)).length

  return { wordsAdded: added, wordsRemoved: removed, wordsUnchanged: unchanged }
})

function getTokenClass(token: DiffToken): string {
  switch (token.type) {
    case 'added':
      return 'token-added'
    case 'removed':
      return 'token-removed'
    case 'unchanged':
      return 'token-unchanged'
    case 'whitespace':
      return 'token-whitespace'
    default:
      return 'token-unchanged'
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/ /g, ' ') // Keep spaces as-is
    .replace(/\n/g, '<br>')
}
</script>

<style scoped>
.word-diff {
  @apply space-y-3;
}

.diff-content {
  @apply p-3 leading-relaxed text-sm;
}

.token-added {
  @apply bg-green-200 text-green-900 rounded px-1;
}

.token-removed {
  @apply bg-red-200 text-red-900 rounded px-1 line-through;
}

.token-unchanged {
  @apply text-gray-800;
}

.token-whitespace {
  @apply text-gray-800;
}

.word-stats {
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