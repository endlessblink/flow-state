<template>
  <div class="mobile-layout" :dir="isRTL ? 'rtl' : 'ltr'">
    <!-- Pull-down indicator (shows during gesture) -->
    <div
      v-if="!isFullScreenView && !showPanel"
      class="pull-indicator"
      :class="{ visible: pullDistance > 0, triggered: pullTriggered }"
      :style="{ transform: `translateY(${Math.min(pullDistance * 0.5, 60)}px)` }"
    >
      <ChevronDown :size="18" />
      <span>{{ pullTriggered ? 'Release to open' : 'Pull down for quick actions' }}</span>
    </div>

    <!-- Command Center Panel (slides down from top) -->
    <Transition name="panel-slide">
      <div v-if="showPanel" class="command-panel-overlay" @click.self="closePanel">
        <div class="command-panel">
          <!-- Handle bar -->
          <div class="panel-handle" @click="closePanel">
            <div class="handle-bar" />
          </div>

          <!-- Quick Task Input -->
          <div class="panel-section">
            <div class="task-input-row">
              <input
                ref="taskInputRef"
                v-model="newTaskTitle"
                type="text"
                class="task-input"
                placeholder="Add a task..."
                enterkeyhint="done"
                @keydown.enter="handleAddTask"
              />
              <button
                class="voice-btn"
                :class="{ recording: isRecording }"
                @click="toggleRecording"
              >
                <Mic :size="20" />
              </button>
              <button
                v-if="newTaskTitle.trim()"
                class="send-btn"
                @click="handleAddTask"
              >
                <Send :size="18" />
              </button>
            </div>
            <p v-if="isRecording" class="recording-label">Listening...</p>
            <p v-if="taskAdded" class="task-added-label">Task added!</p>
          </div>

          <!-- Search -->
          <div class="panel-section">
            <div class="search-row">
              <Search :size="18" class="search-icon" />
              <input
                v-model="searchQuery"
                type="text"
                class="search-input"
                placeholder="Search tasks..."
                @input="handleSearch"
              />
              <button v-if="searchQuery" class="clear-search" @click="clearSearch">
                <X :size="16" />
              </button>
            </div>
            <!-- Search Results -->
            <div v-if="searchResults.length > 0" class="search-results">
              <div
                v-for="task in searchResults.slice(0, 5)"
                :key="task.id"
                class="search-result-item"
                @click="openTask(task)"
              >
                <CheckCircle v-if="task.status === 'done'" :size="16" class="result-icon done" />
                <Circle v-else :size="16" class="result-icon" />
                <span class="result-title">{{ task.title }}</span>
                <span v-if="task.projectId" class="result-project">{{ getProjectName(task.projectId) }}</span>
              </div>
            </div>
            <p v-if="searchQuery && searchResults.length === 0" class="no-results">No tasks found</p>
          </div>

          <!-- Quick Actions Grid -->
          <div class="panel-section actions-grid">
            <button class="action-tile" @click="goToQuickSort">
              <Zap :size="22" />
              <span>Quick Sort</span>
              <span v-if="uncategorizedCount > 0" class="action-badge">{{ uncategorizedCount }}</span>
            </button>
            <button class="action-tile" @click="goToTimer">
              <Timer :size="22" />
              <span>Timer</span>
            </button>
            <button class="action-tile" @click="goToToday">
              <CalendarCheck :size="22" />
              <span>Today</span>
            </button>
            <button class="action-tile" @click="openSettings">
              <Settings :size="22" />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Hide header on full-screen views like Quick Sort -->
    <header v-if="!isFullScreenView" class="mobile-header">
      <h1>FlowState</h1>
    </header>
    <main
      ref="contentRef"
      class="mobile-content"
      :class="{ 'full-screen': isFullScreenView }"
      @touchstart.passive="onTouchStart"
      @touchmove.passive="onTouchMove"
      @touchend.passive="onTouchEnd"
    >
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
    <!-- Hide nav on full-screen views -->
    <MobileNav v-if="!isFullScreenView" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed, ref, nextTick, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  ChevronDown, Mic, Send, Search, X, Zap, Timer,
  CalendarCheck, Settings, CheckCircle, Circle
} from 'lucide-vue-next'
import MobileNav from '@/mobile/components/MobileNav.vue'
import { useTaskStore } from '@/stores/tasks'
import { useProjectStore } from '@/stores/projects'
import { useUIStore } from '@/stores/ui'
import { useWhisperSpeech } from '@/composables/useWhisperSpeech'

const router = useRouter()
const route = useRoute()
const taskStore = useTaskStore()
const projectStore = useProjectStore()
const uiStore = useUIStore()

// Routes that should be full-screen (no header/nav)
const fullScreenRoutes = ['mobile-quick-sort']

const isFullScreenView = computed(() => {
  return fullScreenRoutes.includes(route.name as string)
})

// RTL detection based on browser language
const isRTL = computed(() => {
  const lang = navigator.language || navigator.languages?.[0] || 'en'
  return lang.startsWith('he') || lang.startsWith('iw')
})

// ─── Command Panel State ───
const showPanel = ref(false)
const taskInputRef = ref<HTMLInputElement | null>(null)
const newTaskTitle = ref('')
const taskAdded = ref(false)
const searchQuery = ref('')
const searchResults = ref<typeof taskStore.tasks>([])

// Voice recording
const { isRecording, start: startRecording, stop: stopRecording, transcript } = useWhisperSpeech({
  onResult: (result) => {
    newTaskTitle.value = result.transcript
  }
})

// Watch transcript changes
watch(transcript, (val) => {
  if (val) {
    newTaskTitle.value = val
  }
})

// Uncategorized task count for Quick Sort badge
const uncategorizedCount = computed(() => {
  return taskStore.tasks.filter(t =>
    !t.projectId && t.status !== 'done' && !t._soft_deleted
  ).length
})

function getProjectName(projectId: string): string {
  const project = projectStore.projects.find(p => p.id === projectId)
  return project?.name || ''
}

function closePanel() {
  showPanel.value = false
  newTaskTitle.value = ''
  searchQuery.value = ''
  searchResults.value = []
  taskAdded.value = false
}

async function handleAddTask() {
  const title = newTaskTitle.value.trim()
  if (!title) return
  await taskStore.createTask({ title })
  newTaskTitle.value = ''
  taskAdded.value = true
  setTimeout(() => { taskAdded.value = false }, 1500)
}

function toggleRecording() {
  if (isRecording.value) {
    stopRecording()
  } else {
    startRecording()
  }
}

function handleSearch() {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) {
    searchResults.value = []
    return
  }
  searchResults.value = taskStore.tasks.filter(t =>
    !t._soft_deleted && t.title.toLowerCase().includes(q)
  )
}

function clearSearch() {
  searchQuery.value = ''
  searchResults.value = []
}

function openTask(task: { id: string }) {
  closePanel()
  // Navigate to the task in the inbox/list view
  router.push({ path: '/tasks', query: { taskId: task.id } })
}

function goToQuickSort() {
  closePanel()
  router.push({ name: 'mobile-quick-sort' })
}

function goToTimer() {
  closePanel()
  router.push('/timer')
}

function goToToday() {
  closePanel()
  router.push('/today')
}

function openSettings() {
  closePanel()
  uiStore.openSettingsModal()
}

// ─── Pull-down Gesture ───
const contentRef = ref<HTMLElement | null>(null)
const touchStartY = ref(0)
const pullDistance = ref(0)
const pullTriggered = ref(false)
const isPulling = ref(false)

const PULL_THRESHOLD = 80

function onTouchStart(e: TouchEvent) {
  if (isFullScreenView.value || showPanel.value) return
  const el = contentRef.value
  if (el && el.scrollTop <= 0) {
    touchStartY.value = e.touches[0].clientY
    isPulling.value = true
    pullTriggered.value = false
  }
}

function onTouchMove(e: TouchEvent) {
  if (!isPulling.value || isFullScreenView.value || showPanel.value) return
  const el = contentRef.value
  if (el && el.scrollTop > 0) {
    isPulling.value = false
    pullDistance.value = 0
    return
  }
  const currentY = e.touches[0].clientY
  const delta = currentY - touchStartY.value
  if (delta > 0) {
    pullDistance.value = delta
    if (delta >= PULL_THRESHOLD && !pullTriggered.value) {
      pullTriggered.value = true
    }
  } else {
    pullDistance.value = 0
  }
}

function onTouchEnd() {
  if (pullTriggered.value) {
    showPanel.value = true
    nextTick(() => {
      taskInputRef.value?.focus()
    })
  }
  isPulling.value = false
  pullDistance.value = 0
  pullTriggered.value = false
}

onMounted(() => {
  if (route.path === '/' || route.name === 'canvas') {
    router.replace('/tasks')
  }
})
</script>

<style scoped>
.mobile-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  width: 100%;
  background: var(--app-background-gradient);
  overflow: hidden;
}

.mobile-header {
  height: var(--space-14);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--glass-bg-medium);
  backdrop-filter: blur(var(--blur-md));
  border-bottom: 1px solid var(--glass-border);
  z-index: 10;
}

.mobile-header h1 {
  font-size: var(--text-lg);
  font-weight: 800;
  margin: 0;
  background: linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.mobile-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding-bottom: var(--space-20);
  position: relative;
  -webkit-overflow-scrolling: touch;
}

.mobile-content.full-screen {
  padding-bottom: 0;
  overflow: hidden;
}

/* ─── Pull-down indicator ─── */
.pull-indicator {
  position: absolute;
  top: var(--space-14);
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1_5);
  padding: var(--space-2_5) 0;
  color: var(--text-tertiary);
  font-size: var(--text-meta);
  font-weight: 600;
  opacity: 0;
  transition: opacity var(--duration-fast) ease;
  z-index: 5;
  pointer-events: none;
}

.pull-indicator.visible {
  opacity: 1;
}

.pull-indicator.triggered {
  color: var(--brand-primary);
}

/* ─── Command Panel Overlay ─── */
.command-panel-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.command-panel {
  background: var(--surface-primary);
  border-bottom-left-radius: var(--radius-xl);
  border-bottom-right-radius: var(--radius-xl);
  padding: var(--space-2) var(--space-4) var(--space-5);
  box-shadow: 0 var(--space-2) var(--space-8) rgba(0, 0, 0, 0.4);
  max-height: 80vh;
  overflow-y: auto;
}

.panel-handle {
  display: flex;
  justify-content: center;
  padding: var(--space-2) 0 var(--space-3);
  cursor: pointer;
}

.handle-bar {
  width: var(--space-10);
  height: var(--space-1);
  border-radius: var(--radius-xs);
  background: var(--border-hover);
}

/* ─── Panel Sections ─── */
.panel-section {
  margin-bottom: var(--space-4);
}

/* Task Input */
.task-input-row {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.task-input {
  flex: 1;
  height: var(--btn-lg);
  padding: 0 var(--space-3_5);
  background: var(--glass-bg-light);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  font-size: var(--text-base);
  outline: none;
  transition: border-color var(--duration-normal);
}

.task-input:focus {
  border-color: var(--brand-primary);
}

.task-input::placeholder {
  color: var(--text-tertiary);
}

.voice-btn,
.send-btn {
  width: var(--btn-lg);
  height: var(--btn-lg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-medium);
  background: var(--glass-bg-light);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--duration-normal);
  flex-shrink: 0;
}

.voice-btn:active,
.send-btn:active {
  transform: scale(0.95);
}

.voice-btn.recording {
  background: var(--danger-bg-medium);
  border-color: var(--danger-border-strong);
  color: var(--color-priority-high);
  animation: pulse-recording 1.2s infinite;
}

.send-btn {
  background: var(--brand-primary);
  border-color: transparent;
  color: white;
}

.recording-label {
  margin: var(--space-1_5) 0 0;
  font-size: var(--text-xs);
  color: var(--color-priority-high);
  font-weight: 600;
}

.task-added-label {
  margin: var(--space-1_5) 0 0;
  font-size: var(--text-xs);
  color: var(--color-work);
  font-weight: 600;
}

/* Search */
.search-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  height: var(--space-10);
  padding: 0 var(--space-3);
  background: var(--glass-bg-weak);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
}

.search-icon {
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--text-primary);
  font-size: var(--text-sm);
  outline: none;
}

.search-input::placeholder {
  color: var(--text-tertiary);
}

.clear-search {
  background: none;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: var(--space-1);
  display: flex;
}

.search-results {
  margin-top: var(--space-2);
  max-height: var(--space-16);
  overflow-y: auto;
}

.search-result-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2_5) var(--space-3);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--duration-fast);
}

.search-result-item:active {
  background: var(--glass-bg-light);
}

.result-icon {
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.result-icon.done {
  color: var(--color-work);
}

.result-title {
  flex: 1;
  font-size: var(--text-sm);
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-project {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  background: var(--glass-bg-light);
  padding: var(--space-0_5) var(--space-2);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.no-results {
  margin: var(--space-2) 0 0;
  font-size: var(--text-meta);
  color: var(--text-tertiary);
  text-align: center;
}

/* Actions Grid */
.actions-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-2_5);
  margin-bottom: 0;
}

.action-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1_5);
  padding: var(--space-3_5) var(--space-2);
  background: var(--glass-bg-weak);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--duration-fast);
  position: relative;
}

.action-tile:active {
  transform: scale(0.95);
  background: var(--glass-bg-light);
}

.action-badge {
  position: absolute;
  top: var(--space-1_5);
  right: var(--space-1_5);
  min-width: var(--space-4_5);
  height: var(--space-4_5);
  padding: 0 var(--space-1_25);
  border-radius: var(--radius-full);
  background: var(--brand-primary);
  color: white;
  font-size: var(--text-xs);
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ─── Panel Slide Transition ─── */
.panel-slide-enter-active {
  transition: opacity var(--duration-normal) ease;
}

.panel-slide-enter-active .command-panel {
  animation: slideDown var(--duration-slow) cubic-bezier(0.16, 1, 0.3, 1);
}

.panel-slide-leave-active {
  transition: opacity var(--duration-normal) ease;
}

.panel-slide-leave-active .command-panel {
  animation: slideUp var(--duration-normal) ease-in;
}

.panel-slide-enter-from,
.panel-slide-leave-to {
  opacity: 0;
}

@keyframes slideDown {
  from { transform: translateY(-100%); }
  to { transform: translateY(0); }
}

@keyframes slideUp {
  from { transform: translateY(0); }
  to { transform: translateY(-100%); }
}

@keyframes pulse-recording {
  0%, 100% { box-shadow: 0 0 0 0 var(--danger-shadow-strong); }
  50% { box-shadow: 0 0 0 var(--space-2) rgba(239, 68, 68, 0); }
}

/* ─── RTL Layout Adjustments ─── */
.mobile-layout[dir="rtl"] {
  text-align: right;
}

.mobile-layout[dir="rtl"] .mobile-header {
  direction: ltr;
}

.mobile-layout[dir="rtl"] .task-input-row {
  flex-direction: row-reverse;
}

.mobile-layout[dir="rtl"] .search-row {
  flex-direction: row-reverse;
}
</style>
