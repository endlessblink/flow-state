<script setup lang="ts">
import { computed } from 'vue'
import { CheckCircle2 } from 'lucide-vue-next'

const props = defineProps<{
  show: boolean
  taskCount: number
  totalMinutes: number
}>()

defineEmits<{
  click: []
}>()

const formattedDuration = computed(() => {
  const h = Math.floor(props.totalMinutes / 60)
  const m = props.totalMinutes % 60
  if (h === 0) return `${m}m`
  return m > 0 ? `${h}h ${m}m` : `${h}h`
})
</script>

<template>
  <Transition name="chip-pop">
    <button
      v-if="show"
      class="summary-chip"
      type="button"
      :title="`${taskCount} morning focus tasks, ${formattedDuration} total`"
      @click="$emit('click')"
    >
      <CheckCircle2 :size="14" class="chip-icon" />
      <span class="chip-text">
        Morning locked: {{ taskCount }} {{ taskCount === 1 ? 'block' : 'blocks' }}, {{ formattedDuration }}
      </span>
    </button>
  </Transition>
</template>

<style scoped>
.summary-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-full);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--brand-primary);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.summary-chip:hover {
  background: rgba(78, 205, 196, 0.1);
  box-shadow: 0 0 12px rgba(78, 205, 196, 0.2);
}

.chip-icon {
  flex-shrink: 0;
  color: var(--brand-primary);
}

.chip-text {
  color: var(--text-primary);
}

/* Transition */
.chip-pop-enter-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.chip-pop-leave-active {
  transition: all 0.2s ease;
}

.chip-pop-enter-from {
  transform: scale(0.8);
  opacity: 0;
}

.chip-pop-leave-to {
  transform: scale(0.95);
  opacity: 0;
}
</style>
