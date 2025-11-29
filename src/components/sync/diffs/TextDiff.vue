<template>
  <div class="text-diff">
    <div class="diff-container">
      <!-- Character-level diff for short text -->
      <template v-if="shouldShowCharacterDiff">
        <CharacterDiff
          :value="value"
          :compare-value="compareValue"
          :mode="mode"
        />
      </template>

      <!-- Word-level diff for medium text -->
      <template v-else-if="shouldShowWordDiff">
        <WordDiff
          :value="value"
          :compare-value="compareValue"
          :mode="mode"
        />
      </template>

      <!-- Line-level diff for long text -->
      <template v-else>
        <LineDiff
          :value="value"
          :compare-value="compareValue"
          :mode="mode"
        />
      </template>
    </div>

    <!-- Diff Statistics -->
    <div class="diff-stats">
      <div class="stat-item added">
        <span class="stat-count">{{ diffStats.added }}</span>
        <span class="stat-label">added</span>
      </div>
      <div class="stat-item removed">
        <span class="stat-count">{{ diffStats.removed }}</span>
        <span class="stat-label">removed</span>
      </div>
      <div class="stat-item unchanged">
        <span class="stat-count">{{ diffStats.unchanged }}</span>
        <span class="stat-label">unchanged</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import CharacterDiff from './CharacterDiff.vue'
import WordDiff from './WordDiff.vue'
import LineDiff from './LineDiff.vue'

interface Props {
  value: any
  compareValue: any
  mode: 'local' | 'remote'
}

const props = defineProps<Props>()

const shouldShowCharacterDiff = computed(() => {
  const val1 = String(props.value || '')
  const val2 = String(props.compareValue || '')
  return val1.length < 50 && val2.length < 50
})

const shouldShowWordDiff = computed(() => {
  const val1 = String(props.value || '')
  const val2 = String(props.compareValue || '')
  const avgLength = (val1.length + val2.length) / 2
  return avgLength >= 50 && avgLength < 200
})

const diffStats = computed(() => {
  const val1 = String(props.value || '')
  const val2 = String(props.compareValue || '')

  if (val1 === val2) {
    return { added: 0, removed: 0, unchanged: Math.max(val1.length, val2.length) }
  }

  // Simple character-based diff stats
  const chars1 = val1.split('')
  const chars2 = val2.split('')

  let added = 0
  let removed = 0
  let unchanged = 0

  const maxLength = Math.max(chars1.length, chars2.length)
  for (let i = 0; i < maxLength; i++) {
    const char1 = chars1[i]
    const char2 = chars2[i]

    if (char1 === char2) {
      unchanged++
    } else if (char1 && !char2) {
      removed++
    } else if (!char1 && char2) {
      added++
    } else {
      // Different characters - count as both added and removed
      added++
      removed++
    }
  }

  return { added, removed, unchanged }
})
</script>

<style scoped>
.text-diff {
  @apply space-y-3;
}

.diff-container {
  @apply border border-gray-200 rounded-lg overflow-hidden;
}

.diff-stats {
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