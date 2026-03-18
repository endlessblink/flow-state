<template>
  <div ref="containerRef" class="workspace-switcher">
    <button
      class="switcher-trigger"
      :aria-expanded="isOpen"
      aria-haspopup="listbox"
      @click="isOpen = !isOpen"
    >
      <span
        class="workspace-dot"
        :style="{ backgroundColor: activeColor }"
      />
      <span class="workspace-name">{{ activeName }}</span>
      <svg
        class="chevron"
        :class="{ open: isOpen }"
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M3 4.5L6 7.5L9 4.5"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>

    <Transition name="dropdown">
      <div v-if="isOpen" class="workspace-menu" role="listbox">
        <!-- Personal workspace -->
        <button
          class="workspace-option"
          :class="{ active: workspaceStore.isPersonalWorkspace }"
          role="option"
          :aria-selected="workspaceStore.isPersonalWorkspace"
          @click="switchTo(null)"
        >
          <span class="workspace-dot" style="background-color: var(--brand-primary)" />
          <span class="option-label">{{ $t('workspaces.personal') }}</span>
          <span v-if="workspaceStore.isPersonalWorkspace" class="active-check" aria-hidden="true">
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
            >
              <path
                d="M2 5L4 7L8 3"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </span>
        </button>

        <!-- Shared workspaces -->
        <template v-if="workspaceStore.workspaces.length">
          <div class="divider" />
          <div
            v-for="ws in workspaceStore.workspaces"
            :key="ws.id"
            class="workspace-option-row"
          >
            <button
              class="workspace-option"
              :class="{ active: workspaceStore.activeWorkspaceId === ws.id }"
              role="option"
              :aria-selected="workspaceStore.activeWorkspaceId === ws.id"
              @click="switchTo(ws.id)"
            >
              <span class="workspace-dot" :style="{ backgroundColor: ws.color }" />
              <span class="option-label">{{ ws.name }}</span>
              <span
                v-if="workspaceStore.activeWorkspaceId === ws.id"
                class="active-check"
                aria-hidden="true"
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                >
                  <path
                    d="M2 5L4 7L8 3"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
            </button>

            <!-- Copy invite link (owner/admin only, active workspace) -->
            <button
              v-if="canInvite && workspaceStore.activeWorkspaceId === ws.id"
              class="invite-btn"
              :title="$t('workspaces.copyInviteLink')"
              :aria-label="$t('workspaces.copyInviteLink')"
              @click.stop="handleCopyInviteLink(ws.id)"
            >
              <Transition name="icon-swap" mode="out-in">
                <svg
                  v-if="copiedWorkspaceId !== ws.id"
                  key="copy"
                  width="13"
                  height="13"
                  viewBox="0 0 14 14"
                  fill="none"
                  aria-hidden="true"
                >
                  <rect
                    x="4"
                    y="4"
                    width="8"
                    height="8"
                    rx="1.5"
                    stroke="currentColor"
                    stroke-width="1.25"
                  />
                  <path
                    d="M10 4V3C10 2.45 9.55 2 9 2H3C2.45 2 2 2.45 2 3V9C2 9.55 2.45 10 3 10H4"
                    stroke="currentColor"
                    stroke-width="1.25"
                    stroke-linecap="round"
                  />
                </svg>
                <svg
                  v-else
                  key="check"
                  width="13"
                  height="13"
                  viewBox="0 0 13 13"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 6.5L5 9.5L11 3.5"
                    stroke="var(--brand-primary)"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </Transition>
            </button>

            <!-- Delete workspace (owner only) -->
            <button
              v-if="ws.ownerId === authStore.user?.id"
              class="delete-ws-btn"
              :title="$t('common.delete')"
              :aria-label="$t('common.delete')"
              @click.stop="handleDeleteWorkspace(ws)"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M3 4.5H11M5.5 6.5V10M8.5 6.5V10M4 4.5L4.5 11.5C4.5 12.05 4.95 12.5 5.5 12.5H8.5C9.05 12.5 9.5 12.05 9.5 11.5L10 4.5M5.5 4.5V2.5C5.5 2.22 5.72 2 6 2H8C8.28 2 8.5 2.22 8.5 2.5V4.5"
                  stroke="currentColor"
                  stroke-width="1.15"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>
        </template>

        <!-- Divider before create section -->
        <div class="divider" />

        <!-- Create workspace: inline form or trigger button -->
        <Transition name="create-expand" mode="out-in">
          <div v-if="isCreating" key="form" class="create-form">
            <div class="create-input-row">
              <input
                ref="createInputRef"
                v-model="newWorkspaceName"
                class="create-input"
                :placeholder="$t('workspaces.newWorkspacePlaceholder')"
                maxlength="64"
                :disabled="isCreatingWorkspace"
                @keydown.enter.prevent="confirmCreate"
                @keydown.escape.prevent="cancelCreate"
              >
              <button
                class="create-confirm-btn"
                :disabled="!newWorkspaceName.trim() || isCreatingWorkspace"
                :aria-label="$t('workspaces.create')"
                @click="confirmCreate"
              >
                <svg
                  v-if="!isCreatingWorkspace"
                  width="13"
                  height="13"
                  viewBox="0 0 13 13"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 6.5L5 9.5L11 3.5"
                    stroke="currentColor"
                    stroke-width="1.75"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                <svg
                  v-else
                  class="spinner"
                  width="13"
                  height="13"
                  viewBox="0 0 13 13"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="6.5"
                    cy="6.5"
                    r="5"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-dasharray="10 20"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            </div>
            <button class="create-cancel-link" @click="cancelCreate">
              {{ $t('common.cancel') }}
            </button>
          </div>

          <button
            v-else
            key="trigger"
            class="workspace-option create-trigger"
            @click="openCreate"
          >
            <span class="create-plus-icon" aria-hidden="true">
              <svg
                width="13"
                height="13"
                viewBox="0 0 13 13"
                fill="none"
              >
                <path
                  d="M6.5 2V11M2 6.5H11"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                />
              </svg>
            </span>
            <span class="option-label">{{ $t('workspaces.createWorkspace') }}</span>
          </button>
        </Transition>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useWorkspaceStore } from '@/stores/workspace'
import { useAuthStore } from '@/stores/auth'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const workspaceStore = useWorkspaceStore()
const authStore = useAuthStore()

const isOpen = ref(false)
const containerRef = ref<HTMLElement | null>(null)
const createInputRef = ref<HTMLInputElement | null>(null)

const isCreating = ref(false)
const newWorkspaceName = ref('')
const isCreatingWorkspace = ref(false)
const copiedWorkspaceId = ref<string | null>(null)

const activeName = computed(() =>
  workspaceStore.activeWorkspace?.name || t('workspaces.personal')
)

const activeColor = computed(() =>
  workspaceStore.activeWorkspace?.color || 'var(--brand-primary)'
)

const canInvite = computed(() =>
  workspaceStore.userRole === 'owner' || workspaceStore.userRole === 'admin'
)

function switchTo(id: string | null) {
  workspaceStore.switchWorkspace(id)
  isOpen.value = false
  cancelCreate()
}

async function openCreate() {
  isCreating.value = true
  newWorkspaceName.value = ''
  await nextTick()
  createInputRef.value?.focus()
}

function cancelCreate() {
  isCreating.value = false
  newWorkspaceName.value = ''
  isCreatingWorkspace.value = false
}

async function confirmCreate() {
  const name = newWorkspaceName.value.trim()
  if (!name || isCreatingWorkspace.value) return

  isCreatingWorkspace.value = true
  try {
    const workspace = await workspaceStore.createWorkspace(name)
    if (workspace) {
      await workspaceStore.switchWorkspace(workspace.id)
      cancelCreate()
      isOpen.value = false
    }
  } finally {
    isCreatingWorkspace.value = false
  }
}

async function handleCopyInviteLink(workspaceId: string) {
  const email = window.prompt(t('workspaces.inviteEmailPlaceholder')) ?? ''
  if (!email.trim()) return

  const link = await workspaceStore.generateInviteLink(workspaceId, email.trim())
  if (!link) return

  try {
    await navigator.clipboard.writeText(link)
    copiedWorkspaceId.value = workspaceId
    setTimeout(() => {
      copiedWorkspaceId.value = null
    }, 2000)
  } catch {
    // Fallback for environments where clipboard API is unavailable
    window.prompt(t('workspaces.copyInviteLink'), link)
  }
}

async function handleDeleteWorkspace(ws: { id: string; name: string }) {
  const confirmed = window.confirm(`Delete workspace "${ws.name}"? This cannot be undone.`)
  if (!confirmed) return

  const success = await workspaceStore.deleteWorkspace(ws.id)
  if (success) {
    // If the dropdown is still open and we deleted the active one, it'll auto-switch to personal
    // Close the dropdown for a clean UX
    isOpen.value = false
  }
}

function handleOutsideClick(event: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    isOpen.value = false
    cancelCreate()
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleOutsideClick)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleOutsideClick)
})
</script>

<style scoped>
.workspace-switcher {
  padding: var(--space-2) var(--space-3);
  position: relative;
}

/* ── Trigger button ── */
.switcher-trigger {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2) var(--space-3);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 500;
  transition: border-color 0.15s ease, background 0.15s ease;
  text-align: start;
}

.switcher-trigger:hover {
  border-color: var(--brand-primary);
  background: var(--glass-bg-medium);
}

/* ── Color dot ── */
.workspace-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* ── Name ── */
.workspace-name {
  flex: 1;
  text-align: start;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Chevron ── */
.chevron {
  flex-shrink: 0;
  opacity: 0.45;
  transition: transform 0.15s ease, opacity 0.15s ease;
  color: var(--text-secondary);
}

.chevron.open {
  transform: rotate(180deg);
  opacity: 0.7;
}

/* ── Dropdown menu ── */
.workspace-menu {
  position: absolute;
  top: calc(100% - var(--space-1));
  inset-inline-start: var(--space-3);
  inset-inline-end: var(--space-3);
  min-width: 200px;
  padding: var(--space-1);
  background: var(--overlay-component-bg, var(--glass-bg-heavy));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: var(--shadow-xl);
  z-index: 200;
}

/* ── Option row (wraps button + invite btn) ── */
.workspace-option-row {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.workspace-option-row .workspace-option {
  flex: 1;
}

/* ── Option button ── */
.workspace-option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-2) var(--space-3);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.8125rem;
  text-align: start;
  transition: background 0.1s ease;
}

.workspace-option:hover {
  background: var(--glass-bg-soft);
}

.workspace-option.active {
  color: var(--brand-primary);
  font-weight: 500;
}

.option-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Active checkmark ── */
.active-check {
  color: var(--brand-primary);
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

/* ── Create workspace trigger ── */
.create-trigger {
  color: var(--text-secondary);
}

.create-trigger:hover {
  color: var(--brand-primary);
}

.create-plus-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px dashed currentColor;
  flex-shrink: 0;
  transition: border-color 0.1s ease;
}

/* ── Inline create form ── */
.create-form {
  padding: var(--space-1_5) var(--space-2);
}

.create-input-row {
  display: flex;
  align-items: center;
  gap: var(--space-1_5);
}

.create-input {
  flex: 1;
  height: 30px;
  padding: 0 var(--space-2);
  background: var(--glass-bg-medium);
  border: 1px solid var(--glass-border-hover);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 0.8125rem;
  outline: none;
  transition: border-color 0.15s ease;
  min-width: 0;
}

.create-input::placeholder {
  color: var(--text-tertiary, var(--text-secondary));
  opacity: 0.6;
}

.create-input:focus {
  border-color: var(--brand-primary);
  background: var(--glass-bg-heavy);
}

.create-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── Confirm button (teal, glass) ── */
.create-confirm-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  background: var(--glass-bg-soft);
  border: 1px solid var(--brand-primary);
  border-radius: var(--radius-sm);
  color: var(--brand-primary);
  cursor: pointer;
  transition: background 0.15s ease, opacity 0.15s ease;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.create-confirm-btn:hover:not(:disabled) {
  background: var(--brand-primary-subtle);
}

.create-confirm-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  border-color: var(--glass-border);
  color: var(--text-secondary);
}

/* ── Cancel link ── */
.create-cancel-link {
  display: block;
  margin-block-start: var(--space-1);
  padding: 0 var(--space-1);
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 0.75rem;
  cursor: pointer;
  text-align: start;
  opacity: 0.7;
  transition: opacity 0.1s ease;
}

.create-cancel-link:hover {
  opacity: 1;
}

/* ── Delete workspace button (owner only) ── */
.delete-ws-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;
  opacity: 0;
  pointer-events: none;
}

.workspace-option-row:hover .delete-ws-btn {
  opacity: 1;
  pointer-events: auto;
}

.delete-ws-btn:hover {
  background: var(--glass-bg-soft);
  color: var(--color-danger);
}

/* ── Invite copy button ── */
.invite-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;
  margin-inline-end: var(--space-1);
}

.invite-btn:hover {
  background: var(--glass-bg-soft);
  color: var(--brand-primary);
}

/* ── Divider ── */
.divider {
  height: 1px;
  background: var(--glass-border);
  margin: var(--space-1) 0;
}

/* ── Spinner animation ── */
.spinner {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ── Dropdown transition ── */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ── Create form expand transition ── */
.create-expand-enter-active,
.create-expand-leave-active {
  transition: opacity 0.15s ease;
}

.create-expand-enter-from,
.create-expand-leave-to {
  opacity: 0;
}

/* ── Icon swap transition (copy → check) ── */
.icon-swap-enter-active,
.icon-swap-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}

.icon-swap-enter-from {
  opacity: 0;
  transform: scale(0.6);
}

.icon-swap-leave-to {
  opacity: 0;
  transform: scale(1.2);
}
</style>
