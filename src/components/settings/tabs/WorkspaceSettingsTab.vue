<template>
  <div class="workspace-settings">
    <!-- Personal workspace message -->
    <div v-if="workspaceStore.isPersonalWorkspace" class="personal-message">
      {{ t('workspaces.personalOnly') }}
    </div>

    <template v-else>
      <!-- Members Section -->
      <SettingsSection :title="t('workspaces.members')">
        <div class="members-list">
          <div v-for="member in sortedMembers" :key="member.id" class="member-row">
            <!-- Avatar + Info -->
            <div class="member-info">
              <AssigneeAvatar :user-id="member.userId" :size="32" :show-tooltip="false" />
              <div class="member-details">
                <span class="member-name">
                  {{ member.displayName || member.email || member.userId.substring(0, 8) }}
                  <span v-if="member.userId === authStore.user?.id" class="you-label">{{ t('workspaces.you') }}</span>
                </span>
                <span v-if="member.email" class="member-email">{{ member.email }}</span>
              </div>
            </div>

            <!-- Role Badge + Actions -->
            <div class="member-actions">
              <!-- Role badge (always visible) -->
              <BaseBadge :variant="roleBadgeVariant(member.role)" size="sm" rounded>
                {{ t(`workspaces.roles.${member.role}`) }}
              </BaseBadge>

              <!-- Role change dropdown (for non-owners, when user canManageMembers) -->
              <CustomSelect
                v-if="workspaceStore.canManageMembers && member.role !== 'owner' && member.userId !== authStore.user?.id"
                :model-value="member.role"
                :options="roleOptions"
                :compact="true"
                @update:model-value="(val) => handleRoleChange(member, val as string)"
              />

              <!-- Remove button (for non-owners, when user canManageMembers) -->
              <BaseButton
                v-if="workspaceStore.canManageMembers && member.role !== 'owner' && member.userId !== authStore.user?.id"
                variant="ghost"
                size="sm"
                :aria-label="t('workspaces.removeMember')"
                @click="confirmRemoveMember(member)"
              >
                <UserMinus :size="14" />
              </BaseButton>
            </div>
          </div>
        </div>
      </SettingsSection>

      <!-- Danger Zone -->
      <SettingsSection :title="t('workspaces.dangerZone')">
        <!-- Transfer ownership (owner only) -->
        <div v-if="workspaceStore.isOwner" class="danger-action">
          <div class="danger-info">
            <span class="danger-label">{{ t('workspaces.transferOwnership') }}</span>
            <span class="danger-description">{{ t('workspaces.transferOwnershipDescription') }}</span>
          </div>
          <BaseButton variant="danger" size="sm" @click="showTransferModal = true">
            <Crown :size="14" />
            {{ t('workspaces.transferOwnership') }}
          </BaseButton>
        </div>

        <!-- Leave workspace (non-owners) -->
        <div v-if="!workspaceStore.isOwner" class="danger-action">
          <div class="danger-info">
            <span class="danger-label">{{ t('workspaces.leaveWorkspace') }}</span>
            <span class="danger-description">{{ t('workspaces.leaveWorkspaceDescription') }}</span>
          </div>
          <BaseButton variant="danger" size="sm" @click="showLeaveModal = true">
            <LogOut :size="14" />
            {{ t('workspaces.leaveWorkspace') }}
          </BaseButton>
        </div>

        <!-- Delete workspace (owner only) -->
        <div v-if="workspaceStore.isOwner" class="danger-action">
          <div class="danger-info">
            <span class="danger-label">{{ t('workspaces.deleteTitle') }}</span>
            <span class="danger-description">{{ t('workspaces.deleteDescription') }}</span>
          </div>
          <BaseButton variant="danger" size="sm" @click="showDeleteModal = true">
            <Trash2 :size="14" />
            {{ t('workspaces.deleteTitle') }}
          </BaseButton>
        </div>
      </SettingsSection>
    </template>

    <!-- Remove Member Confirmation -->
    <ConfirmationModal
      :is-open="!!memberToRemove"
      :title="t('workspaces.removeMember')"
      :message="memberToRemove ? t('workspaces.removeMemberConfirm', { name: memberToRemove.displayName || memberToRemove.userId.substring(0, 8) }) : ''"
      :confirm-text="t('workspaces.removeMember')"
      @confirm="handleRemoveMember"
      @cancel="memberToRemove = null"
    />

    <!-- Leave Workspace Confirmation -->
    <ConfirmationModal
      :is-open="showLeaveModal"
      :title="t('workspaces.leaveWorkspace')"
      :message="t('workspaces.leaveWorkspaceConfirm')"
      :confirm-text="t('workspaces.leaveWorkspace')"
      @confirm="handleLeaveWorkspace"
      @cancel="showLeaveModal = false"
    />

    <!-- Delete Workspace Confirmation -->
    <ConfirmationModal
      :is-open="showDeleteModal"
      :title="t('workspaces.deleteTitle')"
      :message="workspaceStore.activeWorkspace ? t('workspaces.deleteConfirm', { name: workspaceStore.activeWorkspace.name }) : ''"
      :confirm-text="t('workspaces.deleteTitle')"
      @confirm="handleDeleteWorkspace"
      @cancel="showDeleteModal = false"
    />

    <!-- Transfer Ownership Modal -->
    <BaseModal
      :is-open="showTransferModal"
      :title="t('workspaces.transferOwnership')"
      :description="t('workspaces.transferOwnershipDescription')"
      size="sm"
      variant="danger"
      show-footer
      close-on-overlay-click
      close-on-escape
      :confirm-disabled="!transferTargetId"
      @close="showTransferModal = false"
      @cancel="showTransferModal = false"
      @confirm="handleTransferOwnership"
    >
      <div class="transfer-select">
        <CustomSelect
          v-model="transferTargetId"
          :options="transferTargetOptions"
          :placeholder="t('workspaces.members')"
        />
      </div>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { UserMinus, Crown, LogOut, Trash2 } from 'lucide-vue-next'
import { useWorkspaceStore } from '@/stores/workspace'
import { useAuthStore } from '@/stores/auth'
import type { WorkspaceMember, WorkspaceRole } from '@/types/workspace'
import SettingsSection from '../SettingsSection.vue'
import AssigneeAvatar from '@/components/workspace/AssigneeAvatar.vue'
import BaseBadge from '@/components/base/BaseBadge.vue'
import BaseButton from '@/components/base/BaseButton.vue'
import BaseModal from '@/components/base/BaseModal.vue'
import ConfirmationModal from '@/components/common/ConfirmationModal.vue'
import CustomSelect from '@/components/common/CustomSelect.vue'

const emit = defineEmits<{ closeModal: [] }>()

const { t } = useI18n()
const workspaceStore = useWorkspaceStore()
const authStore = useAuthStore()

// Sort: owner first, then admin, then member, then viewer. Current user second in their tier.
const roleOrder: Record<string, number> = { owner: 0, admin: 1, member: 2, viewer: 3 }
const sortedMembers = computed(() => {
  return [...workspaceStore.activeMembers].sort((a, b) => {
    const ra = roleOrder[a.role] ?? 99
    const rb = roleOrder[b.role] ?? 99
    if (ra !== rb) return ra - rb
    // Current user goes first within same role
    if (a.userId === authStore.user?.id) return -1
    if (b.userId === authStore.user?.id) return 1
    return 0
  })
})

// Role badge variant mapping
function roleBadgeVariant(role: WorkspaceRole): 'info' | 'warning' | 'default' | 'count' {
  switch (role) {
    case 'owner': return 'info'
    case 'admin': return 'warning'
    case 'member': return 'default'
    case 'viewer': return 'count'
  }
}

// Role change options (exclude 'owner' — use transfer for that)
const roleOptions = computed(() => [
  { label: t('workspaces.roles.admin'), value: 'admin' },
  { label: t('workspaces.roles.member'), value: 'member' },
  { label: t('workspaces.roles.viewer'), value: 'viewer' },
])

// Transfer target options (all non-owner members)
const transferTargetOptions = computed(() =>
  workspaceStore.activeMembers
    .filter(m => m.role !== 'owner')
    .map(m => ({
      label: m.displayName || m.email || m.userId.substring(0, 8),
      value: m.userId,
    }))
)

// --- Remove member ---
const memberToRemove = ref<WorkspaceMember | null>(null)

function confirmRemoveMember(member: WorkspaceMember) {
  memberToRemove.value = member
}

async function handleRemoveMember() {
  if (!memberToRemove.value) return
  await workspaceStore.removeMember(memberToRemove.value.id)
  memberToRemove.value = null
}

// --- Leave workspace ---
const showLeaveModal = ref(false)

async function handleLeaveWorkspace() {
  const success = await workspaceStore.leaveWorkspace()
  showLeaveModal.value = false
  if (success) {
    emit('closeModal')
  }
}

// --- Transfer ownership ---
const showTransferModal = ref(false)
const transferTargetId = ref<string | null>(null)

async function handleTransferOwnership() {
  if (!transferTargetId.value) return
  const success = await workspaceStore.transferOwnership(transferTargetId.value)
  if (success) {
    showTransferModal.value = false
    transferTargetId.value = null
  }
}

// --- Delete workspace ---
const showDeleteModal = ref(false)

async function handleDeleteWorkspace() {
  if (!workspaceStore.activeWorkspaceId) return
  const success = await workspaceStore.deleteWorkspace(workspaceStore.activeWorkspaceId)
  showDeleteModal.value = false
  if (success) {
    emit('closeModal')
  }
}

// --- Role change ---
async function handleRoleChange(member: WorkspaceMember, newRole: string) {
  if (newRole === member.role) return
  await workspaceStore.updateMemberRole(member.id, newRole as WorkspaceRole)
}
</script>

<style scoped>
.workspace-settings {
  padding: var(--space-2) 0;
}

.personal-message {
  color: var(--text-muted);
  font-size: var(--text-sm);
  text-align: center;
  padding: var(--space-8) var(--space-4);
}

/* Members list */
.members-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.member-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: var(--glass-bg-soft);
  border: 1px solid var(--glass-border);
  transition: background var(--duration-fast) ease;
}

.member-row:hover {
  background: var(--glass-bg-medium);
}

.member-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
  flex: 1;
}

.member-details {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.member-name {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.you-label {
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-weight: var(--font-normal);
}

.member-email {
  font-size: var(--text-xs);
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Actions area */
.member-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}

/* Danger zone */
.danger-action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-danger-alpha-30);
  background: var(--glass-bg-soft);
}

.danger-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.danger-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-primary);
}

.danger-description {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

/* Transfer modal */
.transfer-select {
  padding: var(--space-4) 0;
}
</style>
