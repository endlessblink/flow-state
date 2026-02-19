<template>
  <!-- LEFT SIDEBAR NAVIGATION - Extracted from App.vue -->
  <Transition name="sidebar-slide">
    <aside
      v-if="uiStore"
      v-show="uiStore.mainSidebarVisible"
      class="sidebar"
      aria-label="Main navigation"
      :aria-hidden="!uiStore.mainSidebarVisible"
    >
      <!-- App Header -->
      <div class="sidebar-header">
        <div class="app-brand">
          <AppLogo size="md" />
          <span class="brand-text">FlowState</span>
        </div>
        <BaseButton variant="secondary" size="md" @click="sidebar.openCreateProject">
          <Plus :size="14" />
          {{ $t('sidebar.create_project') }}
        </BaseButton>

        <div class="icon-button-group">
          <button
            class="icon-btn"
            :title="$t('sidebar.hide_sidebar')"
            :aria-label="$t('sidebar.hide_sidebar')"
            @click="uiStore.toggleMainSidebar"
          >
            <PanelLeftClose :size="18" />
          </button>

          <button
            class="icon-btn"
            :title="$t('common.settings')"
            :aria-label="$t('sidebar.open_settings')"
            @click="uiStore.openSettingsModal()"
          >
            <Settings :size="18" />
          </button>
        </div>
      </div>

      <!-- Quick Task Creation - REBUILT with TASK-1324 enhancements -->
      <div class="quick-task-section">
        <div class="quick-task-row">
          <!-- Single-line input (shown when not expanded) -->
          <input
            v-if="!isQuickAddExpanded"
            ref="quickTaskRef"
            v-model="quickTaskText"
            :dir="quickTaskDirection"
            type="text"
            class="quick-task-input"
            :class="{ 'voice-active': isListening, 'success-flash': showSuccessFlash }"
            :placeholder="isListening ? $t('sidebar.quick_task_listening') : (showSuccessFlash ? $t('sidebar.quick_task_added') : $t('sidebar.quick_task_placeholder'))"
            :aria-label="$t('sidebar.quick_task_label')"
            @keydown.enter.prevent="createQuickTask"
            @keydown.escape="collapseQuickAdd"
            @focus="quickTaskFocused = true"
            @blur="quickTaskFocused = false"
          >
          <!-- Multi-line textarea (shown when expanded) -->
          <textarea
            v-else
            ref="quickTaskExpandedRef"
            v-model="quickTaskText"
            :dir="quickTaskDirection"
            class="quick-task-textarea"
            :class="{ 'voice-active': isListening }"
            :placeholder="isListening ? $t('sidebar.quick_task_listening') : $t('sidebar.quick_task_placeholder')"
            :aria-label="$t('sidebar.quick_task_label')"
            rows="3"
            @keydown.enter.exact.prevent="createQuickTask"
            @keydown.escape="collapseQuickAdd"
            @focus="quickTaskFocused = true"
            @blur="quickTaskFocused = false"
          />
          <!-- Mic button (TASK-1024) - ALWAYS SHOW FOR DEBUG -->
          <button
            class="mic-btn"
            :class="[{ recording: isListening }]"
            :title="isListening ? $t('sidebar.stop_recording') : $t('sidebar.voice_input')"
            @click="toggleVoiceInput"
          >
            <Mic v-if="!isListening" :size="16" />
            <MicOff v-else :size="16" />
          </button>
        </div>

        <!-- Metadata row (date + priority pickers) - TASK-1324 Feature 2 & 3 -->
        <Transition name="fade-slide">
          <div v-if="showMetadataRow" class="metadata-row">
            <!-- Date picker -->
            <div class="metadata-picker">
              <button
                class="metadata-btn"
                :class="{ 'has-value': quickTaskDueDate }"
                :style="quickTaskDueDate ? { color: 'var(--brand-primary)' } : {}"
                @mousedown.prevent
                @click="toggleDatePicker"
              >
                <CalendarDays :size="14" />
                <span v-if="quickTaskDueDate" class="metadata-label">{{ formatDateLabel(quickTaskDueDate) }}</span>
                <span v-else class="metadata-label">{{ $t('sidebar.no_date') }}</span>
              </button>

              <!-- Date dropdown -->
              <Transition name="fade">
                <div v-if="showDatePicker" class="metadata-dropdown date-dropdown" @mousedown.prevent>
                  <button class="dropdown-option" @click="selectDate('today')">
                    {{ $t('smart_views.today') }}
                  </button>
                  <button class="dropdown-option" @click="selectDate('tomorrow')">
                    {{ $t('sidebar.tomorrow') }}
                  </button>
                  <button class="dropdown-option" @click="selectDate('weekend')">
                    {{ $t('sidebar.this_weekend') }}
                  </button>
                  <button class="dropdown-option" @click="selectDate(null)">
                    {{ $t('sidebar.no_date') }}
                  </button>
                </div>
              </Transition>
            </div>

            <span class="metadata-divider">·</span>

            <!-- Priority picker -->
            <div class="metadata-picker">
              <button
                class="metadata-btn"
                :class="{ 'has-value': quickTaskPriority }"
                :style="getPriorityColor(quickTaskPriority)"
                @mousedown.prevent
                @click="togglePriorityPicker"
              >
                <Flag :size="14" />
                <span class="metadata-label">{{ formatPriorityLabel(quickTaskPriority) }}</span>
              </button>

              <!-- Priority dropdown -->
              <Transition name="fade">
                <div v-if="showPriorityPicker" class="metadata-dropdown priority-dropdown" @mousedown.prevent>
                  <button class="dropdown-option" @click="selectPriority(null)">
                    <Flag :size="12" />
                    <span>{{ $t('common.none') }}</span>
                  </button>
                  <button class="dropdown-option priority-low" @click="selectPriority('low')">
                    <Flag :size="12" />
                    <span>{{ $t('task.priority_low') }}</span>
                  </button>
                  <button class="dropdown-option priority-medium" @click="selectPriority('medium')">
                    <Flag :size="12" />
                    <span>{{ $t('task.priority_medium') }}</span>
                  </button>
                  <button class="dropdown-option priority-high" @click="selectPriority('high')">
                    <Flag :size="12" />
                    <span>{{ $t('task.priority_high') }}</span>
                  </button>
                </div>
              </Transition>
            </div>
          </div>
        </Transition>

        <!-- Voice feedback (when recording) -->
        <div v-if="isListening || isProcessingVoice" class="voice-feedback">
          <div class="voice-waveform">
            <span class="wave-bar" />
            <span class="wave-bar" />
            <span class="wave-bar" />
          </div>
          <span class="voice-status">{{ displayTranscript || $t('sidebar.speak_now') }}</span>
          <button class="voice-cancel" @click="cancelVoice">
            <X :size="12" />
          </button>
        </div>
        <!-- Voice error message -->
        <div v-if="voiceError && !isListening" class="voice-error">
          {{ voiceError }}
        </div>
      </div>

      <!-- Project & Task Management -->
      <div class="task-management-section">
        <!-- Smart Views - Using DateDropZone for drag and drop functionality -->
        <div class="smart-views-grid">
          <!-- Today -->
          <SidebarSmartItem
            :active="taskStore.activeSmartView === 'today'"
            :count="todayTaskCount"
            drop-type="date"
            drop-value="today"
            color="azure"
            compact
            @click="selectSmartView('today')"
          >
            <template #icon>
              <Calendar :size="14" />
            </template>
            {{ $t('smart_views.today') }}
          </SidebarSmartItem>

          <!-- This Week -->
          <SidebarSmartItem
            :active="taskStore.activeSmartView === 'week'"
            :count="weekTaskCount"
            drop-type="date"
            drop-value="weekend"
            color="azure-dark"
            compact
            @click="selectSmartView('week')"
          >
            <template #icon>
              <Calendar :size="14" />
            </template>
            {{ $t('smart_views.week') }}
          </SidebarSmartItem>
        </div>

        <div class="sidebar-sub-divider" />

        <div class="smart-views-grid secondary">
          <!-- All Active -->
          <SidebarSmartItem
            :active="taskStore.activeSmartView === 'all_active'"
            :count="allActiveCount"
            drop-type="date"
            drop-value="nodate"
            color="blue"
            compact
            @click="selectSmartView('all_active')"
          >
            <template #icon>
              <List :size="14" />
            </template>
            {{ $t('smart_views.all_active') }}
          </SidebarSmartItem>

          <!-- Uncategorized (Inbox) -->
          <SidebarSmartItem
            :active="taskStore.activeSmartView === 'uncategorized'"
            :count="uncategorizedCount"
            drop-type="date"
            drop-value="nodate"
            color="orange"
            compact
            @click="selectSmartView('uncategorized')"
          >
            <template #icon>
              <Inbox :size="14" />
            </template>
            {{ $t('smart_views.inbox') }}
          </SidebarSmartItem>
        </div>

        <!-- Quick Sort Button (shows when uncategorized filter is active) -->
        <Transition name="fade">
          <button
            v-if="taskStore.activeSmartView === 'uncategorized' && uncategorizedCount > 0"
            class="quick-sort-button-full"
            title="Start Quick Sort to categorize these tasks"
            @click="handleStartQuickSort"
          >
            <Zap :size="16" />
            <span>{{ $t('sidebar.categorize_inbox') }} ({{ uncategorizedCount }})</span>
          </button>
        </Transition>

        <!-- Duration Groups - Collapsible Section -->
        <div class="duration-section">
          <button 
            class="section-toggle" 
            :aria-expanded="sidebar.isDurationSectionExpanded.value"
            @click="sidebar.toggleDurationSection"
          >
            <Clock :size="14" />
            <span>{{ $t('sidebar.duration_group') }}</span>
            <ChevronRight 
              :size="14" 
              class="toggle-chevron" 
              :class="{ rotated: sidebar.isDurationSectionExpanded.value }" 
            />
          </button>
          
          <div v-show="sidebar.isDurationSectionExpanded.value" class="duration-grid">
            <!-- Quick (<15m) -->
            <SidebarSmartItem
              :active="taskStore.activeDurationFilter === 'quick'"
              :count="sidebar.quickCount.value"
              drop-type="duration"
              :drop-value="15"
              color="green"
              compact
              @click="sidebar.selectSmartView('quick')"
            >
              <template #icon>
                <Zap :size="14" />
              </template>
              {{ $t('sidebar.quick') }}
            </SidebarSmartItem>

            <!-- Short (15-30m) -->
            <SidebarSmartItem
              :active="taskStore.activeDurationFilter === 'short'"
              :count="sidebar.shortCount.value"
              drop-type="duration"
              :drop-value="30"
              color="teal"
              compact
              @click="sidebar.selectSmartView('short')"
            >
              <template #icon>
                <Coffee :size="14" />
              </template>
              {{ $t('sidebar.short') }}
            </SidebarSmartItem>

            <!-- Medium (30-60m) -->
            <SidebarSmartItem
              :active="taskStore.activeDurationFilter === 'medium'"
              :count="sidebar.mediumCount.value"
              drop-type="duration"
              :drop-value="60"
              color="teal"
              compact
              @click="sidebar.selectSmartView('medium')"
            >
              <template #icon>
                <Hourglass :size="14" />
              </template>
              {{ $t('sidebar.medium') }}
            </SidebarSmartItem>

            <!-- Long (>60m) -->
            <SidebarSmartItem
              :active="taskStore.activeDurationFilter === 'long'"
              :count="sidebar.longCount.value"
              drop-type="duration"
              :drop-value="120"
              color="purple"
              compact
              @click="sidebar.selectSmartView('long')"
            >
              <template #icon>
                <Mountain :size="14" />
              </template>
              {{ $t('sidebar.long') }}
            </SidebarSmartItem>

            <!-- Unestimated -->
            <SidebarSmartItem
              :active="taskStore.activeDurationFilter === 'unestimated'"
              :count="sidebar.unestimatedCount.value"
              drop-type="duration"
              :drop-value="-1"
              color="gray"
              compact
              @click="sidebar.selectSmartView('unestimated')"
            >
              <template #icon>
                <HelpCircle :size="14" />
              </template>
              {{ $t('sidebar.no_estimate') }}
            </SidebarSmartItem>
          </div>
        </div>

        <!-- Projects Section Header -->
        <div class="projects-divider" />
        <div class="section-header">
          <h3 class="section-title">
            <FolderOpen :size="16" class="section-icon" />
            {{ $t('common.projects') }}
          </h3>
          <button class="add-project-btn" :title="$t('sidebar.add_project')" @click="sidebar.openCreateProject">
            <Plus :size="14" />
          </button>
        </div>

        <!-- Project Selection Bar (shown when projects are selected) -->
        <Transition name="fade">
          <div v-if="multiSelectMode" class="project-selection-bar">
            <span class="selection-count">{{ selectedProjectIds.size }} selected</span>
            <button
              class="selection-action delete-action"
              title="Delete selected projects"
              @click="confirmDeleteSelectedProjects"
            >
              <Trash2 :size="14" />
              {{ $t('common.delete') }}
            </button>
            <button
              class="selection-action clear-action"
              title="Clear selection (Esc)"
              @click="clearProjectSelection"
            >
              <X :size="14" />
            </button>
          </div>
        </Transition>

        <!-- Delete Confirmation Modal -->
        <Transition name="fade">
          <div v-if="showDeleteConfirm" class="delete-confirm-overlay" @click.self="cancelDeleteProjects">
            <div class="delete-confirm-modal">
              <h4>Delete {{ projectsToDeleteCount }} project{{ projectsToDeleteCount > 1 ? 's' : '' }}?</h4>
              <p>Tasks in {{ projectsToDeleteCount > 1 ? 'these projects' : 'this project' }} will be moved to Inbox. This cannot be undone.</p>
              <div class="confirm-actions">
                <button class="cancel-btn" @click="cancelDeleteProjects">
                  {{ $t('common.cancel') }}
                </button>
                <button class="delete-btn" @click="executeDeleteProjects">
                  {{ $t('common.delete') }}
                </button>
              </div>
            </div>
          </div>
        </Transition>

        <!-- Project List - Recursive tree rendering with accessibility -->
        <nav
          class="projects-list"
          role="tree"
          aria-label="Projects"
          :aria-activedescendant="taskStore.activeProjectId ? `project-${taskStore.activeProjectId}` : undefined"
          @keydown="handleProjectTreeKeydown"
        >
          <!-- All Projects Option -->
          <div class="project-tree-item">
            <BaseNavItem
              :active="!taskStore.activeProjectId && selectedProjectIds.size === 0"
              @click="handleAllProjectsClick"
            >
              <template #icon>
                <Layers :size="16" />
              </template>
              {{ $t('sidebar.all_projects') }}
            </BaseNavItem>
          </div>

          <ProjectTreeItem
            v-for="project in taskStore.projects.filter(p => !p.parentId)"
            :key="project.id"
            :project="project"
            :expanded-projects="sidebar.expandedProjects.value || []"
            :selected-project-ids="selectedProjectIds"
            :level="1"
            @click="handleProjectClick"
            @toggle-expand="sidebar.toggleProjectExpansion"
            @contextmenu="handleProjectContextMenu"
            @project-drop="() => {}"
          />
        </nav>
      </div>


      <!-- User Profile Footer -->
      <div class="sidebar-footer">
        <button v-if="!authStore.user" class="sidebar-login-btn" @click="uiStore.openAuthModal('login')">
          <span style="font-weight: 600;">{{ $t('sidebar.sign_in') }}</span>
        </button>
        <div v-else class="user-profile-row">
          <div class="user-avatar-circle">
            {{ (authStore.user?.email ? authStore.user.email[0].toUpperCase() : 'U') }}
          </div>
          <div class="user-info-col">
            <span class="user-email" :title="authStore.user?.email || ''">{{ authStore.user?.email || 'Authenticated' }}</span>
            <span class="user-status">{{ $t('common.online') }}</span>
          </div>
          <button class="settings-mini-btn" :title="$t('common.settings')" @click="uiStore.openSettingsModal()">
            <Settings :size="16" />
          </button>
        </div>
      </div>
    </aside>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useUIStore } from '@/stores/ui'
import { useTaskStore, type Project } from '@/stores/tasks'
import { useAuthStore } from '@/stores/auth'
import { useSidebarManagement } from '@/composables/app/useSidebarManagement'
import {
  Plus, PanelLeftClose, Settings, FolderOpen,
  Calendar, List, Inbox, Zap, Clock, HelpCircle,
  ChevronRight, Coffee, Hourglass, Mountain, Trash2, X,
  Layers, Mic, MicOff, CalendarDays, Flag
} from 'lucide-vue-next'
import { useWhisperSpeech } from '@/composables/useWhisperSpeech'

import BaseButton from '@/components/base/BaseButton.vue'
import BaseNavItem from '@/components/base/BaseNavItem.vue'
import SidebarSmartItem from '@/components/layout/SidebarSmartItem.vue'
import ProjectTreeItem from '@/components/projects/ProjectTreeItem.vue'
import AppLogo from '@/components/base/AppLogo.vue'

const { t } = useI18n()
const router = useRouter()
const uiStore = useUIStore()
const taskStore = useTaskStore()
const authStore = useAuthStore()
const sidebar = useSidebarManagement()

// BUG-1086: REMOVED fire-and-forget authStore.initialize() call
// Auth is already initialized by router guard (src/router/index.ts:130)
// and useAppInitialization.ts - this duplicate call caused race conditions

// Project Multi-Select State (Now Global)
const selectedProjectIds = computed(() => uiStore.selectedProjectIds)
const lastSelectedProjectId = computed(() => uiStore.lastSelectedProjectId)
const multiSelectMode = computed(() => uiStore.selectedProjectIds.size > 0)
const showDeleteConfirm = ref(false)

// Handle "All Projects" click
const handleAllProjectsClick = () => {
  taskStore.setActiveProject(null)
  uiStore.clearProjectSelection()
}

// Project Selection Handlers
const handleProjectClick = (event: MouseEvent, project: Project) => {
  // Handle Shift+Click (Range Selection)
  if (event.shiftKey) {
    if (!lastSelectedProjectId.value) {
      uiStore.setProjectSelection([project.id])
      return
    }

    // Has anchor - perform range selection
    const allProjects = getFlattenedProjectList()
    const lastIndex = allProjects.findIndex(p => p.id === lastSelectedProjectId.value)
    const currentIndex = allProjects.findIndex(p => p.id === project.id)

    if (lastIndex === -1) {
      uiStore.setProjectSelection([project.id])
      return
    }

    if (currentIndex !== -1) {
      const start = Math.min(lastIndex, currentIndex)
      const end = Math.max(lastIndex, currentIndex)
      const rangeProjects = allProjects.slice(start, end + 1)
      
      const ids = rangeProjects.map(p => p.id)
      // Merge with existing selection if Ctrl also held? No, standard range replace.
      // But typically Shift appends range to selection if Ctrl held? simpler for now: replace.
      uiStore.setProjectSelection(ids)
    }
    return
  }

  // Handle Ctrl/Cmd+Click (Toggle Selection)
  if (event.ctrlKey || event.metaKey) {
    uiStore.toggleProjectSelection(project.id)
    return
  }

  // Single click - clear selection and select project normally
  // This is the "All Projects" feature: accessing a single project clears multi-select
  clearProjectSelection()
  sidebar.selectProject(project)
}

const clearProjectSelection = () => {
  uiStore.clearProjectSelection()
  showDeleteConfirm.value = false
}

const deleteSelectedProjects = async () => {
  // Get IDs to delete - either from multi-selection or from active project
  let idsToDelete: string[] = []

  if (selectedProjectIds.value.size > 0) {
    idsToDelete = Array.from(selectedProjectIds.value)
  } else if (taskStore.activeProjectId && taskStore.activeProjectId !== 'uncategorized') {
    // Single active project (not in multi-select mode)
    idsToDelete = [taskStore.activeProjectId]
  }

  if (idsToDelete.length === 0) return

  try {
    await taskStore.deleteProjects(idsToDelete)
  } catch (error) {
    console.error('❌ Error deleting projects:', error)
  }
  clearProjectSelection()
}

const confirmDeleteSelectedProjects = () => {
  showDeleteConfirm.value = true
}

const cancelDeleteProjects = () => {
  showDeleteConfirm.value = false
}

const executeDeleteProjects = async () => {
  await deleteSelectedProjects()
  showDeleteConfirm.value = false
}

// Check if there are projects that can be deleted (selected or active)
const hasDeletableProjects = computed(() => {
  if (selectedProjectIds.value.size > 0) return true
  if (taskStore.activeProjectId && taskStore.activeProjectId !== 'uncategorized') return true
  return false
})

// Get count of projects to delete (for modal)
const projectsToDeleteCount = computed(() => {
  if (selectedProjectIds.value.size > 0) return selectedProjectIds.value.size
  if (taskStore.activeProjectId && taskStore.activeProjectId !== 'uncategorized') return 1
  return 0
})

// Keyboard handler for project selection actions
const handleProjectKeydown = (event: KeyboardEvent) => {
  // Don't handle if typing in an input field
  const target = event.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
    return
  }

  // BUG-1336: Only handle delete when focus is within the sidebar or when projects are
  // explicitly multi-selected (not just activeProjectId). This prevents the project delete
  // dialog from appearing when pressing Delete on the canvas or other views.
  const sidebarEl = document.querySelector('.sidebar')
  const isFocusInSidebar = sidebarEl?.contains(target)
  const hasExplicitSelection = selectedProjectIds.value.size > 0

  // Escape: Clear selection
  if (event.key === 'Escape' && hasExplicitSelection) {
    clearProjectSelection()
    return
  }

  // Delete or Backspace: Only when sidebar has focus OR projects are explicitly selected
  if ((event.key === 'Delete' || event.key === 'Backspace') && hasDeletableProjects.value) {
    if (!isFocusInSidebar && !hasExplicitSelection) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    confirmDeleteSelectedProjects()
    return
  }
}

// Lifecycle - add/remove keyboard listener and outside click handler
onMounted(() => {
  window.addEventListener('keydown', handleProjectKeydown)
  window.addEventListener('click', handleOutsideClick)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleProjectKeydown)
  window.removeEventListener('click', handleOutsideClick)
})

// Quick Task Logic
const quickTaskRef = ref<HTMLInputElement | null>(null)
const quickTaskExpandedRef = ref<HTMLTextAreaElement | null>(null)
const quickTaskText = ref('')
const quickTaskFocused = ref(false)

const showSuccessFlash = ref(false)

// TASK-1324: Quick task metadata (date + priority)
const quickTaskDueDate = ref<string | null>(null)
const quickTaskPriority = ref<'low' | 'medium' | 'high' | null>(null)
const showDatePicker = ref(false)
const showPriorityPicker = ref(false)

// RTL detection for Hebrew input
const quickTaskDirection = computed(() => {
  const text = quickTaskText.value.trim()
  if (!text) return 'ltr'
  const rtlRegex = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/
  return rtlRegex.test(text[0]) ? 'rtl' : 'ltr'
})

// TASK-1324 Feature 1: Auto-expand when text gets long
const isQuickAddExpanded = computed(() => {
  const text = quickTaskText.value.trim()
  if (!text) return false
  const wordCount = text.split(/\s+/).length
  return wordCount >= 6 || text.length > 40
})

// Show metadata row when input is focused, has values set, or a dropdown is open
const showMetadataRow = computed(() => {
  return quickTaskFocused.value || quickTaskDueDate.value !== null || quickTaskPriority.value !== null || showDatePicker.value || showPriorityPicker.value
})

// Auto-focus the textarea when expanding
watch(isQuickAddExpanded, (expanded) => {
  if (expanded) {
    nextTick(() => quickTaskExpandedRef.value?.focus())
  }
})

// Collapse quick add (clear text)
const collapseQuickAdd = () => {
  quickTaskText.value = ''
}

// TASK-1324 Feature 2: Date picker
const toggleDatePicker = () => {
  showDatePicker.value = !showDatePicker.value
  showPriorityPicker.value = false
}

const selectDate = (option: 'today' | 'tomorrow' | 'weekend' | null) => {
  if (option === null) {
    quickTaskDueDate.value = null
  } else if (option === 'today') {
    const today = new Date()
    quickTaskDueDate.value = today.toISOString().split('T')[0]
  } else if (option === 'tomorrow') {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    quickTaskDueDate.value = tomorrow.toISOString().split('T')[0]
  } else if (option === 'weekend') {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const daysUntilSaturday = (6 - dayOfWeek + 7) % 7
    const saturday = new Date()
    saturday.setDate(today.getDate() + daysUntilSaturday)
    quickTaskDueDate.value = saturday.toISOString().split('T')[0]
  }
  showDatePicker.value = false
}

const formatDateLabel = (date: string | null): string => {
  if (!date) return t('sidebar.no_date')
  const d = new Date(date + 'T00:00:00')
  const today = new Date()
  const tomorrow = new Date()
  tomorrow.setDate(today.getDate() + 1)

  const dateStr = d.toISOString().split('T')[0]
  const todayStr = today.toISOString().split('T')[0]
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  if (dateStr === todayStr) return t('smart_views.today')
  if (dateStr === tomorrowStr) return t('sidebar.tomorrow')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// TASK-1324 Feature 3: Priority picker
const togglePriorityPicker = () => {
  showPriorityPicker.value = !showPriorityPicker.value
  showDatePicker.value = false
}

const selectPriority = (priority: 'low' | 'medium' | 'high' | null) => {
  quickTaskPriority.value = priority
  showPriorityPicker.value = false
}

const formatPriorityLabel = (priority: 'low' | 'medium' | 'high' | null): string => {
  if (!priority) return t('common.none')
  return priority.charAt(0).toUpperCase() + priority.slice(1)
}

const getPriorityColor = (priority: 'low' | 'medium' | 'high' | null) => {
  if (!priority) return {}
  const colors: Record<string, string> = {
    low: 'var(--color-priority-low)',
    medium: 'var(--color-priority-medium)',
    high: 'var(--color-priority-high)'
  }
  return { color: colors[priority] }
}

// Close dropdowns when clicking outside
const handleOutsideClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target.closest('.metadata-picker')) {
    showDatePicker.value = false
    showPriorityPicker.value = false
  }
}

// TASK-1322: Whisper-only voice input (browser speech recognition removed)
const {
  isRecording: isWhisperRecording,
  isProcessing: isWhisperProcessing,
  isSupported: _isWhisperSupported,
  hasApiKey: _hasWhisperApiKey,
  transcript: whisperTranscript,
  error: whisperError,
  start: startWhisper,
  stop: stopWhisper,
  cancel: cancelWhisper
} = useWhisperSpeech({
  onResult: (result) => {
    console.log('[Whisper Sidebar] Result:', result)
    if (result.transcript.trim()) {
      quickTaskText.value = result.transcript.trim()
      // Don't auto-submit — let user review and press Enter
    }
  },
  onError: (err) => {
    console.warn('[Whisper Sidebar] Error:', err)
  }
})

// Voice state
const isListening = computed(() => isWhisperRecording.value)
const isProcessingVoice = computed(() => isWhisperProcessing.value)
const displayTranscript = computed(() => whisperTranscript.value)
const voiceError = computed(() => whisperError.value)

// Toggle voice recording
const toggleVoiceInput = async () => {
  if (isListening.value) {
    stopWhisper()
  } else {
    quickTaskText.value = ''
    await startWhisper()
  }
}

// Cancel voice recording
const cancelVoice = () => {
  cancelWhisper()
}

const createQuickTask = async () => {
  if (!quickTaskText.value.trim()) return

  const title = quickTaskText.value.trim()
  try {
    await taskStore.createTaskWithUndo({
      title,
      description: '',
      status: 'planned',
      projectId: undefined,
      ...(quickTaskDueDate.value && { dueDate: quickTaskDueDate.value }),
      ...(quickTaskPriority.value && { priority: quickTaskPriority.value })
    })
    quickTaskText.value = ''
    quickTaskDueDate.value = null
    quickTaskPriority.value = null
    // Visual confirmation flash
    showSuccessFlash.value = true
    setTimeout(() => { showSuccessFlash.value = false }, 1200)
  } catch (error) {
    console.error('Error creating quick task:', error)
  }
}

// Smart View Counts
const todayTaskCount = computed(() => taskStore.smartViewTaskCounts.today)
const weekTaskCount = computed(() => taskStore.smartViewTaskCounts.week)
const allActiveCount = computed(() => taskStore.smartViewTaskCounts.allActive)
const uncategorizedCount = computed(() => taskStore.getUncategorizedTaskCount())
// Reactive counts using the store getters


// Methods
const selectSmartView = (view: string) => {
  taskStore.setActiveProject(null)
  
  // Check if view is a duration filter
  if (['quick', 'short', 'medium', 'long', 'unestimated'].includes(view)) {
    taskStore.setActiveDurationFilter(view as any)
    taskStore.setSmartView(null)
  } else {
    // It's a smart view
    taskStore.setSmartView(view as any)
    taskStore.setActiveDurationFilter(null)
  }
  
  // TASK-1330: Verify navigation to tasks view when selecting a smart view
  router.push('/tasks')
}

const handleStartQuickSort = () => {
  router.push('/quick-sort')
}

// Project Tree Navigation
const handleProjectTreeKeydown = (event: KeyboardEvent) => {
  const { key } = event

  switch (key) {
    case 'ArrowDown':
      event.preventDefault()
      navigateToNextProject()
      break
    case 'ArrowUp':
      event.preventDefault()
      navigateToPreviousProject()
      break
    case 'ArrowRight':
      event.preventDefault()
      expandCurrentProject()
      break
    case 'ArrowLeft':
      event.preventDefault()
      collapseCurrentProjectOrNavigateToParent()
      break
    case 'Enter':
    case ' ':
      event.preventDefault()
      activateCurrentProject()
      break
    case 'Home':
      event.preventDefault()
      navigateToFirstProject()
      break
    case 'End':
      event.preventDefault()
      navigateToLastProject()
      break
  }
}

const navigateToNextProject = () => {
  const currentProjectId = taskStore.activeProjectId
  const allProjects = getFlattenedProjectList()
  const currentIndex = allProjects.findIndex(p => p.id === currentProjectId)

  if (currentIndex < allProjects.length - 1) {
    taskStore.setActiveProject(allProjects[currentIndex + 1].id)
  }
}

const navigateToPreviousProject = () => {
  const currentProjectId = taskStore.activeProjectId
  const allProjects = getFlattenedProjectList()
  const currentIndex = allProjects.findIndex(p => p.id === currentProjectId)

  if (currentIndex > 0) {
    taskStore.setActiveProject(allProjects[currentIndex - 1].id)
  }
}

const expandCurrentProject = () => {
  const currentProjectId = taskStore.activeProjectId
  if (currentProjectId && hasProjectChildren(currentProjectId)) {
    if (!sidebar.expandedProjects.value.includes(currentProjectId)) {
      sidebar.expandedProjects.value.push(currentProjectId)
    }
  }
}

const collapseCurrentProjectOrNavigateToParent = () => {
  const currentProjectId = taskStore.activeProjectId
  if (!currentProjectId) return

  if (hasProjectChildren(currentProjectId) && sidebar.expandedProjects.value.includes(currentProjectId)) {
    const index = sidebar.expandedProjects.value.indexOf(currentProjectId)
    sidebar.expandedProjects.value.splice(index, 1)
  } else {
    const project = taskStore.getProjectById(currentProjectId)
    if (project?.parentId) {
      taskStore.setActiveProject(project.parentId)
    }
  }
}

const activateCurrentProject = () => {
  const currentProjectId = taskStore.activeProjectId
  if (currentProjectId) {
    const project = taskStore.getProjectById(currentProjectId)
    if (project) {
      sidebar.selectProject(project)
    }
  }
}

const navigateToFirstProject = () => {
  const allProjects = getFlattenedProjectList()
  if (allProjects.length > 0) {
    taskStore.setActiveProject(allProjects[0].id)
  }
}

const navigateToLastProject = () => {
  const allProjects = getFlattenedProjectList()
  if (allProjects.length > 0) {
    taskStore.setActiveProject(allProjects[allProjects.length - 1].id)
  }
}

const getFlattenedProjectList = () => {
  const flatten = (projects: Project[]): Project[] => {
    const result: Project[] = []
    for (const project of projects) {
      result.push(project)
      if (sidebar.expandedProjects.value.includes(project.id)) {
        const children = taskStore.projects.filter(p => p.parentId === project.id)
        result.push(...flatten(children))
      }
    }
    return result
  }
  return flatten(taskStore.projects.filter(p => !p.parentId))
}

const hasProjectChildren = (projectId: string) => {
  return taskStore.projects.some(p => p.parentId === projectId)
}

const handleProjectContextMenu = (event: MouseEvent, project: Project) => {
  event.preventDefault()
  window.dispatchEvent(new CustomEvent('project-context-menu', {
    detail: { event, project }
  }))
}

// Expose focus method
defineExpose({
  focusQuickTask: () => {
    quickTaskRef.value?.focus()
  }
})
</script>

<style scoped>
/* LEFT SIDEBAR - Glass effect */
.sidebar {
  /* Remove fixed width - let CSS Grid control the width */
  min-width: 240px; /* Minimum width for usability */
  max-width: 340px; /* Maximum width to prevent overly wide sidebar */
  width: 100%; /* Fill the grid column */
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.03) 0%,
    rgba(255, 255, 255, 0.01) 100%
  );
  backdrop-filter: blur(40px) saturate(200%);
  -webkit-backdrop-filter: blur(40px) saturate(200%);
  border-right: 1px solid var(--glass-border);
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  position: relative;
  z-index: 100;
  box-shadow:
    var(--shadow-2xl),
    inset -1px 0 0 var(--glass-bg-heavy);
  contain: layout style; /* Performance optimization */
  overflow: hidden; /* Prevent sidebar content from causing horizontal scroll */
}

.sidebar-footer {
  margin-top: auto;
  padding: var(--space-4);
  border-top: 1px solid var(--glass-border);
  background: var(--glass-bg-soft);
}

.sidebar-login-btn {
  width: 100%;
  padding: var(--space-2_5);
  background: var(--glass-bg-soft);
  color: var(--brand-primary);
  border: 1px solid var(--brand-primary-alpha-40);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-out);
  display: flex;
  align-items: center;
  justify-content: center;
}

.sidebar-login-btn:hover {
  background: var(--brand-primary-alpha-10);
  border-color: var(--brand-primary);
  box-shadow: 0 0 15px var(--brand-primary-alpha-20);
}

.user-profile-row {
  display: flex;
  align-items: center;
  gap: var(--space-2_5);
  padding: var(--space-1);
}

.user-avatar-circle {
  width: 32px;
  height: 32px;
  background: var(--brand-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: var(--text-sm);
  flex-shrink: 0;
}

.user-info-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.user-email {
  font-size: var(--text-sm);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-primary);
}

.user-status {
  font-size: var(--text-xs);
  color: var(--success);
}

.settings-mini-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: var(--space-1);
  border-radius: var(--radius-sm);
}

.settings-mini-btn:hover {
  background: var(--glass-border);
  color: var(--text-primary);
}

/* Sidebar toggle transitions */
.sidebar-slide-enter-active,
.sidebar-slide-leave-active {
  transition: transform var(--duration-slow) cubic-bezier(0.4, 0, 0.2, 1),
              opacity 300ms cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform, opacity;
}

.sidebar-slide-enter-from,
.sidebar-slide-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

.sidebar-slide-enter-to,
.sidebar-slide-leave-from {
  transform: translateX(0);
  opacity: 1;
}

.sidebar-header {
  padding: var(--space-10) var(--space-6) var(--space-6) var(--space-6);
  /* border-bottom removed — shared layout-header-border in MainLayout handles this */
  background: var(--glass-bg-medium);
}

.app-brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-6);
}

.brand-icon {
  font-size: var(--text-xl);
}

.brand-text {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

/* Sidebar header buttons */
.sidebar-header button {
  width: 100%;
}

/* Icon button group */
.icon-button-group {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.icon-btn {
  background: transparent;
  border: 1px solid var(--border-medium);
  color: var(--text-secondary);
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
}

.icon-btn:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
  color: var(--text-primary);
  box-shadow: var(--state-hover-shadow);
}

.icon-btn:active {
  transform: scale(0.95);
}

/* Quick Task Section */
.quick-task-section {
  padding: var(--space-2);
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  margin: var(--space-4) var(--space-6);
}

.quick-task-row {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.quick-task-input {
  flex: 1;
  padding: var(--space-2_5);
  background: var(--glass-bg-tint);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: var(--text-sm);
  transition: all var(--duration-normal);
}

.quick-task-input:focus {
  outline: none;
  border-color: var(--brand-primary);
  background: var(--glass-bg-light);
}

.quick-task-input.voice-active {
  border-color: var(--danger-text, #ef4444);
  box-shadow: 0 0 0 2px var(--danger-bg-medium);
}

.quick-task-input.success-flash {
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 2px rgba(78, 205, 196, 0.25);
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
}

.quick-task-input.success-flash::placeholder {
  color: var(--brand-primary);
}

/* Mic Button (TASK-1024) */
.mic-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: var(--glass-bg-soft);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.mic-btn:hover {
  background: var(--glass-bg);
  color: var(--text-primary);
}

.mic-btn:active {
  transform: scale(0.95);
}

.mic-btn.recording {
  background: var(--danger-text, #ef4444);
  color: white;
  animation: pulse-recording 1.5s ease-in-out infinite;
}

@keyframes pulse-recording {
  0%, 100% {
    box-shadow: 0 0 0 0 var(--danger-shadow-strong);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(239, 68, 68, 0);
  }
}

/* Voice feedback panel */
.voice-feedback {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  margin-top: var(--space-2);
  background: var(--glass-bg-soft);
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
}

.voice-waveform {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 16px;
}

.wave-bar {
  width: 2px;
  height: 4px;
  background: var(--danger-text, #ef4444);
  border-radius: 1px;
  animation: wave 0.8s ease-in-out infinite;
}

.wave-bar:nth-child(1) { animation-delay: 0s; }
.wave-bar:nth-child(2) { animation-delay: 0.1s; }
.wave-bar:nth-child(3) { animation-delay: 0.2s; }

@keyframes wave {
  0%, 100% { height: 4px; }
  50% { height: 12px; }
}

.voice-status {
  flex: 1;
  font-size: var(--text-xs);
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.voice-cancel {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.voice-cancel:hover {
  background: var(--glass-bg);
  color: var(--danger-text, #ef4444);
}

/* Voice error message */
.voice-error {
  margin-top: var(--space-2);
  padding: var(--space-1) var(--space-2);
  background: var(--danger-bg-subtle);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: var(--danger-text, #ef4444);
}

.task-management-section {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4) var(--space-6);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.section-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  margin: 0;
  letter-spacing: 0.05em;
}

.section-icon {
  color: var(--text-muted);
}

.add-project-btn {
  background: transparent;
  border: 1px solid var(--border-medium);
  color: var(--text-muted);
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: all var(--duration-fast) var(--ease-out);
}

.add-project-btn:hover {
  background: var(--surface-hover);
  border-color: var(--border-strong);
  color: var(--text-secondary);
}

/* Smart Views Section */
.smart-views {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-bottom: var(--space-4);
}

/* Uncategorized Filter Styles */
.smart-view-uncategorized {
  margin-top: var(--space-2);
  border-top: 1px solid var(--glass-bg-heavy);
  padding-top: var(--space-2);
}

.uncategorized-filter {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-3) var(--space-4);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  color: var(--text-muted);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-normal) var(--spring-smooth);
}


/* Quick Sort Button */

.projects-divider {
  height: 1px;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0%,
    var(--glass-bg-heavy) 50%,
    rgba(255, 255, 255, 0) 100%
  );
  margin: var(--space-4) 0;
}

.projects-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  overflow-y: auto;
  max-height: calc(100vh - 500px); /* Leave space for header and controls */
  padding-right: var(--space-2); /* Prevent scroll from interfering with content */
}

/* RTL Support */
[dir="rtl"] .sidebar {
  border-right: none;
  border-left: 1px solid var(--glass-border-hover);
  box-shadow:
    var(--shadow-2xl),
    inset 1px 0 0 var(--glass-bg-heavy);
}

[dir="rtl"] .sidebar-slide-enter-from,
[dir="rtl"] .sidebar-slide-leave-to {
  transform: translateX(100%);
}
/* Duration Section */
.duration-section {
  margin-bottom: var(--space-4);
}

.section-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2) var(--space-1);
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  letter-spacing: 0.05em;
  cursor: pointer;
  text-transform: uppercase;
  margin-bottom: var(--space-2);
}

.section-toggle:hover {
  color: var(--text-secondary);
}

.toggle-chevron {
  margin-left: auto;
  transition: transform var(--duration-fast);
  opacity: 0.5;
}

.toggle-chevron.rotated {
  transform: rotate(90deg);
}

.smart-views-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-2);
  padding: var(--space-4) var(--space-4) var(--space-2) var(--space-4);
}

.smart-views-grid.secondary {
  padding-top: var(--space-2);
  padding-bottom: var(--space-4);
}

.sidebar-sub-divider {
  height: 1px;
  background: var(--glass-border);
  margin: var(--space-1) var(--space-4);
  opacity: 0.3;
}

.quick-sort-button-full {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: calc(100% - 32px);
  margin: 0 16px var(--space-4) 16px;
  padding: var(--space-2);
  background: var(--brand-primary);
  color: #0a0a0a;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: all var(--duration-normal);
  box-shadow: var(--shadow-sm);
}

.quick-sort-button-full:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
  filter: brightness(1.1);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--duration-slow) var(--ease-out);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.duration-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-2);
  padding: 0 var(--space-4) var(--space-4) var(--space-4);
}

/* Project Selection Bar */
.project-selection-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--glass-bg-heavy);
  border: 1px solid var(--brand-primary-alpha-30);
  border-radius: var(--radius-md);
  margin: 0 var(--space-4) var(--space-2) var(--space-4);
}

.selection-count {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  color: var(--brand-primary);
  flex: 1;
}

.selection-action {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: transparent;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.selection-action:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
}

.selection-action.delete-action:hover {
  background: rgba(239, 68, 68, 0.15);
  border-color: var(--danger-border-strong);
  color: var(--color-danger);
}

.selection-action.clear-action {
  padding: var(--space-1);
}

/* Delete Confirmation Modal */
.delete-confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-tooltip);
}

.delete-confirm-modal {
  background: var(--overlay-component-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  max-width: 400px;
  width: 90%;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.delete-confirm-modal h4 {
  margin: 0 0 var(--space-3) 0;
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.delete-confirm-modal p {
  margin: 0 0 var(--space-4) 0;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.5;
}

.confirm-actions {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
}

.confirm-actions button {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.cancel-btn {
  background: transparent;
  border: 1px solid var(--border-medium);
  color: var(--text-secondary);
}

.cancel-btn:hover {
  background: var(--state-hover-bg);
  border-color: var(--state-hover-border);
}

.delete-btn {
  background: var(--color-danger);
  border: none;
  color: white;
}

.delete-btn:hover {
  background: #dc2626;
}

/* TASK-1324: Textarea for expanded quick add (Feature 1) */
.quick-task-textarea {
  flex: 1;
  padding: var(--space-2_5);
  background: var(--glass-bg-tint);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-family: inherit;
  resize: none;
  transition: all var(--duration-normal);
  line-height: 1.4;
}

.quick-task-textarea:focus {
  outline: none;
  border-color: var(--brand-primary);
  background: var(--glass-bg-light);
}

.quick-task-textarea.voice-active {
  border-color: var(--danger-text, #ef4444);
  box-shadow: 0 0 0 2px var(--danger-bg-medium);
}

/* TASK-1324: Metadata row for date + priority pickers (Features 2 & 3) */
.metadata-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-soft);
}

.metadata-divider {
  color: var(--text-muted);
  font-size: var(--text-xs);
  user-select: none;
}

.metadata-picker {
  position: relative;
  display: flex;
  align-items: center;
}

.metadata-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: transparent;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.metadata-btn:hover {
  background: var(--glass-bg);
  border-color: var(--border-strong);
  color: var(--text-primary);
}

.metadata-btn.has-value {
  border-color: var(--brand-primary);
}

.metadata-label {
  font-size: var(--text-xs);
  white-space: nowrap;
}

/* Metadata dropdowns */
.metadata-dropdown {
  position: absolute;
  top: calc(100% + var(--space-1));
  left: 0;
  z-index: var(--z-tooltip);
  min-width: 140px;
  background: rgb(22, 19, 38);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: var(--space-1);
  box-shadow: var(--shadow-lg);
}

.dropdown-option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  text-align: left;
  cursor: pointer;
  transition: all var(--duration-fast);
}

.dropdown-option:hover {
  background: var(--glass-bg-soft);
  color: var(--text-primary);
}

/* Priority color variants */
.dropdown-option.priority-low {
  color: var(--color-priority-low);
}

.dropdown-option.priority-low:hover {
  background: var(--blue-bg-light);
}

.dropdown-option.priority-medium {
  color: var(--color-priority-medium);
}

.dropdown-option.priority-medium:hover {
  background: var(--color-warning-alpha-10);
}

.dropdown-option.priority-high {
  color: var(--color-priority-high);
}

.dropdown-option.priority-high:hover {
  background: var(--danger-bg-subtle);
}

/* Fade-slide transition for metadata row */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all var(--duration-normal) var(--ease-out);
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.fade-slide-enter-to,
.fade-slide-leave-from {
  opacity: 1;
  transform: translateY(0);
}
</style>
