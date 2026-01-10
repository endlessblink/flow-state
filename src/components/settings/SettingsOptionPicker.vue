<script setup lang="ts">
interface Option {
  value: string
  label: string
}

defineProps<{
  label: string
  description?: string
  options: Option[]
  value: string
}>()

const emit = defineEmits<{
  update: [value: any]
}>()
</script>

<template>
  <div class="setting-group">
    <div class="setting-header">
      <label class="setting-label">{{ label }}</label>
      <p v-if="description" class="setting-description">
        {{ description }}
      </p>
    </div>
    
    <div class="option-picker">
      <button
        v-for="option in options"
        :key="option.value"
        class="option-btn"
        :class="{ active: value === option.value }"
        @click="emit('update', option.value)"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.setting-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.setting-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.setting-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
}

.setting-description {
  font-size: var(--text-xs);
  color: var(--text-muted);
  line-height: 1.4;
}

.option-picker {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.option-btn {
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: all var(--duration-normal) var(--spring-smooth);
  flex: 1;
  min-width: 100px;
  text-align: center;
}

.option-btn:hover {
  background: var(--glass-bg-medium);
  border-color: var(--glass-border-medium);
  color: var(--text-primary);
  transform: translateY(-1px);
}

.option-btn.active {
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  color: var(--text-primary);
  box-shadow: var(--shadow-sm);
}

@media (max-width: 480px) {
  .option-btn {
    flex: 1 0 100%;
  }
}
</style>
