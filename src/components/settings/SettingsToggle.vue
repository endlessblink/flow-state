<script setup lang="ts">
defineProps<{
  label: string
  description?: string
  value: boolean
}>()

const emit = defineEmits<{
  update: [value: boolean]
}>()
</script>

<template>
  <div class="setting-toggle-wrapper">
    <label class="toggle-label">
      <div class="toggle-info">
        <span class="label-text">{{ label }}</span>
        <p v-if="description" class="setting-description">
          {{ description }}
        </p>
      </div>
      <div class="toggle-interaction">
        <input
          type="checkbox"
          :checked="value"
          @change="emit('update', ($event.target as HTMLInputElement).checked)"
        >
        <span class="toggle-slider" />
      </div>
    </label>
  </div>
</template>

<style scoped>
.setting-toggle-wrapper {
  margin-bottom: var(--space-1);
}

.toggle-label {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  cursor: pointer;
  width: 100%;
}

.toggle-info {
  flex: 1;
}

.label-text {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  display: block;
}

.setting-description {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin: var(--space-1) 0 0 0;
  line-height: 1.4;
}

.toggle-interaction {
  position: relative;
  flex-shrink: 0;
  margin-top: 2px;
}

.toggle-interaction input {
  display: none;
}

.toggle-slider {
  display: block;
  width: 2.5rem;
  height: 1.25rem;
  background: var(--glass-bg-heavy);
  border-radius: var(--radius-full);
  position: relative;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.toggle-slider::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 1rem;
  height: 1rem;
  background: var(--text-primary);
  border-radius: var(--radius-full);
  transition: all var(--duration-normal) var(--spring-bounce);
  box-shadow: var(--shadow-sm);
}

.toggle-interaction input:checked + .toggle-slider {
  background: var(--state-active-bg);
}

.toggle-interaction input:checked + .toggle-slider::after {
  left: calc(100% - 1.125rem);
}

/* Hover effect */
.toggle-label:hover .toggle-slider {
  background: var(--glass-bg-tint);
}

.toggle-interaction input:checked:hover + .toggle-slider {
  background: var(--state-active-bg);
  opacity: 0.9;
}
</style>
