<template>
  <div ref="wrapperRef" class="quick-task-wrapper">
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
          ref="dropdownRef"
          class="quick-task-dropdown"
          :style="dropdownPosition"
          tabindex="-1"
          @keydown="handleKeydown"
        >
          <!-- Search / Pin Input (authenticated only) -->
          <div v-if="authStore.isAuthenticated" class="quick-add-row">
            <Search :size="14" class="search-icon" />
            <input
              ref="inputRef"
              v-model="newTaskTitle"
              class="quick-add-input"
              placeholder="Search or pin a task..."
              dir="auto"
              @keydown.enter.stop="handleInputEnter"
              @keydown.esc.stop="isOpen = false"
            >
            <button
              v-if="newTaskTitle.trim() && !isSearching"
              class="quick-add-btn"
              title="Add pin"
              @click="addQuickPin"
            >
              <Plus :size="14" />
            </button>
          </div>
          <!-- Guest mode notice -->
          <div v-else class="guest-notice">
            <span>Sign in to use Quick Tasks</span>
          </div>

          <!-- Search Results -->
          <template v-if="isSearching && searchResults.length > 0">
            <div class="section-divider" />
            <div class="section-header">
              <Search :size="11" class="section-icon" />
              <span>Tasks</span>
            </div>
            <div
              v-for="(item, index) in searchResults"
              :key="item.key"
              class="quick-item"
              :class="{ 'quick-item--focused': focusedIndex === index }"
              @click="handleSearchSelect(item)"
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
                title="Pin this task"
                @click.stop="handlePinFromSearch(item)"
              >
                <Pin :size="12" />
              </button>
              <button
                class="quick-item-play"
                title="Start Timer"
                @click.stop="handleSearchSelect(item)"
              >
                <Play :size="12" />
              </button>
            </div>
            <!-- Pin as new option at bottom of search -->
            <div
              class="quick-item quick-item--create"
              :class="{ 'quick-item--focused': focusedIndex === searchResults.length }"
              @click="addQuickPin"
              @mouseenter="focusedIndex = searchResults.length"
            >
              <Plus :size="14" class="create-icon" />
              <span class="quick-item-title" dir="auto">Pin "{{ newTaskTitle.trim() }}"</span>
            </div>
          </template>

          <!-- Search: no results -->
          <template v-else-if="isSearching && searchResults.length === 0">
            <div class="section-divider" />
            <div
              class="quick-item quick-item--create"
              :class="{ 'quick-item--focused': focusedIndex === 0 }"
              @click="addQuickPin"
              @mouseenter="focusedIndex = 0"
            >
              <Plus :size="14" class="create-icon" />
              <span class="quick-item-title" dir="auto">Pin "{{ newTaskTitle.trim() }}"</span>
            </div>
          </template>

          <!-- Pinned Section (when not searching) -->
          <template v-if="!isSearching && pinnedItems.length > 0">
            <div v-if="authStore.isAuthenticated" class="section-divider" />
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

          <!-- Frequent Section (when not searching) -->
          <template v-if="!isSearching && frequentItems.length > 0">
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
                class="quick-item-action"
                title="Hide from Frequent"
                @click.stop="handleHideFrequent(item.sourceId)"
              >
                <X :size="12" />
              </button>
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

          <!-- Empty State (authenticated, no items, no input) -->
          <div v-if="authStore.isAuthenticated && !isSearching && pinnedItems.length === 0 && frequentItems.length === 0" class="empty-state">
            <span>Search tasks or type to pin</span>
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
import { Zap, Pin, Play, X, TrendingUp, Plus, Search } from 'lucide-vue-next'
import { useQuickTasks } from '@/composables/useQuickTasks'
import { useAuthStore } from '@/stores/auth'
import { useTaskStore } from '@/stores/tasks'
import { useProjectStore } from '@/stores/projects'
import type { QuickTaskItem } from '@/types/quickTasks'

const { quickTaskItems, unpinTask, pinTask, pinFromTask, selectAndStartTimer, loadPinnedTasks, dismissFromFrequent } = useQuickTasks()
const authStore = useAuthStore()
const taskStore = useTaskStore()
const projectStore = useProjectStore()

const isOpen = ref(false)
const focusedIndex = ref(-1)
const newTaskTitle = ref('')
const wrapperRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)

const pinnedItems = computed(() => quickTaskItems.value.filter(i => i.type === 'pinned'))
const frequentItems = computed(() => quickTaskItems.value.filter(i => i.type === 'frequent'))

// Search results: active tasks matching the input query
const searchQuery = computed(() => newTaskTitle.value.trim().toLowerCase())
const searchResults = computed(() => {
    if (!searchQuery.value || searchQuery.value.length < 2) return []

    const pinnedTitles = new Set(pinnedItems.value.map(p => p.title.toLowerCase()))
    const frequentIds = new Set(frequentItems.value.map(f => f.sourceId))

    return taskStore.tasks
        .filter(t =>
            t.status !== 'done' &&
            !t._soft_deleted &&
            t.title.toLowerCase().includes(searchQuery.value) &&
            !pinnedTitles.has(t.title.toLowerCase()) &&
            !frequentIds.has(t.id)
        )
        .slice(0, 8)
        .map(t => {
            const project = t.projectId && t.projectId !== 'uncategorized'
                ? projectStore.getProjectById(t.projectId)
                : null
            const projectColor = project?.color
                ? (Array.isArray(project.color) ? project.color[0] : project.color)
                : null
            return {
                key: `search-${t.id}`,
                type: 'search' as const,
                title: t.title,
                sourceId: t.id,
                projectId: t.projectId === 'uncategorized' ? null : t.projectId,
                projectName: project?.name || null,
                projectColor,
                priority: t.priority,
                frequency: 0,
                isPinned: false
            } satisfies QuickTaskItem
        })
})

const isSearching = computed(() => searchQuery.value.length >= 2)

const allItems = computed(() => {
    if (isSearching.value) return searchResults.value
    return [...pinnedItems.value, ...frequentItems.value]
})

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
    nextTick(() => inputRef.value?.focus())
}

const handleInputEnter = () => {
    if (isSearching.value) {
        // Only auto-select a search result if user explicitly navigated with arrow keys
        if (focusedIndex.value >= 0 && focusedIndex.value < allItems.value.length) {
            handleSearchSelect(allItems.value[focusedIndex.value] as QuickTaskItem)
        } else {
            // No explicit selection — pin the typed text as a new pin
            addQuickPin()
        }
    } else {
        addQuickPin()
    }
}

const handleSelect = async (item: QuickTaskItem) => {
    isOpen.value = false
    await selectAndStartTimer(item)
}

const handleSearchSelect = async (item: QuickTaskItem) => {
    isOpen.value = false
    const timerStore = (await import('@/stores/timer')).useTimerStore()
    await timerStore.startTimer(item.sourceId)
}

const handlePinFromSearch = async (item: QuickTaskItem) => {
    const task = taskStore.tasks.find(t => t.id === item.sourceId)
    if (task) {
        await pinFromTask(task)
        newTaskTitle.value = ''
        nextTick(() => inputRef.value?.focus())
    }
}

const handleUnpin = async (pinId: string) => {
    await unpinTask(pinId)
}

const handlePin = async (item: QuickTaskItem) => {
    const task = taskStore.tasks.find(t => t.id === item.sourceId)
    if (task) {
        await pinFromTask(task)
    }
}

const handleHideFrequent = (taskId: string) => {
    dismissFromFrequent(taskId)
}

const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
        e.preventDefault()
        isOpen.value = false
        return
    }

    // Allow arrow navigation even when input focused (for search results)
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const total = isSearching.value
            ? searchResults.value.length + 1 // +1 for "Pin as new" option
            : allItems.value.length
        if (total === 0) return

        e.preventDefault()
        if (e.key === 'ArrowDown') {
            focusedIndex.value = (focusedIndex.value + 1) % total
        } else {
            focusedIndex.value = (focusedIndex.value - 1 + total) % total
        }
        // Blur input so Enter triggers selection
        if (focusedIndex.value >= 0) inputRef.value?.blur()
        return
    }

    // Don't intercept other keys when input is focused
    if (document.activeElement === inputRef.value) return

    if (e.key === 'Enter') {
        e.preventDefault()
        const total = allItems.value.length
        if (focusedIndex.value >= 0 && focusedIndex.value < total) {
            if (isSearching.value) {
                handleSearchSelect(allItems.value[focusedIndex.value])
            } else {
                handleSelect(allItems.value[focusedIndex.value])
            }
        } else if (isSearching.value) {
            addQuickPin()
        }
    }
}

watch(isOpen, (open) => {
    if (open) {
        loadPinnedTasks() // refresh from DB (picks up KDE widget changes)
    }
    if (!open) {
        focusedIndex.value = -1
        newTaskTitle.value = ''
    }
})

// Reset focus when search query changes
watch(newTaskTitle, () => {
    focusedIndex.value = -1
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

/* Quick Add / Search Input */
.quick-add-row {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1_5) var(--space-3);
}

.search-icon {
    color: var(--text-muted);
    opacity: 0.5;
    flex-shrink: 0;
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
    word-break: break-word;
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

.quick-item--create {
    opacity: 0.7;
}

.quick-item--create:hover,
.quick-item--create.quick-item--focused {
    opacity: 1;
}

.create-icon {
    color: var(--text-muted);
    flex-shrink: 0;
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

.guest-notice {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-3) var(--space-4);
    color: var(--text-muted);
    font-size: var(--text-xs);
    text-align: center;
    opacity: 0.7;
    background: var(--glass-bg-soft);
    margin: var(--space-1_5) var(--space-3);
    border-radius: var(--radius-md);
    border: 1px solid var(--glass-border);
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
