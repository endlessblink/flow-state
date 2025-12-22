<template>
  <div class="character-diff">
    <div class="diff-line">
      <!-- eslint-disable-next-line vue/no-v-html -->
      <span
        v-for="(char, index) in diffTokens"
        :key="index"
        :class="getTokenClass(char)"
        v-html="char.content"
      />
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

interface DiffToken {
  content: string
  type: 'added' | 'removed' | 'unchanged' | 'space'
}

const diffTokens = computed((): DiffToken[] => {
  const val1 = String(props.value || '')
  const val2 = String(props.compareValue || '')

  if (val1 === val2) {
    return [{ content: escapeHtml(val1), type: 'unchanged' }]
  }

  // Simple character-by-character diff
  const tokens: DiffToken[] = []
  const chars1 = val1.split('')
  const chars2 = val2.split('')

  const maxLength = Math.max(chars1.length, chars2.length)
  for (let i = 0; i < maxLength; i++) {
    const char1 = chars1[i]
    const char2 = chars2[i]

    if (char1 === char2) {
      tokens.push({
        content: escapeHtml(char1 || ''),
        type: char1 === ' ' ? 'space' : 'unchanged'
      })
    } else {
      // Different characters
      if (char1) {
        tokens.push({
          content: escapeHtml(char1),
          type: props.mode === 'local' ? 'unchanged' : 'removed'
        })
      }
      if (char2) {
        tokens.push({
          content: escapeHtml(char2),
          type: props.mode === 'remote' ? 'unchanged' : 'added'
        })
      }
    }
  }

  return tokens
})

function getTokenClass(token: DiffToken): string {
  switch (token.type) {
    case 'added':
      return 'token-added'
    case 'removed':
      return 'token-removed'
    case 'unchanged':
      return 'token-unchanged'
    case 'space':
      return 'token-space'
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
    .replace(/ /g, '&nbsp;')
}
</script>

<style scoped>
.character-diff {
  @apply p-3 font-mono text-sm leading-relaxed;
}

.diff-line {
  @apply break-all;
}

.token-added {
  @apply bg-green-200 text-green-900 rounded px-0.5;
}

.token-removed {
  @apply bg-red-200 text-red-900 rounded px-0.5 line-through;
}

.token-unchanged {
  @apply text-gray-800;
}

.token-space {
  @apply text-gray-400;
}
</style>