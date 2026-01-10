<script setup lang="ts">
defineProps<{
  title?: string
}>()
</script>

<template>
  <section class="settings-section">
    <h3 v-if="title" class="section-title">
      {{ title }}
    </h3>
    <div class="section-content">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.settings-section {
  margin-bottom: var(--space-8);
}

.section-title {
  font-size: var(--text-base);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
  margin: 0 0 var(--space-4) 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.section-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
</style>
