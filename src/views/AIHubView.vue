<template>
  <div class="ai-hub-view">
    <div class="hub-content">
      <AIChatView />
    </div>
  </div>
</template>

<script setup lang="ts">
import AIChatView from '@/views/AIChatView.vue'
</script>

<style scoped>
.ai-hub-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.hub-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
