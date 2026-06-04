<template>
  <div>
    <!-- TASK-1812: Lanes Section Header -->
    <div class="lanes-divider" />
    <div class="section-header">
      <h3 class="section-title">
        <Route :size="16" class="section-icon" />
        Lanes
      </h3>
      <button class="add-lane-btn" title="Add lane" @click="startCreate">
        <Plus :size="14" />
      </button>
    </div>

    <!-- Inline create input -->
    <div v-if="creating" class="lane-create-row">
      <input
        ref="createInput"
        v-model="newLaneName"
        class="lane-input"
        placeholder="Lane name…"
        @keydown.enter="commitCreate"
        @keydown.esc="cancelCreate"
        @blur="commitCreate"
      >
    </div>

    <!-- Lane list -->
    <nav class="lanes-list" aria-label="Lanes">
      <div v-if="laneStore.lanes.length === 0 && !creating" class="lanes-empty">
        No lanes yet
      </div>
      <div
        v-for="lane in laneStore.lanes"
        :key="lane.id"
        class="lane-item"
        :class="{ 'is-active': route.params.laneId === lane.id }"
      >
        <BaseNavItem
          :active="route.params.laneId === lane.id"
          @click="goToLane(lane.id)"
        >
          <template #icon>
            <span class="lane-dot" :style="{ background: laneColor(lane.color) }" />
          </template>
          {{ lane.name }}
        </BaseNavItem>
        <button class="lane-delete-btn" title="Delete lane" @click.stop="askDelete(lane)">
          <Trash2 :size="13" />
        </button>
      </div>
    </nav>

    <ConfirmationModal
      :is-open="!!laneToDelete"
      title="Delete lane?"
      :message="laneToDelete ? `Tasks in “${laneToDelete.name}” will be unassigned from the lane. This cannot be undone.` : ''"
      confirm-text="Delete"
      @confirm="executeDelete"
      @cancel="laneToDelete = null"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Route, Plus, Trash2 } from 'lucide-vue-next'
import { useMessage } from 'naive-ui'
import { useLaneStore } from '@/stores/lanes'
import type { Lane } from '@/types/tasks'
import BaseNavItem from '@/components/base/BaseNavItem.vue'
import ConfirmationModal from '@/components/common/ConfirmationModal.vue'

const router = useRouter()
const route = useRoute()
const laneStore = useLaneStore()
const message = useMessage()

const creating = ref(false)
const newLaneName = ref('')
const createInput = ref<HTMLInputElement | null>(null)
const laneToDelete = ref<Lane | null>(null)

const laneColor = (color: string | string[]) => Array.isArray(color) ? color[0] : color

const goToLane = (laneId: string) => {
  router.push({ name: 'lane', params: { laneId } })
}

const startCreate = async () => {
  creating.value = true
  newLaneName.value = ''
  await nextTick()
  createInput.value?.focus()
}

const cancelCreate = () => {
  creating.value = false
  newLaneName.value = ''
}

let committing = false
const commitCreate = async () => {
  if (committing) return
  const name = newLaneName.value.trim()
  if (!name) { cancelCreate(); return }
  committing = true
  try {
    const lane = await laneStore.createLane({ name })
    creating.value = false
    newLaneName.value = ''
    if (lane) goToLane(lane.id)
  } catch (e) {
    console.error('[LANES] Create failed:', e)
    message.error('Failed to create lane')
  } finally {
    committing = false
  }
}

const askDelete = (lane: Lane) => {
  laneToDelete.value = lane
}

const executeDelete = async () => {
  const lane = laneToDelete.value
  laneToDelete.value = null
  if (!lane) return
  try {
    await laneStore.deleteLane(lane.id)
    if (route.params.laneId === lane.id) router.push({ name: 'all-tasks' })
  } catch (e) {
    console.error('[LANES] Delete failed:', e)
    message.error('Failed to delete lane')
  }
}
</script>

<style scoped>
.lanes-divider {
  height: 1px;
  background: var(--glass-border);
  margin: var(--space-4) 0 var(--space-3);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-2);
}

.section-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  font-weight: var(--font-bold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin: 0;
}

.section-icon {
  color: var(--text-tertiary);
}

.add-lane-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--glass-bg-base);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.add-lane-btn:hover {
  background: var(--glass-bg-soft);
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.lane-create-row {
  margin-bottom: var(--space-2);
}

.lane-input {
  width: 100%;
  padding: var(--space-1_5) var(--space-2_5);
  background: var(--glass-bg-base);
  border: 1px solid var(--glass-border-hover);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-family: inherit;
}

.lane-input:focus {
  outline: none;
  border-color: var(--brand-primary);
}

.lanes-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.lanes-empty {
  padding: var(--space-2) var(--space-2_5);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  font-style: italic;
}

.lane-item {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.lane-item :deep(.nav-item),
.lane-item :deep(button) {
  flex: 1;
  min-width: 0;
}

.lane-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: var(--radius-full);
}

.lane-delete-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  border-radius: var(--radius-md);
  cursor: pointer;
  opacity: 0;
  transition: all var(--duration-fast);
}

.lane-item:hover .lane-delete-btn {
  opacity: 1;
}

.lane-delete-btn:hover {
  background: var(--glass-bg-soft);
  color: var(--danger);
}
</style>
