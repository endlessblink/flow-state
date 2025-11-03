<template>
  <div class="page">
    <h1 class="page-title">Base Components</h1>
    <p class="page-description">Foundation components - click to copy code</p>

    <ComponentShowcase title="BaseButton - Variants" :code="buttonVariantsCode">
      <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
        <BaseButton variant="primary">Primary</BaseButton>
        <BaseButton variant="secondary">Secondary</BaseButton>
        <BaseButton variant="ghost">Ghost</BaseButton>
        <BaseButton variant="danger">Danger</BaseButton>
      </div>
    </ComponentShowcase>

    <ComponentShowcase title="BaseButton - Sizes" :code="buttonSizesCode">
      <div style="display: flex; gap: 1rem; align-items: center;">
        <BaseButton size="sm">Small</BaseButton>
        <BaseButton size="md">Medium</BaseButton>
        <BaseButton size="lg">Large</BaseButton>
      </div>
    </ComponentShowcase>

    <ComponentShowcase title="BaseButton - With Icons" :code="buttonIconCode">
      <div style="display: flex; gap: 1rem;">
        <BaseButton variant="primary">
          <Plus :size="16" />
          <span>Add Task</span>
        </BaseButton>
        <BaseButton variant="secondary" icon-only>
          <Settings :size="16" />
        </BaseButton>
      </div>
    </ComponentShowcase>

    <ComponentShowcase title="BaseInput - Default" :code="inputCode">
      <BaseInput label="Task Title" placeholder="Enter task name..." />
    </ComponentShowcase>

    <ComponentShowcase title="BaseInput - With Helper Text" :code="inputHelperCode">
      <BaseInput label="Email" type="email" placeholder="you@example.com" helper-text="We'll never share your email" />
    </ComponentShowcase>

    <ComponentShowcase title="BaseCard - Default" :code="cardDefaultCode">
      <BaseCard>
        <template #header>
          <h3>Card Header</h3>
        </template>
        <p>This is the card content area with your information.</p>
        <template #footer>
          <button>Action</button>
        </template>
      </BaseCard>
    </ComponentShowcase>

    <ComponentShowcase title="BaseCard - Glass Effect" :code="cardGlassCode">
      <BaseCard glass hoverable>
        <h3 style="margin-bottom: 0.5rem;">Glass Card</h3>
        <p>Hover to see the glass morphism effect</p>
      </BaseCard>
    </ComponentShowcase>

    <ComponentShowcase title="BaseBadge - All Variants" :code="badgeCode">
      <div style="display: flex; gap: 1rem; flex-wrap: wrap; align-items: center;">
        <BaseBadge variant="default">Default</BaseBadge>
        <BaseBadge variant="count">5</BaseBadge>
        <BaseBadge variant="success">Success</BaseBadge>
        <BaseBadge variant="warning">Warning</BaseBadge>
        <BaseBadge variant="danger">Danger</BaseBadge>
        <BaseBadge variant="info">Info</BaseBadge>
      </div>
    </ComponentShowcase>

    <ComponentShowcase title="BaseButton - States" :code="buttonStatesCode">
      <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
        <BaseButton variant="primary" disabled>Disabled</BaseButton>
        <BaseButton variant="primary" loading>Loading</BaseButton>
        <button class="base-button primary hover-state">Hover State</button>
        <button class="base-button primary focus-state">Focus State</button>
      </div>
    </ComponentShowcase>

    <ComponentShowcase title="BaseInput - States" :code="inputStatesCode">
      <div style="display: flex; flex-direction: column; gap: 1rem; max-width: 400px;">
        <BaseInput label="Disabled Input" placeholder="Disabled..." disabled />
        <BaseInput label="Error Input" placeholder="Enter value..." error="This field is required" />
        <div class="input-wrapper">
          <label class="input-label">Focus State Input</label>
          <input type="text" class="input-focused" placeholder="Click to see focus state" />
        </div>
      </div>
    </ComponentShowcase>

    <ComponentShowcase title="BaseSelect - Dropdown" :code="selectCode">
      <div style="max-width: 300px;">
        <label class="form-label">Select Priority</label>
        <select class="base-select">
          <option value="">Choose...</option>
          <option value="high">High Priority</option>
          <option value="medium">Medium Priority</option>
          <option value="low">Low Priority</option>
        </select>
      </div>
    </ComponentShowcase>

    <ComponentShowcase title="BaseCheckbox - Checkbox Input" :code="checkboxCode">
      <div style="display: flex; flex-direction: column; gap: var(--space-3);">
        <label class="checkbox-wrapper">
          <input type="checkbox" class="base-checkbox" checked />
          <span class="checkbox-label">Checked</span>
        </label>
        <label class="checkbox-wrapper">
          <input type="checkbox" class="base-checkbox" />
          <span class="checkbox-label">Unchecked</span>
        </label>
        <label class="checkbox-wrapper">
          <input type="checkbox" class="base-checkbox" disabled />
          <span class="checkbox-label">Disabled</span>
        </label>
      </div>
    </ComponentShowcase>

    <ComponentShowcase title="BaseRadio - Radio Buttons" :code="radioCode">
      <div style="display: flex; flex-direction: column; gap: var(--space-3);">
        <label class="radio-wrapper">
          <input type="radio" name="priority" class="base-radio" checked />
          <span class="radio-label">High Priority</span>
        </label>
        <label class="radio-wrapper">
          <input type="radio" name="priority" class="base-radio" />
          <span class="radio-label">Medium Priority</span>
        </label>
        <label class="radio-wrapper">
          <input type="radio" name="priority" class="base-radio" />
          <span class="radio-label">Low Priority</span>
        </label>
      </div>
    </ComponentShowcase>

    <ComponentShowcase title="BaseToggle - Switch" :code="toggleCode">
      <div style="display: flex; flex-direction: column; gap: var(--space-4);">
        <label class="toggle-wrapper">
          <input type="checkbox" class="base-toggle" checked />
          <span class="toggle-slider"></span>
          <span class="toggle-label">Enable Notifications</span>
        </label>
        <label class="toggle-wrapper">
          <input type="checkbox" class="base-toggle" />
          <span class="toggle-slider"></span>
          <span class="toggle-label">Dark Mode</span>
        </label>
      </div>
    </ComponentShowcase>

    <ComponentShowcase title="BaseProgress - Progress Bar" :code="progressCode">
      <div style="display: flex; flex-direction: column; gap: var(--space-4);">
        <div>
          <div class="progress-label">Uploading... 25%</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: 25%;"></div>
          </div>
        </div>
        <div>
          <div class="progress-label">Processing... 60%</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: 60%;"></div>
          </div>
        </div>
        <div>
          <div class="progress-label">Complete 100%</div>
          <div class="progress-bar">
            <div class="progress-fill success" style="width: 100%;"></div>
          </div>
        </div>
      </div>
    </ComponentShowcase>

    <ComponentShowcase title="BaseSpinner - Loading Spinner" :code="spinnerCode">
      <div style="display: flex; gap: var(--space-6); align-items: center;">
        <div class="spinner"></div>
        <div class="spinner spinner-sm"></div>
        <div class="spinner spinner-lg"></div>
      </div>
    </ComponentShowcase>

    <ComponentShowcase title="Empty State Pattern" :code="emptyStateCode">
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <h3 class="empty-title">No tasks yet</h3>
        <p class="empty-message">Create your first task to get started</p>
        <BaseButton variant="primary">
          <Plus :size="16" />
          <span>Create Task</span>
        </BaseButton>
      </div>
    </ComponentShowcase>

    <ComponentShowcase title="BaseTabs - Tab Navigation" :code="tabsCode">
      <div class="tabs-container">
        <div class="tabs-header">
          <button class="tab active">Overview</button>
          <button class="tab">Details</button>
          <button class="tab">Settings</button>
        </div>
        <div class="tab-content">
          <p>Tab content area</p>
        </div>
      </div>
    </ComponentShowcase>

    <ComponentShowcase title="BaseTooltip - Tooltip Overlay" :code="tooltipCode">
      <div style="display: flex; gap: var(--space-8); justify-content: center; padding: var(--space-8);">
        <div class="tooltip-demo">
          <button class="demo-button">Hover me</button>
          <div class="tooltip tooltip-top">
            <div class="tooltip-arrow"></div>
            Tooltip text here
          </div>
        </div>
      </div>
    </ComponentShowcase>

    <ComponentShowcase title="BaseToast - Notification" :code="toastCode">
      <div style="display: flex; flex-direction: column; gap: var(--space-3);">
        <div class="toast toast-success">
          <span class="toast-icon">✓</span>
          <span class="toast-message">Task created successfully</span>
          <button class="toast-close">×</button>
        </div>
        <div class="toast toast-error">
          <span class="toast-icon">✕</span>
          <span class="toast-message">Failed to save changes</span>
          <button class="toast-close">×</button>
        </div>
        <div class="toast toast-info">
          <span class="toast-icon">ℹ</span>
          <span class="toast-message">Timer started</span>
          <button class="toast-close">×</button>
        </div>
      </div>
    </ComponentShowcase>

    <ComponentShowcase title="Loading Skeleton Pattern" :code="skeletonCode">
      <div style="display: flex; flex-direction: column; gap: var(--space-4);">
        <div class="skeleton-card">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-text"></div>
          <div class="skeleton skeleton-text short"></div>
        </div>
      </div>
    </ComponentShowcase>
  </div>
</template>

<script setup lang="ts">
import ComponentShowcase from '../components/ComponentShowcase.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseInput from '@/components/base/BaseInput.vue'
import BaseCard from '@/components/base/BaseCard.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'
import { Plus, Settings } from 'lucide-vue-next'

const buttonVariantsCode = `<BaseButton variant="primary">Primary</BaseButton>
<BaseButton variant="secondary">Secondary</BaseButton>
<BaseButton variant="ghost">Ghost</BaseButton>
<BaseButton variant="danger">Danger</BaseButton>`

const buttonSizesCode = `<BaseButton size="sm">Small</BaseButton>
<BaseButton size="md">Medium</BaseButton>
<BaseButton size="lg">Large</BaseButton>`

const buttonIconCode = `<BaseButton variant="primary">
  <Plus :size="16" />
  <span>Add Task</span>
</BaseButton>
<BaseButton variant="secondary" icon-only>
  <Settings :size="16" />
</BaseButton>`

const inputCode = `<BaseInput
  label="Task Title"
  placeholder="Enter task name..."
/>`

const inputHelperCode = `<BaseInput
  label="Email"
  type="email"
  placeholder="you@example.com"
  helper-text="We'll never share your email"
/>`

const cardDefaultCode = `<BaseCard>
  <template #header>
    <h3>Card Header</h3>
  </template>
  Card content goes here
  <template #footer>
    <button>Action</button>
  </template>
</BaseCard>`

const cardGlassCode = `<BaseCard glass hoverable>
  <h3>Glass Card</h3>
  <p>With glassmorphism effect</p>
</BaseCard>`

const badgeCode = `<BaseBadge variant="default">Default</BaseBadge>
<BaseBadge variant="count">5</BaseBadge>
<BaseBadge variant="success">Success</BaseBadge>
<BaseBadge variant="warning">Warning</BaseBadge>`

const buttonStatesCode = `<BaseButton variant="primary" disabled>Disabled</BaseButton>
<BaseButton variant="primary" loading>Loading</BaseButton>
<!-- Hover and focus states are automatic -->`

const inputStatesCode = `<BaseInput disabled placeholder="Disabled..." />
<BaseInput error="This field is required" />
<!-- Focus state is automatic on click -->`

const selectCode = `<select class="base-select">
  <option value="">Choose...</option>
  <option value="high">High Priority</option>
  <option value="medium">Medium Priority</option>
</select>`

const checkboxCode = `<label class="checkbox-wrapper">
  <input type="checkbox" class="base-checkbox" checked />
  <span class="checkbox-label">Checked</span>
</label>`

const radioCode = `<label class="radio-wrapper">
  <input type="radio" name="group" class="base-radio" checked />
  <span class="radio-label">Option 1</span>
</label>`

const toggleCode = `<label class="toggle-wrapper">
  <input type="checkbox" class="base-toggle" checked />
  <span class="toggle-slider"></span>
  <span class="toggle-label">Enable Feature</span>
</label>`

const progressCode = `<div class="progress-bar">
  <div class="progress-fill" style="width: 60%;"></div>
</div>`

const spinnerCode = `<div class="spinner"></div>
<div class="spinner spinner-sm"></div>
<div class="spinner spinner-lg"></div>`

const emptyStateCode = `<div class="empty-state">
  <div class="empty-icon">📭</div>
  <h3 class="empty-title">No tasks yet</h3>
  <p class="empty-message">Create your first task to get started</p>
  <BaseButton variant="primary">Create Task</BaseButton>
</div>`

const tabsCode = `<div class="tabs-container">
  <div class="tabs-header">
    <button class="tab" :class="{ active: activeTab === 'overview' }">
      Overview
    </button>
    <button class="tab" :class="{ active: activeTab === 'details' }">
      Details
    </button>
  </div>
  <div class="tab-content">
    {{ tabContent }}
  </div>
</div>`

const tooltipCode = `<div class="tooltip-wrapper">
  <button @mouseenter="showTooltip = true">Hover me</button>
  <div v-if="showTooltip" class="tooltip tooltip-top">
    <div class="tooltip-arrow"></div>
    Tooltip text
  </div>
</div>`

const toastCode = `<div class="toast toast-success">
  <span class="toast-icon">✓</span>
  <span class="toast-message">Task created successfully</span>
  <button class="toast-close">×</button>
</div>`

const skeletonCode = `<div class="skeleton-card">
  <div class="skeleton skeleton-title"></div>
  <div class="skeleton skeleton-text"></div>
  <div class="skeleton skeleton-text short"></div>
</div>`
</script>

<style scoped>
.page {
  max-width: 1200px;
}

.page-title {
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  margin-bottom: var(--space-2);
}

.page-description {
  color: var(--text-muted);
  margin-bottom: var(--space-8);
}

/* Button States */
.base-button {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast);
  border: none;
}

.base-button.primary {
  background: var(--brand-primary);
  color: white;
}

.base-button.hover-state {
  background: var(--brand-hover);
  box-shadow: var(--purple-shadow-medium);
}

.base-button.focus-state {
  background: var(--brand-primary);
  box-shadow: var(--purple-glow-focus);
  outline: none;
}

/* Input States */
.input-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.input-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
}

.input-focused {
  width: 100%;
  padding: var(--space-3);
  background: var(--surface-elevated);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-sm);
  box-shadow: var(--purple-glow-medium);
  outline: none;
}

/* Select / Dropdown */
.base-select {
  width: 100%;
  padding: var(--space-3);
  background: var(--surface-elevated);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.base-select:hover {
  border-color: var(--border-hover);
}

.base-select:focus {
  outline: none;
  border-color: var(--brand-primary);
  box-shadow: var(--purple-glow-medium);
}

.form-label {
  display: block;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  margin-bottom: var(--space-2);
}

/* Checkbox */
.checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
}

.base-checkbox {
  width: 18px;
  height: 18px;
  border-radius: var(--radius-sm);
  border: 2px solid var(--border-medium);
  background: var(--surface-elevated);
  cursor: pointer;
  transition: all var(--duration-fast);
  appearance: none;
  position: relative;
}

.base-checkbox:checked {
  background: var(--brand-primary);
  border-color: var(--brand-primary);
}

.base-checkbox:checked::after {
  content: '✓';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  font-size: 12px;
}

.base-checkbox:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.checkbox-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

/* Radio */
.radio-wrapper {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
}

.base-radio {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--border-medium);
  background: var(--surface-elevated);
  cursor: pointer;
  transition: all var(--duration-fast);
  appearance: none;
  position: relative;
}

.base-radio:checked {
  border-color: var(--brand-primary);
}

.base-radio:checked::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--brand-primary);
}

.radio-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

/* Toggle / Switch */
.toggle-wrapper {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  cursor: pointer;
}

.base-toggle {
  width: 44px;
  height: 24px;
  position: relative;
  appearance: none;
  background: var(--surface-elevated);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: all var(--duration-normal);
}

.base-toggle:checked {
  background: var(--brand-primary);
  border-color: var(--brand-primary);
}

.toggle-slider {
  pointer-events: none;
  position: absolute;
  left: 2px;
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
  transition: transform var(--duration-normal);
  box-shadow: var(--shadow-sm);
}

.base-toggle:checked + .toggle-slider {
  transform: translateX(20px);
}

.toggle-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

/* Progress Bar */
.progress-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-bottom: var(--space-2);
  font-family: var(--font-mono);
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: var(--surface-elevated);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--brand-primary);
  border-radius: var(--radius-full);
  transition: width var(--duration-normal);
}

.progress-fill.success {
  background: var(--color-work);
}

/* Spinner */
.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-medium);
  border-top-color: var(--brand-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner-sm {
  width: 20px;
  height: 20px;
  border-width: 2px;
}

.spinner-lg {
  width: 48px;
  height: 48px;
  border-width: 4px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12);
  text-align: center;
  background: var(--surface-tertiary);
  border-radius: var(--radius-lg);
  border: 2px dashed var(--border-medium);
}

.empty-icon {
  font-size: 64px;
  margin-bottom: var(--space-4);
  opacity: 0.5;
}

.empty-title {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.empty-message {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin-bottom: var(--space-6);
}

/* Tabs */
.tabs-container {
  background: var(--surface-tertiary);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.tabs-header {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-2);
  background: var(--surface-secondary);
  border-bottom: 1px solid var(--border-medium);
}

.tab {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.tab:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.tab.active {
  background: var(--brand-primary);
  color: white;
  box-shadow: var(--purple-shadow-subtle);
}

.tab-content {
  padding: var(--space-6);
  color: var(--text-secondary);
}

/* Tooltip */
.tooltip-demo {
  position: relative;
  display: inline-block;
}

.demo-button {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--brand-primary);
  border: none;
  color: white;
  font-size: var(--text-sm);
  cursor: pointer;
}

.tooltip {
  position: absolute;
  background: var(--surface-elevated);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-xs);
  color: var(--text-primary);
  white-space: nowrap;
  z-index: 1000;
  box-shadow: var(--shadow-lg);
  opacity: 1;
  transition: opacity var(--duration-fast);
}

.tooltip-top {
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
}

.tooltip-arrow {
  position: absolute;
  width: 8px;
  height: 8px;
  background: var(--surface-elevated);
  border-right: 1px solid var(--border-medium);
  border-bottom: 1px solid var(--border-medium);
  transform: rotate(45deg);
  top: calc(100% - 4px);
  left: 50%;
  margin-left: -4px;
}

.tooltip-demo:hover .tooltip {
  opacity: 1;
}

/* Toast / Notification */
.toast {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  background: var(--surface-elevated);
  border: 1px solid var(--border-medium);
  box-shadow: var(--shadow-lg);
  min-width: 300px;
}

.toast-success {
  border-left: 4px solid var(--color-work);
}

.toast-error {
  border-left: 4px solid var(--color-danger);
}

.toast-info {
  border-left: 4px solid var(--brand-primary);
}

.toast-icon {
  font-size: var(--text-lg);
  flex-shrink: 0;
}

.toast-message {
  flex: 1;
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.toast-close {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: all var(--duration-fast);
}

.toast-close:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

/* Loading Skeleton */
.skeleton-card {
  background: var(--surface-tertiary);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
}

.skeleton {
  background: linear-gradient(
    90deg,
    var(--surface-elevated) 25%,
    var(--surface-hover) 50%,
    var(--surface-elevated) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s ease-in-out infinite;
  border-radius: var(--radius-md);
}

.skeleton-title {
  height: 24px;
  width: 60%;
  margin-bottom: var(--space-3);
}

.skeleton-text {
  height: 16px;
  width: 100%;
  margin-bottom: var(--space-2);
}

.skeleton-text.short {
  width: 40%;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
