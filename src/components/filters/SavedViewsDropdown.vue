<template>
  <div ref="wrapperRef" class="saved-views-dropdown">
    <!-- Trigger Button -->
    <button
      ref="triggerRef"
      type="button"
      class="saved-views-trigger"
      :class="{ 'has-active': activeViewId !== null }"
      :title="activeViewId ? `Active view: ${activeViewName}` : 'Saved Views'"
      @click="toggleDropdown"
    >
      <Bookmark :size="14" />
      <OverflowTooltip v-if="activeViewId" :text="activeViewName" class="trigger-label" style="flex: 1; min-width: 0">{{ activeViewName }}</OverflowTooltip>
    </button>

    <!-- Dropdown Panel (Teleported) -->
    <Teleport to="body">
      <Transition name="dropdown">
        <div
          v-if="isOpen"
          ref="dropdownRef"
          class="saved-views-panel"
          :style="panelStyle"
        >
          <!-- Header -->
          <div class="panel-header">
            <span class="panel-title">Saved Views</span>
            <span class="panel-count">{{ savedViews.length }}</span>
          </div>

          <!-- Saved Views List -->
          <div v-if="savedViews.length > 0" class="views-list">
            <button
              v-for="view in savedViews"
              :key="view.id"
              class="view-item"
              :class="{ 'is-active': isViewActive(view) }"
              @click="handleApplyView(view)"
            >
              <span
                class="view-color-dot"
                :style="{ background: view.color || 'var(--brand-primary)' }"
              />
              <OverflowTooltip :text="view.name" class="view-name">{{ view.name }}</OverflowTooltip>
              <span
                role="button"
                tabindex="0"
                class="view-delete-btn"
                title="Delete saved view"
                @click.stop="handleDeleteView(view.id)"
                @keydown.enter.stop="handleDeleteView(view.id)"
              >
                <X :size="12" />
              </span>
            </button>
          </div>

          <!-- Empty State -->
          <div v-else class="empty-state">
            <span class="empty-text">No saved views yet</span>
          </div>

          <!-- Divider -->
          <div class="panel-divider" />

          <!-- Save Current Filters -->
          <div v-if="!isNaming" class="save-action">
            <button
              class="save-btn"
              @click="startNaming"
            >
              <Plus :size="14" />
              <span>Save current filters</span>
            </button>
          </div>

          <!-- Name Input -->
          <div v-else class="name-input-row">
            <input dir="auto"
              ref="nameInputRef"
              v-model="newViewName"
              class="name-input"
              type="text"
              placeholder="View name..."
              maxlength="40"
              @keydown.enter="confirmSave"
              @keydown.esc="cancelNaming"
            />
            <button
              class="confirm-btn"
              :disabled="!newViewName.trim()"
              @click="confirmSave"
            >
              <Check :size="14" />
            </button>
            <button
              class="cancel-btn"
              @click="cancelNaming"
            >
              <X :size="12" />
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { Bookmark, X, Plus, Check } from 'lucide-vue-next'
import OverflowTooltip from '@/components/base/OverflowTooltip.vue'
import { useSavedViews } from '@/composables/useSavedViews'
import type { SavedView } from '@/types/savedViews'

const {
  savedViews,
  applyView,
  isViewActive,
  saveCurrentAsView,
  deleteView
} = useSavedViews()

// Dropdown state
const wrapperRef = ref<HTMLElement>()
const triggerRef = ref<HTMLButtonElement>()
const dropdownRef = ref<HTMLElement>()
const nameInputRef = ref<HTMLInputElement>()
const isOpen = ref(false)
const isNaming = ref(false)
const newViewName = ref('')

// Unique ID for this dropdown (for global close coordination)
const dropdownId = Math.random().toString(36).substring(2, 9)

// Panel positioning (teleported to body)
const panelStyle = ref<Record<string, string>>({
  position: 'fixed',
  top: '0px',
  left: '0px'
})

// Detect which saved view matches current filters
const activeViewId = computed(() => {
  const match = savedViews.value.find(v => isViewActive(v))
  return match?.id ?? null
})

const activeViewName = computed(() => {
  const match = savedViews.value.find(v => v.id === activeViewId.value)
  return match?.name ?? ''
})

// Panel position calculation
function calculatePanelPosition() {
  if (!triggerRef.value) return

  const rect = triggerRef.value.getBoundingClientRect()
  const viewportHeight = window.innerHeight
  const panelHeight = 320 // Estimated max height
  const spaceBelow = viewportHeight - rect.bottom
  const positionAbove = spaceBelow < panelHeight && rect.top > spaceBelow

  panelStyle.value = {
    position: 'fixed',
    top: positionAbove ? `${rect.top - panelHeight - 4}px` : `${rect.bottom + 4}px`,
    left: `${Math.max(8, rect.left - 120)}px`,
    minWidth: '220px',
    maxWidth: '280px'
  }
}

async function toggleDropdown() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    window.dispatchEvent(new CustomEvent('close-all-dropdowns', { detail: { except: dropdownId } }))
    isNaming.value = false
    newViewName.value = ''
    await nextTick()
    calculatePanelPosition()
  }
}

function closeDropdown() {
  isOpen.value = false
  isNaming.value = false
  newViewName.value = ''
}

function handleApplyView(view: SavedView) {
  applyView(view)
  closeDropdown()
}

function handleDeleteView(id: string) {
  deleteView(id)
}

async function startNaming() {
  isNaming.value = true
  await nextTick()
  nameInputRef.value?.focus()
}

function cancelNaming() {
  isNaming.value = false
  newViewName.value = ''
}

// Pre-defined color palette for saved views
const VIEW_COLORS = [
  '#2DD4BF', // teal (brand primary)
  '#FF6B6B', // coral
  '#A78BFA', // purple
  '#F59E0B', // amber
  '#3B82F6', // blue
  '#EC4899', // pink
  '#10B981', // emerald
  '#F97316'  // orange
]

function confirmSave() {
  const name = newViewName.value.trim()
  if (!name) return

  // Pick a color based on count (cycle through palette)
  const colorIndex = savedViews.value.length % VIEW_COLORS.length
  const color = VIEW_COLORS[colorIndex]

  saveCurrentAsView(name, undefined, color)
  isNaming.value = false
  newViewName.value = ''
}

// Click outside to close
function handleClickOutside(event: MouseEvent) {
  const target = event.target as Node
  const isInsideWrapper = wrapperRef.value?.contains(target)
  const isInsideDropdown = dropdownRef.value?.contains(target)
  if (!isInsideWrapper && !isInsideDropdown) {
    closeDropdown()
  }
}

function handleResize() {
  if (isOpen.value) calculatePanelPosition()
}

function handleScroll(event: Event) {
  if (!isOpen.value) return
  const target = event.target as HTMLElement
  if (dropdownRef.value && (target === dropdownRef.value || dropdownRef.value.contains(target))) return
  closeDropdown()
}

function handleGlobalClose(event: Event) {
  const customEvent = event as CustomEvent<{ except: string }>
  if (customEvent.detail?.except !== dropdownId && isOpen.value) {
    closeDropdown()
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
  window.addEventListener('resize', handleResize)
  window.addEventListener('scroll', handleScroll, true)
  window.addEventListener('close-all-dropdowns', handleGlobalClose)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleClickOutside)
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('scroll', handleScroll, true)
  window.removeEventListener('close-all-dropdowns', handleGlobalClose)
})
</script>

<style scoped>
/* ============================================
   Trigger Button
   ============================================ */
.saved-views-trigger {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0 var(--space-1_5);
  height: 22px;
  background: transparent;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  cursor: pointer;
  outline: none;
  transition: all var(--duration-fast) var(--spring-smooth);
  white-space: nowrap;
}

.saved-views-trigger:hover {
  border-color: var(--glass-border-hover);
  background: var(--surface-hover);
  color: var(--text-primary);
}

.saved-views-trigger.has-active {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
}

.trigger-label {
  max-width: 80px;
}

/* ============================================
   Dropdown Panel (Teleported)
   ============================================ */
.saved-views-panel {
  z-index: var(--z-tooltip);
  background: var(--glass-panel-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border-soft);
  box-shadow:
    var(--shadow-dark-lg),
    0 0 0 1px var(--border-subtle) inset;
  border-radius: var(--radius-md);
  padding: var(--space-2);
  isolation: isolate;
  transform: translateZ(0);
}

/* Header */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-1) var(--space-1_5) var(--space-1);
}

.panel-title {
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.panel-count {
  font-size: var(--text-2xs);
  color: var(--text-muted);
  background: var(--glass-bg-medium);
  padding: 0 var(--space-1);
  border-radius: var(--radius-full);
  min-width: var(--space-4);
  height: var(--space-4);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Views List */
.views-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-0_5);
  max-height: 180px;
  overflow-y: auto;
}

.view-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1_5) var(--space-2);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
  text-align: start;
  width: 100%;
}

.view-item:hover {
  background: var(--surface-hover);
}

.view-item.is-active {
  background: var(--state-active-bg);
  border-color: var(--state-active-border);
  color: var(--state-active-text);
}

.view-color-dot {
  width: var(--space-2);
  height: var(--space-2);
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.view-name {
  flex: 1;
}

.view-delete-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--space-4);
  height: var(--space-4);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0;
  transition: all var(--duration-fast) var(--spring-smooth);
  flex-shrink: 0;
}

.view-item:hover .view-delete-btn {
  opacity: 1;
}

.view-delete-btn:hover {
  background: var(--danger-bg-subtle);
  color: var(--color-danger);
}

/* Empty State */
.empty-state {
  padding: var(--space-3) var(--space-2);
  text-align: center;
}

.empty-text {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

/* Divider */
.panel-divider {
  height: 1px;
  background: var(--border-subtle);
  margin: var(--space-1_5) 0;
}

/* Save Action */
.save-action {
  padding: 0;
}

.save-btn {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
  width: 100%;
  padding: var(--space-1_5) var(--space-2);
  background: transparent;
  border: 1px dashed var(--border-subtle);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
}

.save-btn:hover {
  border-color: var(--brand-primary);
  color: var(--brand-primary);
  background: var(--glass-bg-soft);
}

/* Name Input Row */
.name-input-row {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.name-input {
  flex: 1;
  height: 26px;
  padding: 0 var(--space-2);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: var(--text-xs);
  outline: none;
  transition: border-color var(--duration-fast) var(--spring-smooth);
}

.name-input::placeholder {
  color: var(--text-muted);
}

.name-input:focus {
  border-color: var(--brand-primary);
}

.confirm-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  background: var(--glass-bg-soft);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-sm);
  color: var(--brand-primary);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
  flex-shrink: 0;
}

.confirm-btn:hover:not(:disabled) {
  background: var(--brand-primary);
  color: var(--surface-base);
}

.confirm-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.cancel-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  background: transparent;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--duration-fast) var(--spring-smooth);
  flex-shrink: 0;
}

.cancel-btn:hover {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

/* Dropdown Transition */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity var(--duration-fast) ease, transform var(--duration-fast) ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* Scrollbar */
.views-list::-webkit-scrollbar {
  width: var(--space-1);
}

.views-list::-webkit-scrollbar-track {
  background: transparent;
}

.views-list::-webkit-scrollbar-thumb {
  background: var(--glass-border);
  border-radius: var(--radius-full);
}
</style>
