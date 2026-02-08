<template>
  <div class="quick-task-wrapper" ref="wrapperRef">
    <button
      class="quick-task-trigger"
      title="Quick Tasks"
      @click="toggleDropdown"
    >
      <Zap :size="16" />
    </button>

    <Teleport to="body">
      <Transition name="dropdown">
        <div
          v-if="isOpen"
          class="quick-task-dropdown"
          :style="dropdownPosition"
          ref="dropdownRef"
          @keydown="handleKeydown"
          tabindex="-1"
        >
          <!-- Quick Add Input -->
          <div class="quick-add-row">
            <input
              ref="inputRef"
              v-model="newTaskTitle"
              class="quick-add-input"
              placeholder="Pin a new quick task..."
              dir="auto"
              @keydown.enter.stop="addQuickPin"
              @keydown.esc.stop="isOpen = false"
            />
            <button
              v-if="newTaskTitle.trim()"
              class="quick-add-btn"
              title="Add pin"
              @click="addQuickPin"
            >
              <Plus :size="14" />
            </button>
          </div>

          <div v-if="pinnedItems.length > 0 || frequentItems.length > 0" class="section-divider" />

          <!-- Pinned Section -->
          <template v-if="pinnedItems.length > 0">
            <div class="section-header">
              <Pin :size="11" class="section-icon" />
              <span>Pinned</span>
            </div>
            <div
              v-for="(item, index) in pinnedItems"
              :key="item.key"
              class="quick-item"
              :class="{ 'quick-item--focused': focusedIndex === index }"
              @click="handleSelect(item)"
              @mouseenter="focusedIndex = index"
            >
              <span
                v-if="item.projectColor"
                class="project-dot"
                :style="{ backgroundColor: item.projectColor }"
              />
              <span class="quick-item-title" dir="auto">{{ item.title }}</span>
              <button
                class="quick-item-action"
                title="Unpin"
                @click.stop="handleUnpin(item.sourceId)"
              >
                <X :size="12" />
              </button>
              <button
                class="quick-item-play"
                title="Start Timer"
                @click.stop="handleSelect(item)"
              >
                <Play :size="12" />
              </button>
            </div>
          </template>

          <!-- Frequent Section -->
          <template v-if="frequentItems.length > 0">
            <div v-if="pinnedItems.length > 0" class="section-divider" />
            <div class="section-header">
              <TrendingUp :size="11" class="section-icon" />
              <span>Frequent</span>
            </div>
            <div
              v-for="(item, index) in frequentItems"
              :key="item.key"
              class="quick-item"
              :class="{ 'quick-item--focused': focusedIndex === pinnedItems.length + index }"
              @click="handleSelect(item)"
              @mouseenter="focusedIndex = pinnedItems.length + index"
            >
              <span
                v-if="item.projectColor"
                class="project-dot"
                :style="{ backgroundColor: item.projectColor }"
              />
              <span class="quick-item-title" dir="auto">{{ item.title }}</span>
              <span class="pomodoro-badge">{{ item.frequency }}</span>
              <button
                v-if="!item.isPinned"
                class="quick-item-action"
                title="Pin as Quick Task"
                @click.stop="handlePin(item)"
              >
                <Pin :size="12" />
              </button>
              <button
                class="quick-item-play"
                title="Start Timer"
                @click.stop="handleSelect(item)"
              >
                <Play :size="12" />
              </button>
            </div>
          </template>

          <!-- Empty State (only when no input and no items) -->
          <div v-if="pinnedItems.length === 0 && frequentItems.length === 0 && !newTaskTitle.trim()" class="empty-state">
            <span>Type above to pin your common tasks</span>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Click-outside backdrop -->
    <Teleport to="body">
      <div
        v-if="isOpen"
        class="quick-task-backdrop"
        @click="isOpen = false"
      />
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { Zap, Pin, Play, X, TrendingUp, Plus } from 'lucide-vue-next'
import { useQuickTasks } from '@/composables/useQuickTasks'
import type { QuickTaskItem } from '@/types/quickTasks'

const { quickTaskItems, unpinTask, pinTask, selectAndStartTimer } = useQuickTasks()

const isOpen = ref(false)
const focusedIndex = ref(-1)
const newTaskTitle = ref('')
const wrapperRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)

const pinnedItems = computed(() => quickTaskItems.value.filter(i => i.type === 'pinned'))
const frequentItems = computed(() => quickTaskItems.value.filter(i => i.type === 'frequent'))
const allItems = computed(() => [...pinnedItems.value, ...frequentItems.value])

const dropdownPosition = computed(() => {
    if (!wrapperRef.value) return {}
    const rect = wrapperRef.value.getBoundingClientRect()
    const dropdownWidth = 280
    let left = rect.left + rect.width / 2 - dropdownWidth / 2
    if (left + dropdownWidth > window.innerWidth - 8) {
        left = window.innerWidth - dropdownWidth - 8
    }
    if (left < 8) left = 8

    return {
        position: 'fixed' as const,
        top: `${rect.bottom + 8}px`,
        left: `${left}px`,
        width: `${dropdownWidth}px`
    }
})

const toggleDropdown = () => {
    isOpen.value = !isOpen.value
    if (isOpen.value) {
        focusedIndex.value = -1
        nextTick(() => inputRef.value?.focus())
    }
}

const addQuickPin = async () => {
    const title = newTaskTitle.value.trim()
    if (!title) return
    await pinTask(title)
    newTaskTitle.value = ''
    // Keep dropdown open so user can add more
    nextTick(() => inputRef.value?.focus())
}

const handleSelect = async (item: QuickTaskItem) => {
    isOpen.value = false
    await selectAndStartTimer(item)
}

const handleUnpin = async (pinId: string) => {
    await unpinTask(pinId)
}

const handlePin = async (item: QuickTaskItem) => {
    const { useTaskStore } = await import('@/stores/tasks')
    const taskStore = useTaskStore()
    const task = taskStore.tasks.find(t => t.id === item.sourceId)
    if (task) {
        const { pinFromTask } = useQuickTasks()
        await pinFromTask(task)
    }
}

const handleKeydown = (e: KeyboardEvent) => {
    // Don't intercept arrows/enter when input is focused
    if (document.activeElement === inputRef.value) return

    const total = allItems.value.length
    if (total === 0) return

    switch (e.key) {
        case 'ArrowDown':
            e.preventDefault()
            focusedIndex.value = (focusedIndex.value + 1) % total
            break
        case 'ArrowUp':
            e.preventDefault()
            focusedIndex.value = (focusedIndex.value - 1 + total) % total
            break
        case 'Enter':
            e.preventDefault()
            if (focusedIndex.value >= 0 && focusedIndex.value < total) {
                handleSelect(allItems.value[focusedIndex.value])
            }
            break
        case 'Escape':
            e.preventDefault()
            isOpen.value = false
            break
    }
}

watch(isOpen, (open) => {
    if (!open) {
        focusedIndex.value = -1
        newTaskTitle.value = ''
    }
})
</script>

<style scoped>
.quick-task-wrapper {
    position: relative;
    display: flex;
    align-items: center;
}

.quick-task-trigger {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    background: transparent;
    border: none;
    color: var(--text-muted);
    border-radius: var(--radius-6);
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease-out);
}

.quick-task-trigger:hover {
    background: var(--surface-hover);
    color: var(--color-work);
}

.quick-task-backdrop {
    position: fixed;
    inset: 0;
    z-index: calc(var(--z-dropdown) - 1);
}

.quick-task-dropdown {
    background: var(--overlay-component-bg);
    backdrop-filter: var(--overlay-component-backdrop);
    -webkit-backdrop-filter: var(--overlay-component-backdrop);
    border: var(--overlay-component-border);
    border-radius: var(--radius-lg);
    box-shadow: var(--overlay-component-shadow);
    padding: var(--space-2) 0;
    z-index: var(--z-dropdown);
    max-height: 400px;
    overflow-y: auto;
    outline: none;
}

/* Quick Add Input */
.quick-add-row {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1_5) var(--space-3);
}

.quick-add-input {
    flex: 1;
    background: var(--glass-bg-medium);
    border: 1px solid var(--glass-bg-heavy);
    border-radius: var(--radius-md);
    padding: var(--space-1_5) var(--space-2);
    font-size: var(--text-sm);
    color: var(--text-primary);
    outline: none;
    transition: border-color var(--duration-fast);
    unicode-bidi: plaintext;
    text-align: start;
}

.quick-add-input::placeholder {
    color: var(--text-muted);
    opacity: 0.6;
}

.quick-add-input:focus {
    border-color: var(--glass-border-hover);
}

.quick-add-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: var(--glass-bg-heavy);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    cursor: pointer;
    color: var(--text-secondary);
    transition: all var(--duration-fast);
    flex-shrink: 0;
}

.quick-add-btn:hover {
    background: var(--state-hover-bg);
    border-color: var(--color-work);
    color: var(--color-work);
}

.section-header {
    display: flex;
    align-items: center;
    gap: var(--space-1_5);
    padding: var(--space-1_5) var(--space-3);
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.section-icon {
    opacity: 0.6;
}

.section-divider {
    height: 1px;
    background: var(--glass-bg-heavy);
    margin: var(--space-1) 0;
}

.quick-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    cursor: pointer;
    transition: background var(--duration-fast);
}

.quick-item:hover,
.quick-item--focused {
    background: var(--glass-bg-heavy);
}

.project-dot {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-full);
    flex-shrink: 0;
}

.quick-item-title {
    flex: 1;
    font-size: var(--text-sm);
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    unicode-bidi: plaintext;
    text-align: start;
}

.pomodoro-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 18px;
    padding: 0 var(--space-1);
    background: var(--glass-bg-heavy);
    border-radius: var(--radius-md);
    font-size: var(--text-xs);
    font-weight: 700;
    color: var(--text-muted);
    flex-shrink: 0;
}

.quick-item-action,
.quick-item-play {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    color: var(--text-muted);
    opacity: 0;
    transition: all var(--duration-fast);
    flex-shrink: 0;
}

.quick-item:hover .quick-item-action,
.quick-item:hover .quick-item-play,
.quick-item--focused .quick-item-action,
.quick-item--focused .quick-item-play {
    opacity: 1;
}

.quick-item-action:hover {
    background: var(--surface-hover);
    color: var(--text-secondary);
}

.quick-item-play:hover {
    background: var(--state-hover-bg);
    color: var(--color-work);
}

.empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-3) var(--space-4);
    color: var(--text-muted);
    font-size: var(--text-xs);
    text-align: center;
    opacity: 0.7;
}

/* Dropdown transition */
.dropdown-enter-active {
    animation: menuSlideIn var(--duration-fast) var(--ease-out);
}

.dropdown-leave-active {
    animation: menuSlideIn var(--duration-fast) var(--ease-out) reverse;
}

@keyframes menuSlideIn {
    from { opacity: 0; transform: scale(0.96) translateY(-4px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
}
</style>
