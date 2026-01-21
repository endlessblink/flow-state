<template>
  <div ref="selectRef" class="section-selector" :class="{ 'is-compact': compact }">
    <button
      ref="triggerElement"
      type="button"
      class="select-trigger"
      :class="{ 'is-open': isOpen }"
      @click="toggleDropdown"
    >
      <div v-if="selectedSection" class="selected-info">
        <div
          class="section-color-dot"
          :style="{ backgroundColor: selectedSection.color || 'var(--brand-primary)' }"
        />
        <span class="select-value">{{ selectedSection.name }}</span>
      </div>
      <span v-else class="select-value placeholder">{{ placeholder }}</span>

      <ChevronDown :size="compact ? 12 : 14" class="select-icon" :class="{ 'is-open': isOpen }" />
    </button>

    <Teleport to="body">
      <Transition name="dropdown">
        <div
          v-if="isOpen"
          class="select-dropdown"
          :style="dropdownStyle as any"
          role="listbox"
        >
          <!-- Special Option: None / Inbox -->
          <div
            class="select-option none-option"
            :class="{ 'is-selected': !modelValue }"
            role="option"
            @click="selectOption(null)"
          >
            <Inbox :size="14" />
            <span>None (Move to Inbox)</span>
          </div>

          <!-- Section Groups -->
          <div v-for="group in categorizedSections" :key="group.type" class="dropdown-group">
            <div class="group-header">
              {{ group.label }}
            </div>
            <div
              v-for="section in group.sections"
              :key="section.id"
              class="select-option"
              :class="{ 'is-selected': section.id === modelValue }"
              role="option"
              @click="selectOption(section.id)"
            >
              <div 
                class="section-color-dot" 
                :style="{ backgroundColor: section.color || 'var(--brand-primary)' }"
              />
              <span>{{ section.name }}</span>
            </div>
          </div>

          <div v-if="canvasStore.sections.length === 0" class="empty-state">
            No sections found on canvas
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { ChevronDown, Inbox } from 'lucide-vue-next'
import { useCanvasStore } from '@/stores/canvas'

interface Props {
  modelValue: string | null
  placeholder?: string
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: 'Select a section...',
  compact: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  'change': [value: string | null]
}>()

const canvasStore = useCanvasStore()
const selectRef = ref<HTMLElement>()
const triggerElement = ref<HTMLButtonElement>()
const isOpen = ref(false)

// Unique ID for this dropdown instance (for global close coordination)
const dropdownId = Math.random().toString(36).substring(2, 9)

// Dropdown positioning (copied from CustomSelect for consistency)
const dropdownStyle = ref({
  position: 'fixed' as const,
  top: '0px',
  left: '0px',
  width: '0px',
  minWidth: '0px'
})

const calculateDropdownPosition = () => {
  if (!triggerElement.value) return

  const rect = triggerElement.value.getBoundingClientRect()
  const viewportHeight = window.innerHeight
  const spaceBelow = viewportHeight - rect.bottom
  const spaceAbove = rect.top
  
  // Estimate height: header (30) + options (8 options * 40 approx)
  const dropdownHeight = Math.min(350, 48 + (canvasStore.sections.length + 1) * 40) 

  const positionAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow

  dropdownStyle.value = {
    position: 'fixed',
    top: positionAbove ? `${rect.top - dropdownHeight - 4}px` : `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
    minWidth: '200px',
    width: 'auto' as const // Explicitly cast 'auto' to ensure type compatibility
  }
}

const selectedSection = computed(() => {
  if (!props.modelValue) return null
  return canvasStore.sections.find(s => s.id === props.modelValue) || null
})

const categorizedSections = computed(() => {
  const sections = canvasStore.sections
  const groups = [
    { type: 'custom', label: 'Custom Groups', sections: sections.filter(s => s.type === 'custom') },
    { type: 'status', label: 'Status Columns', sections: sections.filter(s => s.type === 'status') },
    { type: 'priority', label: 'Priority Areas', sections: sections.filter(s => s.type === 'priority') },
    { type: 'timeline', label: 'Timeline Sections', sections: sections.filter(s => s.type === 'timeline') },
    { type: 'project', label: 'Project Containers', sections: sections.filter(s => s.type === 'project') }
  ]
  
  return groups.filter(g => g.sections.length > 0)
})

const toggleDropdown = async () => {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    // Close any other open dropdowns
    window.dispatchEvent(new CustomEvent('close-all-dropdowns', { detail: { except: dropdownId } }))
    await nextTick()
    calculateDropdownPosition()
  }
}

const closeDropdown = () => {
  isOpen.value = false
}

const selectOption = (sectionId: string | null) => {
  emit('update:modelValue', sectionId)
  emit('change', sectionId)
  closeDropdown()
}

const handleClickOutside = (event: MouseEvent) => {
  if (selectRef.value && !selectRef.value.contains(event.target as Node)) {
    closeDropdown()
  }
}

// Handle global close event (when another dropdown opens)
const handleGlobalClose = (event: Event) => {
  const customEvent = event as CustomEvent<{ except: string }>
  if (customEvent.detail?.except !== dropdownId && isOpen.value) {
    closeDropdown()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('resize', calculateDropdownPosition)
  window.addEventListener('scroll', closeDropdown, true)
  window.addEventListener('close-all-dropdowns', handleGlobalClose)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('resize', calculateDropdownPosition)
  window.removeEventListener('scroll', closeDropdown, true)
  window.removeEventListener('close-all-dropdowns', handleGlobalClose)
})
</script>

<style scoped>
.section-selector {
  position: relative;
  width: 100%;
}

.select-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: rgba(30, 30, 50, 0.35);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border-hover);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  font-size: var(--text-sm);
  cursor: pointer;
  outline: none;
  transition: all var(--duration-normal) var(--ease-out);
  min-height: 40px;
}

.select-trigger:hover {
  border-color: var(--border-interactive);
  background: rgba(40, 40, 60, 0.45);
}

.selected-info {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
}

.section-color-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.select-value {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.select-value.placeholder {
  color: var(--text-muted);
}

.select-icon {
  color: var(--text-muted);
  transition: transform var(--duration-normal) var(--ease-out);
}

.select-icon.is-open {
  transform: rotate(180deg);
}

.select-dropdown {
  /* Position is set via inline style from Teleport */
  z-index: 99999;

  /* Use design tokens for consistent overlay styling */
  background: var(--overlay-component-bg);
  backdrop-filter: var(--overlay-component-backdrop);
  -webkit-backdrop-filter: var(--overlay-component-backdrop);
  border: var(--overlay-component-border);
  box-shadow: var(--overlay-component-shadow);
  border-radius: var(--radius-xl);

  max-height: 350px;
  overflow-y: auto;
  padding: var(--space-2);
  min-width: 200px;

  /* Ensure backdrop-filter works */
  isolation: isolate;
  transform: translateZ(0);
}

.select-option {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2_5) var(--space-3);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-out);
  white-space: nowrap;
}

.select-option:hover {
  background: var(--glass-bg-heavy);
}

.select-option.is-selected {
  background: var(--brand-primary-bg-medium);
  color: var(--brand-primary);
}

.none-option {
  border-bottom: 1px solid var(--glass-border);
  margin-bottom: var(--space-2);
  color: var(--text-muted);
}

.group-header {
  padding: var(--space-2) var(--space-3) var(--space-1);
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-muted);
  font-weight: var(--font-bold);
}

.empty-state {
  padding: var(--space-4);
  text-align: center;
  color: var(--text-muted);
  font-size: var(--text-sm);
}

/* Transitions */
.dropdown-enter-active, .dropdown-leave-active {
  transition: opacity var(--duration-normal) var(--var(--ease-out)-out), transform var(--duration-normal) ease;
}
.dropdown-enter-from, .dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* ============================================
   COMPACT VARIANT - for use inside metadata bars
   ============================================ */
.section-selector.is-compact {
  width: auto;
}

.section-selector.is-compact .select-trigger {
  /* Remove glass morphism - parent provides container styling */
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  border: none;

  /* Compact sizing */
  padding: 0;
  min-height: unset;
  height: auto;
  width: auto;
}

.section-selector.is-compact .select-trigger:hover {
  background: transparent;
  border: none;
}

.section-selector.is-compact .select-value {
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.section-selector.is-compact .section-color-dot {
  width: 8px;
  height: 8px;
}

.section-selector.is-compact .select-icon {
  color: var(--text-tertiary);
}
</style>
