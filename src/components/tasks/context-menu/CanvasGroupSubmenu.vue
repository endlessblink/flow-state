<template>
  <Teleport to="body">
    <div
      v-if="isVisible && parentVisible"
      class="submenu"
      :style="style"
      @mouseenter="$emit('mouseenter')"
      @mouseleave="$emit('mouseleave')"
      @wheel.stop
    >
      <!-- No Group option -->
      <button
        class="menu-item menu-item--sm"
        :class="{ active: !currentGroupId }"
        @click.stop="$emit('select', null)"
      >
        <span class="group-icon group-icon--none">--</span>
        <span class="menu-text">No Group</span>
        <Check v-if="!currentGroupId" :size="12" class="check-icon" />
      </button>

      <!-- Today / Tomorrow shortcuts -->
      <button
        v-if="todayGroup"
        class="menu-item menu-item--sm"
        :class="{ active: currentGroupId === todayGroup.id }"
        @click.stop="$emit('select', todayGroup.id)"
      >
        <span class="group-dot" :style="{ backgroundColor: todayGroup.color }" />
        <span class="menu-text">Today</span>
        <Check v-if="currentGroupId === todayGroup.id" :size="12" class="check-icon" />
      </button>

      <button
        v-if="tomorrowGroup"
        class="menu-item menu-item--sm"
        :class="{ active: currentGroupId === tomorrowGroup.id }"
        @click.stop="$emit('select', tomorrowGroup.id)"
      >
        <span class="group-dot" :style="{ backgroundColor: tomorrowGroup.color }" />
        <span class="menu-text">Tomorrow</span>
        <Check v-if="currentGroupId === tomorrowGroup.id" :size="12" class="check-icon" />
      </button>

      <div v-if="groups.length" class="submenu-divider" />

      <!-- Group list -->
      <div class="group-list">
        <button
          v-for="group in filteredGroups"
          :key="group.id"
          class="menu-item menu-item--sm"
          :class="{ active: currentGroupId === group.id }"
          @click.stop="$emit('select', group.id)"
        >
          <span
            class="group-dot"
            :style="{ backgroundColor: group.color }"
          />
          <OverflowTooltip :text="group.name" class="menu-text" tooltip-position="bottom">{{ group.name }}</OverflowTooltip>
          <Check v-if="currentGroupId === group.id" :size="12" class="check-icon" />
        </button>
      </div>

      <!-- Empty state -->
      <div v-if="!filteredGroups.length" class="empty-state">
        No groups yet
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CSSProperties } from 'vue'
import { Check } from 'lucide-vue-next'
import { useCanvasStore } from '@/stores/canvas'
import OverflowTooltip from '@/components/base/OverflowTooltip.vue'
import { DAY_OF_WEEK_KEYWORDS } from '@/composables/usePowerKeywords'

defineProps<{
  isVisible: boolean
  parentVisible?: boolean
  style: CSSProperties
  currentGroupId?: string | null
}>()

defineEmits<{
  select: [groupId: string | null]
  mouseenter: []
  mouseleave: []
}>()

const canvasStore = useCanvasStore()
const groups = computed(() => canvasStore.groups)

function findGroupForDayIndex(dayIndex: number) {
  const entry = Object.values(DAY_OF_WEEK_KEYWORDS).find(e => e.index === dayIndex)
  if (!entry) return null
  return groups.value.find(g => entry.keywords.some(kw => g.name.toLowerCase().includes(kw))) ?? null
}

const todayGroup = computed(() => {
  const todayIndex = new Date().getDay()
  return findGroupForDayIndex(todayIndex)
})

const tomorrowGroup = computed(() => {
  const tomorrowIndex = (new Date().getDay() + 1) % 7
  const byDay = findGroupForDayIndex(tomorrowIndex)
  if (byDay) return byDay
  return groups.value.find(g => g.name.toLowerCase() === 'tomorrow') ?? null
})

const filteredGroups = computed(() => {
  const excluded = new Set([todayGroup.value?.id, tomorrowGroup.value?.id].filter(Boolean))
  return groups.value.filter(g => !excluded.has(g.id))
})
</script>

<style scoped>
.submenu {
  position: fixed;
  background: var(--overlay-component-bg);
  backdrop-filter: var(--overlay-component-backdrop);
  border: var(--overlay-component-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--overlay-component-shadow);
  padding: var(--space-1) 0;
  min-width: 160px;
  max-width: 220px;
  z-index: var(--z-submenu-nested, 10002);
  animation: menuSlideIn var(--duration-fast) var(--ease-out);
}

/* TASK-1445: Invisible hover bridge on both sides (submenu can flip) */
.submenu::before,
.submenu::after {
  content: '';
  position: absolute;
  top: -8px;
  bottom: -8px;
  width: 16px;
}
.submenu::before { left: -16px; }
.submenu::after { right: -16px; }

@keyframes menuSlideIn {
  from { opacity: 0; transform: scale(0.96) translateY(-4px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.group-list {
  max-height: 250px;
  overflow-y: auto;
}

.group-list::-webkit-scrollbar {
  width: var(--space-1);
}

.group-list::-webkit-scrollbar-track {
  background: transparent;
}

.group-list::-webkit-scrollbar-thumb {
  background: var(--glass-border);
  border-radius: var(--radius-sm);
}

.menu-item {
  width: 100%;
  background: transparent;
  border: none;
  color: var(--text-primary);
  padding: var(--space-1_5) var(--space-2_5);
  font-size: var(--text-xs);
  text-align: start;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  transition: background var(--duration-fast);
}

.menu-item:hover { background: var(--glass-bg-heavy); }
.menu-item.active { color: var(--brand-primary); }

.menu-text {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.group-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.group-icon--none {
  font-size: var(--text-xs);
  color: var(--text-muted);
  opacity: 0.6;
}

.group-dot {
  width: 10px;
  height: 10px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.check-icon {
  flex-shrink: 0;
  opacity: 0.7;
}

.submenu-divider {
  height: 1px;
  background: var(--glass-bg-heavy);
  margin: var(--space-1) 0;
}

.empty-state {
  padding: var(--space-2) var(--space-2_5);
  font-size: var(--text-xs);
  color: var(--text-muted);
  text-align: center;
}
</style>
