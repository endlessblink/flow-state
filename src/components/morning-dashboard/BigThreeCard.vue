<script setup lang="ts">
import { ref, computed } from 'vue'
import draggable from 'vuedraggable'
import { useMorningDashboard, type TaskPoolGroup } from '@/composables/useMorningDashboard'
import BigThreeSlot from './BigThreeSlot.vue'
import TaskPoolCard from './TaskPoolCard.vue'

const {
  big3Slots,
  allSlotsAssigned,
  groupedTasks,
  assignSlot,
  clearSlot,
  startMyDay,
} = useMorningDashboard()

// Track which zone is being dragged over
const dragoverIndex = ref<number | null>(null)

// Visible groups (hide empty ones)
const visibleGroups = computed(() => {
  return Object.entries(groupedTasks.value)
    .filter(([_, group]) => group.tasks.length > 0) as [string, TaskPoolGroup][]
})

const hasAnyTasks = computed(() => visibleGroups.value.length > 0)

// Drop zone models — each zone is a single-item array for vuedraggable
// We use 3 separate lists because vuedraggable needs v-model arrays
const zone0 = computed({
  get: () => big3Slots.value[0].taskId ? [{ id: big3Slots.value[0].taskId }] : [],
  set: () => {}
})
const zone1 = computed({
  get: () => big3Slots.value[1].taskId ? [{ id: big3Slots.value[1].taskId }] : [],
  set: () => {}
})
const zone2 = computed({
  get: () => big3Slots.value[2].taskId ? [{ id: big3Slots.value[2].taskId }] : [],
  set: () => {}
})

function handleDrop(index: number, evt: any) {
  dragoverIndex.value = null
  // The added element comes from clone — it has .id and .title
  const added = evt?.added?.element
  if (!added) return
  assignSlot(index, added.id, added.title)
}

function handleClear(index: number) {
  clearSlot(index)
}
</script>

<template>
  <div class="big-three-card">
    <div class="card-header">
      <h2 class="card-title">Today's Big 3</h2>
      <span class="card-subtitle">Drag tasks from the left into your focus zones</span>
    </div>

    <div class="big-three-layout">
      <!-- LEFT: Task Pool -->
      <div class="task-pool">
        <template v-if="hasAnyTasks">
          <div
            v-for="[key, group] in visibleGroups"
            :key="key"
            class="pool-section"
          >
            <div class="section-header">
              <span
                class="section-accent"
                :style="group.color ? { backgroundColor: group.color } : {}"
              />
              <span class="section-label">{{ group.label }}</span>
              <span class="section-count">{{ group.tasks.length }}</span>
            </div>

            <draggable
              :model-value="group.tasks"
              :group="{ name: 'big3', pull: 'clone', put: false }"
              item-key="id"
              :animation="150"
              ghost-class="ghost-card"
              chosen-class="chosen-card"
              drag-class="drag-card"
              :force-fallback="true"
              fallback-class="sortable-fallback"
              :fallback-tolerance="3"
              tag="div"
              class="pool-drag-area"
            >
              <template #item="{ element }">
                <TaskPoolCard :task="element" />
              </template>
            </draggable>
          </div>
        </template>
        <div v-else class="pool-empty">
          No tasks yet — create one below!
        </div>
      </div>

      <!-- RIGHT: Drop Zones -->
      <div class="drop-zones">
        <div
          v-for="(slot, index) in big3Slots"
          :key="index"
          class="zone-wrapper"
          @dragenter="dragoverIndex = index"
          @dragleave="dragoverIndex = null"
        >
          <draggable
            :model-value="index === 0 ? zone0 : index === 1 ? zone1 : zone2"
            :group="{ name: 'big3', pull: false, put: true }"
            item-key="id"
            :max="1"
            ghost-class="ghost-zone"
            class="zone-drag-area"
            @change="(evt: any) => handleDrop(index, evt)"
            @dragenter="dragoverIndex = index"
          >
            <template #item>
              <div />
            </template>
            <template #header>
              <BigThreeSlot
                :slot="slot"
                :index="index"
                :is-dragover="dragoverIndex === index && !slot.title.trim()"
                @clear="handleClear"
              />
            </template>
          </draggable>
        </div>

        <!-- Start My Day button -->
        <button
          class="start-day-button"
          :class="{ 'start-day-button--ready': allSlotsAssigned }"
          :disabled="!allSlotsAssigned"
          type="button"
          @click="startMyDay"
        >
          Start My Day
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.big-three-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-6);
  background: var(--surface-primary);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
}

.card-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.card-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.card-subtitle {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.big-three-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-5);
  min-height: 280px;
}

.task-pool {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-height: 400px;
  overflow-y: auto;
  padding-right: var(--space-2);
  scrollbar-width: thin;
  scrollbar-color: var(--glass-border) transparent;
}

.task-pool::-webkit-scrollbar {
  width: 4px;
}

.task-pool::-webkit-scrollbar-track {
  background: transparent;
}

.task-pool::-webkit-scrollbar-thumb {
  background: var(--glass-border);
  border-radius: 2px;
}

.pool-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.section-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) 0;
}

.section-accent {
  width: 3px;
  height: 14px;
  border-radius: 2px;
  flex-shrink: 0;
}

.section-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.section-count {
  font-size: 0.65rem;
  color: var(--text-muted);
  background: var(--glass-bg-soft);
  padding: 0 var(--space-1);
  border-radius: var(--radius-sm);
}

.pool-drag-area {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.pool-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  color: var(--text-muted);
  font-size: 0.85rem;
}

.drop-zones {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  justify-content: center;
}

.zone-wrapper {
  min-height: 48px;
}

.zone-drag-area {
  min-height: 48px;
}

/* Ghost classes for drag feedback */
.ghost-card {
  opacity: 0.4;
  background: rgba(78, 205, 196, 0.08) !important;
  border: 2px dashed var(--brand-primary) !important;
  border-radius: var(--radius-md) !important;
}

.chosen-card {
  opacity: 1;
  transform: scale(1.02);
  z-index: 1000;
}

.drag-card {
  opacity: 1;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  cursor: grabbing;
}

.ghost-zone {
  display: none;
}

.start-day-button {
  padding: var(--space-3) var(--space-6);
  background: var(--glass-bg-soft);
  color: var(--brand-primary);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-md);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  backdrop-filter: blur(8px);
  transition: background 0.2s ease, opacity 0.2s ease, box-shadow 0.2s ease;
  align-self: center;
  min-width: 160px;
  margin-top: var(--space-2);
}

.start-day-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.start-day-button--ready {
  animation: pulse-teal 2s ease-in-out infinite;
}

.start-day-button--ready:hover {
  background: rgba(78, 205, 196, 0.12);
}

@keyframes pulse-teal {
  0%, 100% { box-shadow: 0 0 0 0 rgba(78, 205, 196, 0.4); }
  50% { box-shadow: 0 0 20px 4px rgba(78, 205, 196, 0.2); }
}

@media (prefers-reduced-motion: reduce) {
  .start-day-button--ready { animation: none; }
}

/* Mobile: stack vertically */
@media (max-width: 768px) {
  .big-three-layout {
    grid-template-columns: 1fr;
    gap: var(--space-4);
  }

  .task-pool {
    max-height: 200px;
    flex-direction: row;
    flex-wrap: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    padding-right: 0;
    padding-bottom: var(--space-2);
  }

  .pool-section {
    min-width: 200px;
    flex-shrink: 0;
  }
}
</style>
