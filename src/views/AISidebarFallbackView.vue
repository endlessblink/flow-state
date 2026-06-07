<template>
  <div class="ai-sidebar-fallback" aria-live="polite">
    Opening AI assistant...
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAIChatStore } from '@/stores/aiChat'

const router = useRouter()
const aiChatStore = useAIChatStore()

onMounted(() => {
  aiChatStore.openPanel()
  router.replace({ path: '/' })
})
</script>

<style scoped>
.ai-sidebar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 0;
  color: var(--text-tertiary);
  font-size: var(--text-sm);
}
</style>
