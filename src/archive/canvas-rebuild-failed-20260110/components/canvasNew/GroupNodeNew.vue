<script setup lang="ts">
/**
 * Group Node New - Clean foundation component
 */
import { computed } from 'vue'
import type { NodeProps } from '@vue-flow/core'
import type { CanvasGroup } from '@/stores/canvas/types'

interface GroupNodeData extends CanvasGroup {
  taskCount?: number
}

const props = defineProps<NodeProps<GroupNodeData>>()

const taskCount = computed(() => props.data?.taskCount ?? 0)

const groupStyle = computed(() => ({
  width: `${props.data?.dimensions?.width ?? 300}px`,
  height: props.data?.isCollapsed 
    ? '44px' 
    : `${props.data?.dimensions?.height ?? 200}px`,
  borderColor: props.data?.color ?? '#6366f1'
}))

const headerStyle = computed(() => ({
  backgroundColor: props.data?.color ?? '#6366f1'
}))
</script>

<template>
  <div 
    class="group-node-new relative flex flex-col rounded-xl overflow-hidden border-2 bg-gray-900/40 backdrop-blur-sm transition-shadow"
    :class="{ 'ring-4 ring-blue-500/30': selected }"
    :style="groupStyle"
  >
    <!-- Header -->
    <div 
      class="flex items-center justify-between px-3 py-2 text-white font-bold text-sm cursor-grab active:cursor-grabbing"
      :style="headerStyle"
    >
      <div class="flex items-center gap-2 truncate">
        <span class="truncate">{{ data.name }}</span>
      </div>
      <div class="bg-black/20 px-2 py-0.5 rounded-full text-[10px]">
        {{ taskCount }}
      </div>
    </div>

    <!-- Content Slot (Vue Flow renders nested nodes here) -->
    <div v-if="!data.isCollapsed" class="flex-1 w-full bg-black/10">
      <!-- Slot icon or subtle indicator -->
    </div>
  </div>
</template>

<style scoped>
.group-node-new {
  min-width: 100px;
  min-height: 44px;
}

/* Ensure node is clickable in Vue Flow */
.vue-flow__node-sectionNode {
  pointer-events: auto !important;
}
</style>
