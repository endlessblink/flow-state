<script setup lang="ts">
defineProps<{
  label: string
  options: number[]
  value: number
  suffix?: string
}>()

const emit = defineEmits<{
  update: [value: number]
}>()
</script>

<template>
  <div class="setting-group">
    <label class="setting-label">{{ label }}</label>
    <div class="duration-options">
      <button
        v-for="option in options"
        :key="option"
        class="duration-btn"
        :class="{ active: value === option }"
        @click="emit('update', option)"
      >
        {{ option }}{{ suffix || 'm' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.setting-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.setting-label {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.duration-options {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.duration-btn {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal) var(--spring-smooth);
  min-width: 4rem;
}

.duration-btn:hover {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border-medium);
  color: var(--text-primary);
  transform: translateY(-1px);
}

.duration-btn.active {
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
}
</style>
